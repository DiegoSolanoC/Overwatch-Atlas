/**
 * Populate multi-link URL rows for event source editors (manage panel + slide inline).
 */

import { populateSourceLinkStack } from '../interface-left-panel/event-system/form/fields/sourcePairLinkRows.js';

/**
 * @param {string} value
 * @returns {HTMLDivElement}
 */
function createInlineSourceLinkRow(value = '') {
    const row = document.createElement('div');
    row.className = 'event-slide-inline-editor__source-link-row';

    const input = document.createElement('input');
    input.className = 'event-slide-inline-editor__input';
    input.dataset.role = 'source-url';
    input.type = 'text';
    input.spellcheck = false;
    input.autocomplete = 'on';
    input.placeholder = 'URL (optional)';
    input.value = value;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'event-slide-inline-editor__small-btn';
    removeBtn.dataset.role = 'source-link-remove';
    removeBtn.textContent = '−';
    removeBtn.addEventListener('click', () => {
        const stack = row.parentElement;
        if (!stack) return;
        if (stack.querySelectorAll('[data-role="source-url"]').length <= 1) {
            input.value = '';
            return;
        }
        row.remove();
    });

    row.append(input, removeBtn);
    return row;
}

/**
 * @param {HTMLElement} stack
 * @param {string[]} urls
 */
function populateInlineSourceLinks(stack, urls) {
    stack.replaceChildren();
    const list = urls.length > 0 ? urls : [''];
    list.forEach((url) => stack.appendChild(createInlineSourceLinkRow(url)));

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'event-slide-inline-editor__small-btn event-slide-inline-editor__source-link-add';
    addBtn.dataset.role = 'source-link-add';
    addBtn.textContent = '+ link';
    addBtn.addEventListener('click', () => {
        const linkRow = createInlineSourceLinkRow('');
        stack.insertBefore(linkRow, addBtn);
        linkRow.querySelector('[data-role="source-url"]')?.focus();
    });
    stack.appendChild(addBtn);
}

/**
 * @param {HTMLElement} row
 * @param {string[]} urls
 */
export function populateSourceLinksInRow(row, urls) {
    if (!(row instanceof HTMLElement)) return;
    const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (!list.length) return;

    const inlineStack = row.querySelector('[data-role="source-links"]');
    if (inlineStack instanceof HTMLElement) {
        populateInlineSourceLinks(inlineStack, list);
        return;
    }

    if (row.querySelector('.source-links-stack')) {
        populateSourceLinkStack(row, list);
    }
}
