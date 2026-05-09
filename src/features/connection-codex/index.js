/**
 * Connection Codex (graph canvas): mode shell + canvas bundle; most runtime entry points use `window.*`.
 * Domain and infrastructure modules are safe to import from tooling or future tests.
 */
export {
    enterCodexMode,
    applyCodexShell,
    clearCodexShellForGlobeInit
} from './application/CodexModeService.js';
export { fetchCanonicalCodexJson } from './infrastructure/CodexJsonRepository.js';
export { parseMigrateAndDedupeCodexSource } from './domain/CodexPayloadMigration.js';