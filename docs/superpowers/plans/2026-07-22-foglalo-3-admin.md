# Foglaló rendszer – 3. fázis: Admin felület – Implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Egy jelszóval védett `admin.html`, ahol a vállalkozó belép, látja a beérkezett foglalásokat, kezeli a szabad időpontokat (sablon, generálás, letiltás, egyedi sáv), és szerkeszti a legördülő listákat.

**Architecture:** Külön statikus `admin.html` + `js/admin.js` + `css/admin.css`. Supabase Auth (e-mail+jelszó) a belépéshez; a munkamenet a böngészőben tárolódik. Az adatműveleteket az RLS védi (a belépett = a tulajdonos, teljes hozzáféréssel). Az admin nincs a főoldalról linkelve, csak közvetlen URL-en érhető el.

**Tech Stack:** vanilla JS, supabase-js v2 (CDN), Supabase Auth + RLS + `generate_idopontok` RPC.

## Global Constraints

- Supabase URL: `https://psmdpfxionlpiaxawupf.supabase.co`, publikus kulcs: `sb_publishable_bJw2kXa0k-hKFqHLOMeNFw_e7i_QYmZ`.
- Admin belépés: `nagy.zsoltee92@gmail.com` (a fiókot a tulajdonos hozza létre a Supabase felületén — lásd 10.).
- RLS (1. fázisból): `authenticated` szerep teljes hozzáférés a `foglalasok`, `idopontok`, `sablon_savok`, `klima_opciok` táblákhoz; `anon` csak `szabad` sávot / `aktiv` opciót olvas.
- `generate_idopontok(hetek int)` RPC csak `authenticated`-nek.
- Dizájn: a `styles.css` változóit (`--petrol`, `--mint`, `--surface`, `.btn`, `.field`) használjuk; admin-specifikus stílus `css/admin.css`.
- Nyelv: magyar.

---

### Task 1: `admin.html` váz + belépés/kilépés

**Files:**
- Create: `admin.html`
- Create: `js/admin.js`
- Create: `css/admin.css`

**Interfaces:**
- Produces: `#admin-login` (belépő nézet), `#admin-app` (admin nézet, kezdetben rejtett), `#admin-email`, `#admin-jelszo`, `#admin-belep`, `#admin-login-hiba`, `#admin-kilep`, `#admin-user`. Nézetváltás a Supabase auth állapot alapján.

- [ ] **Step 1: `admin.html`**
```html
<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Admin – BG Klímatechnika</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Figtree:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="css/admin.css" />
</head>
<body class="admin-body">
  <!-- Belépés -->
  <div class="admin-login" id="admin-login" hidden>
    <form class="admin-login-card" id="admin-login-form">
      <h1>BG Klímatechnika – Admin</h1>
      <div class="field"><label for="admin-email">E-mail</label>
        <input id="admin-email" type="email" autocomplete="username" required /></div>
      <div class="field"><label for="admin-jelszo">Jelszó</label>
        <input id="admin-jelszo" type="password" autocomplete="current-password" required /></div>
      <button type="submit" class="btn btn-primary btn-block" id="admin-belep">Belépés</button>
      <p class="form-status" id="admin-login-hiba" role="status"></p>
    </form>
  </div>

  <!-- Admin alkalmazás -->
  <div class="admin-app" id="admin-app" hidden>
    <header class="admin-fejlec">
      <strong>BG Klímatechnika – Admin</strong>
      <div class="admin-fejlec-jobb">
        <span id="admin-user" class="admin-user"></span>
        <button class="btn btn-ghost" id="admin-kilep">Kilépés</button>
      </div>
    </header>
    <nav class="admin-tabok">
      <button class="admin-tab aktiv" data-tab="foglalasok">Foglalások</button>
      <button class="admin-tab" data-tab="idopontok">Időpontok</button>
      <button class="admin-tab" data-tab="sablon">Heti sablon</button>
      <button class="admin-tab" data-tab="opciok">Legördülők</button>
    </nav>
    <main class="admin-fo">
      <section class="admin-panel aktiv" id="panel-foglalasok"><div id="foglalasok-lista">Betöltés…</div></section>
      <section class="admin-panel" id="panel-idopontok"></section>
      <section class="admin-panel" id="panel-sablon"></section>
      <section class="admin-panel" id="panel-opciok"></section>
    </main>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  <script src="js/admin.js"></script>
</body>
</html>
```

