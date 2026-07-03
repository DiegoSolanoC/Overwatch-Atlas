/**
 * Multi-link rows inside a single event source (manage panel edit form).
 */

import { getSourceUrls } from '../../../../interface-event-slide/standalone-slide/sources/sourceUrlUtils.js';

/**
 * @param {string} value
 * @returns {HTMLDivElement}
 */
export function createSourceLinkRow(value = '') {
    const row = document.createElement('div');
    row.className = 'source-link-row';
    row.innerHTML = `
        <input type="url" class="event-edit-input source-link-input" autocomplete="on" placeholder="https://…" value="">
        <button type="button" class="source-link-remove-btn" title="Remove link" aria-label="Remove link">−</button>
    `;
    const input = row.querySelector('.source-link-input');
    if (input instanceof HTMLInputElement) {
        input.value = value;
    }
    row.querySelector('.source-link-remove-btn')?.addEventListener('click', () => {
        const stack = row.parentElement;
        if (!stack) return;
        const rows = stack.querySelectorAll('.source-link-row');
        if (rows.length <= 1) {
            if (input instanceof HTMLInputElement) input.value = '';
            return;
        }
        row.remove();
    });
    return row;
}

/**
 * @param {HTMLElement} stack
 * @param {string} [value]
 */
export function appendSourceLinkRow(stack, value = '') {
    if (!stack) return;
    stack.appendChild(createSourceLinkRow(value));
}

/**
 * @param {HTMLElement} pairDiv
 * @param {string[]} [urls]
 */
export function populateSourceLinkStack(pairDiv, urls = ['']) {
    const stack = pairDiv?.querySelector('.source-links-stack');
    if (!stack) return;
    stack.replaceChildren();
    const list = urls.length > 0 ? urls : [''];
    list.forEach((url) => appendSourceLinkRow(stack, url));
}

/**
 * @param {HTMLElement} pairDiv
 * @returns {string[]}
 */
export function readSourceLinkValues(pairDiv) {
    if (!pairDiv) return [];
    return Array.from(pairDiv.querySelectorAll('.source-link-input'))
        .map((input) => (input instanceof HTMLInputElement ? input.value.trim() : ''))
        .filter(Boolean);
}

/**
 * @param {number} index
 * @returns {string}
 */
export function buildSourcePairMarkup(index) {
    return `
        <div class="source-pair" data-source-index="${index}">
            <div class="event-edit-field">
                <label for="eventEditSourceName${index}">Source Name:</label>
                <input type="text" id="eventEditSourceName${index}" class="event-edit-input source-name-input" autocomplete="on">
            </div>
            <div class="event-edit-field source-links-field">
                <label>Source Links (optional):</label>
                <div class="source-links-stack"></div>
                <button type="button" class="source-link-add-btn">+ Add link</button>
            </div>
        </div>
    `;
}

/**
 * @param {HTMLElement} pairDiv
 */
export function wireSourcePairLinkControls(pairDiv) {
    if (!pairDiv || pairDiv.dataset.linkControlsWired === '1') return;
    pairDiv.dataset.linkControlsWired = '1';

    const stack = pairDiv.querySelector('.source-links-stack');
    const addBtn = pairDiv.querySelector('.source-link-add-btn');
    if (!stack || !(addBtn instanceof HTMLButtonElement)) return;

    if (!stack.querySelector('.source-link-row')) {
        appendSourceLinkRow(stack, '');
    }

    addBtn.addEventListener('click', () => {
        appendSourceLinkRow(stack, '');
        const lastInput = stack.querySelector('.source-link-row:last-child .source-link-input');
        if (lastInput instanceof HTMLInputElement) lastInput.focus();
    });
}

/**
 * @param {{ text?: string, url?: string, urls?: string[] }} source
 * @returns {string[]}
 */
export function urlsForSourcePairLoad(source) {
    const urls = getSourceUrls(source);
    return urls.length > 0 ? urls : [''];
}
