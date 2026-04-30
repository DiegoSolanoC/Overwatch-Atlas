/**
 * EventManager - Handles event management UI and operations
 * Note: Glitch text functionality is now handled by GlitchTextService
 */
class EventManager {
    constructor() {
        // Initialize all services using helper (use global fallback for script tag loading)
        const initializeAllServices = window.EventManagerServiceHelpers?.initializeAllServices || 
            (window.EventManagerConfigHelpers?.initializeServicesFallback || 
            (() => {
                // Fallback if helper not available
                const dataService = window.EventDataService || null;
                return {
                    dataService,
                    renderService: window.EventRenderService || null,
                    locationService: window.LocationService || null,
                    editService: window.EventEditService || null,
                    formService: window.EventFormService || null,
                    dragDropService: window.EventDragDropService || null,
                    listenerService: window.EventListenerService || null,
                    interactionService: window.EventInteractionService || null,
                    initService: window.EventInitService || null,
                    cityLookupService: window.CityLookupService || null,
                    imagePathService: window.ImagePathService || null,
                    globeSyncService: window.GlobeSyncService || null
                };
            }));
        
        const services = initializeAllServices(this);
        
        // Configure services using helper
        const configureServices = window.EventManagerConfigHelpers?.configureServices || 
            ((services, eventManager) => {
                // Fallback configuration
                if (services.renderService) services.renderService.setEventManager(eventManager);
                if (services.locationService) {
                    services.locationService.setDataService(services.dataService);
                    services.locationService.setEventManager(eventManager);
                }
                if (services.editService) services.editService.setEventManager(eventManager);
                if (services.formService) services.formService.setEventManager(eventManager);
                if (services.dragDropService) services.dragDropService.setEventManager(eventManager);
                if (services.listenerService) services.listenerService.setEventManager(eventManager);
                if (services.interactionService) services.interactionService.setEventManager(eventManager);
                if (services.initService) services.initService.setEventManager(eventManager);
                if (services.cityLookupService) services.cityLookupService.setEventManager(eventManager);
                if (services.imagePathService) services.imagePathService.setEventManager(eventManager);
                if (services.globeSyncService) services.globeSyncService.setEventManager(eventManager);
            });
        
        configureServices(services, this);
        Object.assign(this, services);
        
        // UI state
        this.draggedElement = null;
        this.dragOverIndex = null;
        this.unsavedEventIndices = new Set(); // Track which events have unsaved changes
        this.currentPage = 1; // Current page number (1-indexed)
        this.eventsPerPage = 50; // Number of events per page
        this.eventsPerPageSetting = 50; // User-selected events per page (when not showing all)
        this.showAllEventsInManager = false; // If true, show all events in one long page
        this.searchQuery = ''; // Event manager search: filter by title
        this.searchHeroFilters = []; // Hero names (event.filters)
        this.searchFactionFilters = []; // Resolved manifest faction filenames from search tokens (chips use filenames)
        this.searchNpcFilters = []; // NPC names from manifest (event.npcs)
        /** Tokens from hero/faction search field that did not match manifest (matched against event/variant name). */
        this.searchUnmatchedFilterTokens = [];
        this.searchCountryFilters = []; // Flag PNG filenames (FLAG_FILE_BY_COMMON values, e.g. "France.png")
        this.variantData = []; // Store variant data in memory for tab system
        this.activeVariantIndex = 0; // Currently active variant tab
        this.eventItemVariantIndices = new Map(); // Track current variant index for each event item
        this.listenersSetup = false; // Track if listeners have been set up
        this.isOpeningEvent = false; // Flag to prevent panel from closing during event opening
    }

    /**
     * Get events from data service
     */
    get events() {
        return this.dataService ? this.dataService.getEvents() : [];
    }