- [ ] **Step 2: `js/admin.js` – kliens, auth-állapot, belépés/kilépés, tabváltás**
```js
(function () {
  "use strict";
  var SUPABASE_URL = "https://psmdpfxionlpiaxawupf.supabase.co";
  var SUPABASE_KEY = "sb_publishable_bJw2kXa0k-hKFqHLOMeNFw_e7i_QYmZ";
  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var loginView = document.getElementById("admin-login");
  var appView = document.getElementById("admin-app");
  var betoltve = { foglalasok: false, idopontok: false, sablon: false, opciok: false };

  function mutatNezet(bejelentkezve, user) {
    loginView.hidden = bejelentkezve;
    appView.hidden = !bejelentkezve;
    if (bejelentkezve) {
      document.getElementById("admin-user").textContent = user ? user.email : "";
      valtTab("foglalasok");
    }
  }

  // Belépés
  document.getElementById("admin-login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var hiba = document.getElementById("admin-login-hiba");
    hiba.textContent = ""; hiba.className = "form-status";
    var btn = document.getElementById("admin-belep");
    btn.disabled = true; btn.textContent = "Belépés…";
    db.auth.signInWithPassword({
      email: document.getElementById("admin-email").value.trim(),
      password: document.getElementById("admin-jelszo").value
    }).then(function (res) {
      btn.disabled = false; btn.textContent = "Belépés";
      if (res.error) { hiba.textContent = "Hibás e-mail vagy jelszó."; hiba.classList.add("err"); }
    });
  });

  // Kilépés
  document.getElementById("admin-kilep").addEventListener("click", function () {
    db.auth.signOut();
  });

  // Auth állapotfigyelő (belépés/kilépés/oldalbetöltés)
  db.auth.onAuthStateChange(function (_event, session) {
    betoltve = { foglalasok: false, idopontok: false, sablon: false, opciok: false };
    mutatNezet(!!session, session ? session.user : null);
  });

  // Tabváltás
  function valtTab(nev) {
    document.querySelectorAll(".admin-tab").forEach(function (t) {
      t.classList.toggle("aktiv", t.getAttribute("data-tab") === nev);
    });
    document.querySelectorAll(".admin-panel").forEach(function (p) {
      p.classList.toggle("aktiv", p.id === "panel-" + nev);
    });
    if (!betoltve[nev]) { betoltve[nev] = true; betoltPanel(nev); }
  }
  document.querySelectorAll(".admin-tab").forEach(function (t) {
    t.addEventListener("click", function () { valtTab(t.getAttribute("data-tab")); });
  });

  // Panel-betöltő diszpécser (a további taskok töltik fel)
  function betoltPanel(nev) {
    if (nev === "foglalasok") betoltFoglalasok();
    else if (nev === "idopontok") betoltIdopontok();
    else if (nev === "sablon") betoltSablon();
    else if (nev === "opciok") betoltOpciok();
  }

  // Ideiglenes placeholder-ek (a következő taskok valósítják meg)
  function betoltFoglalasok() {}
  function betoltIdopontok() {}
  function betoltSablon() {}
  function betoltOpciok() {}

  // Globálisan elérhető segéd a további taskoknak
  window.__admin = { db: db };
})();
```
Megjegyzés: a `betoltFoglalasok/Idopontok/Sablon/Opciok` függvényeket a 2–5. taskban **ugyanebben a fájlban** bővítjük ki (nem külön globális).

- [ ] **Step 3: `css/admin.css`** – alap admin elrendezés (világos háttér, fejléc, tabok, panelek, login-kártya). A `styles.css` változóit használva.

- [ ] **Step 4: Ellenőrzés (böngésző)**
`preview_start` → `admin.html` → a **belépő űrlap** jelenik meg. Hibás adattal „Hibás e-mail vagy jelszó." A valódi belépést az 5. task után, teszt-fiókkal ellenőrizzük (6. task).

- [ ] **Step 5: Commit**
```bash
git add admin.html js/admin.js css/admin.css && git commit -m "feat(admin): admin.html váz, belépés/kilépés, tabváltás"
```

---

### Task 2: Foglalások listája

**Files:**
- Modify: `js/admin.js` (a `betoltFoglalasok` függvény)

**Interfaces:**
- Consumes: `foglalasok` + `idopontok` (join), `#foglalasok-lista`.
- Produces: időrendben (közelgő időpont szerint) a foglalások kártyái minden adattal.

