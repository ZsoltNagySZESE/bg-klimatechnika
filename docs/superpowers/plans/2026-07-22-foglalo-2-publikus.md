# Foglaló rendszer – 2. fázis: Publikus foglalás – Implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A főoldalon egy működő foglaló szekció: a látogató kiválaszt egy szabad 1,5 órás sávot a következő 6 hétből, kitölti az adatait, élőben látja az árat, és lefoglalja (a `foglalas_letrehozasa` RPC-n át).

**Architecture:** Statikus HTML/CSS/JS. A böngésző a `@supabase/supabase-js` publikus kulccsal olvassa a szabad `idopontok`-at és az aktív `klima_opciok`-at (RLS engedi), és a `foglalas_letrehozasa` RPC-vel foglal. Új `foglalas.js` fájl viszi a foglalás logikáját; a régi ajánlatkérő űrlap és annak JS-e törlődik.

**Tech Stack:** vanilla JS, supabase-js v2 (CDN, már betöltve az `index.html`-ben), Node beépített teszt-futtató (`node --test`) a tiszta logikához.

## Global Constraints

- Supabase URL: `https://psmdpfxionlpiaxawupf.supabase.co`, publikus kulcs: `sb_publishable_bJw2kXa0k-hKFqHLOMeNFw_e7i_QYmZ`.
- Árazás (kliens oldali kijelzéshez): `ar = 20000 + (darab-1)*15000`; a **valódi árat a szerver (RPC) számolja**.
- Idő megjelenítés a látogató helyi idejében (HU ügyfelek → Europe/Budapest).
- RPC neve: `foglalas_letrehozasa`, paraméterek a `p_` előtaggal (lásd 1. fázis).
- A foglalás a **főoldalon belüli `#foglalas` szekció** (a mostani ajánlatkérő űrlap helyett).
- Nyelv: magyar; a meglévő dizájnrendszer (teal `#54a8aa`, Space Grotesk + Figtree, `.btn`, `.section` osztályok) követése.

---

### Task 1: Ár-számoló segédfüggvény (tiszta logika, teszttel)

**Files:**
- Create: `js/ar.js`
- Test: `js/ar.test.js`

**Interfaces:**
- Produces: `arSzamol(darab) -> number` (globális `window.arSzamol` böngészőben; `module.exports` Node-ban).

- [ ] **Step 1: Bukó teszt**

`js/ar.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { arSzamol } = require('./ar.js');

test('1 klíma = 20000', () => assert.strictEqual(arSzamol(1), 20000));
test('3 klíma = 50000', () => assert.strictEqual(arSzamol(3), 50000));
test('0 vagy érvénytelen → minimum 1 klíma ára', () => assert.strictEqual(arSzamol(0), 20000));
test('szöveg bemenet → 20000', () => assert.strictEqual(arSzamol('x'), 20000));
```

- [ ] **Step 2: Futtatás – FAIL**

Run: `node --test js/ar.test.js`
Expected: FAIL (nincs `ar.js`).

- [ ] **Step 3: Implementáció**

`js/ar.js`:
```js
function arSzamol(darab) {
  var n = parseInt(darab, 10);
  if (isNaN(n) || n < 1) n = 1;
  if (n > 50) n = 50;
  return 20000 + (n - 1) * 15000;
}
if (typeof module !== 'undefined' && module.exports) module.exports = { arSzamol };
if (typeof window !== 'undefined') window.arSzamol = arSzamol;
```

- [ ] **Step 4: Futtatás – PASS**

Run: `node --test js/ar.test.js`
Expected: PASS (4 teszt).

- [ ] **Step 5: Commit**

```bash
git add js/ar.js js/ar.test.js && git commit -m "feat(foglalo): ár-számoló segédfüggvény teszttel"
```

---

### Task 2: `#foglalas` szekció markup + a régi űrlap eltávolítása + linkek

**Files:**
- Modify: `index.html`

