# Codebase diagnosis — maintenance & refactor prep

**Date:** 2026-05-07  
**Scope:** Static analysis + targeted reads of globe/worldview and event-system paths. App is assumed **working**; this document maps **risk, duplication, and structural debt** for a phased cleanup (OOD/MVC, feature folders, naming).

---

## Executive summary

The codebase already has a **partial MVC shape** (`GlobeController` wires `DataModel` / `SceneModel` → `GlobeView` / `UIView`), but **behavior is spread across `services/`, `managers/`, `features/universal-features/helpers/`, `features/Interactive-Worldview/`, and `window.*` globals**. The heaviest duplication and confusion cluster around:

1. **Event markers & globe sync** — two refresh paths (`globeView.refreshEventMarkers` vs `window.globeEventMarkerManager`) and comments that contradict current behavior.
2. **Event system** — `EventManager` delegates to many `Event*Service` modules plus multiple `EventManager*` / `EventSlide*` helper files; similar glue exists in both `features/universal-features/helpers` and `services/helpers`.
3. **God-tier modules** — several files exceed **1k–6k lines**, which blocks “feature slice + MVC” without an incremental cut plan.

---

## Priority matrix (deslop-style)

| Priority | Category | Examples | Action |
|----------|----------|----------|--------|
| **P0** | Correctness / contradictory flows | Globe comments say event markers removed; helpers still call `addEventMarkers` / `refreshEventMarkers` on `globeView` | **Reconcile single ownership** for “who places/refreshes markers” (map lite vs WebGL vs `EventMarkerManager`) and document it |
| **P1** | Duplication / dual APIs | Same sync pattern in `EventPanelHelpers`, `EventManagerHelpers`, `EventNavigationService`, `GlobeSyncService` | **One public API** (e.g. `GlobeMarkerSync` or controller method) |
| **P1** | Global coupling | `window.globeController`, `window.globeEventMarkerManager`, `window.eventManager`, `standaloneEventSlide`, `standaloneActiveFilters` | **Reduce surface** behind a small app context or facade (incremental) |
| **P2** | Maintainability | Files 1k–6k lines (`CodexCanvasService`, `MenuHelpers`, `MenuServiceHelpers`, …) | **Vertical split** by feature + extract models |
| **P3** | Naming | Generic `*Service` / `*Helpers` | **Rename by capability** when moving files |
| **P4** | Legacy / migration | `@deprecated`, “legacy DOM”, migration branches in `CodexCanvasService`, `EventDataService`, dock border cleanup | **Delete or isolate** behind one adapter |

---

## Size hotspots (top `src/**/*.js` by line count)

Approximate line counts (including blanks/comments):

| Lines | File | Note |
|------:|------|------|
| ~6846 | `src/features/connection-codex/services/CodexCanvasService.js` | Entire codex feature in one module |
| ~5365 | `src/features/main-menu/MenuHelpers.js` | Menu + dock + event UI layout glue |
| ~3770 | `src/features/main-menu/MenuServiceHelpers.js` | Overlap with `MenuHelpers` by responsibility |
| ~2240 | `src/features/system-interface/presentation/slide/EventSlideManager.js` | Slide UI orchestration |
| ~1695 | `src/features/universal-features/managers/ComponentOrchestrator.js` | Mode loading / lifecycle hub |
| ~1536 | `src/utils/LocationFlagHelpers.js` | Data + UI-adjacent helpers |
| ~1498 | `src/ui/Map2DLiteLayer.js` | 2D map / DOM markers |
| ~1428 | `src/features/Interactive-Worldview/presentation/views/GlobeView.js` | WebGL globe view |
| ~1243 | `src/features/system-interface/services/EventDataService.js` | Event JSON / normalization |
| ~1232 | `src/services/FilterService.js` | Filter UI + state |
| ~1190 | `src/features/system-interface/services/EventListenerService.js` | Event wiring |
| ~1111 | `src/features/Interactive-Worldview/presentation/views/helpers/GlobeInitHelpers.js` | Globe init split from `GlobeView` |
| ~1044 | `src/features/system-interface/application/EventManager.js` | Facade over many services |
| ~1040 | `src/features/system-interface/services/EventRenderService.js` | Rendering/event list |

