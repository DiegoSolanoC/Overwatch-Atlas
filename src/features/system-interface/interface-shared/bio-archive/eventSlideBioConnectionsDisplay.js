/**
 * Event-slide Connections pane — Gallery-style List / Canvas toggle for bio archives
 * (Codex peeks + Workshop). Reuses gallery connection canvas + shared list HTML.
 */

import { createGalleryConnectionCanvas } from '../../../gallery/gallery-mode/galleryConnectionCanvas.js';
import { listDisplayableConnectionEntities } from '../../../gallery/gallery-mode/galleryConnectionCanvasModel.js';
import { refreshGalleryConnectionPortraitLooks } from '../../../gallery/gallery-mode/heroBiographyConnectionPortraitLooks.js';
import { saveBioArchiveConnectionCanvasFromGallery } from '../../../gallery/gallery-mode/heroBiographyArchivePersist.js';

/** @type {'list'|'canvas'} */
let viewMode = 'list';
/** @type {ReturnType<typeof createGalleryConnectionCanvas>|null} */
let canvasController = null;
/** @type {object|null} */
let currentEntry = null;
/** @type {string} */
let currentArch = 'heroes';
/** @type {string} */
let currentDisplayName = '';
/** @type {string} */
let currentFilterKey = '';

/**
 * @returns {boolean}
 */
function canEditConnections() {
    return document.documentElement.classList.contains('is-local-dev');
}

/**
 * @param {object|null|undefined} ev
 * @param {string} arch
 * @param {string} displayName
 * @returns {string}
 */
function resolveFilterKey(ev, arch, displayName) {
    const fromEntry = String(
        ev?.filterKey
        || ev?.heroName
        || ev?.npcName
        || ev?.factionFilename
        || '',
    ).trim();
    if (fromEntry) return fromEntry;
    return String(displayName || '').trim();
}

/**
 * Ensure List/Canvas chrome exists under #eventBioConnectionsSection.
 * @returns {{
 *   section: HTMLElement,
 *   listHost: HTMLElement,
 *   listWrap: HTMLElement,
 *   canvasMount: HTMLElement,
 *   emptyEl: HTMLElement,
 * } | null}
 */
function ensureShell() {
    const section = document.getElementById('eventBioConnectionsSection');
    if (!(section instanceof HTMLElement)) return null;

    let viewRoot = section.querySelector('[data-event-slide-conn-view]');
    if (!(viewRoot instanceof HTMLElement)) {
        const header = section.querySelector(':scope > .event-filter-header');
        if (header instanceof HTMLElement) header.hidden = true;

        viewRoot = document.createElement('div');
        viewRoot.className = 'event-slide-bio-conn-view';
        viewRoot.dataset.eventSlideConnView = '1';

        const toggle = document.createElement('div');
        toggle.className = 'gallery-mode__connections-view-toggle event-slide-bio-conn-toggle';
        toggle.setAttribute('role', 'group');
        toggle.setAttribute('aria-label', 'Connections display mode');

        const listBtn = document.createElement('button');
        listBtn.type = 'button';
        listBtn.className = 'gallery-mode__connections-view-btn is-active';
        listBtn.dataset.connView = 'list';
        listBtn.textContent = 'List';
        listBtn.setAttribute('aria-pressed', 'true');
        listBtn.addEventListener('click', () => setViewMode('list'));

        const canvasBtn = document.createElement('button');
        canvasBtn.type = 'button';
        canvasBtn.className = 'gallery-mode__connections-view-btn';
        canvasBtn.dataset.connView = 'canvas';
        canvasBtn.textContent = 'Canvas';
        canvasBtn.setAttribute('aria-pressed', 'false');
        canvasBtn.addEventListener('click', () => setViewMode('canvas'));

        toggle.append(listBtn, canvasBtn);

        const listWrap = document.createElement('div');
        listWrap.className = 'event-slide-bio-conn-list-wrap';
        listWrap.dataset.eventSlideConnListWrap = '1';

        const listHost = document.createElement('div');
        listHost.id = 'eventSlideBioConnections';
        listHost.className = 'event-slide-bio-connections';
        listHost.dataset.eventSlideConnList = '1';

        const emptyEl = document.createElement('p');
        emptyEl.className = 'event-slide-bio-conn-empty';
        emptyEl.dataset.eventSlideConnEmpty = '1';
        emptyEl.textContent = 'No connections recorded for this entry.';
        emptyEl.hidden = true;

        listWrap.append(listHost, emptyEl);

        const canvasMount = document.createElement('div');
        canvasMount.className = 'gallery-mode__connections-canvas-mount event-slide-bio-conn-canvas';
        canvasMount.dataset.eventSlideConnCanvas = '1';
        canvasMount.hidden = true;
        canvasMount.setAttribute('aria-label', 'Personal connections canvas');

        viewRoot.append(toggle, listWrap, canvasMount);

        const legacy = document.getElementById('eventSlideBioConnections');
        if (legacy && legacy !== listHost) legacy.remove();

        section.append(viewRoot);
    }

    const listHost = section.querySelector('[data-event-slide-conn-list]');
    const listWrap = section.querySelector('[data-event-slide-conn-list-wrap]');
    const canvasMount = section.querySelector('[data-event-slide-conn-canvas]');
    const emptyEl = section.querySelector('[data-event-slide-conn-empty]');
    if (
        !(listHost instanceof HTMLElement)
        || !(listWrap instanceof HTMLElement)
        || !(canvasMount instanceof HTMLElement)
        || !(emptyEl instanceof HTMLElement)
    ) {
        return null;
    }

    return { section, listHost, listWrap, canvasMount, emptyEl };
}

