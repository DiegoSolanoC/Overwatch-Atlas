/**
 * FilterStateManager - Manages filter selection state and confirmed filters
 * Extracted from FilterService to follow Single Responsibility Principle
 */

class FilterStateManager {
    constructor() {
        this.selectedFilters = new Set();
    }
    
    /**
     * Get confirmed filters from standalone state
     * NOTE: Removed sceneModel.activeFilters dependency
     */
    getConfirmedFilters() {
        // Use standaloneActiveFilters instead of sceneModel.activeFilters
        if (typeof window !== 'undefined' && window.standaloneActiveFilters) {
            return new Set(window.standaloneActiveFilters);
        }
        return new Set();
    }
    
    /**
     * Reset selectedFilters to match confirmed filters
     */
    resetToConfirmed() {
        const confirmedFilters = this.getConfirmedFilters();
        this.selectedFilters.clear();
        confirmedFilters.forEach(filter => this.selectedFilters.add(filter));
    }
    
    /**
     * Clear all selected filters
     */
    clear() {
        this.selectedFilters.clear();
    }
    
    /**
     * Add a filter
     */
    add(filter) {
        this.selectedFilters.add(filter);
    }
    
    /**
     * Remove a filter
     */
    remove(filter) {
        this.selectedFilters.delete(filter);
    }
    
    /**
     * Check if filter is selected
     */
    has(filter) {
        return this.selectedFilters.has(filter);
    }
    
    /**
     * Get all selected filters as array
     */
    toArray() {
        return Array.from(this.selectedFilters);
    }
    
    /**
     * Count filters by type (heroes, factions, NPCs).
     * Globe chips use manifest faction filenames (e.g. 25Shambali Order); faction tab may use display names after data migration.
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
        const heroSet = new Set(heroes.map((h) => String(h)));
        const npcSet = new Set(manifestNpcs.map((n) => String(n)));
        const factionFilenameSet = new Set(manifestFactions.map((f) => f?.filename).filter(Boolean));
        const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
        const factionNormSet = new Set();
        if (fh && typeof fh.normalizeFactionMatchKey === 'function') {
            manifestFactions.forEach((f) => {
                const nk = fh.normalizeFactionMatchKey(f?.filename);
                if (nk) factionNormSet.add(nk);
                const dk = fh.normalizeFactionMatchKey(f?.displayName);
                if (dk) factionNormSet.add(dk);
            });
        }

        this.selectedFilters.forEach((filter) => {
            const f = String(filter ?? '');
            if (f.startsWith('country:')) {
                countryCount++;
                return;
            }
            if (heroSet.has(f)) {
                heroCount++;
                return;
            }
            if (npcSet.has(f)) {
                npcCount++;
                return;
            }
            if (factionFilenameSet.has(f)) {
                factionCount++;
                return;
            }
            if (fh && typeof fh.normalizeFactionMatchKey === 'function') {
                const nk = fh.normalizeFactionMatchKey(f);
                if (nk && factionNormSet.has(nk)) {
                    factionCount++;
                    return;
                }
            }
            if (/^\d+/.test(f)) {
                factionCount++;
            } else {
                heroCount++;
            }
        });

        return { heroCount, factionCount, npcCount, countryCount };
    }
    
    /**
     * Apply selected filters to standalone state
     * NOTE: Removed sceneModel dependency, now uses standaloneActiveFilters
     */
    applyToScene() {
        // Apply to standalone state instead of sceneModel
        if (typeof window !== 'undefined' && window.standaloneActiveFilters) {
            window.standaloneActiveFilters = new Set(this.selectedFilters);
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterStateManager;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.FilterStateManager = FilterStateManager;
}
