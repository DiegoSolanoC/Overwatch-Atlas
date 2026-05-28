/**
 * Floating heroes-archive intel (left) and connections (right) on the Gallery stage.
 * Local dev: each panel has its own Edit / Save / Cancel.
 */

import { createHeroBirthdayFieldSet } from '../../system-interface/interface-shared/bio-archive/HeroBirthdayFieldSet.js';
import { getHeroBirthdayRawFromEntry } from '../../system-interface/interface-shared/bio-archive/HeroBirthdayAge.js';
import { isHeroBiographyLocalDev } from './heroBiographyLocalDev.js';
import { saveHeroArchiveEntryPatchFromBiographyStage } from './heroBiographyArchivePersist.js';
import {
    clearHeroBiographyConnectionsView,
    renderHeroBiographyConnectionsView,
} from './heroBiographyArchiveConnectionsView.js';
import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    clearBioArchiveEventsCache,
    findBioArchiveEntryByFilterKey,
    getHeroArchiveBioDescription,
    getHeroArchiveBirthdayAgeDisplay,
    loadBioArchiveEvents,
} from './heroBiographyArchiveData.js';

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

/** @type {object | null} */
let currentEntry = null;

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

const canEdit = isHeroBiographyLocalDev();

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
}

function applyIntelEmptyState() {
    if (!intelEmptyEl || !viewBodyEl) return;
    const hasDescription = !!(viewBodyEl.textContent || '').trim();
    const hasBirthday = viewBirthdayMetaEl && !viewBirthdayMetaEl.hidden;
    intelEmptyEl.hidden = hasDescription || hasBirthday;
}

