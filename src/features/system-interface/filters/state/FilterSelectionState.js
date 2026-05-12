/**
 * Pending filter selection: the user can tick and untick chips in the panel
 * before pressing **Confirm**, so we keep two sets — the live `selectedFilters`
 * mutated as chips are clicked, and the "confirmed" set on `window.standaloneActiveFilters`
 * which is what the rest of the app (markers, pagination, Codex) reads.
 *
 * `resetToConfirmed()` discards in-progress selections (called when the user
 * closes the panel without confirming or hits the close button).
 *
 * Counting per category is non-trivial: a chip key like `"25Shambali Order"`
 * might be a faction filename, a hero id, or an arbitrary token left over from
 * pre-migration data, so we use the live manifest (`window.FilterService`) +
 * `window.FactionMatchHelpers` to bucket correctly before falling back to
 * pattern heuristics.
 *
 * Class name stays `FilterStateManager` because earlier consumers used to
 * read `window.FilterStateManager`; the file is now `FilterSelectionState.js`.
 */

class FilterStateManager {
    constructor() {
        this.selectedFilters = new Set();
    }

    /** Read the confirmed selection from `window.standaloneActiveFilters`. */
    getConfirmedFilters() {
        if (typeof window !== 'undefined' && window.standaloneActiveFilters) {
            return new Set(window.standaloneActiveFilters);
        }
        return new Set();
    }

    /** Discard in-progress changes and snap back to the confirmed selection. */
    resetToConfirmed() {
        const confirmedFilters = this.getConfirmedFilters();
        this.selectedFilters.clear();
        confirmedFilters.forEach(filter => this.selectedFilters.add(filter));
    }

    clear() { this.selectedFilters.clear(); }
    add(filter) { this.selectedFilters.add(filter); }
    remove(filter) { this.selectedFilters.delete(filter); }
    has(filter) { return this.selectedFilters.has(filter); }
    toArray() { return Array.from(this.selectedFilters); }

    /**
     * Count filters per tab. Globe chips use manifest faction filenames
     * (e.g. `25Shambali Order`); the faction tab may still hold display names
     * after data migration, so we accept both via `FactionMatchHelpers`.
     */
    getCounts() {
        let heroCount = 0;
        let factionCount = 0;
        let npcCount = 0;
        let countryCount = 0;

        const fs = typeof window !== 'undefined' ? window.FilterService : null;
        const heroes = Array.isArray(fs?.heroes) ? fs.heroes : [];
        const manifestNpcs = Array.isArray(fs?.npcs) ? fs.npcs : [];
        const manifestFactions = Array.isArray(fs?.factions) ? fs.factions : [];
        const heroSet = new Set(heroes.map(h => String(h)));
        const npcSet = new Set(manifestNpcs.map(n => String(n)));
        const factionFilenameSet = new Set(manifestFactions.map(f => f?.filename).filter(Boolean));

        const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
        const factionNormSet = new Set();
        if (fh && typeof fh.normalizeFactionMatchKey === 'function') {
            manifestFactions.forEach(f => {
                const nk = fh.normalizeFactionMatchKey(f?.filename);
                if (nk) factionNormSet.add(nk);
                const dk = fh.normalizeFactionMatchKey(f?.displayName);
                if (dk) factionNormSet.add(dk);
            });
        }

        this.selectedFilters.forEach(filter => {
            const f = String(filter ?? '');
            if (f.startsWith('country:')) { countryCount++; return; }
            if (heroSet.has(f)) { heroCount++; return; }
            if (npcSet.has(f)) { npcCount++; return; }
            if (factionFilenameSet.has(f)) { factionCount++; return; }
            if (fh && typeof fh.normalizeFactionMatchKey === 'function') {
                const nk = fh.normalizeFactionMatchKey(f);
                if (nk && factionNormSet.has(nk)) { factionCount++; return; }
            }
            /* Pre-migration fallback: pure-digit prefix == faction, everything else == hero. */
            if (/^\d+/.test(f)) factionCount++;
            else heroCount++;
        });

        return { heroCount, factionCount, npcCount, countryCount };
    }

    /** Promote in-progress selection to confirmed state. */
    applyToScene() {
        if (typeof window !== 'undefined' && window.standaloneActiveFilters) {
            window.standaloneActiveFilters = new Set(this.selectedFilters);
        }
    }
}

export { FilterStateManager };
export default FilterStateManager;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterStateManager;
}
if (typeof window !== 'undefined') {
    window.FilterStateManager = FilterStateManager;
}
