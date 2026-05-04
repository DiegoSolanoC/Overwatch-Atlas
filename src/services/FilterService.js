/**
 * FilterService - Manages filter panel UI and coordination
 * Coordinates between FilterStateManager, FilterImageService, and UI components
 * Refactored to follow Single Responsibility Principle
 */

class FilterService {
    constructor(stateManager = null, imageService = null, globeController = null, soundManager = null) {
        this.initialized = false;
        this.heroes = [];
        this.factions = [];
        this.npcs = [];
        this.countries = [];
        this.currentFilterType = 'heroes'; // 'heroes' | 'factions' | 'npcs' | 'countries'
        this.buttonCache = {
            heroes: null,
            factions: null,
            npcs: null,
            countries: null,
            music: null
        };
        
        // Dependencies (injected for testability, fallback to globals)
        // NOTE: Removed all sceneModel.activeFilters dependencies - use standaloneActiveFilters only
        this.stateManager = stateManager || new (window.FilterStateManager || class {
            constructor() { this.selectedFilters = new Set(); }
            getConfirmedFilters() {
                // Use standaloneActiveFilters instead of sceneModel.activeFilters
                if (typeof window !== 'undefined' && window.standaloneActiveFilters) {
                    return new Set(window.standaloneActiveFilters);
                }
                return new Set();
            }
            resetToConfirmed() {
                const confirmed = this.getConfirmedFilters();
                this.selectedFilters.clear();
                confirmed.forEach(f => this.selectedFilters.add(f));
            }
            clear() { this.selectedFilters.clear(); }
            add(f) { this.selectedFilters.add(f); }
            remove(f) { this.selectedFilters.delete(f); }
            has(f) { return this.selectedFilters.has(f); }
            toArray() { return Array.from(this.selectedFilters); }
            getCounts() {
                const SM = window.FilterStateManager;
                if (SM && SM.prototype && typeof SM.prototype.getCounts === 'function') {
                    return SM.prototype.getCounts.call(this);
                }
                let heroCount = 0, factionCount = 0, npcCount = 0, countryCount = 0;
                this.selectedFilters.forEach((f) => {
                    const s = String(f ?? '');
                    if (s.startsWith('country:')) {
                        countryCount++;
                    } else if (/^\d+/.test(s)) {
                        factionCount++;
                    } else {
                        heroCount++;
                    }
                });
                return { heroCount, factionCount, npcCount, countryCount };
            }
            applyToScene() {
                // Apply to standalone state instead of sceneModel
                if (typeof window !== 'undefined' && window.standaloneActiveFilters) {
                    window.standaloneActiveFilters = new Set(this.selectedFilters);
                }
            }
        })();
        
        this.imageService = imageService || new (window.FilterImageService || class {
            generateCacheBuster() { return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }
            buildImagePath(item, type, folder) {
                if (type === 'factions') {
                    return `${folder}/${encodeURIComponent(item.filename)}.png`;
                } else if (type === 'countries') {
                    const fn = (item && item.flagFile != null) ? String(item.flagFile).trim() : '';
                    if (!fn) return `${folder}/`;
                    return `${folder}/${fn.split('/').map((s) => encodeURIComponent(s)).join('/')}`;
                } else if (type === 'music') {
                    const iconName = item.filename.replace(/\.(mp3|wav|ogg)$/i, '');
                    return `assets/images/music/${encodeURIComponent(iconName)}.png`;
                } else {
                    return `${folder}/${encodeURIComponent(item)}.png`;
                }
            }
            createImageElement(imagePath, type, filterKey, folder) {
                const img = new Image();
                img.src = `${imagePath}?v=${this.generateCacheBuster()}`;
                img.alt = filterKey;
                return img;
            }
            preloadImages(items, type, folder) {
                // Simplified fallback
                items.forEach(item => {
                    const img = new Image();
                    img.src = `${this.buildImagePath(item, type, folder)}?v=${this.generateCacheBuster()}`;
                });
            }
        })();
        
        this.globeController = globeController || window.globeController;
        this.soundManager = soundManager || window.SoundEffectsManager;
        
        // DOM elements (will be set in init)
        this.filtersButton = null;
        this.filtersPanel = null;
        this.filtersPanelClose = null;
        this.filtersGrid = null;
        this.clearFiltersBtn = null;
        this.confirmFiltersBtn = null;
        this.heroesTab = null;
        this.factionsTab = null;
        this.npcsTab = null;
        this.countriesTab = null;
        this.filtersMenuSearchInput = null;
        this._panelExclusivityObserver = null;
        this._enforcingPanelExclusivity = false;
    }
    
