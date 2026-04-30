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

4. Open your browser and navigate to:
- `http://localhost:8000/` - Main application (index.html)
- `http://localhost:8000/main` - Main application (alternative)
- `http://localhost:8000/test` - Test page with component loader
- `http://localhost:8000/map` - Map view

## GitHub Pages Deployment

The application is configured to work on GitHub Pages. Follow these steps to deploy:

### 1. Enable GitHub Pages

**Option A — GitHub Actions (recommended)**  
1. Go to **Settings** → **Pages** → **Build and deployment** → **Source**: **GitHub Actions**.  
2. Push to `main` / `master`; the workflow `.github/workflows/deploy.yml` runs **`npm run build:pages`** (regenerates `manifest.json` and copies a clean tree into **`_site/`** without `.git` / `node_modules`) and publishes **`_site`**.  
3. First run: approve the **github-pages** environment if GitHub prompts you.

**Site URL**  
Project Pages are served at `https://<user>.github.io/<repository-name>/` (this repo: **`Overwatch-Atlas`**). Optional: **Settings → Pages → Custom domain** for a branded host instead of the `github.io` path.

**Option B — Deploy from a branch**  
1. Go to **Settings** → **Pages**  
2. Under **Source**, select **Branch** → `main` (or `master`) → **/ (root)**  
3. Before pushing, run **`npm run build:pages`** (or `node generate-manifest.js`) so `manifest.json` matches your `assets/` folders.  
4. Click **Save**

### 2. Verify Files

Make sure these files are in your repository root:
- `index.html` - Main entry point (GitHub Pages will serve this at the root URL)
- `main.html` - Main timeline application (use this URL for direct access)
- `404.html` - Redirects unknown paths to `index.html` under the same GitHub Pages base (project or user site)
- `.nojekyll` - Empty file; tells GitHub Pages not to use Jekyll
- `styles.css` and `styles/` - All CSS (layout, footer, news ticker, pagination, mobile)
- `src/` - All JavaScript (component-loader, controllers, managers, services)
- `data/` - `events.json`, `locations.json`, etc.
- `assets/` - Images (e.g. `assets/images/misc/Atlas News.png`), models, audio

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
- **Event Data**: Events are loaded from `data/events.json`. On GitHub Pages, users can view events but cannot edit them (edit buttons are hidden).
- **File Paths**: All file paths are relative (no leading `/`), so the site works the same on both localhost and GitHub Pages. Asset paths with spaces (e.g. `Atlas News.png`) use URL-encoded form (`Atlas%20News.png`) in HTML for compatibility.
- **Parity with local**: The following are built to look and behave the same on GitHub Pages as locally:
  - **Footer**: Atlas News image (red trapezoid) and sliding headlines ticker appear after the timeline loads (`footer.timeline-loaded`).
  - **Number buttons (1–10)**: Pagination and event-number button styles (including marker-hover highlight) are in `styles/components/event-pagination.css` and load via `styles.css`.
  - **Button layouts**: Desktop and mobile layouts (zoom, music, palette, event manager, filters, etc.) are in `styles/entry.css`, `styles/components/globe.css`, and `styles/mobile/viewport.css`; all loaded via relative imports.
- **Root files**: Ensure `.nojekyll` exists in the repo root so GitHub Pages does not run Jekyll. Ensure `assets/images/misc/Atlas News.png` (and other assets under `assets/`, `data/`) are committed.

## Project Structure

```
Overwatch-Atlas/
├── index.html          # Main entry point (GitHub Pages)
├── main.html           # Main application page
├── test.html           # Test/development page
├── map.html            # Map view
├── 404.html            # GitHub Pages 404 handler
├── styles.css          # Main stylesheet
├── script.js           # Main application script
├── test-loader.js      # Component loader
├── server.js            # Local development server
├── package.json         # Node.js dependencies
├── data/                # JSON data files
│   ├── events.json
│   ├── locations.json
│   └── connections.json
├── controllers/         # Application controllers
├── models/              # Data models
├── views/               # View components
├── utils/               # Utility functions
├── js/                  # Additional JavaScript
├── Music/               # Music files
├── Music Icons/         # Music icons
├── Event Images/        # Event images
├── Icons/               # Application icons
├── Misc/                # Miscellaneous assets
└── Models3D/            # 3D model files
```

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


