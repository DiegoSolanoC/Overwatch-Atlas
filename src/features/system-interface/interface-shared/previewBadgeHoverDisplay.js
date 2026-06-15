/**
 * Preview badge filter icons for map/globe callouts and summary hover badge.
 */

import { readPreviewBadgesFromTarget } from './storyPreviewBadgeFields.js';
import { resolveNpcCanonicalName } from './npcNameAliases.js';
import {
    canonicalizeFactionTokens,
    canonicalizeHeroTokens,
} from './storyEventFilterPlaces.js';

const HERO_IMG = 'src/assets/images/Filters/Heroes';
const NPC_IMG = 'src/assets/images/Filters/NPCs';
const FACTION_IMG = 'src/assets/images/Filters/Factions';
const FACTION_FALLBACK = 'src/assets/images/Icons/Filter Icons/Faction Icon.png';

function splitCsvTokens(raw) {
    return String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function manifestHeroes() {
    return window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
}

function manifestNpcs() {
    return window.eventManager?.npcs || window.globeController?.dataModel?.npcs || [];
}

function manifestFactions() {
    return window.eventManager?.factions?.length > 0
        ? window.eventManager.factions
        : window.globeController?.dataModel?.factions || [];
}

/**
 * @param {unknown} token
 * @returns {{ kind: 'hero'|'npc', key: string, src: string }|null}
 */
export function resolvePreviewBadgeCharacterIcon(token) {
    const raw = String(token || '').trim();
    if (!raw) return null;

    const npcName = resolveNpcCanonicalName(raw);
    const npcLower = npcName.toLowerCase();
    const npcList = manifestNpcs();
    for (let i = 0; i < npcList.length; i += 1) {
        if (String(npcList[i]).toLowerCase() === npcLower) {
            return {
                kind: 'npc',
                key: String(npcList[i]),
                src: `${NPC_IMG}/${encodeURIComponent(String(npcList[i]))}.png`,
            };
        }
    }

    const heroKey = canonicalizeHeroTokens([raw])[0] || raw;
    return {
        kind: 'hero',
        key: heroKey,
        src: `${HERO_IMG}/${encodeURIComponent(heroKey)}.png`,
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
            ? `${FACTION_IMG}/${encodeURIComponent(filename)}.png`
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
 * @returns {{ main: object[], secondary: object[], factions: object[] }|null}
 */
export function buildPreviewBadgeIconsFromTarget(target) {
    if (!target || typeof target !== 'object') return null;

    const badges = readPreviewBadgesFromTarget(target);
    const mainTokens = splitCsvTokens(badges.main).slice(0, 3);
    const secondaryTokens = splitCsvTokens(badges.secondary).slice(0, 3);
    const factionTokens = splitCsvTokens(badges.faction).slice(0, 3);

    const main = mainTokens
        .map((t) => resolvePreviewBadgeCharacterIcon(t))
        .filter(Boolean);
    const secondary = secondaryTokens
        .map((t) => resolvePreviewBadgeCharacterIcon(t))
        .filter(Boolean);
    const factions = factionTokens
        .map((t) => resolvePreviewBadgeFactionIcon(t))
        .filter(Boolean);

    if (main.length === 0 && secondary.length === 0 && factions.length === 0) return null;
    return { main, secondary, factions };
}

/**
 * @param {*} icons
 * @returns {boolean}
 */
export function hasPreviewBadgeIcons(icons) {
    if (!icons || typeof icons !== 'object') return false;
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

/**
 * @param {HTMLElement} parentEl
 * @param {{ main?: object|object[], secondary?: object[], factions?: object[] }|null|undefined} icons
 * @param {{ compact?: boolean }} [options]
 */
export function appendPreviewBadgeIconRow(parentEl, icons, options = {}) {
    if (!parentEl || !hasPreviewBadgeIcons(icons)) return null;

    const row = document.createElement('div');
    row.className = 'preview-badge-icons';
    if (options.compact) row.classList.add('preview-badge-icons--compact');

    const left = document.createElement('div');
    left.className = 'preview-badge-icons__characters';

    const mainGroup = document.createElement('div');
    mainGroup.className = 'preview-badge-icons__main-group';
    const mainList = Array.isArray(icons.main)
        ? icons.main
        : icons.main
            ? [icons.main]
            : [];
    mainList.forEach((entry) => {
        mainGroup.appendChild(createPreviewBadgeImg(entry, 'main', entry.key));
    });
    if (mainGroup.childElementCount > 0) left.appendChild(mainGroup);

    const secondaryGroup = document.createElement('div');
    secondaryGroup.className = 'preview-badge-icons__secondary-group';
    (icons.secondary || []).forEach((entry) => {
        secondaryGroup.appendChild(createPreviewBadgeImg(entry, 'secondary', entry.key));
    });
    if (secondaryGroup.childElementCount > 0) left.appendChild(secondaryGroup);

    const factions = document.createElement('div');
    factions.className = 'preview-badge-icons__factions';
    (icons.factions || []).forEach((entry) => {
        factions.appendChild(createPreviewBadgeImg(entry, 'faction', entry.displayName));
    });

    if (left.childElementCount > 0) {
        row.appendChild(left);
    }
    if (factions.childElementCount > 0) {
        row.appendChild(factions);
    }

    if (!row.childElementCount) return null;
    parentEl.appendChild(row);
    return row;
}

/**
 * @param {HTMLElement|null|undefined} slotEl
 * @param {{ main?: object|object[], secondary?: object[], factions?: object[] }|null|undefined} icons
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
        buildPreviewBadgeIconsFromTarget,
        hasPreviewBadgeIcons,
        appendPreviewBadgeIconRow,
        fillPreviewBadgeIconSlot,
        resolvePreviewBadgeCharacterIcon,
        resolvePreviewBadgeFactionIcon,
    };
}
