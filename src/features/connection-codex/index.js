/**
 * Connection Codex — node–edge relationship graph (heroes, factions, NPCs, countries, junctions).
 *
 * Responsibility folders under `codex-*`; thin public entry:
 * `services/CodexCanvasService.js` → `codex-core/codexCanvasHost.js`.
 */

export {
    enterCodexMode,
    applyCodexShell,
    clearCodexShellForGlobeInit
} from './codex-mode/mode-entry/CodexModeService.js';
export { fetchCanonicalCodexJson } from './codex-data/load/CodexJsonRepository.js';
export { parseMigrateAndDedupeCodexSource } from './codex-data/migration/CodexPayloadMigration.js';
export { syncCodexEdgesFromBioArchiveConnections } from './codex-bio-sync/reconcile/CodexBioArchiveEdgeSync.js';
