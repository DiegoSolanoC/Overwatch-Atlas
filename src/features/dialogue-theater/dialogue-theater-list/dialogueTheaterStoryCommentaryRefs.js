/**
 * Reverse lookup: Dialogue Theater dialogue → story timeline events that cite it
 * in `commentary`. Thumbs mount on the dialogue ENTRY PANEL (not list cards).
 * Chatters are skipped — too cramped / line-scoped.
 */

import {
    getEventCommentaryEntries,
    looksLikeChatterCommentaryName,
    serializeCommentaryEntries,
} from '../../system-interface/interface-shared/storyEventCommentary.js';
import { normalizeForPredictiveMatch } from '../../system-interface/interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';
import { renderEventItemMarkup } from '../../system-interface/interface-left-panel/event-system/render/renderEventItemMarkup.js';
import { isChatterEntry } from '../data/dialogueTheaterEntryType.js';

/**
 * @typedef {{
 *   eventIndex: number,
 *   variantIndex: number,
 *   event: object,
 *   displayEvent: object,
 * }} DialogueStoryCommentaryRef
 */

/** @type {Map<string, DialogueStoryCommentaryRef[]> | null} */
let usageIndex = null;

/** @type {unknown} */
let usageIndexEventsRef = null;

/**
 * @returns {object[]}
 */
export function getStoryEventsForCommentaryLookup() {
    const ds = window.eventManager?.dataService;
    if (ds && typeof ds.getStoryTimelineEventsForDock === 'function') {
        const list = ds.getStoryTimelineEventsForDock();
        if (Array.isArray(list) && list.length) return list;
    }
    if (Array.isArray(window.eventManager?.events) && window.eventManager.events.length) {
        return window.eventManager.events;
    }
    return [];
}

/**
 * @param {string} key
 * @param {DialogueStoryCommentaryRef} ref
 * @param {Map<string, DialogueStoryCommentaryRef[]>} map
 */
function pushRef(key, ref, map) {
    if (!key) return;
    const list = map.get(key);
    if (list) {
        if (!list.some((r) => r.eventIndex === ref.eventIndex && r.variantIndex === ref.variantIndex)) {
            list.push(ref);
        }
    } else {
        map.set(key, [ref]);
    }
}

/**
 * @param {object[]} events
 * @returns {Map<string, DialogueStoryCommentaryRef[]>}
 */
export function buildDialogueCommentaryUsageIndex(events) {
    /** @type {Map<string, DialogueStoryCommentaryRef[]>} */
    const map = new Map();

    /**
     * @param {import('../../system-interface/interface-shared/storyEventCommentary.js').CommentaryEntry} entry
     * @param {DialogueStoryCommentaryRef} ref
     */
    const indexEntry = (entry, ref) => {
        const name = String(entry?.name || '').trim();
        if (name && looksLikeChatterCommentaryName(name)) return;
        const theaterId = String(entry?.theaterId || '').trim();
        if (theaterId) pushRef(`id:${theaterId}`, ref, map);
        if (name) pushRef(`name:${normalizeForPredictiveMatch(name)}`, ref, map);
    };

    if (!Array.isArray(events)) return map;

    events.forEach((event, eventIndex) => {
        if (!event || typeof event !== 'object') return;

        for (const entry of getEventCommentaryEntries(event)) {
            indexEntry(entry, {
                eventIndex,
                variantIndex: 0,
                event,
                displayEvent: event,
            });
        }

        const variants = Array.isArray(event.variants) ? event.variants : [];
        variants.forEach((variant, variantIndex) => {
            if (!variant || typeof variant !== 'object') return;
            for (const entry of getEventCommentaryEntries(variant)) {
                indexEntry(entry, {
                    eventIndex,
                    variantIndex,
                    event,
                    displayEvent: { ...event, ...variant },
                });
            }
        });
    });

    return map;
}

/**
 * @param {object[]} [events]
 */
export function ensureDialogueCommentaryUsageIndex(events = getStoryEventsForCommentaryLookup()) {
    if (usageIndex && usageIndexEventsRef === events) return usageIndex;
    usageIndex = buildDialogueCommentaryUsageIndex(events);
    usageIndexEventsRef = events;
    return usageIndex;
}

export function invalidateDialogueCommentaryUsageIndex() {
    usageIndex = null;
    usageIndexEventsRef = null;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation | null | undefined} conversation
 * @returns {DialogueStoryCommentaryRef[]}
 */