**Implication:** “Feature folders + MVC” is correct, but **must be phased**; moving these without tests risks regressions.

---

## Worldview / globe — findings

### What works well

- `GlobeController` is a **clear composition root** for models and sub-controllers (`TransportController`, `InteractionController`, `Map2DLiteLayer`, etc.).

### Architectural tension

1. **Dual marker refresh paths**  
   - `GlobeSyncService` documents that **`globeEventMarkerManager` is current** and `globeView.refreshEventMarkers` is legacy.  
   - Multiple call sites still use **`globeController.globeView.refreshEventMarkers`** (`EventPanelHelpers`, `features/universal-features/helpers/EventManagerHelpers`, `EventNavigationService`, `EventManager`, etc.).  
   - `ToggleService` explicitly branches: `globeEventMarkerManager` vs `gc.eventMarkerManager`.

2. **Comment vs code mismatch**  
   In `GlobeController.js` (~lines 97–99): comments state **event markers were removed from the globe** and the event system handles them — yet **`syncEventsWithGlobe` still calls `globeView.addEventMarkers()` and `refreshEventMarkers()`**. That is a **maintainability hazard** (future you will “fix” the wrong layer).

3. **Helpers explosion**  
   Globe logic is split across `GlobeView.js`, `GlobeInitHelpers.js`, `GlobeMarkerHelpers.js`, `GlobeTextureHelpers.js`, `GlobeConnectionHelpers.js`, `GlobeBaseHelpers.js`, `GlobeSyncService.js` — **good for file size**, but **boundaries are unclear** (view vs controller vs service).

### Recommendations (later phases)

- Define **one module** responsible for “markers for timeline events on the current surface (globe vs map)” and route all refresh/filter calls through it.  
- Align **comments, `GlobeController`, and `EventPanelHelpers`** with the real behavior.  
- Target folder: proposed **`Interactive-Worldview/`** with `model/`, `view/`, `controller/` (or `controllers/`) subfolders.

---

## Event system — findings

### What works well

- `EventManager` uses **dependency injection style** via `EventManagerServiceHelpers` / `EventManagerConfigHelpers` instead of one monolithic class.

### Problems

1. **Naming collisions / confusion**  
   - **`src/features/universal-features/helpers/EventManagerHelpers.js`** (boot loader) vs similarly named helpers under **`src/features/system-interface/`** — **Phase 8** should rename by capability (`EventSystemBootHelpers`, …).

2. **Wide blast radius**  
   `EventManager`, `EventSlideManager`, `MenuHelpers`, `MenuServiceHelpers`, `FilterService`, and `ComponentOrchestrator` all **touch pagination, slide, filters, or globals**. MVC boundaries blur (UI + domain + persistence hints in one flow).

3. **Legacy data paths**  
   `EventDataService`, `LocationFlagHelpers`, `StoryFilterPlacesSync` carry **migration from legacy fields** (`secondaryCountryFlags`, string arrays, etc.). This is **necessary** but should live behind a **single “EventRecord normalization” model** to avoid scatter.

### Recommendations

- Introduce a **`timeline` or `event-system` feature root** with explicit:  
  - **Model:** normalized event record + load/save adapters  
  - **View:** slide + dock + manage panel  
  - **Controller:** `EventManager` slimmed to orchestration only  
- Rename helpers to **capability names** (`EventSlidePanelBinder`, `EventPaginationController`, …) as files move.

---

## Codex — findings

- `CodexCanvasService.js` is **feature-complete but monolithic** (~6.8k lines), with explicit **legacy DOM**, deprecated prefs, and worker-based JSON parse.  
- **Recommendation:** treat Codex as its own vertical slice (`codex/model`, `codex/view`, `codex/controller`, `codex/persistence`) *after* Interactive-Worldview/event stabilization, unless you want codex-first.

---

## Universal features — findings

- Music, palette, keyboard shortcuts, sound effects span `services/` and `managers/`.  
- **Recommendation:** group under **`universal/`** (or `shell/`) with thin facades; keep **no business rules** for timeline/codex inside them.

---

## Deprecated / legacy signals (non-exhaustive)

Grep highlights worth tracking:

