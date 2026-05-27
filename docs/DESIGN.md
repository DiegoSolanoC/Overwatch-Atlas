# Overwatch Atlas — Product & Technical Design

This document describes the **intended design** of Overwatch Atlas as an interactive lore database, the **major subsystems** that implement it, and **additional behaviors** worth documenting for authors and contributors. It builds on the in-repo README and reflects the current codebase (ES modules under `src/`, static assets, optional local Node server).

---

## 1. Product intent

The program is an **interactive database** for Overwatch timeline and encyclopedic content. Users should be able to:

- Browse and cross-reference **story events** and **categorical entries** (heroes, factions, NPCs, locations).
- Experience the same underlying data through **different lenses**: a **paginated event dock + detail panels**, a **graph codex**, and a **geographic world view** (2D map / 3D globe).
- Optionally **author or curate** data when running locally with the dev server; public static hosting is **view-first**.

---

## 2. Application shell and load sequence

### 2.1 First paint

On load, the app typically shows:

- A **loading overlay** while core scripts initialize.
- **Universal features**: color palette controls, music/SFX infrastructure, and the **header hub** (mode switching and global chrome).
- The **main menu** (hub tiles / descriptions), not necessarily the full timeline or WebGL scene yet.

`src/features/universal-features/BootUp/AppInitializer.js` coordinates overlay lifecycle and integration with the component loader. The optional **welcome SFX** that plays when a **palette startup theme** kicks in (subject to browser autoplay policy) is wired from `src/features/universal-features/Audio/SoundEffects/welcomeSoundEffect.js` (side-imported by `AppInitializer`), which calls `src/features/universal-features/Audio/Music/applyStartupWelcomeMusicDefaults.js` to set startup music levels before the cue.

Fresh loads clear **`currentMode`** in `localStorage` so the user starts from a neutral hub state; other preferences (palette, music, codex prefs) may still persist.

### 2.2 Modular loading

`src/features/universal-features/BootUp/LoadingOrchestrator.js` and `src/features/universal-features/runtime/ModeOrchestrator.js` load features in **stages**:

- **Universal**: palette, music, menus, shared event-system UI where required.
- **Per mode**: globe stack, codex (glossary) stack, or story-archive / biography flows.

This keeps initial work small and avoids running WebGL or heavy canvases until the user chooses a mode.

### 2.3 Mode model (`localStorage.currentMode`)

The hub distinguishes roughly:

| User-facing concept | Typical `currentMode` / code names | Notes |
|---------------------|-----------------------------------|--------|
| Main hub / menu | `menu` | Landing after load; mode cleared on fresh session. |
| Interactive world | `globe` | 2D map or 3D globe; same event dock can attach. |
| Codex | `glossary` / codex | Graph canvas; body may get `codex-mode-active`. |
| Biography / data archive | `biography` | **Biography** in the header is still partially **“coming soon”** in one path; orchestrator also defines a **Data Archive** run that centers archive panels. Treat as **evolving** in UI copy vs. implementation. |

Mode switches may play **mode-switch SFX** and show the loading overlay briefly for parity between entry points.

---

## 3. Universal features (all modes)

### 3.1 Color palettes

- The app can switch **global palettes** (e.g. blue vs gray families; extended sets may exist).
- **Textures, patterns, and chrome** (buttons, panels, backgrounds) are driven by palette state so the whole UI reads as one theme.
- With the **palette menu** open, **number keys 1–4** can select specific named palettes (see keyboard section).

### 3.2 Music

- **MusicService** (`src/features/universal-features/Audio/Music/MusicService.js`) is the root coordinator; the actual implementation is grouped by concern under `Audio/Music/` (`services/`, `Initialization/`, `playback/`, `panel/`, `now-playing-badge/`). It loads tracks from the generated **manifest** (see §8) and is exposed globally as `window.MusicManager` for backward compatibility.
- Playlists can be **palette-aligned**: certain themes or fallback loops apply when nothing is playing.
- User controls typically include **play / pause**, **skip**, **shuffle**, and **volume**.
- Volume and mute state can be **persisted** (e.g. localStorage via music state helpers).

### 3.3 Sound effects (SFX)

- **SoundEffectsManager** provides UI feedback (mode switch, panel open, etc.).
- SFX volume is **independent** from music volume where the UI exposes both.

### 3.4 Header and hub styling

- The **header** uses a deliberate **stylized** layout: hub buttons for major destinations, consistent with the rest of the chrome.
- **Interactive Worldview** is labeled in code as a timeline entry whose subtitle explains **3D globe or 2D map** (`src/features/Interactive-Worldview/entry/GlobeMapLaunchChoice.js`).