    /**
     * Hero/faction/NPC dimension: OR within each list. When multiple filter kinds are set, a row
     * matches if it satisfies any of the active kinds (heroes, factions, or NPCs).
     * Country dimension: primary resolved flag or secondaryCountryFlags matches any selected country file.
     */
    _computeSearchAxisMatchesForItem(item) {
        const heroFilters = this.searchHeroFilters || [];
        const factionFilters = this.searchFactionFilters || [];
        const npcFilters = this.searchNpcFilters || [];
        const countryFilters = this.searchCountryFilters || [];
        const rawUnmatched = this.searchUnmatchedFilterTokens || [];
        const unmatchedLower = rawUnmatched.map((t) => String(t || '').trim().toLowerCase()).filter(Boolean);
        const hasU = unmatchedLower.length > 0;
        const itemHeroes = item?.filters || [];
        const itemNpcs = item?.npcs || [];
        const itemFactions = item?.factions || [];
        const hasH = heroFilters.length > 0;
        const hasF = factionFilters.length > 0;
        const hasN = npcFilters.length > 0;
        const heroHit = hasH && heroFilters.some(h => itemHeroes.includes(h));
        const npcHit = hasN && npcFilters.some((n) => itemNpcs.includes(n));
        const fh = typeof window !== 'undefined' && window.FactionMatchHelpers;
        const factionHit = hasF && factionFilters.some((f) =>
            itemFactions.some((itemF) => (fh && typeof fh.factionIdsMatch === 'function')
                ? fh.factionIdsMatch(itemF, f)
                : itemF === f));
        const nameLower = (item?.name || '').toLowerCase();
        const unmatchedHit = hasU && unmatchedLower.every((t) => nameLower.includes(t));
        let matchHeroFaction;
        if (!hasH && !hasF && !hasN && !hasU) {
            matchHeroFaction = true;
        } else {
            const hFnHit = (hasH && heroHit) || (hasF && factionHit) || (hasN && npcHit);
            const parts = [];
            if (hasH || hasF || hasN) parts.push(hFnHit);
            if (hasU) parts.push(unmatchedHit);
            matchHeroFaction = parts.some(Boolean);
        }

        const flagFn = typeof window !== 'undefined' && window.LocationFlagHelpers && typeof window.LocationFlagHelpers.getResolvedFlagFilename === 'function'
            ? window.LocationFlagHelpers.getResolvedFlagFilename
            : null;
        let matchCountry = true;
        if (countryFilters.length > 0 && flagFn) {
            const countrySet = new Set(countryFilters);
            const locName = item?.cityDisplayName ?? '';
            const locType = item?.locationType || 'earth';
            const resolved = flagFn(locName, locType);
            const primaryMatch = !!resolved && countrySet.has(resolved);
            const secondary = item?.secondaryCountryFlags;
            const secondaryMatch = Array.isArray(secondary) && secondary.some((fn) => countrySet.has(fn));
            matchCountry = primaryMatch || secondaryMatch;
        } else if (countryFilters.length > 0) {
            matchCountry = false;
        }
        return { matchHeroFaction, matchCountry };
    }

    /**
     * For list UI: which search axes match this item (variant row). Used for pills / accents when filter and country are both in play.
     */
    getSearchMatchAxesForItem(item) {
        const heroFilters = this.searchHeroFilters || [];
        const factionFilters = this.searchFactionFilters || [];
        const npcFilters = this.searchNpcFilters || [];
        const countryFilters = this.searchCountryFilters || [];
        const hasUnmatched = (this.searchUnmatchedFilterTokens || []).some((t) => String(t || '').trim());
        const filterActive = heroFilters.length > 0 || factionFilters.length > 0 || npcFilters.length > 0 || hasUnmatched;
        const countryActive = countryFilters.length > 0;
        if (!filterActive && !countryActive) {
            return { filterActive: false, countryActive: false, filterHit: false, countryHit: false };
        }
        const { matchHeroFaction, matchCountry } = this._computeSearchAxisMatchesForItem(item);
        return {
            filterActive,
            countryActive,
            filterHit: filterActive && matchHeroFaction,
            countryHit: countryActive && matchCountry
        };
    }

