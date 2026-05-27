/**
 * Load hero ids from platform manifest (same source as the Filters panel heroes tab).
 */

import { getHeroDisplayName } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';

/**
 * @returns {Promise<string[]>}
 */
export async function loadHeroFilterManifest() {
    const cacheBuster = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const response = await fetch(`src/data/platform/manifest.json?v=${cacheBuster}`, {
        cache: 'no-store',
        headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
        },
    });
    if (!response.ok) {
        throw new Error(`manifest.json HTTP ${response.status}`);
    }
    const manifest = await response.json();
    const heroes = Array.isArray(manifest.heroes) ? [...manifest.heroes] : [];
    heroes.sort((a, b) =>
        getHeroDisplayName(a).localeCompare(getHeroDisplayName(b), undefined, {
            numeric: true,
            sensitivity: 'base',
        }),
    );
    return heroes;
}
