/**
 * Theater asset catalogs (Scene images, Renders per hero, Voicelines audio).
 */

import { fetchJsonWithTimeout } from '../../system-interface/interface-left-panel/event-system/data/fetchWithTimeout.js';
import { resolveManifestHeroId } from '../../system-interface/interface-filter-menu/buttons/filterKeyMapping.js';

/** @typedef {{ scenes: string[], voicelines: string[], renders: Record<string, string[]> }} DialogueTheaterAssets */

/** @type {DialogueTheaterAssets|null} */
let cachedAssets = null;

/** @type {Promise<DialogueTheaterAssets>|null} */
let loadPromise = null;

/** @type {string[]} */
let cachedManifestHeroes = [];

const EMPTY_ASSETS = Object.freeze({
    scenes: [],
    voicelines: [],
    renders: {},
});

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeHeroKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {Record<string, string[]>} a
 * @param {Record<string, string[]>} b
 * @returns {Record<string, string[]>}
 */
function mergeRenderMaps(a, b) {
    /** @type {Record<string, string[]>} */
    const out = { ...a };
    for (const [hero, files] of Object.entries(b || {})) {
        if (!Array.isArray(files) || files.length === 0) continue;
        if (!out[hero] || files.length > out[hero].length) {
            out[hero] = files;
        }
    }
    return out;
}

/**
 * @param {string[]} a
 * @param {string[]} b
 * @returns {string[]}
 */
function mergeVoicelineLists(a, b) {
    const out = new Set();
    for (const file of a || []) {
        const trimmed = String(file).trim();
        if (trimmed) out.add(trimmed);
    }
    for (const file of b || []) {
        const trimmed = String(file).trim();
        if (trimmed) out.add(trimmed);
    }
    return [...out].sort((x, y) => x.localeCompare(y));
}

/**
 * @returns {Promise<DialogueTheaterAssets>}
 */
export async function loadDialogueTheaterAssets({ force = false } = {}) {
    if (force) {
        cachedAssets = null;
        loadPromise = null;
    }
    if (cachedAssets && !force) return cachedAssets;
    if (loadPromise && !force) return loadPromise;

    loadPromise = (async () => {
        /** @type {DialogueTheaterAssets} */
        let manifestAssets = { scenes: [], voicelines: [], renders: {} };
        try {
            const manifest = await fetchJsonWithTimeout(
                'src/data/dialogue-theater/theater-assets-manifest.json',
            );
            manifestAssets = normalizeAssets(manifest);
        } catch (err) {
            console.warn('Dialogue Theater: asset manifest load failed:', err);
        }

        /** @type {DialogueTheaterAssets} */
        let apiAssets = { scenes: [], voicelines: [], renders: {} };
        const apiUrl =
            typeof window.resolveDevApiUrl === 'function'
                ? window.resolveDevApiUrl('api/dialogue-theater/assets')
                : '/api/dialogue-theater/assets';
        try {
            const fromApi = await fetchJsonWithTimeout(apiUrl, 8000);
            if (fromApi && typeof fromApi === 'object') {
                apiAssets = normalizeAssets(fromApi);
            }
        } catch (_) {
            /* dev API unavailable — bundled manifest is enough */
        }

        cachedAssets = {
            scenes: apiAssets.scenes.length > 0 ? apiAssets.scenes : manifestAssets.scenes,
            voicelines: mergeVoicelineLists(manifestAssets.voicelines, apiAssets.voicelines),
            renders: mergeRenderMaps(manifestAssets.renders, apiAssets.renders),
        };
        return cachedAssets;
    })();

    try {
        return await loadPromise;
    } finally {
        loadPromise = null;
    }
}

/**
 * @param {unknown} raw
 * @returns {DialogueTheaterAssets}
 */
function normalizeAssets(raw) {
    const scenes = Array.isArray(raw?.scenes)
        ? raw.scenes.map((s) => String(s).trim()).filter(Boolean)
        : [];
    const voicelines = Array.isArray(raw?.voicelines)
        ? raw.voicelines.map((s) => String(s).trim()).filter(Boolean)
        : [];
    /** @type {Record<string, string[]>} */
    const renders = {};
    if (raw?.renders && typeof raw.renders === 'object') {
        for (const [hero, files] of Object.entries(raw.renders)) {
            if (!Array.isArray(files)) continue;
            renders[String(hero)] = files.map((f) => String(f).trim()).filter(Boolean);
        }
    }
    return { scenes, voicelines, renders };
}