- [ ] **Step 1: `betoltFoglalasok` implementáció**
```js
  function esc(s){ return (s==null?"":String(s)).replace(/[&<>]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }
  function huIdo(iso){ var d=new Date(iso); function p(n){return (n<10?"0":"")+n;}
    return d.getFullYear()+". "+p(d.getMonth()+1)+". "+p(d.getDate())+". "+p(d.getHours())+":"+p(d.getMinutes()); }
  function ft(n){ return (n==null?"-":Number(n).toLocaleString("hu-HU")+" Ft"); }

  function betoltFoglalasok() {
    var el = document.getElementById("foglalasok-lista");
    el.textContent = "Betöltés…";
    db.from("foglalasok").select("*, idopontok(kezdes)").order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) { el.textContent = "Hiba a betöltéskor."; return; }
        if (!res.data.length) { el.innerHTML = '<p class="admin-ures">Még nincs foglalás.</p>'; return; }
        el.innerHTML = res.data.map(function (f) {
          var idopont = f.idopontok ? huIdo(f.idopontok.kezdes) : "-";
          var szamla = f.szamla_megegyezik ? "a szolgáltatási címmel megegyező"
            : esc([f.szamla_nev, f.szamla_irsz, f.szamla_cim].filter(Boolean).join(", "));
          return '<article class="admin-foglalas">'
            + '<div class="admin-foglalas-fej"><span class="admin-foglalas-idopont">' + idopont + '</span>'
            + '<span class="admin-foglalas-ar">' + ft(f.ar) + " · " + esc(f.klima_darab) + ' db</span></div>'
            + '<p class="admin-foglalas-nev">' + esc(f.nev_cegnev) + '</p>'
            + '<dl class="admin-foglalas-adatok">'
            + '<dt>Cím</dt><dd>' + esc([f.irsz, f.cim].filter(Boolean).join(" ")) + (f.emelet?(", "+esc(f.emelet)+". em."):"") + (f.ajto?(" "+esc(f.ajto)+". ajtó"):"") + '</dd>'
            + '<dt>Belmagasság</dt><dd>' + esc(f.belmagassag||"-") + '</dd>'
            + '<dt>Telefon</dt><dd><a href="tel:' + esc(f.telefon) + '">' + esc(f.telefon) + '</a></dd>'
            + '<dt>E-mail</dt><dd><a href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a></dd>'
            + '<dt>Klíma</dt><dd>' + esc([f.klima_marka, f.klima_tipus, f.klima_teljesitmeny].filter(Boolean).join(" · ")||"-") + '</dd>'
            + '<dt>Számlázás</dt><dd>' + (szamla||"-") + (f.adoszam?(" · adószám: "+esc(f.adoszam)):"") + '</dd>'
            + (f.megjegyzes?('<dt>Megjegyzés</dt><dd>'+esc(f.megjegyzes)+'</dd>'):"")
            + '</dl></article>';
        }).join("");
      });
  }
```

- [ ] **Step 2: Ellenőrzés** – a 6. taskban, teszt-fiókkal belépve + egy teszt-foglalással.

- [ ] **Step 3: Commit**
```bash
git add js/admin.js && git commit -m "feat(admin): foglalások listája"
```

---

### Task 3: Időpontok kezelése (lista, letiltás, törlés, generálás, egyedi)

**Files:**
- Modify: `js/admin.js` (`betoltIdopontok`)

**Interfaces:**
- Consumes: `idopontok`, `generate_idopontok` RPC, `#panel-idopontok`.
- Produces: közelgő sávok listája státusszal; `szabad`↔`letiltva` váltás; `foglalt` sáv csak olvasható; sáv törlése (ha nincs foglalás); „6 hétre legyártás" gomb; egyedi sáv hozzáadása (dátum+idő).

