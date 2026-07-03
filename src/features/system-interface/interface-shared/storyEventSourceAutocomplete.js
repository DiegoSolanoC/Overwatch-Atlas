/**
 * Story-event source name + URL pairing with browser-native suggestions.
 *
 * Picking or committing a known source name fills all paired URLs from timeline rows.
 * Prefers the richest multi-link template seen for that name (e.g. Fire Star's PDF + YouTube).
 */

import { getSourceUrls } from '../interface-event-slide/standalone-slide/sources/sourceUrlUtils.js';
import { populateSourceLinkStack } from '../interface-left-panel/event-system/form/fields/sourcePairLinkRows.js';

const SOURCE_NAME_DATALIST_ID = 'storyEventSourceNameList';
const SOURCE_NAME_FIELD_NAME = 'story-event-source-name';

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeSourceText(text) {
    return String(text || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

/**
 * @returns {Array<object>}
 */
function getEventsForSourceMining() {
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    /** @type {object[]} */
    const out = [];
    const lists = [
        em?.getDockTimelineEvents?.(),
        em?.events,
        typeof window !== 'undefined' ? window.EventDataService?.events : null,
        typeof window !== 'undefined' ? window.EventDataService?.timelineEvents : null,
    ];
    for (const list of lists) {
        if (Array.isArray(list)) out.push(...list);
    }
    return out;
}

/**
 * @param {object} event
 * @returns {Array<{ text?: string, url?: string, urls?: string[] }>}
 */
function collectSourcesFromEvent(event) {
    if (!event || typeof event !== 'object') return [];
    /** @type {Array<{ text?: string, url?: string, urls?: string[] }>} */
    const merged = [...(event.sources || [])];
    for (const variant of event.variants || []) {
        if (variant?.sources?.length) merged.push(...variant.sources);
    }
    return merged;
}

/**
 * @returns {Map<string, { text: string, urls: string[] }>}
 */
function buildSourceUrlIndex() {
    /** @type {Map<string, { text: string, richestTemplate: string[], urlCounts: Map<string, number> }>} */
    const bucket = new Map();

    for (const event of getEventsForSourceMining()) {
        for (const src of collectSourcesFromEvent(event)) {
            const text = String(src?.text || '').trim();
            if (!text) continue;
            const key = normalizeSourceText(text);
            let entry = bucket.get(key);
            if (!entry) {
                entry = { text, richestTemplate: [], urlCounts: new Map() };
                bucket.set(key, entry);
            }

            const urls = getSourceUrls(src);
            if (urls.length > entry.richestTemplate.length) {
                entry.richestTemplate = urls;
            }
            for (const url of urls) {
                entry.urlCounts.set(url, (entry.urlCounts.get(url) || 0) + 1);
            }
        }
    }

    /** @type {Map<string, { text: string, urls: string[] }>} */
    const resolved = new Map();
    for (const [key, entry] of bucket) {
        const urls = entry.richestTemplate.length > 1
            ? [...entry.richestTemplate]
            : [...entry.urlCounts.entries()]
                .filter(([url]) => url)
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .map(([url]) => url);
        resolved.set(key, { text: entry.text, urls });
    }
    return resolved;
}

/**
 * @param {string} name
 * @returns {string[]}
 */
export function resolveUrlsForSourceName(name) {
    const key = normalizeSourceText(name);
    if (!key) return [];
    return buildSourceUrlIndex().get(key)?.urls || [];
}

/**
 * @returns {Map<string, { text: string, urls: string[] }>}
 */
export function getStoryEventSourceOptionsByKey() {
    return buildSourceUrlIndex();
}

export function clearStoryEventSourceOptionsCache() {
    refreshSourceNameDatalist();
}

/**
 * @returns {HTMLDataListElement}
 */
function ensureSourceNameDatalist() {
    let datalist = document.getElementById(SOURCE_NAME_DATALIST_ID);
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = SOURCE_NAME_DATALIST_ID;
        document.body.appendChild(datalist);
    }
    return /** @type {HTMLDataListElement} */ (datalist);
}

/** Populate the shared datalist from mined timeline source names. */
export function refreshSourceNameDatalist() {
    if (typeof document === 'undefined') return;
    const datalist = ensureSourceNameDatalist();
    datalist.replaceChildren();
    const options = [...getStoryEventSourceOptionsByKey().values()]
        .sort((a, b) => a.text.localeCompare(b.text, undefined, { sensitivity: 'base' }));
    for (const { text } of options) {
        const option = document.createElement('option');
        option.value = text;
        datalist.appendChild(option);
    }
}

/**
 * @param {string} name
 * @returns {string}
 */
export function resolveUrlForSourceName(name) {
    const urls = resolveUrlsForSourceName(name);
    return urls[0] || '';
}

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
function populateSourceLinksInRow(row, urls) {
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

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null|undefined} urlInput
 * @param {HTMLElement|null|undefined} sourceRow
 */
export function syncUrlFromSourceName(nameInput, urlInput, sourceRow) {
    if (!nameInput) return;
    const key = normalizeSourceText(nameInput.value);
    if (!key) return;

    const urls = resolveUrlsForSourceName(nameInput.value);
    if (!urls.length) return;

    const row = sourceRow instanceof HTMLElement
        ? sourceRow
        : nameInput.closest('.event-slide-inline-editor__source-row, .source-pair');

    if (row instanceof HTMLElement) {
        populateSourceLinksInRow(row, urls);
        return;
    }

    if (urlInput) urlInput.value = urls[0];
}

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null|undefined} urlInput
 * @param {HTMLElement|null|undefined} sourceRow
 */