---

## 4. Shared event system (“timeline substrate”)

This subsystem is **loaded for modes that need the story dock** and is the main bridge between **JSON data** and **UI**. It is intentionally **mode-agnostic**: codex and globe both reuse pagination, filters, and the event slide where wired.

### 4.1 Data sources

- **Primary story events**: `src/data/events.json` (wrapped as `{ events: [...] }` or array, depending on age of file; server normalizes on read).
- **Story archive satellites** (encyclopedia-style rows, same JSON shape):  
  `src/data/story-archive-heroes.json`, `src/data/story-archive-factions.json`, `src/data/story-archive-npcs.json`, `src/data/story-archive-locations.json`.
- **Geography / transport**: `src/data/locations.json`, `src/data/connections.json`, plus auxiliary files such as `src/data/location-display-names.json`, `src/data/earth-lights-hubs.json`.
- **Codex graph**: `src/data/codex-labels.json` (versioned object with `nodes`, `edges`; legacy `labels` array supported).

### 4.2 Bottom dock and pagination

- A **dock** hosts **pagination** (pages of story events), **thumbnail cards**, and **prev/next** controls.
- Thumbnails use **skew / page-turn style** animations; **filtered-out (“locked”)** events appear **dimmed** in the strip (`shouldEventBeLocked` / marker helpers).
- **Desktop**: dock collapse/expand is available (**Z** shortcut integrates with `PaginationDockCollapse`).
- **Number keys 1–10** (and numpad) jump to **pagination slots** when the timeline shortcut context is active.

### 4.3 Left panel: event / entry slide

- Opening a thumbnail (or a map/globe marker) opens a **left information panel** (event slide) with fields, headlines, relations, and optional **variant** imagery.
- **Main-stage image** can be **hidden** or toggled while reading (**H** / **I** shortcuts when the slide is open).
- **Glitch / “hacked”** presentation: optional overlay styling for flavor (`HackedOverlayManager` on the globe UIView, **X** when glitch control is visible).
- **Variant cycling**: **Tab** cycles variant controls; **digit keys** can select variants when applicable.
- **Plain paste guard** on the slide reduces accidental rich paste in editable fields (`installEventSlidePlainPasteGuard.js`).

### 4.4 Editing and save rules

- **Edit / save** on the slide is restricted to **true local dev hosts**: `localhost` and `127.0.0.1` (`src/features/system-interface/info-panel/isEventSlideEditDevHost.js`).
- **GitHub Pages** and other hosts: viewing and navigation work; **persisting edits** through the app is not the supported path (no write API on static hosting).
- On **local server**, `POST/PUT /api/events` atomically writes `src/data/events.json`; story archive and codex have their own endpoints (§9).

### 4.5 Right panel: music vs filters

- One **right-hand stack** toggles between:
  - **Music** panel (track list, transport, volume), and  
  - **Filters** panel.
- Filters are grouped by **heroes**, **factions**, **NPCs**, and **countries** (internally `country:`-prefixed tokens; user docs may say “country” or “location/region” interchangeably).
- Active filters **lock** non-matching events in the dock and drive marker behavior in world view.

### 4.6 Cross-entry navigation

- **Relevance icons / links** inside the slide connect story events to **archive entities** and related records, keeping the database feel **linked** rather than flat.

### 4.7 News ticker integration

- A **footer ticker** can show **headlines** derived from the **current page** of events (`GlobeSyncService` → `newsTickerService`), tying the dock’s pagination to **Atlas News**-style motion at the bottom of the layout.

### 4.8 Event manager and lists

- A separate **events manage** panel (when enabled) supports browsing or operating on lists; keyboard shortcuts can move **prev/next** inside that panel.

---

## 5. Mode: Interactive world view (globe / map)

### 5.1 Entry: globe vs map chooser

Choosing **Interactive Worldview** does not always jump straight into WebGL. The app can show a **hub tile** chooser (`GlobeMapLaunchChoice`) that sets **`mapGlobePreToggle`** and then launches the globe stack, so users pick **3D globe** or **2D map** up front. In-view **`mapViewToggle`** (**G**) still allows swapping later.

### 5.2 Markers and bodies

- **Story events** with coordinates get **markers** on Earth, and the stack supports **Moon**, **Mars**, and **orbit** marker containers in 2D lite mode.
- Clicking a marker opens the **same event slide** as the dock, keeping behavior consistent.

