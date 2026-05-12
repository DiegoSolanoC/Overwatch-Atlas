/**
 * Fetch `src/data/manifest.json`, reorder its `heroes` / `factions` / `npcs`
 * lists by the Codex story archive, and kick off image preloading.
 *
 * Cache-busting headers are aggressive (`Cache-Control: no-store` + query
 * param) because the dev server rewrites manifest.json on every asset add,
 * and stale chips with the wrong filename are very hard to debug.
 *
 * On failure (offline or 404) the panel still mounts — empty hero/faction
 * lists are passed through, and the user sees an empty filters tab rather
 * than a broken panel.
 */

import { applyStoryArchiveOrderFromNetwork } from './storyArchiveFilterOrder.js';

export async function loadFilterManifest(createFilterButtons, updateFilterCounts, preloadImages) {
    try {
        const cacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const response = await fetch(`src/data/manifest.json?v=${cacheBuster}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        const manifest = await response.json();

        let heroes = manifest.heroes ? [...manifest.heroes] : [];
        let npcs = manifest.npcs ? [...manifest.npcs] : [];
        let processedFactions = manifest.factions
            ? [...manifest.factions].map(f => ({ filename: f.filename, displayName: f.displayName }))
            : [];

        const ordered = await applyStoryArchiveOrderFromNetwork(heroes, processedFactions, npcs);
        heroes = ordered.heroes;
        processedFactions = ordered.factions;
        npcs = ordered.npcs;

        createFilterButtons(heroes, 'heroes', 'src/assets/images/Filters/Heroes');
        updateFilterCounts();

        /* Preload other-tab images on a stagger so a single tab switch is
           instant; the timing values mirror the original behavior. */
        if (processedFactions.length > 0) {
            setTimeout(() => preloadImages(processedFactions, 'factions', 'src/assets/images/Filters/Factions'), 500);
        }
        if (npcs.length > 0) {
            setTimeout(() => preloadImages(npcs, 'npcs', 'src/assets/images/Filters/NPCs'), 650);
        }

        return { heroes, factions: processedFactions, npcs };
    } catch (error) {
        console.error('Error loading manifest.json:', error);
        const heroes = [];
        const factions = [];
        createFilterButtons(heroes, 'heroes', 'src/assets/images/Filters/Heroes');
        return { heroes, factions, npcs: [] };
    }
}
