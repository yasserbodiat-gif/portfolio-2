/* =========================================================
   Yasser — pinned hero + cross-dissolve to computerman
   Single rAF loop. While the .scene is pinned, scroll progress (p, 0..1)
   drives: the parallax, a fade to black, and the arrival of a second image.
   ========================================================= */
(function () {
  "use strict";

  /* -------- Parallax speeds --------
     1.0 = travels with the page. <1 lags (down), >1 leads (up). */
  var SPEEDS = {
    sky: 0.45,
    type: 0.75,
    hill: 1.08,
  };

  /* Lerp smoothing factor (per frame). Lower = softer / more lag. */
  var LERP = 0.1;

  /* -------- Phase constants --------
     Two pinned scenes. The hero-scene drives a parallax RISE (riseProg 0->1);
     the man-scene drives the scrim + text (manProg 0->1). Between the two the
     page just scrolls: hero out the top, computerman up from the bottom. */
  var RISE_VH_FRAC = 0;      // hill removed -> no hero parallax rise
  // Reveals run on a progress that starts as the section FIRST ENTERS the
  // viewport and ends at the very bottom, and they're front-loaded: text is
  // basically in by the halfway point, with the cards coming in from there.
  var REVEAL_ENTER = 1.0;    // begin the moment the section enters (top at viewport bottom)
  var P_SCRIM_START = 0.0;
  var P_SCRIM_END = 0.05;
  // text groups by [data-reveal]: header(0) -> blocks(1) -> dividers(2)
  var P_TEXT_START = 0.07;
  var REVEAL_STAGGER = 0.075;
  var REVEAL_DUR = 0.08;     // text all in before the cards
  // cards start the moment the vertical lines (dividers) begin revealing (0.22)
  var P_CARDS_START = 0.22;
  var CARD_STAGGER = 0.25;
  var CARD_DUR = 0.28;

  var heroScene = document.getElementById("heroScene");
  var manScene = document.getElementById("manScene");
  var hero = document.getElementById("hero");
  var stageScrim = document.getElementById("stageScrim");
  var stageText = document.getElementById("stageText");
  var cardEls = Array.prototype.slice.call(document.querySelectorAll(".s2-card"));
  var revealEls = stageText
    ? Array.prototype.map.call(
        stageText.querySelectorAll("[data-reveal]"),
        function (el) {
          return {
            el: el,
            idx: +el.getAttribute("data-reveal") || 0,
            rule: el.classList.contains("s2-rule"),
          };
        }
      )
    : [];
  if (!heroScene || !hero) return;

  var planes = Array.prototype.map.call(
    document.querySelectorAll(".plane[data-speed]"),
    function (el) {
      return { el: el, speed: SPEEDS[el.getAttribute("data-speed")] || 1 };
    }
  );

  var hillPlaneEl = document.querySelector(".plane--hill");
  var hillImgEl = document.querySelector(".hill-img");

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  var target = window.scrollY || window.pageYOffset || 0;
  var smoothed = target;
  var running = false;
  // Cap on the hill's rise so its bottom never lifts off the fold (which would
  // expose the sky behind it on short / narrow viewports). Recomputed on
  // load / resize; Infinity = uncapped (wide viewports).
  var maxRisePx = Infinity;

  // --- helpers ---
  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }
  // Smoothstep easing: 0 at edge0, 1 at edge1, eased in between.
  function smoothstep(edge0, edge1, x) {
    var t = clamp01((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
  }
  // Progress across the hero pin (the rise), 0..1.
  function riseProgress(scroll) {
    var range = heroScene.offsetHeight - window.innerHeight;
    if (range <= 0) return 0;
    return clamp01(scroll / range);
  }
  // Reveal progress: 0 as the computerman section starts entering the viewport,
  // 1 at the bottom of the scroll — so the reveals play across the scroll-in.
  function revealProgress(scroll) {
    if (!manScene) return 0;
    var vh = window.innerHeight;
    var start = manScene.offsetTop - vh * REVEAL_ENTER;
    var end = manScene.offsetTop + (manScene.offsetHeight - vh); // pin end = bottom
    if (end <= start) return 0;
    return clamp01((scroll - start) / (end - start));
  }

  // How far the hill may rise before its bottom edge reaches the fold. Measured
  // with the hill plane momentarily un-transformed, so it's scroll-independent.
  function computeMaxRise() {
    if (!hillPlaneEl || !hillImgEl) return;
    var saved = hillPlaneEl.style.transform;
    hillPlaneEl.style.transform = "translate3d(0,0,0)";
    var heroTop = hero.getBoundingClientRect().top;
    var hillRect = hillImgEl.getBoundingClientRect();
    hillPlaneEl.style.transform = saved;
    if (hillRect.height <= 0) return; // image not laid out yet
    maxRisePx = Math.max(0, hillRect.bottom - heroTop - window.innerHeight - 4);
  }

  /* Apply the parallax rise + scrim/text for a given (smoothed) scroll. */
  function apply(scroll) {
    var vh = window.innerHeight;

    // Phase 1 — parallax RISE: the layers lift with depth (hill fastest),
    // eased so it decelerates to a stop as the hero pin ends. Held after.
    var rp = riseProgress(scroll);
    var riseEased = rp * rp * (3 - 2 * rp);
    // full rise, capped so the hill keeps covering the fold
    var riseAmount = Math.min(RISE_VH_FRAC * vh, maxRisePx);
    for (var i = 0; i < planes.length; i++) {
      var pl = planes[i];
      var y = -(riseAmount * (pl.speed / SPEEDS.hill)) * riseEased;
      pl.el.style.transform = "translate3d(0," + y.toFixed(2) + "px,0)";
    }

    // Phase 2 — computerman: scrim, text, cards revealing across the scroll-in.
    var mp = revealProgress(scroll);
    if (stageScrim) {
      stageScrim.style.opacity = smoothstep(P_SCRIM_START, P_SCRIM_END, mp).toFixed(3);
    }

    // Reveal in groups: header (0) -> side blocks (1) -> dividers (2).
    for (var t = 0; t < revealEls.length; t++) {
      var r = revealEls[t];
      var startT = P_TEXT_START + r.idx * REVEAL_STAGGER;
      var rp2 = smoothstep(startT, startT + REVEAL_DUR, mp);
      r.el.style.opacity = rp2.toFixed(3);
      r.el.style.transform = r.rule
        ? "scaleY(" + rp2.toFixed(3) + ")"
        : "translateY(" + ((1 - rp2) * 16).toFixed(2) + "px)";
    }

    // Beat 2 — cards fade + rise, wide then narrow.
    for (var c = 0; c < cardEls.length; c++) {
      var startC = P_CARDS_START + c * CARD_STAGGER;
      var cp = smoothstep(startC, startC + CARD_DUR, mp);
      cardEls[c].style.opacity = cp.toFixed(3);
      cardEls[c].style.transform = "translateY(" + ((1 - cp) * 28).toFixed(2) + "px)";
    }
  }

  /* Reduced motion: static, composed; let CSS own the fades/figure. */
  function resetStatic() {
    for (var i = 0; i < planes.length; i++) {
      planes[i].el.style.transform = "translate3d(0,0,0)";
      planes[i].el.style.willChange = "auto";
    }
    if (stageScrim) stageScrim.style.opacity = "";
    for (var t = 0; t < revealEls.length; t++) {
      revealEls[t].el.style.opacity = "";
      revealEls[t].el.style.transform = "";
    }
    for (var c = 0; c < cardEls.length; c++) {
      cardEls[c].style.opacity = "";
      cardEls[c].style.transform = "";
    }
  }

  function tick() {
    target = window.scrollY || window.pageYOffset || 0;
    smoothed += (target - smoothed) * LERP;

    var settled = Math.abs(target - smoothed) < 0.15;
    if (settled) smoothed = target;

    apply(smoothed);

    // Idle once caught up; the scroll listener wakes us again.
    if (settled) {
      running = false;
    } else {
      requestAnimationFrame(tick);
    }
  }

  function ensureRunning() {
    if (!running && !reduceMotion.matches) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function onScroll() {
    ensureRunning();
  }

  function onResize() {
    computeMaxRise();
    if (reduceMotion.matches) resetStatic();
    else ensureRunning();
  }

  function applyMotionPreference() {
    if (reduceMotion.matches) {
      running = false;
      resetStatic();
    } else {
      for (var i = 0; i < planes.length; i++) {
        planes[i].el.style.willChange = "transform";
      }
      smoothed = window.scrollY || window.pageYOffset || 0;
      ensureRunning();
    }
  }

  // --- Wire up ---
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });

  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", applyMotionPreference);
  } else if (reduceMotion.addListener) {
    reduceMotion.addListener(applyMotionPreference);
  }

  // Cards: cursor-follow spotlight (sets --mx/--my for the ::before glow).
  for (var ci = 0; ci < cardEls.length; ci++) {
    (function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
      });
    })(cardEls[ci]);
  }

  // Compute the rise cap now and again once the hill image has loaded.
  computeMaxRise();
  if (hillImgEl && !hillImgEl.complete) {
    hillImgEl.addEventListener("load", function () {
      computeMaxRise();
      ensureRunning();
    });
  }

  // Initial composition.
  applyMotionPreference();
})();