    init() {
        // Prevent double initialization
        if (this.initialized) {
            console.log('Filters panel already initialized, skipping...');
            return;
        }
        
        // Get DOM elements
        this.filtersButton = document.getElementById('filtersToggle');
        this.filtersPanel = document.getElementById('filtersPanel');
        this.filtersPanelClose = document.getElementById('filtersPanelClose');
        this.filtersGrid = document.getElementById('filtersGrid');
        this.clearFiltersBtn = document.getElementById('clearFiltersBtn');
        this.confirmFiltersBtn = document.getElementById('confirmFiltersBtn');
        this.heroesTab = document.getElementById('heroesTab');
        this.factionsTab = document.getElementById('factionsTab');
        this.npcsTab = document.getElementById('npcsTab');
        this.countriesTab = document.getElementById('countriesTab');
        this.filtersMenuSearchInput = document.getElementById('filtersMenuSearch');
        
        console.log('Initializing filters panel...');
        console.log('Filters button:', this.filtersButton);
        console.log('Filters panel:', this.filtersPanel);
        console.log('Filters grid:', this.filtersGrid);
        
        if (!this.filtersButton || !this.filtersPanel || !this.filtersGrid) {
            // Elements not found - this is expected if Events component hasn't loaded yet
            // Don't log as error, just return silently
            return;
        }
        
        // Mark as initialized
        this.initialized = true;
        this._setupPanelExclusivityObserver();
        
        // Initialize with confirmed filters
        this.resetToConfirmedFilters();
        
        // Load manifest and setup (async)
        this.loadManifest().then(() => {
            // Setup tab switching
            this.setupTabs();

            // Setup button handlers
            this.setupButtons();
            this._setupSearchHandlers();

            if (!this._onAtlasBioArchivesRefreshedForFilters) {
                this._onAtlasBioArchivesRefreshedForFilters = (ev) => {
                    const d = ev && ev.detail ? ev.detail : {};
                    const orderNames = Array.isArray(d.orderNames) ? d.orderNames : null;
                    const archives = Array.isArray(d.archives) ? d.archives : [];
                    const H = typeof window !== 'undefined' ? window.FilterArchiveOrderHelpers : null;

                    const repaintCurrentFilterTab = () => {
                        const type = this.currentFilterType || 'heroes';
                        if (type === 'heroes') {
                            this.createFilterButtons(this.heroes, 'heroes', 'assets/images/heroes');
                        } else if (type === 'factions') {
                            this.createFilterButtons(this.factions, 'factions', 'assets/images/factions');
                        } else if (type === 'npcs') {
                            this.createFilterButtons(this.npcs, 'npcs', 'assets/images/npcs');
                        } else if (type === 'countries') {
                            this.createFilterButtons(this.countries, 'countries', 'assets/images/flags');
                        }
                        if (typeof this._applyCurrentCategorySearch === 'function') {
                            this._applyCurrentCategorySearch();
                        }
                        if (typeof this.updateButtonStates === 'function') {
                            this.updateButtonStates();
                        }
                    };

                    this.buttonCache.heroes = null;
                    this.buttonCache.factions = null;
                    this.buttonCache.npcs = null;
                    if (typeof window !== 'undefined' && window.FilterButtonHelpers?.invalidateArchiveLayoutFileCaches) {
                        window.FilterButtonHelpers.invalidateArchiveLayoutFileCaches();
                    }

                    if (
                        orderNames &&
                        orderNames.length &&
                        archives.length &&
                        H &&
                        typeof H.orderHeroOrNpcIdsByArchive === 'function' &&
                        typeof H.orderFactionsByArchive === 'function'
                    ) {
                        for (const arch of archives) {
                            if (arch === 'heroes') {
                                this.heroes = H.orderHeroOrNpcIdsByArchive(this.heroes, orderNames);
                            } else if (arch === 'npcs') {
                                this.npcs = H.orderHeroOrNpcIdsByArchive(this.npcs, orderNames);
                            } else if (arch === 'factions') {
                                this.factions = H.orderFactionsByArchive(this.factions, orderNames);
                            }
                        }
                        repaintCurrentFilterTab();
                        return;
                    }

                    this.loadManifest().then(() => repaintCurrentFilterTab());
                };
                window.addEventListener(
                    'atlas-bio-archives-refreshed',
                    this._onAtlasBioArchivesRefreshedForFilters
                );
            }
        });
    }
    
    /**
     * Reset initialization state - call when event system is unloaded
     * This allows FilterService to be re-initialized on next load
     */
    reset() {
        console.log('[FilterService] Resetting initialization state...');
        if (this._panelExclusivityObserver) {
            try {
                this._panelExclusivityObserver.disconnect();
            } catch (_) {}
            this._panelExclusivityObserver = null;
        }
        this._enforcingPanelExclusivity = false;
        if (this._onAtlasBioArchivesRefreshedForFilters) {
            try {
                window.removeEventListener(
                    'atlas-bio-archives-refreshed',
                    this._onAtlasBioArchivesRefreshedForFilters
                );
            } catch (_) {}
            this._onAtlasBioArchivesRefreshedForFilters = null;
        }
        this.initialized = false;
        this.filtersButton = null;
        this.filtersPanel = null;
        this.filtersPanelClose = null;
        this.filtersGrid = null;
        this.clearFiltersBtn = null;
        this.confirmFiltersBtn = null;
        this.heroesTab = null;
        this.factionsTab = null;
        this.npcsTab = null;
        this.countriesTab = null;
        this.filtersMenuSearchInput = null;
        this.buttonCache = {
            heroes: null,
            factions: null,
            npcs: null,
            countries: null,
            music: null
        };
        console.log('[FilterService] Reset complete. initialized =', this.initialized);
    }

