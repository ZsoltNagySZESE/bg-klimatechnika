/* =========================================================
   BG Klímatechnika — Admin felület
   ========================================================= */
(function () {
  "use strict";

  var SUPABASE_URL = "https://psmdpfxionlpiaxawupf.supabase.co";
  var SUPABASE_KEY = "sb_publishable_bJw2kXa0k-hKFqHLOMeNFw_e7i_QYmZ";
  var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  var loginView = document.getElementById("admin-login");
  var appView = document.getElementById("admin-app");
  var betoltve = { foglalasok: false, idopontok: false, sablon: false, opciok: false };

  /* ---------- Segédfüggvények ---------- */
  function esc(s) { return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function huIdo(iso) { var d = new Date(iso); return d.getFullYear() + ". " + p2(d.getMonth() + 1) + ". " + p2(d.getDate()) + ". " + p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  function ft(n) { return (n == null ? "-" : Number(n).toLocaleString("hu-HU") + " Ft"); }

  // Google Naptár „esemény hozzáadása" link a foglalás adataiból (90 perces esemény)
  function gcalDatum(d) { return d.getUTCFullYear() + p2(d.getUTCMonth() + 1) + p2(d.getUTCDate()) + "T" + p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + "00Z"; }
  function gcalLink(f) {
    if (!f.idopontok) return "";
    var start = new Date(f.idopontok.kezdes);
    var end = new Date(start.getTime() + 90 * 60000);
    var cim = [f.irsz, f.telepules, f.cim].filter(Boolean).join(" ") + (f.emelet ? (", " + f.emelet + ". em.") : "") + (f.ajto ? (" " + f.ajto + ". ajtó") : "");
    var reszletek = [
      "Ügyfél: " + (f.nev_cegnev || ""),
      "Telefon: " + (f.telefon || ""),
      "E-mail: " + (f.email || ""),
      "Klíma: " + ([f.klima_marka, f.klima_tipus, f.klima_teljesitmeny].filter(Boolean).join(" · ") || "-") + " (" + f.klima_darab + " db)",
      "Ár: " + ft(f.ar) + " (fizetés a helyszínen)",
      f.belmagassag ? ("Belmagasság: " + f.belmagassag) : null,
      f.megjegyzes ? ("Megjegyzés: " + f.megjegyzes) : null
    ].filter(Boolean).join("\n");
    return "https://calendar.google.com/calendar/render?action=TEMPLATE"
      + "&text=" + encodeURIComponent("Klímatisztítás – " + (f.nev_cegnev || ""))
      + "&dates=" + gcalDatum(start) + "/" + gcalDatum(end)
      + "&location=" + encodeURIComponent(cim)
      + "&details=" + encodeURIComponent(reszletek);
  }

  /* ---------- Nézetváltás + auth ---------- */
  function mutatNezet(bejelentkezve, user) {
    loginView.hidden = bejelentkezve;
    appView.hidden = !bejelentkezve;
    if (bejelentkezve) {
      document.getElementById("admin-user").textContent = user ? user.email : "";
      valtTab("foglalasok");
    }
  }

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

  document.getElementById("admin-kilep").addEventListener("click", function () { db.auth.signOut(); });

  db.auth.onAuthStateChange(function (_event, session) {
    betoltve = { foglalasok: false, idopontok: false, sablon: false, opciok: false };
    mutatNezet(!!session, session ? session.user : null);
  });

  /* ---------- Tabok ---------- */
  function valtTab(nev) {
    document.querySelectorAll(".admin-tab").forEach(function (t) { t.classList.toggle("aktiv", t.getAttribute("data-tab") === nev); });
    document.querySelectorAll(".admin-panel").forEach(function (p) { p.classList.toggle("aktiv", p.id === "panel-" + nev); });
    if (!betoltve[nev]) { betoltve[nev] = true; betoltPanel(nev); }
  }
  document.querySelectorAll(".admin-tab").forEach(function (t) {
    t.addEventListener("click", function () { valtTab(t.getAttribute("data-tab")); });
  });
  function betoltPanel(nev) {
    if (nev === "foglalasok") betoltFoglalasok();
    else if (nev === "idopontok") betoltIdopontok();
    else if (nev === "sablon") betoltSablon();
    else if (nev === "opciok") betoltOpciok();
  }

  /* ---------- Foglalások ---------- */
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
            : esc([f.szamla_nev, f.szamla_irsz, f.szamla_telepules, f.szamla_cim].filter(Boolean).join(", "));
          return '<article class="admin-foglalas">'
            + '<div class="admin-foglalas-fej"><span class="admin-foglalas-idopont">' + idopont + '</span>'
            + '<span class="admin-foglalas-ar">' + ft(f.ar) + " · " + esc(f.klima_darab) + ' db</span></div>'
            + '<p class="admin-foglalas-nev">' + esc(f.nev_cegnev) + '</p>'
            + '<dl class="admin-foglalas-adatok">'
            + '<dt>Cím</dt><dd>' + esc([f.irsz, f.telepules, f.cim].filter(Boolean).join(" ")) + (f.emelet ? (", " + esc(f.emelet) + ". em.") : "") + (f.ajto ? (" " + esc(f.ajto) + ". ajtó") : "") + '</dd>'
            + '<dt>Belmagasság</dt><dd>' + esc(f.belmagassag || "-") + '</dd>'
            + '<dt>Telefon</dt><dd><a href="tel:' + esc(f.telefon) + '">' + esc(f.telefon) + '</a></dd>'
            + '<dt>E-mail</dt><dd><a href="mailto:' + esc(f.email) + '">' + esc(f.email) + '</a></dd>'
            + '<dt>Klíma</dt><dd>' + (esc([f.klima_marka, f.klima_tipus, f.klima_teljesitmeny].filter(Boolean).join(" · ")) || "-") + '</dd>'
            + '<dt>Számlázás</dt><dd>' + (szamla || "-") + (f.adoszam ? (" · adószám: " + esc(f.adoszam)) : "") + '</dd>'
            + (f.megjegyzes ? ('<dt>Megjegyzés</dt><dd>' + esc(f.megjegyzes) + '</dd>') : "")
            + '</dl>'
            + (gcalLink(f) ? '<div class="admin-foglalas-labarc"><a class="admin-naptar-gomb" href="' + gcalLink(f) + '" target="_blank" rel="noopener">📅 Hozzáadás a Google Naptárhoz</a></div>' : "")
            + '</article>';
        }).join("");
      });
  }

  /* ---------- Időpontok ---------- */
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
      var val = document.getElementById("egyedi-datum").value;
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
        if (!res.data.length) { el.innerHTML = '<p class="admin-ures">Nincs közelgő időpont. Kattintson a „6 hétre legyártás" gombra.</p>'; return; }
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
  document.getElementById("panel-idopontok").addEventListener("click", function (e) {
    var tg = e.target.closest("[data-toggle]");
    var tr = e.target.closest("[data-torol]");
    if (tg) {
      var ujStatusz = tg.getAttribute("data-statusz") === "letiltva" ? "szabad" : "letiltva";
      db.from("idopontok").update({ statusz: ujStatusz }).eq("id", tg.getAttribute("data-toggle")).then(listaIdopontok);
    } else if (tr) {
      if (!window.confirm("Biztosan törli ezt az időpontot?")) return;
      db.from("idopontok").delete().eq("id", tr.getAttribute("data-torol")).then(listaIdopontok);
    }
  });

  /* ---------- Heti sablon ---------- */
  var NAPOK = ["", "Hétfő", "Kedd", "Szerda", "Csütörtök", "Péntek", "Szombat", "Vasárnap"];
  function betoltSablon() {
    var panel = document.getElementById("panel-sablon");
    panel.innerHTML =
      '<p class="admin-info">A heti sablon a „6 hétre legyártás" alapja. A módosítás a következő generáláskor lép életbe (a már létező időpontokat nem változtatja).</p>'
      + '<form class="admin-egyedi" id="sablon-form">'
      + '<select id="sablon-nap">' + [1, 2, 3, 4, 5, 6, 7].map(function (n) { return '<option value="' + n + '">' + NAPOK[n] + "</option>"; }).join("") + "</select> "
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

  /* ---------- Legördülők ---------- */
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
      if (!window.confirm("Biztosan törli ezt az értéket?")) return;
      db.from("klima_opciok").delete().eq("id", t.getAttribute("data-opcio-torol")).then(listaOpciok);
    }
  });
})();
