# Overwatch Atlas

An interactive 3D timeline visualization of the Overwatch universe, featuring a globe-based interface for exploring events, characters, and locations.

## Features

- **3D Interactive Globe**: Navigate events on Earth, Moon, and Mars
- **Event Management**: View and manage timeline events with detailed information
- **Transport System**: Visualize connections between cities via planes, trains, and boats
- **Music Player**: Background music with multiple tracks
- **Color Palettes**: Switch between blue and gray color schemes
- **Event Filtering**: Filter events by heroes and factions
- **Responsive Design**: Works on desktop and mobile devices

## Local Development

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/DiegoSolanoC/Overwatch-Atlas.git
cd Overwatch-Atlas
```
If your `origin` still points at the old repository name after a rename, run:  
`git remote set-url origin https://github.com/DiegoSolanoC/Overwatch-Atlas.git`

2. Install dependencies (if any):
```bash
npm install
```

3. Start the local server:
```bash
npm start
```

   On Windows you can instead double-click **`start-server.bat`** in the repo root: it regenerates the asset manifest, stops anything already listening on port 8000, starts **`node src/server.js`** in a separate console window, then opens the site in Chrome (or your default browser).

4. Open your browser and navigate to:
- `http://localhost:8000/` - Main application (index.html)
- `http://localhost:8000/index.html` - Same app (explicit path; `/main` still works as a legacy alias)
- `http://localhost:8000/test` - Test page with component loader
- `http://localhost:8000/map` - Map view

## GitHub Pages Deployment

The application is configured to work on GitHub Pages. Follow these steps to deploy:

### 1. Enable GitHub Pages

**Option A — GitHub Actions (recommended)**  
1. Go to **Settings** → **Pages** → **Build and deployment** → **Source**: **GitHub Actions**.  
2. Push to `main` / `master`; the workflow `.github/workflows/deploy.yml` runs **`npm run build:pages`** (regenerates `src/data/manifest.json` and copies a clean tree into **`_site/`** without `.git` / `node_modules`) and publishes **`_site`**.  
3. First run: approve the **github-pages** environment if GitHub prompts you.

**Site URL**  
Project Pages are served at `https://<user>.github.io/<repository-name>/` (this repo: **`Overwatch-Atlas`**). Optional: **Settings → Pages → Custom domain** for a branded host instead of the `github.io` path.

**Option B — Deploy from a branch**  
1. Go to **Settings** → **Pages**  
2. Under **Source**, select **Branch** → `main` (or `master`) → **/ (root)**  
3. Before pushing, run **`npm run build:pages`** (or `node scripts/generate-manifest.js`) so `src/data/manifest.json` matches your `src/assets/` folders.  
4. Click **Save**

### 2. Verify Files

Make sure these paths exist in the repo (typical GitHub Pages tree):
- `index.html` — timeline app (GitHub Pages root + local `/`; dev server also serves the same file for legacy `/main*`)
- `404.html` — SPA-style fallback where used
- `.nojekyll` — disables Jekyll on GitHub Pages
- `src/styles/app.css` and `src/styles/` — global CSS entry and partials
- `src/` — application JavaScript (features, controllers, services)
- `src/data/` — JSON data (`events.json`, `locations.json`, **`manifest.json`**, codex, story archives, etc.)
- `src/assets/` — images, audio, models (e.g. `src/assets/images/Misc/Atlas News.png`)
- `scripts/` — Node helpers (`generate-manifest`, Pages prep, migrations); CI uses **`npm run build:pages`**, which regenerates **`src/data/manifest.json`** before copying to **`_site/`**

### 3. Access Your Site

After enabling GitHub Pages, your site will be available at:
```
https://<your-username>.github.io/<repository-name>/
```

For example (project site):
```
https://diegosolanoc.github.io/Overwatch-Atlas/
```
GitHub serves the site under **`/<repository-name>/`**, so renaming the repository updates that path. The old URL usually redirects for a while after a rename.