    _enforcePanelExclusivity() {
        if (this._enforcingPanelExclusivity) return;
        this._enforcingPanelExclusivity = true;
        try {
            const filtersPanel = document.getElementById('filtersPanel');
            const eventSlide = document.getElementById('eventSlide');
            const filtersToggle = document.getElementById('filtersToggle');
            const filtersOpen = !!filtersPanel?.classList.contains('open');
            const eventOpen = !!eventSlide?.classList.contains('open');
            if (filtersOpen && eventOpen) {
                // Prefer the panel that just changed to open:
                // if filters are open, close event info by default.
                eventSlide.classList.remove('open');
                // Keep image overlay in sync when Event Info is auto-closed.
                const overlay = document.getElementById('eventImageOverlay');
                if (overlay) {
                    overlay.classList.remove('open', 'slide-open', 'fade-in', 'fade-out');
                    overlay.style.display = 'none';
                    overlay.style.opacity = '0';
                }
                const eventImage = document.getElementById('eventImage');
                if (eventImage) {
                    eventImage.style.display = 'none';
                }
                try {
                    if (window.standaloneEventSlide?.hideImageOverlay) {
                        window.standaloneEventSlide.hideImageOverlay();
                    } else if (window.globeController?.uiView?.hideImageOverlay) {
                        window.globeController.uiView.hideImageOverlay();
                    }
                } catch (_) {}
            }
            // Keep toggle visual state coherent with actual panel state.
            if (filtersToggle) {
                filtersToggle.classList.toggle('active', !!filtersPanel?.classList.contains('open'));
            }
        } finally {
            this._enforcingPanelExclusivity = false;
        }
    }

    _setupPanelExclusivityObserver() {
        if (this._panelExclusivityObserver) return;
        const filtersPanel = document.getElementById('filtersPanel');
        const eventSlide = document.getElementById('eventSlide');
        if (!filtersPanel || !eventSlide || typeof MutationObserver === 'undefined') return;
        const onChange = () => this._enforcePanelExclusivity();
        this._panelExclusivityObserver = new MutationObserver(onChange);
        this._panelExclusivityObserver.observe(filtersPanel, { attributes: true, attributeFilter: ['class'] });
        this._panelExclusivityObserver.observe(eventSlide, { attributes: true, attributeFilter: ['class'] });
        // Enforce immediately in case both are already open.
        this._enforcePanelExclusivity();
    }
    
    /**
     * Get sceneModel from globeController.
     * Always prefers the latest global window.globeController so we don't
     * depend on construction-time load order.
     */
    getSceneModel() {
        const globeController =
            this.globeController ||
            (typeof window !== 'undefined' ? window.globeController : null);
        return globeController?.sceneModel || null;
    }

    /**
     * Detect if running in Event System mode (uses standaloneActiveFilters)
     * Event System mode is active when standaloneActiveFilters exists
     * NOTE: This now returns true even when globe is loaded, so Event System
     * filters are always used as the source of truth
     */
    isStandaloneMode() {
        return typeof window !== 'undefined' && 
               window.standaloneActiveFilters instanceof Set;
    }

    /**
     * Apply filters to standalone mode (Event System Load Out)
     * Updates standaloneActiveFilters and refreshes pagination UI
     * Also syncs to globe markers if globe is loaded
     */
    applyFiltersToStandalone() {
        const selectedFilters = Array.from(this.stateManager.selectedFilters);
        
        // Copy selected filters to standalone state
        if (window.standaloneActiveFilters) {
            window.standaloneActiveFilters = new Set(this.stateManager.selectedFilters);
        }
        
        // Log filter confirmation with current page matches
        this._logFilterStateWithMatches('🔵 CONFIRM', selectedFilters);
        
        // Update pagination thumbnails if the function is available
        if (typeof window.updateStandalonePaginationForFilters === 'function') {
            window.updateStandalonePaginationForFilters();
        }
        
        // This ensures thumbnails properly reflect filter state after cloning
        if (window.standaloneEventSlide?.updatePaginationUI) {
            window.standaloneEventSlide.updatePaginationUI();
        }
        
        // If globe is loaded with EventMarkerManager, refresh globe markers to apply filters
        if (window.globeEventMarkerManager) {
            window.globeEventMarkerManager.applyFilters();
        } else if (window.globeController?.eventMarkerManager) {
            window.globeController.eventMarkerManager.applyFilters();
        }
        
        // Apply filter state to Codex nodes
        if (typeof window.applyCodexFilterState === 'function') {
            window.applyCodexFilterState();
        }
        if (typeof window.syncFiltersPanelTrapIcon === 'function') {
            window.syncFiltersPanelTrapIcon();
        }
        if (typeof window.LocationFlagHelpers?.scheduleApplyRelevancyRowFilterHighlight === 'function') {
            window.LocationFlagHelpers.scheduleApplyRelevancyRowFilterHighlight();
        }
    }
    
    /**
     * Helper to log filter state and matching events on current page
     */
    _logFilterStateWithMatches(label, filters) {
        const events = window.eventManager?.events || [];
        const activeFilters = new Set(filters);
        const eventsPerPage = 10;
        
        // Get current page
        const currentPage = window.standaloneEventSlide?.currentPage || 1;
        const pageStart = (currentPage - 1) * eventsPerPage;
        const pageEnd = Math.min(pageStart + eventsPerPage, events.length);
        
        // Find matching events on current page
        const matchingIndices = [];
        for (let i = pageStart; i < pageEnd; i++) {
            const event = events[i];
            if (event && typeof window.shouldEventBeLocked === 'function') {
                const isLocked = window.shouldEventBeLocked(event, activeFilters);
                if (!isLocked) {
                    matchingIndices.push((i % eventsPerPage) + 1); // 1-based index on page
                }
            }
        }
        
        const filterStr = filters.length > 0 ? `[${filters.join(', ')}]` : '[]';
        const matchStr = matchingIndices.length > 0 ? `[${matchingIndices.join(', ')}]` : '[]';
        
        console.log(`[FILTERS] ${label}: ${filterStr} | Page ${currentPage} matches: ${matchStr}`);
    }
    
