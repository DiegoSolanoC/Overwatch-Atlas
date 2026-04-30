/**
 * EventListenerService - Handles event listener setup for EventManager
 * Separates listener setup logic from event management
 */

class EventListenerService {
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
     * Setup all event listeners
     */
    setupEventListeners() {
        if (!this.eventManager) return;
        
        console.log('EventListenerService: setupEventListeners called');
        
        // Toggle panel
        const toggleBtn = document.getElementById('eventsManageToggle');
        const panel = document.getElementById('eventsManagePanel');
        const closeBtn = document.getElementById('eventsManageClose');
        
        if (!panel) {
            console.error('EventListenerService: eventsManagePanel not found! Make sure the HTML panel exists in the page.');
            console.error('EventListenerService: Current page:', window.location.pathname);
            // Try again after a short delay in case DOM isn't ready
            setTimeout(() => {
                console.log('EventListenerService: Retrying setupEventListeners after delay...');
                this.setupEventListeners();
            }, 200);
            return;
        }

        this.setupEventsManageToolbarCollapse(panel);

        if (this.eventManager.listenersSetup) {
            console.log('EventListenerService: Listeners already set up, skipping...');
            return;
        }

        console.log('EventListenerService: Panel found, setting up listeners...');
        console.log('EventListenerService: Toggle button found:', !!toggleBtn);
        console.log('EventListenerService: Close button found:', !!closeBtn);

        if (toggleBtn) {
            toggleBtn.style.display = '';
            toggleBtn.style.visibility = 'visible';
            toggleBtn.style.opacity = '1';
        }

        if (toggleBtn && panel) {
            // Remove existing listener by cloning the button to prevent duplicates
            const toggleBtnClone = toggleBtn.cloneNode(true);
            toggleBtn.parentNode.replaceChild(toggleBtnClone, toggleBtn);
            const newToggleBtn = document.getElementById('eventsManageToggle');
            
            // Re-get panel reference after button clone (in case DOM changed)
            const currentPanel = document.getElementById('eventsManagePanel');
            if (!currentPanel) {
                console.error('EventListenerService: eventsManagePanel not found after button setup');
                return;
            }
            
            newToggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('EventListenerService: Toggle button clicked');
                
                // Close music panel if open
                const musicPanel = document.getElementById('musicPanel');
                const musicButton = document.getElementById('musicToggle');
                if (musicPanel && musicPanel.classList.contains('open')) {
                    musicPanel.classList.remove('open');
                    if (musicButton) {
                        musicButton.classList.remove('active');
                    }
                }
                
                // Close filters panel if open
                const filtersPanel = document.getElementById('filtersPanel');
                const filtersButton = document.getElementById('filtersToggle');
                if (filtersPanel && filtersPanel.classList.contains('open')) {
                    filtersPanel.classList.remove('open');
                    if (filtersButton) {
                        filtersButton.classList.remove('active');
                    }
                }
                
                // Play event manager sound
                console.log('[DEBUG] EventManager toggle clicked, SoundEffectsManager:', !!window.SoundEffectsManager);
                if (window.SoundEffectsManager) {
                    console.log('[DEBUG] Playing eventManager sound');
                    window.SoundEffectsManager.play('eventManager');
                } else {
                    console.log('[DEBUG] SoundEffectsManager not available');
                }
                
                // Toggle event management panel (works normally on both localhost and GitHub Pages)
                const wasOpen = currentPanel.classList.contains('open');
                console.log('EventListenerService: Panel was open:', wasOpen);
                currentPanel.classList.toggle('open');
                const isNowOpen = currentPanel.classList.contains('open');
                console.log('EventListenerService: Panel is now open:', isNowOpen);
                
                if (isNowOpen) {
                    try {
                        window.SummaryInfoBadge?.hide();
                    } catch (_) {}
                    newToggleBtn.classList.add('active');
                    if (this.eventManager.renderEvents) {
                        this.eventManager.renderService?.requestPageEntranceAnimation?.();
                        this.eventManager.renderEvents();
                    }
                } else {
                    // Reset all multi-variant events to first variant when closing
                    if (wasOpen && this.eventManager.resetAllEventVariants) {
                        this.eventManager.resetAllEventVariants();
                    }
                    newToggleBtn.classList.remove('active');
                }
            });
        } else if (!toggleBtn && panel) {
            console.log('EventListenerService: No eventsManageToggle — panel listeners only (toggle removed)');
        }

        if (closeBtn && panel) {
            closeBtn.addEventListener('click', () => {
                // Play event manager sound when closing
                if (window.SoundEffectsManager) {
                    window.SoundEffectsManager.play('eventManager');
                }
                
                // Reset all multi-variant events to first variant
                if (this.eventManager.resetAllEventVariants) {
                    this.eventManager.resetAllEventVariants();
                }
                
                panel.classList.remove('open');
                try {
                    window.SummaryInfoBadge?.hide();
                } catch (_) {}
                const toggleBtn = document.getElementById('eventsManageToggle');
                if (toggleBtn) {
                    toggleBtn.classList.remove('active');
                }
            });
        }

        // Music/filters panels: dismissed on empty globe click / double-click (not on drag); see MarkerInteractionService + InteractionController.

        // Hide/lock management buttons on GitHub Pages
        const isGitHubPages = this.eventManager.isGitHubPages ? this.eventManager.isGitHubPages() : false;
        
        // Add event button
        const addBtn = document.getElementById('addEventBtn');
        if (addBtn) {
            if (isGitHubPages) {
                addBtn.style.display = 'none';
                console.log('EventListenerService: Add Event button hidden (GitHub Pages)');
            } else {
                // Remove any existing listeners by cloning
                const addBtnClone = addBtn.cloneNode(true);
                addBtn.parentNode.replaceChild(addBtnClone, addBtn);
                const newAddBtn = document.getElementById('addEventBtn');
                
                newAddBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('EventListenerService: Add Event button clicked');
                    if (this.eventManager.addBlankEventAndOpen) {
                        this.eventManager.addBlankEventAndOpen();
                    }
                });
                console.log('EventListenerService: Add Event button listener attached');
            }
        } else {
            console.warn('EventListenerService: addEventBtn not found! Make sure events-manage-panel HTML exists.');
            console.warn('EventListenerService: Panel exists:', !!panel, 'Panel ID:', panel?.id);
        }

        // Save events button
        const saveBtn = document.getElementById('saveEventsBtn');
        if (saveBtn) {
            if (isGitHubPages) {
                saveBtn.style.display = 'none';
            } else {
                saveBtn.addEventListener('click', () => {
                    if (this.eventManager.saveEvents) {
                        this.eventManager.saveEvents();
                    }
                });
            }
        }

        // Export events button
        const exportBtn = document.getElementById('exportEventsBtn');
        if (exportBtn) {
            if (isGitHubPages) {
                exportBtn.style.display = 'none';
            } else {
                exportBtn.addEventListener('click', () => {
                    if (this.eventManager.exportEvents) {
                        this.eventManager.exportEvents();
                    }
                });
            }
        }

        // Import events button
        const importBtn = document.getElementById('importEventsBtn');
        const importFileInput = document.getElementById('importEventsFile');
        if (importBtn && importFileInput) {
            if (isGitHubPages) {
                importBtn.style.display = 'none';
                importFileInput.style.display = 'none';
            } else {
                importBtn.addEventListener('click', () => {
                    importFileInput.click();
                });
                importFileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file && this.eventManager.importEvents) {
                        this.eventManager.importEvents(file);
                        // Reset input so same file can be imported again
                        e.target.value = '';
                    }
                });
            }
        }

        // Mark listeners as set up
        this.setupEventManagerSearch();
        this.eventManager.listenersSetup = true;
        console.log('EventListenerService: All listeners set up successfully');
    }

    /**
     * Mobile (narrow or short-edge): toggle collapses search/filters; default collapsed until localStorage `eventsManageToolbarCollapsed` is set.
     * Desktop: toolbar always shown; aria-pressed cleared.
     */
    setupEventsManageToolbarCollapse(panel) {
        if (this._eventsManageToolbarCollapseBound) return;
        const btn = document.getElementById('eventsManageToolbarToggleBtn');
        const controlsEl =
            document.getElementById('eventsManageControls') || document.getElementById('eventsManageSearch');
        if (!panel || !btn) return;
        this._eventsManageToolbarCollapseBound = true;

        const storageKey = 'eventsManageToolbarCollapsed';
        // Match pagination "phone" rule: narrow width OR short edge (phone landscape is often >768px wide).
        const isEventsManageMobileToolbar = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            return w <= 768 || Math.min(w, h) < 600;
        };

        const LABEL_HIDE = 'Hide controls';
        const LABEL_SHOW = 'Show controls';

        const apply = () => {
            const mobile = isEventsManageMobileToolbar();
            const collapsed = btn.getAttribute('aria-pressed') === 'true';

            if (!mobile) {
                panel.classList.remove('events-manage-panel--toolbar-collapsed');
                btn.setAttribute('aria-pressed', 'false');
                btn.textContent = LABEL_HIDE;
                if (controlsEl) controlsEl.style.removeProperty('display');
                return;
            }

            panel.classList.toggle('events-manage-panel--toolbar-collapsed', collapsed);
            btn.textContent = collapsed ? LABEL_SHOW : LABEL_HIDE;
            if (controlsEl) {
                if (collapsed) {
                    controlsEl.style.setProperty('display', 'none', 'important');
                } else {
                    controlsEl.style.removeProperty('display');
                }
            }
        };

        try {
            const stored = localStorage.getItem(storageKey);
            if (stored === '1') {
                btn.setAttribute('aria-pressed', 'true');
            } else if (stored === '0') {
                btn.setAttribute('aria-pressed', 'false');
            } else {
                // No preference: collapsed by default on mobile (portrait and landscape)
                btn.setAttribute('aria-pressed', isEventsManageMobileToolbar() ? 'true' : 'false');
            }
        } catch (_) {
            btn.setAttribute('aria-pressed', isEventsManageMobileToolbar() ? 'true' : 'false');
        }

        apply();

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isEventsManageMobileToolbar()) return;
            const next = btn.getAttribute('aria-pressed') !== 'true';
            btn.setAttribute('aria-pressed', next ? 'true' : 'false');
            apply();
            try {
                localStorage.setItem(storageKey, next ? '1' : '0');
            } catch (_) {}
        });

        const onViewportChange = () => apply();
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('orientationchange', () => {
            requestAnimationFrame(() => apply());
        });
    }

    /**
     * Setup event manager search bar: title + hero/faction tokens + country/flag tokens (FLAG_FILE_BY_COMMON keys).
     */
    setupEventManagerSearch() {
        if (!this.eventManager) return;
        const searchInput = document.getElementById('eventsSearchInput');
        const filtersInput = document.getElementById('eventsSearchFilters');
        const suggestionsEl = document.getElementById('eventsSearchFiltersSuggestions');
        const countryInput = document.getElementById('eventsSearchCountry');
        const countrySuggestionsEl = document.getElementById('eventsSearchCountrySuggestions');
        const useSelectionCheckbox = document.getElementById('eventsUseFilterSelectionCheckbox');
        const perPageInput = document.getElementById('eventsPerPageInput');
        const showAllCheckbox = document.getElementById('eventsShowAllCheckbox');
        const clearBtn = document.getElementById('eventsSearchClear');
        if (!searchInput || !filtersInput) return;

        const defaultFactionDisplayName = (filename) => {
            const base = String(filename ?? '').replace(/\.png$/i, '').trim();
            if (!base) return '';
            const bare = base.replace(/^\d+/, '').replace(/_/g, ' ').trim();
            const token = bare || base;
            return token.split(/\s+/).filter(Boolean).map((w) => {
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
            }).join(' ');
        };

        const buildFilterIndex = () => {
            const heroes = this.eventManager.heroes || [];
            const npcs = this.eventManager.npcs || [];
            const factions = this.eventManager.factions || [];
            const heroByLower = new Map();
            heroes.forEach(h => {
                const key = (h || '').toString().toLowerCase();
                if (key) heroByLower.set(key, h);
            });
            const npcByLower = new Map();
            npcs.forEach((n) => {
                const key = (n || '').toString().toLowerCase();
                if (key) npcByLower.set(key, n);
            });
            const factionEntries = (factions || []).map(f => {
                const filename = typeof f === 'object' && f !== null && f.filename != null ? f.filename : f;
                const fn = (filename || '').toString();
                const rawDisplay = typeof f === 'object' && f !== null && f.displayName != null
                    ? String(f.displayName).trim()
                    : '';
                let displayName = rawDisplay;
                if (!displayName || displayName === fn || displayName.toLowerCase() === fn.toLowerCase()) {
                    displayName = defaultFactionDisplayName(fn);
                }
                return {
                    filename: fn,
                    displayName,
                    filenameLower: fn.toLowerCase(),
                    displayLower: displayName.toLowerCase(),
                };
            });
            return { heroes, npcs, heroByLower, npcByLower, factionEntries };
        };

        let filterIndex = buildFilterIndex();
        let manualFilterText = '';
        let isSyncingSelection = false;

        let lastFilterSuggestionPayload = { items: [], beforePart: '' };
        let filterSuggestionHoverIndex = -1;
        let lastCountrySuggestionPayload = { items: [], beforePart: '' };
        let countrySuggestionHoverIndex = -1;

        const playFilterConfirmSfx = () => {
            window.SoundEffectsManager?.play?.('filterConfirm');
        };
        const playFilterClearSfx = () => {
            window.SoundEffectsManager?.play?.('filterClear');
        };

        if (suggestionsEl && !suggestionsEl._owtlSuggestionHoverBound) {
            suggestionsEl._owtlSuggestionHoverBound = true;
            suggestionsEl.addEventListener('mouseleave', () => {
                filterSuggestionHoverIndex = -1;
            });
        }
        if (countrySuggestionsEl && !countrySuggestionsEl._owtlSuggestionHoverBound) {
            countrySuggestionsEl._owtlSuggestionHoverBound = true;
            countrySuggestionsEl.addEventListener('mouseleave', () => {
                countrySuggestionHoverIndex = -1;
            });
        }

        const normalizeFlagKey = (s) => {
            if (!s) return '';
            return String(s)
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim();
        };

        const buildFlagIndex = () => {
            const map = typeof window !== 'undefined' && window.FLAG_FILE_BY_COMMON ? window.FLAG_FILE_BY_COMMON : null;
            if (!map) return [];
            return Object.keys(map)
                .map((common) => ({
                    common,
                    file: map[common],
                    commonLower: common.toLowerCase(),
                    keyNorm: normalizeFlagKey(common),
                }))
                .sort((a, b) => a.common.localeCompare(b.common));
        };

        let flagIndex = buildFlagIndex();

        const parseCountryTokens = (text) => {
            flagIndex = buildFlagIndex();
            const entries = flagIndex;
            const tokens = (text || '').split(',').map((t) => t.trim()).filter((t) => t.length > 0);
            const matchedFiles = [];
            const seen = new Set();
            tokens.forEach((token) => {
                const lower = token.toLowerCase();
                let hit = entries.find((e) => e.commonLower === lower);
                if (!hit) {
                    hit = entries.find((e) => e.file.toLowerCase() === lower);
                }
                if (!hit) {
                    const nk = normalizeFlagKey(token);
                    hit = entries.find((e) => e.keyNorm === nk);
                }
                if (hit && hit.file && !seen.has(hit.file)) {
                    seen.add(hit.file);
                    matchedFiles.push(hit.file);
                }
            });
            return matchedFiles;
        };

        const getCurrentCountryTokenInfo = () => {
            const value = (countryInput && countryInput.value) ? countryInput.value : '';
            const lastComma = value.lastIndexOf(',');
            const before = lastComma >= 0 ? value.slice(0, lastComma) : '';
            const currentRaw = lastComma >= 0 ? value.slice(lastComma + 1) : value;
            const current = currentRaw.trimStart();
            return { before, current, lastComma };
        };

        const countrySubstringRank = (commonLower, needle) => {
            if (!needle || !commonLower.includes(needle)) return Infinity;
            if (commonLower.startsWith(needle)) return 0;
            return 1 + commonLower.indexOf(needle);
        };

        const getCountryCandidates = (prefixLower) => {
            flagIndex = buildFlagIndex();
            const entries = flagIndex;
            if (!prefixLower) return [];
            return entries
                .filter((e) => e.commonLower.includes(prefixLower))
                .sort(
                    (a, b) =>
                        countrySubstringRank(a.commonLower, prefixLower)
                        - countrySubstringRank(b.commonLower, prefixLower)
                        || a.common.length - b.common.length
                )
                .slice(0, 10);
        };

        const hideCountrySuggestions = () => {
            if (!countrySuggestionsEl) return;
            countrySuggestionHoverIndex = -1;
            lastCountrySuggestionPayload = { items: [], beforePart: '' };
            countrySuggestionsEl.style.display = 'none';
            countrySuggestionsEl.innerHTML = '';
        };

        const showCountrySuggestions = (items, beforePart) => {
            if (!countrySuggestionsEl || !window.LocationFlagHelpers || typeof window.LocationFlagHelpers.flagSrc !== 'function') {
                return;
            }
            const flagSrc = window.LocationFlagHelpers.flagSrc;
            countrySuggestionsEl.innerHTML = '';
            const max = Math.min(items.length, 8);
            const slice = items.slice(0, max);
            lastCountrySuggestionPayload = { items: slice, beforePart };
            countrySuggestionHoverIndex = -1;
            for (let i = 0; i < max; i++) {
                const item = items[i];
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'events-search-suggestion events-search-suggestion--with-flag';
                const img = document.createElement('img');
                img.className = 'events-search-suggestion-flag';
                img.src = flagSrc(item.file);
                img.alt = '';
                img.width = 32;
                img.height = 20;
                img.decoding = 'async';
                const labelSpan = document.createElement('span');
                labelSpan.className = 'events-search-suggestion-label';
                labelSpan.textContent = item.common;
                const detailSpan = document.createElement('span');
                detailSpan.className = 'muted';
                detailSpan.textContent = 'Country';
                btn.appendChild(img);
                btn.appendChild(labelSpan);
                btn.appendChild(detailSpan);
                btn.addEventListener('mouseenter', () => {
                    countrySuggestionHoverIndex = i;
                });
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (applyCountrySuggestionPick) applyCountrySuggestionPick(item, beforePart);
                });
                countrySuggestionsEl.appendChild(btn);
            }
            countrySuggestionsEl.style.display = max > 0 ? 'block' : 'none';
            
            // Move to body and position using fixed positioning to escape overflow contexts
            if (max > 0) {
                if (countrySuggestionsEl.parentNode !== document.body) {
                    document.body.appendChild(countrySuggestionsEl);
                }
                const rect = countryInput.getBoundingClientRect();
                // Align to panel edge - closer to right side of screen
                countrySuggestionsEl.style.left = `auto`;
                countrySuggestionsEl.style.right = `20px`;
                countrySuggestionsEl.style.top = `${rect.bottom + 6}px`;
                countrySuggestionsEl.style.width = `300px`;
            }
        };

        const updateCountryPredictions = () => {
            if (!countryInput) return;
            const { before, current } = getCurrentCountryTokenInfo();
            const prefix = (current || '').trim();
            if (!prefix) {
                countryInput.classList.remove('no-filter-match');
                hideCountrySuggestions();
                return;
            }
            const candidates = getCountryCandidates(prefix.toLowerCase());
            if (candidates.length === 0) {
                countryInput.classList.add('no-filter-match');
                hideCountrySuggestions();
            } else {
                countryInput.classList.remove('no-filter-match');
                showCountrySuggestions(candidates, before);
            }
        };

        const parseFilterTokens = (text) => {
            // Rebuild index lazily if data arrived after listeners were set up
            if (!filterIndex
                || (filterIndex.heroes?.length === 0 && (this.eventManager.heroes || []).length > 0)
                || (filterIndex.npcs?.length === 0 && (this.eventManager.npcs || []).length > 0)) {
                filterIndex = buildFilterIndex();
            }
            const heroByLower = filterIndex.heroByLower || new Map();
            const npcByLower = filterIndex.npcByLower || new Map();
            const factionEntries = filterIndex.factionEntries || [];

            const tokens = (text || '').split(',').map(t => t.trim()).filter(t => t.length > 0);
            const matchedHeroes = [];
            const matchedFactions = [];
            const matchedNpcs = [];
            const unmatchedTokens = [];
            const seenHero = new Set();
            const seenFaction = new Set();
            const seenNpc = new Set();
            const seenUnmatched = new Set();

            tokens.forEach(token => {
                const lower = token.toLowerCase();
                if (heroByLower.has(lower)) {
                    const heroName = heroByLower.get(lower);
                    if (heroName && !seenHero.has(heroName)) {
                        seenHero.add(heroName);
                        matchedHeroes.push(heroName);
                    }
                } else if (npcByLower.has(lower)) {
                    const npcName = npcByLower.get(lower);
                    if (npcName && !seenNpc.has(npcName)) {
                        seenNpc.add(npcName);
                        matchedNpcs.push(npcName);
                    }
                } else {
                    const fh = typeof window !== 'undefined' && window.FactionMatchHelpers;
                    const match = factionEntries.find((fe) => (
                        fe.displayLower === lower
                        || fe.filenameLower === lower
                        || (fh && typeof fh.factionIdsMatch === 'function' && (
                            fh.factionIdsMatch(token, fe.filename)
                            || fh.factionIdsMatch(token, fe.displayName)
                        ))
                    ));
                    if (match && match.filename && !seenFaction.has(match.filename)) {
                        seenFaction.add(match.filename);
                        matchedFactions.push(match.filename);
                    } else {
                        const t = token.trim();
                        if (t && !seenUnmatched.has(lower)) {
                            seenUnmatched.add(lower);
                            unmatchedTokens.push(t);
                        }
                    }
                }
            });

            return { matchedHeroes, matchedFactions, matchedNpcs, unmatchedTokens };
        };

        const getSelectedFilterKeys = () => {
            try {
                // Prefer current in-panel selection (even before confirm) when available.
                const fs = window.FilterService;
                const selected = fs?.stateManager?.toArray?.();
                if (Array.isArray(selected)) return selected;

                // Fallback: standalone active filters
                const active = window.standaloneActiveFilters;
                if (active && (active instanceof Set)) return Array.from(active);
                if (Array.isArray(active)) return active;
            } catch (_) {
                // no-op
            }
            return [];
        };

        const selectionKeysToFilterText = (keys) => {
            // Rebuild index if data arrived after init
            if (!filterIndex
                || (filterIndex.heroes?.length === 0 && (this.eventManager.heroes || []).length > 0)
                || (filterIndex.npcs?.length === 0 && (this.eventManager.npcs || []).length > 0)) {
                filterIndex = buildFilterIndex();
            }
            const factionEntries = filterIndex.factionEntries || [];
            const factionByFilenameLower = new Map();
            factionEntries.forEach(fe => {
                if (!fe?.filenameLower) return;
                factionByFilenameLower.set(fe.filenameLower, fe.displayName || fe.filename);
            });
            const npcByLower = filterIndex.npcByLower || new Map();

            const tokens = [];
            (keys || []).forEach((k) => {
                const raw = (k ?? '').toString().trim();
                if (!raw) return;
                const lower = raw.toLowerCase();
                // If it matches a known faction filename, prefer using its displayName token.
                if (factionByFilenameLower.has(lower)) {
                    tokens.push(factionByFilenameLower.get(lower));
                } else if (npcByLower.has(lower)) {
                    tokens.push(npcByLower.get(lower));
                } else {
                    // For heroes, raw is already the hero name; for unknown tokens, keep raw.
                    tokens.push(raw);
                }
            });
            return tokens.join(', ');
        };

        const getCurrentTokenInfo = () => {
            const value = (filtersInput.value || '');
            const lastComma = value.lastIndexOf(',');
            const before = lastComma >= 0 ? value.slice(0, lastComma) : '';
            const currentRaw = lastComma >= 0 ? value.slice(lastComma + 1) : value;
            const current = currentRaw.trimStart();
            return { before, current, lastComma };
        };

        const tokenSubstringRank = (hayLower, needle) => {
            if (!needle || !hayLower.includes(needle)) return Infinity;
            if (hayLower.startsWith(needle)) return 0;
            return 1 + hayLower.indexOf(needle);
        };

        const getTokenCandidates = (prefixLower) => {
            if (!filterIndex) filterIndex = buildFilterIndex();
            const results = [];
            // Heroes: label is hero name
            (filterIndex.heroes || []).forEach(h => {
                const label = (h || '').toString();
                if (!label) return;
                const ll = label.toLowerCase();
                if (ll.includes(prefixLower)) {
                    results.push({
                        kind: 'hero',
                        label,
                        detail: 'Hero',
                        insert: label,
                        heroKey: label,
                        _rank: tokenSubstringRank(ll, prefixLower)
                    });
                }
            });
            (filterIndex.npcs || []).forEach((n) => {
                const label = (n || '').toString();
                if (!label) return;
                const ll = label.toLowerCase();
                if (ll.includes(prefixLower)) {
                    results.push({
                        kind: 'npc',
                        label,
                        detail: 'NPC',
                        insert: label,
                        npcKey: label,
                        _rank: tokenSubstringRank(ll, prefixLower)
                    });
                }
            });
            // Factions: primary label = readable name; muted detail = "Faction" (same pattern as heroes)
            (filterIndex.factionEntries || []).forEach(f => {
                if (!f.displayName && !f.filename) return;
                const match =
                    f.displayLower.includes(prefixLower)
                    || f.filenameLower.includes(prefixLower);
                if (match) {
                    const label = f.displayName || defaultFactionDisplayName(f.filename) || f.filename;
                    const rank = Math.min(
                        tokenSubstringRank(f.displayLower || '', prefixLower),
                        tokenSubstringRank(f.filenameLower || '', prefixLower)
                    );
                    results.push({
                        kind: 'faction',
                        label,
                        detail: 'Faction',
                        insert: label,
                        factionFilename: f.filename,
                        _rank: rank
                    });
                }
            });
            results.sort(
                (a, b) =>
                    (a._rank - b._rank)
                    || (a.label.length - b.label.length)
                    || a.label.localeCompare(b.label)
            );
            results.forEach((r) => { delete r._rank; });
            return results;
        };

        const hideSuggestions = () => {
            if (!suggestionsEl) return;
            filterSuggestionHoverIndex = -1;
            lastFilterSuggestionPayload = { items: [], beforePart: '' };
            suggestionsEl.style.display = 'none';
            suggestionsEl.innerHTML = '';
        };

        let applyFilterSuggestionPick;
        let applyCountrySuggestionPick;

        const showSuggestions = (items, beforePart) => {
            if (!suggestionsEl) return;
            suggestionsEl.innerHTML = '';
            const max = Math.min(items.length, 8);
            const slice = items.slice(0, max);
            lastFilterSuggestionPayload = { items: slice, beforePart };
            filterSuggestionHoverIndex = -1;
            for (let i = 0; i < max; i++) {
                const item = items[i];
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'events-search-suggestion events-search-suggestion--with-flag';
                const img = document.createElement('img');
                img.className = 'events-search-suggestion-flag events-search-suggestion-flag--filter-icon';
                img.alt = '';
                if (item.kind === 'faction' && item.factionFilename) {
                    img.src = `assets/images/factions/${encodeURIComponent(item.factionFilename)}.png`;
                } else if (item.kind === 'npc' && item.npcKey) {
                    img.src = `assets/images/npcs/${encodeURIComponent(item.npcKey)}.png`;
                } else {
                    const hk = item.heroKey || item.label;
                    img.src = `assets/images/heroes/${encodeURIComponent(hk)}.png`;
                }
                img.decoding = 'async';
                img.onerror = () => { img.style.visibility = 'hidden'; };
                const labelSpan = document.createElement('span');
                labelSpan.className = 'events-search-suggestion-label';
                labelSpan.textContent = item.label;
                const detailSpan = document.createElement('span');
                detailSpan.className = 'muted';
                detailSpan.textContent = item.detail || '';
                btn.appendChild(img);
                btn.appendChild(labelSpan);
                btn.appendChild(detailSpan);
                btn.addEventListener('mouseenter', () => {
                    filterSuggestionHoverIndex = i;
                });
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (applyFilterSuggestionPick) applyFilterSuggestionPick(item, beforePart);
                });
                suggestionsEl.appendChild(btn);
            }
            suggestionsEl.style.display = max > 0 ? 'block' : 'none';
            
            // Move to body and position using fixed positioning to escape overflow contexts
            if (max > 0) {
                if (suggestionsEl.parentNode !== document.body) {
                    document.body.appendChild(suggestionsEl);
                }
                const rect = filtersInput.getBoundingClientRect();
                // Align to panel edge - closer to right side of screen
                suggestionsEl.style.left = `auto`;
                suggestionsEl.style.right = `20px`;
                suggestionsEl.style.top = `${rect.bottom + 6}px`;
                suggestionsEl.style.width = `300px`;
            }
        };

        const updateFilterPredictions = () => {
            if (!filtersInput) return;
            if (useSelectionCheckbox && useSelectionCheckbox.checked) {
                // When locked to selection, don't show predictions.
                hideSuggestions();
                return;
            }
            // Rebuild index if data arrived after init
            if (!filterIndex
                || (filterIndex.heroes?.length === 0 && (this.eventManager.heroes || []).length > 0)
                || (filterIndex.npcs?.length === 0 && (this.eventManager.npcs || []).length > 0)) {
                filterIndex = buildFilterIndex();
            }
            const { before, current } = getCurrentTokenInfo();
            const prefix = (current || '').trim();
            if (!prefix) {
                filtersInput.classList.remove('no-filter-match');
                hideSuggestions();
                return;
            }
            const candidates = getTokenCandidates(prefix.toLowerCase());
            if (candidates.length === 0) {
                // Allow free-text tokens (e.g. title keywords like "Iris"); not every segment is a hero/faction id.
                filtersInput.classList.remove('no-filter-match');
                hideSuggestions();
            } else {
                filtersInput.classList.remove('no-filter-match');
                showSuggestions(candidates, before);
            }
        };

        const applySearch = () => {
            this.eventManager.searchQuery = (searchInput && searchInput.value) ? searchInput.value.trim() : '';
            const filterText = (filtersInput && filtersInput.value) ? filtersInput.value.trim() : '';
            const { matchedHeroes, matchedFactions, matchedNpcs, unmatchedTokens } = parseFilterTokens(filterText);
            this.eventManager.searchHeroFilters = matchedHeroes;
            this.eventManager.searchFactionFilters = matchedFactions;
            this.eventManager.searchNpcFilters = matchedNpcs || [];
            this.eventManager.searchUnmatchedFilterTokens = unmatchedTokens || [];
            if (countryInput) {
                const countryText = (countryInput.value || '').trim();
                this.eventManager.searchCountryFilters = parseCountryTokens(countryText);
            } else {
                this.eventManager.searchCountryFilters = [];
            }
            if (this.eventManager.applySearchAndRender) {
                this.eventManager.applySearchAndRender();
            }
        };

        applyFilterSuggestionPick = (item, beforePart) => {
            playFilterConfirmSfx();
            const before = (beforePart || '').trim();
            const nextValue = before ? `${before}, ${item.insert}, ` : `${item.insert}, `;
            filtersInput.value = nextValue;
            filtersInput.classList.remove('no-filter-match');
            hideSuggestions();
            filtersInput.focus();
            applySearch();
            updateFilterPredictions();
        };

        applyCountrySuggestionPick = (item, beforePart) => {
            playFilterConfirmSfx();
            if (!countryInput) return;
            const before = (beforePart || '').trim();
            const nextValue = before ? `${before}, ${item.common}, ` : `${item.common}, `;
            countryInput.value = nextValue;
            countryInput.classList.remove('no-filter-match');
            hideCountrySuggestions();
            countryInput.focus();
            applySearch();
            updateCountryPredictions();
        };

        /**
         * When the typed segment after the last comma is empty, Backspace removes the previous
         * comma-separated token in one step (chip-like).
         */
        const tryRemoveLastCompletedToken = (input, e) => {
            if (e.key !== 'Backspace' || !input || input.readOnly || (useSelectionCheckbox && useSelectionCheckbox.checked)) {
                return false;
            }
            const start = input.selectionStart;
            const end = input.selectionEnd;
            if (start !== end) return false;
            const v = input.value;
            const lc = v.lastIndexOf(',', start - 1);
            const segStart = lc + 1;
            const segment = v.slice(segStart, start);
            if (segment.trim() !== '') return false;
            if (lc < 0) return false;
            const beforeComma = v.slice(0, lc);
            const tokens = beforeComma.split(',').map((s) => s.trim()).filter(Boolean);
            if (tokens.length === 0) return false;
            e.preventDefault();
            playFilterClearSfx();
            tokens.pop();
            const newVal = tokens.join(', ') + (tokens.length ? ', ' : '');
            input.value = newVal;
            const pos = newVal.length;
            input.setSelectionRange(pos, pos);
            return true;
        };

        const syncFiltersInputFromSelection = () => {
            if (!useSelectionCheckbox || !useSelectionCheckbox.checked) return;
            if (isSyncingSelection) return;
            isSyncingSelection = true;
            try {
                const keys = getSelectedFilterKeys();
                const text = selectionKeysToFilterText(keys);
                filtersInput.value = text;
                filtersInput.readOnly = true;
                filtersInput.style.cursor = 'not-allowed';
                filtersInput.style.opacity = '0.75';
                filtersInput.classList.remove('no-filter-match');
                hideSuggestions();
                applySearch();
            } finally {
                isSyncingSelection = false;
            }
        };

        const unlockFiltersInput = () => {
            filtersInput.readOnly = false;
            filtersInput.style.cursor = '';
            filtersInput.style.opacity = '';
        };

        const applyPerPageSettings = () => {
            if (!this.eventManager) return;
            const showAll = !!(showAllCheckbox && showAllCheckbox.checked);
            this.eventManager.showAllEventsInManager = showAll;
            if (perPageInput) {
                perPageInput.disabled = showAll;
                perPageInput.style.opacity = showAll ? '0.5' : '';
                perPageInput.style.cursor = showAll ? 'not-allowed' : '';
            }
            if (!showAll && perPageInput) {
                const value = parseInt(perPageInput.value, 10);
                if (value && value > 0) {
                    this.eventManager.eventsPerPageSetting = value;
                }
            }
            this.eventManager.currentPage = 1;
            if (this.eventManager.renderEvents) {
                this.eventManager.renderEvents();
            }
        };

        searchInput.addEventListener('input', applySearch);
        searchInput.addEventListener('change', applySearch);
        filtersInput.addEventListener('input', () => {
            if (useSelectionCheckbox && useSelectionCheckbox.checked) {
                // Ignore manual typing while locked to selection.
                syncFiltersInputFromSelection();
                return;
            }
            updateFilterPredictions();
            applySearch();
        });
        filtersInput.addEventListener('change', () => {
            if (useSelectionCheckbox && useSelectionCheckbox.checked) {
                syncFiltersInputFromSelection();
                return;
            }
            updateFilterPredictions();
            applySearch();
        });
        filtersInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                hideSuggestions();
                return;
            }
            if (tryRemoveLastCompletedToken(filtersInput, e)) {
                updateFilterPredictions();
                applySearch();
                return;
            }
            if (e.key === 'Enter') {
                const vis = suggestionsEl && suggestionsEl.style.display !== 'none' && lastFilterSuggestionPayload.items.length > 0;
                if (vis) {
                    e.preventDefault();
                    const idx = filterSuggestionHoverIndex >= 0 ? filterSuggestionHoverIndex : 0;
                    const item = lastFilterSuggestionPayload.items[idx];
                    if (item && applyFilterSuggestionPick) {
                        applyFilterSuggestionPick(item, lastFilterSuggestionPayload.beforePart);
                    }
                }
            }
        });
        if (countryInput) {
            countryInput.addEventListener('input', () => {
                updateCountryPredictions();
                applySearch();
            });
            countryInput.addEventListener('change', () => {
                updateCountryPredictions();
                applySearch();
            });
            countryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    hideCountrySuggestions();
                    return;
                }
                if (tryRemoveLastCompletedToken(countryInput, e)) {
                    updateCountryPredictions();
                    applySearch();
                    return;
                }
                if (e.key === 'Enter') {
                    const vis = countrySuggestionsEl && countrySuggestionsEl.style.display !== 'none'
                        && lastCountrySuggestionPayload.items.length > 0;
                    if (vis) {
                        e.preventDefault();
                        const idx = countrySuggestionHoverIndex >= 0 ? countrySuggestionHoverIndex : 0;
                        const item = lastCountrySuggestionPayload.items[idx];
                        if (item && applyCountrySuggestionPick) {
                            applyCountrySuggestionPick(item, lastCountrySuggestionPayload.beforePart);
                        }
                    }
                }
            });
        }
        document.addEventListener('click', (e) => {
            if (suggestionsEl && e.target !== filtersInput && !suggestionsEl.contains(e.target)) {
                hideSuggestions();
            }
            if (countrySuggestionsEl && countryInput && e.target !== countryInput && !countrySuggestionsEl.contains(e.target)) {
                hideCountrySuggestions();
            }
        });
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (window.SoundEffectsManager) {
                    window.SoundEffectsManager.play('filterClear');
                }
                searchInput.value = '';
                if (useSelectionCheckbox) {
                    useSelectionCheckbox.checked = false;
                }
                unlockFiltersInput();
                filtersInput.value = '';
                filtersInput.classList.remove('no-filter-match');
                hideSuggestions();
                if (countryInput) {
                    countryInput.value = '';
                    countryInput.classList.remove('no-filter-match');
                    hideCountrySuggestions();
                }
                this.eventManager.searchQuery = '';
                this.eventManager.searchHeroFilters = [];
                this.eventManager.searchFactionFilters = [];
                this.eventManager.searchNpcFilters = [];
                this.eventManager.searchUnmatchedFilterTokens = [];
                this.eventManager.searchCountryFilters = [];
                if (this.eventManager.applySearchAndRender) {
                    this.eventManager.applySearchAndRender();
                }
            });
        }

        if (useSelectionCheckbox) {
            useSelectionCheckbox.addEventListener('change', () => {
                if (window.SoundEffectsManager) {
                    window.SoundEffectsManager.play(useSelectionCheckbox.checked ? 'filterConfirm' : 'filterClear');
                }
                if (useSelectionCheckbox.checked) {
                    manualFilterText = (filtersInput.value || '').toString();
                    syncFiltersInputFromSelection();
                } else {
                    unlockFiltersInput();
                    filtersInput.value = manualFilterText || '';
                    updateFilterPredictions();
                    applySearch();
                }
            });

            // If the user changes filter selections while this is enabled,
            // keep the Event Manager filter search synced.
            document.addEventListener('click', (e) => {
                if (!useSelectionCheckbox.checked) return;
                const t = e.target;
                const isFilterBtn = !!(t && (t.classList?.contains('filter-btn') || t.closest?.('.filter-btn')));
                const isConfirm = !!(t && (t.id === 'confirmFiltersBtn' || t.closest?.('#confirmFiltersBtn')));
                const isClear = !!(t && (t.id === 'clearFiltersBtn' || t.closest?.('#clearFiltersBtn')));
                if (!isFilterBtn && !isConfirm && !isClear) return;
                setTimeout(() => syncFiltersInputFromSelection(), 0);
            });
        }

        // Per-page controls
        if (perPageInput) {
            // Initialize from EventManager state
            perPageInput.value = (this.eventManager.eventsPerPageSetting || this.eventManager.eventsPerPage || 50).toString();
            perPageInput.addEventListener('input', applyPerPageSettings);
            perPageInput.addEventListener('change', applyPerPageSettings);
        }
        if (showAllCheckbox) {
            showAllCheckbox.checked = !!this.eventManager.showAllEventsInManager;
            showAllCheckbox.addEventListener('change', (e) => {
                if (window.SoundEffectsManager) {
                    window.SoundEffectsManager.play('filterConfirm');
                }
                applyPerPageSettings(e);
            });
        }
        applyPerPageSettings();

        // Initial prediction state
        updateFilterPredictions();
        updateCountryPredictions();
        // Initial selection sync (if checkbox defaulted on for any reason)
        syncFiltersInputFromSelection();
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventListenerService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.EventListenerService = new EventListenerService();
}