export function lookupDialogueCommentaryUsage(conversation) {
    if (!conversation || isChatterEntry(conversation)) return [];
    const index = ensureDialogueCommentaryUsageIndex();
    /** @type {Map<string, DialogueStoryCommentaryRef>} */
    const merged = new Map();
    const theaterId = String(conversation.id || '').trim();
    if (theaterId) {
        for (const ref of index.get(`id:${theaterId}`) || []) {
            merged.set(`${ref.eventIndex}:${ref.variantIndex}`, ref);
        }
    }
    const nameKey = normalizeForPredictiveMatch(conversation.name);
    if (nameKey) {
        for (const ref of index.get(`name:${nameKey}`) || []) {
            merged.set(`${ref.eventIndex}:${ref.variantIndex}`, ref);
        }
    }
    return [...merged.values()].sort((a, b) => a.eventIndex - b.eventIndex || a.variantIndex - b.variantIndex);
}

/**
 * @param {object} displayEvent
 * @returns {string|null}
 */
export function resolveStoryEventImagePath(displayEvent) {
    if (!displayEvent || typeof displayEvent !== 'object') return null;
    const name = String(displayEvent.name || '').trim();
    const image = displayEvent.image != null ? String(displayEvent.image) : '';

    if (typeof window !== 'undefined') {
        if (window.NavigationImageHelpers?.getEventImagePath) {
            return window.NavigationImageHelpers.getEventImagePath(displayEvent, name, 'story');
        }
        if (window.eventManager?.getEventImagePath) {
            return window.eventManager.getEventImagePath(name, image, 'story');
        }
    }
    return image.trim() || null;
}

/**
 * @param {DialogueStoryCommentaryRef} ref
 */
export function openStoryEventFromTheaterCommentaryRef(ref) {
    if (!ref?.event) return;
    const slide = window.standaloneEventSlide;
    if (!slide || typeof slide.showEvent !== 'function') {
        console.warn('[theater] standaloneEventSlide unavailable — cannot open story entry');
        return;
    }

    const events = getStoryEventsForCommentaryLookup();
    const list = Array.isArray(events) && events.length ? events : [ref.event];
    let index = ref.eventIndex;
    if (!list[index] || list[index] !== ref.event) {
        const byIdentity = list.indexOf(ref.event);
        if (byIdentity >= 0) {
            index = byIdentity;
        } else {
            const name = String(ref.event.name || '').trim().toLowerCase();
            const byName = list.findIndex((e) => String(e?.name || '').trim().toLowerCase() === name);
            if (byName >= 0) index = byName;
        }
    }

    slide.showEvent(index, {
        eventList: list,
        variantIndex: ref.variantIndex || 0,
        keepSlideHistory: true,
    });
}

/**
 * Keep timeline commentary linked when a dialogue is renamed:
 * refresh `name` + stamp `theaterId` on matching commentary entries, then persist.
 * @param {string} conversationId
 * @param {string} previousName
 * @param {string} nextName
 * @returns {Promise<number>} count of commentary rows updated
 */
export async function rewriteStoryCommentaryOnTheaterRename(conversationId, previousName, nextName) {
    const theaterId = String(conversationId || '').trim();
    const prev = String(previousName || '').trim();
    const next = String(nextName || '').trim();
    if (!theaterId || !next || prev === next) return 0;

    const events = getStoryEventsForCommentaryLookup();
    if (!Array.isArray(events) || !events.length) return 0;

    const prevKey = normalizeForPredictiveMatch(prev);
    let updated = 0;

    /**
     * @param {object} owner
     */
    const patchOwner = (owner) => {
        if (!owner || !Array.isArray(owner.commentary) || !owner.commentary.length) return;
        let changed = false;
        const nextEntries = getEventCommentaryEntries(owner).map((entry) => {
            const byId = entry.theaterId && entry.theaterId === theaterId;
            const byName = !looksLikeChatterCommentaryName(entry.name)
                && normalizeForPredictiveMatch(entry.name) === prevKey;
            if (!byId && !byName) return entry;
            changed = true;
            updated += 1;
            return {
                ...entry,
                name: next,
                theaterId,
            };
        });
        if (changed) {
            owner.commentary = serializeCommentaryEntries(nextEntries);
        }
    };

    for (const event of events) {
        if (!event || typeof event !== 'object') continue;
        patchOwner(event);
        if (Array.isArray(event.variants)) {
            for (const variant of event.variants) patchOwner(variant);
        }
    }

    if (!updated) return 0;

    invalidateDialogueCommentaryUsageIndex();

    const ds = window.eventManager?.dataService;
    if (ds) {
        try {
            if (typeof ds.getArchiveSource === 'function' && ds.getArchiveSource() === 'story') {
                await ds.saveEvents?.();
            } else {
                ds.persistStoryDockTimelineFromSnapshot?.();
            }
        } catch (err) {
            console.warn('[theater] Failed to persist story commentary rename rewrite', err);
        }
    }

    return updated;
}