/* =========================================================
   Background music toggle (restarts each time it's turned on)
   ========================================================= */
(function () {
  "use strict";
  var audio = document.getElementById("bgAudio");
  var btn = document.getElementById("soundToggle");
  if (!audio || !btn) return;

  var on = false;
  function setState(state) {
    on = state;
    btn.classList.toggle("playing", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  btn.addEventListener("click", function () {
    if (on) {
      audio.pause();
      setState(false);
    } else {
      audio.currentTime = 0; // restart from the top every time it's switched on
      var p = audio.play();
      setState(true);
      if (p && p.catch) p.catch(function () { setState(false); });
    }
  });

  // Try to start on open; if the browser blocks autoplay it stays off until
  // the toggle is clicked (which counts as the required user gesture).
  var pl = audio.play();
  if (pl && pl.then) {
    pl.then(function () { setState(true); }).catch(function () { setState(false); });
  }
})();

/* =========================================================
   Contact form — liquid glass, validation, Formspree submit
   ========================================================= */
(function () {
  "use strict";

  // ---- tunables (glass blur/saturation live in CSS custom props) ----
  var DISPLACE = 42;        // base displacement scale (refraction strength)
  var CHROMA = 7;           // per-channel stagger (chromatic aberration)
  var MAP_EDGE_BLUR = 10;   // interior neutralisation blur (px)
  var FORMSPREE = "https://formspree.io/f/xbdnqgkw";

  var form = document.getElementById("contactForm");
  if (!form) return;

  var nameEl = document.getElementById("cf-name");
  var emailEl = document.getElementById("cf-email");
  var msgEl = document.getElementById("cf-message");
  var sendBtn = document.getElementById("cfSend");
  var counter = document.getElementById("cfCounter");
  var tip = document.getElementById("cfTip");
  var inline = document.getElementById("cfInline");
  var status = document.getElementById("cfStatus");
  var announce = document.getElementById("cfAnnounce");
  var hp = form.querySelector(".cf-hp");
  var namePanel = document.querySelector(".cf-field--name");
  var emailPanel = document.querySelector(".cf-field--email");
  var msgPanel = document.getElementById("cfMessagePanel");
  var row = form.querySelector(".cf-row");
  var fields = [nameEl, emailEl, msgEl];

  // ---------- liquid-glass displacement maps ----------
  function roundRect(ctx, x, y, w, h, r) {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function buildMap(w, h) {
    var W = Math.max(4, Math.round(w)), H = Math.max(4, Math.round(h));
    var c = document.createElement("canvas");
    c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    // red L->R ramp = X displacement
    var gx = ctx.createLinearGradient(0, 0, W, 0);
    gx.addColorStop(0, "#000"); gx.addColorStop(1, "#f00");
    ctx.fillStyle = gx; ctx.fillRect(0, 0, W, H);
    // blue T->B ramp = Y displacement, combined via difference
    ctx.globalCompositeOperation = "difference";
    var gy = ctx.createLinearGradient(0, 0, 0, H);
    gy.addColorStop(0, "#000"); gy.addColorStop(1, "#00f");
    ctx.fillStyle = gy; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "source-over";
    // blurred, inset, 50%-grey rounded rect neutralises the interior
    var inset = Math.min(W, H) * 0.2;
    ctx.filter = "blur(" + MAP_EDGE_BLUR + "px)";
    ctx.fillStyle = "rgb(128,128,128)";
    roundRect(ctx, inset, inset, W - 2 * inset, H - 2 * inset, 22);
    ctx.fill();
    ctx.filter = "none";
    return c.toDataURL();
  }
  function applyMap(filterId, panel) {
    if (!panel) return;
    var r = panel.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var url = buildMap(r.width, r.height);
    var filter = document.getElementById(filterId);
    if (!filter) return;
    var img = filter.querySelector(".cf-map");
    img.setAttribute("href", url);
    img.setAttributeNS("http://www.w3.org/1999/xlink", "href", url);
    img.setAttribute("width", r.width);
    img.setAttribute("height", r.height);
    filter.querySelector(".cf-dispR").setAttribute("scale", DISPLACE + CHROMA);
    filter.querySelector(".cf-dispG").setAttribute("scale", DISPLACE);
    filter.querySelector(".cf-dispB").setAttribute("scale", DISPLACE - CHROMA);
  }
  function updateMaps() {
    applyMap("glass-single", namePanel);   // name + email share dims
    applyMap("glass-message", msgPanel);
  }

  // ---------- state helpers ----------
  function filled(el) { return el.value.trim() !== ""; }
  function allFilled() { return fields.every(filled); }
  function firstEmpty() {
    if (!filled(nameEl)) return "add your name";
    if (!filled(emailEl)) return "add your email";
    if (!filled(msgEl)) return "add a message";
    return "";
  }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }

  function updateSend() {
    var off = !allFilled();
    sendBtn.setAttribute("aria-disabled", off ? "true" : "false");
  }
  function isDisabled() { return sendBtn.getAttribute("aria-disabled") === "true"; }

  // ---------- email validation (blur only) ----------
  function clearEmailError() {
    emailPanel.classList.remove("is-invalid");
    emailEl.setAttribute("placeholder", "Email Address");
  }
  emailEl.addEventListener("blur", function () {
    var v = emailEl.value.trim();
    if (v !== "" && !validEmail(v)) {
      emailPanel.classList.add("is-invalid");
      emailEl.setAttribute("placeholder", "that doesn't look right");
      announce.textContent = "That email doesn't look right.";
    } else {
      clearEmailError();
    }
  });

  // ---------- inputs ----------
  fields.forEach(function (el) {
    el.addEventListener("input", function () {
      if (el === emailEl && emailPanel.classList.contains("is-invalid") && validEmail(emailEl.value)) {
        clearEmailError(); // clears the moment it becomes valid
      }
      if (el === msgEl) {
        var len = msgEl.value.length;
        counter.textContent = len + " / 1000";
        counter.classList.toggle("is-visible", len > 800);
      }
      updateSend();
    });
  });

  // ---------- disabled-button messaging ----------
  var inlineTimer;
  function showInline(text) {
    inline.textContent = text;
    inline.classList.add("is-visible");
    clearTimeout(inlineTimer);
    inlineTimer = setTimeout(function () {
      inline.classList.remove("is-visible");
    }, 3000);
  }
  sendBtn.addEventListener("mouseenter", function () {
    if (isDisabled()) { tip.textContent = firstEmpty(); tip.classList.add("is-visible"); }
  });
  sendBtn.addEventListener("mouseleave", function () { tip.classList.remove("is-visible"); });

  // ---------- submission ----------
  function setSending(on) {
    sendBtn.classList.toggle("is-sending", on);
    fields.forEach(function (el) { el.readOnly = on; });
    if (on) sendBtn.setAttribute("aria-disabled", "true");
    else updateSend();
  }
  function showSuccess() {
    var first = (nameEl.value.trim().split(/\s+/)[0]) || "there";
    status.textContent = "Got it, " + first + ". I'll come back to you.";
    status.classList.add("is-visible");
    msgPanel.classList.add("is-done");
    row.classList.add("is-collapsed");
  }
  function showFailure() {
    setSending(false);
    fields.forEach(function (el) { el.readOnly = false; });
    status.textContent = "That didn't send — try again?";
    status.classList.add("is-visible");
    // dismiss on the next interaction so the (still-populated) form can retry
    var dismiss = function () {
      status.classList.remove("is-visible");
      form.removeEventListener("pointerdown", dismiss);
      form.removeEventListener("keydown", dismiss);
    };
    form.addEventListener("pointerdown", dismiss);
    form.addEventListener("keydown", dismiss);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    tip.classList.remove("is-visible");

    if (isDisabled()) { showInline(firstEmpty()); return; }

    // honeypot: pretend success, send nothing
    if (hp && hp.value) { showSuccess(); return; }

    if (!validEmail(emailEl.value)) {
      emailPanel.classList.add("is-invalid");
      emailEl.setAttribute("placeholder", "that doesn't look right");
      announce.textContent = "That email doesn't look right.";
      emailEl.focus();
      return;
    }

    setSending(true);
    var data = new FormData();
    data.append("name", nameEl.value.trim());
    data.append("email", emailEl.value.trim());
    data.append("message", msgEl.value.trim());
    data.append("_replyto", emailEl.value.trim());

    fetch(FORMSPREE, { method: "POST", headers: { Accept: "application/json" }, body: data })
      .then(function (r) { if (r.ok) showSuccess(); else showFailure(); })
      .catch(function () { showFailure(); });
  });

  // ---------- init ----------
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(updateMaps, 150);
  }, { passive: true });

  updateSend();
  updateMaps();
  // rebuild once fonts/layout settle
  window.addEventListener("load", updateMaps);
})();
