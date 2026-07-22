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

  var HU_NAP = ["vasárnap", "hétfő", "kedd", "szerda", "csütörtök", "péntek", "szombat"];
  var HU_HO = ["jan.", "febr.", "márc.", "ápr.", "máj.", "jún.", "júl.", "aug.", "szept.", "okt.", "nov.", "dec."];
  function p2(n) { return (n < 10 ? "0" : "") + n; }
  function napFejlec(d) { return d.getFullYear() + ". " + HU_HO[d.getMonth()] + " " + d.getDate() + ". (" + HU_NAP[d.getDay()] + ")"; }
  function ido(d) { return p2(d.getHours()) + ":" + p2(d.getMinutes()); }
  function ftFormat(n) { return n.toLocaleString("hu-HU") + " Ft"; }
  function napKulcs(d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); }

  /* ---------- Sávok betöltése és renderelése ---------- */
  function renderSlots(rows) {
    if (!rows || rows.length === 0) {
      slotokEl.innerHTML = '<p class="foglalo-ures">Jelenleg nincs szabad időpont. Kérjük, hívjon a +36 30 966 7618 számon.</p>';
      return;
    }
    var napok = {};
    var sorrend = [];
    rows.forEach(function (r) {
      var d = new Date(r.kezdes);
      var k = napKulcs(d);
      if (!napok[k]) { napok[k] = { fejlec: napFejlec(d), savok: [] }; sorrend.push(k); }
      napok[k].savok.push({ id: r.id, ido: ido(d), label: napFejlec(d) + " " + ido(d) });
    });
    var html = "";
    sorrend.forEach(function (k) {
      html += '<div class="foglalo-nap"><p class="foglalo-nap-fejlec">' + napok[k].fejlec + '</p><div class="foglalo-nap-savok">';
      napok[k].savok.forEach(function (s) {
        html += '<button type="button" class="foglalo-slot" data-id="' + s.id + '" data-label="' + s.label + '">' + s.ido + "</button>";
      });
      html += "</div></div>";
    });
    slotokEl.innerHTML = html;
  }

  function loadSlots() {
    slotokEl.textContent = "Időpontok betöltése…";
    db.from("idopontok").select("id,kezdes").eq("statusz", "szabad").order("kezdes")
      .then(function (res) {
        if (res.error) {
          slotokEl.innerHTML = '<p class="foglalo-ures">Az időpontok betöltése nem sikerült. Kérjük, frissítse az oldalt.</p>';
          return;
        }
        renderSlots(res.data);
      });
  }

  /* ---------- Sáv kiválasztása ---------- */
  slotokEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".foglalo-slot");
    if (!btn) return;
    selectedSlotId = btn.getAttribute("data-id");
    selectedLabel = btn.getAttribute("data-label");
    Array.prototype.forEach.call(slotokEl.querySelectorAll(".foglalo-slot"), function (b) {
      b.classList.remove("kivalasztott");
    });
    btn.classList.add("kivalasztott");
    kivalasztottEl.textContent = "Választott időpont: " + selectedLabel;
    urlap.hidden = false;
    urlap.scrollIntoView({ behavior: "smooth", block: "start" });
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
        || !f.irsz.value.trim() || !f.cim.value.trim()) {
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
        loadSlots();
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