### 4. Important Notes for GitHub Pages

- **Edit Mode**: The application automatically detects when running on GitHub Pages and disables edit/delete functionality for events. This prevents users from modifying data on the live site.
- **Local Storage**: User preferences (color palette, music state) are saved in browser localStorage and will persist across sessions.
- **Event Data**: Events are loaded from `src/data/events.json`. On GitHub Pages, users can view events but cannot edit them (edit buttons are hidden).
- **File Paths**: All file paths are relative (no leading `/`), so the site works the same on both localhost and GitHub Pages. Asset paths with spaces (e.g. `Atlas News.png`) use URL-encoded form (`Atlas%20News.png`) in HTML for compatibility.
- **Parity with local**: The following are built to look and behave the same on GitHub Pages as locally:
  - **Footer**: Atlas News image (red trapezoid) and sliding headlines ticker appear after the timeline loads (`footer.timeline-loaded`).
  - **Number buttons (1–10)**: Pagination and event-number button styles (including marker-hover highlight) are in `src/styles/components/event-pagination.css` and load via `src/styles/app.css`.
  - **Button layouts**: Desktop and mobile layouts (zoom, music, palette, event manager, filters, etc.) are in `src/styles/entry.css`, `src/styles/components/globe.css`, and `src/styles/mobile/viewport.css`; all loaded via relative imports.
- **Root files**: Ensure `.nojekyll` exists in the repo root so GitHub Pages does not run Jekyll. Ensure `src/assets/images/Misc/Atlas News.png` (and other files under `src/assets/`, `src/data/`) are committed.

## Design documentation

For an in-depth description of modes, the shared event system, codex/world view behavior, APIs, and keyboard shortcuts, see **[`docs/DESIGN.md`](docs/DESIGN.md)**.

For the **refactor roadmap** (Codex → Archive → Main menu → `src/` sweep; foundation + backlog), see **[`docs/REFACTOR_PHASES.md`](docs/REFACTOR_PHASES.md)**. For **timeline ↔ globe/map marker ownership**, see **[`docs/TIMELINE_WORLDVIEW_CONTRACT.md`](docs/TIMELINE_WORLDVIEW_CONTRACT.md)**.

## Project Structure (high level)

```
Overwatch-Atlas/
├── index.html, 404.html              # HTML (timeline shell + GitHub Pages 404 → index)
├── .nojekyll                         # GitHub Pages: disable Jekyll
├── .gitignore
├── package.json, package-lock.json   # npm / CI
├── README.md
├── start-server.bat                  # Windows: manifest + server window + browser (optional)
├── scripts/                          # Node tooling (manifest, Pages prep, migrations)
├── src/
│   ├── styles/app.css, styles/       # Global CSS bundle + partials (linked from index.html)
│   ├── script.js                     # Bootstrap script (linked from index.html)
│   ├── server.js                     # Local dev HTTP server (port 8000)
│   ├── data/                         # Shipped JSON (events, codex, manifest, …)
│   ├── assets/                       # Images, audio, models
│   └── features/                     # Application modules (globe, timeline, codex, …)
├── docs/                             # Design and refactor notes
├── .github/                          # CI (e.g. Pages deploy)
└── _site/                            # GitHub Pages output (generated; not usually committed)
```

**Root is intentionally small.** `index.html`, `404.html`, and `.nojekyll` belong at the repo root for GitHub Pages. `package.json` / lockfile must stay at the root for npm. `start-server.bat` stays at the root so double‑click starts in the correct directory without extra path glue.

Older one-off folders (`Music/`, root `data/`, etc.) are not part of the current tree; prefer **`src/assets`** and **`src/data`**.

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

Note: Some features may require modern browser support for ES6 modules and WebGL.

## License

Original work by Blizzard Entertainment. This project is for educational/non-commercial use.

## Credits

- **Three.js**: 3D graphics library
- **Overwatch**: Original game and lore by Blizzard Entertainment


