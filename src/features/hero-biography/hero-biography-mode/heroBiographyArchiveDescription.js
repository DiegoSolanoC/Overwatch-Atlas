/**
 * Floating heroes-archive description on the left of Hero Biography stage.
 * Local dev: inline edit + save for description and birthday.
 */

import { createHeroBirthdayFieldSet } from '../../system-interface/interface-shared/bio-archive/HeroBirthdayFieldSet.js';
import { getHeroBirthdayRawFromEntry } from '../../system-interface/interface-shared/bio-archive/HeroBirthdayAge.js';
import { isHeroBiographyLocalDev } from './heroBiographyLocalDev.js';
import { saveHeroArchiveBioFromBiographyStage } from './heroBiographyArchivePersist.js';
import {
    clearHeroBiographyConnectionsView,
    renderHeroBiographyConnectionsView,
} from './heroBiographyArchiveConnectionsView.js';
import {
    clearHeroesArchiveEventsCache,
    findHeroArchiveEntryByFilterKey,
    getHeroArchiveBioDescription,
    getHeroArchiveBirthdayAgeDisplay,
    loadHeroesArchiveEvents,
} from './heroBiographyArchiveData.js';

const ICON_INTEL =
    'src/assets/images/Icons/Mode%20Icons/Story%20Timeline.png';
const ICON_CONNECTIONS =
    'src/assets/images/Icons/Mode%20Icons/Connection%20Codex.png';

/** @typedef {'intel' | 'connections'} HeroBioArchiveViewMode */

/** @type {HTMLElement | null} */
let panelEl = null;

/** @type {HTMLElement | null} */
let toolbarEl = null;

/** @type {HTMLButtonElement | null} */
let editBtn = null;

/** @type {HTMLButtonElement | null} */
let saveBtn = null;

/** @type {HTMLButtonElement | null} */
let cancelBtn = null;

/** @type {HTMLElement | null} */
let viewBirthdayMetaEl = null;

/** @type {HTMLElement | null} */
let editBirthdayEl = null;

/** @type {ReturnType<typeof createHeroBirthdayFieldSet> | null} */
let birthdayFields = null;

/** @type {HTMLElement | null} */
let viewBodyEl = null;

/** @type {HTMLElement | null} */
let connectionsBodyEl = null;

/** @type {HTMLElement | null} */
let editBodyEl = null;

/** @type {HTMLElement | null} */
let emptyEl = null;

/** @type {HTMLElement | null} */
let viewToggleEl = null;

/** @type {HTMLButtonElement | null} */
let intelToggleBtn = null;

/** @type {HTMLButtonElement | null} */
let connectionsToggleBtn = null;

/** @type {HeroBioArchiveViewMode} */
let viewMode = 'intel';

/** @type {object | null} */
let currentEntry = null;

/** @type {string | null} */
let currentHeroFilterKey = null;

/** @type {string} */
let currentHeroDisplayName = '';

let isEditing = false;

/** @type {{ description: string, birthdayRaw: string } | null} */
let editDraft = null;

let loadGeneration = 0;

let saveInFlight = false;

const canEdit = isHeroBiographyLocalDev();

function setVisible(show) {
    if (!panelEl) return;
    panelEl.classList.toggle('is-visible', show);
    panelEl.setAttribute('aria-hidden', show ? 'false' : 'true');
}

function setEditingMode(editing) {
    isEditing = editing;
    if (!panelEl) return;
    panelEl.classList.toggle('is-editing', editing);
    if (viewBirthdayMetaEl) viewBirthdayMetaEl.hidden = editing;
    if (editBirthdayEl) editBirthdayEl.hidden = !editing;
    if (editBodyEl) editBodyEl.hidden = !editing;
    if (editBtn) editBtn.hidden = editing;
    if (saveBtn) saveBtn.hidden = !editing;
    if (cancelBtn) cancelBtn.hidden = !editing;
    if (viewToggleEl) viewToggleEl.hidden = editing;
    if (editing) {
        if (viewBodyEl) viewBodyEl.hidden = true;
        if (connectionsBodyEl) connectionsBodyEl.hidden = true;
        if (emptyEl) emptyEl.hidden = true;
    } else {
        applyViewMode();
    }
}

/**
 * @param {string} label
 * @param {string} iconSrc
 * @param {HeroBioArchiveViewMode} mode
 */
