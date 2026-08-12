/**
 * Pick-and-mix modal for merging two story event JSON archives.
 */

import {
    buildMergedStoryEventsFromPlan,
    fieldSideHasEdit,
    formatMergeRowPositionNote,
    isStorySourcesField,
    isStoryStringListField,
    normalizeStorySourcesValue,
    resolveFieldEdit,
    resolveFieldSide,
    resolvePositionSide,
    serializeStoryFieldForEdit,
    storyEventDisplayLabel,
} from './mergeStoryEvents.js';
import { getSourceUrls } from '../../../interface-event-slide/standalone-slide/sources/sourceUrlUtils.js';
import {
    STORY_FACTION_FILTER_PLACES_OPTS,
    STORY_HERO_FILTER_PLACES_OPTS,
    STORY_NPC_FILTER_PLACES_OPTS,
    STORY_SECONDARY_PLACES_EDITOR_OPTS,
    normalizeCollectedPlaces,
} from '../../../interface-shared/storyEventFilterPlaces.js';
import { renderMergeEventPreviewCard } from './renderMergeEventPreviewCard.js';

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @returns {string}
 */
function renderRowMeta(row) {
    const parts = [];
    if (row.kind === 'reposition') {
        parts.push('<span class="story-events-merge-row__badge">Repositioned</span>');
    }
    const positionNote = formatMergeRowPositionNote(row);
    if (positionNote) {
        parts.push(`<p class="story-events-merge-row__position">${escapeHtml(positionNote)}</p>`);
    }
    if (row.matchNote && row.kind === 'reposition') {
        parts.push(`<p class="story-events-merge-row__match-note">${escapeHtml(row.matchNote)}</p>`);
    }
    return parts.join('');
}

/**
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @returns {string}
 */
function renderChangedFieldChips(row) {
    const fields = Array.isArray(row.changedFields) ? row.changedFields : [];
    if (!fields.length) return '';
    return `<div class="story-events-merge-row__chips">${fields
        .map((field) => `<span class="story-events-merge-chip">${escapeHtml(field)}</span>`)
        .join('')}</div>`;
}

/**
 * Position source toggle for a repositioned row.
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {number} index
 * @returns {string}
 */
function renderPositionToggle(row, index) {
    if (row.kind !== 'reposition') return '';
    const side = resolvePositionSide(row);
    const basePos = row.baseIndex != null ? `#${row.baseIndex + 1}` : '—';
    const incomingPos = row.incomingIndex != null ? `#${row.incomingIndex + 1}` : '—';
    return `
        <div class="story-events-merge-position">
            <span class="story-events-merge-position__title">Position</span>
            <label class="story-events-merge-seg story-events-merge-seg--base${side === 'base' ? ' story-events-merge-seg--active' : ''}">
                <input type="radio" name="pos-${index}" value="base" ${side === 'base' ? 'checked' : ''} />
                Keep current ${escapeHtml(basePos)}
            </label>
            <label class="story-events-merge-seg story-events-merge-seg--incoming${side === 'incoming' ? ' story-events-merge-seg--active' : ''}">
                <input type="radio" name="pos-${index}" value="incoming" ${side === 'incoming' ? 'checked' : ''} />
                Move to incoming ${escapeHtml(incomingPos)}
            </label>
        </div>
    `;
}

const MERGE_FIELD_LABELS = {
    name: 'Name',
    description: 'Description',
    yearStart: 'First year',
    yearEnd: 'Second year (optional)',
    eraName: 'Era name (optional)',
    cityDisplayName: 'Location label',
    locationType: 'Location type',
    lat: 'Latitude',
    lon: 'Longitude',
    x: 'X (0—100)',
    y: 'Y (0—100)',
    image: 'Image',
    headlines: 'Headlines (one per line)',
    sources: 'Sources',
    heroFilterPlaces: 'Relevant heroes (grouped)',
    factionFilterPlaces: 'Relevant factions (grouped)',
    npcFilterPlaces: 'Relevant NPCs (grouped)',
    secondaryCountryPlaces: 'Relevant countries & places (grouped)',
    relevantLocations: 'Relevant locations',
    connections: 'Connections',
    heroRole: 'Hero role',
    heroSubRole: 'Hero sub-role',
    birthday: 'Birthday',
};

const GROUPED_PLACES_FIELDS = new Set([
    'secondaryCountryPlaces',
    'heroFilterPlaces',
    'factionFilterPlaces',
    'npcFilterPlaces',
    'relevantLocations',
]);

/**
 * @param {string} field
 * @returns {boolean}
 */
function isGroupedPlacesField(field) {
    return GROUPED_PLACES_FIELDS.has(field);
}

/**
 * @param {string} field
 * @returns {object}
 */
function placesEditorOptsForField(field) {
    if (field === 'heroFilterPlaces') return STORY_HERO_FILTER_PLACES_OPTS;
    if (field === 'factionFilterPlaces') return STORY_FACTION_FILTER_PLACES_OPTS;
    if (field === 'npcFilterPlaces') return STORY_NPC_FILTER_PLACES_OPTS;
    if (field === 'relevantLocations') {
        return {
            placeholders: {
                locationName: 'Location / group label',
                country: 'Countries (comma-separated for multiple flags)',
                reasoning: 'Relevance (e.g. headquarters, place of origin)',
            },
            autocompleteType: 'countries',
        };
    }
    return STORY_SECONDARY_PLACES_EDITOR_OPTS;
}

/**
 * @param {string} field
 * @returns {string}
 */
function mergeFieldLabel(field) {
    return MERGE_FIELD_LABELS[field] || field;
}

/**
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {string} field
 * @param {'base'|'incoming'} side
 * @returns {unknown}
 */
function fieldSideValue(row, field, side) {
    const edited = resolveFieldEdit(row, field, side);
    if (edited !== undefined) return edited;
    const event = side === 'incoming' ? row.incomingEvent : row.baseEvent;
    return event && typeof event === 'object' && field in event ? event[field] : undefined;
}

/**
 * @param {string} url
 * @returns {string}
 */
function renderSourceLinkRowHtml(url) {
    return `
        <div class="event-slide-inline-editor__source-link-row">
            <input class="event-slide-inline-editor__input" type="url" data-role="source-url" placeholder="URL (optional)" value="${escapeHtml(url)}" autocomplete="on" />
            <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-link-remove" title="Remove link">−</button>
        </div>
    `;
}

/**
 * Match event-slide inline source row markup.
 * @param {unknown} source
 * @returns {string}
 */