- [ ] **Step 1: `betoltIdopontok` implementáció**
```js
  function betoltIdopontok() {
    var panel = document.getElementById("panel-idopontok");
    panel.innerHTML =
      '<div class="admin-eszkozok">'
      + '<button class="btn btn-primary" id="gen-btn">6 hétre legyártás</button>'
      + '<form class="admin-egyedi" id="egyedi-form">'
      + '<input type="datetime-local" id="egyedi-datum" required /> '
      + '<button class="btn btn-ghost" type="submit">Egyedi időpont hozzáadása</button>'
      + '</form><span id="idopont-uzenet" class="admin-uzenet"></span></div>'
      + '<div id="idopontok-lista">Betöltés…</div>';

    document.getElementById("gen-btn").onclick = function () {
      var u = document.getElementById("idopont-uzenet");
      u.textContent = "Generálás…";
      db.rpc("generate_idopontok", { hetek: 6 }).then(function (res) {
        u.textContent = res.error ? "Hiba a generáláskor." : (res.data + " új időpont létrehozva.");
        listaIdopontok();
      });
    };
    document.getElementById("egyedi-form").onsubmit = function (e) {
      e.preventDefault();
      var val = document.getElementById("egyedi-datum").value; // "YYYY-MM-DDTHH:MM" helyi idő
      if (!val) return;
      db.from("idopontok").insert({ kezdes: new Date(val).toISOString(), statusz: "szabad", forras: "egyedi" })
        .then(function (res) {
          document.getElementById("idopont-uzenet").textContent = res.error ? "Nem sikerült (talán már létezik ez az időpont)." : "Egyedi időpont hozzáadva.";
          listaIdopontok();
        });
    };
    listaIdopontok();
  }

  function listaIdopontok() {
    var el = document.getElementById("idopontok-lista");
    el.textContent = "Betöltés…";
    db.from("idopontok").select("id,kezdes,statusz,forras").gte("kezdes", new Date().toISOString()).order("kezdes")
      .then(function (res) {
        if (res.error) { el.textContent = "Hiba."; return; }
        if (!res.data.length) { el.innerHTML = '<p class="admin-ures">Nincs közelgő időpont. Kattints a „6 hétre legyártás" gombra.</p>'; return; }
        el.innerHTML = res.data.map(function (i) {
          var lehetToggle = i.statusz !== "foglalt";
          var toggleSzoveg = i.statusz === "letiltva" ? "Engedélyez" : "Letilt";
          return '<div class="admin-idopont statusz-' + i.statusz + '">'
            + '<span class="admin-idopont-ido">' + huIdo(i.kezdes) + '</span>'
            + '<span class="admin-idopont-badge">' + i.statusz + (i.forras === "egyedi" ? " · egyedi" : "") + '</span>'
            + '<span class="admin-idopont-gombok">'
            + (lehetToggle ? '<button class="admin-mini" data-toggle="' + i.id + '" data-statusz="' + i.statusz + '">' + toggleSzoveg + '</button>' : '')
            + (i.statusz !== "foglalt" ? '<button class="admin-mini admin-mini-torol" data-torol="' + i.id + '">Törlés</button>' : '')
            + '</span></div>';
        }).join("");
      });
  }

  // Esemény-delegálás a lista gombjaira
  document.getElementById("panel-idopontok").addEventListener("click", function (e) {
    var tg = e.target.closest("[data-toggle]");
    var tr = e.target.closest("[data-torol]");
    if (tg) {
      var ujStatusz = tg.getAttribute("data-statusz") === "letiltva" ? "szabad" : "letiltva";
      db.from("idopontok").update({ statusz: ujStatusz }).eq("id", tg.getAttribute("data-toggle")).then(listaIdopontok);
    } else if (tr) {
      if (!window.confirm("Biztosan törlöd ezt az időpontot?")) return;
      db.from("idopontok").delete().eq("id", tr.getAttribute("data-torol")).then(listaIdopontok);
    }
  });
```

- [ ] **Step 2: Ellenőrzés** – 6. taskban (belépve): a lista betölt, letiltás→engedélyezés vált, egyedi sáv hozzáadható, törlés működik.

- [ ] **Step 3: Commit**
```bash
git add js/admin.js && git commit -m "feat(admin): időpontok kezelése (letiltás, törlés, generálás, egyedi)"
```

---

### Task 4: Heti sablon kezelése

**Files:**
- Modify: `js/admin.js` (`betoltSablon`)

**Interfaces:**
- Consumes: `sablon_savok`, `#panel-sablon`.
- Produces: napokra bontva a sablon-sávok; sáv hozzáadása (nap+idő) és törlése. Figyelmeztetés: a változás csak a **jövőbeli** generálásokra hat.