    /**
     * Get events filtered by search query and hero/faction/NPC/country (for event manager list)
     * Title: AND with the rest. Hero/faction/NPC group uses OR between kinds. Filter group vs country: OR when both are non-empty.
     */
    getFilteredEvents() {
        const all = this.events;
        const q = (this.searchQuery || '').trim().toLowerCase();
        const heroFilters = this.searchHeroFilters || [];
        const factionFilters = this.searchFactionFilters || [];
        const npcFilters = this.searchNpcFilters || [];
        const countryFilters = this.searchCountryFilters || [];
        const unmatchedTokens = (this.searchUnmatchedFilterTokens || []).map((t) => String(t || '').trim()).filter(Boolean);
        if (!q && heroFilters.length === 0 && factionFilters.length === 0 && npcFilters.length === 0 && countryFilters.length === 0 && unmatchedTokens.length === 0) {
            return all;
        }
        const filterGroupActive = heroFilters.length > 0 || factionFilters.length > 0 || npcFilters.length > 0 || unmatchedTokens.length > 0;
        const countryGroupActive = countryFilters.length > 0;

        const titleTokens = q ? q.split(/\s+/).filter((t) => t.length > 0) : [];
        const matchesItem = (item) => {
            const name = (item?.name || '').toLowerCase();
            const matchTitle =
                !q
                || (titleTokens.length > 0
                    ? titleTokens.every((t) => name.includes(t))
                    : name.includes(q));
            const { matchHeroFaction, matchCountry } = this._computeSearchAxisMatchesForItem(item);
            let dimPass = true;
            if (filterGroupActive && countryGroupActive) {
                dimPass = matchHeroFaction || matchCountry;
            } else if (filterGroupActive) {
                dimPass = matchHeroFaction;
            } else if (countryGroupActive) {
                dimPass = matchCountry;
            }
            return matchTitle && dimPass;
        };

        return all.filter(event => {
            if (matchesItem(event)) {
                return true;
            }

            if (event?.variants && Array.isArray(event.variants) && event.variants.length > 0) {
                const matchedIndex = event.variants.findIndex(v => matchesItem(v));
                if (matchedIndex !== -1) {
                    const fullIndex = all.indexOf(event);
                    if (fullIndex !== -1 && this.eventItemVariantIndices) {
                        this.eventItemVariantIndices.set(`event-${fullIndex}`, matchedIndex);
                    }
                    return true;
                }
            }
            return false;
        });
    }

    /**
     * Set events in data service
     */
    set events(value) {
        if (this.dataService) {
            this.dataService.setEvents(value);
        }
    }

    // Data getters (consolidated using helper)
    get cities() { return this.dataService?.cities || []; }
    get fictionalCities() { return this.dataService?.fictionalCities || []; }
    get airports() { return this.dataService?.airports || []; }
    get seaports() { return this.dataService?.seaports || []; }
    get heroes() { return this.dataService?.heroes || []; }
    get factions() { return this.dataService?.factions || []; }
    get npcs() { return this.dataService?.npcs || []; }
    get displayNames() { return this.dataService?.displayNames || {}; }

    /**
     * Helper function to update status (if available)
     */
    updateStatus(message, type = 'info') {
        // Check if updateStatus function exists (from test-loader.js or script.js)
        if (typeof window.updateStatus === 'function') {
            window.updateStatus(message, type);
        }
    }

    /**
     * Initialize the event manager (delegates to EventInitService)
     */
    async init() {
        if (this.initService) {
            return await this.initService.init();
        } else {
            console.error('EventManager: EventInitService not available!');
            return Promise.reject(new Error('EventInitService not available'));
        }
    }