function renderSourceRowHtml(source) {
    const text = escapeHtml(String(source?.text || ''));
    const urls = getSourceUrls(source);
    const linkValues = urls.length > 0 ? urls : [''];
    return `
        <div class="event-slide-inline-editor__source-row">
            <input class="event-slide-inline-editor__input" type="text" data-role="source-text" placeholder="Source text" value="${text}" spellcheck="true" autocomplete="on" />
            <div class="event-slide-inline-editor__source-links" data-role="source-links">
                ${linkValues.map((url) => renderSourceLinkRowHtml(url)).join('')}
                <button type="button" class="event-slide-inline-editor__small-btn event-slide-inline-editor__source-link-add" data-role="source-link-add">+ link</button>
            </div>
            <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-remove" title="Remove source">−</button>
        </div>
    `;
}

/**
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {string} field
 * @param {'base'|'incoming'} side
 * @returns {string}
 */
function renderSourcesEditor(row, field, side) {
    const value = fieldSideValue(row, field, side);
    const sources = normalizeStorySourcesValue(value);
    const rows = sources.length > 0 ? sources : [{ text: '', url: '' }];
    return `
        <div class="event-slide-inline-editor__row" data-field-edit-sources="${escapeHtml(field)}" data-field-side="${side}">
            <div class="event-slide-inline-editor__label">${escapeHtml(mergeFieldLabel(field))}</div>
            <div class="event-slide-inline-editor__sources" data-role="sources-list">
                ${rows.map((source) => renderSourceRowHtml(source)).join('')}
            </div>
            <div class="event-slide-inline-editor__actions">
                <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-add">+ Source</button>
            </div>
        </div>
    `;
}

/**
 * @param {HTMLElement} container
 * @returns {Array<{ text: string, url?: string, urls?: string[] }>}
 */
function readSourcesFromEditor(container) {
    /** @type {Array<{ text: string, url?: string, urls?: string[] }>} */
    const sources = [];
    container.querySelectorAll('.event-slide-inline-editor__source-row').forEach((row) => {
        const textInput = row.querySelector('[data-role="source-text"]');
        const text = textInput instanceof HTMLInputElement ? textInput.value.trim() : '';
        const urls = Array.from(row.querySelectorAll('[data-role="source-url"]'))
            .map((input) => (input instanceof HTMLInputElement ? input.value.trim() : ''))
            .filter(Boolean);
        if (!text && urls.length === 0) return;
        if (urls.length === 0) sources.push({ text });
        else if (urls.length === 1) sources.push({ text, url: urls[0] });
        else sources.push({ text, url: urls[0], urls });
    });
    return sources;
}

/**
 * @param {string} field
 * @param {unknown} value
 * @param {'base'|'incoming'} side
 * @returns {string}
 */
function renderLocationTypeEditor(field, value, side) {
    const current = String(value || 'earth');
    const types = [
        ['earth', 'Earth'],
        ['moon', 'Moon'],
        ['mars', 'Mars'],
        ['station', 'Station'],
        ['marsShip', 'Ship'],
    ];
    return `
        <div class="event-slide-inline-editor__row">
            <div class="event-slide-inline-editor__label">${escapeHtml(mergeFieldLabel(field))}</div>
            <div class="event-slide-inline-editor__loc-types" role="group" aria-label="Location type" data-field-edit-location="${escapeHtml(field)}" data-field-side="${side}">
                ${types
                    .map(
                        ([type, label]) => `
                    <button type="button" class="event-slide-loc-type-btn${current === type ? ' active' : ''}" data-location-type="${type}">${label}</button>
                `,
                    )
                    .join('')}
            </div>
        </div>
    `;
}

/**
 * Grouped relevancy rows — mounted with HeroRelevantLocationsEditor after insert.
 * @param {string} field
 * @param {'base'|'incoming'} side
 * @param {number} index
 * @returns {string}
 */
function renderPlacesEditorShell(field, side, index) {
    const listId = `mergePlaces-${index}-${side}-${field}`;
    return `
        <div class="event-slide-inline-editor__row" data-field-edit-places="${escapeHtml(field)}" data-field-side="${side}">
            <div class="event-slide-inline-editor__label">${escapeHtml(mergeFieldLabel(field))}</div>
            <div
                id="${escapeHtml(listId)}"
                class="event-slide-inline-editor__relevant-locs"
                data-role="places-list"
                data-inline-grouped-places="1"
                aria-label="${escapeHtml(mergeFieldLabel(field))}"
            ></div>
            <div class="event-slide-inline-editor__actions">
                <button
                    type="button"
                    class="event-slide-inline-editor__small-btn"
                    data-role="places-add"
                    data-places-container="${escapeHtml(listId)}"
                >+ Add group</button>
            </div>
        </div>
    `;
}

/**
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {string} field
 * @param {'base'|'incoming'} side
 * @returns {string}
 */
function renderPlainFieldEditor(row, field, side) {
    const value = fieldSideValue(row, field, side);
    const originalValue = (side === 'incoming' ? row.incomingEvent : row.baseEvent)?.[field];
    const useLineList = isStoryStringListField(field, originalValue) || field === 'headlines';
    const text = serializeStoryFieldForEdit(field, value);
    const label = escapeHtml(mergeFieldLabel(field));
    const isLongText = field === 'description'
        || useLineList
        || (typeof originalValue === 'object' && originalValue != null)
        || text.length > 80
        || text.includes('\n');

    if (isLongText) {
        const rows = Math.min(18, Math.max(useLineList ? 4 : 3, text.split('\n').length + 1));
        return `
            <div class="event-slide-inline-editor__row">
                <label class="event-slide-inline-editor__label">${label}</label>
                <textarea
                    class="event-slide-inline-editor__textarea"
                    data-field-edit="${escapeHtml(field)}"
                    data-field-side="${side}"
                    rows="${rows}"
                    spellcheck="true"
                    ${useLineList ? 'placeholder="One entry per line"' : ''}
                >${escapeHtml(text)}</textarea>
            </div>
        `;
    }

    const inputType = field === 'yearStart' || field === 'yearEnd' || field === 'lat' || field === 'lon'
        || field === 'x' || field === 'y' || field === 'birthday'
        ? 'number'
        : 'text';

    return `
        <div class="event-slide-inline-editor__row">
            <label class="event-slide-inline-editor__label">${label}</label>
            <input
                class="event-slide-inline-editor__input"
                type="${inputType}"
                data-field-edit="${escapeHtml(field)}"
                data-field-side="${side}"
                value="${escapeHtml(text)}"
                spellcheck="true"
                autocomplete="on"
                ${inputType === 'number' ? 'step="any"' : ''}
            />
        </div>
    `;
}