function createViewToggleButton(label, iconSrc, mode) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hero-biography-mode__archive-view-toggle-btn';
    btn.setAttribute('aria-pressed', mode === viewMode ? 'true' : 'false');

    const icon = document.createElement('img');
    icon.className = 'hero-biography-mode__archive-view-toggle-btn__icon';
    icon.src = iconSrc;
    icon.alt = '';
    icon.decoding = 'async';
    icon.draggable = false;

    const text = document.createElement('span');
    text.className = 'hero-biography-mode__archive-view-toggle-btn__label';
    text.textContent = label;

    btn.append(icon, text);
    btn.addEventListener('click', () => {
        if (viewMode === mode || isEditing) return;
        viewMode = mode;
        applyViewMode();
        window.SoundEffectsManager?.play?.('filterButton');
    });
    return btn;
}

function applyViewMode() {
    if (!viewBodyEl || !connectionsBodyEl || !emptyEl) return;

    const showIntel = viewMode === 'intel';
    viewBodyEl.hidden = !showIntel;
    connectionsBodyEl.hidden = showIntel;

    if (intelToggleBtn) {
        intelToggleBtn.classList.toggle('is-active', showIntel);
        intelToggleBtn.setAttribute('aria-pressed', showIntel ? 'true' : 'false');
    }
    if (connectionsToggleBtn) {
        connectionsToggleBtn.classList.toggle('is-active', !showIntel);
        connectionsToggleBtn.setAttribute('aria-pressed', !showIntel ? 'true' : 'false');
    }

    if (showIntel) {
        const hasDescription = !!(viewBodyEl.textContent || '').trim();
        const hasBirthday = viewBirthdayMetaEl && !viewBirthdayMetaEl.hidden;
        emptyEl.hidden = hasDescription || hasBirthday;
        emptyEl.textContent = 'No biography written yet for this hero.';
    } else {
        const hasConnections = !!connectionsBodyEl.querySelector(
            '.event-slide-bio-connections__group',
        );
        emptyEl.hidden = hasConnections;
        emptyEl.textContent = 'No connections recorded for this hero.';
    }
}

function renderIntelBody(description) {
    if (!viewBodyEl) return;
    viewBodyEl.textContent = description || '';
}

function renderConnectionsBody(entry) {
    if (!connectionsBodyEl) return;
    renderHeroBiographyConnectionsView(connectionsBodyEl, entry);
}

function renderBirthdayMeta(display) {
    if (!viewBirthdayMetaEl) return;
    if (!display) {
        viewBirthdayMetaEl.hidden = true;
        viewBirthdayMetaEl.replaceChildren();
        return;
    }
    viewBirthdayMetaEl.hidden = false;
    viewBirthdayMetaEl.replaceChildren();

    const birthdayRow = document.createElement('p');
    birthdayRow.className = 'hero-biography-mode__archive-birthday-line';
    const birthdayLabel = document.createElement('span');
    birthdayLabel.className = 'hero-biography-mode__archive-birthday-label';
    birthdayLabel.textContent = 'Birthday';
    const birthdayValue = document.createElement('span');
    birthdayValue.className = 'hero-biography-mode__archive-birthday-value';
    birthdayValue.textContent = display.birthdayText;
    birthdayRow.append(birthdayLabel, document.createTextNode(' '), birthdayValue);

    const ageRow = document.createElement('p');
    ageRow.className = 'hero-biography-mode__archive-age-line';
    const ageLabel = document.createElement('span');
    ageLabel.className = 'hero-biography-mode__archive-birthday-label';
    ageLabel.textContent = 'Age';
    const ageValue = document.createElement('span');
    ageValue.className = 'hero-biography-mode__archive-birthday-value';
    ageValue.textContent = String(display.age);
    ageRow.append(ageLabel, document.createTextNode(' '), ageValue);

    viewBirthdayMetaEl.append(birthdayRow, ageRow);
}

function populateEditFields(entry, descriptionText) {
    const raw = entry ? getHeroBirthdayRawFromEntry(entry) : '';
    birthdayFields?.populate(raw);
    if (editBodyEl) {
        editBodyEl.textContent = descriptionText || '';
    }
}

function exitEditMode() {
    editDraft = null;
    setEditingMode(false);
}

function beginEditMode(entry, descriptionText) {
    if (!canEdit || !currentHeroFilterKey) return;
    editDraft = {
        description: descriptionText || '',
        birthdayRaw: entry ? getHeroBirthdayRawFromEntry(entry) : '',
    };
    populateEditFields(entry, descriptionText);
    setEditingMode(true);
    editBodyEl?.focus();
}

