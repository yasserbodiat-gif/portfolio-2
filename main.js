/* Menu bar clock — matches macOS "Mon 4:45 PM" formatting. */
(function clock() {
  const el = document.getElementById("clock");
  if (!el) return;

  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const tick = () => {
    el.textContent = fmt.format(new Date());
    // Re-align to the top of the next minute so the clock never drifts.
    setTimeout(tick, 60000 - (Date.now() % 60000));
  };

  tick();
})();

/* The sheet slides over the pinned desktop through native scrolling, so
   there is no transition to drive — only the cue needs to get out of the way. */
(function scrollCue() {
  const cue = document.getElementById("scrollCue");
  if (!cue) return;

  const update = () => {
    cue.style.opacity = window.scrollY > 40 ? "0" : "0.55";
  };

  window.addEventListener("scroll", update, { passive: true });
  update();
})();

/* Testimonials — the panel slides in the first time it enters view. */
(function testimonials() {
  const panel = document.getElementById("testiPanel");
  const section = panel && panel.closest(".testi");
  if (!panel || !section) return;

  if (!("IntersectionObserver" in window)) {
    panel.classList.add("is-in"); // no observer: show it rather than hide it
    return;
  }

  // Watch the section, not the panel — the panel is parked off to the right
  // and would never intersect the viewport on its own.
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        panel.classList.add("is-in");
        io.disconnect(); // it only arrives once
      });
    },
    { threshold: 0.25 }
  );

  io.observe(section);
})();

/* FAQ accordion — buttons rather than <details> so the open/close height
   can animate, and so aria-expanded drives the icon state. */
(function faqAccordion() {
  const list = document.getElementById("faqList");
  if (!list) return;

  list.querySelectorAll(".faq-q").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
    });
  });
})();

/* Case study figures — show the labelled placeholder until the real image
   file exists, so dropping a screenshot into assets/ needs no code change. */
(function figurePlaceholders() {
  document
    .querySelectorAll(".cd-figure img, .intro-avatar img, .shot img, .testi-img")
    .forEach((img) => {
      const holder = img.closest(".cd-figure, .intro-avatar, .shot, .testi-panel");
      const miss = () => holder.classList.add("is-missing");
      // A cached failure can land before this script runs.
      if (img.complete && img.naturalWidth === 0) miss();
      img.addEventListener("error", miss);
    });
})();

/* Desktop windows — one factory drives every draggable window on screen. */
(function windows() {
  let topZ = 50; // bumped so the most recently touched window sits in front
  const opened = []; // most recent last, so Escape closes the top one

  const makeWindow = (iconId, winId) => {
    const icon = document.getElementById(iconId);
    const win = document.getElementById(winId);
    if (!icon || !win) return null;

    const bar = win.querySelector(".win-bar");
    const closeBtn = win.querySelector(".light.close");
    if (!bar || !closeBtn) return null;

    const front = () => (win.style.zIndex = ++topZ);

    const open = () => {
      win.classList.remove("is-closing");
      win.hidden = false;
      icon.classList.add("is-open");
      icon.setAttribute("aria-expanded", "true");
      front();
      if (!opened.includes(api)) opened.push(api);
      closeBtn.focus();
    };

    const close = () => {
      if (win.hidden) return;
      icon.classList.remove("is-open");
      icon.setAttribute("aria-expanded", "false");
      win.classList.add("is-closing");
      // Wait for the shrink to finish before pulling it from the layout.
      win.addEventListener(
        "animationend",
        () => {
          win.hidden = true;
          win.classList.remove("is-closing");
        },
        { once: true }
      );
      const i = opened.indexOf(api);
      if (i > -1) opened.splice(i, 1);
      icon.focus();
    };

    const api = { open, close, isOpen: () => !win.hidden };

    icon.addEventListener("click", () => (win.hidden ? open() : close()));
    closeBtn.addEventListener("click", close);
    win.addEventListener("pointerdown", front);

    /* Drag by the title bar, clamped so the window can't be lost off-screen. */
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    bar.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".light")) return; // let the traffic lights be clicked
      const box = win.getBoundingClientRect();

      // A window centred with translateX(-50%) would jump by half its width
      // the moment we start writing pixel coordinates. Freeze it in place
      // first; .is-moved drops the transform and swaps in matching keyframes.
      if (!win.classList.contains("is-moved")) {
        win.classList.add("is-moved");
        win.style.left = box.left + "px";
        win.style.top = box.top + "px";
      }

      startX = e.clientX;
      startY = e.clientY;
      originLeft = box.left;
      originTop = box.top;
      bar.classList.add("is-dragging");
      bar.setPointerCapture(e.pointerId);
    });

    bar.addEventListener("pointermove", (e) => {
      if (!bar.hasPointerCapture(e.pointerId)) return;
      const box = win.getBoundingClientRect();
      const maxLeft = window.innerWidth - box.width;
      // Keep the title bar below the menu bar and always reachable.
      const maxTop = window.innerHeight - 44;
      const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

      win.style.left = clamp(originLeft + (e.clientX - startX), 0, maxLeft) + "px";
      win.style.top = clamp(originTop + (e.clientY - startY), 30, maxTop) + "px";
    });

    const endDrag = (e) => {
      bar.classList.remove("is-dragging");
      if (bar.hasPointerCapture(e.pointerId)) bar.releasePointerCapture(e.pointerId);
    };

    bar.addEventListener("pointerup", endDrag);
    bar.addEventListener("pointercancel", endDrag);

    return api;
  };

  makeWindow("caseStudiesIcon", "caseStudiesWindow");
  makeWindow("resumeIcon", "resumeWindow");
  makeWindow("recentIcon", "recentWindow");
  makeWindow("blogsIcon", "blogsWindow");

  // The intro card's link and the menu bar name open the same About window.
  const about = makeWindow("aboutTrigger", "aboutWindow");
  const introMore = document.getElementById("introMore");
  if (about && introMore) introMore.addEventListener("click", about.open);
  // Opened from inside the folder rather than from a desktop icon.
  makeWindow("caseStudy1Item", "caseStudy1Window");
  makeWindow("caseStudy2Item", "caseStudy2Window");
  makeWindow("caseStudy3Item", "caseStudy3Window");

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && opened.length) opened[opened.length - 1].close();
  });
})();

/* Dock magnification — neighbours scale on a falloff curve from the cursor. */
(function dockMagnify() {
  const dock = document.getElementById("dock");
  if (!dock) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const items = Array.from(dock.querySelectorAll(".dock-item"));
  const MAX = 1.45; // scale directly under the cursor
  const RANGE = 110; // px of influence either side

  const reset = () => items.forEach((i) => i.style.setProperty("--scale", 1));

  dock.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;

    items.forEach((item) => {
      const box = item.getBoundingClientRect();
      const distance = Math.abs(e.clientX - (box.left + box.width / 2));
      const falloff = Math.max(0, 1 - distance / RANGE);
      // Cosine easing keeps the bulge smooth rather than tent-shaped.
      const eased = (1 - Math.cos(falloff * Math.PI)) / 2;
      item.style.setProperty("--scale", 1 + (MAX - 1) * eased);
    });
  });

  dock.addEventListener("pointerleave", reset);
  dock.addEventListener("pointercancel", reset);
})();
