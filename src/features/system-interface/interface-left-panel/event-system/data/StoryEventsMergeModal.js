/**
 * Pick-and-mix modal for merging two story event JSON archives.
 */

import {
    buildMergedStoryEventsFromPlan,
    formatMergeRowPositionNote,
    resolveFieldSide,
    resolvePositionSide,
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
 * Human-readable preview of a single field value for the field-by-field picker.
 * With `full`, strings are shown untruncated and arrays/objects are expanded — used by
 * the one-event-at-a-time view where there is room to read the whole value.
 * @param {object|null} event
 * @param {string} field
 * @param {boolean} [full]
 * @returns {string}
 */
function previewFieldValue(event, field, full = false) {
    if (!event || typeof event !== 'object' || !(field in event)) return '—';
    const value = event[field];
    if (value == null || value === '') return '—';
    if (Array.isArray(value)) {
        if (value.length === 0) return 'empty list';
        if (full) {
            return value
                .map((item, i) =>
                    typeof item === 'object' && item != null
                        ? `${i + 1}. ${JSON.stringify(item)}`
                        : `${i + 1}. ${String(item)}`,
                )
                .join('\n');
        }
        return `${value.length} item${value.length === 1 ? '' : 's'}`;
    }
    if (typeof value === 'object') {
        if (full) return JSON.stringify(value, null, 2);
        const keys = Object.keys(value);
        return keys.length ? `{ ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? '…' : ''} }` : '{ }';
    }
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (full) return text;
    return text.length > 90 ? `${text.slice(0, 87)}…` : text;
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
            const side = resolveFieldSide(row, field);
            const basePreview = escapeHtml(previewFieldValue(row.baseEvent, field, true));
            const incomingPreview = escapeHtml(previewFieldValue(row.incomingEvent, field, true));
            const name = `field-${index}-${encodeURIComponent(field)}`;
            return `
                <div class="story-events-merge-field" data-field="${escapeHtml(field)}">
                    <span class="story-events-merge-field__name">${escapeHtml(field)}</span>
                    <div class="story-events-merge-field__opts">
                        <label class="story-events-merge-seg story-events-merge-seg--base${side === 'base' ? ' story-events-merge-seg--active' : ''}">
                            <input type="radio" name="${name}" value="base" data-field-input="${escapeHtml(field)}" ${side === 'base' ? 'checked' : ''} />
                            <span class="story-events-merge-field__label">Current</span>
                            <span class="story-events-merge-field__value">${basePreview}</span>
                        </label>
                        <label class="story-events-merge-seg story-events-merge-seg--incoming${side === 'incoming' ? ' story-events-merge-seg--active' : ''}">
                            <input type="radio" name="${name}" value="incoming" data-field-input="${escapeHtml(field)}" ${side === 'incoming' ? 'checked' : ''} />
                            <span class="story-events-merge-field__label">Incoming</span>
                            <span class="story-events-merge-field__value">${incomingPreview}</span>
                        </label>
                    </div>
                </div>
            `;
        })
        .join('');

    return `
        <div class="story-events-merge-fields">
            <div class="story-events-merge-fields__head">
                <p class="story-events-merge-fields__title">Field-by-field — choose where each differing field comes from</p>
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
                        For each changed row, choose <strong>Position</strong> (keep current or move to the incoming placement) and pick <strong>each differing field</strong> from Current or Incoming — so you can take everything from incoming while keeping, say, the description or name from current. Incoming-only events are inserted at their incoming placement, not appended at the end.
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

        const close = (value) => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
            document.body.classList.remove('story-events-merge-open');
            resolve(value);
        };

        const isTypingTarget = (el) =>
            el instanceof HTMLElement &&
            (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

        const onKey = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                close(null);
                return;
            }
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
                    const label = escapeHtml(storyEventDisplayLabel(row.baseEvent || row.incomingEvent));
                    return `<button type="button" class="story-events-merge-dot ${dotKind}${active}" data-goto="${index}" title="${label}" aria-label="${label}"></button>`;
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
            renderCurrentRow();
            renderPager();
        }

        const renderBody = () => {
            renderCurrentRow();
            renderPager();
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
