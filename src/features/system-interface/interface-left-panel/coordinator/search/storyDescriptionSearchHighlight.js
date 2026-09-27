/**
 * Highlight free-text Search tokens inside the open story entry description.
 * Tokens come from `eventManager.searchQuery` and only wrap words that appear in the description.
 */

import { getDescriptionSearchHighlightTokens } from './filterEvents.js';

const HIGHLIGHT_CLASS = 'event-slide-search-highlight';

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Wrap matching substrings in text nodes under `root` with `<mark class="event-slide-search-highlight">`.
 * Skips nodes already inside a highlight mark.
 *
 * @param {ParentNode | null | undefined} root
 * @param {string[]} tokens
 */
export function highlightSearchTokensInElement(root, tokens) {
    if (!root || !Array.isArray(tokens) || tokens.length === 0) return;

    const unique = [...new Set(tokens.map((t) => String(t || '').trim()).filter(Boolean))];
    if (unique.length === 0) return;

    const pattern = new RegExp(`(${unique.map(escapeRegExp).join('|')})`, 'gi');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest(`mark.${HIGHLIGHT_CLASS}`)) return NodeFilter.FILTER_REJECT;
            if (parent.closest('script, style')) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    /** @type {Text[]} */
    const textNodes = [];
    while (walker.nextNode()) {
        textNodes.push(/** @type {Text} */ (walker.currentNode));
    }

    for (let i = 0; i < textNodes.length; i += 1) {
        const node = textNodes[i];
        const text = node.nodeValue || '';
        pattern.lastIndex = 0;
        if (!pattern.test(text)) continue;
        pattern.lastIndex = 0;

        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        let match = pattern.exec(text);
        while (match) {
            if (match.index > lastIndex) {
                frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            const mark = document.createElement('mark');
            mark.className = HIGHLIGHT_CLASS;
            mark.textContent = match[0];
            frag.appendChild(mark);
            lastIndex = match.index + match[0].length;
            match = pattern.exec(text);
        }
        if (lastIndex < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        node.parentNode?.replaceChild(frag, node);
    }
}

/**
 * @param {string | null | undefined} description
 * @param {string | null | undefined} [searchQuery]
 * @returns {string[]}
 */
export function resolveDescriptionHighlightTokens(description, searchQuery) {
    const q =
        searchQuery != null
            ? searchQuery
            : typeof window !== 'undefined'
              ? window.eventManager?.searchQuery
              : '';
    return getDescriptionSearchHighlightTokens(description, q);
}

/**
 * Apply glitch (if any) then highlight active Search tokens that appear in the description.
 *
 * @param {HTMLElement | null | undefined} textEl
 * @param {string | null | undefined} description
 * @param {(text: string) => string} [applyGlitch]
 */
export function setEventSlideDescriptionWithSearchHighlight(textEl, description, applyGlitch) {
    if (!textEl) return;
    const raw = String(description || '').trim() ? String(description) : '';
    const displaySource = raw || 'No description available.';
    const glitchFn =
        typeof applyGlitch === 'function'
            ? applyGlitch
            : (text) => (window.GlitchTextService?.getDisplayText?.(text) || text);
    textEl.innerHTML = glitchFn(displaySource) || 'No description available.';
    const tokens = resolveDescriptionHighlightTokens(raw);
    if (tokens.length > 0) {
        highlightSearchTokensInElement(textEl, tokens);
    }
}

/**
 * Re-apply description highlights on the currently open slide from live Search state.
 */
export function refreshOpenEventSlideDescriptionSearchHighlight() {
    const textEl = document.getElementById('eventSlideText');
    if (!textEl || textEl.isContentEditable) return;

    const slide = typeof window !== 'undefined' ? window.standaloneEventSlide : null;
    const eventData = slide?.currentEventData;
    if (!eventData) return;

    const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
    const idx = slide?.currentVariantIndex ?? 0;
    const display = isMulti ? eventData.variants[idx] || eventData : eventData;
    const description = display?.description || eventData.description || '';
    setEventSlideDescriptionWithSearchHighlight(textEl, description);
}
