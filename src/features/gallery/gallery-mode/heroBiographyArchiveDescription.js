/**
 * Floating heroes-archive intel (left) and connections (right) on the Gallery stage.
 * Local dev: each panel has its own Edit / Save / Cancel.
 */

import { createHeroBirthdayFieldSet } from '../../system-interface/interface-shared/bio-archive/HeroBirthdayFieldSet.js';
import { getHeroBirthdayRawFromEntry } from '../../system-interface/interface-shared/bio-archive/HeroBirthdayAge.js';
import { isHeroBiographyLocalDev } from './heroBiographyLocalDev.js';
import { saveHeroArchiveEntryPatchFromBiographyStage, saveBioArchiveConnectionCanvasFromGallery } from './heroBiographyArchivePersist.js';
import {
    archiveEntryWithConnections,
    resolveConnectionsForArchiveEntry,
    saveCodexConnectionsForSubject,
} from '../../codex/codex-connections/CodexConnectionAccess.js';
import {
    clearHeroBiographyConnectionsView,
    renderHeroBiographyConnectionsView,
} from './heroBiographyArchiveConnectionsView.js';
import { createGalleryConnectionCanvas } from './galleryConnectionCanvas.js';
import { refreshGalleryConnectionPortraitLooks } from './heroBiographyConnectionPortraitLooks.js';
import { createInfoDescriptionTextScaleControls } from '../../system-interface/interface-shared/accessibility/infoDescriptionTextScale.js';
import { listDisplayableConnectionEntities } from './galleryConnectionCanvasModel.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    clearBioArchiveEventsCache,
    findBioArchiveEntryByFilterKey,
    getHeroArchiveBioDescription,
    getHeroArchiveBirthdayAgeDisplay,
    loadBioArchiveEvents,
} from './heroBiographyArchiveData.js';
import {
    configureHeroBiographyArchiveIoBar,
    createGalleryArchiveIoButtonGroup,
    destroyGalleryArchiveIoControls,
} from './heroBiographyArchiveIoBar.js';

/** @type {HTMLElement | null} */
let intelPanelEl = null;

/** @type {HTMLElement | null} */
let connectionsPanelEl = null;

/** @type {HTMLElement | null} */
let intelToolbarEl = null;

/** @type {HTMLButtonElement | null} */
let intelEditBtn = null;

/** @type {HTMLButtonElement | null} */
let intelSaveBtn = null;

/** @type {HTMLButtonElement | null} */
let intelCancelBtn = null;

/** @type {HTMLElement | null} */
let connectionsToolbarEl = null;

/** @type {HTMLButtonElement | null} */
let connectionsEditBtn = null;

/** @type {HTMLButtonElement | null} */
let connectionsSaveBtn = null;

/** @type {HTMLButtonElement | null} */
let connectionsCancelBtn = null;

/** @type {HTMLElement | null} */
let viewBirthdayMetaEl = null;

/** @type {HTMLElement | null} */
let editBirthdayEl = null;

/** @type {ReturnType<typeof createHeroBirthdayFieldSet> | null} */
let birthdayFields = null;

/** @type {HTMLElement | null} */
let viewBodyEl = null;

/** @type {HTMLElement | null} */
let connectionsViewEl = null;

/** @type {HTMLElement | null} */
let connectionsBodyEl = null;

/** @type {HTMLElement | null} */
let connectionsEditEl = null;

/** @type {HTMLElement | null} */
let connectionsEditMount = null;

/** @type {HTMLElement | null} */
let editBodyEl = null;

/** @type {HTMLElement | null} */
let intelScrollEl = null;

/** @type {HTMLElement | null} */
let intelEmptyEl = null;

/** @type {HTMLElement | null} */
let connectionsEmptyEl = null;

/** @type {HTMLElement | null} */
let connectionsListWrapEl = null;

/** @type {HTMLElement | null} */
let connectionsCanvasMountEl = null;

/** @type {HTMLElement | null} */
let connectionsViewToggleEl = null;

/** @type {ReturnType<typeof createGalleryConnectionCanvas> | null} */
let connectionsCanvasController = null;

/** @type {'list' | 'canvas'} */
let connectionsViewMode = 'list';

let canvasLayoutSaveInFlight = false;

/** @type {object | null} */
let currentEntry = null;

/** Entry with resolved Codex connections (same data as list view). */
/** @type {object | null} */
let currentViewEntry = null;

/** @type {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} */
let currentCategory = 'heroes';

/** @type {string | null} */
let currentFilterKey = null;

/** @type {string} */
let currentDisplayName = '';

let isIntelEditing = false;

let isConnectionsEditing = false;

/** @type {{ description: string, birthdayRaw: string } | null} */
let intelEditDraft = null;

let intelSaveInFlight = false;

let connectionsSaveInFlight = false;

let loadGeneration = 0;

function canEditGalleryArchive() {
    return isHeroBiographyLocalDev();
}