/**
 * Same card chrome as Story dock / Event Manager list (`renderEventItemMarkup`).
 * @param {DialogueStoryCommentaryRef} ref
 * @returns {HTMLElement}
 */
function buildStoryCommentaryRefThumbCard(ref) {
    const event = ref.event && typeof ref.event === 'object' ? ref.event : {};
    const displayEvent = ref.displayEvent && typeof ref.displayEvent === 'object'
        ? ref.displayEvent
        : event;
    const index = Number.isFinite(ref.eventIndex) ? ref.eventIndex : 0;
    const currentVariantIndex = Number.isFinite(ref.variantIndex) ? ref.variantIndex : 0;
    const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
    const imagePath = resolveStoryEventImagePath(displayEvent);

    const d = displayEvent.description;
    let hasDescription = false;
    if (d) {
        const textContent = String(d).replace(/<[^>]*>/g, '').trim();
        if (
            textContent
            && textContent !== 'No description available.'
            && textContent !== 'No description available'
        ) {
            hasDescription = true;
        }
    }
    const isUnfinished = !hasDescription;

    const locationName = displayEvent.cityDisplayName
        || event.cityDisplayName
        || null;
    const displayLocationType = displayEvent.locationType || event.locationType || 'earth';
    const eventName = String(displayEvent.name || event.name || 'Story entry').trim();
    const title = `Open #${index + 1} ${eventName}`;

    const item = document.createElement('div');
    item.className = 'event-item event-item--view-only';
    item.setAttribute('role', 'listitem');
    item.dataset.index = String(index);
    item.title = title;
    item.setAttribute('aria-label', title);
    if (isMultiEvent) item.classList.add('multi-event');
    item.classList.toggle('event-item--unfinished', isUnfinished);

    item.innerHTML = renderEventItemMarkup({
        event,
        displayEvent,
        index,
        currentVariantIndex,
        isMultiEvent,
        locationName,
        displayLocationType,
        imagePath,
        isSatelliteArchive: false,
        hasOverlap: false,
        isUnfinished,
        useStoryArchiveDockTitle: true,
    });

    // Few thumbs — load immediately (list lazy-IO roots on #eventsList).
    item.querySelectorAll('img[data-src]').forEach((img) => {
        const src = img.getAttribute('data-src');
        if (src) {
            img.setAttribute('src', src);
            img.removeAttribute('data-src');
        }
    });

    item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openStoryEventFromTheaterCommentaryRef(ref);
    });
    item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openStoryEventFromTheaterCommentaryRef(ref);
        }
    });
    item.tabIndex = 0;

    return item;
}

/**
 * Mount story-entry thumbs on the dialogue info panel (view/edit host).
 * @param {HTMLElement | null | undefined} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation | null | undefined} conversation
 */
export function mountDialogueTheaterStoryCommentaryRefs(host, conversation) {
    if (!(host instanceof HTMLElement)) return;
    host.querySelectorAll('.dialogue-theater-edit__story-refs').forEach((el) => el.remove());

    if (!conversation || isChatterEntry(conversation)) return;

    invalidateDialogueCommentaryUsageIndex();
    const refs = lookupDialogueCommentaryUsage(conversation);
    if (!refs.length) return;

    const root = host.querySelector('.dialogue-theater-edit') || host;
    const section = document.createElement('section');
    section.className = 'dialogue-theater-edit__section dialogue-theater-edit__story-refs';
    section.setAttribute('aria-label', 'Story entries using this dialogue as commentary');

    const head = document.createElement('div');
    head.className = 'dialogue-theater-edit__section-head';
    head.innerHTML = '<h3 class="dialogue-theater-edit__section-title">Used as commentary</h3>';
    section.appendChild(head);

    const hint = document.createElement('p');
    hint.className = 'dialogue-theater-edit__hint';
    hint.textContent = 'Story timeline entries that cite this dialogue. Click a thumbnail to open the entry.';
    section.appendChild(hint);

    const row = document.createElement('div');
    row.id = 'dialogueTheaterStoryCommentaryRefs';
    row.className = 'events-list dialogue-theater-edit__story-refs-row';
    row.setAttribute('role', 'list');

    for (const ref of refs) {
        row.appendChild(buildStoryCommentaryRefThumbCard(ref));
    }

    section.appendChild(row);

    // Last element in the entry panel (after dialogue lines / edit sections).
    root.appendChild(section);
}
