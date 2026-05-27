/**
 * EventDataService — in-memory store for events + location datasets, and orchestrator for
 * loading / saving against `src/data/event-system/timeline-events.json` (story) or `src/data/story-archive/*.json`
 * (heroes / factions / npcs / locations satellites).
 *
 * Behaviour is split across sibling modules in this folder:
 *
 *   Routing & state:
 *   - `archiveRouting.js`              file paths / localStorage keys per archive source
 *   - `storyDockSnapshot.js`           pagination-dock snapshot when on a satellite archive
 *
 *   Load:
 *   - `loadLocationsData.js`           cities / airports / seaports / display names / manifest
 *   - `loadMainTimelineEvents.js`      story timeline JSON ↔ localStorage selection logic
 *   - `loadSatelliteArchive.js`        satellite-archive JSON ↔ localStorage selection logic
 *   - `mergeTimelineMetadataFromFile.js`  patch local events with era/year from disk
 *
 *   Save & I/O:
 *   - `persistEvents.js`               save to localStorage + dev API POST (+ dock-from-snapshot)
 *   - `importExportEvents.js`          JSON file download + user-selected file import
 *   - `refreshBioArchivesFromCodex.js` re-pull hero/faction/NPC archives after Codex disk write
 *
 *   Normalization / migration:
 *   - `eventFilterPlacesMigration.js`  legacy story-event filter shape → grouped *FilterPlaces
 *   - `normalizeBioArchives.js`        hero/faction/npc `relevantLocations` + `connections` shapes
 *
 *   Lookups:
 *   - `findCityCoordinates.js`         city/airport/seaport name → coordinates resolution
 *
 * Exposed as `window.EventDataService` (singleton) for back-compat with classic-script consumers.
 */

import { loadLocationsData } from './loadLocationsData.js';
import { loadMainTimelineEvents } from './loadMainTimelineEvents.js';
import { loadSatelliteArchive } from './loadSatelliteArchive.js';
import { persistEvents, persistStoryDockTimelineFromSnapshot } from './persistEvents.js';
import { migrateAllStoryEventsFilterPlaces } from './eventFilterPlacesMigration.js';
import {
    normalizeBioArchiveConnections,
    normalizeSatelliteArchiveEntry
} from './normalizeBioArchives.js';
import { findCityCoordinates } from './findCityCoordinates.js';
import {
    isMainTimelineArchive,
    getArchiveSource,
    setArchiveSourceOn,
    archiveFilePathFor,
    archiveLocalStorageKeyFor,
    archiveFilePathForSource,
    archiveLocalStorageKeyForSource,
} from './archiveRouting.js';
import {
    getStoryTimelineEventsForDock,
    refreshStoryDockSnapshotFromCurrentEvents,
} from './storyDockSnapshot.js';
import { refreshBioArchivesFromCodexDiskWrite } from './refreshBioArchivesFromCodex.js';
import { exportEvents, importEvents } from './importExportEvents.js';
import { mergeTimelineMetadataFromFileEvents } from './mergeTimelineMetadataFromFile.js';

class EventDataService {
    constructor() {
        /** @type {'story'|'heroes'|'factions'|'npcs'|'locations'} Which JSON backs the Event Manager list */
        this.archiveSource = 'story';
        this.events = [];
        this.cities = [];
        this.fictionalCities = [];
        this.airports = [];
        this.seaports = [];
        this.heroes = [];
        this.factions = [];
        this.npcs = [];
        this.displayNames = {};
        this.locationCache = new Map();
        /** Last main-timeline event list when user switches to a satellite archive. */
        this._storyDockEventsSnapshot = [];
        /** Parsed `timelineEvents` when no in-memory snapshot exists yet. */
        this._storyDockEventsSnapshotFromLs = null;
    }

    // --- Status / environment ---

    updateStatus(message, type = 'info') {
        if (typeof window.updateStatus === 'function') {
            window.updateStatus(message, type);
        }
    }

    /** Static deploy override via `<meta name="timeline-deploy" content="static">` or `*.github.io` hostnames. */
    isGitHubPages() {
        try {
            const m = document.querySelector('meta[name="timeline-deploy"]');
            if (m && String(m.getAttribute('content') || '').toLowerCase() === 'static') {
                return true;
            }
        } catch (_) {}
        const hostname = window.location.hostname;
        return hostname === 'github.io' ||
               hostname.includes('github.io') ||
               hostname === 'pages.github.com';
    }

    // --- Archive routing (delegates to archiveRouting.js) ---