**Interfaces:**
- Produces: `#foglalas` szekció a következő tároló-ID-kkal, amikre a `foglalas.js` épít:
  - `#foglalo-status` (üzenetsáv), `#foglalo-slotok` (sávlista), `#foglalo-urlap` (a form, kezdetben rejtett), `#foglalo-kivalasztott` (a kiválasztott időpont összefoglalója), `#foglalo-siker` (siker-nézet, rejtett).
  - Űrlap mezők `name`-jei: `nev_cegnev, irsz, cim, emelet, ajto, belmagassag, telefon, email, szamla_megegyezik, szamla_nev, szamla_irsz, szamla_cim, adoszam, klima_marka, klima_tipus, klima_teljesitmeny, klima_darab, megjegyzes`.
  - Legördülők: `<select name="klima_marka" data-opcio="marka">` stb. (üresen, JS tölti fel).
  - Ár kijelző: `#foglalo-ar`.

- [ ] **Step 1: A régi ajánlatkérő űrlap törlése**
Töröld az `index.html`-ből a teljes `#kapcsolat` szekción belüli `<form id="ajanlatForm">…</form>` blokkot (a honeypot mezővel együtt). A `.contact-info` (telefon/Messenger/e-mail) blokk **marad**. A `#kapcsolat` így csak az elérhetőségeket tartalmazza, és a végére egy gomb kerül: „Foglalj időpontot online" → `href="#foglalas"`.

