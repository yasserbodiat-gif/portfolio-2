# Portfolio

A single-screen portfolio styled as a macOS desktop. Static HTML, CSS and JS —
no build step, no dependencies. Deployed from `main`.

## Deploying

`netlify.toml` holds the deploy settings, so Netlify needs nothing configured
in its UI: publish directory is the repo root and the build command is empty.
To point an existing Netlify site here: **Site configuration → Build & deploy →
Continuous deployment → Manage repository → Link to a different repository**.

GitHub Pages serves the same repo from `main` with the root folder.

```
index.html    markup for the desktop, windows, widget and dock
style.css     all styling
main.js       clock, dock magnification, windows, music player
assets/       background, resume, page images
```

## Local preview

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Opening `index.html` directly via `file://`
behaves differently around fonts and paths, so use the server.

## Updating the resume

The resume window shows **page images**, not the PDF itself — inline PDF
rendering is inconsistent across browsers and blocked on iOS Safari. The PDF is
still what the Download button and the menu bar's "Download CV" link serve.

After replacing the PDF in `assets/`, regenerate the page images:

```bash
pip install pymupdf
python3 - <<'EOF'
import pymupdf
doc = pymupdf.open("assets/YasserB_CV_2026_2027.pdf")
for i, page in enumerate(doc, 1):
    page.get_pixmap(dpi=150).save(f"assets/resume-p{i}.jpg", jpg_quality=88)
EOF
```

Then update the `<img>` tags in the resume window if the page count changed,
and the two PDF links if the filename changed.

## Opening sequence

The page opens on `.hero-seq`, a fixed white overlay that scrubs off scroll
position rather than a timeline, in three legs:

| Scroll progress | What happens |
| --- | --- |
| 0 – 0.26 | "Yasser Bodiat" on white. Moving the cursor paints a dithered black pixel ripple behind it. |
| 0.26 – 0.56 | The words part and the hero image appears in the gap. |
| 0.56 – 0.86 | The image grows out of that gap to fill the viewport. |
| 0.86 – 1 | Full-bleed hold, then the overlay hands over to the desktop. |

Progress is `window.scrollY / #heroTrack.offsetHeight`, so the pacing is set by
one number: `.hero-track { height }` in `style.css`. `.stage-spacer` then sets
how long the desktop is held before the FAQ starts rising.
`prefers-reduced-motion` skips the whole thing and collapses the track to zero.

Three details are load-bearing and easy to break:

- `.hero-box` is `position: fixed` for the **whole** sequence and is laid over
  an in-flow `.hero-gap` that reserves the space between the words. Putting
  the image in the line and switching it to fixed part-way through makes the
  words snap back together at the seam.
- `mix-blend-mode: difference` sits on `.hero-word`, **not** on `.hero-line`.
  On the line it would drag the photograph through the blend and invert its
  colours; and `.hero-line` must stay at `z-index: auto`, because a stacking
  context there isolates the blend and the words disappear entirely. The blend
  comes off again via `.hero-line.is-filling` once the photograph reaches them.
- The pixel field is a small canvas drawn at cell resolution and scaled up
  with smoothing off. It stops itself once the cursor rests or the image
  starts taking over, so it never competes with scrolling.

## Cache busting

`index.html` loads `style.css?v=N` and `main.js?v=N`. **Bump `N` whenever either
file changes**, otherwise browsers serve the cached copy and the deployed site
appears broken.

## Backgrounds

`assets/background.jpg` (2560px) is used above 900px wide,
`assets/background-small.jpg` (1440px) below. Both are generated from the
full-resolution source PNG in `assets/`.
