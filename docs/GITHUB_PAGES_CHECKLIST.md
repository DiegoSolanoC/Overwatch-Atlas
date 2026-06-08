# GitHub Pages parity checklist

Use this to confirm the site looks and behaves the same on GitHub Pages as locally.

## Paths (all relative)

- **HTML**: No `href="/..."` or `src="/..."` for app assets. All use relative paths (`src/styles/app.css`, `src/styles/entry.css`, `src/...`, `src/assets/...`, `src/data/...`).
- **Atlas News image**: In HTML the src uses the encoded filename: `src/assets/images/Misc/Atlas%20News.png` (space → `%20`) so it loads on GitHub Pages.
- **CSS**: `src/styles/app.css` aggregates partials via `@import` URLs relative to **`src/styles/`**; `entry.css` is linked separately from `index.html`.

## Case sensitivity (GitHub Pages = Linux)

Unlike Windows, GitHub Pages serves files from a **case-sensitive** filesystem. Under `src/assets/images/`, folder names must match the repo exactly, for example: **`Icons`**, **`Maps`**, **`Misc`**, **`Music`**, **`Menu`**, **`Background Pattern`**, **`Archive/Events`**, **`Archive/NPCs`**, **`Filters/Heroes`**, **`Filters/Factions`**, **`Filters/NPCs`**, **`Filters/Flags`**, and the icon subfolders (`Palette Icons`, `Mode Icons`, …). A wrong case in a URL will 404 on Pages while it may still work locally.

## CI vs `_site/`

- **Recommended**: **Settings → Pages → Source: GitHub Actions**. Pushes to `main` / `master` run `.github/workflows/deploy.yml`, which executes **`npm run build:pages`** (regenerates `src/data/manifest.json`, copies a clean tree into **`_site/`**, injects `<meta name="timeline-deploy" content="static">` into the built `index.html`, and writes **`.nojekyll`** in the artifact).
- **`_site/`** is **gitignored** — do not commit it. The workflow builds it on every deploy.
- **Before you push**, run **`npm run build:pages`** locally once to confirm the build passes and the manifest matches your assets (same command CI uses).

## Footer and sliding headlines

- **Footer**: `<footer>` contains `.footer-atlas-news` (Atlas image) and a `<p>`; the red trapezoid and image are shown when the footer has class `timeline-loaded` (added by `ModeOrchestrator` when the globe is ready).
- **News ticker**: `NewsTickerService` creates `.news-ticker-container` and appends it to the footer; it is initialized when the timeline loads and updated with headlines from the current page. No GitHub Pages–specific logic hides it.
- **Script order**: `platform/news-ticker/FooterNewsTicker.js` is loaded before **`src/features/universal-features/BootUp/LoadingOrchestrator.js`** and other services; `ModeOrchestrator` runs after the globe loads and then calls `newsTickerService.init()` and `updateTicker(currentPageEvents)`.

## Number buttons and hover

- **Styles**: Event number buttons (1–10) and marker-hover highlight (`.number-btn-marker-hover`) are in `src/styles/features/event-system/event-pagination.css`, imported via `src/styles/app.css`. Same bundle for desktop and mobile (media queries inside).
- **Behavior**: `MarkerInteractionService` adds/removes `number-btn-marker-hover` on the corresponding button when a marker is hovered. No conditional that disables this on GitHub Pages.

## Button layouts (desktop and mobile)

- **Globe/pagination**: `src/styles/features/world/globe.css`, `src/styles/features/codex/codex.css`, `src/styles/features/event-system/event-pagination.css`.
- **Zoom, music, palette, event manager, filters, etc.**: `src/styles/entry.css`, `src/styles/features/world/globe.css`, `src/styles/mobile/viewport.css` (via `src/styles/mobile.css`).
- All loaded through `src/styles/app.css` and `src/styles/entry.css` with relative imports; no absolute URLs.

## Codex v5 + connection metadata (static hosting)

- **Shipped file**: `src/data/codex/codex-labels.json` must be **v5+** with a `connections[]` array (relationship text, pruned flags, ranges). CI validates this during `npm run build:pages`.
- **Read on Pages**: Gallery / event-slide info panels and Codex load topology + `connections[]` from that JSON (relative path `src/data/codex/codex-labels.json`). Archives no longer store connection rows.
- **Edit on Pages** (Gallery or Data Workshop): connection **Save** writes to **browser `localStorage` only** — there is no `/api/codex` on GitHub Pages. Prunes and narrative edits persist per browser until cache is cleared.
- **Share connection edits**: use **Codex → Export JSON** on the live site, then merge/commit the file locally and push (or re-import on another machine). For a canonical update, save from **localhost** (dev server writes `codex-labels.json` on disk).
- **Before deploy**: run **`npm run build:pages`** locally; fix any validation errors (missing `connections[]`, old codex version, etc.).

## Before you push

1. **Commit the Atlas image** (if not already):  
   `git add "src/assets/images/Misc/Atlas News.png"`

2. **Commit data you want live**, especially:
   - `src/data/codex/codex-labels.json` (v5 + `connections[]` after local Codex/connection edits)
   - `src/data/story-archive/*.json` (bios, roles — not connections)
   - `src/data/event-system/timeline-events.json` when timeline content changed

3. **Ensure expected paths are in the repo**:  
   `index.html`, `404.html`, `.nojekyll`, `src/styles/app.css`, `src/script.js`, `src/server.js` (local dev only; **excluded** from `_site/`), `src/data/` (JSON including **`src/data/platform/manifest.json`** — CI regenerates it during `build:pages`), `src/assets/`, `src/` (application JS), `src/styles/`, `scripts/` (build helpers; **excluded** from `_site/`).

4. **Open the live site** at  
   `https://<username>.github.io/<repo-name>/`  
   (or `.../index.html`). After the globe loads you should see:
   - Footer with Atlas News image (red trapezoid) on the left
   - Sliding headlines in the white part of the footer
   - Number buttons 1–10 below the page controls; hovering a globe marker highlights the matching number button
   - Same desktop/mobile button layout as locally
