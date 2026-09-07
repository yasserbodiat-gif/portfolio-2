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

/* Testimonials — one quote at a time, wrapping in both directions. */
(function testimonials() {
  const viewport = document.getElementById("testiViewport");
  const prev = document.getElementById("testiPrev");
  const next = document.getElementById("testiNext");
  const dotWrap = document.getElementById("testiDots");
  if (!viewport || !prev || !next) return;

  const slides = [...viewport.querySelectorAll(".testi-slide")];
  const dots = dotWrap ? [...dotWrap.querySelectorAll(".testi-dot")] : [];
  if (slides.length < 2) return;

  let index = 0;

  const show = (i) => {
    index = (i + slides.length) % slides.length; // wraps both ways
    slides.forEach((s, n) => {
      const on = n === index;
      s.classList.toggle("is-active", on);
      // Hidden slides stay in the layout to hold the height, but are
      // taken out of the accessibility tree.
      if (on) s.removeAttribute("aria-hidden");
      else s.setAttribute("aria-hidden", "true");
    });
    dots.forEach((d, n) => {
      d.classList.toggle("is-active", n === index);
      if (n === index) d.setAttribute("aria-current", "true");
      else d.removeAttribute("aria-current");
    });
  };

  prev.addEventListener("click", () => show(index - 1));
  next.addEventListener("click", () => show(index + 1));
  dots.forEach((d) => d.addEventListener("click", () => show(+d.dataset.index)));

  // Arrow keys work once focus is anywhere inside the carousel.
  viewport.closest(".testi-carousel").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(index - 1);
    else if (e.key === "ArrowRight") show(index + 1);
  });

  show(0);
})();

/* Locked case study — the work is not public yet, so nothing sits behind
   the gate. A submit just explains how to get access. */
(function lockedCaseStudy() {
  const form = document.getElementById("dialForm");
  const error = document.getElementById("dialError");
  if (!form || !error) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    form.classList.remove("is-wrong");
    void form.offsetWidth; // restart the shake on a repeat submit
    form.classList.add("is-wrong");
    error.innerHTML =
      'That password is not recognised. ' +
      '<a href="mailto:yasserbodiat@gmail.com?subject=Dialdirect%20case%20study">Email me</a> ' +
      'and I will walk you through the work.';
  });
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

/* Shuffle transition — plays when a section shortcut is clicked.
   The slide geometry is the supplied Shuffle FX component: widths grow
   exponentially left to right and wrap infinitely. Here the scroll value
   is driven by a timed easing rather than by the pointer. */
(function shuffleTransition() {
  const overlay = document.getElementById("shuffle");
  const links = [...document.querySelectorAll(".desk-link")];
  if (!overlay || !links.length) return;

  const IMAGES = [
    "assets/cs-tih-1.jpg", "assets/gal-image-1.jpg", "assets/gallery-3.jpg",
    "assets/cs-sg-1.jpg", "assets/cs-tih-2.jpg", "assets/gallery-6_1.jpg",
    "assets/gallery-6_2.jpg", "assets/cs-mt-6.jpg", "assets/gallery-8.jpg",
  ];

  const config = { lerp: 0.075, minSize: 0.1, growth: 0.25, aspect: 1 / 1.25 };
  const growthRatio = Math.exp(config.growth);
  const slideCount =
    Math.ceil(Math.log(1 + (growthRatio - 1) / config.minSize) / config.growth) + 4;

  const wrap = (v, max) => ((v % max) + max) % max;
  const edgeX = (position, width) =>
    (width * config.minSize * (Math.pow(growthRatio, position) - 1)) / (growthRatio - 1);

  let slides = null;
  let streamIndex = null;

  const build = () => {
    slides = [];
    streamIndex = [];
    for (let i = 0; i < slideCount; i++) {
      const slide = document.createElement("div");
      slide.className = "shuffle-slide";
      slide.appendChild(document.createElement("img"));
      overlay.appendChild(slide);
      slides.push(slide);
      streamIndex.push(i);
    }
  };

  const setImage = (slide, n) => {
    if (slide.dataset.image === String(n)) return;
    slide.dataset.image = n;
    slide.querySelector("img").src = IMAGES[n];
  };

  let scroll = 0;
  let scrollTarget = 0;
  let running = false;

  const layout = () => {
    const w = overlay.clientWidth;
    for (let i = 0; i < slideCount; i++) {
      const slide = slides[i];
      let index = streamIndex[i];

      while (edgeX(index + scroll, w) > w) index -= slideCount;
      while (edgeX(index + scroll + 1, w) < 0) index += slideCount;
      streamIndex[i] = index;

      const left = Math.round(edgeX(index + scroll, w));
      const right = Math.round(edgeX(index + scroll + 1, w));
      const width = right - left;

      setImage(slide, wrap(index, IMAGES.length));
      slide.style.width = width + "px";
      slide.style.height = width / config.aspect + "px";
      slide.style.zIndex = Math.round(right);
      slide.style.transform = "translate(" + left + "px, 0)";
    }
  };

  const render = () => {
    scroll += (scrollTarget - scroll) * config.lerp;
    layout();
    if (running) requestAnimationFrame(render);
  };

  const go = (target) => {
    const section = document.querySelector(target);
    if (!section) return;

    const jump = () => {
      const y = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, y);
    };

    // Reduced motion: skip the sweep entirely rather than flash it.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      jump();
      return;
    }

    if (!slides) build();

    scroll = 0;
    scrollTarget = 0;
    layout();

    overlay.classList.add("is-on");
    running = true;
    requestAnimationFrame(render);

    // Sweep, jump behind the cover, then lift.
    scrollTarget = 9;
    setTimeout(jump, 620);
    setTimeout(() => {
      overlay.classList.remove("is-on");
      setTimeout(() => { running = false; }, 300);
    }, 780);
  };

  links.forEach((btn) =>
    btn.addEventListener("click", () => go(btn.dataset.target))
  );
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
  makeWindow("blog1Item", "blog1Window");

  // The intro card's link and the menu bar name open the same About window.
  const about = makeWindow("aboutTrigger", "aboutWindow");
  const introMore = document.getElementById("introMore");
  if (about && introMore) introMore.addEventListener("click", about.open);
  // Opened from inside the folder rather than from a desktop icon.
  makeWindow("caseStudy1Item", "caseStudy1Window");
  makeWindow("caseStudy2Item", "caseStudy2Window");
  makeWindow("caseStudy3Item", "caseStudy3Window");
  makeWindow("dialItem", "dialWindow");

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
