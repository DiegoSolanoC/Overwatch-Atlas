/**
 * statusFeed — single-line status output for whatever loading surface is
 * currently visible.
 *
 * The app has three potential status surfaces (only one is live at a
 * time): the inline-globe overlay (`#globeInlineOverlayStatusContent`),
 * the main loading overlay (`#overlayStatusContent`), and the dev-only
 * test page (`#statusContent` inside `#testStatus`). Callers don't care
 * which surface is up — they just call `updateStatus(msg, type)` and
 * this picks the right host.
 *
 * The Globe-load progress bar (the fill that sits on top of the overlay
 * during a Worldview boot) lives in its sibling `globeLoadProgress.js`.
 */

/**
 * @param {string} message - Status message (replaces any previous line on the active surface).
 * @param {'info'|'success'|'error'|'warning'} [type='info']
 */
export function updateStatus(message, type = 'info') {
    const inlineStatusHost = document.getElementById('globeInlineOverlayStatusContent');
    if (inlineStatusHost) {
        renderStatusItem(inlineStatusHost, message, type);
        return;
    }

    if (isMainPageWithActiveOverlay()) {
        const overlayContent = document.getElementById('overlayStatusContent');
        if (overlayContent) {
            renderStatusItem(overlayContent, message, type);
        }
        return;
    }

    const statusDiv = document.getElementById('testStatus');
    const statusContent = document.getElementById('statusContent');
    if (statusDiv && statusContent) {
        statusDiv.style.display = 'block';
        renderStatusItem(statusContent, message, type);
    }
}

function renderStatusItem(host, message, type) {
    host.innerHTML = '';
    const item = document.createElement('div');
    item.className = `test-status-item ${type}`;
    item.textContent = message;
    host.appendChild(item);
}

function isMainPageWithActiveOverlay() {
    const pl = (window.location.pathname || '').toLowerCase();
    const isMainPage =
        !pl.includes('test.html') &&
        (pl.endsWith('index.html') ||
            pl.endsWith('main.html') ||
            pl === '/' ||
            (pl.endsWith('/') && !/\.html$/i.test(pl)));
    if (!isMainPage) return false;
    const loadingOverlay = document.getElementById('loadingOverlay');
    return !!(loadingOverlay && loadingOverlay.classList.contains('active'));
}
