/**
 * Copy / drag support for hero biography portrait images.
 */

/**
 * @param {HTMLImageElement} img
 * @param {AbortSignal} [signal]
 */
export function wireHeroBiographyPortraitCopy(img, signal) {
    if (!img) return;

    img.draggable = true;
    img.setAttribute('draggable', 'true');
    img.setAttribute('tabindex', '0');
    img.title = 'Drag or right-click to copy. Use the Copy button or press Ctrl+C while focused.';

    const onDragStart = (e) => {
        if (!img.src) return;
        const dt = e.dataTransfer;
        if (!dt) return;
        dt.effectAllowed = 'copy';
        dt.setData('text/uri-list', img.currentSrc || img.src);
        dt.setData('text/plain', img.currentSrc || img.src);
        if (img.complete && img.naturalWidth > 0) {
            try {
                dt.setDragImage(img, img.naturalWidth / 2, img.naturalHeight / 2);
            } catch (_) { /* ignore */ }
        }
    };

    const onKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            void copyHeroBiographyPortraitImage(img);
        }
    };

    img.addEventListener('dragstart', onDragStart, { signal });
    img.addEventListener('keydown', onKeyDown, { signal });
}

/**
 * @param {HTMLImageElement} img
 * @returns {Promise<boolean>} True when an image was written to the clipboard.
 */
export async function copyHeroBiographyPortraitImage(img) {
    if (!img?.src) return false;

    const src = img.currentSrc || img.src;
    try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            const type = blob.type || 'image/png';
            await navigator.clipboard.write([new ClipboardItem({ [type]: blob })]);
            return true;
        }
    } catch (err) {
        console.warn('[hero-biography] Portrait clipboard copy failed:', err);
    }

    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(src);
        }
    } catch (_) { /* ignore */ }

    return false;
}
