/**
 * Central opener: focus an archive entity in Gallery (stage + filters).
 * Used by Codex / bio chips / former Workshop peeks instead of the Data Archive slide.
 */

import { normalizeBioBiographyCategory } from './bioBiographyCategories.js';
import {
    applyExclusiveGallerySelection,
    isAtlasGalleryOpen,
} from './galleryFiltersBridge.js';
import {
    loadBioFilterManifestEntries,
    resolveBioManifestChipIdentity,
} from './loadBioFilterManifest.js';
import {
    getHeroDisplayName,
    matchFactionManifestToArchiveRowName,
    matchHeroManifestToArchiveRowName,
    matchNpcManifestToArchiveRowName,
    resolveManifestHeroId,
} from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
/**
 * @typedef {'heroes'|'factions'|'npcs'|'locations'|'countries'} GalleryBioKind
 */

/** @type {{ kind: GalleryBioKind, name: string } | null} */
let pendingFocus = null;

/**
 * @param {string} raw
 * @returns {GalleryBioKind}
 */
function normalizeOpenKind(raw) {
    const k = String(raw || '').trim().toLowerCase();
    if (k === 'hero' || k === 'heroes') return 'heroes';
    if (k === 'faction' || k === 'factions') return 'factions';
    if (k === 'npc' || k === 'npcs') return 'npcs';
    if (k === 'location' || k === 'locations') return 'locations';
    if (k === 'country' || k === 'countries') return 'countries';
    return normalizeBioBiographyCategory(raw);
}

/**
 * Queue a focus target consumed when Gallery finishes mounting (skips random hero).
 *
 * @param {string} kind
 * @param {string} name
 */
export function setPendingGalleryBioFocus(kind, name) {
    const entityName = String(name || '').trim();
    if (!entityName) {
        pendingFocus = null;
        return;
    }
    pendingFocus = { kind: normalizeOpenKind(kind), name: entityName };
}

/** @returns {{ kind: GalleryBioKind, name: string } | null} */
export function consumePendingGalleryBioFocus() {
    const next = pendingFocus;
    pendingFocus = null;
    return next;
}

/** @returns {boolean} */
export function hasPendingGalleryBioFocus() {
    return !!pendingFocus;
}

/**
 * @param {GalleryBioKind} kind
 * @param {string} rawName
 * @returns {Promise<{ filterKey: string, displayName: string, type: GalleryBioKind } | null>}
 */
async function resolveGalleryFocusTarget(kind, rawName) {
    const raw = String(rawName || '').trim();
    if (!raw) return null;

    if (kind === 'locations' || kind === 'countries') {
        return { filterKey: raw, displayName: raw, type: kind };
    }

    const entries = await loadBioFilterManifestEntries(kind);

    if (kind === 'factions') {
        const matched = matchFactionManifestToArchiveRowName(raw, entries);
        if (matched) {
            const id = resolveBioManifestChipIdentity('factions', matched);
            return { filterKey: id.filterKey, displayName: id.displayName, type: 'factions' };
        }
        return { filterKey: raw, displayName: raw, type: 'factions' };
    }

    if (kind === 'npcs') {
        const matched = matchNpcManifestToArchiveRowName(raw, entries);
        const filterKey = matched || raw;
        return {
            filterKey,
            displayName: getHeroDisplayName(filterKey),
            type: 'npcs',
        };
    }

    /* heroes */
    const heroList = /** @type {string[]} */ (entries);
    const matched =
        matchHeroManifestToArchiveRowName(raw, heroList)
        || resolveManifestHeroId(raw, heroList);
    const filterKey = matched || raw;
    return {
        filterKey,
        displayName: getHeroDisplayName(filterKey),
        type: 'heroes',
    };
}

/**
 * Apply a resolved entity to the live Gallery stage + Filters panel.
 *
 * @param {string} kind
 * @param {string} name
 * @returns {Promise<boolean>}
 */
export async function focusBioEntityInOpenGallery(kind, name) {
    if (!isAtlasGalleryOpen()) return false;
    const target = await resolveGalleryFocusTarget(normalizeOpenKind(kind), name);
    if (!target?.filterKey) return false;
    applyExclusiveGallerySelection(target.filterKey, target.displayName, target.type);
    window.SoundEffectsManager?.play?.('eventClick');
    return true;
}

/**
 * Ensure Gallery is open and focused on the named entity.
 *
 * @param {string} kind — hero(es) / faction(s) / npc(s) / location(s) / countries
 * @param {string} name
 */
export async function openBioEntityInGallery(kind, name) {
    const entityName = String(name || '').trim();
    if (!entityName) return;

    const openKind = normalizeOpenKind(kind);

    if (isAtlasGalleryOpen()) {
        const ok = await focusBioEntityInOpenGallery(openKind, entityName);
        if (!ok && typeof window.updateStatus === 'function') {
            window.updateStatus(`Could not open “${entityName}” in Gallery`, 'warning');
        }
        return;
    }

    setPendingGalleryBioFocus(openKind, entityName);

    const run =
        typeof window.runGalleryComponents === 'function'
            ? window.runGalleryComponents
            : typeof window.runHeroBiographyComponents === 'function'
                ? window.runHeroBiographyComponents
                : null;

    if (!run) {
        pendingFocus = null;
        if (typeof window.updateStatus === 'function') {
            window.updateStatus('Gallery is not available.', 'warning');
        }
        return;
    }

    /* isAutoLoad: quieter hop from Codex / Story / Archive chips */
    await run(true);

    /* If mount skipped pending (e.g. race), apply once host exists */
    if (isAtlasGalleryOpen() && hasPendingGalleryBioFocus()) {
        const leftover = consumePendingGalleryBioFocus();
        if (leftover) {
            await focusBioEntityInOpenGallery(leftover.kind, leftover.name);
        }
    }
}