async function handleSave() {
    if (!canEdit || !currentHeroFilterKey || saveInFlight || !birthdayFields || !editBodyEl) return;

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

    saveInFlight = true;
    if (saveBtn) saveBtn.disabled = true;

    try {
        const result = await saveHeroArchiveBioFromBiographyStage(
            currentHeroFilterKey,
            currentHeroDisplayName,
            { description, birthday },
        );
        if (!result.ok) {
            window.updateAppStatus?.(result.error || 'Could not save hero bio.', 'warning');
            return;
        }

        clearHeroesArchiveEventsCache();
        exitEditMode();
        window.SoundEffectsManager?.play?.('save');
        if (saveBtn && window.flashButton) {
            window.flashButton(saveBtn, 'flash-green');
        }
        await setHeroBiographyArchiveDescriptionHero(currentHeroFilterKey, currentHeroDisplayName);
    } catch (err) {
        console.warn('[hero-biography] Bio save failed:', err);
        window.updateAppStatus?.('Could not save hero bio.', 'warning');
    } finally {
        saveInFlight = false;
        if (saveBtn) saveBtn.disabled = false;
    }
}

function handleCancel() {
    if (!editDraft) {
        exitEditMode();
        return;
    }
    birthdayFields?.populate(editDraft.birthdayRaw);
    if (editBodyEl) editBodyEl.textContent = editDraft.description;
    exitEditMode();
}

/**
 * @param {HTMLElement} hostEl — `#atlasHeroBiographyHost`
 */
export function initHeroBiographyArchiveDescription(hostEl) {
    if (panelEl) return;

    panelEl = document.createElement('aside');
    panelEl.className = 'hero-biography-mode__archive-description';
    panelEl.setAttribute('aria-label', 'Hero biography');
    panelEl.setAttribute('aria-hidden', 'true');

    if (canEdit) {
        toolbarEl = document.createElement('div');
        toolbarEl.className = 'hero-biography-mode__archive-description-toolbar';

        editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'hero-biography-mode__archive-description-btn';
        editBtn.textContent = 'Edit';
        editBtn.addEventListener('click', async () => {
            if (!currentHeroFilterKey) return;
            clearHeroesArchiveEventsCache();
            const events = await loadHeroesArchiveEvents();
            const entry = findHeroArchiveEntryByFilterKey(currentHeroFilterKey, events);
            const description = getHeroArchiveBioDescription(entry) || '';
            beginEditMode(entry, description);
        });

        saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'hero-biography-mode__archive-description-btn hero-biography-mode__archive-description-btn--primary';
        saveBtn.textContent = 'Save';
        saveBtn.hidden = true;
        saveBtn.addEventListener('click', () => void handleSave());

        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'hero-biography-mode__archive-description-btn';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.hidden = true;
        cancelBtn.addEventListener('click', handleCancel);

        toolbarEl.append(editBtn, saveBtn, cancelBtn);
    }

    viewBirthdayMetaEl = document.createElement('div');
    viewBirthdayMetaEl.className = 'hero-biography-mode__archive-birthday-meta';
    viewBirthdayMetaEl.hidden = true;

    editBirthdayEl = document.createElement('div');
    editBirthdayEl.className = 'hero-biography-mode__archive-birthday-edit';
    editBirthdayEl.hidden = true;
    const birthdayLabel = document.createElement('span');
    birthdayLabel.className = 'hero-biography-mode__archive-birthday-edit-label';
    birthdayLabel.textContent = 'Birthday';
    editBirthdayEl.append(birthdayLabel);
    birthdayFields = createHeroBirthdayFieldSet(editBirthdayEl, 'heroBioArchive');

    viewBodyEl = document.createElement('div');
    viewBodyEl.className = 'hero-biography-mode__archive-description-body';

    connectionsBodyEl = document.createElement('div');
    connectionsBodyEl.className =
        'hero-biography-mode__archive-description-body hero-biography-mode__archive-connections-body';
    connectionsBodyEl.hidden = true;
    connectionsBodyEl.setAttribute('aria-label', 'Hero connections');

    editBodyEl = document.createElement('div');
    editBodyEl.className = 'hero-biography-mode__archive-description-body hero-biography-mode__archive-description-body--edit';
    editBodyEl.hidden = true;
    editBodyEl.contentEditable = 'true';
    editBodyEl.setAttribute('spellcheck', 'true');
    editBodyEl.setAttribute('aria-label', 'Hero biography description');

    emptyEl = document.createElement('p');
    emptyEl.className = 'hero-biography-mode__archive-description-empty';
    emptyEl.textContent = 'No biography written yet for this hero.';

    viewToggleEl = document.createElement('div');
    viewToggleEl.className = 'hero-biography-mode__archive-view-toggle';
    viewToggleEl.setAttribute('role', 'group');
    viewToggleEl.setAttribute('aria-label', 'Biography panel view');

    intelToggleBtn = createViewToggleButton('Show Intel', ICON_INTEL, 'intel');
    connectionsToggleBtn = createViewToggleButton(
        'Show Connections',
        ICON_CONNECTIONS,
        'connections',
    );
    intelToggleBtn.classList.add('is-active');
    viewToggleEl.append(intelToggleBtn, connectionsToggleBtn);

    if (toolbarEl) panelEl.append(toolbarEl);
    panelEl.append(
        viewBirthdayMetaEl,
        editBirthdayEl,
        viewBodyEl,
        connectionsBodyEl,
        editBodyEl,
        emptyEl,
        viewToggleEl,
    );
    hostEl.appendChild(panelEl);

    window.addEventListener('atlas-bio-archives-refreshed', (ev) => {
        if (!currentHeroFilterKey || isEditing) return;
        const archives = ev.detail?.archives;
        if (Array.isArray(archives) && archives.length > 0 && !archives.includes('heroes')) return;
        void setHeroBiographyArchiveDescriptionHero(currentHeroFilterKey, currentHeroDisplayName);
    });
}

