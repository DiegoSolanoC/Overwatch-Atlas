/**
 * ResizeObserver on the center stage + flex row so passive header badges track
 * panel open/close width animations (not just class toggles at start/end).
 */

/**
 * @param {() => void} schedule — caller should coalesce (e.g. one rAF reposition).
 * @returns {() => void} cleanup
 */
export function attachStageAnchorLayoutWatch(schedule) {
    if (typeof schedule !== 'function') {
        return () => {};
    }

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => schedule());
        const content = document.getElementById('content');
        const layout = document.querySelector('.layout-container');
        if (content) ro.observe(content);
        if (layout) ro.observe(layout);
    }

    return () => {
        if (ro) {
            try {
                ro.disconnect();
            } catch (_) {}
            ro = null;
        }
    };
}
