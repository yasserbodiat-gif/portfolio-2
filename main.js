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

/* ───────────────────────────────────────────────────────────
   PLAYLIST — the only part you need to edit.

   Drop audio files and cover images into assets/, then fill in
   the paths below. Add or remove entries freely; the widget
   adapts to however many tracks are in the list.
   ─────────────────────────────────────────────────────────── */
const TRACKS = [
  { title: "Track One", artist: "Artist name", src: "", cover: "" },
  { title: "Track Two", artist: "Artist name", src: "", cover: "" },
  { title: "Track Three", artist: "Artist name", src: "", cover: "" },
];

/* Now Playing widget — previous / play-pause / next over TRACKS. */
(function player() {
  const audio = document.getElementById("audio");
  const playBtn = document.getElementById("playBtn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const titleEl = document.getElementById("trackTitle");
  const artistEl = document.getElementById("trackArtist");
  const coverEl = document.getElementById("trackCover");
  if (!audio || !playBtn || !TRACKS.length) return;

  let index = 0;

  const setPlayingUI = (playing) => {
    playBtn.classList.toggle("is-playing", playing);
    playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  };

  const load = (i, autoplay) => {
    index = (i + TRACKS.length) % TRACKS.length; // wraps both directions
    const track = TRACKS[index];

    titleEl.textContent = track.title || "Untitled";
    artistEl.textContent = track.artist || "";

    // With no cover the gradient placeholder behind the img shows through.
    // src must be removed rather than blanked — an empty src resolves to the
    // page itself and paints a broken-image icon.
    coverEl.hidden = !track.cover;
    coverEl.alt = track.cover ? `${track.title} cover art` : "";
    if (track.cover) coverEl.src = track.cover;
    else coverEl.removeAttribute("src");

    if (track.src) audio.src = track.src;
    else audio.removeAttribute("src");
    if (autoplay && track.src) play();
    else setPlayingUI(false);
  };

  const play = () => {
    if (!audio.src) return; // nothing wired up for this track yet
    audio.play().then(
      () => setPlayingUI(true),
      () => setPlayingUI(false) // autoplay blocked, or the file is missing
    );
  };

  playBtn.addEventListener("click", () => {
    if (audio.paused) play();
    else {
      audio.pause();
      setPlayingUI(false);
    }
  });

  // Keep playing across a skip only if something was already playing.
  prevBtn.addEventListener("click", () => load(index - 1, !audio.paused));
  nextBtn.addEventListener("click", () => load(index + 1, !audio.paused));

  audio.addEventListener("ended", () => load(index + 1, true));
  audio.addEventListener("pause", () => setPlayingUI(false));
  audio.addEventListener("play", () => setPlayingUI(true));

  load(0, false);
})();

/* Scroll transition — the desktop is pinned and recedes while the FAQ
   rises over it. Only transform and opacity are touched, so the whole
   thing stays on the compositor. */
(function scrollStage() {
  const desktop = document.querySelector(".desktop");
  const faq = document.getElementById("faq");
  const cue = document.getElementById("scrollCue");
  if (!desktop || !faq) return;

  let ticking = false;

  const apply = () => {
    ticking = false;
    const range = document.documentElement.scrollHeight - window.innerHeight;
    const p = range > 0 ? Math.min(Math.max(window.scrollY / range, 0), 1) : 0;

    // Ease-out cubic: the panel decelerates as it lands rather than stopping dead.
    const eased = 1 - Math.pow(1 - p, 3);

    faq.style.transform = `translate3d(0, ${(1 - eased) * 100}%, 0)`;
    faq.classList.toggle("is-open", p > 0.6);

    // The desktop clears out ahead of the panel so the two never fight.
    desktop.style.opacity = String(Math.max(1 - p * 1.35, 0));
    desktop.style.transform = `scale(${1 - 0.04 * eased})`;
    if (cue) cue.style.opacity = String(Math.max(0.55 - p * 3, 0));
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  apply();
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
  document.querySelectorAll(".cd-figure img, .intro-avatar img").forEach((img) => {
    const holder = img.closest(".cd-figure, .intro-avatar");
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
