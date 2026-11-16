/**
 * HTTP access to canonical Codex snapshot (dev `/api/codex` vs static codex JSON).
 */

import {
    isCodexPersistToRepoAvailable,
    resolveCodexRepoApiUrl
} from '../../codex-canvas/bridge/CodexAppBridge.js';
import { FILES } from '../../../../data/registry.js';

/**
 * Stable cache key for static `codex-labels.json`.
 * Bump when the checked-in JSON changes so browsers refresh without Date.now().
 */
export const CODEX_LABELS_CACHE_VERSION = '2026-11-15';

function countCodexNodes(data) {
    if (!data) return 0;
    if (Array.isArray(data)) return data.length;
    if (typeof data !== 'object') return 0;
    if (Array.isArray(data.nodes)) return data.nodes.length;
    if (Array.isArray(data.labels)) return data.labels.length;
    return 0;
}

async function fetchStaticCodexJson() {
    try {
        const r = await fetch(
            `${FILES.connectionCodex.codexLabels}?v=${encodeURIComponent(CODEX_LABELS_CACHE_VERSION)}`,
        );
        if (!r.ok) return { ok: false };
        const data = await r.json();
        return { ok: true, data };
    } catch (_) {
        return { ok: false };
    }
}

async function fetchDevApiCodexJson() {
    if (!isCodexPersistToRepoAvailable()) return { ok: false };
    try {
        // Stable query — rely on server freshness when editing; avoid busting every open.
        const codexGet = resolveCodexRepoApiUrl(
            `api/codex?v=${encodeURIComponent(CODEX_LABELS_CACHE_VERSION)}`,
        );
        const r = await fetch(codexGet);
        if (!r.ok) return { ok: false };
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('json')) return { ok: false };
        const data = await r.json();
        return { ok: true, data };
    } catch (_) {
        return { ok: false };
    }
}

/**
 * Canonical Codex snapshot: prefer API when it has nodes; otherwise static JSON.
 * When the persist API is available, fetch API + static in parallel so an empty
 * or slow API never serializes ahead of the cached static file.
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false }>}
 */
export async function fetchCanonicalCodexJson() {
    const isHttp = typeof window !== 'undefined'
        && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    if (!isHttp) return { ok: false };

    const persist = isCodexPersistToRepoAvailable();

    if (!persist) {
        return fetchStaticCodexJson();
    }

    const [fromApi, fromStatic] = await Promise.all([
        fetchDevApiCodexJson(),
        fetchStaticCodexJson(),
    ]);
    const apiNodeCount = fromApi.ok ? countCodexNodes(fromApi.data) : 0;
    const staticNodeCount = fromStatic.ok ? countCodexNodes(fromStatic.data) : 0;

    if (fromApi.ok && apiNodeCount > 0) {
        return fromApi;
    }

    if (fromStatic.ok && staticNodeCount > 0) {
        if (fromApi.ok && apiNodeCount === 0) {
            console.warn(
                '[Codex] Dev API returned an empty graph; loaded',
                FILES.connectionCodex.codexLabels,
                `(${staticNodeCount} nodes). Restart node src/server.js if GET /api/codex should serve disk.`
            );
        }
        return fromStatic;
    }

    if (fromApi.ok) return fromApi;
    if (fromStatic.ok) return fromStatic;
    return { ok: false };
}
