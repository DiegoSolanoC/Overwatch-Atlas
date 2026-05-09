/**
 * EventDataService - Handles event data loading, saving, and location data management
 * Separates data operations from UI logic
 */

/** Keep in sync with `StoryFilterPlacesSync.migrateStoryEventFilterFieldsToGroupedOnly` (classic script load order). */
function _normalizeCollectedPlacesForMigration(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .map((r) => ({
            locationName: String(r?.locationName || '').trim(),
            country: String(r?.country || '').trim(),
            reasoning: String(r?.reasoning || '').trim()
        }))
        .filter((r) => r.locationName || r.country || r.reasoning);
}

function _migrateHeroPlacesFromFiltersFlat(filters) {
    if (!Array.isArray(filters) || filters.length === 0) return [];
    return [{ locationName: '', country: filters.join(', '), reasoning: '' }];
}

function _migrateNpcPlacesFromNpcsFlat(npcs) {
    if (!Array.isArray(npcs) || npcs.length === 0) return [];
    return [{ locationName: '', country: npcs.join(', '), reasoning: '' }];
}

function _factionFlatToCsv(factions) {
    if (!Array.isArray(factions) || factions.length === 0) return '';
    return factions
        .map((f) => String(f).replace(/^\d+/, '').trim())
        .filter(Boolean)
        .join(', ');
}

function _migrateStoryEventFilterFieldsToGroupedOnlyNode(node) {
    if (!node || typeof node !== 'object') return;

    const heroNorm = _normalizeCollectedPlacesForMigration(node.heroFilterPlaces);
    if (heroNorm.length) {
        node.heroFilterPlaces = heroNorm;
    } else if (Array.isArray(node.filters) && node.filters.length > 0) {
        node.heroFilterPlaces = _migrateHeroPlacesFromFiltersFlat(node.filters);
    } else {
        delete node.heroFilterPlaces;
    }

    const facNorm = _normalizeCollectedPlacesForMigration(node.factionFilterPlaces);
    if (facNorm.length) {
        node.factionFilterPlaces = facNorm;
    } else if (Array.isArray(node.factions) && node.factions.length > 0) {
        const formSvc = typeof window !== 'undefined' ? window.eventManager?.formService : null;
        const manifest =
            typeof window !== 'undefined' && window.eventManager?.factions?.length > 0
                ? window.eventManager.factions
                : typeof window !== 'undefined' && window.globeController?.dataModel?.factions?.length
                    ? window.globeController.dataModel.factions
                    : [];
        const display =
            formSvc && typeof formSvc.factionsArrayToFormDisplayString === 'function'
                ? formSvc.factionsArrayToFormDisplayString(node.factions, manifest || [])
                : _factionFlatToCsv(node.factions);
        node.factionFilterPlaces = [{ locationName: '', country: display, reasoning: '' }];
    } else {
        delete node.factionFilterPlaces;
    }

    const npcNorm = _normalizeCollectedPlacesForMigration(node.npcFilterPlaces);
    if (npcNorm.length) {
        node.npcFilterPlaces = npcNorm;
    } else if (Array.isArray(node.npcs) && node.npcs.length > 0) {
        node.npcFilterPlaces = _migrateNpcPlacesFromNpcsFlat(node.npcs);
    } else {
        delete node.npcFilterPlaces;
    }

    delete node.filters;
    delete node.factions;
    delete node.npcs;
}