- `CodexCanvasService.js` — `@deprecated` prefs, legacy DOM branches  
- `GlobeMapLaunchChoice.js` — deprecated overlay id  
- `HeroRoleBioPanel.js` — `@deprecated` export  
- `EventDataService.js` / `LocationFlagHelpers.js` / `StoryFilterPlacesSync.js` — **data migration** (not necessarily removable)  
- Dock/panel helpers — **legacy DOM cleanup** (`pagination-dock-top-border`, etc.)

---

## MVC / OOD gap analysis (honest)

| MVC layer | Current state | Gap |
|-----------|---------------|-----|
| **Model** | `DataModel`, `SceneModel`, `TransportModel`; event JSON via `EventDataService` | Event normalization + filter state scattered; globals duplicate “confirmed” vs “draft” filter sets |
| **View** | `GlobeView`, `UIView`, `Map2DLiteLayer`, DOM builders in helpers | Large helpers **build DOM + encode behavior** |
| **Controller** | `GlobeController`, parts of `ComponentOrchestrator`, `EventManager` | **Orchestrator + loader + mode kill** mixed; event/globe sync spread across many files |

**Strict MVC** here means: **stop importing “view helpers” from 20 places**; each feature exposes a **small API** (e.g. `worldviewApi.syncMarkersFromEvents(events)`).

---

## Suggested phase order (for the follow-up work)

**Superseded by the master checklist:** **[`REFACTOR_PHASES.md`](REFACTOR_PHASES.md)** — that file merges this diagnosis (P0–P4, god files, naming, legacy) with **Phases 1–8** and status.

Legacy summary (kept for context): diagnosis frozen → P0/P1 marker sync (done) → worldview folder → event-system folder → codex → rename pass.

---

## Next step

Use this document as the backlog for **Phase 1 implementation**: pick **marker ownership + `syncEventsWithGlobe` truth** as the first concrete change set, then folder moves follow without guessing behavior.

---

## Phase 1 — deeper analysis (globe-first → standalone event system)

### Historical arc (why the confusion exists)

1. **Original product** was essentially **worldview only**: `GlobeController` + `GlobeView` + `UIView`, with timeline/event behavior **owned inside that stack** (pagination, markers, slide UI tied to the globe data model).

2. **Menu + Codex + Archive** required a **shared timeline shell** that works **without** loading WebGL, or **alongside** it, with one dock and one filter model across modes.

3. The solution was **“Event System Load Out”**: a **standalone** package centered on globals such as **`window.standaloneEventSlide`**, **`window.standaloneActiveFilters`**, **`window.eventManager`**, and (when worldview is active) **`window.globeEventMarkerManager`**.

4. **Worldview-specific code was not fully retired**; instead, **parallel paths** were added. Comments were updated (“Globe no longer handles events”) but **not every call site** was migrated. That is the core of Phase 1 pain.

### Two mental models that still coexist

| Aspect | **Legacy / globe-centric** | **Current / standalone-centric** |
|--------|----------------------------|-----------------------------------|
| **WebGL event markers** | Assumed to live on `globeView` (`addEventMarkers`, `refreshEventMarkers`) | Implemented on **`EventMarkerManager`** exposed as **`window.globeEventMarkerManager`** |
| **Slide / panel** | `UIView` “simple” path: toggle `#eventSlide` DOM only | **`EventSlideManager`** + **`standaloneEventSlide`** (full editor, pagination bridge, mobile behavior) |
| **Filters** | Older idea: `sceneModel.activeFilters` (mostly gone) | **`standaloneActiveFilters`** + `FilterService` / `FilterStateManager` |
| **Sync from `EventManager` → map/globe** | Copy into `globeController.dataModel` then refresh markers | Same **data model** copy is still used, but marker refresh must go through **`GlobeSyncService._refreshEventMarkers`** (prefers `globeEventMarkerManager`) |

### Concrete contradictions (verified in code)

1. **`GlobeView` no longer defines `addEventMarkers` / `refreshEventMarkers`**  
   `GlobeView.js` only notes that event marker handling was removed. There are **no** matching method names in that file.

2. **`syncEventsWithGlobe` called removed `globeView` APIs** — **Resolved (Phase 1).** Use **`syncEventsWithGlobeCore`**, **`TimelineMarkerSync`**, and **`REFACTOR_PHASES.md`**.

