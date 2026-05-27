/**
 * HTTP access to canonical Codex snapshot (dev `/api/codex` vs static connection-codex JSON).
 */

import {
    isCodexPersistToRepoAvailable,
    resolveCodexRepoApiUrl
} from '../../codex-canvas/bridge/CodexAppBridge.js';
import { FILES } from '../../../../data/registry.js';

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
        const r = await fetch(`${FILES.connectionCodex.codexLabels}?v=${Date.now()}`);
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
        const codexGet = resolveCodexRepoApiUrl(`api/codex?v=${Date.now()}`);
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
 * Canonical Codex snapshot: dev API when it returns nodes; otherwise static JSON on disk.
 * If the API responds 200 with an empty graph (e.g. server not restarted after a data path move),
 * fall back to `src/data/connection-codex/codex-labels.json` instead of wiping the board.
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false }>}
 */
export async function fetchCanonicalCodexJson() {
    const isHttp = typeof window !== 'undefined'
        && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    if (!isHttp) return { ok: false };

    const fromApi = await fetchDevApiCodexJson();
    const apiNodeCount = fromApi.ok ? countCodexNodes(fromApi.data) : 0;

    if (fromApi.ok && apiNodeCount > 0) {
        return fromApi;
    }

    const fromStatic = await fetchStaticCodexJson();
    const staticNodeCount = fromStatic.ok ? countCodexNodes(fromStatic.data) : 0;

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
