/**
 * Preview badge filter icons for map/globe callouts.
 * Derived from grouped relevancies with optional per-group ★ priority on NPC/faction rows.
 *
 * Sizing fallback when categories are missing:
 *   heroes present → heroes large, npcs + factions small
 *   no heroes      → npcs large, factions small
 *   no heroes/npcs → factions large only
 *
 * Starred NPC/faction groups fill the large row before heroes.
 */

import { buildFactionDefaultImagePath } from '../interface-filter-menu/images/factionImagePaths.js';
import { resolveNpcCanonicalName } from './npcNameAliases.js';
import {
    canonicalizeFactionTokens,
    canonicalizeHeroTokens,
    canonicalizeNpcTokens,
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens,
    splitFilterPlaceTokens,
} from './storyEventFilterPlaces.js';

const HERO_IMG = 'src/assets/images/Filters/Heroes';
const NPC_IMG = 'src/assets/images/Filters/NPCs';
const FACTION_IMG = 'src/assets/images/Filters/Factions';
const FACTION_FALLBACK = 'src/assets/images/Icons/Filter Icons/Faction Icon.png';

const PREVIEW_BADGE_LIMIT = 3;

/**
 * @typedef {{ kind: 'hero'|'npc'|'faction', token: string }} PreviewBadgeSlot
 * @typedef {{ size: 'main'|'support', slots: PreviewBadgeSlot[] }} PreviewBadgeRowDef
 */

function manifestFactions() {
    return window.eventManager?.factions?.length > 0
        ? window.eventManager.factions
        : window.globeController?.dataModel?.factions || [];
}

/**
 * @param {'hero'|'npc'|'faction'} kind
 * @param {string} token
 * @returns {string}
 */
function slotKey(kind, token) {
    return `${kind}:${String(token).toLowerCase()}`;
}

/**
 * @param {PreviewBadgeSlot[]} slots
 * @param {number} limit
 * @param {Set<string>} used
 * @returns {PreviewBadgeSlot[]}
 */
function takeUniqueSlots(slots, limit, used) {
    const out = [];
    for (let i = 0; i < slots.length; i += 1) {
        const slot = slots[i];
        const key = slotKey(slot.kind, slot.token);
        if (used.has(key)) continue;
        used.add(key);
        out.push(slot);
        if (out.length >= limit) break;
    }
    return out;
}

/**
 * @param {object|null|undefined} target
 * @param {string} placesKey
 * @param {(tokens: string[]) => string[]} canonicalizeFn
 * @param {(target: object) => string[]} legacyGetter
 * @returns {{ priority: string[], rest: string[], all: string[] }}
 */
function categoryTokensFromTarget(target, placesKey, canonicalizeFn, legacyGetter) {
    if (Array.isArray(target?.[placesKey])) {
        return splitFilterPlaceTokens(target[placesKey], canonicalizeFn);
    }
    const legacy = legacyGetter(target);
    return { priority: [], rest: legacy, all: legacy };
}

/**
 * @param {string[]} tokens
 * @param {'hero'|'npc'|'faction'} kind
 * @returns {PreviewBadgeSlot[]}
 */
function tokensToSlots(tokens, kind) {
    return (Array.isArray(tokens) ? tokens : []).map((token) => ({ kind, token }));
}

/**
 * @param {object|null|undefined} target
 * @returns {{ rows: PreviewBadgeRowDef[] }}
 */
export function getPreviewBadgeLayoutFromTarget(target) {
    if (!target || typeof target !== 'object') {
        return { rows: [] };
    }

    const heroes = categoryTokensFromTarget(
        target,
        'heroFilterPlaces',
        canonicalizeHeroTokens,
        getStoryEventHeroTokens
    );
    const npcs = categoryTokensFromTarget(
        target,
        'npcFilterPlaces',
        canonicalizeNpcTokens,
        getStoryEventNpcTokens
    );
    const factions = categoryTokensFromTarget(
        target,
        'factionFilterPlaces',
        canonicalizeFactionTokens,
        getStoryEventFactionTokens
    );

    const hasHeroes = heroes.all.length > 0;
    const hasNpcs = npcs.all.length > 0;
    const hasFactions = factions.all.length > 0;
    const used = new Set();

    const starredSlots = [
        ...tokensToSlots(npcs.priority, 'npc'),
        ...tokensToSlots(factions.priority, 'faction'),
    ];

    let mainSlots = takeUniqueSlots(starredSlots, PREVIEW_BADGE_LIMIT, used);

    if (hasHeroes) {
        mainSlots = mainSlots.concat(
            takeUniqueSlots(tokensToSlots(heroes.all, 'hero'), PREVIEW_BADGE_LIMIT - mainSlots.length, used)
        );
    } else if (hasNpcs) {
        mainSlots = takeUniqueSlots(tokensToSlots(npcs.all, 'npc'), PREVIEW_BADGE_LIMIT, used);
    } else if (hasFactions) {
        mainSlots = takeUniqueSlots(tokensToSlots(factions.all, 'faction'), PREVIEW_BADGE_LIMIT, used);
    }

    let secondarySlots = [];
    let tertiarySlots = [];

    if (hasHeroes) {
        secondarySlots = takeUniqueSlots(tokensToSlots(npcs.all, 'npc'), PREVIEW_BADGE_LIMIT, used);
        tertiarySlots = takeUniqueSlots(tokensToSlots(factions.all, 'faction'), PREVIEW_BADGE_LIMIT, used);
    } else if (hasNpcs) {
        secondarySlots = takeUniqueSlots(tokensToSlots(factions.all, 'faction'), PREVIEW_BADGE_LIMIT, used);
    }

    /** @type {PreviewBadgeRowDef[]} */
    const rows = [];
    if (mainSlots.length) rows.push({ size: 'main', slots: mainSlots });
    if (secondarySlots.length) rows.push({ size: 'support', slots: secondarySlots });
    if (tertiarySlots.length) rows.push({ size: 'support', slots: tertiarySlots });

    return { rows };
}