- [ ] **Step 2: Új `#foglalas` szekció beszúrása**
Szúrd be a `#referenciak` után, a `#kapcsolat` elé:
```html
<section class="section section-alt" id="foglalas" aria-labelledby="foglalas-cim">
  <div class="container">
    <header class="section-head">
      <p class="eyebrow">Időpontfoglalás</p>
      <h2 id="foglalas-cim">Foglalj időpontot online</h2>
      <p class="section-sub">Válassz egy szabad időpontot a következő 6 hétből, és pár kattintással lefoglalhatod.</p>
    </header>

    <div class="foglalo" id="foglalo">
      <!-- 1. lépés: sávok -->
      <div class="foglalo-lepes" id="foglalo-slotok-wrap">
        <h3 class="foglalo-cim"><span class="foglalo-num">1</span> Válassz időpontot</h3>
        <div id="foglalo-slotok" class="foglalo-slotok" aria-live="polite">Időpontok betöltése…</div>
      </div>

      <!-- 2. lépés: űrlap (rejtett, amíg nincs kiválasztott sáv) -->
      <form class="foglalo-urlap" id="foglalo-urlap" hidden novalidate>
        <h3 class="foglalo-cim"><span class="foglalo-num">2</span> Add meg az adataidat</h3>
        <p class="foglalo-kivalasztott" id="foglalo-kivalasztott"></p>

        <div class="field"><label for="f-nev">Név / cégnév *</label>
          <input id="f-nev" name="nev_cegnev" required maxlength="200" autocomplete="name" /></div>

        <fieldset class="foglalo-cim-mezok">
          <legend>Cím (ahol a klíma van)</legend>
          <div class="field-row">
            <div class="field"><label for="f-irsz">Irányítószám *</label>
              <input id="f-irsz" name="irsz" required maxlength="20" inputmode="numeric" /></div>
            <div class="field"><label for="f-cim">Utca, házszám *</label>
              <input id="f-cim" name="cim" required maxlength="200" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label for="f-emelet">Emelet</label>
              <input id="f-emelet" name="emelet" maxlength="50" /></div>
            <div class="field"><label for="f-ajto">Ajtó</label>
              <input id="f-ajto" name="ajto" maxlength="50" /></div>
          </div>
        </fieldset>

        <div class="field"><label for="f-belmagassag">Belmagasság / a klíma elhelyezése</label>
          <input id="f-belmagassag" name="belmagassag" maxlength="200" placeholder="pl. kb. 2,7 m, vagy galérián magasan" /></div>

        <div class="field-row">
          <div class="field"><label for="f-telefon">Telefonszám *</label>
            <input id="f-telefon" name="telefon" required maxlength="50" inputmode="tel" autocomplete="tel" /></div>
          <div class="field"><label for="f-email">E-mail *</label>
            <input id="f-email" name="email" type="email" required maxlength="200" autocomplete="email" /></div>
        </div>

        <div class="field-row">
          <div class="field"><label for="f-marka">Klíma márkája</label>
            <select id="f-marka" name="klima_marka" data-opcio="marka"></select></div>
          <div class="field"><label for="f-tipus">Klíma típusa</label>
            <select id="f-tipus" name="klima_tipus" data-opcio="tipus"></select></div>
        </div>
        <div class="field-row">
          <div class="field"><label for="f-teljesitmeny">Klíma teljesítménye</label>
            <select id="f-teljesitmeny" name="klima_teljesitmeny" data-opcio="teljesitmeny"></select></div>
          <div class="field"><label for="f-darab">Hány klímát tisztítsunk? *</label>
            <input id="f-darab" name="klima_darab" type="number" min="1" max="50" value="1" required /></div>
        </div>

        <label class="foglalo-check"><input type="checkbox" id="f-szamla-megegyezik" name="szamla_megegyezik" checked />
          A számlázási adatok megegyeznek a fenti címmel</label>
        <div class="foglalo-szamla" id="foglalo-szamla" hidden>
          <div class="field"><label for="f-szamla-nev">Számlázási név</label>
            <input id="f-szamla-nev" name="szamla_nev" maxlength="200" /></div>
          <div class="field-row">
            <div class="field"><label for="f-szamla-irsz">Irányítószám</label>
              <input id="f-szamla-irsz" name="szamla_irsz" maxlength="20" /></div>
            <div class="field"><label for="f-szamla-cim">Cím</label>
              <input id="f-szamla-cim" name="szamla_cim" maxlength="200" /></div>
          </div>
        </div>
        <div class="field"><label for="f-adoszam">Adószám (cég esetén)</label>
          <input id="f-adoszam" name="adoszam" maxlength="30" /></div>

        <div class="field"><label for="f-megjegyzes">Megjegyzés</label>
          <textarea id="f-megjegyzes" name="megjegyzes" rows="3" maxlength="2000"></textarea></div>

        <div class="foglalo-osszeg">
          <span>Fizetendő a helyszínen:</span>
          <strong id="foglalo-ar">20 000 Ft</strong>
        </div>

        <button type="submit" class="btn btn-primary btn-block btn-lg" id="foglalo-kuld">Foglalás megerősítése</button>
        <p class="form-status" id="foglalo-status" role="status" aria-live="polite"></p>
        <p class="form-note">Az adataidat csak a szolgáltatás teljesítéséhez használjuk. Fizetés a helyszínen.</p>
      </form>

      <!-- Siker nézet -->
      <div class="foglalo-siker" id="foglalo-siker" hidden>
        <div class="foglalo-siker-ikon" aria-hidden="true">✓</div>
        <h3>Köszönjük, foglalásod rögzítettük!</h3>
        <p id="foglalo-siker-reszlet"></p>
        <p>Hamarosan felvesszük veled a kapcsolatot. Kérdés esetén hívj: <a href="tel:+36309667618">+36 30 966 7618</a>.</p>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Linkek átirányítása a foglaláshoz**
Cseréld a `#kapcsolat`-ra mutató foglalási CTA-kat `#foglalas`-ra:
- fejléc „Időpontkérés" gomb, hero „Időpontot kérek", Rólam „Beszéljünk a klímájáról", árak „Időpontot kérek”, a nav „Kapcsolat" **marad** `#kapcsolat`, de a nav-ba kerüljön új pont: `<li><a href="#foglalas">Foglalás</a></li>`.

- [ ] **Step 4: `foglalas.js` betöltése**
Az `index.html` végén, a `supabase-js` után, a `script.js` elé:
```html
<script src="js/ar.js"></script>
<script src="js/foglalas.js"></script>
```

