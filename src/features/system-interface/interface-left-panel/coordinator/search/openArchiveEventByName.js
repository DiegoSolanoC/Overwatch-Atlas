/**
 * Switch the current Data Archive to the right JSON if needed and show the matching row in the standalone event slide.
 *
 * From story / dock timeline, bio chips peek the target archive list without
 * calling `switchStoryArchiveSource` (avoids flipping Event Manager / workshop UI).
 * @param {object} mgr — EventManager
 */
import {
    findHeroArchiveEventIndex,
    findFactionArchiveEventIndex,
    findNpcArchiveEventIndex,
    findLocationArchiveEventIndex,
} from './findArchiveEventIndex.js';
import { loadArchiveEventsForPeek } from './loadArchiveEventsForPeek.js';

const KIND = {
    hero: { archiveKey: 'heroes', notFoundLabel: 'Heroes', findIndex: findHeroArchiveEventIndex },
    faction: { archiveKey: 'factions', notFoundLabel: 'Factions', findIndex: findFactionArchiveEventIndex },
    npc: { archiveKey: 'npcs', notFoundLabel: 'NPCs', findIndex: findNpcArchiveEventIndex },
    location: { archiveKey: 'locations', notFoundLabel: 'Locations', findIndex: findLocationArchiveEventIndex },
};

/**
 * @param {object[]} events
 * @param {object} mgr
 * @param {(mgr: object, raw: string) => number} findIndex
 * @param {string} raw
 * @returns {number}
 */
function findIndexInEvents(events, mgr, findIndex, raw) {
    const proxy = { events };
    return findIndex(proxy, raw);
}

/**
 * Stay on story when the live archive is story, or the slide is showing a dock timeline entry.
 * @param {object|null} slide
 * @param {string} src
 */
function shouldPeekWithoutArchiveSwitch(slide, src) {
    if (src === 'story') return true;
    if (slide?._presentationFromDockTimeline) return true;
    return false;
}

async function openArchiveEntry(mgr, kind, rawName) {
    const cfg = KIND[kind];
    if (!cfg) return;
    const raw = String(rawName || '').trim();
    if (!raw) return;
    const slide = typeof window !== 'undefined' ? window.standaloneEventSlide : null;
    if (!slide || typeof slide.showEvent !== 'function') {
        if (typeof window.updateStatus === 'function') {
            window.updateStatus('Event slide is not available.', 'warning');
        }
        return;
    }
    try {
        if (slide.pushSlideHistoryIfOpen) {
            slide.pushSlideHistoryIfOpen();
        }
        const src =
            typeof mgr.dataService?.getArchiveSource === 'function'
                ? mgr.dataService.getArchiveSource()
                : 'story';

        if (shouldPeekWithoutArchiveSwitch(slide, src) && src !== cfg.archiveKey) {
            const list = await loadArchiveEventsForPeek(cfg.archiveKey);
            const idx = findIndexInEvents(list, mgr, cfg.findIndex, raw);
            if (idx < 0) {
                if (typeof window.updateStatus === 'function') {
                    window.updateStatus(
                        `No ${cfg.notFoundLabel} archive entry matches “${raw}”`,
                        'warning',
                    );
                }
                return;
            }
            slide.showEvent(idx, {
                eventList: list,
                keepSlideHistory: true,
                presentationArchiveSource: cfg.archiveKey,
            });
            if (window.SoundEffectsManager?.play) {
                window.SoundEffectsManager.play('eventClick');
            }
            return;
        }

        if (src !== cfg.archiveKey) {
            await mgr.switchStoryArchiveSource(cfg.archiveKey);
        }
        const idx = cfg.findIndex(mgr, raw);
        if (idx < 0) {
            if (typeof window.updateStatus === 'function') {
                window.updateStatus(`No ${cfg.notFoundLabel} archive entry matches “${raw}”`, 'warning');
            }
            return;
        }
        const list = mgr.events || [];
        slide.showEvent(idx, {
            eventList: list,
            keepSlideHistory: true,
            presentationArchiveSource: cfg.archiveKey,
        });
        if (window.SoundEffectsManager?.play) {
            window.SoundEffectsManager.play('eventClick');
        }
    } catch (err) {
        console.warn('openArchiveEntry failed', { kind, err });
    }
}

export async function openHeroArchiveEventByName(mgr, heroName) {
    return openArchiveEntry(mgr, 'hero', heroName);
}

export async function openFactionArchiveEventByName(mgr, factionToken) {
    return openArchiveEntry(mgr, 'faction', factionToken);
}

export async function openNpcArchiveEventByName(mgr, npcName) {
    return openArchiveEntry(mgr, 'npc', npcName);
}

export async function openLocationArchiveEventByName(mgr, locationName) {
    return openArchiveEntry(mgr, 'location', locationName);
}
