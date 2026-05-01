/**
 * FilterManifestHelpers - Utilities for loading and processing filter manifest
 * Extracted from FilterService to reduce file size
 */

/**
 * Load manifest and process heroes/factions
 */
export async function loadManifest(createFilterButtons, updateFilterCounts, preloadImages, factions) {
    try {
        // Add cache busting to ensure we get the latest manifest
        const cacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const response = await fetch(`manifest.json?v=${cacheBuster}`, {
            cache: 'no-store',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache'
            }
        });
        const manifest = await response.json();
        
        const heroes = manifest.heroes ? manifest.heroes.sort() : [];
        const npcs = manifest.npcs ? [...manifest.npcs].sort() : [];
        const processedFactions = manifest.factions
            ? [...manifest.factions]
                .map((f) => ({
                    filename: f.filename,
                    displayName: f.displayName
                }))
                .sort((a, b) =>
                    String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
                        sensitivity: 'base',
                        numeric: true
                    })
                )
            : [];
        
        // Initialize with loaded data
        createFilterButtons(heroes, 'heroes', 'assets/images/heroes');
        updateFilterCounts();
        
        // Preload faction images in background
        if (processedFactions.length > 0) {
            setTimeout(() => {
                preloadImages(processedFactions, 'factions', 'assets/images/factions');
            }, 500);
        }
        if (npcs.length > 0) {
            setTimeout(() => {
                preloadImages(npcs, 'npcs', 'assets/images/npcs');
            }, 650);
        }
        
        return { heroes, factions: processedFactions, npcs };
    } catch (error) {
        console.error('Error loading manifest.json:', error);
        console.log('Falling back to empty lists. Run generate-manifest.js to create manifest.json');
        // Fallback to empty arrays if manifest doesn't exist
        const heroes = [];
        const factions = [];
        createFilterButtons(heroes, 'heroes', 'assets/images/heroes');
        return { heroes, factions, npcs: [] };
    }
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.FilterManifestHelpers) {
        window.FilterManifestHelpers = {};
    }
    window.FilterManifestHelpers.loadManifest = loadManifest;
}