    /**
     * Reset selectedFilters to confirmed state and update button states
     * NOTE: Removed globe mode - only uses standaloneActiveFilters
     */
    resetToConfirmedFilters() {
        let newSelected = [];
        
        // Use standaloneActiveFilters as the "confirmed" state
        if (window.standaloneActiveFilters) {
            newSelected = Array.from(window.standaloneActiveFilters);
            this.stateManager.selectedFilters = new Set(window.standaloneActiveFilters);
        } else {
            this.stateManager.selectedFilters.clear();
        }
        
        // Log reset with current page matches
        this._logFilterStateWithMatches('🔄 RESET', newSelected);
        
        this.updateButtonStates();
        this.updateFilterCounts();
    }
    
    /**
     * Update visual states of filter buttons based on selectedFilters
     */
    updateButtonStates() {
        if (!this.filtersGrid) return;
        
        const allButtons = this.filtersGrid.querySelectorAll('.filter-btn');
        allButtons.forEach(btn => {
            const filterKey = btn.dataset.filterKey;
            if (filterKey) {
                if (this.stateManager.has(filterKey)) {
                    btn.classList.add('selected');
                } else {
                    btn.classList.remove('selected');
                }
            }
        });
        if (typeof window.syncFiltersPanelTrapIcon === 'function') {
            window.syncFiltersPanelTrapIcon();
        }
    }
    
