/* =========================================================
   Klímatisztítás — interakciók
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Aktuális év a láblécben ---------- */
  var evEl = document.getElementById("ev");
  if (evEl) evEl.textContent = new Date().getFullYear();

  /* ---------- Lebegő foglalás gomb: elrejtés, ha a foglaló szakasz látszik ---------- */
  var fab = document.getElementById("foglalasFab");
  var foglalasSzekcio = document.getElementById("foglalas");
  if (fab && foglalasSzekcio && "IntersectionObserver" in window) {
    var fabObs = new IntersectionObserver(function (entries) {
      fab.classList.toggle("rejtve", entries[0].isIntersecting);
    }, { threshold: 0.15 });
    fabObs.observe(foglalasSzekcio);
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
