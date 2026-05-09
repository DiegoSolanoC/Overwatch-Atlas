/**
 * Saved layout versioning and board geometry shared by Codex persistence and migration.
 */
export const CODEX_STORAGE_KEY = 'timelineCodexLabels';

/** Persisted layout format (4 = junction nodes, straight cords only; older saves are cleared or migrated on load). */
export const CODEX_SAVE_VERSION = 4;

/** First save format with junction nodes only; anything below loads empty (legacy edge-break layouts dropped). */
export const CODEX_JUNCTION_LAYOUT_MIN_VERSION = 4;

/** Large scrollable Codex board (world pixel space). */
export const CODEX_WORLD_W = 16384;
export const CODEX_WORLD_H = 12288;

/** Previous board size — saves older than {@link CODEX_SAVE_VERSION} path may be shifted into the larger world. */
export const CODEX_LEGACY_WORLD_W = 8192;
export const CODEX_LEGACY_WORLD_H = 6144;

export const CODEX_WORLD_EXPAND_SHIFT_X = (CODEX_WORLD_W - CODEX_LEGACY_WORLD_W) / 2;
export const CODEX_WORLD_EXPAND_SHIFT_Y = (CODEX_WORLD_H - CODEX_LEGACY_WORLD_H) / 2;
