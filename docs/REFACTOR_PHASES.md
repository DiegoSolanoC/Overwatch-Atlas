# Refactor phases — master plan

This document is the **phase plan** for maintenance and restructuring. It merges the **codebase diagnosis** (priorities P0–P4, hotspots) with **execution order**.

**Rule:** Smoke-test **one pillar at a time** before cutting over to the next.

---

## Plan revision — 2026-05-07

We **prioritize three large UI surfaces next** — each recent, each with **god-class** pressure — then a **whole-`src/` hygiene pass**:

1. **Codex** vertical restructure  
2. **Archive** (Data Archive / hub flows) vertical restructure  
3. **Main menu** refactor (hub + loader glue)  

After those, **`src/` cleanup**: empty directories, orphaned/straggler files, import verification.

Further work (worldview dedupe vs legacy paths, universal shell, renames, etc.) is **backlog**: you decide when to schedule it.

`src/features/Interactive-Worldview/`, `src/features/system-interface/`, and **`src/features/connection-codex/`** (canvas + mode) remain **anchors** we carve out; nothing in this revision removes them.

---

## Current execution checklist (order)

| Step | Goal | Rough scope | Expected effort |
|:----:|------|-------------|-----------------|
| **A** | **Codex** vertical slice | `src/features/connection-codex/` (`CodexCanvasService.js` ~7k LOC still), `ComponentOrchestrator` bridges; internal splits later | Large — plan internal splits |
| **B** | **Archive** vertical slice | Data Archive hub, biography/story-archive wiring, overlaps with orchestrator/menu | Large |
| **C** | **Main menu** | Canonical **`src/features/main-menu/`**; shared loader DOM/button helpers import **`src/features/universal-features/helpers/`** | Large |
| **D** | **`src/` sweep** | Remove empty dirs, delete/move stragglers, fix broken imports left from moves; optionally document “allowed” legacy islands | Moderate |

**Backlog (you choose sequencing):**

- Mechanical **worldview** dedupe: single canonical imports (legacy parallel trees like old ~~`src/views/`~~ removed; see `features/Interactive-Worldview/presentation/views/`)  
- **Universal / shell** — palette, music/SFX, keyboard shortcuts (thin `window` surface over time)  
- **Naming pass** — capability-based names (`EventManagerHelpers` vs boot vs panel helpers, etc.)

### Phase D — straggler folder audit (rest of `src/`)

**Why most of `src/` never moved into `features/` during A–C**

- **Scope:** Phases A–C only carved **Connection Codex**, **Data Archive**, and **main menu** into `src/features/*`. The rest waited for a deliberate sweep.
- **Boot & script order:** **`src/features/universal-features/BootUp/LoadingOrchestrator.js`** and **`AppInitializer.js`** are loaded from **`index.html`**; other classic scripts still anchor load order.
- **Cross-cutting code:** Music, filters, markers, loaders, keyboard shortcuts, and globals are **shared** across modes. Loader glue lives under **`src/features/universal-features/helpers/`**.
- **Compatibility:** `window.*` glue remains where needed; **`src/app/`** was removed after cutover.

**Suggested review order (go one folder at a time)**

| Order | Folder | ~Files | What to decide |
|------:|--------|-------:|----------------|
| 1 | ~~`src/helpers/`~~ | ~~1~~ → **`scripts/create-event.cjs`** | **Done:** Node CLI (not browser code); reads/writes **`src/data/locations.json`** and related paths from repo root. |
| 2 | ~~`src/views/`~~ | ~~2~~ | **Done:** `UIView.js` + `TransportView.js` → **`src/features/Interactive-Worldview/presentation/views/`** (with `GlobeView`); `GlobeController` imports `../views/…`. Removed top-level `src/views/`. |
| 3 | ~~`src/data/`~~ | ~~1~~ | **Done:** `flagFileByCommonName.js` → **`src/features/Interactive-Worldview/data/`** (globe flag lookup); `index.html` / `scripts/build-flags-lookup.mjs` and tooling paths updated. |
| 4 | ~~`src/app/`~~ | — | **Done:** **`src/features/universal-features/`** — `BootUp/LoadingOrchestrator.js`, `BootUp/AppInitializer.js`, **`ComponentSetUp/`** (loader glue + cross-mode primitives). HTML points at `src/features/universal-features/BootUp/…`. **`GlobeInlineLoadHelpers`** moved to `Interactive-Worldview/services/`. |
| 5 | ~~`src/managers/`~~ | **0** | **Done:** No top-level **`src/managers/`** — shell managers live under **`src/features/universal-features/managers/`**; marker/navigation/pagination helpers under **`src/features/system-interface/managers/helpers/`** (**`loadBrowserNavigationHelpers.js`** side-imported from **`LoadingOrchestrator.js`**). |
| 6 | `src/services/` | ~71 | Batch by domain (music, filters, markers, component loading, …) → feature or **`src/infrastructure/`**-style island |
| 7 | `src/utils/` | ~22 | Pure shared helpers vs feature-specific; relocate or namespace |