### 5.3 Globe-only toggles (representative)

| Concern | UI / code hooks | Notes |
|--------|------------------|--------|
| **3D models** | Part of globe scene setup | Optional decorative or landmark models. |
| **Transport routes** | `hyperloopToggle` (legacy id) / `ToggleService` | Planes, trains, boats; refreshes marker managers when toggled. Shortcut **V**. |
| **Weather** | `weatherEffectsToggle` | Aurora / clouds-style enhancement. Shortcut **T**. |
| **Lighting / night side** | `lightingToggle` | Directional sun on the lit hemisphere; **night lights** (dot map) on the dark side; data may use `earth-lights-hubs.json`. |
| **Auto-rotation** | `autoRotateToggle` | Shortcut **R**. |
| **Zoom reset** | `zoomResetBtn` | **Enter** triggers reset when not typing. |

### 5.4 Camera and special markers

- **Station follow** (`StationFollowService`): optional **follow camera** behavior for station-style markers (e.g. ISS), with cleanup when leaving follow mode.

### 5.5 Visual motif: “waving”

- Both **map and globe** presentations can apply a **waving** distortion or motion pattern on the base layer for a living, stylized look (as you described).

### 5.6 Satellite and layered 2D

- **Map2DLite** and related helpers provide a **2D map layer** with DOM markers, distinct from the full WebGL globe, while sharing logical event identity.

---

## 6. Mode: Codex (graph canvas)

### 6.1 Concept

- The **codex** is a **node–edge** graph: **heroes, factions, countries**, **junction** waypoints, and **directed links** (“cords”).
- **View mode**: pan/zoom/explore. **Edit / dev mode**: reposition nodes, adjust visuals, create or remove **edges**; changes target **`src/data/codex-labels.json`**.

### 6.2 Implementation notes

- **Virtualized rendering**: many nodes exist in memory; only those near the viewport are mounted (`CODEX_VIRTUAL_BUFFER_PX`).
- **Parsing**: large JSON may be parsed in a **Web Worker** to avoid blocking the UI.
- **Cord aesthetics**: configurable color, thickness, and snap behavior (e.g. **45°** snap to neighbors on drag end).
- **Persistence**: dev server **`/api/codex`** `GET/POST`; static hosting reads **`src/data/codex-labels.json`** directly.
- **Bio sync**: saving codex can **reconcile entity↔entity edges** into **story archive** JSONs via **`scripts/server-bio-codex-sync.js`** (loaded by the dev server; preview via **`/api/codex/bio-sync-preview`**).

### 6.3 Bridge to the event slide

- In codex mode, **`__codexEventSlideBridge`** can supply `dataModel` / `uiView` so **pagination and the event slide** share logic with the globe path (`src/features/system-interface/platform/shortcuts/keyboardModeResolution.js`).

---

## 7. Mode: Story archive / hub browsing

- **Story archive** UIs present **category grids** or hubs: story events used by the dock, plus **heroes / factions / NPCs / locations** entries that **interlink** with other modes and the codex.
- **Data Archive** orchestration (`runBiographyComponents`) hides the test container and runs a **centered archive experience**; naming in the UI (“Biography” vs “Data Archive”) may still converge—document the **intent** (encyclopedia) vs **exact button label** per release.

---

## 8. Asset manifest (`src/data/manifest.json`)

**`scripts/generate-manifest.js`** scans:

- `src/assets/images/Filters/Heroes`, `src/assets/images/Filters/Factions`, `src/assets/images/Filters/NPCs`
- `src/assets/audio/music`

and emits **`src/data/manifest.json`** with ordered lists aligned to **story archive** order helpers. The browser loads it at **`src/data/manifest.json`** (the dev server also maps legacy **`/manifest.json`**). **`npm start`** / **`npm run build:pages`** regenerates it so filters, icons, and music stay in sync with files on disk.

---

## 9. Local server vs static hosting

### 9.1 Local (`src/server.js`, port 8000)

- **Single timeline HTML entry:** the app ships **`index.html`** only. The dev server also serves that same file for legacy paths **`/main`**, **`/main/`**, and **`/main.html`** so old bookmarks keep working.
- Serves static files from the repo root (run **`node src/server.js`** from the project root so relative paths resolve).
- **Write APIs** (atomic temp + rename; on-disk targets under **`src/data/`**):
  - `/api/events` → `src/data/events.json`
  - `/api/story-archive` → `src/data/story-archive-*.json`
  - `/api/codex` → `src/data/codex-labels.json` (+ bio sync side effects via **`scripts/server-bio-codex-sync.js`**)