/**
 * @param {PreviewBadgeSlot} slot
 * @returns {object|null}
 */
function resolveIconForSlot(slot) {
    if (!slot?.token) return null;
    if (slot.kind === 'hero') return resolvePreviewBadgeHeroIcon(slot.token);
    if (slot.kind === 'npc') return resolvePreviewBadgeNpcIcon(slot.token);
    const faction = resolvePreviewBadgeFactionIcon(slot.token);
    return faction ? { ...faction, kind: 'faction' } : null;
}

/**
 * @param {unknown} token
 * @returns {{ kind: 'hero', key: string, src: string }|null}
 */
export function resolvePreviewBadgeHeroIcon(token) {
    const heroKey = canonicalizeHeroTokens([token])[0] || String(token || '').trim();
    if (!heroKey) return null;
    return {
        kind: 'hero',
        key: heroKey,
        src: `${HERO_IMG}/${encodeURIComponent(heroKey)}.png`,
    };
}

/**
 * @param {unknown} token
 * @returns {{ kind: 'npc', key: string, src: string }|null}
 */
export function resolvePreviewBadgeNpcIcon(token) {
    const npcName = resolveNpcCanonicalName(token);
    const canonical = canonicalizeNpcTokens([npcName])[0] || npcName;
    if (!canonical) return null;
    return {
        kind: 'npc',
        key: canonical,
        src: `${NPC_IMG}/${encodeURIComponent(canonical)}.png`,
    };
}

/**
 * @param {unknown} token
 * @returns {{ displayName: string, filename: string, src: string }|null}
 */
export function resolvePreviewBadgeFactionIcon(token) {
    const raw = String(token || '').trim();
    if (!raw) return null;
    const displayName = canonicalizeFactionTokens([raw])[0] || raw;
    const factions = manifestFactions();
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    let filename = '';

    for (let i = 0; i < factions.length; i += 1) {
        const f = factions[i];
        const fn = String(f?.filename || '').trim();
        const dn = String(f?.displayName || '').trim();
        if (!fn) continue;
        if (dn === displayName || fn === displayName) {
            filename = fn;
            break;
        }
        if (
            fh
            && typeof fh.factionIdsMatch === 'function'
            && (fh.factionIdsMatch(fn, displayName) || fh.factionIdsMatch(dn, displayName))
        ) {
            filename = fn;
            break;
        }
    }

    if (!filename) {
        const bare = displayName.replace(/^\d+/, '').trim();
        for (let j = 0; j < factions.length; j += 1) {
            const fn2 = String(factions[j]?.filename || '').trim();
            if (!fn2) continue;
            if (fn2.replace(/^\d+/, '').trim().toLowerCase() === bare.toLowerCase()) {
                filename = fn2;
                break;
            }
        }
    }

    return {
        displayName,
        filename: filename || displayName,
        src: filename
            ? buildFactionDefaultImagePath(filename)
            : FACTION_FALLBACK,
    };
}

/**
 * @param {object|null|undefined} eventObj
 * @param {{ variantIndex?: number }} [options]
 * @returns {object|null}
 */
export function resolvePreviewBadgeDisplayEvent(eventObj, options = {}) {
    if (!eventObj || typeof eventObj !== 'object') return null;
    const variants = Array.isArray(eventObj.variants) ? eventObj.variants : [];
    if (variants.length === 0) return eventObj;
    const vi = options?.variantIndex;
    const idx = typeof vi === 'number' && vi >= 0 && vi < variants.length ? vi : 0;
    return variants[idx] || variants[0] || eventObj;
}

/**
 * @param {object|null|undefined} target
 * @returns {{ rows: { size: 'main'|'support', items: object[] }[] }|null}
 */
export function buildPreviewBadgeIconsFromTarget(target) {
    const layout = getPreviewBadgeLayoutFromTarget(target);
    if (!layout.rows.length) return null;

    const rows = layout.rows
        .map((row) => ({
            size: row.size,
            items: row.slots.map((slot) => resolveIconForSlot(slot)).filter(Boolean),
        }))
        .filter((row) => row.items.length > 0);

    if (!rows.length) return null;
    return { rows };
}

