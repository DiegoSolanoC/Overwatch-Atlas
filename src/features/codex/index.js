/**
 * Connection Codex — node–edge relationship graph (heroes, factions, NPCs, countries, junctions).
 *
 * Area folders: codex-canvas, codex-nodes, codex-node-drawing, codex-edge-cords,
 * codex-controls-ui, codex-data, codex-bio-archive-sync.
 */

export {
    enterCodexMode,
    applyCodexShell,
    clearCodexShellForGlobeInit
} from './codex-canvas/mode/mode-entry/CodexModeService.js';
export { fetchCanonicalCodexJson } from './codex-data/load/CodexJsonRepository.js';
export { parseMigrateAndDedupeCodexSource } from './codex-data/migration/CodexPayloadMigration.js';
export { syncCodexEdgesFromBioArchiveConnections } from './codex-bio-archive-sync/reconcile/CodexBioArchiveEdgeSync.js';
