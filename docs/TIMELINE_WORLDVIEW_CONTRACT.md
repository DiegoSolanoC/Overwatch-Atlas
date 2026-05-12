# Timeline ↔ worldview runtime contract

This is the **authoritative** description of how story timeline data connects to the **3D globe / 2D map** after the Event System Load Out migration. Use it when changing loaders, sync, or markers.

## Data

- **Canonical story list for editing** lives in **`window.eventManager`** (backed by `EventDataService` / `src/data/events.json`).
- **Worldview pagination slice** for the globe stack is **`window.globeController.dataModel`**: its `events` array should match the timeline the user is browsing (usually the same events as `eventManager.events` after sync).
- **Copying events into the globe data model** is done by **`window.TimelineMarkerSync.copyEventsToGlobeDataModel`** or **`syncEventsWithGlobeCore`** (see `src/features/system-interface/integration/syncEventsWithGlobeCore.js`).

## Markers (WebGL globe)

- **Owner:** **`window.globeEventMarkerManager`** — an **`EventMarkerManager`** instance (not `GlobeView`).
- **Created when:** `ModeOrchestrator` loads worldview with the event system already active, or equivalent setup paths.
- **Refresh:** **`window.TimelineMarkerSync.refreshTimelineEventMarkers(animate, options)`** → **`globeEventMarkerManager.refreshEventMarkers`** (remove + re-add + filters).
- **`GlobeView`** does **not** implement `addEventMarkers` / `refreshEventMarkers`; do not call those on `globeView`.

## Markers (2D map)

- **Owner:** **`Map2DLiteLayer`** (DOM markers), driven by **`standaloneEventSlide`**, **`standaloneActiveFilters`**, and **`eventManager`** where applicable.

## Filters

- **Active filter set** for locking markers and dock thumbs: **`window.standaloneActiveFilters`** (a `Set`), not `sceneModel.activeFilters`.

## Slide / panel (map marker clicks)

- **`UIView.showEventSlide` / `hideEventSlide`:** used for **map marker** flows; **mobile portrait** may delegate to **`standaloneEventSlide`**; **desktop / landscape** may use a **simple** `#eventSlide` DOM path (not the dock `standaloneEventSlide` object).
- **Dock / archive / codex** flows use **`standaloneEventSlide`** (built by `src/features/system-interface/load-out/standalone-slide/createStandaloneEventSlide.js`) as wired in `MenuHelpers` / `MenuServiceHelpers`.

## Services to use for sync

- **`GlobeSyncService`** — event manager ↔ data model + marker refresh + ticker (uses `TimelineMarkerSync` internally where applicable).
- **`syncEventsWithGlobeCore`** — shared “copy + refresh + optional UIView pagination hooks” for loaders.

## Map ↔ globe switch

- **`GlobeController.setMapViewEnabled`:** when returning from map to globe, recreates WebGL markers via **`globeEventMarkerManager.addEventMarkers`**, not `GlobeView`.
