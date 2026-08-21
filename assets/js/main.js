/**
 * Lightweight site interactions derived from the original Selecao template.
 * Portfolio, slider, lightbox, form, and animation hooks were removed because
 * this site does not use them.
 */
(function() {
  "use strict";

  const select = (selector, all = false) => {
    const normalized = selector.trim();
    return all ? [...document.querySelectorAll(normalized)] : document.querySelector(normalized);
  };

  const on = (type, selector, listener, all = false) => {
    const elements = select(selector, all);
    if (!elements) return;
    (all ? elements : [elements]).forEach((element) => element.addEventListener(type, listener));
  };

  const navbar = select("#navbar");
  const navbarToggle = select(".mobile-nav-toggle");
  let lastFocusedBeforeMenu = null;

  function mobileMenuFocusable() {
    if (!navbar) return [];
    return [...navbar.querySelectorAll('a[href], button:not([disabled])')].filter((element) => {
      return element.offsetParent !== null;
    });
  }

  function setMobileMenu(open, restoreFocus = false) {
    if (!navbar || !navbarToggle) return;
    navbar.classList.toggle("navbar-mobile", open);
    navbarToggle.classList.toggle("bi-list", !open);
    navbarToggle.classList.toggle("bi-x", open);
    navbarToggle.setAttribute("aria-expanded", String(open));
    navbarToggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    document.body.classList.toggle("nav-open", open);

    if (open) {
      lastFocusedBeforeMenu = document.activeElement;
      requestAnimationFrame(() => mobileMenuFocusable().find((element) => element !== navbarToggle)?.focus());
    } else if (restoreFocus && lastFocusedBeforeMenu instanceof HTMLElement) {
      lastFocusedBeforeMenu.focus();
    }
  }

  on("click", ".mobile-nav-toggle", () => {
    setMobileMenu(!navbar.classList.contains("navbar-mobile"), true);
  });

  document.addEventListener("keydown", (event) => {
    if (!navbar?.classList.contains("navbar-mobile")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMobileMenu(false, true);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = mobileMenuFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  on("click", ".navbar .dropdown > a", function(event) {
    if (navbar.classList.contains("navbar-mobile")) {
      event.preventDefault();
      this.nextElementSibling.classList.toggle("dropdown-active");
    }
  }, true);

  function scrollToSection(selector) {
    const header = select("#header");
    const target = select(selector);
    if (!header || !target) return;
    window.scrollTo({ top: target.offsetTop - header.offsetHeight, behavior: "smooth" });
  }

  on("click", ".scrollto", function(event) {
    if (!this.hash || !select(this.hash)) return;
    event.preventDefault();
    if (navbar.classList.contains("navbar-mobile")) setMobileMenu(false);
    scrollToSection(this.hash);
  }, true);

  const navbarLinks = select("#navbar .scrollto", true);
  function updateActiveNavigation() {
    const position = window.scrollY + 200;
    navbarLinks.forEach((link) => {
      if (!link.hash) return;
      const section = select(link.hash);
      link.classList.toggle("active", Boolean(section && position >= section.offsetTop && position <= section.offsetTop + section.offsetHeight));
    });
  }

  const header = select("#header");
  const backToTop = select(".back-to-top");
  function updateScrollState() {
    header?.classList.toggle("header-scrolled", window.scrollY > 100);
    backToTop?.classList.toggle("active", window.scrollY > 100);
    updateActiveNavigation();
  }

  document.addEventListener("scroll", updateScrollState, { passive: true });
  window.addEventListener("load", () => {
    updateScrollState();
    if (window.location.hash && select(window.location.hash)) scrollToSection(window.location.hash);
  });
})();