/**
 * @param {'list'|'canvas'} mode
 */
function setViewMode(mode) {
    viewMode = mode === 'canvas' ? 'canvas' : 'list';
    const shell = ensureShell();
    if (!shell) return;

    shell.listWrap.hidden = viewMode !== 'list';
    shell.canvasMount.hidden = viewMode !== 'canvas';

    shell.section.querySelectorAll('[data-conn-view]').forEach((btn) => {
        const isActive = btn.getAttribute('data-conn-view') === viewMode;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    if (viewMode === 'canvas') {
        void refreshCanvas().then(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    canvasController?.refitView?.();
                });
            });
        });
    } else {
        applyEmptyState();
    }
}

function applyEmptyState() {
    const shell = ensureShell();
    if (!shell) return;
    if (viewMode === 'canvas') {
        const hasLinks = listDisplayableConnectionEntities(currentEntry).length > 0;
        const hasCanvas = canvasController?.hasContent?.() ?? false;
        shell.emptyEl.hidden = hasLinks || hasCanvas;
        return;
    }
    const hasConnections = !!shell.listHost.querySelector('.event-slide-bio-connections__group');
    shell.emptyEl.hidden = hasConnections;
}

/**
 * @returns {Promise<void>}
 */
async function refreshCanvas() {
    const shell = ensureShell();
    if (!shell || viewMode !== 'canvas' || !currentEntry) return;

    if (!canvasController) {
        canvasController = createGalleryConnectionCanvas(shell.canvasMount, {
            canEdit: canEditConnections(),
            onDirty: () => {
                const saveBtn = canvasController?.getSaveButton();
                if (saveBtn) saveBtn.hidden = !canEditConnections();
            },
            onViewParked: () => {
                const snapshot = canvasController?.collectSnapshot?.();
                if (snapshot && currentEntry) {
                    currentEntry = { ...currentEntry, connectionCanvas: snapshot };
                }
                window.updateAppStatus?.('Canvas view parked for this session.', 'success');
            },
        });
        const canvasSaveBtn = canvasController.getSaveButton();
        canvasSaveBtn?.addEventListener('click', () => {
            void handleCanvasSave();
        });
    }

    await canvasController.load(
        currentEntry,
        currentArch,
        currentDisplayName,
        currentFilterKey || currentDisplayName,
        currentEntry?.connectionCanvas,
    );
    void refreshGalleryConnectionPortraitLooks();
    applyEmptyState();
}

async function handleCanvasSave() {
    if (!canEditConnections() || !canvasController || !currentEntry) return;
    const snapshot = canvasController.collectSnapshot?.();
    if (!snapshot) return;
    const filterKey = currentFilterKey || resolveFilterKey(currentEntry, currentArch, currentDisplayName);
    try {
        const result = await saveBioArchiveConnectionCanvasFromGallery(
            currentArch,
            filterKey,
            currentDisplayName || filterKey,
            { connectionCanvas: snapshot },
        );
        if (result?.ok === false) {
            window.updateAppStatus?.(result.error || 'Could not save connection canvas.', 'warning');
            return;
        }
        currentEntry = { ...currentEntry, connectionCanvas: snapshot };
        window.SoundEffectsManager?.play?.('save');
        window.updateAppStatus?.('Connection canvas saved.', 'success');
        canvasController?.clearDirtyState?.();
    } catch (err) {
        console.warn('[event-slide] connection canvas save failed', err);
        window.updateAppStatus?.('Could not save connection canvas.', 'warning');
    }
}