3. **`GlobeSyncService` fallback to `globeView.refreshEventMarkers`** — **Resolved (Phase 1).** `_refreshEventMarkers` uses **`TimelineMarkerSync`** / **`globeEventMarkerManager`** only.

4. **`GlobeController` is internally consistent for markers**  
   - `_ensureGlobeWorldBuilt` comments: event markers **not** added in globe init.  
   - `setMapViewEnabled`: when returning from map to globe, it calls **`globeEventMarkerManager.addEventMarkers(false)`** — aligns with **`EventMarkerManager`** as the WebGL marker owner.

5. **`ComponentOrchestrator`** (worldview load): if event system is already active, it **constructs `EventMarkerManager`** and calls **`addEventMarkers(true)`** — the **modern** integration point.

6. **`UIView` is a hybrid for map clicks**  
   - File header says event features removed from globe.  
   - **`showEventSlide` / `hideEventSlide`** still implement **two behaviors**: **standalone** (`standaloneEventSlide`) on **mobile portrait**, and **`_showEventSlideSimple`** (DOM panel + image overlay only, **not** `EventSlideManager`) on desktop / landscape — explicitly for **Map2DLiteLayer** marker clicks.  
   So **map marker UX** is **not** the same code path as **dock-driven** `EventSlideManager`, which matches “we bolted standalone on later.”

7. **`Map2DLiteLayer`** reads **`standaloneEventSlide.currentPage`** and **`standaloneActiveFilters`** for DOM markers — correct for the standalone world, but it **cements** globals as the contract between map and event system.

### Why this matters for Phase 1 (not just aesthetics)

- **On-call risk:** Any refactor that “finishes” removing globe-event code might **delete** what still looks redundant but is actually the **only** path some loader uses — or the opposite: leave **duplicate sync** that **throws** when order of operations changes.
- **Cognitive load:** New contributors read “globe doesn’t do events” then find **`syncEventsWithGlobe`**, **`UIView` slide**, **`EventMarkerManager`**, and **`standaloneEventSlide`** and cannot draw a single diagram.
- **OOD/MVC:** There is **no single façade** for “timeline state + markers + slide”; instead, **four entry points** must be updated for one feature.

### Phase 1 goals (refined)

1. **Declare one contract** (documentation + thin API):  
   *“Timeline events for worldview: `DataModel.events` is fed from `EventManager`; WebGL markers are owned by `EventMarkerManager` (`globeEventMarkerManager`); map markers by `Map2DLiteLayer`; slide from dock/archive/codex goes through `standaloneEventSlide` / `EventSlideManager`; map marker click on desktop uses `UIView` simple slide unless unified later.”*

2. **Remove or fix the stale `globeView.addEventMarkers` / `refreshEventMarkers` call sites** so they either call **`GlobeSyncService`-style logic** or **`globeEventMarkerManager`** directly — **no references to non-existent `GlobeView` methods**.

3. **Deduplicate `syncEventsWithGlobe`** — one implementation, one module, used by **`src/features/universal-features/BootUp/LoadingOrchestrator.js`** (and any future loaders).

4. **Defer** folder moves until (1)–(3) are done; otherwise imports shuffle around **broken** semantics.

### Implemented (2026): agnostic marker sync entry point

- **`src/features/system-interface/integration/timelineMarkerSync.js`** defines **`window.TimelineMarkerSync`** with `copyEventsToGlobeDataModel` and `refreshTimelineEventMarkers` (delegates to **`globeEventMarkerManager`** only).
- **`GlobeSyncService`**, **`EventManagerHelpers.syncEventsWithGlobe`**, **`EventPanelHelpers.syncEventsWithGlobe`**, **`EventManager.syncEventsToGlobe` fallback**, **`EventNavigationService`**, **`EventInteractionService`**, and **`AppKeyboardShortcutsService`** no longer call removed **`globeView.addEventMarkers` / `refreshEventMarkers`** APIs.
- **`index.html`** loads `timelineMarkerSync.js` before **`EventInteractionService`** and **`GlobeSyncService`**.
- **`src/features/system-interface/integration/syncEventsWithGlobeCore.js`** — single implementation used by **`EventManagerHelpers.syncEventsWithGlobe`** and **`EventPanelHelpers.syncEventsWithGlobe`** (no duplicated sync logic).