/**
 * @param {HTMLElement | null} panel
 * @param {boolean} show
 */
function setPanelVisible(panel, show) {
    if (!panel) return;
    panel.classList.toggle('is-visible', show);
    panel.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function setIntelPanelVisible(show) {
    setPanelVisible(intelPanelEl, show);
}

function setConnectionsPanelVisible(show) {
    setPanelVisible(connectionsPanelEl, show);
}

function setBirthdayFieldsEnabled(enabled) {
    if (!birthdayFields) return;
    birthdayFields.dayInput.disabled = !enabled;
    birthdayFields.monthInput.disabled = !enabled;
    birthdayFields.yearInput.disabled = !enabled;
}

function setIntelEditingMode(editing) {
    isIntelEditing = editing;
    if (!intelPanelEl) return;
    intelPanelEl.classList.toggle('is-editing', editing);
    if (viewBirthdayMetaEl) viewBirthdayMetaEl.hidden = editing;
    if (editBirthdayEl) {
        editBirthdayEl.hidden = !editing;
        editBirthdayEl.classList.toggle('is-active', editing);
    }
    setBirthdayFieldsEnabled(editing);
    if (editBodyEl) editBodyEl.hidden = !editing;
    if (intelEditBtn) intelEditBtn.hidden = editing;
    if (intelSaveBtn) intelSaveBtn.hidden = !editing;
    if (intelCancelBtn) intelCancelBtn.hidden = !editing;
    if (viewBodyEl) viewBodyEl.hidden = editing;
    if (intelEmptyEl) intelEmptyEl.hidden = editing;
}

function setConnectionsEditingMode(editing) {
    isConnectionsEditing = editing;
    if (!connectionsPanelEl) return;
    connectionsPanelEl.classList.toggle('is-editing', editing);
    if (connectionsViewEl) connectionsViewEl.hidden = editing;
    if (connectionsEditEl) connectionsEditEl.hidden = !editing;
    if (connectionsEditBtn) connectionsEditBtn.hidden = editing;
    if (connectionsSaveBtn) connectionsSaveBtn.hidden = !editing;
    if (connectionsCancelBtn) connectionsCancelBtn.hidden = !editing;
    if (connectionsEmptyEl) connectionsEmptyEl.hidden = editing;
    if (connectionsViewToggleEl) connectionsViewToggleEl.hidden = editing;
    if (editing && connectionsViewMode === 'canvas') {
        setConnectionsViewMode('list');
    }
}

/**
 * @param {object | null} entry
 * @returns {Promise<object | null>}
 */
async function resolveViewEntryForConnections(entry) {
    const cat = normalizeBioBiographyCategory(currentCategory);
    if (!entry || !(cat === 'heroes' || cat === 'factions' || cat === 'npcs')) {
        return entry;
    }
    const connections = await resolveConnectionsForArchiveEntry(
        cat,
        entry,
        currentDisplayName,
    );
    return archiveEntryWithConnections(entry, cat, connections);
}

/**
 * @param {'list' | 'canvas'} mode
 */
function setConnectionsViewMode(mode) {
    connectionsViewMode = mode === 'canvas' ? 'canvas' : 'list';
    if (connectionsListWrapEl) {
        connectionsListWrapEl.hidden = connectionsViewMode !== 'list';
    }
    if (connectionsCanvasMountEl) {
        connectionsCanvasMountEl.hidden = connectionsViewMode !== 'canvas';
    }
    if (connectionsViewToggleEl) {
        connectionsViewToggleEl.querySelectorAll('[data-conn-view]').forEach((btn) => {
            const isActive = btn.getAttribute('data-conn-view') === connectionsViewMode;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    }
    if (connectionsViewMode === 'canvas') {
        void refreshConnectionsCanvas().then(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    connectionsCanvasController?.refitView?.();
                    connectionsCanvasMountEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                });
            });
        });
    } else {
        applyConnectionsEmptyState(currentViewEntry ?? currentEntry);
    }
}

/**
 * @param {object | null} [presetViewEntry] Pre-resolved entry (e.g. from renderConnectionsBody).
 */
async function refreshConnectionsCanvas(presetViewEntry) {
    if (!connectionsCanvasMountEl || connectionsViewMode !== 'canvas') return;

    const viewEntry = presetViewEntry ?? await resolveViewEntryForConnections(currentEntry);
    currentViewEntry = viewEntry;

    if (!connectionsCanvasController) {
        connectionsCanvasController = createGalleryConnectionCanvas(connectionsCanvasMountEl, {
            canEdit: canEditGalleryArchive(),
            onDirty: () => {
                const saveBtn = connectionsCanvasController?.getSaveButton();
                if (saveBtn) saveBtn.hidden = !canEditGalleryArchive();
            },
            onViewParked: () => {
                if (canEditGalleryArchive()) {
                    void handleCanvasLayoutSave({ parked: true });
                    return;
                }
                const snapshot = connectionsCanvasController?.collectSnapshot?.();
                if (snapshot && currentViewEntry) {
                    currentViewEntry = {
                        ...currentViewEntry,
                        connectionCanvas: snapshot,
                    };
                }
                window.updateAppStatus?.('Canvas view parked for this session.', 'success');
            },
        });
        const canvasSaveBtn = connectionsCanvasController.getSaveButton();
        canvasSaveBtn?.addEventListener('click', () => void handleCanvasLayoutSave());
    }

    await connectionsCanvasController.load(
        viewEntry,
        currentCategory,
        currentDisplayName,
        currentFilterKey || '',
        viewEntry?.connectionCanvas,
    );
    void refreshGalleryConnectionPortraitLooks();
    applyConnectionsEmptyState(viewEntry);
}