function _migrateAllStoryEventsFilterPlacesToGroupedInPlace(events) {
    if (!Array.isArray(events)) return;
    for (let i = 0; i < events.length; i += 1) {
        const ev = events[i];
        _migrateStoryEventFilterFieldsToGroupedOnlyNode(ev);
        if (Array.isArray(ev.variants)) {
            for (let j = 0; j < ev.variants.length; j += 1) {
                _migrateStoryEventFilterFieldsToGroupedOnlyNode(ev.variants[j]);
            }
        }
    }
}

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
        /** Last main-timeline event list when user switches to a satellite archive (dock thumbnails / slide indices stay on story). */
        this._storyDockEventsSnapshot = [];
        /** Parsed `timelineEvents` when no in-memory snapshot exists yet (stable array ref for dock). */
        this._storyDockEventsSnapshotFromLs = null;
    }

    /**
     * Helper function to update status (if available)
     */
    updateStatus(message, type = 'info') {
        if (typeof window.updateStatus === 'function') {
            window.updateStatus(message, type);
        }
    }

    /**
     * Check if we're running on GitHub Pages
     */
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

    /** Active Data Archive bucket: which JSON dataset the viewer uses (`story` = main timeline; heroes, factions, npcs, locations = satellites). */
    getArchiveSource() {
        return this.archiveSource || 'story';
    }

    /**
     * @param {'story'|'heroes'|'factions'|'npcs'|'locations'} sourceId
     */
    setArchiveSource(sourceId) {
        const allowed = new Set(['story', 'heroes', 'factions', 'npcs', 'locations']);
        const next = allowed.has(sourceId) ? sourceId : 'story';
        if (this._isMainTimelineArchive() && next !== 'story' && Array.isArray(this.events) && this.events.length > 0) {
            this._storyDockEventsSnapshot = this.events.slice();
        }
        this._storyDockEventsSnapshotFromLs = null;
        this.archiveSource = next;
    }

    /**
     * Events used only by the bottom pagination dock: live main timeline when on story,
     * otherwise the snapshot taken when leaving story (so dock stays on story entries).
     */
    getStoryTimelineEventsForDock() {
        if (this._isMainTimelineArchive()) {
            return Array.isArray(this.events) ? this.events : [];
        }
        if (Array.isArray(this._storyDockEventsSnapshot) && this._storyDockEventsSnapshot.length > 0) {
            return this._storyDockEventsSnapshot;
        }
        if (!this._storyDockEventsSnapshotFromLs) {
            try {
                const raw = localStorage.getItem('timelineEvents');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    this._storyDockEventsSnapshotFromLs = Array.isArray(parsed) ? parsed : [];
                } else {
                    this._storyDockEventsSnapshotFromLs = [];
                }
            } catch (_) {
                this._storyDockEventsSnapshotFromLs = [];
            }
        }
        return this._storyDockEventsSnapshotFromLs;
    }

    /** Refresh dock snapshot from current main-timeline rows (call after story load/save). */
    refreshStoryDockSnapshotFromCurrentEvents() {
        if (!this._isMainTimelineArchive()) return;
        this._storyDockEventsSnapshot = Array.isArray(this.events) ? this.events.slice() : [];
        this._storyDockEventsSnapshotFromLs = null;
    }

    _isMainTimelineArchive() {
        return this.getArchiveSource() === 'story';
    }

    /**
     * True when this origin can call the repo Node server to write `src/data/*.json` (localhost / :8000 / http(s)).
     * GitHub Pages and file:// never persist via API.
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

    _getArchiveFilePath() {
        const map = {
            story: 'src/data/events.json',
            heroes: 'src/data/story-archive-heroes.json',
            factions: 'src/data/story-archive-factions.json',
            npcs: 'src/data/story-archive-npcs.json',
            locations: 'src/data/story-archive-locations.json',
        };
        return map[this.getArchiveSource()] || map.story;
    }

    _getArchiveLocalStorageKey() {
        const map = {
            story: 'timelineEvents',
            heroes: 'timelineEventsArchiveHeroes',
            factions: 'timelineEventsArchiveFactions',
            npcs: 'timelineEventsArchiveNpcs',
            locations: 'timelineEventsArchiveLocations',
        };
        return map[this.getArchiveSource()] || map.story;
    }

    /** @param {'story'|'heroes'|'factions'|'npcs'|'locations'} sourceId */
    _getArchiveFilePathForSource(sourceId) {
        const map = {
            story: 'src/data/events.json',
            heroes: 'src/data/story-archive-heroes.json',
            factions: 'src/data/story-archive-factions.json',
            npcs: 'src/data/story-archive-npcs.json',
            locations: 'src/data/story-archive-locations.json',
        };
        return map[sourceId] || map.story;
    }

    /** @param {'story'|'heroes'|'factions'|'npcs'|'locations'} sourceId */
    _getArchiveLocalStorageKeyForSource(sourceId) {
        const map = {
            story: 'timelineEvents',
            heroes: 'timelineEventsArchiveHeroes',
            factions: 'timelineEventsArchiveFactions',
            npcs: 'timelineEventsArchiveNpcs',
            locations: 'timelineEventsArchiveLocations',
        };
        return map[sourceId] || map.story;
    }

    /**
     * After POST /api/codex updates story-archive-*.json on disk, re-fetch those files,
     * refresh matching localStorage keys, and replace in-memory `this.events` when the
     * active archive is one of them (so open slides see new connections immediately).
     * @param {string[]} archivesTouched e.g. ['heroes','npcs']
     * @returns {Promise<{ updated: string[] }>}
     */
    async refreshBioArchivesFromCodexDiskWrite(archivesTouched) {
        const bio = new Set(['heroes', 'factions', 'npcs']);
        const list = Array.isArray(archivesTouched) ? archivesTouched.filter((a) => bio.has(a)) : [];
        if (!list.length) return { updated: [] };

        const savedArch = this.getArchiveSource();
        const updated = [];

        for (let i = 0; i < list.length; i += 1) {
            const arch = list[i];
            const fileUrl = this._getArchiveFilePathForSource(arch);
            const storageKey = this._getArchiveLocalStorageKeyForSource(arch);
            try {
                const sep = fileUrl.includes('?') ? '&' : '?';
                const res = await fetch(`${fileUrl}${sep}v=${Date.now()}&_=${Math.random().toString(36).slice(2, 10)}`, {
                    cache: 'no-store',
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const rawEvents = Array.isArray(data.events) ? data.events : [];

                this.archiveSource = arch;
                const normalized = rawEvents.map((e) => this._normalizeSatelliteArchiveEntry(e));
                this.archiveSource = savedArch;

                try {
                    localStorage.setItem(storageKey, JSON.stringify(normalized));
                } catch (lsErr) {
                    console.warn('EventDataService: localStorage update after codex save failed', arch, lsErr);
                }

                updated.push(arch);

                if (savedArch === arch) {
                    this.events = normalized;
                    this._normalizeSatelliteEventsInPlace();
                }
            } catch (e) {
                console.warn(`EventDataService: re-fetch ${arch} after codex save failed`, e);
            }
        }

        return { updated };
    }

    /** Strip trailing ", ," so "Cairo, Egypt," parses to Egypt (matches LocationFlagHelpers). */
    _stripTrailingCommaSep(s) {
        return String(s == null ? '' : s)
            .replace(/\u00a0/g, ' ')
            .replace(/,+\s*$/g, '')
            .trim();
    }

    /**
     * If name already ends with ", Country" and matches `country`, keep only the place part (avoids "Cairo, Egypt" + Egypt).
     */
    _dedupeHeroLocationNameCountry(locationName, country) {
        const ln = this._stripTrailingCommaSep(locationName);
        const c = this._stripTrailingCommaSep(country);
        if (!ln || !c) return ln;
        const idx = ln.lastIndexOf(',');
        if (idx < 0) return ln;
        const lastSeg = this._stripTrailingCommaSep(ln.slice(idx + 1));
        if (lastSeg.toLowerCase() === c.toLowerCase()) {
            return this._stripTrailingCommaSep(ln.slice(0, idx));
        }
        return ln;
    }

    /**
     * One hero relevant-location entry: display name, country token for flag, optional note.
     * @param {unknown} item
     * @returns {{ locationName: string, country: string, reasoning: string }}
     */
    _normalizeHeroRelevantLocationItem(item) {
        if (typeof item === 'string') {
            const s = this._stripTrailingCommaSep(item);
            if (!s) return { locationName: '', country: '', reasoning: '' };
            const idx = s.lastIndexOf(',');
            if (idx >= 0) {
                const locationName = this._stripTrailingCommaSep(s.slice(0, idx));
                const country = this._stripTrailingCommaSep(s.slice(idx + 1));
                return {
                    locationName: this._dedupeHeroLocationNameCountry(locationName, country),
                    country,
                    reasoning: ''
                };
            }
            return { locationName: s, country: '', reasoning: '' };
        }
        if (item && typeof item === 'object' && !Array.isArray(item)) {
            let locationName = this._stripTrailingCommaSep(
                item.locationName != null ? String(item.locationName) : item.name != null ? String(item.name) : ''
            );
            let country = this._stripTrailingCommaSep(
                item.country != null ? String(item.country) : ''
            );
            const reasoning = String(item.reasoning != null ? item.reasoning : '').trim();
            if (!country && locationName) {
                const ix = locationName.lastIndexOf(',');
                if (ix >= 0) {
                    const tail = this._stripTrailingCommaSep(locationName.slice(ix + 1));
                    if (tail) {
                        country = tail;
                        locationName = this._stripTrailingCommaSep(locationName.slice(0, ix));
                    }
                }
            }
            locationName = this._dedupeHeroLocationNameCountry(locationName, country);
            return { locationName, country, reasoning };
        }
        return { locationName: '', country: '', reasoning: '' };
    }

    /**
     * Hero archive `relevantLocations`: array of { locationName, country, reasoning }.
     * Migrates legacy string[] ("Place, Country" per line) and mixed shapes.
     * @param {unknown} raw
     * @returns {Array<{ locationName: string, country: string, reasoning: string }>}
     */
    _normalizeHeroRelevantLocations(raw) {
        if (raw == null) return [];
        if (typeof raw === 'string') {
            return raw
                .split(/\r?\n/)
                .map((line) => this._normalizeHeroRelevantLocationItem(line))
                .filter((e) => e.locationName || e.country || e.reasoning);
        }
        if (!Array.isArray(raw)) return [];
        return raw
            .map((item) => this._normalizeHeroRelevantLocationItem(item))
            .filter((e) => e.locationName || e.country || e.reasoning);
    }

    /**
     * Strip trailing punctuation often pasted from list/autocomplete (e.g. "Pharah,").
     * @param {unknown} s
     * @returns {string}
     */
    _sanitizeBioConnectionEntityName(s) {
        let t = s != null ? String(s).trim() : '';
        while (t.length > 0 && /[,;]\s*$/.test(t)) {
            t = t.replace(/[,;]\s*$/, '').trim();
        }
        return t;
    }

    /**
     * Bio archives: `connections` — linked hero/faction/npc + relationship text each direction.
     * Legacy single `reasoning` is shown both ways when the directional fields are absent.
     * @param {unknown} raw
     * @returns {Array<{ kind: 'hero'|'faction'|'npc', name: string, reasoningSubjectToLinked: string, reasoningLinkedToSubject: string, thisEntryLane: 'A'|'B' }>}
     */
    _normalizeBioArchiveConnections(raw) {
        if (!Array.isArray(raw)) return [];
        return raw
            .map((item) => {
                let kind = String(item?.kind || '').toLowerCase();
                if (kind === 'character') kind = 'hero';
                if (kind !== 'faction' && kind !== 'npc') kind = 'hero';
                const name = this._sanitizeBioConnectionEntityName(item?.name);
                let reasoningSubjectToLinked =
                    item?.reasoningSubjectToLinked != null ? String(item.reasoningSubjectToLinked).trim() : '';
                let reasoningLinkedToSubject =
                    item?.reasoningLinkedToSubject != null ? String(item.reasoningLinkedToSubject).trim() : '';
                const legacy = item?.reasoning != null ? String(item.reasoning).trim() : '';
                if (!reasoningSubjectToLinked && !reasoningLinkedToSubject && legacy) {
                    reasoningSubjectToLinked = legacy;
                    reasoningLinkedToSubject = legacy;
                }
                const laneRaw = String(item?.thisEntryLane ?? '').trim().toUpperCase();
                const thisEntryLane = laneRaw === 'B' ? 'B' : 'A';
                const showInCodex = item?.showInCodex === true;
                const out = {
                    kind,
                    name,
                    reasoningSubjectToLinked,
                    reasoningLinkedToSubject,
                    thisEntryLane
                };
                if (showInCodex) out.showInCodex = true;
                return out;
            })
            .filter(
                (c) =>
                    c.name ||
                    c.reasoningSubjectToLinked ||
                    c.reasoningLinkedToSubject
            );
    }

    /** @param {unknown} raw */
    normalizeBioArchiveConnections(raw) {
        return this._normalizeBioArchiveConnections(raw);
    }

    /**
     * Non-story archives (Heroes / Factions / NPCs / Locations): title + description.
     * Heroes, Factions, and NPCs archives support `relevantLocations` ({ locationName, country, reasoning }[]).
     * and `connections` ({ kind, name, reasoningSubjectToLinked, reasoningLinkedToSubject }[]; legacy `reasoning` is migrated).
     * Collapse legacy full event objects to the slim shape.
     * @param {unknown} raw
     * @returns {{ name: string, description: string, relevantLocations?: Array<{ locationName: string, country: string, reasoning: string }>, connections?: Array<{ kind: string, name: string, reasoningSubjectToLinked: string, reasoningLinkedToSubject: string }>, factionType?: string, heroRole?: string, heroSubRole?: string }}
     */
    _normalizeSatelliteArchiveEntry(raw) {
        if (!raw || typeof raw !== 'object') {
            return { name: '', description: '' };
        }
        let name = '';
        let description = '';
        const variants = raw.variants;
        if (Array.isArray(variants) && variants.length > 0) {
            const v0 = variants[0];
            name = v0 && v0.name != null ? String(v0.name) : '';
            description = v0 && v0.description != null ? String(v0.description) : '';
        } else {
            name = raw.name != null ? String(raw.name) : '';
            description = raw.description != null ? String(raw.description) : '';
        }
        const base = { name, description };
        const bioArchives = new Set(['heroes', 'factions', 'npcs']);
        if (bioArchives.has(this.archiveSource)) {
            base.relevantLocations = this._normalizeHeroRelevantLocations(raw.relevantLocations);
            base.connections = this._normalizeBioArchiveConnections(raw.connections);
        }
        if (this.archiveSource === 'factions') {
            let factionType = '';
            if (Array.isArray(variants) && variants.length > 0) {
                const v0 = variants[0];
                factionType = v0?.factionType != null ? String(v0.factionType) : '';
            } else {
                factionType = raw.factionType != null ? String(raw.factionType) : '';
            }
            base.factionType = factionType;
        }
        if (this.archiveSource === 'heroes') {
            let heroRole = '';
            let heroSubRole = '';
            if (Array.isArray(variants) && variants.length > 0) {
                const v0 = variants[0];
                heroRole = v0?.heroRole != null ? String(v0.heroRole) : '';
                heroSubRole = v0?.heroSubRole != null ? String(v0.heroSubRole) : '';
            } else {
                heroRole = raw.heroRole != null ? String(raw.heroRole) : '';
                heroSubRole = raw.heroSubRole != null ? String(raw.heroSubRole) : '';
            }
            base.heroRole = heroRole;
            base.heroSubRole = heroSubRole;
        }
        return base;
    }

    _normalizeSatelliteEventsInPlace() {
        if (this._isMainTimelineArchive()) return;
        this.events = (this.events || []).map((e) => this._normalizeSatelliteArchiveEntry(e));
    }

    /**
     * Satellite archives: one JSON + separate localStorage key; no merge with main timeline rules.
     */
    async _loadEventsSatelliteArchive() {
        const fileUrl = this._getArchiveFilePath();
        const storageKey = this._getArchiveLocalStorageKey();
        const label = fileUrl.replace(/^data\//, '');
        this.updateStatus(`EventDataService: Loading ${this.getArchiveSource()} archive (${label})...`, 'info');

        let fileEvents = null;
        const fetchStartTime = performance.now();
        try {
            const fetchWithTimeout = (url, timeout = 10000) => {
                const separator = url.includes('?') ? '&' : '?';
                const cacheBuster = `${separator}v=${Date.now()}&_=${Math.random().toString(36).substr(2, 9)}&nocache=true`;
                const fullUrl = url + cacheBuster;
                return Promise.race([
                    fetch(fullUrl).then((res) => {
                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                        }
                        return res.json();
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Timeout: ${url} took longer than ${timeout}ms`)), timeout)
                    ),
                ]);
            };
            const data = await fetchWithTimeout(fileUrl);
            const fetchTime = performance.now() - fetchStartTime;
            if (data && Array.isArray(data.events)) {
                fileEvents = data.events;
                this.updateStatus(
                    `EventDataService: ${label} loaded (${fetchTime.toFixed(0)}ms, ${fileEvents.length} events)`,
                    'success'
                );
            } else {
                this.updateStatus(`EventDataService: ${label} has no { events: [] } — using empty list`, 'warning');
                fileEvents = [];
            }
        } catch (error) {
            console.warn(`EventDataService: ${label} fetch failed:`, error);
            this.updateStatus(`EventDataService: ${label} fetch error — ${error.message}`, 'warning');
        }

        const savedEvents = localStorage.getItem(storageKey);
        const isGitHubPages = this.isGitHubPages();

        if (isGitHubPages) {
            this.events = Array.isArray(fileEvents) ? fileEvents : [];
            this._normalizeSatelliteEventsInPlace();
            if (this.events.length === 0) {
                try {
                    localStorage.removeItem(storageKey);
                } catch (_) { /* ignore */ }
            } else {
                this.saveEvents();
            }
            return { events: this.events, source: 'file', shouldSync: false };
        }

        // Local http(s): without repo write API (e.g. Live Server on :5500), prefer localStorage so edits survive reload.
        let parsedLocal = null;
        if (savedEvents) {
            try {
                parsedLocal = JSON.parse(savedEvents);
            } catch (_) {
                parsedLocal = null;
            }
        }
        const localOk = Array.isArray(parsedLocal) && parsedLocal.length > 0;
        if (localOk && !this._canPersistTimelineJsonToRepo()) {
            this.events = parsedLocal;
            this._normalizeSatelliteEventsInPlace();
            this.updateStatus(
                `EventDataService: Using localStorage for ${this.getArchiveSource()} (dev file API not on this port — edits kept locally)`,
                'info'
            );
            return { events: this.events, source: 'localStorage', shouldSync: false };
        }

        if (Array.isArray(fileEvents)) {
            this.events = fileEvents;
            this._normalizeSatelliteEventsInPlace();
            this.saveEvents();
            return { events: this.events, source: 'file', shouldSync: false };
        }

        if (savedEvents) {
            try {
                const parsed = JSON.parse(savedEvents);
                this.events = Array.isArray(parsed) ? parsed : [];
                this._normalizeSatelliteEventsInPlace();
                this.updateStatus(
                    `EventDataService: Using localStorage for ${this.getArchiveSource()} (${this.events.length} events)`,
                    'info'
                );
                return { events: this.events, source: 'localStorage', shouldSync: false };
            } catch (e) {
                console.error('EventDataService: satellite localStorage parse failed', e);
            }
        }

        this.events = [];
        this._normalizeSatelliteEventsInPlace();
        this.updateStatus(`EventDataService: No data for ${this.getArchiveSource()} archive`, 'warning');
        return { events: this.events, source: 'none', shouldSync: false };
    }

    /**
     * Load locations data (cities, airports, seaports, heroes, factions)
     */
    async loadLocationsData() {
        // Load all data in parallel for better performance
        this.updateStatus('EventDataService: Starting data fetch (3 files in parallel)...', 'info');
        const fetchStartTime = performance.now();
        
        // Add timeout protection to prevent hanging
        const fetchWithTimeout = (url, timeout = 10000) => {
            return Promise.race([
                fetch(url + '?' + Date.now()).then(res => {
                    if (!res.ok) {
                        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                    }
                    return res.json();
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Timeout: ${url} took longer than ${timeout}ms`)), timeout)
                )
            ]);
        };
        
        this.updateStatus('EventDataService: Fetching locations.json...', 'info');
        const [locationsResult, displayNamesResult, manifestResult] = await Promise.allSettled([
            fetchWithTimeout('src/data/locations.json').then(data => {
                this.updateStatus('EventDataService: locations.json response received, parsing...', 'info');
                return data;
            }),
            fetchWithTimeout('src/data/location-display-names.json').then(data => {
                this.updateStatus('EventDataService: location-display-names.json response received, parsing...', 'info');
                return data;
            }),
            fetchWithTimeout('src/data/manifest.json').then(data => {
                this.updateStatus('EventDataService: manifest.json response received, parsing...', 'info');
                return data;
            })
        ]);
        
        const fetchTime = performance.now() - fetchStartTime;
        this.updateStatus(`EventDataService: All 3 files fetched (${fetchTime.toFixed(0)}ms)`, 'success');
        
        // Process locations data
        this.updateStatus('EventDataService: Processing locations.json data...', 'info');
        if (locationsResult.status === 'fulfilled') {
            const data = locationsResult.value;
            this.cities = data.cities || [];
            this.fictionalCities = data.fictionalCities || [];
            this.airports = data.airports || [];
            this.seaports = data.seaports || [];
            this.updateStatus(`EventDataService: Processed ${this.cities.length} cities, ${this.fictionalCities.length} fictional cities, ${this.airports.length} airports, ${this.seaports.length} seaports`, 'success');
        } else {
            console.error('Error loading locations data:', locationsResult.reason);
            this.updateStatus('EventDataService: Error loading locations.json', 'error');
        }
        
        // Process display names
        this.updateStatus('EventDataService: Processing location-display-names.json data...', 'info');
        if (displayNamesResult.status === 'fulfilled') {
            const displayNamesData = displayNamesResult.value;
            this.displayNames = displayNamesData.displayNames || {};
            const displayNamesCount = Object.keys(this.displayNames).length;
            this.updateStatus(`EventDataService: Processed ${displayNamesCount} display name mappings`, 'success');
        } else {
            console.error('Error loading display names:', displayNamesResult.reason);
            this.displayNames = {};
            this.updateStatus('EventDataService: Error loading location-display-names.json', 'error');
        }
        
        // Process manifest
        this.updateStatus('EventDataService: Processing manifest.json data...', 'info');
        if (manifestResult.status === 'fulfilled') {
            const manifest = manifestResult.value;
            this.heroes = manifest.heroes || [];
            // Store full faction objects (filename + displayName from manifest)
            this.factions = manifest.factions || [];
            this.npcs = manifest.npcs || [];
            this.updateStatus(`EventDataService: Processed ${this.heroes.length} heroes, ${this.factions.length} factions, ${this.npcs.length} NPCs`, 'success');
        } else {
            console.error('Error loading manifest:', manifestResult.reason);
            this.updateStatus('EventDataService: Error loading manifest.json', 'error');
        }
    }

    /**
     * Load events from localStorage or fetch from events.json
     */
    async loadEvents() {
        if (!this._isMainTimelineArchive()) {
            return this._loadEventsSatelliteArchive();
        }

        // First, always try to load from events.json (source of truth)
        let fileEventCount = 0;
        let fileEvents = null;
        this.updateStatus('EventDataService: Starting events load process...', 'info');
        
        this.updateStatus('EventDataService: Fetching events.json file...', 'info');
        const fetchStartTime = performance.now();
        try {
            // Add timeout protection with proper cache-busting
            const fetchWithTimeout = (url, timeout = 10000) => {
                // Add cache-busting parameters properly
                const separator = url.includes('?') ? '&' : '?';
                const cacheBuster = `${separator}v=${Date.now()}&_=${Math.random().toString(36).substr(2, 9)}&nocache=true`;
                const fullUrl = url + cacheBuster;
                
                return Promise.race([
                    fetch(fullUrl).then(res => {
                        if (!res.ok) {
                            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                        }
                        return res.json();
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error(`Timeout: ${url} took longer than ${timeout}ms`)), timeout)
                    )
                ]);
            };
            
            // Fetch events.json with cache-busting
            const data = await fetchWithTimeout('src/data/events.json');
            const fetchTime = performance.now() - fetchStartTime;
            this.updateStatus(`EventDataService: events.json fetch completed (${fetchTime.toFixed(0)}ms)`, 'info');
            
            if (data && data.events && Array.isArray(data.events) && data.events.length > 0) {
                fileEvents = data.events;
                fileEventCount = data.events.length;
                console.log('EventDataService: ✓ Successfully loaded', fileEventCount, 'events from src/data/events.json');
                this.updateStatus(`EventDataService: Found ${fileEventCount} events in events.json`, 'success');
            } else {
                console.warn('EventDataService: events.json loaded but has no events array or is empty', data);
                this.updateStatus('EventDataService: events.json has no events array or is empty', 'warning');
            }
        } catch (error) {
            console.error('EventDataService: ✗ CRITICAL - Could not load from src/data/events.json:', error);
            console.error('EventDataService: Error details:', {
                message: error.message,
                stack: error.stack,
                url: 'src/data/events.json'
            });
            this.updateStatus(`EventDataService: events.json fetch error: ${error.message}`, 'error');
            this.updateStatus('EventDataService: Will try localStorage if available', 'info');
        }
        
        // Check localStorage for comparison
        this.updateStatus('EventDataService: Checking localStorage for saved events...', 'info');
        const localStorageStartTime = performance.now();
        const savedEvents = localStorage.getItem('timelineEvents');
        const localStorageTime = performance.now() - localStorageStartTime;
        this.updateStatus(`EventDataService: localStorage access completed (${localStorageTime.toFixed(0)}ms)`, 'info');
        console.log('EventDataService: Checking localStorage for events...');
        console.log('EventDataService: localStorage.getItem("timelineEvents") =', savedEvents ? 'Found data (' + savedEvents.length + ' chars)' : 'null');
        
        if (savedEvents) {
            try {
                this.updateStatus('EventDataService: Parsing localStorage events...', 'info');
                const parseStartTime = performance.now();
                const localStorageEvents = JSON.parse(savedEvents);
                const parseTime = performance.now() - parseStartTime;
                this.updateStatus(`EventDataService: localStorage parsed (${parseTime.toFixed(0)}ms)`, 'info');
                
                const localStorageCount = localStorageEvents.length;
                console.log('EventDataService: Found', localStorageCount, 'events in localStorage');
                this.updateStatus(`EventDataService: Found ${localStorageCount} events in localStorage`, 'success');
                
                // On GitHub Pages, always prefer events.json (source of truth) since users can't edit
                // On localhost, prefer localStorage if it has user's saved changes, but use file if file has more events
                const isGitHubPages = this.isGitHubPages();
                
                if (fileEvents && fileEventCount > 0) {
                    // CRITICAL FIX: On GitHub Pages, ALWAYS use events.json if it exists (source of truth)
                    // This ensures GitHub Pages never uses stale localStorage
                    if (isGitHubPages) {
                        console.log(`EventDataService [GitHub Pages]: ALWAYS using events.json (${fileEventCount} events) - localStorage has ${localStorageCount} events (ignored)`);
                        this.updateStatus(`EventDataService: Using events.json (${fileEventCount} events) - GitHub Pages mode`, 'info');
                        this.events = fileEvents;
                        // Clear old localStorage and save fresh data
                        localStorage.removeItem('timelineEvents');
                        this.saveEvents();
                        return this._finishMainTimelineLoadEvents({ events: this.events, source: 'file', shouldSync: true });
                    }
                    
                    // On localhost: Use file if it has more events (even just 1 more), otherwise prefer localStorage
                    if (fileEventCount > localStorageCount) {
                        console.log(`[EventDataService] [Localhost]: Using events.json (${fileEventCount} events, file has more than localStorage (${localStorageCount}))`);
                        this.updateStatus(`EventDataService: Using events.json (${fileEventCount} events, file has more than localStorage)`, 'info');
                        this.events = fileEvents;
                        // Clear old localStorage and save fresh data
                        localStorage.removeItem('timelineEvents');
                        this.saveEvents();
                        return this._finishMainTimelineLoadEvents({ events: this.events, source: 'file', shouldSync: true });
                    }
                    
                    // On localhost: localStorage has same or more events, prefer it (user's saved changes)
                    console.log('[EventDataService] [Localhost]: Using localStorage version (user\'s saved changes) -', localStorageCount, 'events');
                    this.updateStatus(`EventDataService: Using localStorage (${localStorageCount} events, user's saved changes)`, 'info');
                }
                
                // Use localStorage (user's saved changes take priority on localhost)
                this.events = localStorageEvents;
                console.log('[EventDataService] Using localStorage version (', this.events.length, 'events)');
                console.log('[EventDataService] Event names:', this.events.map(e => e.name || (e.variants && e.variants[0]?.name) || 'Unnamed'));
                this.updateStatus(`EventDataService: Using ${this.events.length} events from localStorage`, 'success');

                if (fileEvents && fileEventCount === this.events.length) {
                    this.mergeTimelineMetadataFromFileEvents(fileEvents);
                }
                
                // CRITICAL: On GitHub Pages, always prefer file if it has more events (even if localStorage exists)
                // On localhost, only update if file has significantly more events (5+ more)
                if (fileEvents && fileEventCount > 0) {
                    if (isGitHubPages && fileEventCount > this.events.length) {
                        // GitHub Pages: Always use file if it has more events
                        console.warn(`EventDataService [GitHub Pages]: localStorage has ${this.events.length} events, but events.json has ${fileEventCount}. Using events.json (source of truth).`);
                        this.updateStatus(`EventDataService: Updating from events.json (${fileEventCount} events, localStorage had ${this.events.length})`, 'warning');
                        this.events = fileEvents;
                        localStorage.removeItem('timelineEvents');
                        this.saveEvents();
                        return this._finishMainTimelineLoadEvents({ events: this.events, source: 'file', shouldSync: true });
                    } else if (!isGitHubPages && fileEventCount > this.events.length + 4) {
                        // Localhost: Only update if file has 5+ more events (user might have local edits)
                        console.warn(`EventDataService [Localhost]: localStorage has ${this.events.length} events, but events.json has ${fileEventCount} (${fileEventCount - this.events.length} more). Using events.json.`);
                        this.updateStatus(`EventDataService: Updating from events.json (${fileEventCount} events, localStorage had ${this.events.length})`, 'warning');
                        this.events = fileEvents;
                        localStorage.removeItem('timelineEvents');
                        this.saveEvents();
                        return this._finishMainTimelineLoadEvents({ events: this.events, source: 'file', shouldSync: true });
                    }
                }
                
                return this._finishMainTimelineLoadEvents({ events: this.events, source: 'localStorage', shouldSync: true });
            } catch (error) {
                console.error('EventDataService: Error parsing saved events:', error);
                console.error('EventDataService: Raw data:', savedEvents.substring(0, 200));
                this.updateStatus('EventDataService: Error parsing localStorage (corrupted?), trying events.json...', 'error');
                // If localStorage is corrupted, clear it and use file
                if (fileEvents && fileEventCount > 0) {
                    console.log('EventDataService: localStorage corrupted, using file version');
                    this.updateStatus(`EventDataService: Using events.json (${fileEventCount} events, localStorage was corrupted)`, 'info');
                    localStorage.removeItem('timelineEvents');
                    this.events = fileEvents;
                    this.saveEvents();
                    return this._finishMainTimelineLoadEvents({ events: this.events, source: 'file', shouldSync: true });
                }
            }
        }

        // If no localStorage, use events.json if available
        if (fileEvents && fileEventCount > 0) {
            this.events = fileEvents;
            console.log('EventDataService: Loaded', this.events.length, 'events from src/data/events.json');
            console.log('EventDataService: Event names:', this.events.map(e => e.name || (e.variants && e.variants[0]?.name) || 'Unnamed'));
            this.updateStatus(`EventDataService: Using ${this.events.length} events from events.json`, 'success');
            
            // Check if we have a reasonable number of events (at least 50)
            // If not, clear localStorage to force fresh load
            if (this.events.length < 50) {
                console.warn(`EventDataService: Event count is less than expected (${this.events.length} < 50). Clearing localStorage to force fresh load.`);
                localStorage.removeItem('timelineEvents');
                this.updateStatus(`EventDataService: Cleared localStorage (found ${this.events.length} events, expected at least 50)`, 'warning');
            }
            
            // Save to localStorage for future use
            this.saveEvents();
            
            return this._finishMainTimelineLoadEvents({ events: this.events, source: 'file', shouldSync: true });
        }

        // CRITICAL: If events.json failed to load, try localStorage as fallback (even on GitHub Pages)
        // This prevents "No events" error if events.json has a temporary loading issue
        if (savedEvents) {
            try {
                const fallbackEvents = JSON.parse(savedEvents);
                if (Array.isArray(fallbackEvents) && fallbackEvents.length > 0) {
                    console.warn('EventDataService: events.json failed to load, using localStorage as fallback');
                    this.updateStatus(`EventDataService: Using localStorage fallback (${fallbackEvents.length} events) - events.json unavailable`, 'warning');
                    this.events = fallbackEvents;
                    return this._finishMainTimelineLoadEvents({ events: this.events, source: 'localStorage-fallback', shouldSync: true });
                }
            } catch (e) {
                console.error('EventDataService: localStorage fallback also failed:', e);
            }
        }

        // No events available from any source
        this.events = [];
        console.error('EventDataService: CRITICAL - No events found from events.json or localStorage!');
        this.updateStatus('EventDataService: ERROR - No events found. Check events.json file.', 'error');
        
        return this._finishMainTimelineLoadEvents({ events: this.events, source: 'none', shouldSync: true });
    }

    /**
     * Normalize story `secondaryCountryPlaces` (and strip legacy `secondaryCountryFlags`) after any main-timeline load path.
     * @param {{ events: Array<Object>, source: string, shouldSync: boolean }} result
     */
    _finishMainTimelineLoadEvents(result) {
        try {
            if (this._isMainTimelineArchive() && Array.isArray(this.events)) {
                _migrateAllStoryEventsFilterPlacesToGroupedInPlace(this.events);
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

    /**
     * When localStorage is preferred but events.json was fetched, copy era/year fields from the file
     * for any event that is missing them locally. Fixes stale localStorage after editing src/data/events.json.
     * @param {Array<Object>} fileEvents - Parsed events from events.json
     * @returns {boolean} true if any field was merged
     */
    mergeTimelineMetadataFromFileEvents(fileEvents) {
        if (!this._isMainTimelineArchive()) {
            return false;
        }
        if (!fileEvents || !Array.isArray(this.events) || this.events.length !== fileEvents.length) {
            return false;
        }
        let changed = false;
        for (let i = 0; i < this.events.length; i++) {
            const local = this.events[i];
            const file = fileEvents[i];
            if (!local || !file) continue;

            const eraF = file.eraName;
            if (eraF != null && String(eraF).trim() !== '') {
                if (local.eraName == null || local.eraName === '') {
                    local.eraName = eraF;
                    changed = true;
                }
            }
            for (const key of ['yearStart', 'yearEnd']) {
                const fv = file[key];
                if (fv != null && fv !== '' && !Number.isNaN(Number(fv))) {
                    if (local[key] == null || local[key] === '') {
                        const n = Number(fv);
                        local[key] = Number.isInteger(n) ? n : Math.trunc(n);
                        changed = true;
                    }
                }
            }
        }
        if (changed) {
            console.log('EventDataService: Merged eraName / year fields from events.json into events missing those fields (localStorage was stale)');
            this.updateStatus('EventDataService: Synced era & year fields from events.json', 'success');
            this.saveEvents();
        }
        return changed;
    }

    /**
     * Save events to localStorage
     */
    saveEvents() {
        if (!this._isMainTimelineArchive()) {
            const arch = this.getArchiveSource();
            if (
                (arch === 'heroes' || arch === 'factions' || arch === 'npcs') &&
                typeof window !== 'undefined' &&
                window.BioArchiveConnectionsSync?.repairMissingMirrorsForBioArchive
            ) {
                if (window.BioArchiveConnectionsSync?.isDebugVerbose?.()) {
                    console.log('[EventDataService] running bio connection mirror repair before normalize', {
                        archive: arch,
                        eventCount: this.events?.length
                    });
                }
                window.BioArchiveConnectionsSync.repairMissingMirrorsForBioArchive(this.events, arch);
            }
            this._normalizeSatelliteEventsInPlace();
        }
        if (this._isMainTimelineArchive() && Array.isArray(this.events)) {
            try {
                _migrateAllStoryEventsFilterPlacesToGroupedInPlace(this.events);
            } catch (e) {
                console.warn('EventDataService: pre-save grouped filter migration failed:', e);
            }
        }
        const storageKey = this._getArchiveLocalStorageKey();
        localStorage.setItem(storageKey, JSON.stringify(this.events));
        if (this._isMainTimelineArchive()) {
            this.refreshStoryDockSnapshotFromCurrentEvents();
        }
        console.log('[EventDataService] Events saved to localStorage, count:', this.events.length);
        console.log('[EventDataService] Saved event names:', this.events.map(e => e.name || (e.variants && e.variants[0]?.name) || 'Unnamed'));

        const archForFilterOrder = this.getArchiveSource();
        if (
            typeof window !== 'undefined' &&
            !this._isMainTimelineArchive() &&
            (archForFilterOrder === 'heroes' || archForFilterOrder === 'factions' || archForFilterOrder === 'npcs')
        ) {
            const orderNames = (this.events || [])
                .map((e) => (e && e.name != null ? String(e.name).trim() : ''))
                .filter(Boolean);
            window.dispatchEvent(
                new CustomEvent('atlas-bio-archives-refreshed', {
                    detail: { archives: [archForFilterOrder], orderNames }
                })
            );
        }

        if (!this._isMainTimelineArchive()) {
            const archAfter = this.getArchiveSource();
            if (
                (archAfter === 'heroes' || archAfter === 'factions' || archAfter === 'npcs')
                && typeof window !== 'undefined'
            ) {
                setTimeout(() => {
                    try {
                        const fn = window.CodexCanvasService?.syncCodexEdgesFromBioArchiveConnections;
                        if (typeof fn === 'function') void fn();
                    } catch (e) {
                        console.warn('EventDataService: Codex bio-edge sync skipped', e);
                    }
                }, 400);
            }
        }

        if (!this._canPersistTimelineJsonToRepo()) {
            return;
        }

        // Dev server: also persist to data/*.json via Node server (main timeline + satellite archive JSONs).
        try {
            const isMain = this._isMainTimelineArchive();
            const apiUrl =
                typeof window.resolveDevApiUrl === 'function'
                    ? window.resolveDevApiUrl(isMain ? 'api/events' : 'api/story-archive')
                    : isMain
                        ? '/api/events'
                        : '/api/story-archive';
            const body = isMain
                ? JSON.stringify({ events: this.events })
                : JSON.stringify({ archive: this.getArchiveSource(), events: this.events });

            fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            })
                .then(async (res) => {
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error || `HTTP ${res.status}`);
                    }
                    return res.json().catch(() => ({}));
                })
                .then((data) => {
                    if (isMain) {
                        this.updateStatus(
                            `✓ Saved to src/data/events.json (${data?.eventsCount ?? this.events.length} events)`,
                            'success'
                        );
                    } else {
                        const label = this._getArchiveFilePath().replace(/^src\/data\//, '');
                        this.updateStatus(
                            `✓ Saved to src/data/${label} (${data?.eventsCount ?? this.events.length} entries)`,
                            'success'
                        );
                    }
                })
                .catch((e) => {
                    const target = isMain ? 'src/data/events.json' : this._getArchiveFilePath().replace(/^src\/data\//, '');
                    console.warn(`EventDataService: Failed to persist ${target} via dev API:`, e);
                    this.updateStatus(
                        `Saved locally, but failed to write ${target} (${e?.message || 'API error'}). ` +
                            `Use the project server on port 8000 (node src/server.js), or restart it after pulling new routes.`,
                        'warning'
                    );
                });
        } catch (e) {
            // Ignore API persistence errors; localStorage is still updated.
        }
    }

    /**
     * While a satellite archive is active, main-timeline rows live in the story dock snapshot (`getStoryTimelineEventsForDock`).
     * After editing a dock story event, `saveEvents()` only writes the satellite file — call this to also persist `timelineEvents`
     * (and `src/data/events.json` on the dev server) from that snapshot.
     */
    persistStoryDockTimelineFromSnapshot() {
        if (this._isMainTimelineArchive()) return;
        const dock = this.getStoryTimelineEventsForDock();
        if (!Array.isArray(dock) || dock.length === 0) return;
        try {
            _migrateAllStoryEventsFilterPlacesToGroupedInPlace(dock);
        } catch (e) {
            console.warn('EventDataService: dock snapshot grouped migration skipped:', e);
        }
        try {
            localStorage.setItem('timelineEvents', JSON.stringify(dock));
            console.log('[EventDataService] timelineEvents updated from story dock snapshot', dock.length);
        } catch (e) {
            console.warn('EventDataService: failed to write timelineEvents from dock snapshot', e);
        }
        if (!this._canPersistTimelineJsonToRepo()) return;
        try {
            const apiUrl =
                typeof window.resolveDevApiUrl === 'function'
                    ? window.resolveDevApiUrl('api/events')
                    : '/api/events';
            fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ events: dock })
            })
                .then(async (res) => {
                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data?.error || `HTTP ${res.status}`);
                    }
                    return res.json().catch(() => ({}));
                })
                .then((data) => {
                    this.updateStatus(
                        `✓ Saved story timeline from dock (${data?.eventsCount ?? dock.length} events)`,
                        'success'
                    );
                })
                .catch((e) => {
                    console.warn('EventDataService: Failed to persist dock timeline to src/data/events.json', e);
                });
        } catch (e) {
            /* ignore */
        }
    }

    /**
     * Export events as JSON file
     */
    exportEvents() {
        const dataStr = JSON.stringify({ events: this.events }, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'events-export.json';
        link.click();
        URL.revokeObjectURL(url);
        console.log('EventDataService: Events exported');
    }

    /**
     * Import events from JSON file
     */
    importEvents(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.events && Array.isArray(data.events)) {
                        this.events = data.events;
                        if (!this._isMainTimelineArchive()) {
                            this._normalizeSatelliteEventsInPlace();
                        }
                        this.saveEvents();
                        console.log('EventDataService: Events imported:', this.events.length);
                        resolve({ success: true, count: this.events.length });
                    } else {
                        throw new Error('Invalid file format: expected { events: [...] }');
                    }
                } catch (error) {
                    console.error('EventDataService: Error importing events:', error);
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Find city coordinates by name
     */
    findCityCoordinates(cityName) {
        if (!cityName) return null;

        const searchName = cityName.toLowerCase().trim();

        // Search in cities (exact match first, then partial)
        let city = this.cities.find(c => 
            c.name.toLowerCase() === searchName
        );
        if (!city) {
            // Try partial match
            city = this.cities.find(c => 
                c.name.toLowerCase().includes(searchName) ||
                searchName.includes(c.name.toLowerCase())
            );
        }
        if (city) {
            return { lat: city.lat, lon: city.lon, name: city.name };
        }

        // Search in fictional cities (exact match first, then partial)
        let fictionalCity = this.fictionalCities.find(c => 
            c.name.toLowerCase() === searchName
        );
        if (!fictionalCity) {
            // Try partial match
            fictionalCity = this.fictionalCities.find(c => 
                c.name.toLowerCase().includes(searchName) ||
                searchName.includes(c.name.toLowerCase())
            );
        }
        if (fictionalCity) {
            return { lat: fictionalCity.lat, lon: fictionalCity.lon, name: fictionalCity.name };
        }

        // Search in airports
        const airport = this.airports.find(a => 
            a.name.toLowerCase() === searchName ||
            a.name.toLowerCase().includes(searchName) ||
            searchName.includes(a.name.toLowerCase())
        );
        if (airport) {
            return { lat: airport.lat, lon: airport.lon, name: airport.name };
        }

        // Search in seaports
        const seaport = this.seaports.find(s => 
            s.name.toLowerCase() === searchName ||
            s.name.toLowerCase().includes(searchName) ||
            searchName.includes(s.name.toLowerCase())
        );
        if (seaport) {
            return { lat: seaport.lat, lon: seaport.lon, name: seaport.name };
        }

        return null;
    }

    /**
     * Get display name for a location
     */
    getDisplayName(locationName) {
        return this.displayNames[locationName] || locationName;
    }

    /**
     * Get all events
     */
    getEvents() {
        return this.events;
    }

    /**
     * Set events
     */
    setEvents(events) {
        this.events = events;
    }

    /**
     * Get location data
     */
    getLocationData() {
        return {
            cities: this.cities,
            fictionalCities: this.fictionalCities,
            airports: this.airports,
            seaports: this.seaports,
            heroes: this.heroes,
            factions: this.factions,
            displayNames: this.displayNames
        };
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventDataService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.EventDataService = new EventDataService();
}