    getArchiveSource() { return getArchiveSource(this); }
    setArchiveSource(sourceId) { setArchiveSourceOn(this, sourceId); }
    _isMainTimelineArchive() { return isMainTimelineArchive(this); }
    _getArchiveFilePath() { return archiveFilePathFor(this); }
    _getArchiveLocalStorageKey() { return archiveLocalStorageKeyFor(this); }
    _getArchiveFilePathForSource(sourceId) { return archiveFilePathForSource(sourceId); }
    _getArchiveLocalStorageKeyForSource(sourceId) { return archiveLocalStorageKeyForSource(sourceId); }

    // --- Story dock snapshot (delegates to storyDockSnapshot.js) ---

    getStoryTimelineEventsForDock() { return getStoryTimelineEventsForDock(this); }
    refreshStoryDockSnapshotFromCurrentEvents() { refreshStoryDockSnapshotFromCurrentEvents(this); }

    /**
     * True when this origin can call the repo Node server to write `src/data/*.json`
     * (localhost / :8000 / http(s)). GitHub Pages and `file://` never persist via API.
     */
    _canPersistTimelineJsonToRepo() {
        try {
            if (this.isGitHubPages()) return false;
            const proto = window.location.protocol;
            if (proto !== 'http:' && proto !== 'https:') return false;
            const isDevServerPort = String(window.location.port || '') === '8000';
            const host = window.location.hostname || '';
            const isLoopbackHost = host === 'localhost' || host === '127.0.0.1';
            return isDevServerPort || isLoopbackHost;
        } catch (_) {
            return false;
        }
    }

    // --- Normalization adapters (delegate but keep instance method API) ---

    _normalizeSatelliteArchiveEntry(raw) {
        return normalizeSatelliteArchiveEntry(raw, this.archiveSource);
    }

    _normalizeSatelliteEventsInPlace() {
        if (this._isMainTimelineArchive()) return;
        this.events = (this.events || []).map((e) => this._normalizeSatelliteArchiveEntry(e));
    }

    /** Public alias kept for external callers (BioArchiveConnectionsSync, etc.). */
    normalizeBioArchiveConnections(raw) {
        return normalizeBioArchiveConnections(raw);
    }

    refreshBioArchivesFromCodexDiskWrite(archivesTouched) {
        return refreshBioArchivesFromCodexDiskWrite(this, archivesTouched);
    }

    // --- Load ---

    loadLocationsData() {
        return loadLocationsData(this);
    }

    async loadEvents() {
        if (!this._isMainTimelineArchive()) {
            return loadSatelliteArchive(this);
        }
        return loadMainTimelineEvents(this);
    }

    /**
     * Normalize story `secondaryCountryPlaces` (and strip legacy `secondaryCountryFlags`)
     * after any main-timeline load path. Returns the same descriptor it was given.
     * @param {{ events: Array<Object>, source: string, shouldSync: boolean }} result
     */
    _finishMainTimelineLoadEvents(result) {
        try {
            if (this._isMainTimelineArchive() && Array.isArray(this.events)) {
                migrateAllStoryEventsFilterPlaces(this.events);
            }
        } catch (e) {
            console.warn('EventDataService: migrate hero/faction/NPC filter places to grouped failed:', e);
        }
        try {
            const lh = typeof window !== 'undefined' ? window.LocationFlagHelpers : null;
            if (Array.isArray(this.events) && lh?.migrateAllStoryEventsSecondaryPlaces) {
                lh.migrateAllStoryEventsSecondaryPlaces(this.events);
            }
        } catch (e) {
            console.warn('EventDataService: migrate secondary country places failed:', e);
        }
        return result;
    }

    mergeTimelineMetadataFromFileEvents(fileEvents) {
        return mergeTimelineMetadataFromFileEvents(this, fileEvents);
    }

    // --- Save / persist ---

    saveEvents() {
        persistEvents(this);
    }

    /**
     * While a satellite archive is active, main-timeline rows live in the story dock
     * snapshot. After editing a dock story event, `saveEvents()` only writes the satellite
     * file — call this to also persist `timelineEvents` (and `src/data/events.json` on the
     * dev server).
     */
    persistStoryDockTimelineFromSnapshot() {
        persistStoryDockTimelineFromSnapshot(this);
    }

    exportEvents() { exportEvents(this); }
    importEvents(file) { return importEvents(this, file); }

    // --- Lookups / accessors ---

    findCityCoordinates(cityName) {
        return findCityCoordinates(this, cityName);
    }

    /** Display-name override for a raw location name, falling back to the raw value. */
    getDisplayName(locationName) {
        return this.displayNames[locationName] || locationName;
    }

    getEvents() { return this.events; }
    setEvents(events) { this.events = events; }
}

if (typeof window !== 'undefined') {
    window.EventDataService = new EventDataService();
}

export default EventDataService;