/**
 * Paint list HTML into the list host (same markup Gallery uses).
 * @param {object} viewEv
 * @param {string} arch
 */
function paintList(viewEv, arch) {
    const shell = ensureShell();
    if (!shell) return false;

    const createHtml = window.__SlideBioConnections?.createBioConnectionsSlideHtml;
    if (typeof createHtml !== 'function') {
        shell.listHost.innerHTML = '';
        shell.section.style.display = 'none';
        return false;
    }

    const inner = createHtml(viewEv, arch) || '';
    shell.listHost.innerHTML = inner;
    shell.section.style.display = 'block';

    if (inner) {
        window.__SlideBioConnections?.wireStoryFilterSectionBioArchiveNav?.(shell.section);
        void window.__BioChipPortraitBackground?.paintBioChipPortraitBackgrounds?.(shell.section);
        requestAnimationFrame(() => {
            window.__fitHeroChipLabelTextInRoot?.(shell.section);
            window.__wireSlideChipFloatingLabels?.(shell.section);
        });
    }

    applyEmptyState();
    return !!inner || listDisplayableConnectionEntities(viewEv).length > 0;
}

/**
 * @param {object|null|undefined} ev
 * @param {string} [archiveSource]
 * @returns {Promise<void>}
 */
export async function updateEventSlideBioConnectionsDisplay(ev, archiveSource) {
    let arch = String(archiveSource || '').trim();
    if (!arch) {
        const slide = window.standaloneEventSlide;
        if (slide?._presentationArchiveSource) {
            arch = String(slide._presentationArchiveSource).trim();
        } else if (window.eventManager?.dataService?.getArchiveSource) {
            arch = String(window.eventManager.dataService.getArchiveSource() || '').trim();
        }
    }

    const shell = ensureShell();
    if (!shell) return;

    if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') {
        clearEventSlideBioConnectionsDisplay();
        return;
    }

    currentArch = arch;
    currentDisplayName = String(ev?.name || ev?.heroName || ev?.npcName || ev?.factionDisplay || '').trim();
    currentFilterKey = resolveFilterKey(ev, arch, currentDisplayName);
    currentEntry = ev || null;

    const svc = window.CodexConnectionService;
    let viewEv = ev;
    if (svc && typeof svc.resolveConnectionsForArchiveEntry === 'function' && ev) {
        try {
            const conns = await svc.resolveConnectionsForArchiveEntry(arch, ev);
            viewEv = Object.assign({}, ev, { connections: conns });
            currentEntry = viewEv;
        } catch {
            viewEv = Object.assign({}, ev, { connections: [] });
            currentEntry = viewEv;
        }
    }

    const hasList = paintList(viewEv, arch);
    if (!hasList && listDisplayableConnectionEntities(viewEv).length === 0) {
        // Still show the section with empty state + canvas toggle (matches Gallery).
        shell.section.style.display = 'block';
        applyEmptyState();
    }

    if (viewMode === 'canvas') {
        await refreshCanvas();
    }
}

export function clearEventSlideBioConnectionsDisplay() {
    const section = document.getElementById('eventBioConnectionsSection');
    if (section instanceof HTMLElement) {
        section.style.display = 'none';
    }
    canvasController?.destroy?.();
    canvasController = null;
    currentEntry = null;
    currentFilterKey = '';
    currentDisplayName = '';
    viewMode = 'list';

    const shell = ensureShell();
    if (shell) {
        shell.listHost.innerHTML = '';
        shell.emptyEl.hidden = true;
        shell.canvasMount.hidden = true;
        shell.listWrap.hidden = false;
        shell.section.querySelectorAll('[data-conn-view]').forEach((btn) => {
            const isList = btn.getAttribute('data-conn-view') === 'list';
            btn.classList.toggle('is-active', isList);
            btn.setAttribute('aria-pressed', isList ? 'true' : 'false');
        });
    }
}

if (typeof window !== 'undefined') {
    window.__EventSlideBioConnectionsDisplay = {
        update: updateEventSlideBioConnectionsDisplay,
        clear: clearEventSlideBioConnectionsDisplay,
    };
}
