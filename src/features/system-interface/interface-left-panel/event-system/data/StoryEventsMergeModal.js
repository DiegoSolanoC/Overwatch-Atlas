/**
 * Pick-and-mix modal for merging two story event JSON archives.
 */

import {
    buildMergedStoryEventsFromPlan,
    formatMergeRowPositionNote,
    storyEventDisplayLabel,
} from './mergeStoryEvents.js';
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
 * @param {import('./mergeStoryEvents.js').MergeRow} row
 * @param {number} index
 * @param {'conflict'|'single'} mode
 * @returns {string}
 */
function renderPickOption(row, index, mode) {
    if (mode === 'conflict') {
        const pick = row.pick === 'incoming' ? 'incoming' : 'base';
        return `
            <div class="story-events-merge-row__columns">
                <label class="story-events-merge-pick story-events-merge-pick--base${pick === 'base' ? ' story-events-merge-pick--selected' : ''}">
                    <input type="radio" class="story-events-merge-pick__input" name="merge-${index}" value="base" ${pick === 'base' ? 'checked' : ''} />
                    <span class="story-events-merge-pick__label">Current (in use)</span>
                    ${renderMergeEventPreviewCard(row.baseEvent)}
                </label>
                <label class="story-events-merge-pick story-events-merge-pick--incoming${pick === 'incoming' ? ' story-events-merge-pick--selected' : ''}">
                    <input type="radio" class="story-events-merge-pick__input" name="merge-${index}" value="incoming" ${pick === 'incoming' ? 'checked' : ''} />
                    <span class="story-events-merge-pick__label">Incoming file</span>
                    ${renderMergeEventPreviewCard(row.incomingEvent)}
                </label>
            </div>
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
        const workingRows = plan.rows.map((row) => ({ ...row }));

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
                        Repositioned rows are the same story moved or re-dated in the incoming file — pick which version to keep. Your timeline order stays as-is after merge.
                    </p>
                </header>
                <div class="story-events-merge-dialog__toolbar">
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="conflicts-base">Current for all conflicts</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="conflicts-incoming">Incoming for all conflicts</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="reposition-base">Current for all repositioned</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="incoming-on">Include all incoming-only</button>
                    <button type="button" class="story-events-merge-toolbar-btn" data-bulk="incoming-off">Skip all incoming-only</button>
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

        const close = (value) => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            document.body.classList.remove('story-events-merge-open');
            resolve(value);
        };

        const onKey = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(null);
            }
        };

        const syncPickSelectedClasses = () => {
            bodyEl?.querySelectorAll('.story-events-merge-pick').forEach((pickEl) => {
                const input = pickEl.querySelector('.story-events-merge-pick__input');
                pickEl.classList.toggle(
                    'story-events-merge-pick--selected',
                    input instanceof HTMLInputElement && input.checked,
                );
            });
        };

        const renderBody = () => {
            if (!(bodyEl instanceof HTMLElement)) return;

            if (workingRows.length === 0) {
                bodyEl.innerHTML =
                    '<p class="story-events-merge-empty">No differences found between the current data and the selected file.</p>';
                return;
            }

            bodyEl.innerHTML = workingRows
                .map((row, index) => {
                    const kindClass =
                        row.kind === 'conflict'
                            ? 'story-events-merge-row--conflict'
                            : row.kind === 'reposition'
                              ? 'story-events-merge-row--reposition'
                              : row.kind === 'onlyBase'
                                ? 'story-events-merge-row--only-base'
                                : 'story-events-merge-row--only-incoming';

                    const isPaired = row.kind === 'conflict' || row.kind === 'reposition';

                    return `
                        <section class="story-events-merge-row ${kindClass}" data-row-index="${index}">
                            <div class="story-events-merge-row__header">
                                <h3 class="story-events-merge-row__title">${escapeHtml(storyEventDisplayLabel(row.baseEvent || row.incomingEvent))}</h3>
                                ${renderRowMeta(row)}
                                ${isPaired ? renderChangedFieldChips(row) : ''}
                            </div>
                            ${renderPickOption(row, index, isPaired ? 'conflict' : 'single')}
                        </section>
                    `;
                })
                .join('');

            bodyEl.querySelectorAll('input[type="radio"]').forEach((input) => {
                input.addEventListener('change', () => {
                    const section = input.closest('[data-row-index]');
                    const rowIndex = Number(section?.getAttribute('data-row-index'));
                    if (!Number.isFinite(rowIndex) || !workingRows[rowIndex]) return;
                    workingRows[rowIndex].pick =
                        input instanceof HTMLInputElement && input.value === 'incoming'
                            ? 'incoming'
                            : 'base';
                    syncPickSelectedClasses();
                });
            });

            bodyEl.querySelectorAll('input[type="checkbox"][data-include-row]').forEach((input) => {
                input.addEventListener('change', () => {
                    const rowIndex = Number(input.getAttribute('data-include-row'));
                    if (!Number.isFinite(rowIndex) || !workingRows[rowIndex]) return;
                    workingRows[rowIndex].include =
                        input instanceof HTMLInputElement ? input.checked : false;
                    syncPickSelectedClasses();
                });
            });
        };

        overlay.querySelectorAll('[data-bulk]').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.getAttribute('data-bulk');
                for (const row of workingRows) {
                    if (action === 'conflicts-base' && row.kind === 'conflict') row.pick = 'base';
                    if (action === 'conflicts-incoming' && row.kind === 'conflict') {
                        row.pick = 'incoming';
                    }
                    if (action === 'reposition-base' && row.kind === 'reposition') row.pick = 'base';
                    if (action === 'incoming-on' && row.kind === 'onlyIncoming') row.include = true;
                    if (action === 'incoming-off' && row.kind === 'onlyIncoming') row.include = false;
                }
                renderBody();
            });
        });

        cancelBtn?.addEventListener('click', () => close(null));
        closeBtn?.addEventListener('click', () => close(null));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) close(null);
        });

        applyBtn?.addEventListener('click', () => {
            close(buildMergedStoryEventsFromPlan(plan, workingRows));
        });

        document.body.appendChild(overlay);
        document.body.classList.add('story-events-merge-open');
        document.addEventListener('keydown', onKey);
        renderBody();
        applyBtn?.focus();
    });
}