    /**
     * Check if we're running on GitHub Pages (delegates to EventDataService)
     */
    isGitHubPages() {
        if (this.dataService) {
            return this.dataService.isGitHubPages();
        }
        const hostname = window.location.hostname;
        // Check for GitHub Pages domains
        return hostname.includes('github.io') || 
               hostname.includes('github.com') ||
               (hostname !== 'localhost' && hostname !== '127.0.0.1' && !hostname.startsWith('192.168.') && !hostname.startsWith('10.') && window.location.protocol !== 'file:');
    }

    async loadLocationsData() {
        if (!this.dataService) throw new Error('EventDataService not available');
        return await this.dataService.loadLocationsData();
    }

    async loadEvents() {
        if (!this.dataService) throw new Error('EventDataService not available');
        const result = await this.dataService.loadEvents();
        if (result?.shouldSync) this.syncEventsToGlobe();
        return result;
    }
    
    
    syncEventsToGlobe() {
        if (this.globeSyncService) {
            this.globeSyncService.syncEventsToGlobe();
        } else if (window.globeController?.dataModel) {
            // Fallback if service not available
            window.globeController.dataModel.events = [...this.events];
            window.globeController.globeView?.refreshEventMarkers();
        }
    }

    saveEvents() {
        this.dataService?.saveEvents();
        this.unsavedEventIndices.clear();
        this.renderEvents();
        const showSaveSuccessFeedback = window.EventManagerUIHelpers?.showSaveSuccessFeedback;
        if (showSaveSuccessFeedback) {
            showSaveSuccessFeedback('saveEventsBtn');
        } else {
            const saveBtn = document.getElementById('saveEventsBtn');
            if (saveBtn) {
                const originalText = saveBtn.textContent;
                saveBtn.textContent = '✓ Saved!';
                saveBtn.style.background = 'rgba(76, 175, 80, 0.8)';
                setTimeout(() => {
                    saveBtn.textContent = originalText;
                    saveBtn.style.background = '';
                }, 2000);
            }
        }
        this.refreshGlobeEvents();
    }
    
    /**
     * Refresh event markers on the globe
     */
    /**
     * Refresh globe events (delegates to GlobeSyncService)
     * @returns {Promise<void>}
     */
    refreshGlobeEvents() {
        if (this.globeSyncService) {
            return this.globeSyncService.refreshGlobeEvents();
        }
        return Promise.resolve();
    }

    exportEvents() {
        this.dataService?.exportEvents();
    }

    async importEvents(file) {
        if (!this.dataService) {
            alert('Error: EventDataService not available');
            return;
        }
        try {
            const result = await this.dataService.importEvents(file);
            if (result.success) {
                this.saveEvents();
                this.renderEvents();
                this.syncEventsToGlobe();
                alert(`Successfully imported ${result.count} events!`);
            }
        } catch (error) {
            console.error('Error importing events:', error);
            alert('Error importing events: ' + error.message);
        }
    }

    findCityCoordinates(cityName) {
        return this.dataService?.findCityCoordinates(cityName) || null;
    }

    setupEventListeners() {
        if (this.listenerService) {
            this.listenerService.setupEventListeners();
        } else {
            console.error('EventManager: EventListenerService not available!');
        }
    }

