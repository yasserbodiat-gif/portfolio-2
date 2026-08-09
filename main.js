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

/* Case Studies folder — opens a Finder-style window that can be dragged. */
(function finder() {
  const icon = document.getElementById("caseStudiesIcon");
  const win = document.getElementById("caseStudiesWindow");
  const bar = document.getElementById("finderBar");
  const closeBtn = document.getElementById("finderClose");
  if (!icon || !win || !bar || !closeBtn) return;

  const open = () => {
    win.classList.remove("is-closing");
    win.hidden = false;
    icon.classList.add("is-open");
    icon.setAttribute("aria-expanded", "true");
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
    icon.focus();
  };

  icon.addEventListener("click", () => (win.hidden ? open() : close()));
  closeBtn.addEventListener("click", close);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  /* Drag by the title bar, clamped so the window can't be lost off-screen. */
  let startX = 0;
  let startY = 0;
  let originLeft = 0;
  let originTop = 0;

  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".light")) return; // let the traffic lights be clicked
    const box = win.getBoundingClientRect();
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
