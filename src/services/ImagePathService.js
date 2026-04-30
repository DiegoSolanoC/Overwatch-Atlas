/**
 * ImagePathService - Handles event image path resolution
 * Separates image path logic from event management
 */

class ImagePathService {
    constructor() {
        this.eventManager = null; // Reference to EventManager (for state access)
    }

    /**
     * Set the EventManager instance (dependency injection)
     */
    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    /**
     * URL base for auto-resolved images (story timeline vs satellite Story Archive JSON).
     * Uses %20 for the "Archive data" segment so browser requests match static paths.
     */
    _getArchiveImageBaseWeb(archiveOverride) {
        const ds = this.eventManager?.dataService;
        const src =
            archiveOverride != null && String(archiveOverride).trim() !== ''
                ? String(archiveOverride).trim()
                : (typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story');
        if (src === 'heroes') return 'assets/images/Archive%20data/Heroes/';
        if (src === 'factions') return 'assets/images/Archive%20data/Factions/';
        if (src === 'npcs') return 'assets/images/Archive%20data/NPCS/';
        if (src === 'locations') return 'assets/images/Archive%20data/Locations/';
        return 'assets/images/Archive%20data/events/';
    }

    /**
     * Get event image path (auto-detect from Event Images folder or use provided path)
     * @param {string} [imageArchiveOverride] Force folder bucket (`story` | `heroes` | …) for dock thumbs while another archive is active.
     */
    getEventImagePath(eventName, providedPath, imageArchiveOverride) {
        const storyEventsWebBase = 'assets/images/Archive%20data/events/';
        const activeImagesWebBase = this._getArchiveImageBaseWeb(imageArchiveOverride);
        const rewriteLegacyEventFolder = (str) =>
            str ? str.replace(/assets\/images\/events\//g, storyEventsWebBase) : str;

        // Helper function to encode image paths properly (avoid double-encoding)
        const encodeImagePath = (path) => {
            if (!path) return path;
            path = rewriteLegacyEventFolder(path);
            
            // Helper to decode multiple times until fully decoded
            const fullyDecode = (str) => {
                let previous = '';
                let current = str;
                while (current !== previous) {
                    previous = current;
                    try {
                        const decoded = decodeURIComponent(current);
                        if (decoded !== current) {
                            current = decoded;
                        } else {
                            break;
                        }
                    } catch (e) {
                        break; // Can't decode further
                    }
                }
                return current;
            };
            
            // If path already contains Event Images/, normalize to archive events folder and encode just the filename
            const folderPattern = /Event(?:%20| )Images\//;
            if (folderPattern.test(path)) {
                const parts = path.split(/Event(?:%20| )Images\//);
                if (parts.length === 2) {
                    let filename = fullyDecode(parts[1]);
                    return `${storyEventsWebBase}${encodeURIComponent(filename)}`;
                }
            }
            // If it's a full path, try to encode just the filename part
            const lastSlash = path.lastIndexOf('/');
            if (lastSlash !== -1) {
                let folder = path.substring(0, lastSlash + 1);
                folder = rewriteLegacyEventFolder(folder);
                let filename = fullyDecode(path.substring(lastSlash + 1));
                return folder + encodeURIComponent(filename);
            }
            // If no slash, decode first then encode
            const decoded = fullyDecode(path);
            return encodeURIComponent(decoded);
        };
        
        // If a path is provided, encode it properly
        if (providedPath && providedPath.trim()) {
            return encodeImagePath(providedPath.trim());
        }
        
        // Otherwise, try to find image in events images folder
        // Use the exact event name (preserve all characters including glitchy text)
        // Only normalize multiple spaces to single space
        let normalizedName = eventName.replace(/\s+/g, ' ').trim();
        
        // Handle case variations for common patterns (e.g., "CallSign" vs "Callsign")
        // Try to match common filename patterns by normalizing case
        // This handles cases where event name has different capitalization than filename
        const caseVariations = [
            normalizedName, // Original
            normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1).toLowerCase(), // Title Case
            // Try common variations: if name contains "CallSign", try "Callsign"
            normalizedName.replace(/CallSign/g, 'Callsign'),
            normalizedName.replace(/Callsign/g, 'CallSign'),
        ];
        
        // Remove duplicates
        const uniqueVariations = [...new Set(caseVariations)];
        
        // Try each variation (browser will handle 404 if none exist)
        // For now, return the most likely match (original, then common variations)
        // The browser's image onerror handler will catch 404s
        normalizedName = uniqueVariations[0]; // Use first variation (original)
        
        // Encode the filename to handle spaces and special characters in URLs
        // Split the path so we only encode the filename, not the folder name
        const encodedFileName = encodeURIComponent(normalizedName);
        const imagePath = `${activeImagesWebBase}${encodedFileName}.png`;
        
        // Return the path (browser will handle 404 if image doesn't exist)
        // No console log to reduce noise - 404s are expected for missing images
        return imagePath;
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImagePathService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.ImagePathService = new ImagePathService();
}