function applyConnectionsEmptyState() {
    if (!connectionsEmptyEl || !connectionsBodyEl || isConnectionsEditing) return;
    const hasConnections = !!connectionsBodyEl.querySelector('.event-slide-bio-connections__group');
    connectionsEmptyEl.hidden = hasConnections;
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
function renderConnectionsBody(entry, category) {
    if (!connectionsBodyEl) return;
    renderHeroBiographyConnectionsView(connectionsBodyEl, entry, category);
    applyConnectionsEmptyState();
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
    const birthdayLabel = document.createElement('span');
    birthdayLabel.className = 'gallery-mode__archive-birthday-label';
    birthdayLabel.textContent = 'Birthday';
    const birthdayValue = document.createElement('span');
    birthdayValue.className = 'gallery-mode__archive-birthday-value';
    birthdayValue.textContent = display.birthdayText;
    birthdayRow.append(birthdayLabel, document.createTextNode(' '), birthdayValue);

    const ageRow = document.createElement('p');
    ageRow.className = 'gallery-mode__archive-age-line';
    const ageLabel = document.createElement('span');
    ageLabel.className = 'gallery-mode__archive-birthday-label';
    ageLabel.textContent = 'Age';
    const ageValue = document.createElement('span');
    ageValue.className = 'gallery-mode__archive-birthday-value';
    ageValue.textContent = String(display.age);
    ageRow.append(ageLabel, document.createTextNode(' '), ageValue);

    viewBirthdayMetaEl.append(birthdayRow, ageRow);
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
    if (!canEdit || !currentFilterKey || currentCategory !== 'heroes') return;
    if (isConnectionsEditing) exitConnectionsEditMode();
    intelEditDraft = {
        description: descriptionText || '',
        birthdayRaw: entry ? getHeroBirthdayRawFromEntry(entry) : '',
    };
    populateIntelEditFields(entry, descriptionText);
    setIntelEditingMode(true);
    editBodyEl?.focus();
}

function beginConnectionsEditMode() {
    if (!canEdit || !currentFilterKey || currentCategory !== 'heroes' || !currentEntry) return;
    if (isIntelEditing) exitIntelEditMode();

    const editor = window.BioArchiveConnectionsEditor;
    if (!editor?.render || !connectionsEditMount) return;

    const conns = Array.isArray(currentEntry.connections) ? currentEntry.connections : [];
    const bioOpts =
        editor.subjectOptsFromArchiveRow?.(currentEntry, 'heroes') || {
            subjectName: currentDisplayName || currentFilterKey,
            subjectKind: 'hero',
        };

    connectionsEditMount.replaceChildren();
    editor.render(connectionsEditMount, conns, bioOpts);
    setConnectionsEditingMode(true);
}

async function handleIntelSave() {
    if (
        !canEdit
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
    if (
        !canEdit
        || !currentFilterKey
        || currentCategory !== 'heroes'
        || connectionsSaveInFlight
        || !connectionsEditMount
    ) {
        return;
    }

    const editor = window.BioArchiveConnectionsEditor;
    const connections = editor?.collect?.(connectionsEditMount) ?? [];

    connectionsSaveInFlight = true;
    if (connectionsSaveBtn) connectionsSaveBtn.disabled = true;

    try {
        const result = await saveHeroArchiveEntryPatchFromBiographyStage(
            currentFilterKey,
            currentDisplayName,
            { connections },
        );
        if (!result.ok) {
            window.updateAppStatus?.(result.error || 'Could not save connections.', 'warning');
            return;
        }

        if (result.entry) currentEntry = result.entry;
        clearBioArchiveEventsCache('heroes');
        exitConnectionsEditMode();
        window.SoundEffectsManager?.play?.('save');
        if (connectionsSaveBtn && window.flashButton) {
            window.flashButton(connectionsSaveBtn, 'flash-green');
        }
        renderConnectionsBody(currentEntry, currentCategory);
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

    if (canEdit) {
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

        intelToolbarEl.append(intelEditBtn, intelSaveBtn, intelCancelBtn);

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

        connectionsToolbarEl.append(connectionsEditBtn, connectionsSaveBtn, connectionsCancelBtn);
    }

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
    connectionsViewEl.className =
        'gallery-mode__archive-connections-view gallery-mode__archive-panel-scroll scrollbar-custom';
    connectionsViewEl.setAttribute('tabindex', '0');
    connectionsViewEl.setAttribute('aria-label', 'Archive connections');

    connectionsBodyEl = document.createElement('div');
    connectionsBodyEl.className =
        'gallery-mode__archive-description-body gallery-mode__archive-connections-body';
    connectionsBodyEl.setAttribute('aria-label', 'Archive connections list');

    connectionsEmptyEl = document.createElement('p');
    connectionsEmptyEl.className = 'gallery-mode__archive-description-empty';
    connectionsEmptyEl.textContent = 'No connections recorded for this entry.';

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

    connectionsViewEl.append(connectionsBodyEl, connectionsEmptyEl);

    if (intelToolbarEl) intelPanelEl.append(intelHeading, intelToolbarEl);
    else intelPanelEl.append(intelHeading);
    intelPanelEl.append(intelScrollEl);

    if (connectionsToolbarEl) {
        connectionsPanelEl.append(connectionsHeading, connectionsToolbarEl);
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

    if (intelToolbarEl) intelToolbarEl.hidden = !canEdit || !isHero;
    if (connectionsToolbarEl) connectionsToolbarEl.hidden = !canEdit || !isHero;

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
    renderConnectionsBody(entry, cat);

    const hasIntel = !!(description || birthdayDisplay);

    setIntelPanelVisible(hasIntel || (canEdit && isHero) || !isHero);
    setConnectionsPanelVisible(supportsConnections);

    if (canEdit && intelEditBtn) {
        intelEditBtn.disabled = !isHero;
        intelEditBtn.title = isHero ? 'Edit biography and birthday' : 'Editing is only available for heroes';
    }
    if (canEdit && connectionsEditBtn) {
        connectionsEditBtn.disabled = !isHero;
        connectionsEditBtn.title = isHero ? 'Edit hero connections' : 'Connections editing is only for heroes';
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
    editBodyEl = null;
    intelScrollEl = null;
    intelEmptyEl = null;
    connectionsEmptyEl = null;
    currentEntry = null;
    clearBioArchiveEventsCache();
}
