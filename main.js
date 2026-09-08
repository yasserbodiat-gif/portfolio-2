/* Opening sequence — scroll drives the stages:
     0.00-0.26  the name on white, cursor paints the pixel field
     0.26-0.56  the words part and an image appears between them
     0.56-0.86  that image grows to fill the screen
     0.86-1.00  full-bleed hold, then hand over to the desktop
   The motion is the supplied Aurela loader, scrubbed off scroll position
   instead of run on a timeline, so the reader controls the pace. */
(function openingSequence() {
  const seq = document.getElementById("heroSeq");
  const track = document.getElementById("heroTrack");
  const box = document.getElementById("heroBox");
  const cue = document.getElementById("heroCue");
  const fxCanvas = document.getElementById("heroFx");
  if (!seq || !track || !box) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    seq.classList.add("is-done");
    return;
  }

  const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
  // Progress across one leg of the sequence.
  const leg = (p, from, to) => clamp01((p - from) / (to - from));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const line = document.querySelector(".hero-line");
  const gap = document.getElementById("heroGap");
  const words = Array.from(document.querySelectorAll(".hero-word"));

  let progress = 0;

  /* Everything the render needs about the resting layout, taken once. Reading
     it per frame meant writing a width into the line and immediately measuring
     it back, which forces a synchronous re-layout of the whole line — at this
     type size that alone was dropping about one frame in six. */
  let m = { holeX: 0, holeY: 0, holeH: 0, restW: 0, vw: 0, vh: 0 };
  let filling = null;

  const measure = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Words sit at rest for the measurement, so the gap is a zero-width strip
    // exactly where the hole will open from.
    words.forEach((w) => (w.style.transform = "translate3d(0,0,0)"));
    const r = gap.getBoundingClientRect();
    m = {
      holeX: r.left,
      holeY: r.top,
      holeH: r.height,
      restW: Math.min(vw * 0.16, 220),
      vw,
      vh,
    };
  };

  const render = () => {
    // Stage 2: the words part and the image appears in the gap between them.
    const open = easeInOut(leg(progress, 0.26, 0.56));
    // Stage 3: the image grows out of that gap to the whole viewport, and
    // then holds there for the last stretch of the track before handing over.
    const fill = easeInOut(leg(progress, 0.56, 0.86));

    // Half the hole each way, as a transform — no layout, just a composite.
    const half = (m.restW * open) / 2;
    words[0].style.transform = `translate3d(${-half}px,0,0)`;
    words[1].style.transform = `translate3d(${half}px,0,0)`;

    // Whole pixels: a fractional width makes the browser resample the photo
    // against a slightly different grid every frame, which shimmers.
    const lerp = (a, b) => Math.round(a + (b - a) * fill);
    box.style.left = lerp(m.holeX - half, 0) + "px";
    box.style.top = lerp(m.holeY, 0) + "px";
    box.style.width = lerp(m.restW * open, m.vw) + "px";
    box.style.height = lerp(m.holeH, m.vh) + "px";

    // The photograph is about to cover them, so the words step aside early.
    const nowFilling = fill > 0;
    if (nowFilling !== filling) {
      filling = nowFilling;
      line.classList.toggle("is-filling", nowFilling);
    }
    const wordAlpha = String(1 - clamp01(fill * 3.2));
    words.forEach((w) => (w.style.opacity = wordAlpha));

    if (cue) cue.style.opacity = String(1 - clamp01(progress / 0.2));

    // Once the image owns the screen, hand over to the desktop underneath.
    // Off the raw scroll rather than the damped value, so leaving the track
    // hands over straight away instead of easing for another half second.
    seq.classList.toggle("is-done", target >= 0.995);
  };

  /* A wheel delivers scroll in coarse jumps, so pinning the render straight to
     scrollY reads as stepping however cheap the frame is. Chasing the scroll
     position instead smooths those steps out without decoupling the two. */
  let target = 0;
  let running = false;

  const readTarget = () => {
    const range = track.offsetHeight;
    target = range > 0 ? clamp01(window.scrollY / range) : 1;
  };

  const tick = () => {
    const delta = target - progress;
    if (Math.abs(delta) < 0.0004) {
      progress = target;
      render();
      running = false;
      return;
    }
    progress += delta * 0.18;
    render();
    requestAnimationFrame(tick);
  };

  const onScroll = () => {
    readTarget();
    if (running) return;
    running = true;
    requestAnimationFrame(tick);
  };

  const onResize = () => {
    measure();
    readTarget();
    progress = target;
    render();
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize);

  measure();
  readTarget();
  progress = target;
  render();
  // The display face changes the line's metrics, so take them again once it
  // has actually loaded.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(onResize);

  /* Pointer field — a single body of liquid ink that follows the cursor.

     A chain of nodes chases the pointer, each lagging the one in front, and
     every node is drawn as an ellipse stretched along its own direction of
     travel. Drawing that chain through blur + contrast is the classic gooey
     trick: the blur bleeds the ellipses into one another, the contrast snaps
     the soft grey back to a hard edge, and what comes out is one continuous
     form that necks and swells rather than a string of circles.

     It reads as ink because the words above it are in difference blend — the
     type inverts to white wherever the ink slides underneath, so the effect
     is doing something to the name rather than decorating around it.

     The ink is composited on an opaque white ground rather than a
     transparent one: contrast() works on colour and leaves alpha alone, so
     over transparency it cannot harden anything and the whole thing stays a
     smudge. White ground also costs nothing here, since it is the same white
     the section is already painted in.

     Everything is drawn at roughly half viewport size and capped at 760px
     wide, and the canvas element itself is that small — CSS stretches it to
     the viewport, so the upscale happens on the compositor for free and the
     per-frame cost stops growing once the display gets big. Output is a hard
     silhouette, so the stretch reads as antialiasing. */
  if (!fxCanvas) return;

  const ctx = fxCanvas.getContext("2d");
  // The chain is drawn here, then blurred and hardened as one image on the way
  // out. Filtering ellipse by ellipse would never fuse them into one body.
  const buf = document.createElement("canvas");
  const bctx = buf.getContext("2d");
  const MAX_W = 760;
  // CSS pixels to buffer pixels; set on resize.
  let scale = 0.5;

  const NODES = 22;
  const chain = Array.from({ length: NODES }, () => ({ x: -999, y: -999, vx: 0, vy: 0 }));

  let px = -999;
  let py = -999;
  let seeded = false;
  let alive = false;
  let idle = 0;
  // Eases in on the first movement and back out on rest, so the ink arrives
  // and leaves rather than popping.
  let presence = 0;
  let wantPresence = 0;

  const size = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    scale = Math.min(0.5, MAX_W / w);
    const bw = Math.max(1, Math.round(w * scale));
    const bh = Math.max(1, Math.round(h * scale));
    buf.width = fxCanvas.width = bw;
    buf.height = fxCanvas.height = bh;
  };

  size();
  window.addEventListener("resize", size);

  const paint = (ms) => {
    const s = scale;
    const t = ms / 1000;
    const w = buf.width;
    const h = buf.height;

    // Head chases the pointer; every other node chases the one in front. The
    // differing rates are what give the tail its lag and taper.
    const head = chain[0];
    head.vx = (px - head.x) * 0.3;
    head.vy = (py - head.y) * 0.3;
    head.x += head.vx;
    head.y += head.vy;

    for (let i = 1; i < NODES; i++) {
      const n = chain[i];
      const p = chain[i - 1];
      const k = 0.36 - i * 0.006;
      n.vx = (p.x - n.x) * k;
      n.vy = (p.y - n.y) * k;
      n.x += n.vx;
      n.y += n.vy;
    }

    presence += (wantPresence - presence) * 0.09;

    bctx.clearRect(0, 0, w, h);
    bctx.fillStyle = "#fff";
    bctx.fillRect(0, 0, w, h);
    bctx.fillStyle = "#000";

    for (let i = 0; i < NODES; i++) {
      const n = chain[i];
      const f = i / (NODES - 1);
      // Tapers to a point, so the form has a head and a tail.
      const r = (58 - 48 * f * f) * presence * s;
      if (r <= 0.4) continue;

      const speed = Math.hypot(n.vx, n.vy);
      const stretch = Math.min(speed * 0.05, 1.35);
      const angle = speed > 0.5 ? Math.atan2(n.vy, n.vx) : 0;

      // A slow quiver on each node, strongest at rest. Motion supplies its own
      // shape; without this the ink settles into a plain circle and dies.
      const q = 7 * presence * Math.max(0, 1 - speed * 0.06);
      const qx = Math.sin(t * 1.7 + i * 0.9) * q;
      const qy = Math.cos(t * 1.3 + i * 1.1) * q;

      bctx.beginPath();
      bctx.ellipse(
        (n.x + qx) * s,
        (n.y + qy) * s,
        r * (1 + stretch),
        r / (1 + stretch * 0.55),
        angle,
        0,
        Math.PI * 2
      );
      bctx.fill();
    }

    // Blur bleeds the nodes into one another, contrast cuts the soft grey
    // back to a hard edge. Blur alone is a smudge; the pair is a body.
    ctx.clearRect(0, 0, w, h);
    ctx.filter = "blur(5px) contrast(26)";
    ctx.drawImage(buf, 0, 0);
    ctx.filter = "none";
  };

  const frame = (ms) => {
    if (!alive) return;
    idle += 1;
    // Called for rest, and once the image starts taking the screen.
    if (idle > 26 || progress > 0.45) wantPresence = 0;

    paint(ms);

    // Runs on until the ink has actually finished retreating.
    if (wantPresence === 0 && presence < 0.01) {
      alive = false;
      presence = 0;
      seeded = false;
      ctx.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
      return;
    }
    requestAnimationFrame(frame);
  };

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" || progress > 0.45) return;
    px = e.clientX;
    py = e.clientY;

    // First movement: collapse the whole chain onto the cursor, or it whips
    // across the screen from wherever it was left.
    if (!seeded) {
      seeded = true;
      for (const n of chain) {
        n.x = px;
        n.y = py;
        n.vx = 0;
        n.vy = 0;
      }
    }

    idle = 0;
    wantPresence = 1;
    if (!alive) {
      alive = true;
      requestAnimationFrame(frame);
    }
  });
})();

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