`src/features/` is the **reference tree** for vertical slices; this pass cleans everything that still sits beside it.

---

## Foundation already delivered (unchanged facts)

| Area | Status |
|------|--------|
| **Timeline ↔ globe markers** | **Done:** `globeEventMarkerManager` + `TimelineMarkerSync`; see [`TIMELINE_WORLDVIEW_CONTRACT.md`](TIMELINE_WORLDVIEW_CONTRACT.md) |
| **Integration helpers** | Live under **`src/features/system-interface/integration/`** (`timelineMarkerSync.js`, `syncEventsWithGlobeCore.js`) |
| **System interface** | **Canonical:** `src/features/system-interface/` (dock / slide / Event* services stack); duplicated Event-era files under **`src/services` / `src/utils`** were trimmed over time; former **`src/managers/`** code now lives only under **`features/system-interface/managers/helpers`** and **`features/universal-features/managers`**. |
| **Worldview** | **`src/features/Interactive-Worldview/`** is the feature home; consolidation with leftover legacy folders is **backlog**, not prerequisite for Steps A–C |
| **Codex** | **`src/features/connection-codex/`** — canvas + mode shell (`CodexCanvasService`, `CodexModeService`); still one large module until internal split |

---

## Baseline diagnosis (why we phase)

**Overall:** The app has a **partial MVC spine**, but **`window.*`** coupling and **very large modules** dominate risk. Vertical slices (`features/`) avoid one unmaintainable mega-move.

### Priority findings → how this plan touches them

| ID | Finding | Meaning | Where addressed |
|----|---------|---------|-----------------|
| **P0** | Dual marker truths (old `globeView` assumptions) | One ownership story for WebGL/map markers | **Foundation** row above |
| **P1** | Duplication / heavy globals | Narrow surface over time | Steps A–C split god files; backlog shell |
| **P2** | God files (`CodexCanvas`, menus, orchestrator…) | Vertical split by feature | **Steps A–C** |
| **P3** | Generic `*Helpers` names | Rename by capability | After slices stabilize or backlog |
| **P4** | Legacy Codex DOM, migrations | Isolate; do not mass-delete | **Step A**, parts of **B/C** |

---

## Size hotspots (reference)

Approximate lines (comments included). Sizes drift — re-measure anytime.

| Lines | File |
|------:|------|
| ~6846 | `src/features/connection-codex/services/CodexCanvasService.js` |
| ~5365 | `src/features/main-menu/MenuHelpers.js` |
| ~3770 | `src/features/main-menu/MenuServiceHelpers.js` |
| ~2240 | `src/features/system-interface/presentation/slide/EventSlideManager.js` |
| ~1695 | `src/features/universal-features/managers/ComponentOrchestrator.js` |

*Example re-count (PowerShell):*  
`Get-ChildItem src -Recurse -Filter *.js \| ForEach-Object { ... Measure-Object Line }`

---

## References

- Product & modes: [`DESIGN.md`](DESIGN.md)  
- Narrative diagnosis: [`CODEBASE_DIAGNOSIS.md`](CODEBASE_DIAGNOSIS.md)  
- Timeline ↔ map/globe: [`TIMELINE_WORLDVIEW_CONTRACT.md`](TIMELINE_WORLDVIEW_CONTRACT.md)  
- README pointer: [`README.md`](../README.md)
