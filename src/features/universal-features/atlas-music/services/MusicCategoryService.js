/**
 * MusicCategoryService — user-defined music categories keyed by song filename.
 * Persists in localStorage so organization survives reloads (independent of
 * playback state, which may use sessionStorage in local dev).
 *
 * Additive seed merge from `atlas-music-category-seed.json` fills in catalog
 * defaults (new tracks / categories) without wiping user edits.
 */

import categorySeed from '../../../../data/platform/atlas-music-category-seed.json' with { type: 'json' };

const STORAGE_KEY = 'atlasMusicCategories';
const STORAGE_VERSION = 1;

function newId() {
    return `mc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyState() {
    return {
        version: STORAGE_VERSION,
        categories: [],
        /** @type {Record<string, string[]>} filename → category ids */
        assignments: {},
        activeCategoryId: null,
        seedVersionApplied: 0,
    };
}

function normalizeState(raw) {
    const base = emptyState();
    if (!raw || typeof raw !== 'object') return base;
    const categories = Array.isArray(raw.categories)
        ? raw.categories
            .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
            .map((c) => ({ id: c.id, name: String(c.name).trim() }))
            .filter((c) => c.name)
        : [];
    const assignments = {};
    if (raw.assignments && typeof raw.assignments === 'object') {
        for (const [filename, ids] of Object.entries(raw.assignments)) {
            if (!filename || !Array.isArray(ids)) continue;
            const cleaned = [...new Set(ids.filter((id) => typeof id === 'string' && categories.some((c) => c.id === id)))];
            if (cleaned.length) assignments[filename] = cleaned;
        }
    }
    const activeCategoryId = categories.some((c) => c.id === raw.activeCategoryId)
        ? raw.activeCategoryId
        : null;
    return {
        version: STORAGE_VERSION,
        categories,
        assignments,
        activeCategoryId,
        seedVersionApplied: Number(raw.seedVersionApplied) || 0,
    };
}

/**
 * Merge packaged seed categories + assignments into local state (additive).
 * @param {ReturnType<typeof emptyState>} state
 * @param {any} seed
 */
function mergeCategorySeed(state, seed) {
    if (!seed || typeof seed !== 'object') return { state, changed: false };
    let changed = false;

    const renames = seed.migrations?.renameFilenames;
    if (renames && typeof renames === 'object') {
        for (const [from, to] of Object.entries(renames)) {
            if (!from || !to || from === to) continue;
            if (!state.assignments[from]) continue;
            const merged = [...new Set([
                ...(state.assignments[to] || []),
                ...state.assignments[from],
            ])];
            state.assignments[to] = merged;
            delete state.assignments[from];
            changed = true;
        }
    }

    for (const cat of Array.isArray(seed.categories) ? seed.categories : []) {
        if (!cat?.id || !cat?.name) continue;
        const nameKey = String(cat.name).trim().toLowerCase();
        if (!nameKey) continue;
        if (state.categories.some((c) => c.name.toLowerCase() === nameKey)) continue;
        state.categories.push({ id: String(cat.id), name: String(cat.name).trim() });
        changed = true;
    }

    const byName = Object.fromEntries(
        state.categories.map((c) => [c.name.toLowerCase(), c.id]),
    );
    const seedIdToName = Object.fromEntries(
        (Array.isArray(seed.categories) ? seed.categories : [])
            .filter((c) => c?.id && c?.name)
            .map((c) => [c.id, String(c.name).trim()]),
    );

    for (const [filename, seedIds] of Object.entries(seed.assignments || {})) {
        if (!filename || !Array.isArray(seedIds)) continue;
        const resolved = seedIds
            .map((id) => {
                const name = seedIdToName[id];
                return name ? byName[name.toLowerCase()] : null;
            })
            .filter(Boolean);
        if (!resolved.length) continue;
        const prev = state.assignments[filename] || [];
        const next = [...new Set([...prev, ...resolved])];
        if (next.length !== prev.length || next.some((id, i) => id !== prev[i])) {
            state.assignments[filename] = next;
            changed = true;
        }
    }

    const seedVersion = Number(seed.version) || 1;
    if (state.seedVersionApplied !== seedVersion) {
        state.seedVersionApplied = seedVersion;
        changed = true;
    }

    return { state, changed };
}

export class MusicCategoryService {
    constructor() {
        this.storageKey = STORAGE_KEY;
        /** @type {ReturnType<typeof emptyState>} */
        this._state = this._load();
        this._applySeed();
    }

    _load() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return emptyState();
            return normalizeState(JSON.parse(raw));
        } catch (e) {
            console.warn('MusicCategoryService: failed to load', e);
            return emptyState();
        }
    }

    _applySeed() {
        try {
            const { state, changed } = mergeCategorySeed(this._state, categorySeed);
            this._state = state;
            if (changed) this._save();
        } catch (e) {
            console.warn('MusicCategoryService: seed merge failed', e);
        }
    }

    _save() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this._state));
        } catch (e) {
            console.error('MusicCategoryService: failed to save', e);
        }
    }

    getCategories() {
        return this._state.categories.slice();
    }

    getActiveCategoryId() {
        return this._state.activeCategoryId;
    }

    setActiveCategoryId(categoryId) {
        if (categoryId != null && !this._state.categories.some((c) => c.id === categoryId)) {
            categoryId = null;
        }
        this._state.activeCategoryId = categoryId;
        this._save();
        return this._state.activeCategoryId;
    }

    getCategoryById(categoryId) {
        return this._state.categories.find((c) => c.id === categoryId) || null;
    }

    /**
     * @param {string} name
     * @returns {{ id: string, name: string }|null}
     */
    createCategory(name) {
        const trimmed = String(name || '').trim();
        if (!trimmed) return null;
        const exists = this._state.categories.some(
            (c) => c.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (exists) return null;
        const cat = { id: newId(), name: trimmed };
        this._state.categories.push(cat);
        this._state.activeCategoryId = cat.id;
        this._save();
        return cat;
    }

    /**
     * @param {string} categoryId
     * @returns {boolean}
     */
    deleteCategory(categoryId) {
        const before = this._state.categories.length;
        this._state.categories = this._state.categories.filter((c) => c.id !== categoryId);
        if (this._state.categories.length === before) return false;
        for (const filename of Object.keys(this._state.assignments)) {
            const next = this._state.assignments[filename].filter((id) => id !== categoryId);
            if (next.length) this._state.assignments[filename] = next;
            else delete this._state.assignments[filename];
        }
        if (this._state.activeCategoryId === categoryId) {
            this._state.activeCategoryId = null;
        }
        this._save();
        return true;
    }

    /**
     * Move a category by delta (−1 left / +1 right) within the ordered list.
     * @param {string} categoryId
     * @param {number} delta
     * @returns {boolean}
     */
    moveCategory(categoryId, delta) {
        const cats = this._state.categories;
        const from = cats.findIndex((c) => c.id === categoryId);
        if (from < 0 || !Number.isFinite(delta) || delta === 0) return false;
        const to = from + Math.trunc(delta);
        if (to < 0 || to >= cats.length) return false;
        const [item] = cats.splice(from, 1);
        cats.splice(to, 0, item);
        this._save();
        return true;
    }

    /**
     * Replace category order with the given id list (unknown ids ignored; missing kept at end).
     * @param {string[]} orderedIds
     * @returns {boolean}
     */
    reorderCategories(orderedIds) {
        if (!Array.isArray(orderedIds) || !orderedIds.length) return false;
        const byId = Object.fromEntries(this._state.categories.map((c) => [c.id, c]));
        const next = [];
        const seen = new Set();
        for (const id of orderedIds) {
            if (!byId[id] || seen.has(id)) continue;
            next.push(byId[id]);
            seen.add(id);
        }
        for (const cat of this._state.categories) {
            if (!seen.has(cat.id)) next.push(cat);
        }
        if (next.length !== this._state.categories.length) return false;
        const same = next.every((c, i) => c.id === this._state.categories[i].id);
        if (same) return false;
        this._state.categories = next;
        this._save();
        return true;
    }

    /**
     * @param {string} filename
     * @returns {string[]}
     */
    getCategoryIdsForSong(filename) {
        if (!filename) return [];
        return (this._state.assignments[filename] || []).slice();
    }

    /**
     * @param {string} filename
     * @returns {{ id: string, name: string }[]}
     */
    getCategoriesForSong(filename) {
        const ids = this.getCategoryIdsForSong(filename);
        return ids
            .map((id) => this.getCategoryById(id))
            .filter(Boolean);
    }

    /**
     * @param {string} filename
     * @param {string} categoryId
     * @returns {boolean}
     */
    addSongToCategory(filename, categoryId) {
        if (!filename || !this.getCategoryById(categoryId)) return false;
        const list = this._state.assignments[filename] || [];
        if (list.includes(categoryId)) return false;
        this._state.assignments[filename] = [...list, categoryId];
        this._save();
        return true;
    }

    /**
     * @param {string} filename
     * @param {string} categoryId
     * @returns {boolean}
     */
    removeSongFromCategory(filename, categoryId) {
        const list = this._state.assignments[filename];
        if (!list || !list.includes(categoryId)) return false;
        const next = list.filter((id) => id !== categoryId);
        if (next.length) this._state.assignments[filename] = next;
        else delete this._state.assignments[filename];
        this._save();
        return true;
    }

    /**
     * @param {string} categoryId
     * @param {Array<{ filename: string }>} musicFiles
     * @returns {Array<{ filename: string }>}
     */
    filterSongsByCategory(categoryId, musicFiles) {
        if (!categoryId) return musicFiles.slice();
        return musicFiles.filter((song) =>
            (this._state.assignments[song.filename] || []).includes(categoryId),
        );
    }

    /**
     * Rank songs by name / filename match for predictive lookup.
     * @param {string} query
     * @param {Array<{ filename: string, name: string }>} musicFiles
     * @param {{ limit?: number, excludeInCategoryId?: string|null }} [opts]
     * @returns {Array<{ filename: string, name: string, score: number }>}
     */
    predictSongs(query, musicFiles, opts = {}) {
        const q = String(query || '').trim().toLowerCase();
        const limit = opts.limit ?? 8;
        const excludeInCategoryId = opts.excludeInCategoryId ?? null;
        if (!q) return [];

        const scored = [];
        for (const song of musicFiles) {
            if (excludeInCategoryId
                && (this._state.assignments[song.filename] || []).includes(excludeInCategoryId)) {
                continue;
            }
            const name = String(song.name || '').toLowerCase();
            const file = String(song.filename || '').toLowerCase();
            let score = 0;
            if (name === q) score = 100;
            else if (name.startsWith(q)) score = 85;
            else if (name.includes(q)) score = 65;
            else if (file.startsWith(q)) score = 50;
            else if (file.includes(q)) score = 35;
            else {
                const tokens = q.split(/\s+/).filter(Boolean);
                if (tokens.length > 1 && tokens.every((t) => name.includes(t))) score = 55;
            }
            if (score > 0) scored.push({ ...song, score });
        }
        scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
        return scored.slice(0, limit);
    }
}