/**
 * One editable side (Current or Incoming) for a differing field.
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {number} index
 * @param {string} field
 * @param {'base'|'incoming'} side
 * @param {string} radioName
 * @returns {string}
 */
function renderEditableFieldSide(row, index, field, side, radioName) {
    const selected = resolveFieldSide(row, field) === side;
    const isEdited = fieldSideHasEdit(row, field, side);
    const sideClass = side === 'base' ? 'base' : 'incoming';
    const sideLabel = side === 'base' ? 'Current' : 'Incoming';
    const originalValue = (side === 'incoming' ? row.incomingEvent : row.baseEvent)?.[field];
    const value = fieldSideValue(row, field, side);

    let editorHtml;
    if (isStorySourcesField(field, originalValue) || field === 'sources') {
        editorHtml = renderSourcesEditor(row, field, side);
    } else if (isGroupedPlacesField(field)) {
        editorHtml = renderPlacesEditorShell(field, side, index);
    } else if (field === 'locationType') {
        editorHtml = renderLocationTypeEditor(field, value, side);
    } else {
        editorHtml = renderPlainFieldEditor(row, field, side);
    }

    return `
        <div class="story-events-merge-seg story-events-merge-seg--${sideClass}${selected ? ' story-events-merge-seg--active' : ''}${isEdited ? ' story-events-merge-seg--edited' : ''}" data-field-side="${side}" data-field-panel="${escapeHtml(field)}">
            <div class="story-events-merge-field__toolbar">
                <label class="story-events-merge-field__pick">
                    <input type="radio" name="${radioName}" value="${side}" data-field-input="${escapeHtml(field)}" ${selected ? 'checked' : ''} />
                    <span class="story-events-merge-field__label">${sideLabel}${isEdited ? ' · edited' : ''}</span>
                </label>
                <button type="button" class="story-events-merge-field-reset"${isEdited ? '' : ' hidden'} data-field-reset="${escapeHtml(field)}" data-field-side="${side}" title="Revert to original ${sideLabel.toLowerCase()} value">Reset</button>
            </div>
            <div class="event-slide-inline-editor">
                ${editorHtml}
            </div>
        </div>
    `;
}

/**
 * Per-field picker table for a paired row.
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {number} index
 * @returns {string}
 */
function renderFieldPicks(row, index) {
    const fields = Array.isArray(row.changedFields) ? row.changedFields : [];
    if (!fields.length) return '';

    const rowsHtml = fields
        .map((field) => {
            const name = `field-${index}-${encodeURIComponent(field)}`;
            return `
                <div class="story-events-merge-field" data-field="${escapeHtml(field)}">
                    <span class="story-events-merge-field__name">${escapeHtml(field)}</span>
                    <div class="story-events-merge-field__opts">
                        ${renderEditableFieldSide(row, index, field, 'base', name)}
                        ${renderEditableFieldSide(row, index, field, 'incoming', name)}
                    </div>
                </div>
            `;
        })
        .join('');

    return `
        <div class="story-events-merge-fields">
            <div class="story-events-merge-fields__head">
                <p class="story-events-merge-fields__title">Field-by-field — edit either side, then choose which value to keep</p>
                <div class="story-events-merge-fields__bulk">
                    <button type="button" class="story-events-merge-fieldbulk" data-field-all="base" data-row="${index}">All current</button>
                    <button type="button" class="story-events-merge-fieldbulk" data-field-all="incoming" data-row="${index}">All incoming</button>
                </div>
            </div>
            ${rowsHtml}
        </div>
    `;
}

/**
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {number} index
 * @param {'conflict'|'single'} mode
 * @returns {string}
 */
function renderPickOption(row, index, mode) {
    if (mode === 'conflict') {
        return `
            <div class="story-events-merge-row__columns">
                <div class="story-events-merge-side story-events-merge-side--base">
                    <span class="story-events-merge-pick__label">Current (in use)</span>
                    ${renderMergeEventPreviewCard(row.baseEvent)}
                </div>
                <div class="story-events-merge-side story-events-merge-side--incoming">
                    <span class="story-events-merge-pick__label">Incoming file</span>
                    ${renderMergeEventPreviewCard(row.incomingEvent)}
                </div>
            </div>
            ${renderPositionToggle(row, index)}
            ${renderFieldPicks(row, index)}
        `;
    }

    const checked = row.include !== false;
    const heading = row.kind === 'onlyBase' ? 'Only in current data' : 'Only in incoming file';
    const event = row.kind === 'onlyBase' ? row.baseEvent : row.incomingEvent;
    const sideClass =
        row.kind === 'onlyBase'
            ? 'story-events-merge-pick--only-base'
            : 'story-events-merge-pick--only-incoming';

    return `
        <label class="story-events-merge-pick story-events-merge-pick--single ${sideClass}${checked ? ' story-events-merge-pick--selected' : ''}">
            <input type="checkbox" class="story-events-merge-pick__input" data-include-row="${index}" ${checked ? 'checked' : ''} />
            <span class="story-events-merge-pick__label">${escapeHtml(heading)}</span>
            ${renderMergeEventPreviewCard(event)}
        </label>
    `;
}

/**
 * @param {import('./mergeStoryEvents.js').StoryEventsMergePlan} plan
 * @returns {Promise<object[]|null>} merged events, or null if cancelled
 */
