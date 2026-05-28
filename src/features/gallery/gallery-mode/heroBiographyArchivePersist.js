/**
 * Persist heroes-archive fields from Hero Biography (Gallery) stage.
 */

import {
    clearHeroesArchiveEventsCache,
    findHeroArchiveEntryByFilterKey,
    loadHeroesArchiveEvents,
    setHeroesArchiveEventsCache,
} from './heroBiographyArchiveData.js';

const HEROES_STORAGE_KEY = 'timelineEventsArchiveHeroes';

/**
 * @param {object[]} events
 */
function writeHeroesArchiveLocal(events) {
    try {
        localStorage.setItem(HEROES_STORAGE_KEY, JSON.stringify(events));
    } catch (err) {
        console.warn('[gallery] Could not write heroes archive to localStorage:', err);
    }
    setHeroesArchiveEventsCache(events);
}

/**
 * @param {object[]} events
 */
function dispatchHeroesArchiveRefreshed(events) {
    const orderNames = (events || [])
        .map((e) => (e && e.name != null ? String(e.name).trim() : ''))
        .filter(Boolean);
    window.dispatchEvent(
        new CustomEvent('atlas-bio-archives-refreshed', {
            detail: { archives: ['heroes'], orderNames },
        }),
    );
}

/**
 * @param {object[]} events
 */
function postHeroesArchiveToDevApi(events) {
    const ds = window.eventManager?.dataService;
    if (ds && typeof ds._canPersistTimelineJsonToRepo === 'function' && !ds._canPersistTimelineJsonToRepo()) {
        return;
    }

    try {
        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl('api/story-archive')
                : '/api/story-archive';
        fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archive: 'heroes', events }),
        })
            .then(async (res) => {
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || `HTTP ${res.status}`);
                }
                return res.json().catch(() => ({}));
            })
            .then((data) => {
                window.updateAppStatus?.(
                    `Saved heroes archive (${data?.eventsCount ?? events.length} entries)`,
                    'success',
                );
            })
            .catch((err) => {
                console.warn('[gallery] heroes archive API save failed:', err);
                window.updateAppStatus?.(
                    `Saved locally; could not write heroes.json (${err?.message || 'API error'}).`,
                    'warning',
                );
            });
    } catch (err) {
        console.warn('[gallery] heroes archive API save skipped:', err);
    }
}

/**
 * @param {string} heroFilterKey
 * @param {object[]} events
 * @returns {number}
 */
function findHeroArchiveIndex(heroFilterKey, events) {
    const key = String(heroFilterKey || '').trim();
    if (!key || !Array.isArray(events)) return -1;
    for (let i = 0; i < events.length; i++) {
        if (findHeroArchiveEntryByFilterKey(key, [events[i]])) return i;
    }
    return -1;
}

/**
 * @param {string} heroFilterKey
 * @param {string} heroDisplayName
 * @param {{ description?: string, birthday?: string, connections?: object[] }} patch
 * @returns {Promise<{ ok: boolean, error?: string, entry?: object }>}
 */
export async function saveHeroArchiveEntryPatchFromBiographyStage(heroFilterKey, heroDisplayName, patch) {
    const key = String(heroFilterKey || '').trim();
    if (!key) return { ok: false, error: 'No hero selected.' };

    clearHeroesArchiveEventsCache();
    const loaded = await loadHeroesArchiveEvents();
    const events = loaded.map((row) => ({ ...row }));

    let idx = findHeroArchiveIndex(key, events);
    if (idx < 0) {
        const name = String(heroDisplayName || key).trim() || key;
        events.push({
            name,
            description: patch.description !== undefined ? String(patch.description ?? '').trim() : '',
            birthday: patch.birthday !== undefined ? String(patch.birthday ?? '').trim() : '',
            relevantLocations: [],
            connections: patch.connections !== undefined ? patch.connections : [],
        });
        idx = events.length - 1;
    } else {
        const prev = events[idx];
        const prevConnections = Array.isArray(prev.connections)
            ? prev.connections.map((c) => ({ ...c }))
            : [];

        const next = { ...prev };
        if (patch.description !== undefined) {
            next.description = String(patch.description ?? '').trim();
        }
        if (patch.birthday !== undefined) {
            next.birthday = String(patch.birthday ?? '').trim();
        }
        if (patch.connections !== undefined) {
            next.connections = patch.connections;
        }
        events[idx] = next;

        if (
            patch.connections !== undefined
            && window.BioArchiveConnectionsSync?.syncMirrorsAfterSubjectSave
        ) {
            window.BioArchiveConnectionsSync.syncMirrorsAfterSubjectSave(
                events,
                'heroes',
                events[idx],
                prevConnections,
            );
        }
    }

    writeHeroesArchiveLocal(events);

    const em = window.eventManager;
    const ds = em?.dataService;
    const onHeroesArchive =
        typeof ds?.getArchiveSource === 'function' && ds.getArchiveSource() === 'heroes';

    if (onHeroesArchive && Array.isArray(em?.events)) {
        let emIdx = findHeroArchiveIndex(key, em.events);
        if (emIdx < 0 && events[idx]) {
            emIdx =
                window.BioArchiveConnectionsSync?.resolveBioArchiveEventIndex?.(
                    em.events,
                    events[idx],
                    'heroes',
                ) ?? -1;
        }

        if (emIdx >= 0) {
            em.events[emIdx] = { ...events[idx] };
            em.unsavedEventIndices?.add(emIdx);
        } else {
            em.events.push({ ...events[idx] });
            em.unsavedEventIndices?.add(em.events.length - 1);
        }
        ds?.saveEvents?.();
    } else {
        dispatchHeroesArchiveRefreshed(events);
        postHeroesArchiveToDevApi(events);
    }

    return { ok: true, entry: events[idx] };
}

/**
 * @param {string} heroFilterKey
 * @param {string} heroDisplayName
 * @param {{ description?: string, birthday?: string }} patch
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function saveHeroArchiveBioFromBiographyStage(heroFilterKey, heroDisplayName, patch) {
    const result = await saveHeroArchiveEntryPatchFromBiographyStage(heroFilterKey, heroDisplayName, patch);
    return { ok: result.ok, error: result.error };
}