### 9.2 Static (e.g. GitHub Pages)

- No write API; codex/events/archives are **read-only** from shipped JSON.
- Paths stay **relative** for subpath deployment; `.nojekyll` avoids Jekyll mangling.

---

## 10. Keyboard shortcuts (global, when not typing)

Documented in `src/features/system-interface/platform/shortcuts/installAppKeyboardShortcuts.js` (capture phase; ignores most keys when focus is in text fields, with **Escape** exceptions for panels). The dispatcher delegates to siblings in `platform/shortcuts/` (typing context, mode resolution, pagination triggers, variant/number keys, palette cycling, overlay closers).

| Key | Action |
|-----|--------|
| **Escape** / **Q** | Close top overlay; repeat to peel layers (slide, filters, music, palette, manage, sidebar). |
| **F** | Filters toggle. |
| **M** | Music toggle. |
| **C** | Palette toggle. |
| **G** | Map / globe view toggle (when available). |
| **V** | Transport routes toggle (`hyperloopToggle`). |
| **T** | Weather effects toggle. |
| **R** | Auto-rotate toggle. |
| **Z** | Pagination dock collapse/expand (desktop). |
| **Enter** | Zoom reset (when not typing / not on a focused button). |
| **A** / **D** or **←** / **→** | Prev/next event when slide open; else prev/next page in timeline; else manage list navigation. |
| **W** / **S** or **↑** / **↓** | Scroll active panel content. |
| **E** | “All events” when slide open (blocked if story viewer container is active). |
| **H** / **I** | Toggle main image visibility when slide open. |
| **X** | Glitch toggle when visible. |
| **Tab** | Cycle variant selector when slide open. |
| **1–9**, **0** (10) | Pagination jump in timeline context; variant / palette behavior in other contexts. |

---

## 11. Additional findings (easy to overlook)

1. **External link confirmation** — Leaving the app via certain links may pass through **`ExternalLinkConfirm`** overlay (`#externalLinkConfirmOverlay`); Escape handling is aware of it.
2. **Sidebar** — A **sidebar** can be toggled; Escape closes it and persists `sidebarOpen` in storage where used.
3. **Headlines in forms** — `HeadlinesFieldManager` manages **dynamic headline fields** in the event editor; ticker copy can derive from event headline data.
4. **GitHub Pages sidebar** — `AppInitializer` may **hide** sidebar behavior on GitHub Pages (marketing / parity).
5. **Mobile** — Dedicated CSS under `src/styles/mobile/` and helpers (`MobileEventSlideHelpers`, responsive dock) adjust layout; not every desktop shortcut applies on touch devices.
6. **Zoom controls** — Visibility and behavior are tied to page init and globe load (see README parity notes).
7. **Codex prefs** — Local keys such as `timelineCodexMode`, `timelineCodexVisualPrefs`, `timelineCodexShowDebugging` store codex UI state.
8. **Bio panel sub-fields** — Hero roles and faction types have **synced visibility** helpers (`HeroRoleBioPanel`, `FactionTypeBioPanel`) so the slide matches structured data.
9. **Story filter places** — `StoryFilterPlacesSync` keeps **filter-related place lists** aligned between editor and story events where configured.
10. **Loading / status feedback** — User-visible **status lines** come from `src/features/universal-features/runtime/statusFeed.js` (`updateStatus`). The **loading overlay** and a small **run-operation** flag are coordinated via `src/features/universal-features/runtime/loadingOverlayState.js`. **Button disabled states** during guarded async work use `src/features/universal-features/ComponentSetUp/dom/setButtonState.js` and the **loading lock** pattern in `src/features/universal-features/ComponentSetUp/loading/LoadingLockProtocol.js` (see also `LoadingLifecycle.js`).

---

## 12. Credits and license

Overwatch and related marks are **Blizzard Entertainment**. This project is a **fan / educational** artifact; see README for full credits (Three.js, etc.).

---

## 13. Related docs

- [`README.md`](../README.md) — setup, scripts, GitHub Pages checklist overview.
- [`GITHUB_PAGES_CHECKLIST.md`](GITHUB_PAGES_CHECKLIST.md) — deploy verification.
- [`deslop.md`](deslop.md) — refactoring guidelines and code-review habits (for contributors and AI tooling).

When this document and the README disagree on **deployment URLs** or **feature flags**, prefer **README** for process and **this file** for **architecture and UX intent**, and reconcile both when behavior changes.
