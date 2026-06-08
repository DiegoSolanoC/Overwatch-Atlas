/**
 * Gallery mode — Save / Export / Import for the active bio archive category.
 * Buttons are mounted in the Intel and Connections panel toolbars.
 */

import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import { clearBioArchiveEventsCache } from './heroBiographyArchiveData.js';
import { setBioBiographyArchiveDescription } from './heroBiographyArchiveDescription.js';
import { getActiveHeroBiographySelection } from './heroBiographySelection.js';

/** @type {(() => import('./bioBiographyCategories.js').BioBiographyArchiveCategory) | null} */
let readActiveCategory = null;

/** @type {((category: import('./bioBiographyCategories.js').BioBiographyArchiveCategory) => Promise<void>) | null} */
let refreshCategoryChips = null;

/** @type {HTMLInputElement | null} */
let sharedImportFileInput = null;

/**
 * @param {{
 *   getActiveCategory: () => import('./bioBiographyCategories.js').BioBiographyArchiveCategory,
 *   refreshCategoryChips?: (category: import('./bioBiographyCategories.js').BioBiographyArchiveCategory) => Promise<void>,
 * }} hooks
 */
export function configureHeroBiographyArchiveIoBar(hooks) {
    if (hooks.getActiveCategory) {
        readActiveCategory = hooks.getActiveCategory;
    }
    if (hooks.refreshCategoryChips) {
        refreshCategoryChips = hooks.refreshCategoryChips;
    }
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
async function ensureEventManagerArchive(category) {
    const em = window.eventManager;
    if (!em?.dataService) {
        throw new Error('Event system not ready');
    }
    const cat = normalizeBioBiographyCategory(category);
    if (em.dataService.getArchiveSource?.() !== cat) {
        await em.switchStoryArchiveSource?.(cat);
    }
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
async function refreshGalleryAfterArchiveChange(category) {
    const cat = normalizeBioBiographyCategory(category);
    clearBioArchiveEventsCache(cat);
    window.FilterService?.invalidateBioArchiveFilterLayouts?.();
    window.dispatchEvent(
        new CustomEvent('atlas-bio-archives-refreshed', {
            detail: { archives: [cat] },
        }),
    );
    if (refreshCategoryChips) {
        await refreshCategoryChips(cat);
    }
    const sel = getActiveHeroBiographySelection();
    if (sel?.filterKey && sel.category === cat) {
        await setBioBiographyArchiveDescription(cat, sel.filterKey, '');
    }
}

/**
 * @param {HTMLElement} hostEl
 */
function ensureSharedImportFileInput(hostEl) {
    if (sharedImportFileInput) return sharedImportFileInput;

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'galleryArchiveImportFile';
    fileInput.accept = 'application/json,.json';
    fileInput.setAttribute('aria-hidden', 'true');
    fileInput.tabIndex = -1;
    fileInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none;';
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const category = readActiveCategory?.() || 'heroes';
        const cat = normalizeBioBiographyCategory(category);
        try {
            await ensureEventManagerArchive(category);
            const ds = window.eventManager?.dataService;
            if (!ds?.importEvents) throw new Error('Import unavailable');
            const result = await ds.importEvents(file);
            await refreshGalleryAfterArchiveChange(category);
            window.updateAppStatus?.(
                `Imported ${result.count} ${cat} entries. Export JSON to share your changes.`,
                'success',
            );
        } catch (err) {
            console.warn('[gallery] Archive import failed:', err);
            window.updateAppStatus?.(`Import failed: ${err?.message || err}`, 'error');
        }
    });

    hostEl.appendChild(fileInput);
    sharedImportFileInput = fileInput;
    return fileInput;
}

/**
 * @param {HTMLElement} hostEl
 * @returns {{ saveArchiveBtn: HTMLButtonElement, exportBtn: HTMLButtonElement, importBtn: HTMLButtonElement }}
 */
export function createGalleryArchiveIoButtonGroup(hostEl) {
    ensureSharedImportFileInput(hostEl);

    const saveArchiveBtn = document.createElement('button');
    saveArchiveBtn.type = 'button';
    saveArchiveBtn.className =
        'gallery-mode__archive-description-btn gallery-mode__archive-description-btn--save-archive';
    saveArchiveBtn.textContent = 'Save file';
    saveArchiveBtn.title = 'Write this archive category JSON to disk (dev server)';
    saveArchiveBtn.addEventListener('click', async () => {
        const category = readActiveCategory?.() || 'heroes';
        try {
            await ensureEventManagerArchive(category);
            window.eventManager?.saveEvents?.();
            await refreshGalleryAfterArchiveChange(category);
            window.SoundEffectsManager?.play?.('save');
            window.updateAppStatus?.(
                `${normalizeBioBiographyCategory(category)} archive saved in this browser.`,
                'success',
            );
        } catch (err) {
            console.warn('[gallery] Archive save failed:', err);
            window.updateAppStatus?.('Could not save archive.', 'error');
        }
    });

    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className =
        'gallery-mode__archive-description-btn gallery-mode__archive-description-btn--export';
    exportBtn.textContent = 'Export';
    exportBtn.title = 'Download this archive category as JSON';
    exportBtn.addEventListener('click', async () => {
        const category = readActiveCategory?.() || 'heroes';
        try {
            await ensureEventManagerArchive(category);
            window.eventManager?.exportEvents?.();
        } catch (err) {
            console.warn('[gallery] Archive export failed:', err);
            window.updateAppStatus?.('Could not export archive.', 'error');
        }
    });

    const importBtn = document.createElement('button');
    importBtn.type = 'button';
    importBtn.className =
        'gallery-mode__archive-description-btn gallery-mode__archive-description-btn--import';
    importBtn.textContent = 'Import';
    importBtn.title = 'Load archive JSON for this category';
    importBtn.addEventListener('click', () => {
        sharedImportFileInput?.click();
    });

    return { saveArchiveBtn, exportBtn, importBtn };
}

export function destroyGalleryArchiveIoControls() {
    sharedImportFileInput?.remove();
    sharedImportFileInput = null;
    readActiveCategory = null;
    refreshCategoryChips = null;
}
