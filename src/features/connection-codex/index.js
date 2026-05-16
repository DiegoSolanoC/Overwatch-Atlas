/**
 * Connection Codex — node–edge relationship graph (heroes, factions, NPCs, countries, junctions).
 *
 * Responsibility folders (see each top-level `codex-*` tree). Monolith until sliced:
 * `services/CodexCanvasService.js`.
 */

export {
    enterCodexMode,
    applyCodexShell,
    clearCodexShellForGlobeInit
} from './codex-mode/mode-entry/CodexModeService.js';
export { fetchCanonicalCodexJson } from './codex-data/load/CodexJsonRepository.js';
export { parseMigrateAndDedupeCodexSource } from './codex-data/migration/CodexPayloadMigration.js';