export function openStoryEventsMergeModal(plan) {
    return new Promise((resolve) => {
        /** @type {import('./mergeStoryEvents.js').MergeRow[]} */
        const workingRows = plan.rows.map((row) => ({
            ...row,
            fieldPicks: { ...(row.fieldPicks || {}) },
            fieldEdits: {},
        }));

        const overlay = document.createElement('div');
        overlay.className = 'story-events-merge-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'storyEventsMergeTitle');

        const conflictCount = workingRows.filter((row) => row.kind === 'conflict').length;
        const repositionCount = workingRows.filter((row) => row.kind === 'reposition').length;
        const onlyBaseCount = workingRows.filter((row) => row.kind === 'onlyBase').length;
        const onlyIncomingCount = workingRows.filter((row) => row.kind === 'onlyIncoming').length;

        overlay.innerHTML = `
            <div class="story-events-merge-dialog">
                <header class="story-events-merge-dialog__header">
                    <div class="story-events-merge-dialog__header-top">
                        <h2 class="story-events-merge-dialog__title" id="storyEventsMergeTitle">Merge story events</h2>
                        <button type="button" class="story-events-merge-dialog__close" id="storyEventsMergeClose" aria-label="Close merge dialog">&times;</button>
                    </div>
                    <div class="story-events-merge-dialog__stats">
                        <span class="story-events-merge-stat"><strong>${plan.identicalCount}</strong> identical</span>
                        <span class="story-events-merge-stat story-events-merge-stat--conflict"><strong>${conflictCount}</strong> content conflicts</span>
                        <span class="story-events-merge-stat story-events-merge-stat--reposition"><strong>${repositionCount}</strong> repositioned</span>
                        <span class="story-events-merge-stat story-events-merge-stat--base"><strong>${onlyBaseCount}</strong> only current</span>
                        <span class="story-events-merge-stat story-events-merge-stat--incoming"><strong>${onlyIncomingCount}</strong> only incoming</span>
                    </div>
                    <p class="story-events-merge-dialog__hint">
                        For each changed row, choose <strong>Position</strong> and pick <strong>each differing field</strong> from Current or Incoming.
                        Click anywhere on a side to select it.                         Field editors match the event info panel edit mode (labels, inputs, source rows, and grouped relevancy rows).
                        Incoming-only events insert at their incoming placement.
                    </p>
                </header>
                <div class="story-events-merge-dialog__toolbar">
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="conflicts-base">Current for all conflicts</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="conflicts-incoming">Incoming for all conflicts</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="reposition-base">Current for all repositioned</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="reposition-incoming">Incoming for all repositioned</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="incoming-on">Include all incoming-only</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="incoming-off">Skip all incoming-only</button>
                </div>
                <div class="story-events-merge-dialog__nav" id="storyEventsMergeNav">
                    <button type="button" class="story-events-merge-nav-btn" id="storyEventsMergePrev" aria-label="Previous change">‹ Prev</button>
                    <div class="story-events-merge-nav__center">
                        <span class="story-events-merge-nav__counter" id="storyEventsMergeCounter"></span>
                        <div class="story-events-merge-nav__strip" id="storyEventsMergeStrip"></div>
                    </div>
                    <button type="button" class="story-events-merge-nav-btn" id="storyEventsMergeNext" aria-label="Next change">Next ›</button>
                </div>
                <div class="story-events-merge-dialog__body" id="storyEventsMergeBody"></div>
                <footer class="story-events-merge-dialog__actions">
                    <button type="button" class="story-events-merge-btn" id="storyEventsMergeCancel">Cancel</button>
                    <button type="button" class="story-events-merge-btn story-events-merge-btn--primary" id="storyEventsMergeApply">Apply merge</button>
                </footer>
            </div>
        `;

        const bodyEl = overlay.querySelector('#storyEventsMergeBody');
        const cancelBtn = overlay.querySelector('#storyEventsMergeCancel');
        const closeBtn = overlay.querySelector('#storyEventsMergeClose');
        const applyBtn = overlay.querySelector('#storyEventsMergeApply');
        const navEl = overlay.querySelector('#storyEventsMergeNav');
        const prevBtn = overlay.querySelector('#storyEventsMergePrev');
        const nextBtn = overlay.querySelector('#storyEventsMergeNext');
        const counterEl = overlay.querySelector('#storyEventsMergeCounter');
        const stripEl = overlay.querySelector('#storyEventsMergeStrip');

        /** Index of the change currently shown (one row at a time). */
        let currentIndex = 0;
        /** Rows the user has opened in the pager (manual audit progress). */
        const auditedIndices = new Set();
        /** Nested confirm overlay while Apply is pending. */
        let confirmEl = null;

        const close = (value) => {
            dismissApplyConfirm();
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            document.body.classList.remove('story-events-merge-open');
            resolve(value);
        };

        const isTypingTarget = (el) =>
            el instanceof HTMLElement &&
            (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

        const markAudited = (index) => {
            if (!Number.isFinite(index) || index < 0 || index >= workingRows.length) return;
            auditedIndices.add(index);
        };

        const unauditedIndices = () =>
            workingRows
                .map((_, index) => index)
                .filter((index) => !auditedIndices.has(index));

        const dismissApplyConfirm = () => {
            if (!confirmEl) return;
            confirmEl.remove();
            confirmEl = null;
        };

        /**
         * @returns {boolean} true if a confirm dialog was open and closed
         */
        const tryDismissApplyConfirm = () => {
            if (!confirmEl) return false;
            dismissApplyConfirm();
            return true;
        };

        const openApplyConfirm = () => {
            if (confirmEl) return;

            const unaudited = unauditedIndices();
            const total = workingRows.length;
            const auditedCount = total - unaudited.length;
            const hasUnaudited = unaudited.length > 0;

            const unauditedPreview = unaudited
                .slice(0, 8)
                .map((index) => {
                    const row = workingRows[index];
                    const label = storyEventDisplayLabel(row.baseEvent || row.incomingEvent);
                    return `<li><button type="button" class="story-events-merge-confirm__jump" data-confirm-goto="${index}">#${index + 1} — ${escapeHtml(label)}</button></li>`;
                })
                .join('');
            const moreUnaudited =
                unaudited.length > 8
                    ? `<p class="story-events-merge-confirm__more">…and ${unaudited.length - 8} more</p>`
                    : '';

            const warningBlock = hasUnaudited
                ? `
                    <div class="story-events-merge-confirm__warning" role="status">
                        <p><strong>${unaudited.length}</strong> of <strong>${total}</strong> change${total === 1 ? '' : 's'} ${unaudited.length === 1 ? 'has' : 'have'} not been opened yet. Defaults will be used for those rows.</p>
                        <ul class="story-events-merge-confirm__list">${unauditedPreview}</ul>
                        ${moreUnaudited}
                    </div>
                `
                : `
                    <p class="story-events-merge-confirm__ok">All <strong>${total}</strong> change${total === 1 ? '' : 's'} ${total === 1 ? 'has' : 'have'} been opened (${auditedCount}/${total}).</p>
                `;

            confirmEl = document.createElement('div');
            confirmEl.className = 'story-events-merge-confirm';
            confirmEl.setAttribute('role', 'dialog');
            confirmEl.setAttribute('aria-modal', 'true');
            confirmEl.setAttribute('aria-labelledby', 'storyEventsMergeConfirmTitle');
            confirmEl.innerHTML = `
                <div class="story-events-merge-confirm__panel">
                    <h3 class="story-events-merge-confirm__title" id="storyEventsMergeConfirmTitle">Apply this merge?</h3>
                    <p class="story-events-merge-confirm__body">
                        This writes the merged timeline into the live Story Events data
                        (${plan.identicalCount} identical kept
                        · ${conflictCount} conflict${conflictCount === 1 ? '' : 's'}
                        · ${repositionCount} repositioned
                        · ${onlyBaseCount} only-current
                        · ${onlyIncomingCount} only-incoming).
                    </p>
                    ${warningBlock}
                    <div class="story-events-merge-confirm__actions">
                        <button type="button" class="story-events-merge-btn" id="storyEventsMergeConfirmCancel">Cancel</button>
                        <button type="button" class="story-events-merge-btn story-events-merge-btn--primary${hasUnaudited ? ' story-events-merge-btn--danger' : ''}" id="storyEventsMergeConfirmApply">
                            ${hasUnaudited ? 'Apply anyway' : 'Confirm apply'}
                        </button>
                    </div>
                </div>
            `;

            const cancelConfirmBtn = confirmEl.querySelector('#storyEventsMergeConfirmCancel');
            const applyConfirmBtn = confirmEl.querySelector('#storyEventsMergeConfirmApply');

            cancelConfirmBtn?.addEventListener('click', () => dismissApplyConfirm());
            applyConfirmBtn?.addEventListener('click', () => {
                dismissApplyConfirm();
                close(buildMergedStoryEventsFromPlan(plan, workingRows));
            });
            confirmEl.addEventListener('click', (event) => {
                if (event.target === confirmEl) dismissApplyConfirm();
            });
            confirmEl.querySelectorAll('[data-confirm-goto]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const target = Number(btn.getAttribute('data-confirm-goto'));
                    dismissApplyConfirm();
                    if (Number.isFinite(target)) goTo(target);
                });
            });

            overlay.appendChild(confirmEl);
            applyConfirmBtn?.focus();
        };

        const onKey = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (tryDismissApplyConfirm()) return;
                close(null);
                return;
            }
            if (confirmEl) return;
            if (event.key === 'ArrowRight' && !isTypingTarget(event.target)) {
                event.preventDefault();
                goTo(currentIndex + 1);
            } else if (event.key === 'ArrowLeft' && !isTypingTarget(event.target)) {
                event.preventDefault();
                goTo(currentIndex - 1);
            }
        };

        /**
         * @param {import('./mergeStoryEvents.js').MergeRow} row
         * @param {'base'|'incoming'} side
         */
        const applyRowSide = (row, side) => {
            row.pick = side;
            if (row.kind === 'reposition') row.positionPick = side;
            const fields = Array.isArray(row.changedFields) ? row.changedFields : [];
            if (!row.fieldPicks) row.fieldPicks = {};
            for (const field of fields) row.fieldPicks[field] = side;
        };

        const syncPickSelectedClasses = () => {
            bodyEl?.querySelectorAll('.story-events-merge-pick').forEach((pickEl) => {
                const input = pickEl.querySelector('.story-events-merge-pick__input');
                pickEl.classList.toggle(
                    'story-events-merge-pick--selected',
                    input instanceof HTMLInputElement && input.checked,
                );
            });
            bodyEl?.querySelectorAll('.story-events-merge-seg').forEach((segEl) => {
                const input = segEl.querySelector('input[type="radio"]');
                segEl.classList.toggle(
                    'story-events-merge-seg--active',
                    input instanceof HTMLInputElement && input.checked,
                );
            });
        };

        const kindClassFor = (row) =>
            row.kind === 'conflict'
                ? 'story-events-merge-row--conflict'
                : row.kind === 'reposition'
                  ? 'story-events-merge-row--reposition'
                  : row.kind === 'onlyBase'
                    ? 'story-events-merge-row--only-base'
                    : 'story-events-merge-row--only-incoming';

        const kindShortLabel = (row) => {
            if (row.kind === 'conflict') return 'Content conflict';
            if (row.kind === 'reposition') return 'Repositioned';
            if (row.kind === 'onlyBase') return 'Only in current';
            return 'Only in incoming';
        };

        const renderPager = () => {
            const total = workingRows.length;
            if (counterEl instanceof HTMLElement) {
                counterEl.textContent = total ? `Change ${currentIndex + 1} of ${total}` : 'No changes';
            }
            if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = currentIndex <= 0;
            if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = currentIndex >= total - 1;
            if (navEl instanceof HTMLElement) navEl.style.display = total > 1 ? '' : 'none';

            if (!(stripEl instanceof HTMLElement)) return;
            stripEl.innerHTML = workingRows
                .map((row, index) => {
                    const dotKind =
                        row.kind === 'conflict'
                            ? 'story-events-merge-dot--conflict'
                            : row.kind === 'reposition'
                              ? 'story-events-merge-dot--reposition'
                              : row.kind === 'onlyBase'
                                ? 'story-events-merge-dot--only-base'
                                : 'story-events-merge-dot--only-incoming';
                    const active = index === currentIndex ? ' story-events-merge-dot--active' : '';
                    const audited = auditedIndices.has(index)
                        ? ' story-events-merge-dot--audited'
                        : ' story-events-merge-dot--unaudited';
                    const label = escapeHtml(storyEventDisplayLabel(row.baseEvent || row.incomingEvent));
                    const auditNote = auditedIndices.has(index) ? '' : ' (not reviewed yet)';
                    return `<button type="button" class="story-events-merge-dot ${dotKind}${active}${audited}" data-goto="${index}" title="${label}${auditNote}" aria-label="${label}${auditNote}"></button>`;
                })
                .join('');
            stripEl.querySelectorAll('[data-goto]').forEach((dot) => {
                dot.addEventListener('click', () => {
                    const target = Number(dot.getAttribute('data-goto'));
                    if (Number.isFinite(target)) goTo(target);
                });
            });
            const activeDot = stripEl.querySelector('.story-events-merge-dot--active');
            if (activeDot instanceof HTMLElement) {
                activeDot.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        };

        const renderCurrentRow = () => {
            if (!(bodyEl instanceof HTMLElement)) return;

            if (workingRows.length === 0) {
                bodyEl.innerHTML =
                    '<p class="story-events-merge-empty">No differences found between the current data and the selected file.</p>';
                return;
            }

            const index = currentIndex;
            const row = workingRows[index];
            const isPaired = row.kind === 'conflict' || row.kind === 'reposition';

            bodyEl.innerHTML = `
                <section class="story-events-merge-row story-events-merge-row--paged ${kindClassFor(row)}" data-row-index="${index}">
                    <div class="story-events-merge-row__header">
                        <span class="story-events-merge-row__kind">${escapeHtml(kindShortLabel(row))}</span>
                        <h3 class="story-events-merge-row__title">${escapeHtml(storyEventDisplayLabel(row.baseEvent || row.incomingEvent))}</h3>
                        ${renderRowMeta(row)}
                        ${isPaired ? renderChangedFieldChips(row) : ''}
                    </div>
                    ${renderPickOption(row, index, isPaired ? 'conflict' : 'single')}
                </section>
            `;
            bodyEl.scrollTop = 0;

            const rowIndexOf = (el) => {
                const section = el.closest('[data-row-index]');
                const rowIndex = Number(section?.getAttribute('data-row-index'));
                return Number.isFinite(rowIndex) ? rowIndex : -1;
            };

            bodyEl.querySelectorAll('input[type="radio"][name^="pos-"]').forEach((input) => {
                input.addEventListener('change', () => {
                    const targetRow = workingRows[rowIndexOf(input)];
                    if (!targetRow || !(input instanceof HTMLInputElement) || !input.checked) return;
                    targetRow.positionPick = input.value === 'incoming' ? 'incoming' : 'base';
                    syncPickSelectedClasses();
                });
            });

            bodyEl.querySelectorAll('input[type="radio"][data-field-input]').forEach((input) => {
                input.addEventListener('change', () => {
                    const targetRow = workingRows[rowIndexOf(input)];
                    if (!targetRow || !(input instanceof HTMLInputElement) || !input.checked) return;
                    const field = input.getAttribute('data-field-input');
                    if (!field) return;
                    if (!targetRow.fieldPicks) targetRow.fieldPicks = {};
                    targetRow.fieldPicks[field] = input.value === 'incoming' ? 'incoming' : 'base';
                    syncPickSelectedClasses();
                });
            });

            /**
             * @param {import('./mergeStoryEvents.js').MergeRow} targetRow
             * @param {string} field
             * @param {'base'|'incoming'} side
             * @param {unknown} nextValue
             * @param {{ selectSide?: boolean }} [opts]
             */
            const storeFieldEdit = (targetRow, field, side, nextValue, opts = {}) => {
                const selectSide = opts.selectSide !== false;
                const sourceEvent = side === 'incoming' ? targetRow.incomingEvent : targetRow.baseEvent;
                const original = sourceEvent && typeof sourceEvent === 'object' && field in sourceEvent
                    ? sourceEvent[field]
                    : undefined;

                const normalizedNext = isGroupedPlacesField(field)
                    ? normalizeCollectedPlaces(nextValue)
                    : nextValue;
                const normalizedOriginal = isGroupedPlacesField(field)
                    ? normalizeCollectedPlaces(original)
                    : original;

                if (!targetRow.fieldEdits) targetRow.fieldEdits = {};
                const fieldBucket = targetRow.fieldEdits[field] || {};
                const same = JSON.stringify(normalizedNext ?? null) === JSON.stringify(normalizedOriginal ?? null)
                    || (
                        serializeStoryFieldForEdit(field, normalizedNext)
                        === serializeStoryFieldForEdit(field, normalizedOriginal)
                    );

                if (same) {
                    delete fieldBucket[side];
                    if (fieldBucket.base === undefined && fieldBucket.incoming === undefined) {
                        delete targetRow.fieldEdits[field];
                    } else {
                        targetRow.fieldEdits[field] = fieldBucket;
                    }
                } else {
                    fieldBucket[side] = normalizedNext;
                    targetRow.fieldEdits[field] = fieldBucket;
                }

                if (selectSide) {
                    if (!targetRow.fieldPicks) targetRow.fieldPicks = {};
                    targetRow.fieldPicks[field] = side;
                    const radio = bodyEl.querySelector(
                        `input[type="radio"][data-field-input="${CSS.escape(field)}"][value="${side}"]`,
                    );
                    if (radio instanceof HTMLInputElement) radio.checked = true;
                }

                const seg = bodyEl.querySelector(
                    `.story-events-merge-seg[data-field-panel="${CSS.escape(field)}"][data-field-side="${side}"]`,
                );
                const isEdited = fieldSideHasEdit(targetRow, field, side);
                if (seg instanceof HTMLElement) {
                    seg.classList.toggle('story-events-merge-seg--edited', isEdited);
                    const label = seg.querySelector('.story-events-merge-field__label');
                    if (label instanceof HTMLElement) {
                        const sideLabel = side === 'base' ? 'Current' : 'Incoming';
                        label.textContent = isEdited ? `${sideLabel} · edited` : sideLabel;
                    }
                    const resetBtn = seg.querySelector('[data-field-reset]');
                    if (resetBtn instanceof HTMLElement) resetBtn.hidden = !isEdited;
                }
                syncPickSelectedClasses();
            };

            /**
             * Persist text/number field edits and optionally select that side for the merge.
             * @param {HTMLInputElement|HTMLTextAreaElement} control
             * @param {{ selectSide?: boolean }} [opts]
             */
            const commitFieldEdit = (control, opts = {}) => {
                const targetRow = workingRows[rowIndexOf(control)];
                if (!targetRow) return;
                const field = control.getAttribute('data-field-edit');
                const sideAttr = control.getAttribute('data-field-side');
                if (!field || (sideAttr !== 'base' && sideAttr !== 'incoming')) return;
                storeFieldEdit(targetRow, field, sideAttr, control.value, opts);
            };

            /**
             * @param {HTMLElement} sourcesRoot
             */
            const commitSourcesEdit = (sourcesRoot) => {
                const targetRow = workingRows[rowIndexOf(sourcesRoot)];
                if (!targetRow) return;
                const field = sourcesRoot.getAttribute('data-field-edit-sources');
                const sideAttr = sourcesRoot.getAttribute('data-field-side');
                if (!field || (sideAttr !== 'base' && sideAttr !== 'incoming')) return;
                storeFieldEdit(targetRow, field, sideAttr, readSourcesFromEditor(sourcesRoot));
            };

            /**
             * @param {HTMLElement} seg
             */
            const selectPanelSide = (seg) => {
                const targetRow = workingRows[rowIndexOf(seg)];
                if (!targetRow) return;
                const field = seg.getAttribute('data-field-panel');
                const sideAttr = seg.getAttribute('data-field-side');
                if (!field || (sideAttr !== 'base' && sideAttr !== 'incoming')) return;
                if (!targetRow.fieldPicks) targetRow.fieldPicks = {};
                targetRow.fieldPicks[field] = sideAttr;
                const radio = seg.querySelector('input[type="radio"][data-field-input]');
                if (radio instanceof HTMLInputElement) radio.checked = true;
                syncPickSelectedClasses();
            };

            bodyEl.querySelectorAll('.story-events-merge-seg[data-field-panel]').forEach((seg) => {
                if (!(seg instanceof HTMLElement)) return;
                seg.addEventListener('click', (event) => {
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    if (target.closest('[data-field-reset], [data-role="source-remove"], [data-role="source-add"], [data-role="source-link-add"], [data-role="source-link-remove"], [data-role="places-add"], .event-slide-loc-type-btn, .event-slide-inline-editor__relevant-loc-row button')) {
                        return;
                    }
                    selectPanelSide(seg);
                });
            });

            bodyEl.querySelectorAll('[data-field-edit]').forEach((control) => {
                if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) return;
                control.addEventListener('input', () => commitFieldEdit(control));
                control.addEventListener('focus', () => {
                    const seg = control.closest('.story-events-merge-seg');
                    if (seg instanceof HTMLElement) selectPanelSide(seg);
                });
                control.addEventListener('keydown', (event) => event.stopPropagation());
            });

            bodyEl.querySelectorAll('[data-field-edit-location]').forEach((group) => {
                if (!(group instanceof HTMLElement)) return;
                group.addEventListener('click', (event) => {
                    const btn = event.target instanceof Element
                        ? event.target.closest('.event-slide-loc-type-btn')
                        : null;
                    if (!(btn instanceof HTMLElement) || !group.contains(btn)) return;
                    event.preventDefault();
                    event.stopPropagation();
                    const targetRow = workingRows[rowIndexOf(group)];
                    if (!targetRow) return;
                    const field = group.getAttribute('data-field-edit-location');
                    const sideAttr = group.getAttribute('data-field-side');
                    const type = btn.getAttribute('data-location-type') || 'earth';
                    if (!field || (sideAttr !== 'base' && sideAttr !== 'incoming')) return;
                    group.querySelectorAll('.event-slide-loc-type-btn').forEach((el) => {
                        el.classList.toggle('active', el === btn);
                    });
                    storeFieldEdit(targetRow, field, sideAttr, type);
                });
            });

            bodyEl.querySelectorAll('[data-field-edit-sources]').forEach((sourcesRoot) => {
                if (!(sourcesRoot instanceof HTMLElement)) return;

                sourcesRoot.addEventListener('input', () => commitSourcesEdit(sourcesRoot));
                sourcesRoot.addEventListener('focusin', () => {
                    const seg = sourcesRoot.closest('.story-events-merge-seg');
                    if (seg instanceof HTMLElement) selectPanelSide(seg);
                });

                sourcesRoot.addEventListener('click', (event) => {
                    const target = event.target;
                    if (!(target instanceof Element)) return;
                    const list = sourcesRoot.querySelector('[data-role="sources-list"]') || sourcesRoot;

                    const addSourceBtn = target.closest('[data-role="source-add"]');
                    if (addSourceBtn && sourcesRoot.contains(addSourceBtn)) {
                        event.preventDefault();
                        event.stopPropagation();
                        const empty = document.createElement('div');
                        empty.innerHTML = renderSourceRowHtml({ text: '', url: '' });
                        const row = empty.firstElementChild;
                        if (row) list.appendChild(row);
                        commitSourcesEdit(sourcesRoot);
                        if (row instanceof HTMLElement) {
                            row.querySelector('[data-role="source-text"]')?.focus();
                        }
                        return;
                    }

                    const addLinkBtn = target.closest('[data-role="source-link-add"]');
                    if (addLinkBtn && sourcesRoot.contains(addLinkBtn)) {
                        event.preventDefault();
                        event.stopPropagation();
                        const stack = addLinkBtn.parentElement;
                        if (!stack) return;
                        const wrap = document.createElement('div');
                        wrap.innerHTML = renderSourceLinkRowHtml('');
                        const linkRow = wrap.firstElementChild;
                        if (linkRow) stack.insertBefore(linkRow, addLinkBtn);
                        commitSourcesEdit(sourcesRoot);
                        linkRow?.querySelector('[data-role="source-url"]')?.focus();
                        return;
                    }

                    const removeLinkBtn = target.closest('[data-role="source-link-remove"]');
                    if (removeLinkBtn && sourcesRoot.contains(removeLinkBtn)) {
                        event.preventDefault();
                        event.stopPropagation();
                        const linkRow = removeLinkBtn.closest('.event-slide-inline-editor__source-link-row');
                        const stack = removeLinkBtn.closest('[data-role="source-links"]');
                        const urlInputs = stack?.querySelectorAll('[data-role="source-url"]') || [];
                        if (linkRow && urlInputs.length > 1) {
                            linkRow.remove();
                        } else if (linkRow) {
                            const input = linkRow.querySelector('[data-role="source-url"]');
                            if (input instanceof HTMLInputElement) input.value = '';
                        }
                        commitSourcesEdit(sourcesRoot);
                        return;
                    }

                    const removeBtn = target.closest('[data-role="source-remove"]');
                    if (removeBtn && sourcesRoot.contains(removeBtn)) {
                        event.preventDefault();
                        event.stopPropagation();
                        const row = removeBtn.closest('.event-slide-inline-editor__source-row');
                        const rows = sourcesRoot.querySelectorAll('.event-slide-inline-editor__source-row');
                        if (row && rows.length > 1) {
                            row.remove();
                        } else if (row) {
                            const text = row.querySelector('[data-role="source-text"]');
                            if (text instanceof HTMLInputElement) text.value = '';
                            row.querySelectorAll('[data-role="source-url"]').forEach((urlInput) => {
                                if (urlInput instanceof HTMLInputElement) urlInput.value = '';
                            });
                        }
                        commitSourcesEdit(sourcesRoot);
                    }
                });
            });

            /**
             * @param {HTMLElement} placesRoot
             */
            const commitPlacesEdit = (placesRoot) => {
                const targetRow = workingRows[rowIndexOf(placesRoot)];
                if (!targetRow) return;
                const field = placesRoot.getAttribute('data-field-edit-places');
                const sideAttr = placesRoot.getAttribute('data-field-side');
                if (!field || (sideAttr !== 'base' && sideAttr !== 'incoming')) return;
                const list = placesRoot.querySelector('[data-role="places-list"]');
                const editor = window.HeroRelevantLocationsEditor;
                if (!list || !editor?.collect) return;
                storeFieldEdit(
                    targetRow,
                    field,
                    sideAttr,
                    normalizeCollectedPlaces(editor.collect(list)),
                );
            };

            bodyEl.querySelectorAll('[data-field-edit-places]').forEach((placesRoot) => {
                if (!(placesRoot instanceof HTMLElement)) return;
                const field = placesRoot.getAttribute('data-field-edit-places');
                const sideAttr = placesRoot.getAttribute('data-field-side');
                const list = placesRoot.querySelector('[data-role="places-list"]');
                const targetRow = workingRows[rowIndexOf(placesRoot)];
                const editor = window.HeroRelevantLocationsEditor;
                if (
                    !field
                    || (sideAttr !== 'base' && sideAttr !== 'incoming')
                    || !(list instanceof HTMLElement)
                    || !targetRow
                    || !editor?.render
                ) {
                    return;
                }

                const places = normalizeCollectedPlaces(fieldSideValue(targetRow, field, sideAttr));
                editor.render(list, places, placesEditorOptsForField(field));

                placesRoot.addEventListener('input', () => commitPlacesEdit(placesRoot));
                placesRoot.addEventListener('focusin', () => {
                    const seg = placesRoot.closest('.story-events-merge-seg');
                    if (seg instanceof HTMLElement) selectPanelSide(seg);
                });
                placesRoot.addEventListener('click', (event) => {
                    const target = event.target;
                    if (!(target instanceof Element)) return;

                    const addBtn = target.closest('[data-role="places-add"]');
                    if (addBtn && placesRoot.contains(addBtn)) {
                        event.preventDefault();
                        event.stopPropagation();
                        const containerId = addBtn.getAttribute('data-places-container') || list.id;
                        editor.addRow?.({
                            containerId,
                            ...placesEditorOptsForField(field),
                        });
                        commitPlacesEdit(placesRoot);
                        return;
                    }

                    if (target.closest('.event-slide-inline-editor__relevant-loc-row button')) {
                        queueMicrotask(() => commitPlacesEdit(placesRoot));
                    }
                });
            });

            bodyEl.querySelectorAll('[data-field-reset]').forEach((button) => {
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const targetRow = workingRows[rowIndexOf(button)];
                    if (!targetRow) return;
                    const field = button.getAttribute('data-field-reset');
                    const sideAttr = button.getAttribute('data-field-side');
                    if (!field || (sideAttr !== 'base' && sideAttr !== 'incoming')) return;
                    if (targetRow.fieldEdits?.[field]) {
                        delete targetRow.fieldEdits[field][sideAttr];
                        if (
                            targetRow.fieldEdits[field].base === undefined
                            && targetRow.fieldEdits[field].incoming === undefined
                        ) {
                            delete targetRow.fieldEdits[field];
                        }
                    }
                    renderCurrentRow();
                });
            });

            bodyEl.querySelectorAll('[data-field-all]').forEach((button) => {
                button.addEventListener('click', () => {
                    const targetRow = workingRows[rowIndexOf(button)];
                    if (!targetRow) return;
                    const side = button.getAttribute('data-field-all') === 'incoming' ? 'incoming' : 'base';
                    if (!targetRow.fieldPicks) targetRow.fieldPicks = {};
                    for (const field of targetRow.changedFields || []) targetRow.fieldPicks[field] = side;
                    renderCurrentRow();
                });
            });

            bodyEl.querySelectorAll('input[type="checkbox"][data-include-row]').forEach((input) => {
                input.addEventListener('change', () => {
                    const targetRow = workingRows[rowIndexOf(input)];
                    if (!targetRow) return;
                    targetRow.include = input instanceof HTMLInputElement ? input.checked : false;
                    syncPickSelectedClasses();
                });
            });
        };

        function goTo(targetIndex) {
            const total = workingRows.length;
            if (total === 0) return;
            currentIndex = Math.max(0, Math.min(total - 1, targetIndex));
            markAudited(currentIndex);
            renderCurrentRow();
            renderPager();
            updateApplyHint();
        }

        const updateApplyHint = () => {
            if (!(applyBtn instanceof HTMLButtonElement)) return;
            const left = unauditedIndices().length;
            applyBtn.textContent =
                left > 0 ? `Apply merge (${left} unreviewed)` : 'Apply merge';
        };

        const renderBody = () => {
            if (workingRows.length > 0) markAudited(currentIndex);
            renderCurrentRow();
            renderPager();
            updateApplyHint();
        };

        overlay.querySelectorAll('[data-bulk]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-bulk');
                for (const row of workingRows) {
                    if (action === 'conflicts-base' && row.kind === 'conflict') applyRowSide(row, 'base');
                    if (action === 'conflicts-incoming' && row.kind === 'conflict') {
                        applyRowSide(row, 'incoming');
                    }
                    if (action === 'reposition-base' && row.kind === 'reposition') {
                        applyRowSide(row, 'base');
                    }
                    if (action === 'reposition-incoming' && row.kind === 'reposition') {
                        applyRowSide(row, 'incoming');
                    }
                    if (action === 'incoming-on' && row.kind === 'onlyIncoming') row.include = true;
                    if (action === 'incoming-off' && row.kind === 'onlyIncoming') row.include = false;
                }
                renderBody();
            });
        });

        prevBtn?.addEventListener('click', () => goTo(currentIndex - 1));
        nextBtn?.addEventListener('click', () => goTo(currentIndex + 1));

        cancelBtn?.addEventListener('click', () => {
            if (tryDismissApplyConfirm()) return;
            close(null);
        });
        closeBtn?.addEventListener('click', () => {
            if (tryDismissApplyConfirm()) return;
            close(null);
        });
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                if (tryDismissApplyConfirm()) return;
                close(null);
            }
        });

        applyBtn?.addEventListener('click', () => {
            openApplyConfirm();
        });

        document.body.appendChild(overlay);
        document.body.classList.add('story-events-merge-open');
        document.addEventListener('keydown', onKey);
        renderBody();
        applyBtn?.focus();
    });
}
