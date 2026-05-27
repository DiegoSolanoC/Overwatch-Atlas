/**
 * EventImagePathResolver — resolves web paths for timeline / archive event images.
 * Legacy global: `window.ImagePathService` (`composeEventServices` / `EventManager.getEventImagePath`).
 */

class EventImagePathResolver {
    constructor() {
        this.eventManager = null;
    }

    setEventManager(eventManager) {
        this.eventManager = eventManager;
    }

    _getArchiveImageBaseWeb(archiveOverride) {
        const ds = this.eventManager?.dataService;
        const src =
            archiveOverride != null && String(archiveOverride).trim() !== ''
                ? String(archiveOverride).trim()
                : (typeof ds?.getArchiveSource === 'function' ? ds.getArchiveSource() : 'story');
        if (src === 'heroes') return 'src/assets/images/Archive/Heroes/';
        if (src === 'factions') return 'src/assets/images/Archive/Factions/';
        if (src === 'npcs') return 'src/assets/images/Archive/NPCs/';
        if (src === 'locations') return 'src/assets/images/Archive/Locations/';
        return 'src/assets/images/Archive/Events/';
    }

    getEventImagePath(eventName, providedPath, imageArchiveOverride) {
        const storyEventsWebBase = 'src/assets/images/Archive/Events/';
        const activeImagesWebBase = this._getArchiveImageBaseWeb(imageArchiveOverride);
        const rewriteLegacyEventFolder = (str) =>
            str ? str.replace(/assets\/images\/events\//g, storyEventsWebBase) : str;

        const encodeImagePath = (path) => {
            if (!path) return path;
            path = rewriteLegacyEventFolder(path);

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
                    } catch {
                        break;
                    }
                }
                return current;
            };

            const folderPattern = /Event(?:%20| )Images\//;
            if (folderPattern.test(path)) {
                const parts = path.split(/Event(?:%20| )Images\//);
                if (parts.length === 2) {
                    const filename = fullyDecode(parts[1]);
                    return `${storyEventsWebBase}${encodeURIComponent(filename)}`;
                }
            }
            const lastSlash = path.lastIndexOf('/');
            if (lastSlash !== -1) {
                let folder = path.substring(0, lastSlash + 1);
                folder = rewriteLegacyEventFolder(folder);
                const filename = fullyDecode(path.substring(lastSlash + 1));
                return folder + encodeURIComponent(filename);
            }
            const decoded = fullyDecode(path);
            return encodeURIComponent(decoded);
        };

        if (providedPath && providedPath.trim()) {
            return encodeImagePath(providedPath.trim());
        }

        let normalizedName = eventName.replace(/\s+/g, ' ').trim();
        const caseVariations = [
            normalizedName,
            normalizedName.charAt(0).toUpperCase() + normalizedName.slice(1).toLowerCase(),
            normalizedName.replace(/CallSign/g, 'Callsign'),
            normalizedName.replace(/Callsign/g, 'CallSign')
        ];
        const uniqueVariations = [...new Set(caseVariations)];
        normalizedName = uniqueVariations[0];

        const encodedFileName = encodeURIComponent(normalizedName);
        return `${activeImagesWebBase}${encodedFileName}.png`;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventImagePathResolver;
}

if (typeof window !== 'undefined') {
    window.ImagePathService = new EventImagePathResolver();
}