- [ ] **Step 5: Ellenőrzés**
`node -e "const s=require('fs').readFileSync('index.html','utf8'); for (const id of ['foglalo-slotok','foglalo-urlap','foglalo-ar','foglalo-siker']) if(!s.includes(id)) throw new Error('hiányzik: '+id); if(s.includes('ajanlatForm')) throw new Error('régi űrlap még bent van'); console.log('OK');"`
Expected: `OK`.

- [ ] **Step 6: Commit**
```bash
git add index.html && git commit -m "feat(foglalo): #foglalas szekció markup, régi űrlap eltávolítva"
```

---

### Task 3: Foglaló stílusok

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: a Task 2 osztályai (`.foglalo`, `.foglalo-slotok`, `.foglalo-nap`, `.foglalo-slot`, `.foglalo-slot.kivalasztott`, `.foglalo-urlap`, `.foglalo-osszeg`, `.foglalo-siker`, `.foglalo-num`, `.foglalo-check`, `.foglalo-szamla`).

- [ ] **Step 1: Stílusok hozzáadása** a `styles.css` végéhez (a reszponzív blokk elé). A meglévő változókat (`--surface`, `--mint`, `--radius`, `--shadow-soft`, `.field`, `.field-row`) használva:
  - `.foglalo` fehér kártya (`--surface`, `--radius`, `--shadow-soft`, padding).
  - `.foglalo-slotok` → napokra bontott lista; minden nap `.foglalo-nap` (dátum-fejléc + chip-sor).
  - `.foglalo-slot` = pill gomb (`--line` keret); `:hover` teal keret; `.kivalasztott` = teal háttér, petrol szöveg.
  - `.foglalo-num` = kis teal kör sorszámmal.
  - `.foglalo-osszeg` = kiemelt ársor (teal háttérrel halványan).
  - `.foglalo-siker` = középre zárt siker-nézet, nagy pipa.
  - Reszponzív: mobilon a `.field-row` egy oszlop (a meglévő szabály már kezeli).