/**
 * @returns {string[]}
 */
export function getCachedManifestHeroes() {
    return cachedManifestHeroes;
}

export async function loadDialogueTheaterHeroes() {
    try {
        const manifest = await fetchJsonWithTimeout('src/data/platform/manifest.json');
        if (Array.isArray(manifest?.heroes)) {
            cachedManifestHeroes = manifest.heroes.map((h) => String(h).trim()).filter(Boolean);
            return cachedManifestHeroes;
        }
    } catch (err) {
        console.warn('Dialogue Theater: hero manifest load failed:', err);
    }
    cachedManifestHeroes = [];
    return [];
}

export function sceneImageUrl(filename) {
    return `src/assets/images/Theater/Scene/${encodeURIComponent(filename)}`;
}

/**
 * @param {string} heroFolder
 * @param {string} filename
 */
export function renderImageUrl(heroFolder, filename) {
    return `src/assets/images/Theater/Renders/${encodeURIComponent(heroFolder)}/${encodeURIComponent(filename)}`;
}

/**
 * @param {string} filename
 */
export function voicelineAudioUrl(filename) {
    const parts = String(filename || '')
        .split(/[/\\]/)
        .filter(Boolean)
        .map((part) => encodeURIComponent(part));
    return `src/assets/audio/Theater/Voicelines/${parts.join('/')}`;
}

export function heroFilterIconUrl(heroName) {
    const filterKey = resolveManifestHeroId(heroName, cachedManifestHeroes) || String(heroName || '').trim();
    return `src/assets/images/Filters/Heroes/${encodeURIComponent(filterKey)}.png`;
}

/**
 * Match a hero filter name to a Renders folder key.
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 */
export function resolveRenderHeroFolder(heroName, rendersMap) {
    const trimmed = String(heroName || '').trim();
    if (!trimmed || !rendersMap || typeof rendersMap !== 'object') return '';

    if (Array.isArray(rendersMap[trimmed]) && rendersMap[trimmed].length > 0) {
        return trimmed;
    }

    const target = normalizeHeroKey(trimmed);
    if (!target) return '';

    for (const key of Object.keys(rendersMap)) {
        if (!Array.isArray(rendersMap[key]) || rendersMap[key].length === 0) continue;
        if (key.toLowerCase() === trimmed.toLowerCase()) return key;
        if (normalizeHeroKey(key) === target) return key;
    }

    return '';
}

/**
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @returns {string[]}
 */
export function listRenderFilesForHero(heroName, rendersMap) {
    const folder = resolveRenderHeroFolder(heroName, rendersMap);
    if (!folder) return [];
    return Array.isArray(rendersMap[folder]) ? rendersMap[folder] : [];
}

/**
 * Heroic.png when present; otherwise empty string.
 *
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
export function pickHeroicRenderForHero(heroName, rendersMap) {
    const files = listRenderFilesForHero(heroName, rendersMap);
    return files.find((file) => file.toLowerCase() === 'heroic.png') || '';
}

/**
 * @param {string} currentRender
 * @param {string} heroicRender
 * @returns {boolean}
 */
export function shouldUpgradeDialogueLineRender(currentRender, heroicRender) {
    if (!heroicRender) return false;
    const current = String(currentRender || '').trim();
    if (!current) return true;
    return current.toLowerCase() === 'classic.png';
}

/**
 * @param {import('./DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {Record<string, string[]>} rendersMap
 * @returns {number} lines updated
 */
export function applyHeroicRendersToConversations(conversations, rendersMap) {
    if (!Array.isArray(conversations) || !rendersMap) return 0;
    let updated = 0;
    for (const conversation of conversations) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        for (const line of lines) {
            const heroic = pickHeroicRenderForHero(line?.hero, rendersMap);
            if (!shouldUpgradeDialogueLineRender(line?.render, heroic)) continue;
            line.render = heroic;
            updated += 1;
        }
    }
    return updated;
}

export function clearDialogueTheaterAssetsCache() {
    cachedAssets = null;
    loadPromise = null;
}