/**
 * @param {object | null} [viewEntry]
 */
function applyConnectionsEmptyState(viewEntry = currentEntry) {
    if (!connectionsEmptyEl || isConnectionsEditing) return;
    if (connectionsViewMode === 'canvas') {
        const hasLinks = listDisplayableConnectionEntities(viewEntry).length > 0;
        const hasCanvas = connectionsCanvasController?.hasContent?.() ?? false;
        connectionsEmptyEl.hidden = hasLinks || hasCanvas;
        return;
    }
    if (!connectionsBodyEl) return;
    const hasConnections = !!connectionsBodyEl.querySelector('.event-slide-bio-connections__group');
    connectionsEmptyEl.hidden = hasConnections;
}

function applyIntelEmptyState() {
    if (!intelEmptyEl || !viewBodyEl) return;
    const hasDescription = !!(viewBodyEl.textContent || '').trim();
    const hasBirthday = viewBirthdayMetaEl && !viewBirthdayMetaEl.hidden;
    intelEmptyEl.hidden = hasDescription || hasBirthday;
}

function renderIntelBody(description) {
    if (!viewBodyEl) return;
    viewBodyEl.textContent = description || '';
    applyIntelEmptyState();
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
function updateConnectionsEmptyCopy(category) {
    if (!connectionsEmptyEl) return;
    const cat = normalizeBioBiographyCategory(category);
    const label =
        cat === 'factions' ? 'faction' : cat === 'npcs' ? 'NPC' : 'hero';
    connectionsEmptyEl.textContent = `No connections recorded for this ${label}.`;
}

/**
 * @param {object | null} entry
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory} category
 */
async function renderConnectionsBody(entry, category) {
    if (!connectionsBodyEl) return;
    const cat = normalizeBioBiographyCategory(category);
    const viewEntry = await resolveViewEntryForConnections(entry);
    currentViewEntry = viewEntry;
    renderHeroBiographyConnectionsView(connectionsBodyEl, viewEntry, category);
    if (connectionsViewMode === 'canvas') {
        void refreshConnectionsCanvas(viewEntry);
    }
    applyConnectionsEmptyState(viewEntry);
}

function renderBirthdayMeta(display) {
    if (!viewBirthdayMetaEl) return;
    if (!display) {
        viewBirthdayMetaEl.hidden = true;
        viewBirthdayMetaEl.replaceChildren();
        applyIntelEmptyState();
        return;
    }
    viewBirthdayMetaEl.hidden = false;
    viewBirthdayMetaEl.replaceChildren();

    const birthdayRow = document.createElement('p');
    birthdayRow.className = 'gallery-mode__archive-birthday-line';
    birthdayRow.textContent = `Birthday: ${display.birthdayText}`;

    viewBirthdayMetaEl.append(birthdayRow);
    if (display.age != null) {
        const ageRow = document.createElement('p');
        ageRow.className = 'gallery-mode__archive-age-line';
        ageRow.textContent = `Age: ${display.age}`;
        viewBirthdayMetaEl.append(ageRow);
    }
    applyIntelEmptyState();
}

function populateIntelEditFields(entry, descriptionText) {
    const raw = entry ? getHeroBirthdayRawFromEntry(entry) : '';
    birthdayFields?.populate(raw);
    if (editBodyEl) {
        editBodyEl.textContent = descriptionText || '';
    }
}

function exitIntelEditMode() {
    intelEditDraft = null;
    setIntelEditingMode(false);
}

function exitConnectionsEditMode() {
    if (connectionsEditMount) {
        connectionsEditMount.replaceChildren();
    }
    setConnectionsEditingMode(false);
}

function exitAllEditModes() {
    exitIntelEditMode();
    exitConnectionsEditMode();
}

function beginIntelEditMode(entry, descriptionText) {
    if (!canEditGalleryArchive() || !currentFilterKey || currentCategory !== 'heroes') return;
    if (isConnectionsEditing) exitConnectionsEditMode();
    intelEditDraft = {
        description: descriptionText || '',
        birthdayRaw: entry ? getHeroBirthdayRawFromEntry(entry) : '',
    };
    populateIntelEditFields(entry, descriptionText);
    setIntelEditingMode(true);
    editBodyEl?.focus();
}

async function beginConnectionsEditMode() {
    const cat = normalizeBioBiographyCategory(currentCategory);
    if (
        !canEditGalleryArchive()
        || !currentFilterKey
        || (cat !== 'heroes' && cat !== 'factions' && cat !== 'npcs')
        || !currentEntry
    ) {
        return;
    }
    if (isIntelEditing) exitIntelEditMode();

    const editor = window.BioArchiveConnectionsEditor;
    if (!editor?.render || !connectionsEditMount) return;

    const conns = await resolveConnectionsForArchiveEntry(cat, currentEntry, currentDisplayName, {
        forEdit: true,
    });
    const bioOpts =
        editor.subjectOptsFromArchiveRow?.(currentEntry, cat) || {
            subjectName: currentDisplayName || currentFilterKey,
            subjectKind: cat === 'factions' ? 'faction' : cat === 'npcs' ? 'npc' : 'hero',
        };

    connectionsEditMount.replaceChildren();
    editor.render(connectionsEditMount, conns, bioOpts);
    setConnectionsEditingMode(true);
}

async function handleIntelSave() {
    if (
        !canEditGalleryArchive()
        || !currentFilterKey
        || currentCategory !== 'heroes'
        || intelSaveInFlight
        || !birthdayFields
        || !editBodyEl
    ) {
        return;
    }

    if (birthdayFields.isIncomplete()) {
        window.updateAppStatus?.(
            'Birthday needs a valid day, month, and year (example: 12 May 2048).',
            'warning',
        );
        birthdayFields.dayInput.focus();
        return;
    }

    const description = (editBodyEl.innerText ?? editBodyEl.textContent ?? '')
        .replace(/\r\n/g, '\n')
        .trim();
    const birthday = birthdayFields.readNormalized();

    intelSaveInFlight = true;
    if (intelSaveBtn) intelSaveBtn.disabled = true;

    try {
        const result = await saveHeroArchiveEntryPatchFromBiographyStage(
            currentFilterKey,
            currentDisplayName,
            { description, birthday },
        );
        if (!result.ok) {
            window.updateAppStatus?.(result.error || 'Could not save hero bio.', 'warning');
            return;
        }

        if (result.entry) currentEntry = result.entry;
        clearBioArchiveEventsCache('heroes');
        exitIntelEditMode();
        window.SoundEffectsManager?.play?.('save');
        if (intelSaveBtn && window.flashButton) {
            window.flashButton(intelSaveBtn, 'flash-green');
        }
        await setBioBiographyArchiveDescription('heroes', currentFilterKey, currentDisplayName);
    } catch (err) {
        console.warn('[gallery] Bio save failed:', err);
        window.updateAppStatus?.('Could not save hero bio.', 'warning');
    } finally {
        intelSaveInFlight = false;
        if (intelSaveBtn) intelSaveBtn.disabled = false;
    }
}

async function handleConnectionsSave() {
    const cat = normalizeBioBiographyCategory(currentCategory);
    if (
        !canEditGalleryArchive()
        || !currentFilterKey
        || (cat !== 'heroes' && cat !== 'factions' && cat !== 'npcs')
        || connectionsSaveInFlight
        || !connectionsEditMount
    ) {
        return;
    }

    const editor = window.BioArchiveConnectionsEditor;
    const connections = editor?.collect?.(connectionsEditMount) ?? [];
    const subjectName =
        currentEntry?.name != null && String(currentEntry.name).trim()
            ? String(currentEntry.name).trim()
            : currentDisplayName || currentFilterKey;

    connectionsSaveInFlight = true;
    if (connectionsSaveBtn) connectionsSaveBtn.disabled = true;

    try {
        const result = await saveCodexConnectionsForSubject(cat, subjectName, connections);
        if (!result.ok) {
            window.updateAppStatus?.(result.error || 'Could not save connections.', 'warning');
            return;
        }

        if (result.writtenToDisk) {
            window.updateAppStatus?.('Connection metadata saved to codex-labels.json.', 'success');
        } else {
            window.updateAppStatus?.(
                'Connection metadata saved in this browser. Export Codex JSON to share, or save from localhost to update the repo file.',
                'success',
            );
        }

        exitConnectionsEditMode();
        window.SoundEffectsManager?.play?.('save');
        if (connectionsSaveBtn && window.flashButton) {
            window.flashButton(connectionsSaveBtn, 'flash-green');
        }
        await renderConnectionsBody(currentEntry, currentCategory);
    } catch (err) {
        console.warn('[gallery] Connections save failed:', err);
        window.updateAppStatus?.('Could not save connections.', 'warning');
    } finally {
        connectionsSaveInFlight = false;
        if (connectionsSaveBtn) connectionsSaveBtn.disabled = false;
    }
}

function handleIntelCancel() {
    if (!intelEditDraft) {
        exitIntelEditMode();
        return;
    }
    birthdayFields?.populate(intelEditDraft.birthdayRaw);
    if (editBodyEl) editBodyEl.textContent = intelEditDraft.description;
    exitIntelEditMode();
}

function handleConnectionsCancel() {
    exitConnectionsEditMode();
}

async function handleCanvasLayoutSave(options = {}) {
    if (
        !canEditGalleryArchive()
        || !currentFilterKey
        || canvasLayoutSaveInFlight
        || !connectionsCanvasController
        || currentCategory === 'locations'
    ) {
        return;
    }

    const snapshot = connectionsCanvasController.collectSnapshot();
    canvasLayoutSaveInFlight = true;
    const canvasSaveBtn = connectionsCanvasController.getSaveButton();
    if (canvasSaveBtn) canvasSaveBtn.disabled = true;

    try {
        const result = await saveBioArchiveConnectionCanvasFromGallery(
            currentCategory,
            currentFilterKey,
            currentDisplayName,
            { connectionCanvas: snapshot },
        );
        if (!result.ok) {
            window.updateAppStatus?.(result.error || 'Could not save canvas layout.', 'warning');
            return;
        }
        if (result.entry) {
            currentEntry = result.entry;
            if (currentViewEntry) {
                currentViewEntry = {
                    ...currentViewEntry,
                    connectionCanvas: snapshot,
                };
            }
        }
        clearBioArchiveEventsCache(currentCategory);
        connectionsCanvasController.clearDirtyState();
        window.SoundEffectsManager?.play?.('save');
        if (canvasSaveBtn && window.flashButton) {
            window.flashButton(canvasSaveBtn, 'flash-green');
        }
        window.updateAppStatus?.(
            options.parked ? 'Canvas view parked and saved.' : 'Personal connection layout saved.',
            'success',
        );
    } catch (err) {
        console.warn('[gallery] Canvas layout save failed:', err);
        window.updateAppStatus?.('Could not save canvas layout.', 'warning');
    } finally {
        canvasLayoutSaveInFlight = false;
        if (canvasSaveBtn) canvasSaveBtn.disabled = false;
    }
}

/**
 * @param {HTMLElement} hostEl — `#atlasGalleryHost`
 */
export function initHeroBiographyArchiveDescription(hostEl) {
    if (intelPanelEl) return;

    intelPanelEl = document.createElement('aside');
    intelPanelEl.className = 'gallery-mode__archive-description gallery-mode__archive-side-panel';
    intelPanelEl.setAttribute('aria-label', 'Hero biography');
    intelPanelEl.setAttribute('aria-hidden', 'true');

    connectionsPanelEl = document.createElement('aside');
    connectionsPanelEl.className = 'gallery-mode__archive-connections gallery-mode__archive-side-panel';
    connectionsPanelEl.setAttribute('aria-label', 'Archive connections');
    connectionsPanelEl.setAttribute('aria-hidden', 'true');

    const intelHeading = document.createElement('h2');
    intelHeading.className = 'gallery-mode__archive-side-panel-heading';
    intelHeading.textContent = 'Intel';

    const connectionsHeading = document.createElement('h2');
    connectionsHeading.className = 'gallery-mode__archive-side-panel-heading';
    connectionsHeading.textContent = 'Connections';

    configureHeroBiographyArchiveIoBar({
        getActiveCategory: () => currentCategory,
    });

    const intelArchiveIo = createGalleryArchiveIoButtonGroup(hostEl);
    const connectionsArchiveIo = createGalleryArchiveIoButtonGroup(hostEl);

    intelToolbarEl = document.createElement('div');
    intelToolbarEl.className = 'gallery-mode__archive-description-toolbar';

    intelEditBtn = document.createElement('button');
    intelEditBtn.type = 'button';
    intelEditBtn.className = 'gallery-mode__archive-description-btn';
    intelEditBtn.textContent = 'Edit';
    intelEditBtn.addEventListener('click', async () => {
        if (!currentFilterKey || currentCategory !== 'heroes') return;
        clearBioArchiveEventsCache('heroes');
        const events = await loadBioArchiveEvents('heroes');
        const entry = findBioArchiveEntryByFilterKey('heroes', currentFilterKey, events);
        const description = getHeroArchiveBioDescription(entry) || '';
        beginIntelEditMode(entry, description);
    });

    intelSaveBtn = document.createElement('button');
    intelSaveBtn.type = 'button';
    intelSaveBtn.className = 'gallery-mode__archive-description-btn gallery-mode__archive-description-btn--primary';
    intelSaveBtn.textContent = 'Save';
    intelSaveBtn.hidden = true;
    intelSaveBtn.addEventListener('click', () => void handleIntelSave());

    intelCancelBtn = document.createElement('button');
    intelCancelBtn.type = 'button';
    intelCancelBtn.className = 'gallery-mode__archive-description-btn';
    intelCancelBtn.textContent = 'Cancel';
    intelCancelBtn.hidden = true;
    intelCancelBtn.addEventListener('click', handleIntelCancel);

    intelToolbarEl.append(
        createInfoDescriptionTextScaleControls({ compact: true, leading: true }),
        intelEditBtn,
        intelArchiveIo.exportBtn,
        intelArchiveIo.importBtn,
        intelArchiveIo.saveArchiveBtn,
        intelSaveBtn,
        intelCancelBtn,
    );

    connectionsToolbarEl = document.createElement('div');
    connectionsToolbarEl.className = 'gallery-mode__archive-description-toolbar';

    connectionsEditBtn = document.createElement('button');
    connectionsEditBtn.type = 'button';
    connectionsEditBtn.className = 'gallery-mode__archive-description-btn';
    connectionsEditBtn.textContent = 'Edit';
    connectionsEditBtn.addEventListener('click', () => beginConnectionsEditMode());

    connectionsSaveBtn = document.createElement('button');
    connectionsSaveBtn.type = 'button';
    connectionsSaveBtn.className = 'gallery-mode__archive-description-btn gallery-mode__archive-description-btn--primary';
    connectionsSaveBtn.textContent = 'Save';
    connectionsSaveBtn.hidden = true;
    connectionsSaveBtn.addEventListener('click', () => void handleConnectionsSave());

    connectionsCancelBtn = document.createElement('button');
    connectionsCancelBtn.type = 'button';
    connectionsCancelBtn.className = 'gallery-mode__archive-description-btn';
    connectionsCancelBtn.textContent = 'Cancel';
    connectionsCancelBtn.hidden = true;
    connectionsCancelBtn.addEventListener('click', handleConnectionsCancel);

    connectionsToolbarEl.append(
        connectionsEditBtn,
        connectionsArchiveIo.exportBtn,
        connectionsArchiveIo.importBtn,
        connectionsArchiveIo.saveArchiveBtn,
        connectionsSaveBtn,
        connectionsCancelBtn,
    );

    if (!canEditGalleryArchive()) {
        intelEditBtn.hidden = true;
        intelEditBtn.disabled = true;
        connectionsEditBtn.hidden = true;
        connectionsEditBtn.disabled = true;
    }

    const intelHeadingBlock = document.createElement('div');
    intelHeadingBlock.className = 'gallery-mode__archive-side-panel-heading-row';
    intelHeadingBlock.append(intelHeading, intelToolbarEl);

    const connectionsHeadingBlock = document.createElement('div');
    connectionsHeadingBlock.className = 'gallery-mode__archive-side-panel-heading-row';
    connectionsHeadingBlock.append(connectionsHeading, connectionsToolbarEl);

    viewBirthdayMetaEl = document.createElement('div');
    viewBirthdayMetaEl.className = 'gallery-mode__archive-birthday-meta';
    viewBirthdayMetaEl.hidden = true;

    editBirthdayEl = document.createElement('div');
    editBirthdayEl.className = 'gallery-mode__archive-birthday-edit';
    editBirthdayEl.hidden = true;
    const birthdayLabel = document.createElement('span');
    birthdayLabel.className = 'gallery-mode__archive-birthday-edit-label';
    birthdayLabel.textContent = 'Birthday';
    editBirthdayEl.append(birthdayLabel);
    birthdayFields = createHeroBirthdayFieldSet(editBirthdayEl, 'heroBioArchive');
    setBirthdayFieldsEnabled(false);

    viewBodyEl = document.createElement('div');
    viewBodyEl.className = 'gallery-mode__archive-description-body';

    editBodyEl = document.createElement('div');
    editBodyEl.className = 'gallery-mode__archive-description-body gallery-mode__archive-description-body--edit';
    editBodyEl.hidden = true;
    editBodyEl.contentEditable = 'true';
    editBodyEl.setAttribute('spellcheck', 'true');
    editBodyEl.setAttribute('aria-label', 'Hero biography description');

    intelEmptyEl = document.createElement('p');
    intelEmptyEl.className = 'gallery-mode__archive-description-empty';
    intelEmptyEl.textContent = 'No biography written yet for this hero.';

    intelScrollEl = document.createElement('div');
    intelScrollEl.className = 'gallery-mode__archive-panel-scroll scrollbar-custom';
    intelScrollEl.setAttribute('tabindex', '0');
    intelScrollEl.setAttribute('aria-label', 'Hero intel content');
    intelScrollEl.append(viewBirthdayMetaEl, editBirthdayEl, viewBodyEl, editBodyEl, intelEmptyEl);

    connectionsViewEl = document.createElement('div');
    connectionsViewEl.className = 'gallery-mode__archive-connections-view';
    connectionsViewEl.setAttribute('tabindex', '0');
    connectionsViewEl.setAttribute('aria-label', 'Archive connections');

    connectionsViewToggleEl = document.createElement('div');
    connectionsViewToggleEl.className = 'gallery-mode__connections-view-toggle';
    connectionsViewToggleEl.setAttribute('role', 'group');
    connectionsViewToggleEl.setAttribute('aria-label', 'Connections display mode');

    const listViewBtn = document.createElement('button');
    listViewBtn.type = 'button';
    listViewBtn.className = 'gallery-mode__connections-view-btn is-active';
    listViewBtn.dataset.connView = 'list';
    listViewBtn.textContent = 'List';
    listViewBtn.setAttribute('aria-pressed', 'true');
    listViewBtn.addEventListener('click', () => setConnectionsViewMode('list'));

    const canvasViewBtn = document.createElement('button');
    canvasViewBtn.type = 'button';
    canvasViewBtn.className = 'gallery-mode__connections-view-btn';
    canvasViewBtn.dataset.connView = 'canvas';
    canvasViewBtn.textContent = 'Canvas';
    canvasViewBtn.setAttribute('aria-pressed', 'false');
    canvasViewBtn.addEventListener('click', () => setConnectionsViewMode('canvas'));

    connectionsViewToggleEl.append(listViewBtn, canvasViewBtn);

    connectionsListWrapEl = document.createElement('div');
    connectionsListWrapEl.className =
        'gallery-mode__archive-panel-scroll scrollbar-custom gallery-mode__connections-list-wrap';
    connectionsListWrapEl.setAttribute('tabindex', '0');

    connectionsBodyEl = document.createElement('div');
    connectionsBodyEl.className =
        'gallery-mode__archive-description-body gallery-mode__archive-connections-body';
    connectionsBodyEl.setAttribute('aria-label', 'Archive connections list');

    connectionsEmptyEl = document.createElement('p');
    connectionsEmptyEl.className = 'gallery-mode__archive-description-empty';
    connectionsEmptyEl.textContent = 'No connections recorded for this entry.';

    connectionsCanvasMountEl = document.createElement('div');
    connectionsCanvasMountEl.className = 'gallery-mode__connections-canvas-mount';
    connectionsCanvasMountEl.hidden = true;
    connectionsCanvasMountEl.setAttribute('aria-label', 'Personal connections canvas');

    connectionsListWrapEl.append(connectionsBodyEl, connectionsEmptyEl);
    connectionsViewEl.append(connectionsViewToggleEl, connectionsListWrapEl, connectionsCanvasMountEl);

    connectionsEditEl = document.createElement('div');
    connectionsEditEl.className =
        'gallery-mode__archive-connections-edit gallery-mode__archive-panel-scroll scrollbar-custom';
    connectionsEditEl.hidden = true;
    connectionsEditEl.setAttribute('tabindex', '0');
    connectionsEditEl.setAttribute('aria-label', 'Edit hero connections');
    connectionsEditMount = document.createElement('div');
    connectionsEditMount.id = 'galleryHeroBioConnectionsEditor';
    connectionsEditMount.className = 'gallery-mode__archive-connections-edit-mount';
    connectionsEditEl.append(connectionsEditMount);

    if (intelToolbarEl) intelPanelEl.append(intelHeadingBlock);
    else intelPanelEl.append(intelHeading);
    intelPanelEl.append(intelScrollEl);

    if (connectionsToolbarEl) {
        connectionsPanelEl.append(connectionsHeadingBlock);
    } else {
        connectionsPanelEl.append(connectionsHeading);
    }
    connectionsPanelEl.append(connectionsViewEl, connectionsEditEl);

    hostEl.append(intelPanelEl, connectionsPanelEl);

    window.addEventListener('atlas-bio-archives-refreshed', (ev) => {
        if (!currentFilterKey || isIntelEditing || isConnectionsEditing) return;
        const archives = ev.detail?.archives;
        if (Array.isArray(archives) && archives.length > 0 && !archives.includes(currentCategory)) {
            return;
        }
        void setBioBiographyArchiveDescription(currentCategory, currentFilterKey, currentDisplayName);
    });
}

/**
 * @param {import('./bioBiographyCategories.js').BioBiographyArchiveCategory | null} category
 * @param {string | null} filterKey
 * @param {string} [displayName]
 */
export async function setBioBiographyArchiveDescription(category, filterKey, displayName = '') {
    const gen = ++loadGeneration;
    if (!intelPanelEl || !viewBodyEl || !intelEmptyEl) return;

    if (isIntelEditing || isConnectionsEditing) exitAllEditModes();

    const cat = category ? normalizeBioBiographyCategory(category) : 'heroes';
    const key = filterKey ? String(filterKey).trim() : '';
    currentCategory = cat;
    currentFilterKey = key || null;
    currentDisplayName = key ? String(displayName || key).trim() : '';
    currentEntry = null;
    currentViewEntry = null;

    const isHero = cat === 'heroes';
    const supportsConnections = cat === 'heroes' || cat === 'factions' || cat === 'npcs';
    updateConnectionsEmptyCopy(cat);
    if (viewBirthdayMetaEl) viewBirthdayMetaEl.hidden = !isHero;
    if (editBirthdayEl) {
        editBirthdayEl.hidden = true;
        editBirthdayEl.classList.remove('is-active');
    }
    setBirthdayFieldsEnabled(false);

    if (!key || cat === 'locations') {
        renderBirthdayMeta(null);
        renderIntelBody('');
        clearHeroBiographyConnectionsView(connectionsBodyEl);
        intelEmptyEl.hidden = cat !== 'locations';
        if (cat === 'locations') {
            intelEmptyEl.textContent = 'Location biographies are not available yet.';
        }
        if (intelToolbarEl) intelToolbarEl.hidden = true;
        if (connectionsToolbarEl) connectionsToolbarEl.hidden = true;
        setIntelPanelVisible(cat === 'locations');
        setConnectionsPanelVisible(false);
        return;
    }

    if (intelToolbarEl) {
        intelToolbarEl.hidden = !key || cat === 'locations';
    }
    if (connectionsToolbarEl) {
        connectionsToolbarEl.hidden = !key || !supportsConnections;
    }

    if (
        supportsConnections
        && typeof window.BioArchiveConnectionsSync?.repairCrossArchiveMirrorsAllBioArchives ===
            'function'
        && !window.__atlasBioCrossArchiveRepairDone
    ) {
        try {
            await window.BioArchiveConnectionsSync.repairCrossArchiveMirrorsAllBioArchives();
            window.__atlasBioCrossArchiveRepairDone = true;
            clearBioArchiveEventsCache();
        } catch (err) {
            console.warn('[gallery] Cross-archive connection repair failed:', err);
        }
        if (gen !== loadGeneration) return;
    }

    let description = null;
    let birthdayDisplay = null;
    let entry = null;
    try {
        const events = await loadBioArchiveEvents(cat);
        if (gen !== loadGeneration) return;
        entry = findBioArchiveEntryByFilterKey(cat, key, events);
        currentEntry = entry;
        description = getHeroArchiveBioDescription(entry);
        birthdayDisplay = isHero ? getHeroArchiveBirthdayAgeDisplay(entry) : null;
    } catch (err) {
        console.warn('[gallery] Could not load archive description:', err);
    }

    if (gen !== loadGeneration) return;

    renderBirthdayMeta(birthdayDisplay);
    renderIntelBody(description || '');
    await renderConnectionsBody(entry, cat);

    const hasIntel = !!(description || birthdayDisplay);

    setIntelPanelVisible(hasIntel || (canEditGalleryArchive() && isHero) || !isHero);
    setConnectionsPanelVisible(supportsConnections);

    if (intelEditBtn) {
        intelEditBtn.hidden = !canEditGalleryArchive() || !isHero;
        intelEditBtn.disabled = !canEditGalleryArchive() || !isHero;
        intelEditBtn.title = isHero ? 'Edit biography and birthday' : 'Editing is only available for heroes';
    }
    if (connectionsEditBtn) {
        connectionsEditBtn.hidden = !canEditGalleryArchive();
        connectionsEditBtn.disabled = !canEditGalleryArchive() || !currentEntry;
        connectionsEditBtn.title = 'Edit connections for this entry';
    }
}

/**
 * @param {string | null} heroFilterKey
 * @param {string} [heroDisplayName]
 */
export async function setHeroBiographyArchiveDescriptionHero(heroFilterKey, heroDisplayName = '') {
    return setBioBiographyArchiveDescription('heroes', heroFilterKey, heroDisplayName);
}

export function destroyHeroBiographyArchiveDescription() {
    loadGeneration += 1;
    exitAllEditModes();
    currentCategory = 'heroes';
    currentFilterKey = null;
    currentDisplayName = '';
    intelPanelEl?.remove();
    connectionsPanelEl?.remove();
    intelPanelEl = null;
    connectionsPanelEl = null;
    intelToolbarEl = null;
    intelEditBtn = null;
    intelSaveBtn = null;
    intelCancelBtn = null;
    connectionsToolbarEl = null;
    connectionsEditBtn = null;
    connectionsSaveBtn = null;
    connectionsCancelBtn = null;
    viewBirthdayMetaEl = null;
    editBirthdayEl = null;
    birthdayFields = null;
    viewBodyEl = null;
    connectionsViewEl = null;
    connectionsBodyEl = null;
    connectionsEditEl = null;
    connectionsEditMount = null;
    connectionsListWrapEl = null;
    connectionsCanvasMountEl = null;
    connectionsViewToggleEl = null;
    connectionsViewMode = 'list';
    connectionsCanvasController?.destroy();
    connectionsCanvasController = null;
    editBodyEl = null;
    intelScrollEl = null;
    intelEmptyEl = null;
    connectionsEmptyEl = null;
    currentEntry = null;
    clearBioArchiveEventsCache();
    destroyGalleryArchiveIoControls();
}