    /**
     * Render events to the DOM (delegates to EventRenderService)
     */
    renderEvents() {
        if (this.renderService) {
            const displayed = this.getFilteredEvents();
            const perPage = this.showAllEventsInManager ? Math.max(1, displayed.length) : Math.max(1, parseInt(this.eventsPerPageSetting || 50, 10) || 50);
            this.eventsPerPage = perPage; // keep services in sync (pagination listener logic reads this)
            if (this.showAllEventsInManager) {
                this.currentPage = 1;
            }
            const totalPages = Math.max(1, Math.ceil(displayed.length / this.eventsPerPage));
            if (this.currentPage > totalPages) {
                this.currentPage = totalPages;
            }
            this.renderService.renderEvents(
                displayed,
                this.currentPage,
                this.eventsPerPage,
                () => {
                    this.setupDragAndDrop();
                }
            );
            
            // DEV ONLY: Apply red styling to overlap badges after render
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                setTimeout(() => {
                    const eventsManagePanel = document.getElementById('eventsManagePanel');
                    if (eventsManagePanel) {
                        const overlapBadges = eventsManagePanel.querySelectorAll('.event-number-badge--overlap');
                        console.log('[EventManager] Found', overlapBadges.length, 'overlap badges, applying red styling');
                        overlapBadges.forEach((badge) => {
                            badge.style.setProperty('color', '#ff4444', 'important');
                            badge.style.setProperty('text-shadow', '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)', 'important');
                        });
                    }
                }, 150);
            }
        } else {
            console.error('EventManager: EventRenderService not available!');
            this.updateStatus('EventManager: ERROR - EventRenderService not found', 'error');
        }
    }

    applySearchAndRender() {
        this.currentPage = 1;
        this.renderEvents();
    }

    renderPaginationControls() {
        this.renderService?.renderPaginationControls(this.getFilteredEvents(), this.currentPage, this.eventsPerPage);
    }
    
    setupPaginationListeners() {
        this.renderService?.setupPaginationListeners();
    }

    createEventItem(event, index) {
        if (this.renderService) {
            return this.renderService.createEventItem(event, index, this.events);
        }
        console.error('EventManager: EventRenderService not available!');
        return document.createElement('div');
    }
    
    cycleEventVariant(eventIndex, event, itemElement) {
        this.interactionService?.cycleEventVariant(eventIndex, event, itemElement);
    }
    
    resetAllEventVariants() {
        this.interactionService?.resetAllEventVariants();
    }
    
    updateEventItemPreview(eventIndex, event, itemElement, variantIndex) {
        this.interactionService?.updateEventItemPreview(eventIndex, event, itemElement, variantIndex);
    }
    
    openEventFromList(event, index) {
        this.interactionService?.openEventFromList(event, index);
    }

    /**
     * Get location name from coordinates (delegates to LocationService)
     */
    getLocationName(lat, lon) {
        if (this.locationService) {
            return this.locationService.getLocationName(
                lat, 
                lon, 
                this.cities, 
                this.fictionalCities, 
                this.airports, 
                this.seaports
            );
        }
        return null;
    }

    /**
     * Enhance location name with country (delegates to LocationService)
     */
    async enhanceLocationWithCountry(lat, lon, cityName) {
        if (this.locationService) {
            return await this.locationService.enhanceLocationWithCountry(lat, lon, cityName);
        }
    }

    /**
     * Update location display in the UI (delegates to LocationService)
     */
    updateLocationDisplay(lat, lon, locationName) {
        if (this.locationService) {
            this.locationService.updateLocationDisplay(lat, lon, locationName);
        }
    }

    /**
     * Reverse geocode coordinates (delegates to LocationService)
     */
    async reverseGeocode(lat, lon) {
        if (this.locationService) {
            return await this.locationService.reverseGeocode(lat, lon);
        }
        return null;
    }

    /**
     * Setup drag and drop functionality (delegates to EventDragDropService)
     */
    setupDragAndDrop() {
        if (this.dragDropService) {
            this.dragDropService.setupDragAndDrop();
        }
    }

    /**
     * Get element after which to insert dragged element (delegates to EventDragDropService)
     */
    getDragAfterElement(container, y) {
        if (this.dragDropService) {
            return this.dragDropService.getDragAfterElement(container, y);
        }
        return null;
    }

    /**
     * Reorder events (delegates to EventDragDropService)
     */
    reorderEvents(fromIndex, toIndex) {
        if (this.dragDropService) {
            this.dragDropService.reorderEvents(fromIndex, toIndex);
        }
    }

    /**
     * Delete event
     * @returns {boolean} true if the user confirmed and the event was removed
     */
    deleteEvent(index) {
        // Prevent deletion on GitHub Pages
        if (this.isGitHubPages()) {
            console.log('Event deletion is disabled on GitHub Pages');
            return false;
        }

        const eventName = this.events[index]?.name || (this.events[index]?.variants?.[0]?.name) || 'this event';
        if (!confirm(`Are you sure you want to delete "${eventName}"?`)) {
            return false;
        }
        if (this.editService) {
            const result = this.editService.deleteEvent(index);
            if (result.success) {
                this.currentPage = result.newCurrentPage;
                this.renderEvents();
                this.refreshGlobeEvents();
                return true;
            }
        } else {
            console.error('EventManager: EventEditService not available!');
        }
        return false;
    }

    /**
     * Create an empty Earth event at 0°, 0°, append it to the end of the list, refresh the globe,
     * jump the manager to the page that shows it, then open it like a list click (info panel; use Edit for inline form).
     */
    addBlankEventAndOpen() {
        if (this.isGitHubPages()) return;
        if (!this.editService) {
            console.error('EventManager: EventEditService not available');
            return;
        }

        this.searchQuery = '';
        this.searchHeroFilters = [];
        this.searchFactionFilters = [];
        this.searchNpcFilters = [];
        this.searchUnmatchedFilterTokens = [];
        this.searchCountryFilters = [];

        const blank = {
            name: '',
            description: '',
            locationType: 'earth',
            lat: 0,
            lon: 0,
            filters: [],
            factions: [],
            npcs: [],
            image: ''
        };

        const result = this.editService.addEvent(blank, null);
        if (!result.success) return;

        const newIndex = result.newIndex;
        const event = this.events[newIndex];

        const displayed = this.getFilteredEvents();
        const pos = displayed.indexOf(event);
        const perPage = this.showAllEventsInManager
            ? Math.max(1, displayed.length)
            : Math.max(1, parseInt(this.eventsPerPageSetting || 50, 10) || 50);
        this.eventsPerPage = perPage;
        if (this.showAllEventsInManager) {
            this.currentPage = 1;
        } else if (pos >= 0) {
            this.currentPage = Math.max(1, Math.ceil((pos + 1) / perPage));
        } else {
            this.currentPage = result.newCurrentPage;
        }

        this.renderEvents();

        const open = () => {
            if (this.openEventFromList) {
                this.openEventFromList(event, newIndex);
            }
        };

        const p = this.refreshGlobeEvents();
        if (p && typeof p.then === 'function') {
            p.then(open).catch(open);
        } else {
            requestAnimationFrame(open);
        }
    }

    /** Info-panel inline editor: city lookup with slide field ids */
    async lookupCitySlide() {
        return await this.cityLookupService?.lookupCity({
            cityId: 'eventSlideEditCityLookup',
            latId: 'eventSlideEditLat',
            lonId: 'eventSlideEditLon',
            displayNameId: 'eventSlideEditCityDisplayName',
            lookupBtnId: 'eventSlideLookupCityBtn',
            useCodeLookupId: 'eventSlideUseCodeLookup',
        });
    }
    async geocodeCity(cityName) { return await this.cityLookupService?.geocodeCity(cityName) || null; }

    // ImagePathService delegation
    getEventImagePath(eventName, providedPath) {
        return this.imagePathService?.getEventImagePath(eventName, providedPath) || null;
    }

    /**
     * Readable faction token for Event Manager hero/faction search field (matches parseFilterTokens).
     */
    getFactionDisplayTokenForSearch(filename) {
        const fn = String(filename || '').trim();
        if (!fn) return '';
        const nk = fn.toLowerCase();
        const factions = this.factions || [];
        const f = factions.find((x) => String(x?.filename || '').toLowerCase() === nk);
        if (f?.displayName) return String(f.displayName).trim();
        const base = fn.replace(/\.png$/i, '').replace(/^\d+/, '').replace(/_/g, ' ').trim();
        return base || fn;
    }

    /**
     * FLAG_FILE_BY_COMMON value (e.g. France.png) → common name key for country search input.
     */
    flagFilenameToCommonCountryName(flagFile) {
        const file = String(flagFile || '').trim();
        if (!file) return null;
        const map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
        if (!map) return null;
        for (const common of Object.keys(map).sort()) {
            if (map[common] === file) return common;
        }
        return null;
    }

    /**
     * Prepend one hero / faction / country token to the Event Manager search inputs (deduped) and apply search.
     * Only pass one of heroName, factionFilename, npcName, countryFlagFilename per call.
     */
    prependEventManagerSearchTokens({ heroName, factionFilename, npcName, countryFlagFilename } = {}) {
        const filtersInput = document.getElementById('eventsSearchFilters');
        const countryInput = document.getElementById('eventsSearchCountry');
        if (!filtersInput) return;

        const prependToCommaList = (current, token) => {
            const t = String(token || '').trim();
            if (!t) return String(current || '').trim();
            const parts = String(current || '').split(',').map((s) => s.trim()).filter(Boolean);
            const tl = t.toLowerCase();
            const rest = parts.filter((p) => p.toLowerCase() !== tl);
            return [t, ...rest].join(', ');
        };

        /** Normalize list so it always ends with ", " for continued typing / autocomplete. */
        const withTrailingCommaSpace = (value) => {
            let v = String(value || '').trim();
            if (!v) return '';
            v = v.replace(/,\s*$/, '').trim();
            if (!v) return '';
            return `${v}, `;
        };

        if (heroName) {
            const h = String(heroName).trim();
            if (h) filtersInput.value = withTrailingCommaSpace(prependToCommaList(filtersInput.value, h));
        }
        if (factionFilename) {
            const tok = this.getFactionDisplayTokenForSearch(factionFilename);
            if (tok) filtersInput.value = withTrailingCommaSpace(prependToCommaList(filtersInput.value, tok));
        }
        if (npcName) {
            const n = String(npcName).trim();
            if (n) filtersInput.value = withTrailingCommaSpace(prependToCommaList(filtersInput.value, n));
        }
        if (countryFlagFilename && countryInput) {
            const common = this.flagFilenameToCommonCountryName(countryFlagFilename)
                || String(countryFlagFilename).replace(/\.png$/i, '').trim();
            if (common) {
                countryInput.value = withTrailingCommaSpace(prependToCommaList(countryInput.value, common));
            }
        }

        if (typeof window !== 'undefined') {
            window.__eventsFiltersInputBypassSelectionSync = true;
        }
        try {
            filtersInput.dispatchEvent(new Event('input', { bubbles: true }));
            if (countryInput) countryInput.dispatchEvent(new Event('input', { bubbles: true }));
        } finally {
            if (typeof window !== 'undefined') {
                delete window.__eventsFiltersInputBypassSelectionSync;
            }
        }
    }

    /**
     * Open the Event Manager panel (same net effect as toggle when closed).
     */
    openEventsManagePanel() {
        const panel = document.getElementById('eventsManagePanel');
        const toggle = document.getElementById('eventsManageToggle');
        if (!panel) return;

        if (!panel.classList.contains('open')) {
            const musicPanel = document.getElementById('musicPanel');
            const musicButton = document.getElementById('musicToggle');
            if (musicPanel?.classList.contains('open')) {
                musicPanel.classList.remove('open');
                musicButton?.classList.remove('active');
            }
            const filtersPanel = document.getElementById('filtersPanel');
            const filtersButton = document.getElementById('filtersToggle');
            if (filtersPanel?.classList.contains('open')) {
                filtersPanel.classList.remove('open');
                filtersButton?.classList.remove('active');
            }
            if (window.SoundEffectsManager?.play) {
                window.SoundEffectsManager.play('eventManager');
            }
            panel.classList.add('open');
            toggle?.classList.add('active');
            try {
                window.SummaryInfoBadge?.hide();
            } catch (_) {}
            this.renderService?.requestPageEntranceAnimation?.();
        }
        this.renderEvents();
    }
}

// Initialize EventManager when DOM is ready
if (typeof window !== 'undefined') {
    window.EventManager = EventManager;
}

