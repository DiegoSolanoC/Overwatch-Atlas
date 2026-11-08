/**
 * Gallery intel: promote NPC → Hero / demote Hero → NPC via local API.
 */

import { ARCHIVE_LOCALSTORAGE_KEYS } from '../../system-interface/interface-left-panel/event-system/data/archiveRouting.js';
import {
    clearBioArchiveEventsCache,
    setBioArchiveEventsCache,
} from './heroBiographyArchiveData.js';
import { clearBioFilterManifestCache } from './loadBioFilterManifest.js';
import { refreshHeroBiographyCategoryChipsIfActive } from './HeroBiographyHeroFilterBar.js';

/**
 * @param {'promote'|'demote'} direction
 * @param {string} name
 * @returns {Promise<{ ok: boolean, error?: string, kind?: string, steps?: string[] }>}
 */
export async function transferGalleryEntityKindFromUi(direction, name) {
    const entityName = String(name || '').trim();
    if (!entityName) return { ok: false, error: 'No entity selected.' };
    if (direction !== 'promote' && direction !== 'demote') {
        return { ok: false, error: 'Invalid direction.' };
    }

    const apiUrl =
        typeof window.resolveDevApiUrl === 'function'
            ? window.resolveDevApiUrl('api/gallery-entity-kind')
            : '/api/gallery-entity-kind';

    let res;
    try {
        res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: entityName, direction }),
        });
    } catch (err) {
        return {
            ok: false,
            error: `Local server required for ${direction} (${err?.message || err}).`,
        };
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
        return { ok: false, error: data?.error || `HTTP ${res.status}` };
    }

    const heroNames = Array.isArray(data.heroes)
        ? data.heroes.map((e) => e?.name).filter(Boolean)
        : [];
    const npcNames = Array.isArray(data.npcs)
        ? data.npcs.map((e) => e?.name).filter(Boolean)
        : [];

    if (Array.isArray(data.heroes)) {
        try {
            localStorage.setItem(
                ARCHIVE_LOCALSTORAGE_KEYS.heroes,
                JSON.stringify(data.heroes),
            );
        } catch (_) { /* ignore */ }
        setBioArchiveEventsCache('heroes', data.heroes);
    }
    if (Array.isArray(data.npcs)) {
        try {
            localStorage.setItem(
                ARCHIVE_LOCALSTORAGE_KEYS.npcs,
                JSON.stringify(data.npcs),
            );
        } catch (_) { /* ignore */ }
        setBioArchiveEventsCache('npcs', data.npcs);
    }

    clearBioArchiveEventsCache();
    clearBioFilterManifestCache();

    /* One coordinated Filters refresh — avoids triple paint flicker. */
    try {
        await window.FilterService?.applyEntityKindTransferRosters?.({
            direction,
            heroNames,
            npcNames,
        });
    } catch (err) {
        console.warn('[gallery] filter roster refresh after kind transfer failed:', err);
        try {
            await window.FilterService?.loadManifest?.({
                paintType: direction === 'promote' ? 'heroes' : 'npcs',
            });
        } catch (_) { /* ignore */ }
    }

    window.dispatchEvent(
        new CustomEvent('atlas-bio-archives-refreshed', {
            detail: {
                archives: ['heroes', 'npcs'],
                skipFiltersReload: true,
                orderByArchive: {
                    heroes: heroNames,
                    npcs: npcNames,
                },
            },
        }),
    );

    void refreshHeroBiographyCategoryChipsIfActive('heroes');
    void refreshHeroBiographyCategoryChipsIfActive('npcs');

    return {
        ok: true,
        kind: data.kind,
        steps: data.steps,
    };
}
