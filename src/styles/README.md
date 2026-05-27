# Styles layout

Entry points (linked from `index.html`):

- `app.css` — main application manifest
- `entry.css` — boot overlay, main menu, zoom controls (`entry/` partials)

## Folders (mirrors `src/features` where practical)

| Folder | Responsibility |
|--------|----------------|
| `foundation/` | Variables, reset, animations, scrollbar utilities |
| `shell/` | Header, footer, main layout |
| `features/worldview/` | Globe stage, WebGL chrome, map 2D lite |
| `features/connection-codex/` | Codex canvas, edges, toolbar, nodes |
| `features/event-system/` | Events list, pagination dock/float, panels |
| `features/story/` | Story viewer, hero |
| `features/music/` | Music panel |
| `ui/` | Shared modals, external-link confirm |
| `themes/` | Palette overrides |
| `mobile/` | Viewport-specific overrides (via `mobile.css`) |

Large files are split into partials with thin aggregators (e.g. `globe.css`, `codex.css`, `event-pagination.css`, `event-slide.css`).

Optional local tweaks: `custom-override.css` (not imported by default).