    // Load manifest - delegates to helper
    async loadManifest() {
        // Rebuild filter chips from manifest; cached nodes keep stale dataset.filterKey after manifest edits
        this.buttonCache.heroes = null;
        this.buttonCache.factions = null;
        this.buttonCache.npcs = null;
        this.buttonCache.countries = null;
        if (typeof window !== 'undefined' && window.FilterButtonHelpers?.invalidateArchiveLayoutFileCaches) {
            window.FilterButtonHelpers.invalidateArchiveLayoutFileCaches();
        }

        const helper = window.FilterManifestHelpers?.loadManifest;
        if (helper) {
            const result = await helper(
                (items, type, folder) => this.createFilterButtons(items, type, folder),
                () => this.updateFilterCounts(),
                (items, type, folder) => this.preloadImages(items, type, folder),
                this.factions
            );
            this.heroes = result.heroes;
            this.factions = result.factions;
            this.npcs = result.npcs || [];
            this._initCountryFilterItems();
        } else {
            // Fallback implementation
            try {
                const cacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const response = await fetch(`manifest.json?v=${cacheBuster}`, {
                    cache: 'no-store',
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        'Pragma': 'no-cache'
                    }
                });
                const manifest = await response.json();
                let heroes = manifest.heroes ? [...manifest.heroes] : [];
                let npcs = manifest.npcs ? [...manifest.npcs] : [];
                let factions = manifest.factions
                    ? [...manifest.factions].map((f) => ({
                          filename: f.filename,
                          displayName: f.displayName
                      }))
                    : [];
                try {
                    const modUrl = new URL(
                        'src/services/helpers/FilterArchiveOrderHelpers.js',
                        document.baseURI
                    ).href;
                    const orderMod = await import(modUrl);
                    if (orderMod && typeof orderMod.applyStoryArchiveOrderFromNetwork === 'function') {
                        const o = await orderMod.applyStoryArchiveOrderFromNetwork(heroes, factions, npcs);
                        heroes = o.heroes;
                        factions = o.factions;
                        npcs = o.npcs;
                    }
                } catch (e) {
                    console.warn('FilterService: story-archive filter order unavailable', e);
                    heroes.sort((a, b) =>
                        String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
                    );
                    npcs.sort((a, b) =>
                        String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
                    );
                    factions.sort((a, b) =>
                        String(a.displayName || '').localeCompare(String(b.displayName || ''), undefined, {
                            sensitivity: 'base',
                            numeric: true
                        })
                    );
                }
                this.heroes = heroes;
                this.npcs = npcs;
                this.factions = factions;
                this._initCountryFilterItems();
                this.createFilterButtons(this.heroes, 'heroes', 'assets/images/heroes');
                this.updateFilterCounts();
                if (this.factions.length > 0) {
                    setTimeout(() => this.preloadImages(this.factions, 'factions', 'assets/images/factions'), 500);
                }
                if (this.npcs.length > 0) {
                    setTimeout(() => this.preloadImages(this.npcs, 'npcs', 'assets/images/npcs'), 650);
                }
            } catch (error) {
                console.error('Error loading manifest.json:', error);
                this.heroes = [];
                this.factions = [];
                this.npcs = [];
                this._initCountryFilterItems();
                this.createFilterButtons(this.heroes, 'heroes', 'assets/images/heroes');
            }
        }
    }

    _initCountryFilterItems() {
        const map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
        if (!map) {
            this.countries = [];
            return;
        }
        this.countries = Object.keys(map)
            .map((commonName) => ({ commonName, flagFile: map[commonName] }))
            .sort((a, b) => a.commonName.localeCompare(b.commonName));
    }
    
    /**
     * Update filter counts display - delegates to helper
     */
    async updateFilterCounts() {
        let helper = window.FilterCountHelpers?.updateFilterCounts;
        
        // If helper not available, try to load it dynamically
        if (!helper) {
            try {
                const module = await import('./helpers/FilterCountHelpers.js');
                helper = module.updateFilterCounts;
                // Cache it for next time
                if (!window.FilterCountHelpers) window.FilterCountHelpers = {};
                window.FilterCountHelpers.updateFilterCounts = helper;
            } catch (error) {
                // Silently fall through to fallback - helpers may be loading via script tags
            }
        }
        
        if (helper) {
            helper(this.stateManager);
        } else {
            // Fallback implementation
            const heroesCount = document.getElementById('heroesCount');
            const factionsCount = document.getElementById('factionsCount');
            const { heroCount, factionCount, npcCount = 0, countryCount = 0 } = this.stateManager.getCounts();
            const npcsCount = document.getElementById('npcsCount');
            const countriesCount = document.getElementById('countriesCount');
            
            if (heroesCount) {
                if (heroCount > 0) {
                    heroesCount.textContent = heroCount;
                    heroesCount.style.display = 'inline';
                } else {
                    heroesCount.style.display = 'none';
                }
            }
            if (factionsCount) {
                if (factionCount > 0) {
                    factionsCount.textContent = factionCount;
                    factionsCount.style.display = 'inline';
                } else {
                    factionsCount.style.display = 'none';
                }
            }
            if (npcsCount) {
                if (npcCount > 0) {
                    npcsCount.textContent = npcCount;
                    npcsCount.style.display = 'inline';
                } else {
                    npcsCount.style.display = 'none';
                }
            }
            if (countriesCount) {
                if (countryCount > 0) {
                    countriesCount.textContent = countryCount;
                    countriesCount.style.display = 'inline';
                } else {
                    countriesCount.style.display = 'none';
                }
            }
        }
    }
    
    /**
     * Preload images using FilterImageService
     */
    preloadImages(items, type, folder) {
        this.imageService.preloadImages(items, type, folder);
    }
    
    /**
     * Create filter buttons (with caching) - delegates to helper
     */
    async createFilterButtons(items, type, folder) {
        let helper = window.FilterButtonHelpers?.createFilterButtons;
        
        // If helper not available, try to load it dynamically (but don't error if it fails)
        if (!helper) {
            try {
                const module = await import('./helpers/FilterButtonHelpers.js');
                helper = module.createFilterButtons;
                // Cache it for next time
                if (!window.FilterButtonHelpers) window.FilterButtonHelpers = {};
                window.FilterButtonHelpers.createFilterButtons = helper;
            } catch (error) {
                // Silently return - helpers may be loading via script tags
                return;
            }
        }
        
        if (helper) {
            // Heroes / Factions filter tabs always use archive-style section headers + order,
            // even when the Event Manager is on the main story list (rows come from LS or JSON snapshot).
            const groupFactionsByArchiveType = type === 'factions';
            const groupHeroesByArchiveRole = type === 'heroes';
            if (groupFactionsByArchiveType || groupHeroesByArchiveRole) {
                const ensure = window.FilterButtonHelpers?.ensureArchiveLayoutSnapshotsForFilter;
                if (typeof ensure === 'function') {
                    if (groupHeroesByArchiveRole) await ensure('heroes');
                    if (groupFactionsByArchiveType) await ensure('factions');
                }
            }
            helper(
                items, type, folder,
                this.filtersGrid, this.buttonCache,
                this.stateManager, this.imageService, this.soundManager,
                this.heroes, this.factions, this.npcs, this.countries,
                (itemsPre, typePre, folderPre) => this.preloadImages(itemsPre, typePre, folderPre),
                () => this.updateFilterCounts(),
                groupFactionsByArchiveType,
                groupHeroesByArchiveRole
            );
            this._applyCurrentCategorySearch();
        }
    }

    /**
     * Invalidate cached Heroes / Factions filter DOM and JSON snapshots when switching bio archives
     * or when grouped chip layout must rebuild from disk / localStorage.
     */
    invalidateBioArchiveFilterLayouts() {
        if (typeof window !== 'undefined' && window.FilterButtonHelpers?.invalidateArchiveLayoutFileCaches) {
            window.FilterButtonHelpers.invalidateArchiveLayoutFileCaches();
        }
        this.buttonCache.factions = null;
        this.buttonCache.heroes = null;
        if (!this.initialized || !this.filtersGrid) {
            return;
        }
        const t = this.currentFilterType;
        if (t === 'factions') {
            void this.createFilterButtons(this.factions, 'factions', 'assets/images/factions');
        } else if (t === 'heroes') {
            void this.createFilterButtons(this.heroes, 'heroes', 'assets/images/heroes');
        } else {
            return;
        }
        if (typeof this._applyCurrentCategorySearch === 'function') {
            this._applyCurrentCategorySearch();
        }
        if (typeof this.updateButtonStates === 'function') {
            this.updateButtonStates();
        }
        void this.updateFilterCounts();
    }

    _searchPlaceholderForType(type) {
        if (type === 'factions') return 'Search factions...';
        if (type === 'npcs') return 'Search NPCs...';
        if (type === 'countries') return 'Search countries...';
        return 'Search heroes...';
    }

    _setupSearchHandlers() {
        const input = this.filtersMenuSearchInput || document.getElementById('filtersMenuSearch');
        if (!input) return;
        this.filtersMenuSearchInput = input;
        input.placeholder = this._searchPlaceholderForType(this.currentFilterType);
        if (input.dataset.searchBound === '1') {
            this._applyCurrentCategorySearch();
            return;
        }
        input.dataset.searchBound = '1';
        input.addEventListener('input', () => {
            this._applyCurrentCategorySearch();
        });
        this._applyCurrentCategorySearch();
    }

    _applyCurrentCategorySearch() {
        const input = this.filtersMenuSearchInput || document.getElementById('filtersMenuSearch');
        const grid = this.filtersGrid || document.getElementById('filtersGrid');
        if (!input || !grid) return;
        input.placeholder = this._searchPlaceholderForType(this.currentFilterType);
        const query = String(input.value || '').trim().toLowerCase();
        const buttons = grid.querySelectorAll('.filter-btn');
        buttons.forEach((btn) => {
            const labelEl = btn.querySelector('.filter-label-text');
            const text = String(labelEl?.textContent || btn.dataset.filterKey || '').trim().toLowerCase();
            const match = !query || text.includes(query);
            btn.style.display = match ? '' : 'none';
        });
        grid.querySelectorAll('.filters-grid-type-separator, .filters-grid-hero-subrole-separator').forEach((sep) => {
            if (!query) {
                sep.style.display = '';
                return;
            }
            let n = sep.nextElementSibling;
            let any = false;
            while (
                n &&
                !n.classList.contains('filters-grid-type-separator') &&
                !n.classList.contains('filters-grid-hero-subrole-separator')
            ) {
                if (n.classList?.contains('filter-btn') && n.style.display !== 'none') {
                    any = true;
                    break;
                }
                n = n.nextElementSibling;
            }
            sep.style.display = any ? '' : 'none';
        });
    }
    
    // Setup tab switching - delegates to helper
    setupTabs() {
        const helper = window.FilterTabHelpers?.setupTabs;
        if (helper) {
            helper(
                this.heroesTab,
                this.factionsTab,
                this.npcsTab,
                this.countriesTab,
                this.heroes,
                this.factions,
                this.npcs,
                this.countries,
                (items, type, folder) => {
                    this.currentFilterType = type;
                    this.createFilterButtons(items, type, folder);
                },
                () => this.updateFilterCounts()
            );
        } else {
            // Fallback implementation
            const deactivateOthers = (active) => {
                [this.heroesTab, this.factionsTab, this.npcsTab, this.countriesTab].forEach((tab) => {
                    if (!tab || tab === active) return;
                    tab.classList.remove('active');
                    tab.setAttribute('aria-selected', 'false');
                });
            };
            if (this.heroesTab) {
                this.heroesTab.addEventListener('click', () => {
                    if (!this.heroesTab.classList.contains('active') && window.SoundEffectsManager) {
                        window.SoundEffectsManager.play('switchMap');
                    }
                    this.currentFilterType = 'heroes';
                    deactivateOthers(this.heroesTab);
                    this.heroesTab.classList.add('active');
                    this.heroesTab.setAttribute('aria-selected', 'true');
                    this.createFilterButtons(this.heroes, 'heroes', 'assets/images/heroes');
                    this._applyCurrentCategorySearch();
                    this.updateFilterCounts();
                });
            }
            if (this.factionsTab) {
                this.factionsTab.addEventListener('click', () => {
                    if (!this.factionsTab.classList.contains('active') && window.SoundEffectsManager) {
                        window.SoundEffectsManager.play('switchMap');
                    }
                    this.currentFilterType = 'factions';
                    deactivateOthers(this.factionsTab);
                    this.factionsTab.classList.add('active');
                    this.factionsTab.setAttribute('aria-selected', 'true');
                    this.createFilterButtons(this.factions, 'factions', 'assets/images/factions');
                    this._applyCurrentCategorySearch();
                    this.updateFilterCounts();
                });
            }
            if (this.npcsTab) {
                this.npcsTab.addEventListener('click', () => {
                    if (!this.npcsTab.classList.contains('active') && window.SoundEffectsManager) {
                        window.SoundEffectsManager.play('switchMap');
                    }
                    this.currentFilterType = 'npcs';
                    deactivateOthers(this.npcsTab);
                    this.npcsTab.classList.add('active');
                    this.npcsTab.setAttribute('aria-selected', 'true');
                    this.createFilterButtons(this.npcs, 'npcs', 'assets/images/npcs');
                    this._applyCurrentCategorySearch();
                    this.updateFilterCounts();
                });
            }
            if (this.countriesTab) {
                this.countriesTab.addEventListener('click', () => {
                    if (!this.countriesTab.classList.contains('active') && window.SoundEffectsManager) {
                        window.SoundEffectsManager.play('switchMap');
                    }
                    this.currentFilterType = 'countries';
                    deactivateOthers(this.countriesTab);
                    this.countriesTab.classList.add('active');
                    this.countriesTab.setAttribute('aria-selected', 'true');
                    this.createFilterButtons(this.countries, 'countries', 'assets/images/flags');
                    this._applyCurrentCategorySearch();
                    this.updateFilterCounts();
                });
            }
        }
    }
    
    /**
     * Close other panels - delegates to helper
     */
    async closeOtherPanels() {
        const helper = window.FilterPanelHelpers?.closeOtherPanels;
        if (helper) {
            helper();
            const eventSlide = document.getElementById('eventSlide');
            if (eventSlide?.classList.contains('open')) {
                eventSlide.classList.remove('open');
            }
        } else {
            // Fallback
            const musicPanel = document.getElementById('musicPanel');
            const musicButton = document.getElementById('musicToggle');
            if (musicPanel?.classList.contains('open')) {
                musicPanel.classList.remove('open');
                musicButton?.classList.remove('active');
            }
            const eventsManagePanel = document.getElementById('eventsManagePanel');
            const eventsManageToggle = document.getElementById('eventsManageToggle');
            if (eventsManagePanel?.classList.contains('open')) {
                eventsManagePanel.classList.remove('open');
                eventsManageToggle?.classList.remove('active');
            }
            const eventSlide = document.getElementById('eventSlide');
            if (eventSlide?.classList.contains('open')) {
                eventSlide.classList.remove('open');
            }
        }
    }
    
    /**
     * Open the filters panel - delegates to helper
     */
    openPanel() {
        const confirmedFilters = window.standaloneActiveFilters ? Array.from(window.standaloneActiveFilters) : [];
        this._logFilterStateWithMatches('📂 OPEN', confirmedFilters);
        // Mutual exclusion: if Event Info is open, close it before opening Filters.
        const eventSlide = document.getElementById('eventSlide');
        if (eventSlide?.classList.contains('open')) {
            eventSlide.classList.remove('open');
        }
        
        const helper = window.FilterPanelHelpers?.openPanel;
        if (helper) {
            helper(
                this.filtersPanel, this.filtersButton,
                this.stateManager, () => this.getSceneModel(),
                this.currentFilterType, this.heroes, this.factions, this.npcs, this.countries,
                (items, type, folder) => this.createFilterButtons(items, type, folder)
            );
        } else {
            // Fallback - use standaloneActiveFilters if Event System is active
            const eventSystemActive = typeof window.eventManager !== 'undefined' && window.eventManager !== null;
            if (eventSystemActive && window.standaloneActiveFilters) {
                this.stateManager.selectedFilters = new Set(window.standaloneActiveFilters);
            } else {
                const sceneModel = this.getSceneModel();
                this.stateManager.resetToConfirmed(sceneModel);
            }
            if (this.currentFilterType === 'heroes') {
                this.createFilterButtons(this.heroes, 'heroes', 'assets/images/heroes');
            } else if (this.currentFilterType === 'factions') {
                this.createFilterButtons(this.factions, 'factions', 'assets/images/factions');
            } else if (this.currentFilterType === 'countries') {
                this.createFilterButtons(this.countries, 'countries', 'assets/images/flags');
            } else {
                this.createFilterButtons(this.npcs, 'npcs', 'assets/images/npcs');
            }
            this.updateButtonStates();
            this.filtersPanel.classList.add('open');
            this.filtersButton?.classList.add('active');
        }
        
        const loadedSelection = Array.from(this.stateManager.selectedFilters);
        console.log(`[FILTER DEBUG]    Selection loaded: [${loadedSelection.join(', ')}]`);
    }
    
    /**
     * Close the filters panel - delegates to helper
     */
    async closePanel() {
        const helper = window.FilterPanelHelpers?.closePanel;
        if (helper) {
            helper(this.filtersPanel, this.filtersButton);
        } else {
            // Fallback
            this.filtersPanel.classList.remove('open');
            this.filtersButton?.classList.remove('active');
        }
    }
    
    /**
     * Toggle panel open/close state - delegates to helper
     */
    async togglePanel() {
        const helper = window.FilterPanelHelpers?.togglePanel;
        if (helper) {
            helper(
                this.filtersPanel, this.filtersButton,
                () => this.closeOtherPanels(),
                async (panel, button, stateManager, getSceneModel, currentType, heroes, factions, npcs, countries, createFilterButtons) => {
                    // Mutual exclusion: opening Filters closes Event Info.
                    const eventSlide = document.getElementById('eventSlide');
                    if (eventSlide?.classList.contains('open')) {
                        eventSlide.classList.remove('open');
                    }
                    // Use standaloneActiveFilters if Event System is active
                    const eventSystemActive = typeof window.eventManager !== 'undefined' && window.eventManager !== null;
                    if (eventSystemActive && window.standaloneActiveFilters) {
                        stateManager.selectedFilters = new Set(window.standaloneActiveFilters);
                    } else {
                        const sceneModel = getSceneModel();
                        stateManager.resetToConfirmed(sceneModel);
                    }
                    if (currentType === 'heroes') {
                        await createFilterButtons(heroes, 'heroes', 'assets/images/heroes');
                    } else if (currentType === 'factions') {
                        await createFilterButtons(factions, 'factions', 'assets/images/factions');
                    } else if (currentType === 'countries') {
                        await createFilterButtons(countries || [], 'countries', 'assets/images/flags');
                    } else {
                        await createFilterButtons(npcs, 'npcs', 'assets/images/npcs');
                    }
                    this.updateButtonStates();
                    panel.classList.add('open');
                    button?.classList.add('active');
                },
                () => this.resetToConfirmedFilters(),
                (panel, button) => {
                    panel.classList.remove('open');
                    button?.classList.remove('active');
                },
                this.stateManager, () => this.getSceneModel(),
                this.currentFilterType, this.heroes, this.factions, this.npcs, this.countries,
                (items, type, folder) => this.createFilterButtons(items, type, folder)
            );
        } else {
            // Fallback
            const isOpening = !this.filtersPanel.classList.contains('open');
            if (isOpening) {
                this.closeOtherPanels();
                this.openPanel();
            } else {
                this.resetToConfirmedFilters();
                this.closePanel();
            }
        }
    }
    
    /**
     * Setup all button handlers - delegates to helper or uses built-in fallback
     * Re-queries DOM elements to avoid race conditions with standalone mode overrides
     * In standalone mode, always uses built-in fallback for full mode support
     */
    async setupButtons() {
        // Re-query DOM elements to avoid race conditions (standalone mode may have replaced buttons)
        const filtersButton = document.getElementById('filtersToggle') || this.filtersButton;
        const filtersPanelClose = document.getElementById('filtersPanelClose') || this.filtersPanelClose;
        const clearFiltersBtn = document.getElementById('clearFiltersBtn') || this.clearFiltersBtn;
        const confirmFiltersBtn = document.getElementById('confirmFiltersBtn') || this.confirmFiltersBtn;
        
        // ALWAYS set up toggle and close buttons (MenuHelpers doesn't set these up)
        this._setupToggleAndCloseHandlers(filtersButton, filtersPanelClose);
        
        // Check if MenuHelpers has already set up confirm/clear handlers
        if (window._menuHelpersFilterHandlersInstalled) {
            return;
        }
        
        // In standalone mode, use built-in fallback for full dual-mode support
        // The helper is globe-centric and doesn't support standalone mode
        if (this.isStandaloneMode()) {
            this._setupConfirmAndClearHandlers(clearFiltersBtn, confirmFiltersBtn);
            return;
        }
        
        let helper = window.FilterButtonSetupHelpers?.setupButtons;
        
        // If helper not available, try to load it dynamically
        if (!helper) {
            try {
                const module = await import('./helpers/FilterButtonSetupHelpers.js');
                helper = module.setupButtons;
                // Cache it for next time
                if (!window.FilterButtonSetupHelpers) window.FilterButtonSetupHelpers = {};
                window.FilterButtonSetupHelpers.setupButtons = helper;
            } catch (error) {
                // Silently fall through to fallback - helpers may be loading via script tags
            }
        }
        
        if (helper) {
            // Use the helper for globe mode (globe-centric handlers)
            // Note: This may set up duplicate toggle/close handlers in globe-only mode,
            // but that's harmless and only affects globe-only mode (not MenuHelpers mode)
            helper(
                filtersButton, filtersPanelClose, clearFiltersBtn, confirmFiltersBtn,
                this.soundManager, () => this.togglePanel(),
                () => this.resetToConfirmedFilters(), () => this.closePanel(),
                this.stateManager, () => this.updateButtonStates(),
                () => this.getSceneModel(), () => this.currentFilterType,
                this.heroes, this.factions, this.npcs, this.countries,
                (items, type, folder) => this.createFilterButtons(items, type, folder)
            );
        } else {
            // Built-in fallback with full standalone + globe support
            // Toggle/close handlers already set up above, only set up confirm/clear here
            this._setupConfirmAndClearHandlers(clearFiltersBtn, confirmFiltersBtn);
        }
    }

    /**
     * Setup toggle and close button handlers (always run, even when MenuHelpers is active)
     */
    _setupToggleAndCloseHandlers(filtersButton, filtersPanelClose) {
        // Toggle button - open/close panel
        if (filtersButton) {
            filtersButton.addEventListener('click', () => {
                const isOpening = !this.filtersPanel?.classList.contains('open');
                this.togglePanel();
                if (isOpening && this.soundManager) {
                    this.soundManager.play('filterButton');
                }
                // Flash feedback (orange for panel toggle)
                if (window.flashButton) {
                    window.flashButton(filtersButton, 'flash-orange');
                }
            });
        }
        
        // Close button - reset to confirmed and close
        if (filtersPanelClose) {
            filtersPanelClose.addEventListener('click', () => {
                this.resetToConfirmedFilters();
                this.closePanel();
                if (this.soundManager) this.soundManager.play('filterButton');
            });
        }
    }

    /**
     * Setup confirm and clear button handlers (skipped when MenuHelpers is active)
     */
    _setupConfirmAndClearHandlers(clearFiltersBtn, confirmFiltersBtn) {
        // Clear button - clear all filters and apply immediately
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.stateManager.clear();
                this.updateButtonStates();
                if (this.soundManager) this.soundManager.play('filterClear');
                
                // Clear standalone filters and refresh UI (works even when globe is loaded)
                if (window.standaloneActiveFilters) {
                    window.standaloneActiveFilters.clear();
                }
                
                // Apply filter state to Codex nodes (clears filtered-out state)
                if (typeof window.applyCodexFilterState === 'function') {
                    window.applyCodexFilterState();
                }
                
                // Log clear with matches (should be all events)
                this._logFilterStateWithMatches('🟡 CLEAR', []);
                
                // Refresh pagination to show all unlocked
                if (typeof window.updateStandalonePaginationForFilters === 'function') {
                    window.updateStandalonePaginationForFilters();
                }
                if (window.standaloneEventSlide?.updatePaginationUI) {
                    window.standaloneEventSlide.updatePaginationUI();
                }
                
                // Also refresh globe markers to unlock all
                if (window.globeEventMarkerManager) {
                    window.globeEventMarkerManager.unlockAllEvents();
                } else                 if (window.globeController?.eventMarkerManager) {
                    window.globeController.eventMarkerManager.unlockAllEvents();
                }
                if (typeof window.LocationFlagHelpers?.scheduleApplyRelevancyRowFilterHighlight === 'function') {
                    window.LocationFlagHelpers.scheduleApplyRelevancyRowFilterHighlight();
                }
            });
        }
        
        // Confirm button - apply filters and close (THE KEY BUTTON FOR FILTER FUNCTIONALITY)
        if (confirmFiltersBtn) {
            confirmFiltersBtn.addEventListener('click', () => {
                if (this.soundManager) this.soundManager.play('filterConfirm');
                
                // Apply filters - Event System Load Out mode only
                // NOTE: Globe mode removed - Event System handles all filter application
                // via MenuHelpers.js/MenuServiceHelpers.js which calls EventMarkerManager
                this.applyFiltersToStandalone();
                this.closePanel();
            });
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.FilterService = new FilterService();
}