- [ ] **Step 1: `betoltSablon` implementáció**
```js
  var NAPOK = ["", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
  function betoltSablon() {
    var panel = document.getElementById("panel-sablon");
    panel.innerHTML =
      '<p class="admin-info">A heti sablon a „6 hétre legyártás" alapja. A módosítás a következő generáláskor lép életbe (a már létező időpontokat nem változtatja).</p>'
      + '<form class="admin-egyedi" id="sablon-form">'
      + '<select id="sablon-nap">' + [1,2,3,4,5,6,7].map(function (n) { return '<option value="' + n + '">' + NAPOK[n] + "</option>"; }).join("") + "</select> "
      + '<input type="time" id="sablon-ido" required /> '
      + '<button class="btn btn-ghost" type="submit">Sáv hozzáadása</button></form>'
      + '<div id="sablon-lista">Betöltés…</div>';
    document.getElementById("sablon-form").onsubmit = function (e) {
      e.preventDefault();
      db.from("sablon_savok").insert({ nap: parseInt(document.getElementById("sablon-nap").value, 10), kezdes: document.getElementById("sablon-ido").value })
        .then(listaSablon);
    };
    listaSablon();
  }
  function listaSablon() {
    var el = document.getElementById("sablon-lista");
    db.from("sablon_savok").select("id,nap,kezdes").order("nap").order("kezdes").then(function (res) {
      if (res.error) { el.textContent = "Hiba."; return; }
      var perNap = {};
      res.data.forEach(function (s) { (perNap[s.nap] = perNap[s.nap] || []).push(s); });
      var html = "";
      for (var n = 1; n <= 7; n++) {
        html += '<div class="admin-sablon-nap"><strong>' + NAPOK[n] + "</strong><div class='admin-sablon-savok'>";
        html += (perNap[n] || []).map(function (s) {
          return '<span class="admin-sablon-sav">' + s.kezdes.slice(0, 5) + '<button class="admin-x" data-sablon-torol="' + s.id + '" aria-label="Törlés">×</button></span>';
        }).join("") || '<span class="admin-ures">—</span>';
        html += "</div></div>";
      }
      el.innerHTML = html;
    });
  }
  document.getElementById("panel-sablon").addEventListener("click", function (e) {
    var t = e.target.closest("[data-sablon-torol]");
    if (!t) return;
    db.from("sablon_savok").delete().eq("id", t.getAttribute("data-sablon-torol")).then(listaSablon);
  });
```

- [ ] **Step 2: Ellenőrzés** – 6. taskban: a sablon napokra bontva látszik; sáv hozzáadható/törölhető.

- [ ] **Step 3: Commit**
```bash
git add js/admin.js && git commit -m "feat(admin): heti sablon kezelése"
```

---

### Task 5: Legördülők kezelése

**Files:**
- Modify: `js/admin.js` (`betoltOpciok`)

**Interfaces:**
- Consumes: `klima_opciok`, `#panel-opciok`.
- Produces: kategóriánként (márka/típus/teljesítmény) az értékek; új hozzáadása, aktív ki/be, törlés, sorrend módosítása.

- [ ] **Step 1: `betoltOpciok` implementáció**
```js
  var KATEGORIAK = [["marka", "Márka"], ["tipus", "Típus"], ["teljesitmeny", "Teljesítmény"]];
  function betoltOpciok() {
    document.getElementById("panel-opciok").innerHTML = KATEGORIAK.map(function (k) {
      return '<div class="admin-opcio-kat" data-kat="' + k[0] + '"><h3>' + k[1] + '</h3>'
        + '<div class="admin-opcio-lista">Betöltés…</div>'
        + '<form class="admin-egyedi" data-uj="' + k[0] + '"><input type="text" placeholder="Új érték" required /> '
        + '<button class="btn btn-ghost" type="submit">Hozzáad</button></form></div>';
    }).join("");
    listaOpciok();
    document.querySelectorAll("[data-uj]").forEach(function (form) {
      form.onsubmit = function (e) {
        e.preventDefault();
        var input = form.querySelector("input");
        db.from("klima_opciok").insert({ kategoria: form.getAttribute("data-uj"), ertek: input.value.trim(), sorrend: 50, aktiv: true })
          .then(function () { input.value = ""; listaOpciok(); });
      };
    });
  }
  function listaOpciok() {
    db.from("klima_opciok").select("id,kategoria,ertek,sorrend,aktiv").order("kategoria").order("sorrend").then(function (res) {
      if (res.error) return;
      KATEGORIAK.forEach(function (k) {
        var lista = document.querySelector('.admin-opcio-kat[data-kat="' + k[0] + '"] .admin-opcio-lista');
        var sorok = res.data.filter(function (o) { return o.kategoria === k[0]; });
        lista.innerHTML = sorok.map(function (o) {
          return '<div class="admin-opcio-sor' + (o.aktiv ? "" : " inaktiv") + '">'
            + '<span class="admin-opcio-ertek">' + esc(o.ertek) + '</span>'
            + '<span class="admin-opcio-gombok">'
            + '<button class="admin-mini" data-aktiv="' + o.id + '" data-ertek="' + (o.aktiv ? "1" : "0") + '">' + (o.aktiv ? "Elrejt" : "Megjelenít") + '</button>'
            + '<button class="admin-mini admin-mini-torol" data-opcio-torol="' + o.id + '">Törlés</button>'
            + '</span></div>';
        }).join("") || '<span class="admin-ures">Nincs érték.</span>';
      });
    });
  }
  document.getElementById("panel-opciok").addEventListener("click", function (e) {
    var a = e.target.closest("[data-aktiv]");
    var t = e.target.closest("[data-opcio-torol]");
    if (a) {
      db.from("klima_opciok").update({ aktiv: a.getAttribute("data-ertek") !== "1" }).eq("id", a.getAttribute("data-aktiv")).then(listaOpciok);
    } else if (t) {
      if (!window.confirm("Biztosan törlöd ezt az értéket?")) return;
      db.from("klima_opciok").delete().eq("id", t.getAttribute("data-opcio-torol")).then(listaOpciok);
    }
  });
```

