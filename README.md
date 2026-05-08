# Ollama — full site rebuild

A complete redesign of ollama.com plus two real product features that don't
exist today. Built as a portfolio piece for an Ollama application.

**Open `index.html` in a browser, or run `python3 -m http.server` in this
folder. No build step.**

---

## Why this exists

I'm an Ollama Pro user who hit two friction points:

1. **The Usage page is a snapshot, not a dashboard** — you have to refresh
   the tab to know if anything changed mid-session.
2. **There's no signal of which cloud model is fast right now** — when one
   model is slow, you have no way to know if another would serve faster.

So I rebuilt the site I'd want to use, end to end.

---

## Pages

| Page | What's here |
|------|-------------|
| `index.html`     | Homepage — hero, install command, featured models, why-Ollama, CTA |
| `library.html`   | Browse all models — search + filter (Local / Cloud / Code / Vision) |
| `model.html`     | Per-model detail — readme, tags table, API examples, **live capacity widget** |
| `settings.html`  | Account — **live Usage dashboard** + **Cloud Capacity dashboard** (new) |
| `pricing.html`   | Three-tier pricing — Local / Pro / Team |
| `docs.html`      | Quickstart guide — install, run, API, cloud |
| `404.html`       | "This llama wandered off" |

---

## Two new product features

### 1. Live Usage page

What ollama.com/settings has today is a static read — refresh the tab to
see new state. This version:

- Auto-refreshes every 15s with a visible countdown
- Pause/resume toggle, "Refresh now" button, `R` keyboard shortcut
- Pauses when the tab is hidden, catches up on focus (no wasted requests)
- 60-min sparkline of session usage with a "▲ 2.3% in 5m" trend delta
- Top-models breakdown (token consumption per model — currently invisible
  to users, most-requested feature in the Discord)

### 2. Cloud Capacity dashboard

Brand new — Ollama doesn't have this anywhere today.

- A status card per cloud model — Available / Busy / At capacity
- Live load %, latency, queue depth, region for each
- Per-model sparkline so you can spot "spiking now" vs "consistently hot"
- Filter by status, sort by lowest load / latency / size / name
- System banner with overall health and average latency
- Status-change flash animation when a card flips state

The same widget is embedded on each `model.html` page so you can check
capacity without leaving the model card.

---

## Site-wide craft

This is what a frontend-designer founder would notice first:

- **Native Ollama llama mark** as an inline SVG symbol — used in topbar,
  hero (with a soft float animation), footer, and 404. Single source of
  truth in `logo.svg`, referenced via `<use href="logo.svg#root"/>`.
- **Real design system** in `styles.css` — color tokens, spacing scale,
  motion curves, typography ramp. One change to `--text` rebrands the
  whole site. Apple-style `--ease: cubic-bezier(0.2, 0.8, 0.2, 1)`.
- **Cmd+K command palette** — searches models, settings, docs. ↑↓ to
  navigate, `↵` to open, `esc` to close. Also hit `/` from anywhere.
- **Copy-to-clipboard** for every code block, with a checkmark animation
  and a fallback for non-secure contexts.
- **Theme toggle** with localStorage persistence; respects
  `prefers-color-scheme` until the user chooses otherwise. No FOUC — the
  saved theme is applied before paint.
- **Accessibility** — skip link, focus rings, ARIA labels and roles, live
  regions, `aria-current="page"` on active nav, `prefers-reduced-motion`,
  semantic landmarks.
- **Responsive** down to mobile — sidebar collapses to horizontal scroll,
  topbar drops nav, model grids reflow.
- **Native font stack** — `-apple-system, BlinkMacSystemFont, Inter, …` —
  no FOIT, no external font load.
- **Backdrop-filter blur** on the topbar, real macOS-style.
- **Hash routing** in settings — `settings.html#capacity` deep-links work.
- **No build step.** Pure HTML/CSS/JS so any reviewer opens a file and it
  runs. Total: ~1200 lines of CSS, ~600 lines of JS, ~600 lines of HTML.

---

## Architecture

- `app.js` injects the shared topbar / footer / palette into placeholder
  divs (`<div data-shell="topbar">`) on every page. Write once, reuse
  everywhere.
- Per-page initializers (`initHome`, `initLibrary`, `initModel`,
  `initSettings`) are dispatched off `<body data-page="...">`.
- A single `MODELS` catalog drives the homepage featured grid, library
  page, model detail page, and capacity dashboard — change one entry,
  it updates everywhere.
- Live data is simulated client-side with smooth bounded random walks
  so the UI feels like real telemetry. Wiring to the real Ollama metrics
  endpoint is a single function change in `refreshUsage` / `tickCapacity`.
- Sparklines are inline SVG with `vector-effect: non-scaling-stroke` for
  crisp lines at any container size.

---

## Files

```
index.html      homepage
library.html    browse models
model.html      single model detail
settings.html   usage + capacity dashboards
pricing.html    pricing tiers
docs.html       quickstart docs
404.html        not found
logo.svg        the llama mark (referenced by all pages)
styles.css      design system + components
app.js          shared shell + per-page logic
```

— Avinash · `avinashsreekumar007@gmail.com`
