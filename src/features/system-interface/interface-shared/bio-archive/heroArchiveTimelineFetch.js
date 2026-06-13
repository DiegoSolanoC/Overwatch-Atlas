/**
 * Fetch story timeline + manifest for hero birthday sync (browser).
 */

import { FILES } from '../../../../data/registry.js';
import {
    applyTimelineBirthdaysToHeroArchive,
    buildHeroChipBirthdaysFromTimelineEvents,
} from './heroLifecycleBirthdaySync.js';

/** @type {unknown[] | null} */
let bundledTimelineCache = null;

/** @type {string[] | null} */
let bundledManifestHeroesCache = null;

/**
 * @returns {Promise<unknown[]>}
 */
export async function fetchBundledStoryTimelineEvents() {
    if (Array.isArray(bundledTimelineCache)) return bundledTimelineCache;
    try {
        const res = await fetch(`${FILES.eventSystem.timelineEvents}?v=${Date.now()}`, {
            cache: 'no-store',
        });
        if (!res.ok) return [];
        const data = await res.json();
        bundledTimelineCache = Array.isArray(data?.events) ? data.events : [];
        return bundledTimelineCache;
    } catch (_) {
        return [];
    }
}

/**
 * @returns {Promise<string[]>}
 */
export async function fetchManifestHeroNames() {
    if (Array.isArray(bundledManifestHeroesCache)) return bundledManifestHeroesCache;
    try {
        const res = await fetch(`${FILES.platform.manifest}?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        bundledManifestHeroesCache = Array.isArray(data?.heroes)
            ? data.heroes.map((name) => String(name ?? '').trim()).filter(Boolean)
            : [];
        return bundledManifestHeroesCache;
    } catch (_) {
        return [];
    }
}

/**
 * Best available timeline events: live EM story → dock snapshot → localStorage → bundled file.
 * @returns {Promise<unknown[]>}
 */
export async function resolveStoryTimelineEventsForBirthdaySync() {
    const ds = typeof window !== 'undefined' ? window.eventManager?.dataService : null;
    const arch = typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story';

    if (arch === 'story' && Array.isArray(window.eventManager?.events) && window.eventManager.events.length > 0) {
        return window.eventManager.events.slice();
    }

    if (typeof ds?.getStoryTimelineEventsForDock === 'function') {
        const dock = ds.getStoryTimelineEventsForDock();
        if (Array.isArray(dock) && dock.length > 0) return dock;
    }

    try {
        const raw = localStorage.getItem('timelineEvents');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch (_) {}

    return fetchBundledStoryTimelineEvents();
}

export function clearHeroBirthdayTimelineFetchCache() {
    bundledTimelineCache = null;
    bundledManifestHeroesCache = null;
}

/**
 * @param {unknown[]} heroEvents
 * @returns {Promise<unknown[]>}
 */
export async function syncHeroArchiveBirthdaysFromTimeline(heroEvents) {
    if (!Array.isArray(heroEvents) || heroEvents.length === 0) return heroEvents || [];

    const [timelineEvents, manifestHeroes] = await Promise.all([
        resolveStoryTimelineEventsForBirthdaySync(),
        fetchManifestHeroNames(),
    ]);

    const chipBirthdays = buildHeroChipBirthdaysFromTimelineEvents(
        timelineEvents,
        manifestHeroes.length > 0
            ? manifestHeroes
            : heroEvents.map((row) => String(row?.name ?? '').trim()).filter(Boolean),
    );

    return applyTimelineBirthdaysToHeroArchive(heroEvents, chipBirthdays);
}
