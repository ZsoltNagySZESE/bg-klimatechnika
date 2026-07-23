/* =========================================================
   Klímatisztítás — interakciók
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Aktuális év a láblécben ---------- */
  var evEl = document.getElementById("ev");
  if (evEl) evEl.textContent = new Date().getFullYear();

  /* ---------- Lebegő foglalás gomb: csak akkor, ha semmilyen más foglalás-gomb/szakasz nem látszik ---------- */
  var fab = document.getElementById("foglalasFab");
  if (fab && "IntersectionObserver" in window) {
    var fabCelok = [];
    var foglalasSzekcio = document.getElementById("foglalas");
    if (foglalasSzekcio) fabCelok.push(foglalasSzekcio);
    document.querySelectorAll('.hero-actions a[href="#foglalas"], .price-card a[href="#foglalas"], .about-copy a[href="#foglalas"], .contact-foglalas a[href="#foglalas"]')
      .forEach(function (el) { fabCelok.push(el); });
    var fabLathatok = new Set();
    var fabObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) fabLathatok.add(e.target); else fabLathatok.delete(e.target); });
      fab.classList.toggle("rejtve", fabLathatok.size > 0);
    }, { threshold: 0 });
    fabCelok.forEach(function (el) { fabObs.observe(el); });
  }

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

})();
