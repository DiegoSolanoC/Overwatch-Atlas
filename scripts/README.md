# Scripts

Node helpers for local dev, GitHub Pages builds, and occasional data / codex maintenance.

Paths for JSON files: use **`data-paths.cjs`** (wraps `src/data/registry.cjs`).

## Core (wired into npm / server)

| Script | npm / usage |
|--------|-------------|
| `generate-manifest.js` | `npm run generate`, `npm start`, `npm run build:pages` — builds `src/data/platform/manifest.json` from assets |
| `prepare-github-pages.mjs` | `npm run build:pages` — copies site to `_site/`, injects static meta, validates codex v5 |
| `server-bio-codex-sync.js` | Legacy dev-server helper (archive `connections[]` sync); connection metadata now lives in `codex-labels.json` `connections[]` |

## Generators & content tools

| Script | When to run |
|--------|-------------|
| `build-flags-lookup.mjs` | `npm run flags:lookup` — regenerates `flagFileByCommonName.js` from `flags-index.json` after adding flag PNGs |
| `build-earth-lights-hubs.cjs` | `node scripts/build-earth-lights-hubs.cjs` — rebuild `worldview/earth-lights-hubs.json` when hub rules change |
| `create-event.cjs` | `node scripts/create-event.cjs` — interactive helper to append timeline events |
| `scrape-wiki-interactions.mjs` | `node scripts/scrape-wiki-interactions.mjs "<wiki Quotes URL>"` — download Interactions voice lines from Overwatch Fandom into `~/Escritorio/interactions` for manual review |
| `scrape-all-wiki-interactions.mjs` | `npm run scrape:interactions:all` — scrape every manifest hero's `{Hero}/Quotes` page (skips heroes already scraped unless `--force`) |
| `import-interaction-folder.mjs` | `node scripts/import-interaction-folder.mjs "<scraped batch folder>"` — copy voicelines into theater assets and append Dialogue Theater conversations |
| `import-all-interaction-batches.mjs` | `npm run import:interactions:all` — import every hero folder under `~/Escritorio/interactions`, skipping duplicate names and voiceline sets |
| `audit-dialogue-duplicate-conversations.mjs` | `npm run audit:dialogue-duplicates` — list conversations in `conversations.json` that share the same voiceline fingerprint |
| `cleanup-dialogue-theater.mjs` | `npm run cleanup:dialogue-theater` — remove duplicate conversations, copy missing scraped voicelines, backfill line audio, refresh manifest |
| `repair-dialogue-paths-from-wiki.mjs` | `npm run repair:dialogue-paths` — re-parse wiki `(with X on the team)` / variant routes and apply variation paths to matching conversations |

## Codex / archive repair

| Script | When to run |
|--------|-------------|
| `sync-all-codex-entity-edges-to-bio-archives.mjs` | Batch upsert archive rows for all Codex entity↔entity edges |
| `prune-empty-non-codex-adjacent-bio-connections.mjs` | Remove empty bio connection rows not adjacent in Codex graph |

## Refactor helper

| Script | When to run |
|--------|-------------|
| `extract-class-methods.mjs` | `node scripts/extract-class-methods.mjs <source.js> <outMixin.js> method1 …` — split class methods into a mixin file |

## Shared module

- **`data-paths.cjs`** — absolute paths to `src/data/*` for any script above that reads/writes JSON.
