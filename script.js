/* =========================================================
   Klímatisztítás — interakciók
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Aktuális év a láblécben ---------- */
  var evEl = document.getElementById("ev");
  if (evEl) evEl.textContent = new Date().getFullYear();

  /* ---------- Mobil menü ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var navList = document.getElementById("nav-list");

  if (toggle && navList) {
    toggle.addEventListener("click", function () {
      var open = navList.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector(".visually-hidden").textContent = open ? "Menü bezárása" : "Menü megnyitása";
    });

    // Menüpontra kattintva zárjon be (mobilon)
    navList.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        navList.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Előtte / utána csúszka ---------- */
  var range = document.getElementById("baRange");
  var before = document.getElementById("baBefore");
  var handle = document.getElementById("baHandle");

  if (range && before && handle) {
    var sync = function () {
      var v = range.value;
      before.style.clipPath = "inset(0 " + (100 - v) + "% 0 0)";
      handle.style.left = v + "%";
    };
    range.addEventListener("input", sync);
    sync();
  }

  /* ---------- GYIK: egyszerre csak egy nyitva (opcionális) ---------- */
  var faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (item.open) {
        faqItems.forEach(function (other) {
          if (other !== item) other.open = false;
        });
      }
    });
  });

  /* ---------- Ajánlatkérő űrlap (Supabase) ---------- */
  // A publikus (publishable) kulcs kliensoldalra való — biztonságos, hogy itt látszik.
  // Az adatbázisban RLS védi: bárki küldhet, de olvasni csak te tudsz a Supabase felületén.
  var SUPABASE_URL = "https://psmdpfxionlpiaxawupf.supabase.co";
  var SUPABASE_KEY = "sb_publishable_bJw2kXa0k-hKFqHLOMeNFw_e7i_QYmZ";

  var form = document.getElementById("ajanlatForm");
  var status = document.getElementById("formStatus");

  var db = (window.supabase && SUPABASE_URL.indexOf("http") === 0)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

  if (form && status) {
    var submitBtn = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      status.className = "form-status";
      status.textContent = "";

      var nev = form.nev.value.trim();
      var telefon = form.telefon.value.trim();
      var telepules = form.telepules.value.trim();

      if (!nev || !telefon || !telepules) {
        status.textContent = "Kérem, töltse ki a nevet, a telefonszámot és a települést.";
        status.classList.add("err");
        return;
      }

      // Spam-csapda: ha a rejtett mező ki van töltve, robotnak vesszük (nem mentünk).
      if (form.website && form.website.value) {
        status.textContent = "Köszönöm, hamarosan keresem!";
        status.classList.add("ok");
        form.reset();
        return;
      }

      if (!db) {
        status.textContent = "Az elküldés most nem elérhető. Kérem, hívjon a +36 30 966 7618 számon.";
        status.classList.add("err");
        return;
      }

      var record = {
        nev: nev,
        telefon: telefon,
        telepules: telepules,
        klimaszam: form.klimaszam.value,
        uzenet: form.uzenet.value.trim() || null
      };

      var origText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = "Küldés…";

      db.from("ajanlatkeresek").insert(record).then(function (res) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
        if (res.error) {
          status.textContent = "Hiba történt a küldéskor. Kérem, próbálja újra, vagy hívjon telefonon.";
          status.classList.add("err");
          return;
        }
        status.textContent = "Köszönöm! Megkaptam a kérését, hamarosan keresem.";
        status.classList.add("ok");
        form.reset();
      });
    });
  }
})();
