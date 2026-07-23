/* =========================================================
   BG Klímatechnika — online időpontfoglalás
   ========================================================= */
(function () {
  "use strict";

  var SUPABASE_URL = "https://psmdpfxionlpiaxawupf.supabase.co";
  var SUPABASE_KEY = "sb_publishable_bJw2kXa0k-hKFqHLOMeNFw_e7i_QYmZ";
  var db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

  var slotokEl = document.getElementById("foglalo-slotok");
  var slotokWrap = document.getElementById("foglalo-slotok-wrap");
  var urlap = document.getElementById("foglalo-urlap");
  var kivalasztottEl = document.getElementById("foglalo-kivalasztott");
  var sikerEl = document.getElementById("foglalo-siker");
  var arEl = document.getElementById("foglalo-ar");
  var statusEl = document.getElementById("foglalo-status");
  if (!slotokEl || !db) return;

  var selectedSlotId = null;
  var selectedLabel = "";
  var hetek = [];        // [{ cimke, napok: [{ fejlec, savok:[{id,ido,label}] }] }]
  var aktualisHet = 0;

  var HU_NAP = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  var HU_HO = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function napFejlec(d) { return d.getFullYear() + ". " + HU_HO[d.getMonth()] + " " + d.getDate() + ". (" + HU_NAP[d.getDay()] + ")"; }
  function ido(d) { return p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  function ftFormat(n) { return n.toLocaleString("hu-HU") + " Ft"; }
  function napKulcs(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }

  // Az adott dátumhoz tartozó hétfő (helyi idő, 00:00)
  function hetKezdet(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = (x.getDay() + 6) % 7; // hétfő = 0
    x.setDate(x.getDate() - dow);
    return x;
  }
  // Hét felirata, pl. „2026. júl. 20. – 26." vagy hónapváltásnál „... – aug. 2."
  function hetCimke(monday) {
    var sun = new Date(monday); sun.setDate(sun.getDate() + 6);
    var eleje = monday.getFullYear() + ". " + HU_HO[monday.getMonth()] + " " + monday.getDate() + ".";
    var vege = (sun.getMonth() === monday.getMonth() ? "" : HU_HO[sun.getMonth()] + " ") + sun.getDate() + ".";
    return eleje + " – " + vege;
  }

  /* ---------- Sávok csoportosítása hetekre ---------- */
  function buildHetek(rows) {
    var map = {}, order = [];
    rows.forEach(function (r) {
      var d = new Date(r.kezdes);
      var wk = napKulcs(hetKezdet(d));
      if (!map[wk]) { map[wk] = { monday: hetKezdet(d), napokMap: {}, napokOrder: [] }; order.push(wk); }
      var dk = napKulcs(d);
      if (!map[wk].napokMap[dk]) { map[wk].napokMap[dk] = { fejlec: napFejlec(d), savok: [] }; map[wk].napokOrder.push(dk); }
      map[wk].napokMap[dk].savok.push({ id: r.id, ido: ido(d), label: napFejlec(d) + " " + ido(d) });
    });
    hetek = order.map(function (wk) {
      var h = map[wk];
      return { cimke: hetCimke(h.monday), napok: h.napokOrder.map(function (dk) { return h.napokMap[dk]; }) };
    });
    if (aktualisHet > hetek.length - 1) aktualisHet = 0;
  }

  /* ---------- Az aktuális hét renderelése ---------- */
  function renderHet() {
    if (!hetek.length) {
      slotokEl.innerHTML = '<p class="foglalo-ures">Jelenleg nincs szabad időpont. Kérjük, hívjon a +36 30 966 7618 számon.</p>';
      return;
    }
    var h = hetek[aktualisHet];
    var nav = '<div class="foglalo-het-nav">'
      + '<button type="button" class="foglalo-het-lap foglalo-het-prev"' + (aktualisHet === 0 ? " disabled" : "") + ' aria-label="Előző hét">‹</button>'
      + '<span class="foglalo-het-cimke">' + h.cimke + '</span>'
      + '<button type="button" class="foglalo-het-lap foglalo-het-next"' + (aktualisHet === hetek.length - 1 ? " disabled" : "") + ' aria-label="Következő hét">›</button>'
      + "</div>";
    var napok = "";
    h.napok.forEach(function (nap) {
      napok += '<div class="foglalo-nap"><p class="foglalo-nap-fejlec">' + nap.fejlec + '</p><div class="foglalo-nap-savok">';
      nap.savok.forEach(function (s) {
        napok += '<button type="button" class="foglalo-slot" data-id="' + s.id + '" data-label="' + s.label + '">' + s.ido + "</button>";
      });
      napok += "</div></div>";
    });
    slotokEl.innerHTML = nav + '<div class="foglalo-het-napok">' + napok + "</div>";
  }

  function loadSlots() {
    slotokEl.textContent = "Időpontok betöltése…";
    db.from("idopontok").select("id,kezdes").eq("statusz", "szabad").order("kezdes")
      .then(function (res) {
        if (res.error) {
          slotokEl.innerHTML = '<p class="foglalo-ures">Az időpontok betöltése nem sikerült. Kérjük, frissítse az oldalt.</p>';
          return;
        }
        buildHetek(res.data || []);
        renderHet();
      });
  }

  /* ---------- Kattintás: lapozás vagy sáv-választás ---------- */
  slotokEl.addEventListener("click", function (e) {
    if (e.target.closest(".foglalo-het-prev")) { if (aktualisHet > 0) { aktualisHet--; renderHet(); } return; }
    if (e.target.closest(".foglalo-het-next")) { if (aktualisHet < hetek.length - 1) { aktualisHet++; renderHet(); } return; }
    var btn = e.target.closest(".foglalo-slot");
    if (!btn) return;
    selectedSlotId = btn.getAttribute("data-id");
    selectedLabel = btn.getAttribute("data-label");
    // Kiválasztás után az időpontlista eltűnik, csak a választott időpont látszik az űrlap felett.
    slotokWrap.hidden = true;
    kivalasztottEl.innerHTML = 'Választott időpont: <strong>' + selectedLabel + '</strong>'
      + ' <button type="button" class="foglalo-modosit" id="foglalo-modosit">Módosítás</button>';
    urlap.hidden = false;
    urlap.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- „Módosítás": vissza az időpontválasztáshoz ---------- */
  kivalasztottEl.addEventListener("click", function (e) {
    if (!e.target.closest("#foglalo-modosit")) return;
    urlap.hidden = true;
    slotokWrap.hidden = false;
    slotokWrap.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------- Legördülők feltöltése ---------- */
  function loadOpciok() {
    db.from("klima_opciok").select("kategoria,ertek").eq("aktiv", true).order("sorrend")
      .then(function (res) {
        if (res.error || !res.data) return;
        var perKat = { marka: [], tipus: [], teljesitmeny: [] };
        res.data.forEach(function (o) { if (perKat[o.kategoria]) perKat[o.kategoria].push(o.ertek); });
        document.querySelectorAll("select[data-opcio]").forEach(function (sel) {
          var kat = sel.getAttribute("data-opcio");
          var opts = '<option value="">— válasszon —</option>';
          (perKat[kat] || []).forEach(function (v) { opts += "<option>" + v + "</option>"; });
          sel.innerHTML = opts;
        });
      });
  }

  /* ---------- Számlázási mezők + élő ár ---------- */
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

  /* ---------- Beküldés ---------- */
  urlap.addEventListener("submit", function (e) {
    e.preventDefault();
    statusEl.className = "form-status";
    statusEl.textContent = "";
    if (!selectedSlotId) {
      statusEl.textContent = "Kérjük, válasszon időpontot.";
      statusEl.classList.add("err");
      return;
    }
    var f = urlap;
    if (!f.nev_cegnev.value.trim() || !f.telefon.value.trim() || !f.email.value.trim()
        || !f.irsz.value.trim() || !f.telepules.value.trim() || !f.cim.value.trim()) {
      statusEl.textContent = "Kérjük, töltse ki a csillaggal jelölt mezőket.";
      statusEl.classList.add("err");
      return;
    }
    var kuldBtn = document.getElementById("foglalo-kuld");
    kuldBtn.disabled = true;
    var eredetiSzoveg = kuldBtn.textContent;
    kuldBtn.textContent = "Foglalás…";

    var params = {
      p_idopont_id: selectedSlotId,
      p_nev_cegnev: f.nev_cegnev.value.trim(),
      p_irsz: f.irsz.value.trim(),
      p_telepules: f.telepules.value.trim(),
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
      kuldBtn.disabled = false;
      kuldBtn.textContent = eredetiSzoveg;
      if (res.error) {
        statusEl.textContent = "A választott időpontot időközben lefoglalták, vagy hiba történt. Kérjük, válasszon másik időpontot.";
        statusEl.classList.add("err");
        selectedSlotId = null;
        urlap.hidden = true;
        slotokWrap.hidden = false;
        loadSlots();
        slotokWrap.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      var ar = window.arSzamol(params.p_klima_darab);
      document.getElementById("foglalo-siker-reszlet").textContent =
        selectedLabel + " — " + ftFormat(ar) + " (fizetés a helyszínen).";
      urlap.hidden = true;
      slotokWrap.hidden = true;
      sikerEl.hidden = false;
      sikerEl.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  loadSlots();
  loadOpciok();
})();