- [ ] **Step 2: Ellenőrzés (böngésző)**
`preview_start` (klima-preview) → a `#foglalas` szekció rendben jelenik meg (fehér kártya, „Időpontok betöltése…" felirat). Screenshot.

- [ ] **Step 3: Commit**
```bash
git add styles.css && git commit -m "feat(foglalo): foglaló szekció stílusok"
```

---

### Task 4: `foglalas.js` – sávok és legördülők betöltése, kiválasztás

**Files:**
- Create: `js/foglalas.js`

**Interfaces:**
- Consumes: `window.supabase`, `window.arSzamol`, a Task 2 DOM-ID-k.
- Produces: a `#foglalo-slotok` feltöltése napokra bontva; sáv kattintásra a `#foglalo-urlap` megjelenik és `selectedSlotId` beáll; a legördülők feltöltve.

- [ ] **Step 1: Váz + kliens + segédfüggvények**
```js
(function () {
  "use strict";
  var SUPABASE_URL = "https://psmdpfxionlpiaxawupf.supabase.co";
  var SUPABASE_KEY = "sb_publishable_bJw2kXa0k-hKFqHLOMeNFw_e7i_QYmZ";
  var db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  var slotokEl = document.getElementById("foglalo-slotok");
  var urlap = document.getElementById("foglalo-urlap");
  var kivalasztottEl = document.getElementById("foglalo-kivalasztott");
  var sikerEl = document.getElementById("foglalo-siker");
  var arEl = document.getElementById("foglalo-ar");
  var statusEl = document.getElementById("foglalo-status");
  if (!slotokEl || !db) return;

  var selectedSlotId = null;
  var selectedLabel = "";

  var HU_NAP = ["vasárnap","hétfő","kedd","szerda","csütörtök","péntek","szombat"];
  var HU_HO = ["jan.","febr.","márc.","ápr.","máj.","jún.","júl.","aug.","szept.","okt.","nov.","dec."];
  function p2(n){ return (n < 10 ? "0" : "") + n; }
  function napFejlec(d){ return d.getFullYear()+". "+HU_HO[d.getMonth()]+" "+d.getDate()+". ("+HU_NAP[d.getDay()]+")"; }
  function ido(d){ return p2(d.getHours())+":"+p2(d.getMinutes()); }
  function ftFormat(n){ return n.toLocaleString("hu-HU")+" Ft"; }
  function napKulcs(d){ return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); }
```

- [ ] **Step 2: Sávok betöltése és renderelése**
```js
  function renderSlots(rows) {
    if (!rows || rows.length === 0) {
      slotokEl.innerHTML = '<p class="foglalo-ures">Jelenleg nincs szabad időpont. Kérlek, hívj a +36 30 966 7618 számon.</p>';
      return;
    }
    var napok = {};
    rows.forEach(function (r) {
      var d = new Date(r.kezdes);
      var k = napKulcs(d);
      if (!napok[k]) napok[k] = { fejlec: napFejlec(d), savok: [] };
      napok[k].savok.push({ id: r.id, ido: ido(d), label: napFejlec(d) + " " + ido(d) });
    });
    var html = "";
    Object.keys(napok).forEach(function (k) {
      html += '<div class="foglalo-nap"><p class="foglalo-nap-fejlec">' + napok[k].fejlec + '</p><div class="foglalo-nap-savok">';
      napok[k].savok.forEach(function (s) {
        html += '<button type="button" class="foglalo-slot" data-id="' + s.id + '" data-label="' + s.label + '">' + s.ido + '</button>';
      });
      html += '</div></div>';
    });
    slotokEl.innerHTML = html;
  }

  function loadSlots() {
    slotokEl.textContent = "Időpontok betöltése…";
    db.from("idopontok").select("id,kezdes").eq("statusz", "szabad").order("kezdes")
      .then(function (res) {
        if (res.error) { slotokEl.innerHTML = '<p class="foglalo-ures">Az időpontok betöltése nem sikerült. Kérlek, frissítsd az oldalt.</p>'; return; }
        renderSlots(res.data);
      });
  }
```
Megjegyzés: az RLS miatt eleve csak `szabad`+jövőbeli sáv jön; az `.eq("statusz","szabad")` csak biztonsági kettőzés.

- [ ] **Step 3: Sáv kiválasztása (esemény-delegálás)**
```js
  slotokEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".foglalo-slot");
    if (!btn) return;
    selectedSlotId = btn.getAttribute("data-id");
    selectedLabel = btn.getAttribute("data-label");
    Array.prototype.forEach.call(slotokEl.querySelectorAll(".foglalo-slot"), function (b) { b.classList.remove("kivalasztott"); });
    btn.classList.add("kivalasztott");
    kivalasztottEl.textContent = "Választott időpont: " + selectedLabel;
    urlap.hidden = false;
    urlap.scrollIntoView({ behavior: "smooth", block: "start" });
  });
```

- [ ] **Step 4: Legördülők feltöltése**
```js
  function loadOpciok() {
    db.from("klima_opciok").select("kategoria,ertek").eq("aktiv", true).order("sorrend")
      .then(function (res) {
        if (res.error || !res.data) return;
        var perKat = { marka: [], tipus: [], teljesitmeny: [] };
        res.data.forEach(function (o) { if (perKat[o.kategoria]) perKat[o.kategoria].push(o.ertek); });
        document.querySelectorAll("select[data-opcio]").forEach(function (sel) {
          var kat = sel.getAttribute("data-opcio");
          var opts = '<option value="">— válassz —</option>';
          (perKat[kat] || []).forEach(function (v) { opts += '<option>' + v + '</option>'; });
          sel.innerHTML = opts;
        });
      });
  }

  loadSlots();
  loadOpciok();
})();
```

- [ ] **Step 5: Ellenőrzés (böngésző)**
`preview_start` → a `#foglalas` szekcióban megjelennek a napok és időpont-chipek; egy chipre kattintva megjelenik a 2. lépés (űrlap) a kiválasztott időponttal; a legördülők tele vannak (Daikin stb.). Screenshot + `read_page`.

- [ ] **Step 6: Commit**
```bash
git add js/foglalas.js && git commit -m "feat(foglalo): sávok és legördülők betöltése, időpont-választás"
```

---

### Task 5: Számlázási másolás + élő ár

**Files:**
- Modify: `js/foglalas.js` (a `loadSlots(); loadOpciok();` sorok elé)

**Interfaces:**
- Consumes: `#f-szamla-megegyezik`, `#foglalo-szamla`, `#f-darab`, `#foglalo-ar`, `window.arSzamol`.
- Produces: a számlázási mezők ki/be jelennek a pipától; az ár él frissül a darabszámra.

- [ ] **Step 1: Logika**
```js
  var szamlaCheck = document.getElementById("f-szamla-megegyezik");
  var szamlaBlokk = document.getElementById("foglalo-szamla");
  if (szamlaCheck && szamlaBlokk) {
    var szamlaToggle = function () { szamlaBlokk.hidden = szamlaCheck.checked; };
    szamlaCheck.addEventListener("change", szamlaToggle);
    szamlaToggle();
  }

  var darabInput = document.getElementById("f-darab");
  if (darabInput && arEl) {
    var arFrissit = function () { arEl.textContent = ftFormat(window.arSzamol(darabInput.value)); };
    darabInput.addEventListener("input", arFrissit);
    arFrissit();
  }
```

- [ ] **Step 2: Ellenőrzés (böngésző)**
A pipa kivétele → megjelennek a számlázási mezők; a darabszám 3-ra állítása → az ár „50 000 Ft".

- [ ] **Step 3: Commit**
```bash
git add js/foglalas.js && git commit -m "feat(foglalo): számlázási mezők másolása és élő ár"
```

---

### Task 6: Beküldés (RPC), siker- és hibakezelés

**Files:**
- Modify: `js/foglalas.js`

**Interfaces:**
- Consumes: `foglalas_letrehozasa` RPC, `#foglalo-urlap`, `#foglalo-siker`, `#foglalo-status`, `selectedSlotId`.
- Produces: sikeres foglalás → siker-nézet + a sávlista frissül; hiba (elfoglalt sáv) → üzenet + sávok újratöltése.

- [ ] **Step 1: Beküldés-kezelő**
```js
  urlap.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "form-status";
    statusEl.textContent = "";
    if (!selectedSlotId) { statusEl.textContent = "Kérlek, válassz időpontot."; statusEl.classList.add("err"); return; }
    var f = urlap;
    if (!f.nev_cegnev.value.trim() || !f.telefon.value.trim() || !f.email.value.trim()
        || !f.irsz.value.trim() || !f.cim.value.trim()) {
      statusEl.textContent = "Kérlek, töltsd ki a csillaggal jelölt mezőket."; statusEl.classList.add("err"); return;
    }
    var kuldBtn = document.getElementById("foglalo-kuld");
    kuldBtn.disabled = true; var eredetiSzoveg = kuldBtn.textContent; kuldBtn.textContent = "Foglalás…";

    var params = {
      p_idopont_id: selectedSlotId,
      p_nev_cegnev: f.nev_cegnev.value.trim(),
      p_irsz: f.irsz.value.trim(),
      p_cim: f.cim.value.trim(),
      p_emelet: f.emelet.value.trim(),
      p_ajto: f.ajto.value.trim(),
      p_belmagassag: f.belmagassag.value.trim(),
      p_telefon: f.telefon.value.trim(),
      p_email: f.email.value.trim(),
      p_szamla_megegyezik: f.szamla_megegyezik.checked,
      p_szamla_nev: f.szamla_nev.value.trim(),
      p_szamla_irsz: f.szamla_irsz.value.trim(),
      p_szamla_cim: f.szamla_cim.value.trim(),
      p_adoszam: f.adoszam.value.trim(),
      p_klima_marka: f.klima_marka.value,
      p_klima_tipus: f.klima_tipus.value,
      p_klima_teljesitmeny: f.klima_teljesitmeny.value,
      p_klima_darab: parseInt(f.klima_darab.value, 10) || 1,
      p_megjegyzes: f.megjegyzes.value.trim()
    };

    db.rpc("foglalas_letrehozasa", params).then(function (res) {
      kuldBtn.disabled = false; kuldBtn.textContent = eredetiSzoveg;
      if (res.error) {
        statusEl.textContent = "A választott időpontot időközben lefoglalták, vagy hiba történt. Kérlek, válassz másik időpontot.";
        statusEl.classList.add("err");
        selectedSlotId = null;
        loadSlots();
        return;
      }
      var ar = window.arSzamol(params.p_klima_darab);
      document.getElementById("foglalo-siker-reszlet").textContent =
        selectedLabel + " — " + ftFormat(ar) + " (fizetés a helyszínen).";
      urlap.hidden = true;
      document.getElementById("foglalo-slotok-wrap").hidden = true;
      sikerEl.hidden = false;
      sikerEl.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
```

- [ ] **Step 2: Ellenőrzés (böngésző, valódi foglalás)**
`preview_start` → tölts ki egy foglalást (teszt e-mail: `teszt2@pelda.hu`, 2 klíma) → siker-nézet „…— 35 000 Ft…". Majd `execute_sql`: `select nev_cegnev, ar, klima_darab from public.foglalasok where email='teszt2@pelda.hu';` → 1 sor, `ar=35000`.

- [ ] **Step 3: Ellenőrzés – a sáv eltűnt a listából**
Frissítsd a `#foglalas`-t → a lefoglalt sáv **már nem** jelenik meg a szabad időpontok között.

- [ ] **Step 4: Tesztadat törlése**
`execute_sql`:
```sql
with t as (delete from public.foglalasok where email='teszt2@pelda.hu' returning idopont_id)
update public.idopontok set statusz='szabad' where id in (select idopont_id from t);
```

- [ ] **Step 5: Commit**
```bash
git add js/foglalas.js && git commit -m "feat(foglalo): foglalás beküldése RPC-vel, siker- és hibakezelés"
```

---

### Task 7: A régi űrlap JS eltávolítása + éles ellenőrzés

**Files:**
- Modify: `script.js`

- [ ] **Step 1:** Töröld a `script.js`-ből a régi „Ajánlatkérő űrlap (Supabase)" blokkot és a hozzá tartozó `SUPABASE_URL/KEY/db` konstansokat (ezt már a `foglalas.js` kezeli). A nav-menü, GYIK, előtte/utána csúszka, év logikája **marad**.

- [ ] **Step 2: Ellenőrzés**
`preview_start` → nincs JS-hiba a konzolon (`read_console_messages`), a foglaló és a többi funkció (menü, GYIK, csúszka) is működik.

- [ ] **Step 3: Commit + deploy**
```bash
git add script.js && git commit -m "refactor(foglalo): régi ajánlatkérő JS eltávolítása"
git push origin main
```

- [ ] **Step 4: Éles ellenőrzés**
A Vercel deploy után a `https://bg-klimatechnika.vercel.app` → `#foglalas` betölti a szabad időpontokat. (Éles teszt-foglalást ne hagyj bent — ha csinálsz, töröld a fenti SQL-lel.)

---

## Fázis-lezárás / ellenőrzőlista

- [ ] `node --test js/ar.test.js` → PASS.
- [ ] A `#foglalas` szekció betölti a napokat és sávokat; kiválasztás → űrlap.
- [ ] Élő ár helyes (1→20e, 2→35e, 3→50e).
- [ ] Valódi foglalás → DB sor jó árral; a sáv eltűnik; dupla-foglalás ellen a szerver véd.
- [ ] Nincs konzolhiba; a régi ajánlatkérő űrlap eltűnt.
- [ ] `select count(*) from public.foglalasok;` → 0 (nincs maradék teszt).

## Következő fázisok

- **3. fázis – Admin:** `admin.html` + Supabase Auth; sablon/időpontok/foglalások/legördülők kezelése.
- **4. fázis – Értesítések:** Edge Function + Database Webhook + Resend + .ics.