/**
 * @param {string | null} heroFilterKey
 * @param {string} [heroDisplayName]
 */
export async function setHeroBiographyArchiveDescriptionHero(heroFilterKey, heroDisplayName = '') {
    const gen = ++loadGeneration;
    if (!panelEl || !viewBodyEl || !emptyEl) return;

    if (isEditing) exitEditMode();

    const key = heroFilterKey ? String(heroFilterKey).trim() : '';
    currentHeroFilterKey = key || null;
    currentHeroDisplayName = key ? String(heroDisplayName || key).trim() : '';
    viewMode = 'intel';
    currentEntry = null;

    if (!key) {
        renderBirthdayMeta(null);
        renderIntelBody('');
        clearHeroBiographyConnectionsView(connectionsBodyEl);
        emptyEl.hidden = true;
        if (toolbarEl) toolbarEl.hidden = true;
        if (viewToggleEl) viewToggleEl.hidden = true;
        setVisible(false);
        return;
    }

    if (toolbarEl) toolbarEl.hidden = false;
    if (viewToggleEl) viewToggleEl.hidden = false;

    let description = null;
    let birthdayDisplay = null;
    let entry = null;
    try {
        const events = await loadHeroesArchiveEvents();
        if (gen !== loadGeneration) return;
        entry = findHeroArchiveEntryByFilterKey(key, events);
        currentEntry = entry;
        description = getHeroArchiveBioDescription(entry);
        birthdayDisplay = getHeroArchiveBirthdayAgeDisplay(entry);
    } catch (err) {
        console.warn('[hero-biography] Could not load archive description:', err);
    }

    if (gen !== loadGeneration) return;

    renderBirthdayMeta(birthdayDisplay);
    renderIntelBody(description || '');
    renderConnectionsBody(entry);

    const hasIntel = !!(description || birthdayDisplay);
    const hasConnections = !!(
        entry
        && Array.isArray(entry.connections)
        && entry.connections.length > 0
    );
    setVisible(hasIntel || hasConnections || canEdit);
    applyViewMode();

    if (canEdit && editBtn) {
        editBtn.disabled = false;
        editBtn.title = 'Edit biography and birthday';
    }
}

export function destroyHeroBiographyArchiveDescription() {
    loadGeneration += 1;
    exitEditMode();
    currentHeroFilterKey = null;
    currentHeroDisplayName = '';
    panelEl?.remove();
    panelEl = null;
    toolbarEl = null;
    editBtn = null;
    saveBtn = null;
    cancelBtn = null;
    viewBirthdayMetaEl = null;
    editBirthdayEl = null;
    birthdayFields = null;
    viewBodyEl = null;
    connectionsBodyEl = null;
    editBodyEl = null;
    emptyEl = null;
    viewToggleEl = null;
    intelToggleBtn = null;
    connectionsToggleBtn = null;
    viewMode = 'intel';
    currentEntry = null;
    clearHeroesArchiveEventsCache();
}
