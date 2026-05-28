/**
 * Hero biography voicelines per hero from platform manifest (`heroPhrases`).
 */

/** @type {Record<string, string[]> | null} */
let cachedHeroPhrasesMap = null;

async function fetchPlatformManifest() {
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
    return response.json();
}

/**
 * @returns {Promise<Record<string, string[]>>}
 */
export async function loadHeroPhrasesMap() {
    if (cachedHeroPhrasesMap) return cachedHeroPhrasesMap;
    const manifest = await fetchPlatformManifest();
    const raw = manifest?.heroPhrases;
    cachedHeroPhrasesMap = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return cachedHeroPhrasesMap;
}

export function clearHeroPhrasesCache() {
    cachedHeroPhrasesMap = null;
}

/**
 * @param {Record<string, string[]>} map
 * @param {string} heroFilterKey
 * @returns {string[]}
 */
export function getPhrasesForHero(map, heroFilterKey) {
    const key = String(heroFilterKey || '').trim();
    const list = key && map[key];
    if (!Array.isArray(list)) return [];
    return list.filter((f) => String(f || '').trim());
}
