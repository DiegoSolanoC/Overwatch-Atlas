/**
 * Modal confirmation before opening external URLs (matches filters Confirm / action button styling).
 */

let overlayEl = null;

function ensureOverlay() {
    if (overlayEl) return overlayEl;
    const root = document.createElement('div');
    root.id = 'externalLinkConfirmOverlay';
    root.className = 'external-link-confirm-overlay';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML = `
        <div class="external-link-confirm-dialog">
            <h3 class="external-link-confirm-title" id="externalLinkConfirmTitle"></h3>
            <p class="external-link-confirm-body" id="externalLinkConfirmBody"></p>
            <div class="external-link-confirm-url-wrap">
                <span class="external-link-confirm-url" id="externalLinkConfirmUrl"></span>
            </div>
            <div class="external-link-confirm-actions">
                <button type="button" class="filters-action-btn" id="externalLinkConfirmCancel">Cancel</button>
                <button type="button" class="filters-action-btn filters-confirm-btn" id="externalLinkConfirmOk">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(root);
    overlayEl = root;
    return root;
}

function closeOverlay(root, resolve, value) {
    root.classList.remove('is-open');
    document.body.classList.remove('external-link-confirm-open');
    if (resolve) resolve(value);
}

/**
 * @param {string} url
 * @param {{ title?: string, body?: string }} [options]
 * @returns {Promise<boolean>} true if user confirmed
 */
export function confirmOpenExternalUrl(url, options = {}) {
    return new Promise((resolve) => {
        const root = ensureOverlay();
        const titleEl = root.querySelector('#externalLinkConfirmTitle');
        const bodyEl = root.querySelector('#externalLinkConfirmBody');
        const urlEl = root.querySelector('#externalLinkConfirmUrl');
        const cancelBtn = root.querySelector('#externalLinkConfirmCancel');
        const okBtn = root.querySelector('#externalLinkConfirmOk');

        titleEl.textContent = options.title || 'Open external link?';
        bodyEl.textContent =
            options.body || 'You are about to open the following address in a new tab.';
        urlEl.textContent = url || '';

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup();
                closeOverlay(root, resolve, false);
            }
        };

        const cleanup = () => {
            cancelBtn.removeEventListener('click', onCancel);
            okBtn.removeEventListener('click', onOk);
            root.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKey);
        };

        const onCancel = () => {
            cleanup();
            closeOverlay(root, resolve, false);
        };

        const onOk = () => {
            cleanup();
            closeOverlay(root, resolve, true);
        };

        const onBackdrop = (e) => {
            if (e.target === root) onCancel();
        };

        cancelBtn.addEventListener('click', onCancel);
        okBtn.addEventListener('click', onOk);
        root.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKey);

        root.classList.add('is-open');
        document.body.classList.add('external-link-confirm-open');
        okBtn.focus();
    });
}

/**
 * @param {string} url
 * @param {{ title?: string, body?: string }} [options]
 */
export async function openExternalUrlAfterConfirm(url, options) {
    if (!url) return;
    const ok = await confirmOpenExternalUrl(url, options);
    if (ok) window.open(url, '_blank', 'noopener,noreferrer');
}
