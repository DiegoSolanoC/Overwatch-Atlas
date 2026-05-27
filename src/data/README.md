# Data layout

JSON is grouped by **feature** (aligned with `src/features/`). Paths are defined once in **`registry.js`** (browser) and **`registry.cjs`** (Node server / scripts).

| Folder | Files | Used by |
|--------|--------|---------|
| `event-system/` | `timeline-events.json` | Story timeline / Event Manager “story” bucket (was `events.json`) |
| `story-archive/` | `heroes.json`, `factions.json`, `npcs.json`, `locations.json` | Data Archive satellite lists (was `story-archive-*.json`) |
| `connection-codex/` | `codex-labels.json`, `connections.json` | Connection Codex graph + transport links |
| `worldview/` | `locations.json`, `location-display-names.json`, `earth-lights-hubs.json` | Globe / map geography & night lights |
| `platform/` | `manifest.json` | Filter icons, music catalog (`npm run build:pages` regenerates) |

**Archive source IDs** in code stay `story` | `heroes` | `factions` | `npcs` | `locations` — only file paths changed. `story` → `event-system/timeline-events.json`.

Import paths in app code:

```js
import { FILES, ARCHIVE_FILE_PATHS } from '../../../data/registry.js';
```
