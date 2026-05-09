/**
 * Repair: upsert story-archive hero/faction/npc connection rows for every entity↔entity
 * edge in data/codex-labels.json (not only new edges). Idempotent with saveCodexLayout sync.
 *
 * Run: node scripts/sync-all-codex-entity-edges-to-bio-archives.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { syncStoryArchivesFromCodexEdges } = require('./server-bio-codex-sync.js');

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'src', 'data');
const codex = JSON.parse(fs.readFileSync(path.join(dataDir, 'codex-labels.json'), 'utf8'));
const r = syncStoryArchivesFromCodexEdges(dataDir, codex.nodes || [], codex.edges || []);
console.log(JSON.stringify(r, null, 2));