- [ ] **Step 2: Ellenőrzés** – 6. taskban: kategóriánként a lista; új érték hozzáadása; elrejt/megjelenít; törlés.

- [ ] **Step 3: Commit**
```bash
git add js/admin.js && git commit -m "feat(admin): legördülők kezelése"
```

---

### Task 6: Admin stílus + teszt-fiókkal end-to-end ellenőrzés + deploy

**Files:**
- Modify: `css/admin.css`

- [ ] **Step 1: `css/admin.css` kiegészítése** – foglalás-kártyák, időpont-sorok (státusz-színek), sablon-napok, opció-sorok, tabok, eszköz-sorok, reszponzív. A `styles.css` változóit használva.

- [ ] **Step 2: Teszt admin-fiók létrehozása (ellenőrzéshez)**
`execute_sql` (a fiók a teszt végén törlődik):
```sql
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        'admin-teszt@bgklima.hu', crypt('Teszt1234!', gen_salt('bf')), now(), now(), now())
returning id;
```
Ha a beszúrás nem megy (GoTrue verzió), a valós fiókot a tulajdonos hozza létre a Supabase felületén, és ő teszteli a belépést.

- [ ] **Step 3: End-to-end ellenőrzés (böngésző)**
`admin.html` → belépés `admin-teszt@bgklima.hu` / `Teszt1234!` →
  - Foglalások: (vegyél fel 1 tesztfoglalást a publikus oldalon vagy SQL-lel) → megjelenik minden adattal.
  - Időpontok: lista betölt; letilt→engedélyez; egyedi sáv; törlés.
  - Sablon: napokra bontva; hozzáad/töröl.
  - Legördülők: kategóriánként; hozzáad/elrejt/töröl.
  - Kilépés → vissza a belépő nézetre.

- [ ] **Step 4: Teszt-fiók + tesztadat törlése**
```sql
delete from auth.users where email = 'admin-teszt@bgklima.hu';
-- teszt-foglalás és opciók visszaállítása, ha kellett
```

- [ ] **Step 5: Commit + deploy**
```bash
git add css/admin.css admin.html js/admin.js && git commit -m "feat(admin): admin stílusok + záró"
git push origin main
```

---

## Fázis-lezárás / ellenőrzőlista

- [ ] `admin.html` belépés nélkül csak a login nézetet mutatja.
- [ ] Belépve mind a 4 tab betölt és a műveletek működnek (RLS engedi).
- [ ] Kilépés után újra a login nézet.
- [ ] Nincs konzolhiba; a teszt-fiók törölve.

## 10. A tulajdonos egyszeri teendői (végigvezetve)

1. **Admin fiók:** Supabase → Authentication → Users → **Add user** → e-mail `nagy.zsoltee92@gmail.com`, jelszó, „Auto Confirm User" bepipálva.
2. **Regisztráció kikapcsolása:** Supabase → Authentication → Sign In / Providers → Email → „Allow new users to sign up" **KI**.
3. Az admin az `admin.html` címen érhető el (érdemes könyvjelzőzni).

## Következő fázis

- **4. fázis – Értesítések:** Edge Function + Database Webhook + Resend + .ics (vállalkozónak most, ügyfélnek domain után).
