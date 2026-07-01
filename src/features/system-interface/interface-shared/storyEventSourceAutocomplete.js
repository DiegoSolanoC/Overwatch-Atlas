/**
 * Story-event source name + URL pairing with browser-native suggestions.
 *
 * Uses the browser's own suggestion UI (`autocomplete="on"` + `<datalist>`) — same
 * pattern as NPC category on the slide editor, not the custom `.filter-autocomplete-list`
 * panels used for hero/faction token picks.
 *
 * Picking or committing a known source name fills the paired URL from mined timeline rows.
 */

const SOURCE_NAME_DATALIST_ID = 'storyEventSourceNameList';
const SOURCE_NAME_FIELD_NAME = 'story-event-source-name';

/** @type {Map<string, { text: string, url: string }> | null} */
let cachedSourcesByKey = null;

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
 * @returns {Array<{ text: string, url: string }>}
 */
function getTimelineEventsForMining() {
    const em = typeof window !== 'undefined' ? window.eventManager : null;
    const dock = em?.getDockTimelineEvents?.();
    if (Array.isArray(dock) && dock.length > 0) return dock;
    return Array.isArray(em?.events) ? em.events : [];
}

/**
 * @param {Map<string, { text: string, urlCounts: Map<string, number> }>} bucket
 * @param {{ text?: string, url?: string } | null | undefined} src
 */
function ingestSource(bucket, src) {
    const text = String(src?.text || '').trim();
    if (!text) return;
    const key = normalizeSourceText(text);
    const url = String(src?.url || '').trim();
    let entry = bucket.get(key);
    if (!entry) {
        entry = { text, urlCounts: new Map() };
        bucket.set(key, entry);
    }
    const urlKey = url || '';
    entry.urlCounts.set(urlKey, (entry.urlCounts.get(urlKey) || 0) + 1);
}

/**
 * @returns {Map<string, { text: string, url: string }>}
 */
export function getStoryEventSourceOptionsByKey() {
    if (cachedSourcesByKey) return cachedSourcesByKey;

    /** @type {Map<string, { text: string, urlCounts: Map<string, number> }>} */
    const bucket = new Map();

    for (const event of getTimelineEventsForMining()) {
        if (!event || typeof event !== 'object') continue;
        (event.sources || []).forEach((src) => ingestSource(bucket, src));
        (event.variants || []).forEach((variant) => {
            (variant?.sources || []).forEach((src) => ingestSource(bucket, src));
        });
    }

    /** @type {Map<string, { text: string, url: string }>} */
    const resolved = new Map();
    for (const [key, entry] of bucket) {
        let bestUrl = '';
        let bestCount = -1;
        for (const [url, count] of entry.urlCounts) {
            if (count > bestCount) {
                bestCount = count;
                bestUrl = url;
            }
        }
        resolved.set(key, { text: entry.text, url: bestUrl });
    }

    cachedSourcesByKey = resolved;
    return resolved;
}

export function clearStoryEventSourceOptionsCache() {
    cachedSourcesByKey = null;
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
    const key = normalizeSourceText(name);
    if (!key) return '';
    return getStoryEventSourceOptionsByKey().get(key)?.url || '';
}

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null|undefined} urlInput
 */
export function syncUrlFromSourceName(nameInput, urlInput) {
    if (!nameInput || !urlInput) return;
    const url = resolveUrlForSourceName(nameInput.value);
    if (url) urlInput.value = url;
}

/**
 * @param {HTMLInputElement} nameInput
 * @param {HTMLInputElement|null|undefined} urlInput
 */
export function wireStoryEventSourceAutocomplete(nameInput, urlInput) {
    if (!nameInput || nameInput.dataset.storyEventSourceAutocomplete === 'true') return;
    nameInput.dataset.storyEventSourceAutocomplete = 'true';

    refreshSourceNameDatalist();

    nameInput.setAttribute('autocomplete', 'on');
    nameInput.setAttribute('list', SOURCE_NAME_DATALIST_ID);
    nameInput.setAttribute('name', SOURCE_NAME_FIELD_NAME);

    if (urlInput) {
        urlInput.setAttribute('autocomplete', 'on');
        urlInput.setAttribute('name', 'story-event-source-url');
    }

    const onNameCommit = () => syncUrlFromSourceName(nameInput, urlInput);
    nameInput.addEventListener('input', onNameCommit);
    nameInput.addEventListener('change', onNameCommit);
    nameInput.addEventListener('blur', onNameCommit);
}

/**
 * @param {HTMLElement} row
 */
export function wireSourcePairRow(row) {
    if (!row) return;
    const nameInput = row.querySelector('[data-role="source-text"], .source-name-input');
    const urlInput = row.querySelector('[data-role="source-url"], .source-link-input');
    if (!nameInput) return;
    wireStoryEventSourceAutocomplete(nameInput, urlInput);
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
        syncUrlFromSourceName,
    };
}