export function wireStoryEventSourceAutocomplete(nameInput, urlInput, sourceRow) {
    if (!nameInput || nameInput.dataset.storyEventSourceAutocomplete === 'true') return;
    nameInput.dataset.storyEventSourceAutocomplete = 'true';

    const row = sourceRow instanceof HTMLElement
        ? sourceRow
        : nameInput.closest('.event-slide-inline-editor__source-row, .source-pair');

    refreshSourceNameDatalist();

    nameInput.setAttribute('autocomplete', 'on');
    nameInput.setAttribute('list', SOURCE_NAME_DATALIST_ID);
    nameInput.setAttribute('name', SOURCE_NAME_FIELD_NAME);

    const commit = () => {
        window.requestAnimationFrame(() => {
            syncUrlFromSourceName(nameInput, urlInput, row);
        });
    };

    nameInput.addEventListener('change', commit);
    nameInput.addEventListener('blur', commit);
    nameInput.addEventListener('input', () => {
        if (!resolveUrlsForSourceName(nameInput.value).length) return;
        commit();
    });
}

/**
 * @param {HTMLElement} row
 */
export function wireSourcePairRow(row) {
    if (!row) return;
    const nameInput = row.querySelector('[data-role="source-text"], .source-name-input');
    const urlInput = row.querySelector('[data-role="source-url"], .source-link-input');
    if (!(nameInput instanceof HTMLInputElement)) return;
    wireStoryEventSourceAutocomplete(nameInput, urlInput, row);
}

/**
 * @param {HTMLElement | null | undefined} container
 */
export function wireSourceRowsIn(container) {
    if (!container) return;
    container
        .querySelectorAll('.event-slide-inline-editor__source-row, .source-pair')
        .forEach((row) => wireSourcePairRow(row));
}

if (typeof window !== 'undefined') {
    window.StoryEventSourceAutocomplete = {
        wireStoryEventSourceAutocomplete,
        wireSourcePairRow,
        wireSourceRowsIn,
        clearStoryEventSourceOptionsCache,
        refreshSourceNameDatalist,
        resolveUrlForSourceName,
        resolveUrlsForSourceName,
        syncUrlFromSourceName,
    };
}
