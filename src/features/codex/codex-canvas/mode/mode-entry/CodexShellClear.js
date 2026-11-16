/**
 * DOM-only Codex shell teardown — no canvas / edge / node graph imports.
 * Worldview boot uses this so Codex JS stays out of the globe load path.
 */

const CODEX_ROOT_ID = 'codex-view-root';

/**
 * Clears container markup and Codex mode classes. Safe when Codex never mounted.
 * @param {HTMLElement|null} [container]
 */
export function clearCodexShellDom(container) {
    const el = container || document.getElementById('globe-container');
    if (!el) return;
    el.innerHTML = '';
    document.body.classList.remove('codex-mode-active');
    el.classList.remove('codex-mode');
}

/**
 * Prefer live canvas destroy when Codex was opened this session; always clear DOM.
 * @param {HTMLElement|null} [container]
 */
export function clearCodexShellForGlobeInit(container) {
    try {
        window.CodexCanvasService?.destroyCodexCanvas?.();
    } catch (_) {
        /* ignore */
    }
    clearCodexShellDom(container);
}

export { CODEX_ROOT_ID };
