/**
 * HTTP access to canonical Codex snapshot (dev `/api/codex` vs static `src/data/codex-labels.json`).
 */

import {
    isCodexPersistToRepoAvailable,
    resolveCodexRepoApiUrl
} from '../../codex-canvas/bridge/CodexAppBridge.js';

/**
 * Canonical Codex snapshot: try `/api/codex` on the Node dev server, then always try static `src/data/codex-labels.json`.
 * @returns {Promise<{ ok: true, data: unknown } | { ok: false }>}
 */
export async function fetchCanonicalCodexJson() {
    const isHttp = typeof window !== 'undefined'
        && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    if (!isHttp) return { ok: false };

    if (isCodexPersistToRepoAvailable()) {
        try {
            const codexGet = resolveCodexRepoApiUrl(`api/codex?v=${Date.now()}`);
            const r = await fetch(codexGet);
            if (r.ok) {
                const ct = r.headers.get('content-type') || '';
                if (ct.includes('json')) {
                    const data = await r.json();
                    return { ok: true, data };
                }
            }
        } catch (_) {
            /* ignore */
        }
    }

    try {
        const r = await fetch(`src/data/codex-labels.json?v=${Date.now()}`);
        if (r.ok) {
            const data = await r.json();
            return { ok: true, data };
        }
    } catch (_) {
        /* ignore */
    }
    return { ok: false };
}