/* Section shortcuts — jump to a section of the sheet. */
(function sectionLinks() {
  document.querySelectorAll(".desk-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = document.querySelector(btn.dataset.target);
      if (!section) return;
      const y = section.getBoundingClientRect().top + window.scrollY;
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: y, behavior: smooth ? "smooth" : "auto" });
    });
  });
})();

/* Closing statement — drag to paint, the stroke clears on release.
   Adapted from the supplied mouse_7 brush: same hue cycle and breathing
   line width, rewritten on pointer events so one path covers mouse, pen
   and touch, and sized to the section rather than the viewport. */
(function scribble() {
  const canvas = document.getElementById("scribbleCanvas");
  const hint = document.getElementById("scribbleHint");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const section = canvas.closest(".scribble");

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { width, height } = section.getBoundingClientRect();
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Resetting the bitmap clears these, so they are reapplied.
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  };

  resize();
  window.addEventListener("resize", resize);

  let drawing = false;
  let lastX = 0;
  let lastY = 0;
  let hue = 0;

  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const clear = () =>
    ctx.clearRect(0, 0, canvas.width, canvas.height);

  canvas.addEventListener("pointerdown", (e) => {
    drawing = true;
    ({ x: lastX, y: lastY } = at(e));
    canvas.setPointerCapture(e.pointerId);
    if (hint) hint.classList.add("is-hidden");
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const { x, y } = at(e);

    // Width breathes along the hue cycle, so the stroke reads as drawn
    // rather than extruded.
    ctx.lineWidth = 70 + Math.sin(hue * (Math.PI / 180)) * 14;
    ctx.strokeStyle = `hsl(${hue}, 95%, 55%)`;
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
    hue = (hue + 1.6) % 360;
  });

  const stop = () => {
    if (!drawing) return;
    drawing = false;
    clear();
  };

  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("pointerleave", stop);
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
  // Same window, reached from the desktop where the menu bar is hidden.
  const aboutIcon = document.getElementById("aboutIcon");
  if (about && aboutIcon) aboutIcon.addEventListener("click", about.open);
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
