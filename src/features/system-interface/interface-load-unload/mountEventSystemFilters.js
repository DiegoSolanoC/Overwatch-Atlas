/**
 * Wire the standalone filter Clear button (Confirm retired — chips apply live).
 *
 * Operates on `window.standaloneActiveFilters` via `applyStandaloneFiltersLive`.
 * `window._menuHelpersFilterHandlersInstalled` is set so FilterService skips
 * re-binding legacy globe-mode handlers on top.
 */

import { updateStatus } from '../../universal-features/atlas-mode-runtime/statusFeed.js';
import { clearGalleryFilterSelectionIfOpen } from '../../gallery/gallery-mode/galleryFiltersBridge.js';
import { applyStandaloneFiltersLive } from './applyStandaloneFiltersLive.js?v=2';

/**
 * Replace `#clearFiltersBtn` with a cloned copy wired for live clear.
 * Idempotent: subsequent calls re-clone and rebind from scratch.
 */
export function wireStandaloneFilterButtons() {
    window._menuHelpersFilterHandlersInstalled = true;

    /* Confirm is retired — hide any leftover markup from cached shells. */
    const confirmFiltersBtn = document.getElementById('confirmFiltersBtn');
    if (confirmFiltersBtn) {
        confirmFiltersBtn.hidden = true;
        confirmFiltersBtn.setAttribute('aria-hidden', 'true');
        confirmFiltersBtn.style.display = 'none';
    }

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) {
        const newClearBtn = clearFiltersBtn.cloneNode(true);
        clearFiltersBtn.parentNode.replaceChild(newClearBtn, clearFiltersBtn);
        newClearBtn.addEventListener('click', () => {
            window.standaloneActiveFilters?.clear();
            if (window.FilterService?.stateManager) {
                window.FilterService.stateManager.clear();
            }
            clearGalleryFilterSelectionIfOpen();
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('filterClear');
            }
            /* Codex/globe first — chip grid restyle can wait a frame. */
            applyStandaloneFiltersLive({ immediate: true });
            const paintChipChrome = () => {
                if (window.FilterService?.updateButtonStates) {
                    window.FilterService.updateButtonStates();
                }
                if (window.FilterService?.updateFilterCounts) {
                    window.FilterService.updateFilterCounts();
                }
            };
            if (typeof requestAnimationFrame === 'function') {
                requestAnimationFrame(paintChipChrome);
            } else {
                paintChipChrome();
            }
            updateStatus('Filters cleared', 'success');
        });
    }
}