/**
 * @param {*} icons
 * @returns {boolean}
 */
export function hasPreviewBadgeIcons(icons) {
    if (!icons || typeof icons !== 'object') return false;
    if (Array.isArray(icons.rows) && icons.rows.some((row) => row?.items?.length > 0)) {
        return true;
    }
    const mainList = Array.isArray(icons.main)
        ? icons.main
        : icons.main
            ? [icons.main]
            : [];
    return !!(
        mainList.length
        || (icons.secondary && icons.secondary.length)
        || (icons.factions && icons.factions.length)
    );
}

function createPreviewBadgeImg(entry, sizeClass, title) {
    const img = document.createElement('img');
    img.className = `preview-badge-icons__img preview-badge-icons__img--${sizeClass}`;
    if (entry.kind) img.classList.add(`preview-badge-icons__img--${entry.kind}`);
    img.src = entry.src;
    img.alt = '';
    img.title = title || entry.key || entry.displayName || '';
    img.decoding = 'async';
    img.draggable = false;
    img.setAttribute('aria-hidden', 'true');
    img.addEventListener('error', () => {
        if (entry.kind === 'faction' && img.src !== FACTION_FALLBACK) {
            img.src = FACTION_FALLBACK;
        } else {
            img.style.opacity = '0.35';
        }
    }, { once: true });
    return img;
}

function iconTitle(entry) {
    return entry.key || entry.displayName || '';
}

/**
 * @param {HTMLElement} parentEl
 * @param {{ rows?: { size?: string, items?: object[] }[], main?: object[], secondary?: object[], factions?: object[] }|null|undefined} icons
 * @param {{ compact?: boolean }} [options]
 */
export function appendPreviewBadgeIconRow(parentEl, icons, options = {}) {
    if (!parentEl || !hasPreviewBadgeIcons(icons)) return null;

    const row = document.createElement('div');
    row.className = 'preview-badge-icons';
    if (options.compact) row.classList.add('preview-badge-icons--compact');

    if (Array.isArray(icons.rows)) {
        icons.rows.forEach((rowDef) => {
            if (!rowDef?.items?.length) return;
            const group = document.createElement('div');
            const size = rowDef.size === 'main' ? 'main' : 'support';
            group.className = `preview-badge-icons__row preview-badge-icons__row--${size}`;
            rowDef.items.forEach((entry) => {
                group.appendChild(createPreviewBadgeImg(entry, size, iconTitle(entry)));
            });
            row.appendChild(group);
        });
    } else {
        const mainList = Array.isArray(icons.main)
            ? icons.main
            : icons.main
                ? [icons.main]
                : [];
        if (mainList.length > 0) {
            const mainGroup = document.createElement('div');
            mainGroup.className = 'preview-badge-icons__row preview-badge-icons__row--main';
            mainList.forEach((entry) => {
                mainGroup.appendChild(createPreviewBadgeImg(entry, 'main', iconTitle(entry)));
            });
            row.appendChild(mainGroup);
        }
        const secondaryList = icons.secondary || [];
        if (secondaryList.length > 0) {
            const secondaryGroup = document.createElement('div');
            secondaryGroup.className = 'preview-badge-icons__row preview-badge-icons__row--support';
            secondaryList.forEach((entry) => {
                secondaryGroup.appendChild(createPreviewBadgeImg(entry, 'support', iconTitle(entry)));
            });
            row.appendChild(secondaryGroup);
        }
        const factionList = icons.factions || [];
        if (factionList.length > 0) {
            const factionGroup = document.createElement('div');
            factionGroup.className = 'preview-badge-icons__row preview-badge-icons__row--support';
            factionList.forEach((entry) => {
                factionGroup.appendChild(createPreviewBadgeImg(entry, 'support', iconTitle(entry)));
            });
            row.appendChild(factionGroup);
        }
    }

    if (!row.childElementCount) return null;
    parentEl.appendChild(row);
    return row;
}

/**
 * @param {HTMLElement|null|undefined} slotEl
 * @param {*} icons
 * @param {{ compact?: boolean }} [options]
 */
export function fillPreviewBadgeIconSlot(slotEl, icons, options = {}) {
    if (!slotEl) return;
    slotEl.innerHTML = '';
    if (!hasPreviewBadgeIcons(icons)) {
        slotEl.style.display = 'none';
        return;
    }
    slotEl.style.display = '';
    appendPreviewBadgeIconRow(slotEl, icons, options);
}

if (typeof window !== 'undefined') {
    window.PreviewBadgeHoverDisplay = {
        resolvePreviewBadgeDisplayEvent,
        getPreviewBadgeLayoutFromTarget,
        buildPreviewBadgeIconsFromTarget,
        hasPreviewBadgeIcons,
        appendPreviewBadgeIconRow,
        fillPreviewBadgeIconSlot,
        resolvePreviewBadgeHeroIcon,
        resolvePreviewBadgeNpcIcon,
        resolvePreviewBadgeFactionIcon,
    };
}
