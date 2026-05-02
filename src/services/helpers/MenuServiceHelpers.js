/**
 * MenuServiceHelpers - Utilities for menu creation in ComponentLoaderService
 * Service-compatible versions of menu helpers
 */

import { createGlobeControlButton } from '../../app/helpers/ComponentLoadHelpers.js';
import { EventMarkerManager } from '../../managers/EventMarkerManager.js';
import { isEventSlideEditDevHost } from '../../utils/isEventSlideEditDevHost.js';
import {
    STORY_SECONDARY_PLACES_EDITOR_OPTS,
    STORY_HERO_FILTER_PLACES_OPTS,
    STORY_FACTION_FILTER_PLACES_OPTS,
    STORY_NPC_FILTER_PLACES_OPTS,
    applyStoryFilterPlacesToTarget,
    heroPlacesForEditor,
    factionPlacesForEditor,
    npcPlacesForEditor,
    copyFilterPlaceArraysFromSource,
    getStoryEventFactionTokens,
    getStoryEventHeroTokens,
    getStoryEventNpcTokens
} from '../../utils/StoryFilterPlacesSync.js';

function teardownMenuServiceEventSystemLayout() {
    const st = window.__menuServiceEventSystemLayout;
    if (!st) return;
    if (st.moveChrome) {
        window.removeEventListener('resize', st.moveChrome);
        window.removeEventListener('orientationchange', st.moveChrome);
    }
    if (st.moveDock) {
        window.removeEventListener('resize', st.moveDock);
        window.removeEventListener('orientationchange', st.moveDock);
    }
    window.__menuServiceEventSystemLayout = null;
}

function sweepMenuServiceEventSystemDockOrphans() {
    const ids = [
        'prevPageBtn',
        'prevEventBtn',
        'nextEventBtn',
        'nextPageBtn',
        'globalImageToggle',
        'filtersToggle',
        'eventsManageToggle',
        'pageInput',
        'pageTotal',
    ];
    ids.forEach((id) => document.getElementById(id)?.remove());
    document.querySelectorAll('.page-input-container').forEach((el) => el.remove());
}

function ensureMenuServiceDockGlobeRailCenterRestored() {
    if (document.getElementById('dockGlobeRailCenter')) return;
    const el = document.createElement('div');
    el.id = 'dockGlobeRailCenter';
    el.className = 'dock-globe-rail dock-globe-rail--center';
    el.setAttribute('aria-label', 'Pagination and navigation');
    const left = document.getElementById('dockGlobeRailLeft');
    if (left?.parentNode) {
        left.parentNode.insertBefore(el, left.nextSibling);
    } else {
        document.body.appendChild(el);
    }
}

/** WAAPI keyframes for page turn animation - matches globe implementation */
function thumbPageTurnShrinkKeyframes(isThumbsDesktop, locked) {
    if (isThumbsDesktop) {
        const from = locked
            ? { opacity: 0.5, transform: 'skewX(-11deg)' }
            : { opacity: 1, transform: 'skewX(-11deg) scale(1)' };
        const to = { opacity: 0, transform: 'skewX(-11deg) scale(0.6)' };
        return [from, to];
    }
    const from = locked ? { opacity: 0.5 } : { opacity: 1 };
    const to = { opacity: 0 };
    return [from, to];
}

function thumbPageTurnGrowKeyframes(isThumbsDesktop, locked) {
    if (isThumbsDesktop) {
        const from = {
            opacity: 0,
            transform: 'skewX(-11deg) scale(0.6)'
        };
        const to = locked
            ? { opacity: 0.5, transform: 'skewX(-11deg) scale(1)' }
            : { opacity: 1, transform: 'skewX(-11deg) scale(1)' };
        return [from, to];
    }
    const from = { opacity: 0 };
    const to = locked ? { opacity: 0.5 } : { opacity: 1 };
    return [from, to];
}

/**
 * Updates standalone pagination thumbnails based on active filters
 * Locks (disables/dims) thumbnails for events that don't match filters
 */
function updateStandalonePaginationForFilters() {
    const activeFilters = window.standaloneActiveFilters || new Set();
    const events = window.eventManager?.getDockTimelineEvents?.() || [];
    const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
    
    if (!buttons.length) return;
    
    const eventsPerPage = 10;
    const currentPage = window.standaloneEventSlide?.currentPage || 1;
    const startIndex = (currentPage - 1) * eventsPerPage;
    
    buttons.forEach((btn, index) => {
        const eventIndex = startIndex + index;
        const event = events[eventIndex];
        
        if (!event) {
            btn.style.display = 'none';
            return;
        }
        
        // Import check since this is a module
        const shouldLock = typeof window.shouldEventBeLocked === 'function' 
            ? window.shouldEventBeLocked(event, activeFilters)
            : (activeFilters.size > 0 && !checkEventMatchesFilters(event, activeFilters));
        
        if (shouldLock) {
            btn.disabled = true;
            btn.classList.add('locked');
            btn.style.setProperty('opacity', '0.5', 'important');
            btn.style.setProperty('filter', 'none', 'important');
            btn.style.pointerEvents = 'none';
        } else {
            btn.disabled = false;
            btn.classList.remove('locked');
            btn.style.setProperty('opacity', '1', 'important');
            btn.style.setProperty('filter', 'none', 'important');
            btn.style.display = 'flex';
            btn.style.pointerEvents = 'auto';
            // Debug visual state
            console.log(`[VISUAL MSH] #${eventIndex} UNLOCKED: opacity='${btn.style.opacity}', filter='${btn.style.filter}', classList='${btn.classList.value}'`);
        }
    });
    
    // Update slider ticks for filter hits
    updateStandaloneSliderTicks(activeFilters, events, eventsPerPage, currentPage);
    
    // === GLOBE INTEGRATION ===
    // Sync filters to Globe markers via EventMarkerManager (if it exists)
    if (window.globeEventMarkerManager) {
        window.globeEventMarkerManager.applyFilters();
    }
}

/**
 * Same rule as dock thumbs / event list: first variant (or root) must have a non-empty description
 */
function eventRootSlotMissingDescription(rootEvent) {
    if (!rootEvent) return true;
    // Get display event (first variant if available, otherwise root)
    const displayEv = rootEvent.variants?.[0] || rootEvent;
    const d = displayEv?.description;
    if (!d) return true;
    
    // Strip HTML tags to check for actual content
    const textContent = d.replace(/<[^>]*>/g, '').trim();
    
    // Also treat "No description available." as empty
    if (textContent === 'No description available.' || textContent === 'No description available') {
        return true;
    }
    
    return textContent.length === 0;
}

/**
 * Updates slider ticks to show filter hits
 * Only sub-ticks (event-page-slider-tick--sub) get the filter-hit styling
 * Each sub-tick represents the gap between two consecutive events
 */
function updateStandaloneSliderTicks(activeFilters, events, eventsPerPage, currentPage) {
    const ticksEl = document.getElementById('eventPageSliderTicks');
    if (!ticksEl) return;
    
    // Clear existing filter-hit classes
    ticksEl.querySelectorAll('.event-page-slider-tick--filter-hit').forEach(tick => {
        tick.classList.remove('event-page-slider-tick--filter-hit');
    });
    
    if (!activeFilters || activeFilters.size === 0) return;
    
    // Get only sub-ticks (these represent event boundaries)
    const subTicks = ticksEl.querySelectorAll('.event-page-slider-tick--sub');
    if (!subTicks.length) return;
    
    const totalEvents = events.length;
    const totalPages = Math.ceil(totalEvents / eventsPerPage);
    
    // Helper to check if event matches filters
    const shouldLock = (event) => {
        if (!event) return true;
        if (typeof window.shouldEventBeLocked === 'function') {
            return window.shouldEventBeLocked(event, activeFilters);
        }
        return activeFilters.size > 0 && !checkEventMatchesFilters(event, activeFilters);
    };
    
    // Map each sub-tick to its corresponding event index
    // Sub-ticks are created as: for each page, for k=1 to onPage-1
    let subTickIndex = 0;
    for (let p = 0; p < totalPages && subTickIndex < subTicks.length; p++) {
        const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
        if (onPage <= 1) continue; // No sub-ticks for pages with 0-1 events
        
        for (let k = 1; k < onPage && subTickIndex < subTicks.length; k++) {
            // This sub-tick represents the boundary between events (p*eventsPerPage + k-1) and (p*eventsPerPage + k)
            const leftEventIndex = p * eventsPerPage + (k - 1);
            const rightEventIndex = p * eventsPerPage + k;
            
            // Check if either event matches the filters (green if match on either side)
            const leftPasses = leftEventIndex < totalEvents && !shouldLock(events[leftEventIndex]);
            const rightPasses = rightEventIndex < totalEvents && !shouldLock(events[rightEventIndex]);
            
            if (leftPasses || rightPasses) {
                subTicks[subTickIndex].classList.add('event-page-slider-tick--filter-hit');
            }
            
            subTickIndex++;
        }
    }
}

/**
 * Simple filter check for standalone mode
 */
function checkEventMatchesFilters(event, activeFilters) {
    if (!activeFilters || activeFilters.size === 0) return true;
    const filters = Array.from(activeFilters);
    const heroMatch = getStoryEventHeroTokens(event).some((f) => filters.includes(f));
    const factionMatch = getStoryEventFactionTokens(event).some((f) => filters.includes(f));
    const npcMatch = getStoryEventNpcTokens(event).some((n) => filters.includes(n));
    return heroMatch || factionMatch || npcMatch;
}

/**
 * Detects if running on GitHub Pages
 * @returns {boolean}
 */
export function isGitHubPages() {
    const hostname = window.location.hostname;
    return hostname.includes('github.io') || 
           hostname.includes('github.com') ||
           (hostname === 'localhost' && window.location.port === '');
}

/**
 * Creates a main menu button (service-compatible)
 * @param {Object} config - Button configuration
 * @param {string} config.id - Button ID
 * @param {string} config.title - Button title
 * @param {string} config.imagePath - Path to button image
 * @param {string} config.label - Button label text
 * @param {string} config.description - Button description text
 * @returns {HTMLElement} - The created button
 */
export function createMenuButton({ id, title, imagePath, label, description }) {
    const button = document.createElement('button');
    button.id = id;
    button.className = 'main-menu-btn';
    button.title = title;
    button.innerHTML = `
        <div class="main-menu-image-container">
            <img src="${imagePath}" alt="${title}">
        </div>
        <div class="main-menu-label-container">
            <div class="main-menu-label">${label}</div>
            <div class="main-menu-description">${description}</div>
        </div>
    `;
    return button;
}

/**
 * Removes old test buttons if they exist
 * @param {Object} statusService - Status service for updates (optional)
 */
export function removeOldTestButtons(statusService) {
    const oldGlobeBtn = document.getElementById('runGlobeBtn');
    const oldGlossaryBtn = document.getElementById('runGlossaryBtn');
    const oldBiographyBtn = document.getElementById('runBiographyBtn');
    
    if (oldGlobeBtn && oldGlobeBtn.classList.contains('test-run-button')) {
        oldGlobeBtn.remove();
    }
    if (oldGlossaryBtn && oldGlossaryBtn.classList.contains('test-run-button')) {
        oldGlossaryBtn.remove();
    }
    if (oldBiographyBtn && oldBiographyBtn.classList.contains('test-run-button')) {
        oldBiographyBtn.remove();
    }
}

/**
 * Creates menu buttons container with all buttons
 * @param {Object} statusService - Status service for updates
 * @returns {HTMLElement} - The menu buttons container
 */
export function createMenuButtonsContainer(statusService) {
    if (statusService) {
        statusService.update('Creating main menu buttons...', 'info');
    }

    const menuButtons = document.createElement('div');
    menuButtons.className = 'main-menu-buttons';

    // Interactive Globe/Map button (always shown)
    const startOnMap = localStorage.getItem('mapGlobePreToggle') === 'true';
    const globeBtn = createMenuButton({
        id: 'runGlobeBtn',
        title: startOnMap ? 'Interactive Map' : 'Interactive Globe',
        imagePath: 'assets/images/menu/Global%20Timeline.png',
        label: startOnMap ? 'Interactive Map' : 'Interactive Globe',
        description: startOnMap 
            ? 'Visualize the story of Overwatch through a 2D map'
            : 'Visualize the story of Overwatch through a 3D globe'
    });
    menuButtons.appendChild(globeBtn);

    // Connection Codex button (always shown now)
    const glossaryBtn = createMenuButton({
        id: 'runGlossaryBtn',
        title: 'Connection Codex',
        imagePath: 'assets/images/menu/Concept%20Glossary.png',
        label: 'Connection Codex',
        description: 'Study how everything Connects in the Conspiracy Board'
    });
    menuButtons.appendChild(glossaryBtn);

    // Story Archive button (always shown)
    const biographyBtn = createMenuButton({
        id: 'runBiographyBtn',
        title: 'Story Archive',
        imagePath: 'assets/images/menu/Character%20Bios.png',
        label: 'Story Archive',
        description: 'Explore the Story and Concepts through a series of Slides'
    });
    menuButtons.appendChild(biographyBtn);

    // Auto-preload checkbox (first)
    const autoPreloadContainer = document.createElement('label');
    autoPreloadContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: #aaa;
        cursor: pointer;
        user-select: none;
    `;
    autoPreloadContainer.title = 'Automatically load Event System when opening Story Archive, Interactive Globe, or Connection Codex';

    const autoPreloadCheckbox = document.createElement('input');
    autoPreloadCheckbox.type = 'checkbox';
    autoPreloadCheckbox.id = 'autoPreloadEventSystem';
    autoPreloadCheckbox.style.cssText = `
        width: 14px;
        height: 14px;
        cursor: pointer;
    `;
    // Restore saved state, default to checked for GitHub Pages
    const savedAutoPreload = localStorage.getItem('autoPreloadEventSystem');
    const isGitHubPages = window.location.hostname.includes('github.io');
    if (savedAutoPreload === null) {
        autoPreloadCheckbox.checked = isGitHubPages ? true : false;
        localStorage.setItem('autoPreloadEventSystem', autoPreloadCheckbox.checked);
    } else {
        autoPreloadCheckbox.checked = savedAutoPreload === 'true';
    }

    const autoPreloadLabel = document.createElement('span');
    autoPreloadLabel.textContent = 'Auto preload';

    autoPreloadContainer.appendChild(autoPreloadCheckbox);
    autoPreloadContainer.appendChild(autoPreloadLabel);

    // Hide auto preload container on GitHub Pages
    if (isGitHubPages) {
        autoPreloadContainer.style.display = 'none';
    }

    // Save checkbox state on change
    autoPreloadCheckbox.addEventListener('change', () => {
        localStorage.setItem('autoPreloadEventSystem', autoPreloadCheckbox.checked);
    });

    // Map/Globe pre-toggle badge (second) - styled like globe-control-btn
    const mapGlobeToggleContainer = document.createElement('button');
    mapGlobeToggleContainer.className = 'globe-control-btn';
    mapGlobeToggleContainer.style.cssText = `
        position: relative;
        inset: auto;
        width: auto;
        min-width: 160px;
        height: 40px;
        background: rgba(13, 71, 161, 0.35);
        border-style: solid;
        border-width: 2px 2px 2px 6px;
        border-color: rgba(255, 255, 255, 0.93);
        border-radius: 4px;
        padding: 0 12px;
        transform: skewX(-11deg);
        gap: 8px;
        color: white;
        font-family: var(--font-control-bold, var(--font-default));
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.45);
        user-select: none;
        line-height: 1;
    `;
    mapGlobeToggleContainer.title = 'Select starting view for Interactive Globe: Globe (3D) or Map (2D)';

    // Icon span
    const mapGlobeIcon = document.createElement('span');
    mapGlobeIcon.id = 'mapGlobePreToggleIcon';
    mapGlobeIcon.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        transform: skewX(11deg);
    `;
    // Default to map on mobile, globe on desktop (if not already set in localStorage)
    const isMobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const savedMapGlobeToggle = localStorage.getItem('mapGlobePreToggle');
    let startOnMapInitial;
    if (savedMapGlobeToggle === null) {
        startOnMapInitial = isMobile; // Mobile = map, Desktop = globe
        localStorage.setItem('mapGlobePreToggle', startOnMapInitial.toString());
    } else {
        startOnMapInitial = savedMapGlobeToggle === 'true';
    }
    mapGlobeIcon.innerHTML = `<img src="${startOnMapInitial ? 'assets/images/icons/Switch to Flat Icon.png' : 'assets/images/icons/Switch to Globe Icon.png'}" alt="Map/Globe" style="width: 100%; height: 100%; object-fit: contain;">`;

    const mapGlobeLabel = document.createElement('span');
    mapGlobeLabel.id = 'mapGlobePreToggleLabel';
    mapGlobeLabel.textContent = startOnMapInitial ? 'Starts on Map' : 'Starts on Globe';
    mapGlobeLabel.style.cssText = `
        transform: skewX(11deg);
        white-space: nowrap;
    `;

    mapGlobeToggleContainer.appendChild(mapGlobeIcon);
    mapGlobeToggleContainer.appendChild(mapGlobeLabel);

    // Toggle state on click
    mapGlobeToggleContainer.addEventListener('click', () => {
        const currentStartOnMap = localStorage.getItem('mapGlobePreToggle') === 'true';
        const newStartOnMap = !currentStartOnMap;
        localStorage.setItem('mapGlobePreToggle', newStartOnMap);
        
        // Play switch map sound
        if (window.SoundEffectsManager) {
            window.SoundEffectsManager.play('switchMap');
        }
        
        // Orange flash feedback
        if (typeof window.flashButton === 'function') {
            window.flashButton(mapGlobeToggleContainer, 'flash-orange');
        } else {
            // Manual flash if flashButton not available
            mapGlobeToggleContainer.style.transition = 'background 0.15s ease';
            const originalBg = mapGlobeToggleContainer.style.background;
            mapGlobeToggleContainer.style.background = 'rgba(255, 152, 0, 0.6)';
            setTimeout(() => {
                mapGlobeToggleContainer.style.background = originalBg;
            }, 150);
        }
        
        // Update icon
        const iconImg = mapGlobeIcon.querySelector('img');
        if (iconImg) {
            iconImg.src = newStartOnMap ? 'assets/images/icons/Switch to Flat Icon.png' : 'assets/images/icons/Switch to Globe Icon.png';
        }
        
        // Update label text
        mapGlobeLabel.textContent = newStartOnMap ? 'Starts on Map' : 'Starts on Globe';
        
        // Update header button name/description
        const headerGlobeBtn = document.getElementById('headerInteractiveGlobeBtn');
        if (headerGlobeBtn) {
            const labelEl = headerGlobeBtn.querySelector('.header-hub-btn-label');
            if (labelEl) labelEl.textContent = newStartOnMap ? 'Interactive Map' : 'Interactive Globe';
            headerGlobeBtn.title = newStartOnMap ? 'Interactive Map' : 'Interactive Globe';
            const iconSpan = document.getElementById('headerInteractiveGlobeIcon');
            if (iconSpan) iconSpan.alt = newStartOnMap ? 'Interactive Map' : 'Interactive Globe';
        }
        
        // Update main menu button name/description
        const mainMenuGlobeBtn = document.getElementById('runGlobeBtn');
        if (mainMenuGlobeBtn) {
            const labelEl = mainMenuGlobeBtn.querySelector('.main-menu-label');
            const descEl = mainMenuGlobeBtn.querySelector('.main-menu-external-label__desc');
            if (labelEl) labelEl.textContent = newStartOnMap ? 'Interactive Map' : 'Interactive Globe';
            if (descEl) {
                // Fade out, change text, fade in
                descEl.style.opacity = '0';
                setTimeout(() => {
                    descEl.textContent = newStartOnMap 
                        ? 'Visualize the story of Overwatch through a 2D map'
                        : 'Visualize the story of Overwatch through a 3D globe';
                    descEl.style.opacity = '1';
                }, 150);
            }
            mainMenuGlobeBtn.title = newStartOnMap ? 'Interactive Map' : 'Interactive Globe';
        }
    });

    // Event System Load Out button (small, below main buttons)
    const testBtn = document.createElement('button');
    testBtn.id = 'testBtn';
    testBtn.className = 'test-btn';
    testBtn.textContent = 'LOAD Event System Load Out';
    testBtn.style.cssText = `
        margin-top: 20px;
        padding: 8px 16px;
        font-size: 12px;
        background: #333;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
        cursor: pointer;
        align-self: center;
    `;
    testBtn.addEventListener('click', async () => {
        console.log('[MenuServiceHelpers] testBtn clicked');
        const isLoaded = testBtn.dataset.loaded === 'true';
        console.log('[MenuServiceHelpers] isLoaded =', isLoaded);

        if (!isLoaded) {
            // LOAD
            if (statusService) statusService.update('Loading Event System...', 'info');
            try {
                teardownMenuServiceEventSystemLayout();
                sweepMenuServiceEventSystemDockOrphans();

                // Create event buttons (these are no longer pre-created by loadHeaderNavButtons)
                createGlobeControlButton({
                    id: 'filtersToggle',
                    className: 'dock-globe-rail__btn',
                    title: 'Open Filters',
                    label: 'Filters',
                    iconPath: 'assets/images/icons/Filter Icon.png',
                    iconAlt: 'Filters',
                    parentId: 'dockGlobeRailCenter',
                    baseClass: 'globe-control-btn',
                    headerOrder: 5,
                    mobileParentId: 'dockGlobeRailLeft',
                    mobileBaseClass: 'globe-control-btn',
                    mobileClassName: 'dock-globe-rail__btn',
                    desktopParentId: 'dockGlobeRailCenter',
                    desktopClassName: 'dock-globe-rail__btn'
                });

                const storedGlobalImg = localStorage.getItem('globalImageToggle');
                const globalImageToggleState = storedGlobalImg === null ? true : storedGlobalImg !== 'false';
                if (storedGlobalImg === null) {
                    localStorage.setItem('globalImageToggle', 'true');
                }
                createGlobeControlButton({
                    id: 'globalImageToggle',
                    className: 'dock-globe-rail__btn',
                    title: 'Toggle Image Display',
                    label: globalImageToggleState ? 'Image On' : 'Image Off',
                    iconPath: 'assets/images/icons/Image Display Icon.png',
                    iconAlt: 'Images',
                    parentId: 'dockGlobeRailCenter',
                    baseClass: 'globe-control-btn',
                    headerOrder: 6,
                    mobileParentId: 'dockGlobeRailLeft',
                    mobileBaseClass: 'globe-control-btn',
                    mobileClassName: 'dock-globe-rail__btn',
                });

                setTimeout(() => {
                    const globalImageToggleBtn = document.getElementById('globalImageToggle');
                    if (!globalImageToggleBtn) return;
                    if (globalImageToggleState) {
                        globalImageToggleBtn.classList.add('active');
                    }
                    const newBtn = globalImageToggleBtn.cloneNode(true);
                    globalImageToggleBtn.parentNode.replaceChild(newBtn, globalImageToggleBtn);
                    newBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentState = localStorage.getItem('globalImageToggle') === 'true';
                        const nextState = !currentState;
                        localStorage.setItem('globalImageToggle', nextState.toString());
                        if (window.flashButton) {
                            window.flashButton(newBtn, nextState ? 'flash-green' : 'flash-red');
                        }
                        const labelEl = newBtn.querySelector('.globe-control-btn__label');
                        if (labelEl) {
                            labelEl.textContent = nextState ? 'Image On' : 'Image Off';
                        }
                        if (nextState) {
                            newBtn.classList.add('active');
                        } else {
                            newBtn.classList.remove('active');
                        }

                        // Ensure the event slide is open, then apply image state.
                        const eventSlide = document.getElementById('eventSlide');
                        const isSlideOpen = !!eventSlide?.classList.contains('open');
                        const ss = window.standaloneEventSlide;
                        if (!isSlideOpen && ss?.showStandaloneEventSlide) {
                            const events = window.eventManager?.getDockTimelineEvents?.() || [];
                            let idx = Number.isFinite(ss.currentEventIndex) ? ss.currentEventIndex : 0;
                            if (idx < 0) idx = 0;
                            if (idx >= events.length) idx = Math.max(0, events.length - 1);
                            const eventToOpen = ss.currentEventData || events[idx];
                            if (eventToOpen) {
                                ss._presentationFromDockTimeline = true;
                                ss.showStandaloneEventSlide(eventToOpen, idx);
                            }
                        }

                        setTimeout(() => {
                            const slideNowOpen = !!document.getElementById('eventSlide')?.classList.contains('open');
                            if (!slideNowOpen || !ss) return;
                            if (nextState) {
                                const path = ss.currentImagePath?.trim();
                                if (path && ss.showImageOverlayGradually) {
                                    ss.showImageOverlayGradually(path, 600);
                                }
                            } else if (ss.hideImageOverlayGradually) {
                                ss.hideImageOverlayGradually(600);
                            } else if (ss.hideImageOverlay) {
                                ss.hideImageOverlay();
                            }
                        }, 0);

                        if (window.SoundEffectsManager) {
                            window.SoundEffectsManager.play('imageDisplay');
                        }
                    });
                }, 100);

                // Move Events, Filters buttons, and Page Input Container between dock rail and page controls row
                function moveButtonsToPageControlsRow() {
                    const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                    if (isMobilePortrait) {
                        const runDock =
                            window.__menuHelpersEventSystemLayout?.moveDock ||
                            window.__menuServiceEventSystemLayout?.moveDock;
                        if (typeof runDock === 'function') runDock();
                        return;
                    }

                    const pageInputContainer = document.querySelector('.page-input-container');
                    const centerRail = document.getElementById('dockGlobeRailCenter');
                    if (centerRail && pageInputContainer && pageInputContainer.parentElement !== centerRail) {
                        centerRail.appendChild(pageInputContainer);
                    }
                }

                // Run immediately
                moveButtonsToPageControlsRow();

                window.__menuServiceEventSystemLayout = {
                    moveChrome: moveButtonsToPageControlsRow,
                    moveDock: null,
                };
                window.addEventListener('resize', moveButtonsToPageControlsRow);
                window.addEventListener('orientationchange', moveButtonsToPageControlsRow);

                // Initialize EventManager if not already loaded
                if (!window.eventManager) {
                    const EventManagerModule = await import('../../managers/EventManager.js');
                    window.eventManager = new EventManagerModule.default();
                    await window.eventManager.init();
                }

                // Initialize EventMarkerManager for Globe (if Globe is loaded)
                if (window.globeController?.sceneModel && !window.globeEventMarkerManager) {
                    if (statusService) statusService.update('Initializing event markers...', 'info');
                    window.globeEventMarkerManager = new EventMarkerManager(
                        window.globeController.sceneModel,
                        window.globeController.dataModel
                    );
                    // Add event markers to the globe
                    await window.globeEventMarkerManager.addEventMarkers(true);
                    if (statusService) statusService.update('✓ Event markers added', 'success');
                }

                // Add timeline-loaded class to footer (enables background + Atlas News logo)
                const footer = document.querySelector('footer');
                if (footer) {
                    footer.classList.add('timeline-loaded');
                }

                // Initialize news ticker
                if (!window.newsTickerService) {
                    window.newsTickerService = new window.NewsTickerService();
                }
                window.newsTickerService.init();

                // Note: News ticker will be updated by pagination system with current page events

                // Wire up Event Manager panel controls (no dock toggle — panel only via e.g. All Events)
                if (window.eventManager && !window.eventManager.listenersSetup) {
                    window.eventManager.setupEventListeners();
                }

                // Create pagination dock for standalone mode
                const panelHelpers = window.ServicePanelHelpers || window.PanelHelpers;
                if (panelHelpers?.createEventPagination) {
                    if (statusService) statusService.update('Creating pagination dock...', 'info');
                    panelHelpers.createEventPagination(statusService);
                }

                // Create filters panel for standalone mode (decoupled from globe)
                if (panelHelpers?.createFiltersPanel) {
                    if (statusService) statusService.update('Creating filters panel...', 'info');
                    panelHelpers.createFiltersPanel(statusService);
                }

                // Move page input container and nav buttons to dock rail on desktop, page controls row on mobile
                setTimeout(() => {
                    const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                    const pageInputContainer = document.querySelector('.page-input-container');
                    const pageControlsRow = document.querySelector('.page-controls-row--mobile-only');
                    const centerRail = document.getElementById('dockGlobeRailCenter');
                    const rightRail = document.getElementById('dockGlobeRailRight');
                    const prevPageBtn = document.getElementById('prevPageBtn');
                    const nextPageBtn = document.getElementById('nextPageBtn');
                    const prevEventBtn = document.getElementById('prevEventBtn');
                    const nextEventBtn = document.getElementById('nextEventBtn');
                    const globalImageToggleBtn = document.getElementById('globalImageToggle');
                    const filtersBtn = document.getElementById('filtersToggle');
                    
                    const centerChromeDockBarOrder = [
                        prevPageBtn,
                        prevEventBtn,
                        globalImageToggleBtn,
                        pageInputContainer,
                        filtersBtn,
                        nextEventBtn,
                        nextPageBtn,
                    ];
                    const centerChromePaginationOnly = [
                        prevPageBtn,
                        prevEventBtn,
                        pageInputContainer,
                        nextEventBtn,
                        nextPageBtn,
                    ];

                    function clearDockChromeMoveStyles(el) {
                        if (!el) return;
                        el.style.position = '';
                        el.style.top = '';
                        el.style.left = '';
                        el.style.right = '';
                        el.style.bottom = '';
                    }

                    // Function to move elements to correct rails
                    function moveElements() {
                        const trapMount = document.querySelector('.pagination-dock-top-trapezoid');
                        if (trapMount && centerRail && centerRail.parentElement !== trapMount) {
                            trapMount.appendChild(centerRail);
                        }
                        const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                        const useTrapezoidSideChrome = !!(trapMount && !isMobilePortrait);
                        const centerTargets =
                            isMobilePortrait && pageControlsRow
                                ? centerChromeDockBarOrder
                                : useTrapezoidSideChrome
                                  ? centerChromeDockBarOrder
                                  : centerChromePaginationOnly;

                        /*
                         * Mobile portrait: one ordered row (matches thumb row: page outside, event inside).
                         * replaceChildren avoids appendChild reorder bugs between center vs right-rail passes.
                         */
                        if (isMobilePortrait && pageControlsRow) {
                            const pageInputWrap =
                                document.querySelector('#eventPagination .page-input-container') ||
                                document.querySelector('.page-input-container');
                            const mobilePortraitChrome = [
                                prevPageBtn,
                                prevEventBtn,
                                globalImageToggleBtn,
                                pageInputWrap,
                                filtersBtn,
                                nextEventBtn,
                                nextPageBtn,
                            ].filter(Boolean);
                            mobilePortraitChrome.forEach((element) => {
                                if (!element || !element.isConnected) return;
                                clearDockChromeMoveStyles(element);
                            });
                            if (mobilePortraitChrome.length) {
                                pageControlsRow.replaceChildren(...mobilePortraitChrome);
                            }
                        } else {
                            centerTargets.forEach((element) => {
                                // Skip elements that no longer exist in document (unloaded)
                                if (!element || !element.isConnected) return;
                                if (centerRail) {
                                    if (element.parentElement !== centerRail) {
                                        element.style.position = '';
                                        element.style.top = '';
                                        element.style.left = '';
                                        element.style.right = '';
                                        element.style.bottom = '';
                                        centerRail.appendChild(element);
                                    }
                                }
                            });

                            // Keep trapezoid center rail deterministic: exactly 7 controls in order.
                            // Use .page-input-container (not #pageInput): moving the input alone leaves "/ 1" orphaned and appendChild puts it after #nextPageBtn.
                            if (useTrapezoidSideChrome && centerRail) {
                                const pageInputWrap =
                                    document.querySelector('#eventPagination .page-input-container') ||
                                    document.querySelector('.page-input-container');
                                const orderedChrome = [
                                    document.getElementById('prevPageBtn'),
                                    document.getElementById('prevEventBtn'),
                                    document.getElementById('globalImageToggle'),
                                    pageInputWrap,
                                    document.getElementById('filtersToggle'),
                                    document.getElementById('nextEventBtn'),
                                    document.getElementById('nextPageBtn'),
                                ].filter(Boolean);
                                orderedChrome.forEach((element) => {
                                    if (!element.isConnected) return;
                                    clearDockChromeMoveStyles(element);
                                    centerRail.appendChild(element);
                                });
                            }

                            const rightRailTargets = useTrapezoidSideChrome
                                ? []
                                : [globalImageToggleBtn, filtersBtn];

                            rightRailTargets.forEach((element) => {
                                // Skip elements that no longer exist in document (unloaded)
                                if (!element || !element.isConnected) return;
                                if (rightRail) {
                                    if (element.parentElement !== rightRail) {
                                        clearDockChromeMoveStyles(element);
                                        rightRail.appendChild(element);
                                    }
                                }
                            });

                            if (!useTrapezoidSideChrome && !isMobilePortrait && rightRail) {
                                [globalImageToggleBtn, filtersBtn].forEach((element) => {
                                    // Skip elements that no longer exist in document (unloaded)
                                    if (!element || !element.isConnected) return;
                                    if (element.parentElement !== rightRail) {
                                        clearDockChromeMoveStyles(element);
                                        rightRail.appendChild(element);
                                    }
                                });
                            }
                        }

                    }

                    // Run once on init - no MutationObserver to prevent infinite loops
                    moveElements();

                    if (!window.__menuServiceEventSystemLayout) {
                        window.__menuServiceEventSystemLayout = {};
                    }
                    window.__menuServiceEventSystemLayout.moveDock = moveElements;
                    window.addEventListener('resize', moveElements);
                    window.addEventListener('orientationchange', moveElements);
                }, 200);

                // Initialize FilterService for standalone mode
                if (window.FilterService && typeof window.FilterService.init === 'function') {
                    window.FilterService.init();
                    if (statusService) statusService.update('✓ Filter panel initialized', 'success');
                }

                // Setup standalone filter state (decoupled from globe sceneModel)
                if (!window.standaloneActiveFilters) {
                    window.standaloneActiveFilters = new Set();
                }

                // Initialize SoundEffectsManager and preload event-related sounds
                if (window.SoundEffectsManager && typeof window.SoundEffectsManager.init === 'function') {
                    if (statusService) statusService.update('Loading sound effects...', 'info');
                    window.SoundEffectsManager.init();
                    if (statusService) statusService.update('✓ Sound effects loaded', 'success');
                }

                // Override FilterService confirm handler for standalone mode
                // Set flag to prevent FilterService from overriding these handlers
                window._menuHelpersFilterHandlersInstalled = true;
                
                const confirmFiltersBtn = document.getElementById('confirmFiltersBtn');
                if (confirmFiltersBtn) {
                    const newConfirmBtn = confirmFiltersBtn.cloneNode(true);
                    confirmFiltersBtn.parentNode.replaceChild(newConfirmBtn, confirmFiltersBtn);
                    newConfirmBtn.addEventListener('click', () => {
                        if (window.FilterService?.stateManager?.selectedFilters) {
                            window.standaloneActiveFilters = new Set(window.FilterService.stateManager.selectedFilters);
                        }
                        if (window.SoundEffectsManager) {
                            window.SoundEffectsManager.play('filterConfirm');
                        }
                        // Apply filters to pagination
                        updateStandalonePaginationForFilters();
                        // Apply filters to Globe markers (if EventMarkerManager exists)
                        if (window.globeEventMarkerManager) {
                            window.globeEventMarkerManager.applyFilters();
                        }
                        const filtersPanel = document.getElementById('filtersPanel');
                        if (filtersPanel) filtersPanel.classList.remove('open');
                        const filtersToggle = document.getElementById('filtersToggle');
                        if (filtersToggle) filtersToggle.classList.remove('active');
                        if (typeof window.syncFiltersPanelTrapIcon === 'function') {
                            window.syncFiltersPanelTrapIcon();
                        }
                        if (statusService) statusService.update('✓ Filters applied', 'success');
                    });
                }

                // Override Clear button for standalone mode
                const clearFiltersBtn = document.getElementById('clearFiltersBtn');
                if (clearFiltersBtn) {
                    const newClearBtn = clearFiltersBtn.cloneNode(true);
                    clearFiltersBtn.parentNode.replaceChild(newClearBtn, clearFiltersBtn);
                    newClearBtn.addEventListener('click', () => {
                        window.standaloneActiveFilters.clear();
                        if (window.FilterService?.stateManager) {
                            window.FilterService.stateManager.clear();
                        }
                        if (window.SoundEffectsManager) {
                            window.SoundEffectsManager.play('filterClear');
                        }
                        if (window.FilterService?.updateButtonStates) {
                            window.FilterService.updateButtonStates();
                        }
                        // Clear filters from pagination
                        updateStandalonePaginationForFilters();
                        // Clear filters from Globe markers (if EventMarkerManager exists)
                        if (window.globeEventMarkerManager) {
                            window.globeEventMarkerManager.applyFilters();
                        }
                        if (statusService) statusService.update('✓ Filters cleared', 'success');
                    });
                }

                // Show filters toggle button
                const filtersToggle = document.getElementById('filtersToggle');
                if (filtersToggle) {
                    filtersToggle.style.setProperty('display', 'flex', 'important');
                }

                // Initialize standalone Event Slide (decoupled from globe)
                if (!window.standaloneEventSlide) {
                    window.standaloneEventSlide = {
                        currentEventIndex: 0,
                        currentPage: 1, // Track current page for marker display
                        allEvents: [],
                        _presentationFromDockTimeline: true,
                        currentEventData: null,
                        currentVariantIndex: 0,
                        isEditing: false,
                        /** @type {{ archiveSource: string, eventIndex: number, presentationFromDock: boolean }[]} */
                        _slideHistoryStack: [],
                        _slideHistoryRestoring: false,

                        pushSlideHistoryIfOpen() {
                            const panel = document.getElementById('eventSlide');
                            if (!panel?.classList.contains('open')) return;
                            if (this._slideHistoryRestoring) return;
                            const em = window.eventManager;
                            this._slideHistoryStack.push({
                                archiveSource: em?.dataService?.getArchiveSource?.() || 'story',
                                eventIndex: this.currentEventIndex,
                                presentationFromDock: !!this._presentationFromDockTimeline
                            });
                            this.updateBackButtonVisibility();
                        },

                        updateBackButtonVisibility() {
                            const btn = document.getElementById('eventSlideBack');
                            if (!btn) return;
                            const n = this._slideHistoryStack?.length || 0;
                            btn.style.display = n > 0 ? 'inline-flex' : 'none';
                            btn.disabled = n === 0;
                            btn.setAttribute('aria-hidden', n === 0 ? 'true' : 'false');
                        },

                        clearSlideHistory() {
                            if (this._slideHistoryStack) {
                                this._slideHistoryStack.length = 0;
                            }
                            this.updateBackButtonVisibility();
                        },

                        async goBackSlide() {
                            if (!this._slideHistoryStack?.length) return;
                            const prev = this._slideHistoryStack.pop();
                            if (!prev) {
                                this.updateBackButtonVisibility();
                                return;
                            }
                            this._slideHistoryRestoring = true;
                            try {
                                const em = window.eventManager;
                                if (em?.switchStoryArchiveSource) {
                                    await em.switchStoryArchiveSource(prev.archiveSource);
                                }
                                if (prev.presentationFromDock) {
                                    this.showEvent(prev.eventIndex, {});
                                } else {
                                    const list = em?.events || [];
                                    this.showEvent(prev.eventIndex, { eventList: list });
                                }
                            } finally {
                                this._slideHistoryRestoring = false;
                            }
                            this.updateBackButtonVisibility();
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('eventClick');
                            }
                        },

                        /**
                         * @param {number} index
                         * @param {{ eventList?: Array<Object>, keepSlideHistory?: boolean }} [options] - `eventList` = active Event Manager rows; omit for dock. `keepSlideHistory` for relevancy / prev-next while Back stack exists.
                         */
                        showEvent(index, options = {}) {
                            if (!this._slideHistoryRestoring && !options.keepSlideHistory) {
                                this.clearSlideHistory();
                            }
                            const dockList = window.eventManager?.getDockTimelineEvents?.() || [];
                            const events =
                                options.eventList != null ? options.eventList : dockList;
                            if (index < 0 || index >= events.length) return;
                            this.currentEventIndex = index;
                            this.allEvents = events;
                            this._presentationFromDockTimeline =
                                options.eventList == null || events === dockList;
                            
                            const eventData = events[index];
                            this.showStandaloneEventSlide(eventData, index);
                        },
                        
                        showStandaloneEventSlide(eventData, globalIndex) {
                            if (!eventData) return;
                            
                            this.currentEventData = eventData;
                            const isMultiEvent = Array.isArray(eventData.variants) && eventData.variants.length > 0;
                            this.currentVariantIndex = eventData.variantIndex || 0;
                            const displayEvent = isMultiEvent && eventData.variants[this.currentVariantIndex] 
                                ? { ...eventData, ...eventData.variants[this.currentVariantIndex] }
                                : eventData;
                            
                            let eventName = displayEvent.name || eventData.name || 'Unnamed Event';
                            const description = displayEvent.description || '';

                            const useStoryDockImages = !!this._presentationFromDockTimeline;
                            let imagePath = null;
                            if (window.NavigationImageHelpers?.getEventImagePath) {
                                imagePath = window.NavigationImageHelpers.getEventImagePath(
                                    displayEvent,
                                    eventName,
                                    useStoryDockImages ? 'story' : undefined
                                );
                            } else if (window.eventManager?.getEventImagePath) {
                                imagePath = window.eventManager.getEventImagePath(
                                    displayEvent.name,
                                    displayEvent.image,
                                    useStoryDockImages ? 'story' : undefined
                                );
                            } else {
                                imagePath = displayEvent.image || displayEvent.imagePath || null;
                            }
                            
                            // Apply glitch text if enabled
                            if (window.GlitchTextService?.isEnabled?.()) {
                                eventName = window.GlitchTextService.getDisplayEventName(eventName);
                            }
                            
                            this.displaySlide(eventName, imagePath, description, eventData, isMultiEvent, displayEvent);
                            this.updateNavButtons();
                        },
                        
                        displaySlide(eventName, imagePath, description, eventData, isMultiEvent, displayEvent) {
                            const eventSlide = document.getElementById('eventSlide');
                            if (!eventSlide) return;
                            if (!eventSlide.classList.contains('open')) {
                                this.clearSlideHistory();
                            }
                            const eventSlideTitle = document.getElementById('eventSlideTitle');
                            const eventSlideText = document.getElementById('eventSlideText');
                            const eventSlideClose = document.getElementById('eventSlideClose');
                            const eventImageToggle = document.getElementById('eventImageToggle');
                            const variantToggles = document.getElementById('eventVariantToggles');
                            const editBtn = document.getElementById('eventSlideEditBtn');
                            const saveBtn = document.getElementById('eventSlideSaveBtn');
                            const dockStoryPresentationActive = !!this._presentationFromDockTimeline;
                            const archiveSourceSlide = dockStoryPresentationActive
                                ? 'story'
                                : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
                            const isSatelliteArchive = !dockStoryPresentationActive && archiveSourceSlide !== 'story';
                            
                            this.cancelEdit();

                            const relElClear = document.getElementById('eventSlideRelevantLocations');
                            const relSectionClear = document.getElementById('eventRelevantLocationsSection');
                            const heroLocEditClear = document.getElementById('eventSlideHeroLocationsEdit');
                            if (relElClear) {
                                relElClear.innerHTML = '';
                            }
                            if (relSectionClear) {
                                relSectionClear.style.display = 'none';
                            }
                            window.LocationFlagHelpers?.clearBioConnectionsSlideDom?.();
                            if (heroLocEditClear) {
                                heroLocEditClear.setAttribute('hidden', '');
                                heroLocEditClear.style.display = 'none';
                            }
                            
                            // Check for Olivia Colomar
                            const hasOliviaColomar = /Olivia\s+Colomar/gi.test(eventName) || 
                                                      /Olivia\s+Colomar/gi.test(description) ||
                                                      (isMultiEvent && eventData.variants?.some(v => 
                                                          /Olivia\s+Colomar/gi.test(v.name || '') || 
                                                          /Olivia\s+Colomar/gi.test(v.description || '')));
                            
                            // Apply glitch text to both title and description
                            const applyGlitch = (text) => {
                                if (!text) return text;
                                return window.GlitchTextService?.getDisplayText?.(text) || text;
                            };
                            
                            if (eventSlideTitle) eventSlideTitle.innerHTML = applyGlitch(eventName);
                            if (eventSlideText) eventSlideText.innerHTML = applyGlitch(description) || 'No description available.';

                            const eventSlideLocation = document.getElementById('eventSlideLocation');
                            const eventSlideTimelineMeta = document.getElementById('eventSlideTimelineMeta');
                            const targetSlide = displayEvent || eventData;
                            if (!isSatelliteArchive) {
                                if (eventSlideLocation) eventSlideLocation.style.display = 'none';
                                if (eventSlideTimelineMeta) eventSlideTimelineMeta.style.display = 'none';
                            } else {
                                if (eventSlideLocation) eventSlideLocation.style.display = 'none';
                                if (eventSlideTimelineMeta) eventSlideTimelineMeta.style.display = 'none';
                                const relEl = document.getElementById('eventSlideRelevantLocations');
                                const isBioSlide =
                                    archiveSourceSlide === 'heroes'
                                    || archiveSourceSlide === 'factions'
                                    || archiveSourceSlide === 'npcs';
                                if (isBioSlide && relEl) {
                                    window.LocationFlagHelpers?.updateRelevantLocationsSlideFromSecondaryPlaces?.(
                                        targetSlide
                                    );
                                    window.LocationFlagHelpers?.updateBioConnectionsSlideFromEvent?.(targetSlide);
                                }
                            }
                            
                            // Setup glitch toggle button
                            const glitchToggleBtn = document.getElementById('eventGlitchToggle');
                            if (glitchToggleBtn) {
                                if (hasOliviaColomar) {
                                    // Add icon if not present
                                    let iconWrap = glitchToggleBtn.querySelector('.event-glitch-toggle-btn__icon');
                                    if (!iconWrap) {
                                        iconWrap = document.createElement('span');
                                        iconWrap.className = 'event-glitch-toggle-btn__icon';
                                        glitchToggleBtn.appendChild(iconWrap);
                                    }
                                    if (!iconWrap.innerHTML.includes('Hacked.png')) {
                                        iconWrap.innerHTML = `<img class="event-glitch-toggle-img" src="assets/images/misc/Hacked.png" alt="" width="48" height="48" decoding="async" draggable="false" />`;
                                    }
                                    
                                    glitchToggleBtn.style.display = 'inline-flex';
                                    glitchToggleBtn.style.visibility = 'visible';
                                    
                                    // Set initial state
                                    const isEnabled = window.GlitchTextService?.isEnabled?.() || false;
                                    glitchToggleBtn.classList.toggle('event-glitch-toggle-btn--on', isEnabled);
                                    glitchToggleBtn.setAttribute('aria-pressed', String(isEnabled));
                                    glitchToggleBtn.title = isEnabled ? 'Glitch effect on' : 'Glitch effect off';
                                    
                                    glitchToggleBtn.onclick = () => {
                                        const newEnabled = window.GlitchTextService?.toggle?.() || false;
                                        glitchToggleBtn.classList.toggle('event-glitch-toggle-btn--on', newEnabled);
                                        glitchToggleBtn.setAttribute('aria-pressed', String(newEnabled));
                                        glitchToggleBtn.title = newEnabled ? 'Glitch effect on' : 'Glitch effect off';
                                        const currentEvent = isMultiEvent ? eventData.variants[this.currentVariantIndex || 0] : eventData;
                                        if (eventSlideTitle) eventSlideTitle.innerHTML = applyGlitch(currentEvent?.name || eventName);
                                        if (eventSlideText) eventSlideText.innerHTML = applyGlitch(currentEvent?.description || description) || 'No description available.';
                                        setTimeout(wireGlitchClickToggle, 100);
                                        if (window.SoundEffectsManager?.play) {
                                            window.SoundEffectsManager.play(newEnabled ? 'hackOn' : 'hackOff');
                                        }
                                    };
                                    if (window.GlitchTextService?.isEnabled?.()) {
                                        window.GlitchTextService.startAnimation?.();
                                        if (window.SoundEffectsManager?.play) {
                                            setTimeout(() => window.SoundEffectsManager.play('hackOn'), 50);
                                        }
                                    }
                                } else {
                                    glitchToggleBtn.style.display = 'none';
                                    glitchToggleBtn.classList.remove('event-glitch-toggle-btn--on');
                                }
                            }
                            
                            // Wire up click-to-toggle on glitchy text
                            const wireGlitchClickToggle = () => {
                                const containers = eventSlide.querySelectorAll('.glitchy-text-container, .glitchy-text-toggle-target');
                                containers.forEach(el => {
                                    el.style.cursor = 'pointer';
                                    el.onclick = (e) => {
                                        e.stopPropagation();
                                        if (glitchToggleBtn) glitchToggleBtn.click();
                                    };
                                });
                            };
                            setTimeout(wireGlitchClickToggle, 100);
                            
                            if (variantToggles) {
                                variantToggles.innerHTML = '';
                                if (!isSatelliteArchive && isMultiEvent && eventData.variants) {
                                    variantToggles.style.display = 'flex';
                                    eventData.variants.forEach((variant, idx) => {
                                        const btn = document.createElement('button');
                                        btn.className = 'variant-toggle-btn' + (idx === 0 ? ' active' : '');
                                        btn.textContent = variant.name || `Variant ${idx + 1}`;
                                        btn.addEventListener('click', () => {
                                            this.currentVariantIndex = idx;
                                            variantToggles.querySelectorAll('.variant-toggle-btn').forEach(b => b.classList.remove('active'));
                                            btn.classList.add('active');
                                            const v = eventData.variants[idx];
                                            const vName = v.name || variant.name || eventName;
                                            const vDesc = v.description || description;
                                            
                                            // Update title and description
                                            if (eventSlideTitle) eventSlideTitle.innerHTML = applyGlitch(vName);
                                            if (eventSlideText) eventSlideText.innerHTML = applyGlitch(vDesc) || 'No description available.';
                                            
                                            // Update image for variant
                                            const vImagePath = window.eventManager?.getEventImagePath
                                                ? window.eventManager.getEventImagePath(
                                                    v.name,
                                                    v.image,
                                                    !isSatelliteArchive ? 'story' : undefined
                                                )
                                                : v.image;
                                            if (vImagePath) {
                                                this.showImageOverlay(vImagePath);
                                            } else {
                                                this.hideImageOverlay();
                                            }
                                            
                                            this.updateSourcesAndFilters(v);
                                            setTimeout(wireGlitchClickToggle, 100);
                                        });
                                        variantToggles.appendChild(btn);
                                    });
                                } else {
                                    variantToggles.style.display = 'none';
                                }
                            }
                            
                            this.updateSourcesAndFilters(displayEvent);
                            this.wireNavButtons(eventData);
                            this.wireEditButtons(eventData, displayEvent, editBtn, saveBtn, eventSlideTitle, eventSlideText);
                            
                            // Mutual exclusion: opening Event Info closes Filters.
                            const filtersPanel = document.getElementById('filtersPanel');
                            const filtersToggle = document.getElementById('filtersToggle');
                            if (filtersPanel?.classList.contains('open')) {
                                filtersPanel.classList.remove('open');
                                filtersToggle?.classList.remove('active');
                            }
                            eventSlide.classList.add('open');

                            if (eventSlideClose) {
                                eventSlideClose.onclick = () => {
                                    console.log('[eventSlideClose MenuServiceHelpers] Close button clicked');
                                    this.cancelEdit();
                                    this.clearSlideHistory();
                                    eventSlide.classList.remove('open');
                                    this.hideImageOverlay();
                                    
                                    // Reset camera when closing event slide
                                    console.log('[eventSlideClose MenuServiceHelpers] Resetting camera on close');
                                    if (window.globeController?.interactionController) {
                                        console.log('[eventSlideClose MenuServiceHelpers] Calling stopFollowingStation');
                                        window.globeController.interactionController.stopFollowingStation();
                                        console.log('[eventSlideClose MenuServiceHelpers] Calling restorePlanesVisibility');
                                        window.globeController.interactionController.restorePlanesVisibility?.();
                                    }
                                    if (window.globeController?.cameraControlService) {
                                        console.log('[eventSlideClose MenuServiceHelpers] Calling resetCameraToDefault');
                                        window.globeController.cameraControlService.resetCameraToDefault();
                                    }
                                    
                                    if (window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('eventClick');
                                    }
                                };
                            }
                            
                            if (eventImageToggle) {
                                eventImageToggle.onclick = () => this.toggleImageOverlay(imagePath);
                            }
                            
                            setTimeout(() => {
                                if (imagePath) {
                                    this.showImageOverlay(imagePath);
                                } else {
                                    this.hideImageOverlay();
                                }
                            }, 100);

                            this.updateBackButtonVisibility?.();
                        },
                        
                        wireEditButtons(eventData, displayEvent, editBtn, saveBtn, titleEl, textEl) {
                            if (!editBtn || !saveBtn) return;

                            if (!isEventSlideEditDevHost()) {
                                editBtn.style.display = 'none';
                                saveBtn.style.display = 'none';
                                editBtn.disabled = true;
                                saveBtn.disabled = true;
                                return;
                            }
                            
                            this.isEditing = false;
                            editBtn.textContent = 'Edit';
                            editBtn.style.display = 'block';
                            saveBtn.style.display = 'none';
                            
                            const newEditBtn = editBtn.cloneNode(true);
                            const newSaveBtn = saveBtn.cloneNode(true);
                            editBtn.parentNode.replaceChild(newEditBtn, editBtn);
                            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
                            
                            newEditBtn.onclick = () => {
                                if (this.isEditing) {
                                    this.cancelEdit(newEditBtn, newSaveBtn);
                                } else {
                                    this.startFullEdit(eventData, displayEvent, newEditBtn, newSaveBtn);
                                }
                            };
                            
                            newSaveBtn.onclick = () => {
                                this.saveFullEdit(eventData, newEditBtn, newSaveBtn);
                            };
                        },
                        
                        startFullEdit(eventData, displayEvent, editBtn, saveBtn) {
                            this.isEditing = true;
                            this.editTarget = { eventData, displayEvent };
                            this.originalState = JSON.parse(JSON.stringify(eventData));

                            const dockStoryPresentationActive = !!this._presentationFromDockTimeline;
                            const archiveSourceEdit = dockStoryPresentationActive
                                ? 'story'
                                : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
                            const isSatelliteArchiveEdit = !dockStoryPresentationActive && archiveSourceEdit !== 'story';
                            
                            const eventSlide = document.getElementById('eventSlide');
                            const eventSlideScrollable = document.getElementById('eventSlideScrollable');
                            const titleEl = document.getElementById('eventSlideTitle');
                            const textEl = document.getElementById('eventSlideText');
                            
                            eventSlide?.classList.add('event-slide--inline-editing');
                            const orderRow = document.getElementById('eventSlideOrderRow');
                            if (!isSatelliteArchiveEdit && orderRow) {
                                orderRow.removeAttribute('hidden');
                                orderRow.setAttribute('aria-hidden', 'false');
                            }

                            if (titleEl) {
                                titleEl.contentEditable = 'true';
                                titleEl.setAttribute('spellcheck', 'true');
                            }
                            if (textEl) {
                                textEl.contentEditable = 'true';
                                textEl.setAttribute('spellcheck', 'true');
                            }
                            
                            let editor = document.getElementById('eventSlideInlineEditor');
                            if (!editor) {
                                editor = this.createInlineEditor();
                                eventSlideScrollable?.insertBefore(editor, eventSlideScrollable.firstChild);
                            }
                            editor.style.display = 'block';
                            
                            this.populateInlineEditor(eventData, displayEvent);

                            const editorAfter = document.getElementById('eventSlideInlineEditor');
                            if (editorAfter && isSatelliteArchiveEdit) {
                                editorAfter.style.display = 'none';
                            }

                            const relElHero = document.getElementById('eventSlideRelevantLocations');
                            const relSectionHero = document.getElementById('eventRelevantLocationsSection');
                            const heroLocEdit = document.getElementById('eventSlideHeroLocationsEdit');
                            const locContainer = document.getElementById('eventSlideEditRelevantLocations');
                            const isBioEdit =
                                archiveSourceEdit === 'heroes'
                                || archiveSourceEdit === 'factions'
                                || archiveSourceEdit === 'npcs';
                            if (isSatelliteArchiveEdit && isBioEdit) {
                                if (relElHero) {
                                    relElHero.innerHTML = '';
                                }
                                if (relSectionHero) relSectionHero.style.display = 'none';
                                if (heroLocEdit && locContainer && window.HeroRelevantLocationsEditor?.render) {
                                    heroLocEdit.removeAttribute('hidden');
                                    heroLocEdit.style.display = 'block';
                                    const locs = Array.isArray(this.editTarget?.eventData?.relevantLocations)
                                        ? this.editTarget.eventData.relevantLocations
                                        : [];
                                    window.HeroRelevantLocationsEditor.render(locContainer, locs);
                                    const addBtn = document.getElementById('eventSlideAddRelevantLocationBtn');
                                    if (addBtn) {
                                        addBtn.onclick = () =>
                                            window.HeroRelevantLocationsEditor?.addRow?.();
                                    }
                                    const connContainer = document.getElementById('eventSlideEditBioConnections');
                                    if (connContainer && window.BioArchiveConnectionsEditor?.render) {
                                        const conns = Array.isArray(this.editTarget?.eventData?.connections)
                                            ? this.editTarget.eventData.connections
                                            : [];
                                        const bioOpts =
                                            window.BioArchiveConnectionsEditor?.subjectOptsFromArchiveRow?.(
                                                this.editTarget?.eventData,
                                                archiveSourceEdit
                                            ) || { subjectName: '', subjectKind: 'hero' };
                                        window.BioArchiveConnectionsEditor.render(connContainer, conns, bioOpts);
                                    }
                                }
                            } else if (heroLocEdit) {
                                heroLocEdit.setAttribute('hidden', '');
                                heroLocEdit.style.display = 'none';
                            }
                            
                            editBtn.textContent = 'Cancel';
                            saveBtn.style.display = 'inline-flex';
                            
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('uiClick');
                            }
                        },
                        
                        createInlineEditor() {
                            const editor = document.createElement('div');
                            editor.id = 'eventSlideInlineEditor';
                            editor.className = 'event-slide-inline-editor';
                            editor.innerHTML = `
                                <div class="event-slide-inline-editor__row">
                                    <label class="event-slide-inline-editor__label">Location label</label>
                                    <input class="event-slide-inline-editor__input" id="eventSlideEditCityDisplayName" type="text" />
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <label class="event-slide-inline-editor__label">First year</label>
                                    <input class="event-slide-inline-editor__input" id="eventSlideEditYearStart" type="number" />
                                    <label class="event-slide-inline-editor__label">Second year (optional)</label>
                                    <input class="event-slide-inline-editor__input" id="eventSlideEditYearEnd" type="number" />
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <label class="event-slide-inline-editor__label">Era name</label>
                                    <input class="event-slide-inline-editor__input" id="eventSlideEditEraName" type="text" />
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Relevant countries &amp; places (grouped)</div>
                                    <p class="event-slide-inline-editor__hint">Add one row per group. Reorder with ↑ / ↓. Each row: group label, countries (comma-separated for multiple flags), and why they matter.</p>
                                    <div class="event-slide-inline-editor__actions">
                                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddSecondaryCountryPlaceBtn">+ Add group</button>
                                    </div>
                                    <div id="eventSlideEditSecondaryCountryPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Secondary country groups"></div>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Relevant heroes (grouped)</div>
                                    <p class="event-slide-inline-editor__hint">Same pattern as countries: group label, comma-separated heroes, why they matter.</p>
                                    <div class="event-slide-inline-editor__actions">
                                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddHeroFilterPlaceBtn">+ Add group</button>
                                    </div>
                                    <div id="eventSlideEditHeroFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Hero groups"></div>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Relevant factions (grouped)</div>
                                    <p class="event-slide-inline-editor__hint">Group label, comma-separated factions, why they matter.</p>
                                    <div class="event-slide-inline-editor__actions">
                                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddFactionFilterPlaceBtn">+ Add group</button>
                                    </div>
                                    <div id="eventSlideEditFactionFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="Faction groups"></div>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Relevant NPCs (grouped)</div>
                                    <p class="event-slide-inline-editor__hint">Group label, comma-separated NPCs, why they matter.</p>
                                    <div class="event-slide-inline-editor__actions">
                                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddNpcFilterPlaceBtn">+ Add group</button>
                                    </div>
                                    <div id="eventSlideEditNpcFilterPlaces" class="event-slide-inline-editor__relevant-locs" data-inline-grouped-places="1" aria-label="NPC groups"></div>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <label class="event-slide-inline-editor__label">Headlines (one per line)</label>
                                    <textarea class="event-slide-inline-editor__textarea" id="eventSlideEditHeadlines" rows="3"></textarea>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Sources</div>
                                    <div id="eventSlideEditSources"></div>
                                    <button type="button" id="eventSlideAddSourceBtn">+ Source</button>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Variants</div>
                                    <div id="eventSlideEditVariants"></div>
                                    <button type="button" id="eventSlideAddVariantBtn">+ Add Variant</button>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <button type="button" class="event-slide-inline-editor__delete-btn" id="eventSlideInlineDeleteBtn">Delete event</button>
                                </div>
                            `;
                            
                            setTimeout(() => {
                                document.getElementById('eventSlideAddSourceBtn')?.addEventListener('click', () => this.addSourceRow());
                                document.getElementById('eventSlideAddVariantBtn')?.addEventListener('click', () => this.addVariant());
                                document.getElementById('eventSlideInlineDeleteBtn')?.addEventListener('click', () => this.deleteCurrentEvent());
                                document.getElementById('eventSlideAddSecondaryCountryPlaceBtn')?.addEventListener('click', () =>
                                    window.HeroRelevantLocationsEditor?.addRow?.({
                                        containerId: 'eventSlideEditSecondaryCountryPlaces',
                                        placeholders: STORY_SECONDARY_PLACES_EDITOR_OPTS.placeholders,
                                        autocompleteType: STORY_SECONDARY_PLACES_EDITOR_OPTS.autocompleteType
                                    })
                                );
                                document.getElementById('eventSlideAddHeroFilterPlaceBtn')?.addEventListener('click', () =>
                                    window.HeroRelevantLocationsEditor?.addRow?.({
                                        containerId: 'eventSlideEditHeroFilterPlaces',
                                        placeholders: STORY_HERO_FILTER_PLACES_OPTS.placeholders,
                                        autocompleteType: STORY_HERO_FILTER_PLACES_OPTS.autocompleteType
                                    })
                                );
                                document.getElementById('eventSlideAddFactionFilterPlaceBtn')?.addEventListener('click', () =>
                                    window.HeroRelevantLocationsEditor?.addRow?.({
                                        containerId: 'eventSlideEditFactionFilterPlaces',
                                        placeholders: STORY_FACTION_FILTER_PLACES_OPTS.placeholders,
                                        autocompleteType: STORY_FACTION_FILTER_PLACES_OPTS.autocompleteType
                                    })
                                );
                                document.getElementById('eventSlideAddNpcFilterPlaceBtn')?.addEventListener('click', () =>
                                    window.HeroRelevantLocationsEditor?.addRow?.({
                                        containerId: 'eventSlideEditNpcFilterPlaces',
                                        placeholders: STORY_NPC_FILTER_PLACES_OPTS.placeholders,
                                        autocompleteType: STORY_NPC_FILTER_PLACES_OPTS.autocompleteType
                                    })
                                );
                            }, 0);
                            
                            return editor;
                        },
                        
                        populateInlineEditor(eventData, displayEvent) {
                            const target = displayEvent || eventData;
                            const archPop = this._presentationFromDockTimeline
                                ? 'story'
                                : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
                            const isBioPop =
                                archPop === 'heroes' || archPop === 'factions' || archPop === 'npcs';

                            console.log('[MenuServiceHelpers.populateInlineEditor] Called for event:', target.name);
                            console.log('[MenuServiceHelpers.populateInlineEditor] Has variants:', !!(eventData.variants && eventData.variants.length > 0));
                            
                            document.getElementById('eventSlideEditCityDisplayName')?.value = target.cityDisplayName || '';
                            document.getElementById('eventSlideEditYearStart')?.value = target.yearStart || target.year || '';
                            document.getElementById('eventSlideEditYearEnd')?.value = target.yearEnd || '';
                            document.getElementById('eventSlideEditEraName')?.value = target.eraName || '';
                            const fi = document.getElementById('eventSlideEditFilters');
                            if (fi) fi.value = getStoryEventHeroTokens(target).join(', ');
                            const fa = document.getElementById('eventSlideEditFactions');
                            if (fa) {
                                const formSvc = window.eventManager?.formService;
                                const manifest = window.eventManager?.factions?.length
                                    ? window.eventManager.factions
                                    : window.globeController?.dataModel?.factions || [];
                                const facTok = getStoryEventFactionTokens(target);
                                fa.value =
                                    formSvc && typeof formSvc.factionsArrayToFormDisplayString === 'function'
                                        ? formSvc.factionsArrayToFormDisplayString(facTok, manifest)
                                        : facTok.map((f) => String(f).replace(/^\d+/, '').trim()).join(', ');
                            }
                            const ni = document.getElementById('eventSlideEditNpcs');
                            if (ni) ni.value = getStoryEventNpcTokens(target).join(', ');
                            const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
                            if (secPlacesEl && window.HeroRelevantLocationsEditor?.render) {
                                const places = isBioPop
                                    ? (Array.isArray(target.relevantLocations) ? target.relevantLocations : [])
                                    : (Array.isArray(target.secondaryCountryPlaces) ? target.secondaryCountryPlaces : []);
                                const opts = isBioPop
                                    ? {
                                          placeholders: {
                                              locationName: 'Location / group label',
                                              country: 'Countries (comma-separated for multiple flags)',
                                              reasoning: 'Relevance (e.g. headquarters, place of origin)'
                                          },
                                          autocompleteType: 'countries'
                                      }
                                    : STORY_SECONDARY_PLACES_EDITOR_OPTS;
                                window.HeroRelevantLocationsEditor.render(secPlacesEl, places, opts);
                            }

                            const heroFpEl = document.getElementById('eventSlideEditHeroFilterPlaces');
                            const factionFpEl = document.getElementById('eventSlideEditFactionFilterPlaces');
                            const npcFpEl = document.getElementById('eventSlideEditNpcFilterPlaces');
                            if (
                                heroFpEl &&
                                factionFpEl &&
                                npcFpEl &&
                                window.HeroRelevantLocationsEditor?.render
                            ) {
                                if (!isBioPop) {
                                    window.HeroRelevantLocationsEditor.render(
                                        heroFpEl,
                                        heroPlacesForEditor(target),
                                        STORY_HERO_FILTER_PLACES_OPTS
                                    );
                                    window.HeroRelevantLocationsEditor.render(
                                        factionFpEl,
                                        factionPlacesForEditor(target),
                                        STORY_FACTION_FILTER_PLACES_OPTS
                                    );
                                    window.HeroRelevantLocationsEditor.render(
                                        npcFpEl,
                                        npcPlacesForEditor(target),
                                        STORY_NPC_FILTER_PLACES_OPTS
                                    );
                                } else {
                                    heroFpEl.innerHTML = '';
                                    factionFpEl.innerHTML = '';
                                    npcFpEl.innerHTML = '';
                                }
                            }

                            document.getElementById('eventSlideEditHeadlines')?.value = (target.headlines || []).join('\n');

                            const emList = window.eventManager;
                            const numEl = document.getElementById('eventSlideEditEventNumber');
                            const listIdx = emList?.events ? emList.events.indexOf(eventData) : -1;
                            if (numEl && emList?.events?.length && listIdx >= 0) {
                                numEl.min = '1';
                                numEl.max = String(emList.events.length);
                                numEl.value = String(listIdx + 1);
                            }
                            
                            this.renderSourcesEditor(target.sources || []);
                            this.renderVariantsEditor(eventData);
                            
                            console.log('[MenuServiceHelpers.populateInlineEditor] renderVariantsEditor called');
                        },
                        
                        renderSourcesEditor(sources) {
                            const container = document.getElementById('eventSlideEditSources');
                            if (!container) return;
                            
                            container.innerHTML = '';
                            const srcs = Array.isArray(sources) && sources.length > 0 ? sources : [{ text: '', url: '' }];
                            
                            srcs.forEach(s => {
                                const row = document.createElement('div');
                                row.className = 'event-slide-inline-editor__source-row';
                                row.innerHTML = `
                                    <input type="text" placeholder="Source text" value="${s.text || ''}" data-role="source-text" />
                                    <input type="text" placeholder="URL" value="${s.url || ''}" data-role="source-url" />
                                    <button type="button" data-role="source-remove">−</button>
                                `;
                                row.querySelector('[data-role="source-remove"]')?.addEventListener('click', () => {
                                    if (container.children.length > 1) row.remove();
                                });
                                container.appendChild(row);
                            });
                        },
                        
                        addSourceRow() {
                            const container = document.getElementById('eventSlideEditSources');
                            if (!container) return;
                            
                            const row = document.createElement('div');
                            row.className = 'event-slide-inline-editor__source-row';
                            row.innerHTML = `
                                <input type="text" placeholder="Source text" data-role="source-text" />
                                <input type="text" placeholder="URL" data-role="source-url" />
                                <button type="button" data-role="source-remove">−</button>
                            `;
                            row.querySelector('[data-role="source-remove"]')?.addEventListener('click', () => {
                                if (container.children.length > 1) row.remove();
                            });
                            container.appendChild(row);
                        },
                        
                        renderVariantsEditor(eventData) {
                            const container = document.getElementById('eventSlideEditVariants');
                            console.log('[MenuServiceHelpers.renderVariantsEditor] Called, container exists:', !!container);
                            
                            if (!container) return;
                            
                            container.innerHTML = '';
                            const variants = eventData.variants || [];
                            console.log('[MenuServiceHelpers.renderVariantsEditor] Variants count:', variants.length);
                            
                            if (variants.length === 0) {
                                container.innerHTML = '<div class="event-slide-inline-editor__no-variants">No variants</div>';
                                return;
                            }
                            
                            variants.forEach((variant, index) => {
                                const row = document.createElement('div');
                                row.className = 'event-slide-inline-editor__variant-row';
                                row.innerHTML = `
                                    <span class="event-slide-inline-editor__variant-name">Variant ${index + 1}: ${variant.name || 'Unnamed'}</span>
                                    <button type="button" data-variant-index="${index}" class="event-slide-inline-editor__variant-remove">Remove</button>
                                `;
                                row.querySelector('.event-slide-inline-editor__variant-remove')?.addEventListener('click', () => {
                                    this.removeVariant(eventData, index);
                                });
                                container.appendChild(row);
                            });
                            console.log('[MenuServiceHelpers.renderVariantsEditor] Rendered', variants.length, 'variant rows');
                        },
                        
                        addVariant() {
                            if (!this.editTarget) return;
                            const { eventData } = this.editTarget;
                            
                            if (!eventData.variants) {
                                eventData.variants = [];
                            }
                            
                            // Create a new variant based on the current event data
                            const fpNew = copyFilterPlaceArraysFromSource(eventData);
                            const newVariant = {
                                name: 'New Variant',
                                description: '',
                                cityDisplayName: eventData.cityDisplayName || '',
                                yearStart: eventData.yearStart || eventData.year,
                                yearEnd: eventData.yearEnd || null,
                                eraName: eventData.eraName || '',
                                headlines: [...(eventData.headlines || [])],
                                sources: [],
                                lat: eventData.lat,
                                lon: eventData.lon,
                                x: eventData.x,
                                y: eventData.y,
                                locationType: eventData.locationType
                            };
                            if (fpNew.heroFilterPlaces.length) newVariant.heroFilterPlaces = fpNew.heroFilterPlaces;
                            if (fpNew.factionFilterPlaces.length) newVariant.factionFilterPlaces = fpNew.factionFilterPlaces;
                            if (fpNew.npcFilterPlaces.length) newVariant.npcFilterPlaces = fpNew.npcFilterPlaces;
                            
                            eventData.variants.push(newVariant);
                            this.renderVariantsEditor(eventData);
                            
                            // Mark as unsaved
                            if (window.eventManager) {
                                const idx = window.eventManager.events.indexOf(eventData);
                                if (idx >= 0) window.eventManager.unsavedEventIndices.add(idx);
                            }
                            
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('uiClick');
                            }
                        },
                        
                        removeVariant(eventData, variantIndex) {
                            if (!eventData.variants || eventData.variants.length === 0) return;
                            
                            if (confirm(`Are you sure you want to remove variant ${variantIndex + 1}?`)) {
                                eventData.variants.splice(variantIndex, 1);
                                
                                // If removing the current variant, reset to 0
                                if (this.currentVariantIndex === variantIndex) {
                                    this.currentVariantIndex = 0;
                                } else if (this.currentVariantIndex > variantIndex) {
                                    this.currentVariantIndex--;
                                }
                                
                                this.renderVariantsEditor(eventData);
                                
                                // Refresh the display if we removed the current variant
                                if (eventData.variants.length > 0) {
                                    const newTarget = eventData.variants[this.currentVariantIndex || 0];
                                    this.populateInlineEditor(eventData, newTarget);
                                } else {
                                    this.populateInlineEditor(eventData, eventData);
                                }
                                
                                // Mark as unsaved
                                if (window.eventManager) {
                                    const idx = window.eventManager.events.indexOf(eventData);
                                    if (idx >= 0) window.eventManager.unsavedEventIndices.add(idx);
                                }
                            }
                        },
                        
                        deleteCurrentEvent() {
                            if (!this.editTarget) return;
                            const { eventData } = this.editTarget;
                            const em = window.eventManager;
                            if (!em?.events || typeof em.deleteEvent !== 'function') return;
                            
                            const idx = em.events.indexOf(eventData);
                            if (idx < 0) return;
                            
                            if (confirm('Are you sure you want to delete this event?')) {
                                if (em.deleteEvent(idx)) {
                                    document.getElementById('eventSlide')?.classList.remove('open');
                                    this.hideImageOverlay();
                                    this.cancelEdit();
                                }
                            }
                        },
                        
                        cancelEdit(editBtn, saveBtn) {
                            if (!this.isEditing) {
                                document.getElementById('eventSlideInlineEditor')?.style.display = 'none';
                                const orderRowIdle = document.getElementById('eventSlideOrderRow');
                                if (orderRowIdle) {
                                    orderRowIdle.setAttribute('hidden', '');
                                    orderRowIdle.setAttribute('aria-hidden', 'true');
                                }
                                const heroIdle = document.getElementById('eventSlideHeroLocationsEdit');
                                if (heroIdle) {
                                    heroIdle.setAttribute('hidden', '');
                                    heroIdle.style.display = 'none';
                                }
                                return;
                            }
                            
                            const eventSlide = document.getElementById('eventSlide');
                            const titleEl = document.getElementById('eventSlideTitle');
                            const textEl = document.getElementById('eventSlideText');
                            const eb = editBtn || document.getElementById('eventSlideEditBtn');
                            const sb = saveBtn || document.getElementById('eventSlideSaveBtn');
                            
                            if (this.originalState && this.editTarget) {
                                Object.assign(this.editTarget.eventData, this.originalState);
                            }
                            
                            if (titleEl) { titleEl.contentEditable = 'false'; titleEl.removeAttribute('spellcheck'); }
                            if (textEl) { textEl.contentEditable = 'false'; textEl.removeAttribute('spellcheck'); }
                            
                            document.getElementById('eventSlideInlineEditor')?.style.display = 'none';
                            eventSlide?.classList.remove('event-slide--inline-editing');
                            const orderRowCancel = document.getElementById('eventSlideOrderRow');
                            if (orderRowCancel) {
                                orderRowCancel.setAttribute('hidden', '');
                                orderRowCancel.setAttribute('aria-hidden', 'true');
                            }

                            if (eb) eb.textContent = 'Edit';
                            if (sb) sb.style.display = 'none';

                            const heroLocEditCancel = document.getElementById('eventSlideHeroLocationsEdit');
                            if (heroLocEditCancel) {
                                heroLocEditCancel.setAttribute('hidden', '');
                                heroLocEditCancel.style.display = 'none';
                            }
                            const archiveSrcAfterCancel =
                                window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                            const relAfterCancel = document.getElementById('eventSlideRelevantLocations');
                            const relSectionAfterCancel = document.getElementById('eventRelevantLocationsSection');
                            const isBioAfterCancel =
                                archiveSrcAfterCancel === 'heroes'
                                || archiveSrcAfterCancel === 'factions'
                                || archiveSrcAfterCancel === 'npcs';
                            if (relAfterCancel && isBioAfterCancel && this.editTarget?.eventData) {
                                window.LocationFlagHelpers?.updateRelevantLocationsSlideFromSecondaryPlaces?.(
                                    this.editTarget.eventData
                                );
                                window.LocationFlagHelpers?.updateBioConnectionsSlideFromEvent?.(
                                    this.editTarget.eventData
                                );
                            }
                            
                            this.isEditing = false;
                            this.editTarget = null;
                            this.originalState = null;
                        },
                        
                        saveFullEdit(eventData, editBtn, saveBtn) {
                            if (!this.isEditing || !this.editTarget) return;
                            
                            console.log('[MenuServiceHelpers] saveFullEdit called for event:', eventData.name);

                            const dockStoryPresentationActive = !!this._presentationFromDockTimeline;
                            const archiveSource = dockStoryPresentationActive
                                ? 'story'
                                : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
                            const titleEl = document.getElementById('eventSlideTitle');
                            const textEl = document.getElementById('eventSlideText');
                            /** @type {object|null} */
                            let eventForFilterRefresh = null;

                            if (archiveSource !== 'story') {
                                const cleanName = (titleEl?.textContent || '').trim();
                                const cleanDesc = (textEl?.innerHTML || '').trim();
                                const em = window.eventManager;
                                const locContainer = document.getElementById('eventSlideEditRelevantLocations');
                                const isBioSave =
                                    archiveSource === 'heroes'
                                    || archiveSource === 'factions'
                                    || archiveSource === 'npcs';
                                const relevantLocations = isBioSave
                                    ? window.HeroRelevantLocationsEditor?.collect(locContainer) ?? []
                                    : undefined;
                                const connections = isBioSave
                                    ? window.BioArchiveConnectionsEditor?.collect?.(
                                          document.getElementById('eventSlideEditBioConnections')
                                      ) ?? []
                                    : undefined;
                                const normalized = isBioSave
                                    ? { name: cleanName, description: cleanDesc, relevantLocations, connections }
                                    : { name: cleanName, description: cleanDesc };
                                if (em?.events) {
                                    const idx =
                                        window.BioArchiveConnectionsSync?.resolveBioArchiveEventIndex?.(
                                            em.events,
                                            this.editTarget.eventData,
                                            archiveSource
                                        ) ?? em.events.indexOf(this.editTarget.eventData);
                                    const oldRef = this.editTarget.eventData;
                                    const prevConnections =
                                        isBioSave && Array.isArray(oldRef?.connections)
                                            ? oldRef.connections.map((c) => ({ ...c }))
                                            : [];
                                    if (idx >= 0) {
                                        em.events[idx] = normalized;
                                        em.unsavedEventIndices?.add(idx);
                                        if (
                                            isBioSave &&
                                            window.BioArchiveConnectionsSync?.syncMirrorsAfterSubjectSave
                                        ) {
                                            window.BioArchiveConnectionsSync.syncMirrorsAfterSubjectSave(
                                                em.events,
                                                archiveSource,
                                                normalized,
                                                prevConnections
                                            );
                                        }
                                    }
                                    this.currentEventData = normalized;
                                    this.editTarget.eventData = normalized;
                                }
                                em?.dataService?.saveEvents?.();
                                eventForFilterRefresh = normalized;

                                const heroLocEditSaved = document.getElementById('eventSlideHeroLocationsEdit');
                                if (heroLocEditSaved) {
                                    heroLocEditSaved.setAttribute('hidden', '');
                                    heroLocEditSaved.style.display = 'none';
                                }
                                const relSaved = document.getElementById('eventSlideRelevantLocations');
                                if (isBioSave && relSaved) {
                                    window.LocationFlagHelpers?.updateRelevantLocationsSlideFromSecondaryPlaces?.(
                                        normalized
                                    );
                                    window.LocationFlagHelpers?.updateBioConnectionsSlideFromEvent?.(normalized);
                                }
                                if (window.eventManager?.renderEvents) {
                                    window.eventManager.renderEvents();
                                }
                            } else {
                            
                            const isMultiEvent = eventData.variants && eventData.variants.length > 0;
                            const target = isMultiEvent ? eventData.variants[this.currentVariantIndex || 0] : eventData;
                            eventForFilterRefresh = target;
                            
                            if (target) {
                                if (titleEl) target.name = titleEl.textContent || target.name;
                                if (textEl) target.description = textEl.innerHTML || target.description;
                                target.cityDisplayName = document.getElementById('eventSlideEditCityDisplayName')?.value;
                                target.yearStart = parseInt(document.getElementById('eventSlideEditYearStart')?.value) || target.yearStart;
                                target.yearEnd = parseInt(document.getElementById('eventSlideEditYearEnd')?.value) || null;
                                target.eraName = document.getElementById('eventSlideEditEraName')?.value || null;
                                if (window.HeroRelevantLocationsEditor?.collect) {
                                    const heroFpSv = document.getElementById('eventSlideEditHeroFilterPlaces');
                                    const hr = heroFpSv ? window.HeroRelevantLocationsEditor.collect(heroFpSv) : [];
                                    const fr = window.HeroRelevantLocationsEditor.collect(
                                        document.getElementById('eventSlideEditFactionFilterPlaces')
                                    );
                                    const nr = window.HeroRelevantLocationsEditor.collect(
                                        document.getElementById('eventSlideEditNpcFilterPlaces')
                                    );
                                    applyStoryFilterPlacesToTarget(target, hr, fr, nr);
                                }
                                const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
                                const places =
                                    window.HeroRelevantLocationsEditor?.collect?.(secPlacesEl) ?? [];
                                target.secondaryCountryPlaces = places;
                                if (window.LocationFlagHelpers?.syncSecondaryCountryFlagsOnEntity) {
                                    window.LocationFlagHelpers.syncSecondaryCountryFlagsOnEntity(target);
                                }
                                target.headlines = document.getElementById('eventSlideEditHeadlines')?.value.split('\n').map(s => s.trim()).filter(Boolean) || [];
                                
                                const sourceRows = document.querySelectorAll('#eventSlideEditSources .event-slide-inline-editor__source-row');
                                target.sources = Array.from(sourceRows).map(row => ({
                                    text: row.querySelector('[data-role="source-text"]')?.value || '',
                                    url: row.querySelector('[data-role="source-url"]')?.value || ''
                                })).filter(s => s.text || s.url);
                                
                                console.log('[MenuServiceHelpers] Updated target description:', target.description);
                            }

                            const emReorder = window.eventManager;
                            const numReorderEl = document.getElementById('eventSlideEditEventNumber');
                            if (emReorder && typeof emReorder.reorderEvents === 'function' && numReorderEl && Array.isArray(emReorder.events)) {
                                const startIdx = emReorder.events.indexOf(eventData);
                                if (startIdx >= 0) {
                                    const n = parseInt(numReorderEl.value, 10);
                                    if (!Number.isNaN(n) && n >= 1) {
                                        const newIdx = Math.min(n - 1, emReorder.events.length - 1);
                                        if (newIdx !== startIdx) {
                                            emReorder.reorderEvents(startIdx, newIdx);
                                        }
                                    }
                                }
                            }
                            
                            if (window.eventManager) {
                                const idx = window.eventManager.events.indexOf(eventData);
                                if (idx >= 0) window.eventManager.unsavedEventIndices.add(idx);
                                console.log('[MenuServiceHelpers] Marked event', idx, 'as unsaved');
                                // Persist changes to localStorage immediately
                                if (window.eventManager.dataService && typeof window.eventManager.dataService.saveEvents === 'function') {
                                    console.log('[MenuServiceHelpers] Calling saveEvents()...');
                                    window.eventManager.dataService.saveEvents();
                                    console.log('[MenuServiceHelpers] saveEvents() completed');
                                } else {
                                    console.error('[MenuServiceHelpers] dataService.saveEvents not available!');
                                }
                            } else {
                                console.error('[MenuServiceHelpers] window.eventManager not available!');
                            }

                            if (
                                dockStoryPresentationActive &&
                                (window.eventManager?.dataService?.getArchiveSource?.() || 'story') !== 'story' &&
                                typeof window.eventManager?.dataService?.persistStoryDockTimelineFromSnapshot === 'function'
                            ) {
                                window.eventManager.dataService.persistStoryDockTimelineFromSnapshot();
                            }

                            if (window.eventManager?.refreshGlobeEvents) {
                                window.eventManager.refreshGlobeEvents();
                            }

                            } // end story-only full save branch
                            
                            if (titleEl) { titleEl.contentEditable = 'false'; titleEl.removeAttribute('spellcheck'); }
                            if (textEl) { textEl.contentEditable = 'false'; textEl.removeAttribute('spellcheck'); }
                            
                            document.getElementById('eventSlideInlineEditor')?.style.display = 'none';
                            document.getElementById('eventSlide')?.classList.remove('event-slide--inline-editing');
                            const orderRowAfterSave = document.getElementById('eventSlideOrderRow');
                            if (orderRowAfterSave) {
                                orderRowAfterSave.setAttribute('hidden', '');
                                orderRowAfterSave.setAttribute('aria-hidden', 'true');
                            }
                            
                            if (editBtn) editBtn.textContent = 'Edit';
                            if (saveBtn) saveBtn.style.display = 'none';
                            
                            this.isEditing = false;
                            this.editTarget = null;
                            this.originalState = null;
                            
                            this.updateSourcesAndFilters(eventForFilterRefresh);
                            
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('save');
                            }
                        },
                        
                        updateSourcesAndFilters(event) {
                            const archiveSrc = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                            const showingDockStoryEvent = !!this._presentationFromDockTimeline;
                            if (archiveSrc !== 'story' && !showingDockStoryEvent) {
                                const ss = document.getElementById('eventSourcesSection');
                                const fs = document.getElementById('eventFiltersSection');
                                if (ss) ss.style.display = 'none';
                                if (fs) fs.style.display = 'none';
                                const lhEarly = window.LocationFlagHelpers;
                                lhEarly?.clearStoryFilterPlacesSlideDom?.();
                                // Do not clear relevant locations here: displaySlide already filled them for bio satellites.
                                return;
                            }
                            const sourcesSection = document.getElementById('eventSourcesSection');
                            const sourcesList = document.getElementById('eventSourcesList');
                            if (sourcesSection && sourcesList && event?.sources?.length > 0) {
                                sourcesList.innerHTML = '';
                                event.sources.forEach(source => {
                                    const item = document.createElement('div');
                                    item.className = 'event-source-display-item';
                                    if (source.url) {
                                        const link = document.createElement('a');
                                        link.href = source.url;
                                        link.target = '_blank';
                                        link.rel = 'noopener noreferrer';
                                        link.className = 'event-source-link';
                                        link.textContent = source.text || source.url;
                                        link.addEventListener('click', () => window.SoundEffectsManager?.play?.('filterConfirm'));
                                        item.appendChild(link);
                                    } else {
                                        item.textContent = source.text;
                                        item.className = 'event-source-text';
                                    }
                                    sourcesList.appendChild(item);
                                });
                                sourcesSection.style.display = 'block';
                            } else if (sourcesSection) {
                                sourcesSection.style.display = 'none';
                            }
                            
                            // Render icon-based filters (matching globe mode)
                            this.renderEventFilters(event);
                        },
                        
                        renderEventFilters(event) {
                            const filtersSection = document.getElementById('eventFiltersSection');
                            const filtersList = document.getElementById('eventFiltersList');
                            if (!filtersSection || !filtersList) return;

                            filtersList.innerHTML = '';

                            const CATEGORY_ICON_COUNTRIES = 'assets/images/icons/Location Icon.png';

                            const lh = window.LocationFlagHelpers;
                            const countryFlags =
                                lh && typeof lh.collectCountryFlagFilesForEntity === 'function'
                                    ? lh.collectCountryFlagFilesForEntity(event)
                                    : (() => {
                                          const out = [];
                                          if (event?.cityDisplayName) {
                                              const flagFile = lh?.getResolvedFlagFilename?.(
                                                  event.cityDisplayName,
                                                  event.locationType || 'earth'
                                              );
                                              if (flagFile) out.push(flagFile);
                                          }
                                          const secFn =
                                              lh?.getSecondaryCountryFlagFilenamesForEntity?.(event) || [];
                                          if (secFn.length) {
                                              out.push(...secFn);
                                          }
                                          return out;
                                      })();
                            const hasGroupedSecondary =
                                lh && typeof lh.getSecondaryCountryPlacesRowsForDisplay === 'function'
                                    ? lh.getSecondaryCountryPlacesRowsForDisplay(event).length > 0
                                    : false;
                            const showCountryChips = countryFlags.length > 0 && !hasGroupedSecondary;

                            const createHeader = (label, iconSrc) => {
                                const h = document.createElement('h4');
                                h.className = 'event-filter-header event-filter-header--category';
                                h.innerHTML = `<img class="event-filter-header-icon" src="${iconSrc}" alt="" width="20" height="20" decoding="async"><span class="event-filter-header-label">${label}</span>`;
                                return h;
                            };

                            const createCountryIconTag = (key, displayName) => {
                                const tag = document.createElement('span');
                                tag.className = 'event-filter-tag event-filter-tag--icon event-filter-tag--clickable event-filter-tag--country';
                                tag.title = displayName;
                                tag.setAttribute('role', 'button');
                                tag.tabIndex = 0;

                                const em = window.eventManager;
                                const countryFilters = em?.searchCountryFilters;
                                if (Array.isArray(countryFilters) && countryFilters.includes(key)) {
                                    tag.classList.add('selected');
                                }

                                const box = document.createElement('span');
                                box.className = 'event-filter-image-container';

                                const img = document.createElement('img');
                                img.className = 'event-filter-icon event-filter-icon--country';
                                img.alt = displayName;
                                img.loading = 'lazy';
                                img.src = lh?.flagSrc?.(key) || `assets/images/flags/${encodeURIComponent(key)}`;

                                box.appendChild(img);
                                tag.appendChild(box);

                                tag.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const mgr = window.eventManager;
                                    if (!mgr?.prependEventManagerSearchTokens || !mgr.openEventsManagePanel) return;
                                    mgr.prependEventManagerSearchTokens({ countryFlagFilename: key });
                                    mgr.openEventsManagePanel();
                                    window.SoundEffectsManager?.play?.('filterConfirm');
                                });

                                tag.addEventListener('keydown', (e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        tag.click();
                                    }
                                });

                                return tag;
                            };

                            if (showCountryChips) {
                                filtersList.appendChild(createHeader('Relevant Countries:', CATEGORY_ICON_COUNTRIES));
                                countryFlags.forEach((flagFile) => {
                                    const label = this.getCountryLabel(flagFile);
                                    if (flagFile) filtersList.appendChild(createCountryIconTag(flagFile, label));
                                });
                            }

                            if (hasGroupedSecondary) {
                                lh?.updateRelevantLocationsSlideFromSecondaryPlaces?.(event);
                            } else {
                                lh?.clearRelevantLocationsSlideDom?.();
                            }

                            lh?.updateStoryFilterPlacesSlideFromEvent?.(event);
                            lh?.updateBioConnectionsSlideFromEvent?.(event);

                            filtersSection.style.display = showCountryChips ? 'block' : 'none';
                        },

                        getCountryLabel(flagFile) {
                            const map = window.FLAG_FILE_BY_COMMON;
                            if (map) {
                                for (const common of Object.keys(map).sort()) {
                                    if (map[common] === flagFile) return common;
                                }
                            }
                            return flagFile?.replace(/\.png$/i, '') || flagFile;
                        },
                        
                        wireNavButtons(eventData) {
                            const prevBtn = document.getElementById('eventPrevBtn');
                            const nextBtn = document.getElementById('eventNextBtn');
                            const allEventsBtn = document.getElementById('eventAllEventsBtn');
                            
                            if (prevBtn) {
                                prevBtn.onclick = () => {
                                    // Loop around: if at first event, go to last
                                    const newIndex = this.currentEventIndex > 0 
                                        ? this.currentEventIndex - 1 
                                        : this.allEvents.length - 1;
                                    const list = this.allEvents?.length
                                        ? this.allEvents
                                        : (window.eventManager?.getDockTimelineEvents?.() || []);
                                    const keepHist = (this._slideHistoryStack?.length || 0) > 0;
                                    this.showEvent(newIndex, { eventList: list, keepSlideHistory: keepHist });
                                    if (window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('switchEvent');
                                    }
                                };
                            }
                            if (nextBtn) {
                                nextBtn.onclick = () => {
                                    // Loop around: if at last event, go to first
                                    const newIndex = this.currentEventIndex < this.allEvents.length - 1 
                                        ? this.currentEventIndex + 1 
                                        : 0;
                                    const list = this.allEvents?.length
                                        ? this.allEvents
                                        : (window.eventManager?.getDockTimelineEvents?.() || []);
                                    const keepHist = (this._slideHistoryStack?.length || 0) > 0;
                                    this.showEvent(newIndex, { eventList: list, keepSlideHistory: keepHist });
                                    if (window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('switchEvent');
                                    }
                                };
                            }
                            if (allEventsBtn) {
                                allEventsBtn.onclick = () => {
                                    const panel = document.getElementById('eventsManagePanel');
                                    if (panel) {
                                        const isOpening = !panel.classList.contains('open');
                                        panel.classList.add('open');
                                        // Play eventManager sound when opening
                                        if (isOpening && window.SoundEffectsManager?.play) {
                                            window.SoundEffectsManager.play('eventManager');
                                        }
                                    }
                                };
                            }
                        },
                        
                        updateNavButtons() {
                            const prevBtn = document.getElementById('eventPrevBtn');
                            const nextBtn = document.getElementById('eventNextBtn');
                            // Buttons always enabled since navigation loops around
                            if (prevBtn) prevBtn.disabled = false;
                            if (nextBtn) nextBtn.disabled = false;
                        },
                        
                        // Hide event slide panel - used by ComponentOrchestrator when switching modes
                        hideEventSlide() {
                            const eventSlide = document.getElementById('eventSlide');
                            const eventImageOverlay = document.getElementById('eventImageOverlay');
                            const eventImage = document.getElementById('eventImage');
                            
                            // Only play sound if panel was actually open
                            const wasOpen = eventSlide?.classList.contains('open');
                            if (wasOpen) {
                                this.clearSlideHistory();
                            }
                            
                            if (eventSlide) {
                                eventSlide.classList.remove('open');
                            }
                            
                            // Hide image overlay completely
                            if (eventImageOverlay) {
                                eventImageOverlay.classList.remove('slide-open', 'open', 'fade-in', 'fade-out');
                                eventImageOverlay.style.display = 'none';
                                eventImageOverlay.style.opacity = '0';
                            }
                            
                            if (eventImage) {
                                eventImage.classList.remove('fade-in', 'fade-out');
                                eventImage.style.display = 'none';
                                eventImage.style.opacity = '0';
                            }
                            
                            this.cancelEdit();
                            
                            // Only play sound if panel was actually closed
                            if (wasOpen && window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('eventClick');
                            }
                        },
                        
                        setupStandalonePagination() {
                            const pageInput = document.getElementById('pageInput');
                            const pageSlider = document.getElementById('eventPageSlider');
                            const ticksEl = document.getElementById('eventPageSliderTicks');
                            
                            // Clone buttons to remove old listeners (same pattern as Globe)
                            const cloneBtn = (id) => {
                                const btn = document.getElementById(id);
                                if (!btn || !btn.parentNode) return btn;
                                const clone = btn.cloneNode(true);
                                btn.parentNode.replaceChild(clone, btn);
                                return document.getElementById(id) || clone;
                            };
                            
                            let prevBtn = cloneBtn('prevPageBtn');
                            let nextBtn = cloneBtn('nextPageBtn');
                            
                            if (!prevBtn || !nextBtn) return;
                            
                            const getDockEvents = () => window.eventManager?.getDockTimelineEvents?.() || [];
                            const eventsPerPage = 10; // Globe pagination uses 10 events per page
                            
                            if (!getDockEvents().length) {
                                console.warn('MenuServiceHelpers: No dock timeline events for pagination');
                                return;
                            }
                            
                            const getTotalPages = () => Math.max(1, Math.ceil(getDockEvents().length / eventsPerPage));
                            
                            // STANDALONE: Track our own current page (don't rely on globe dataModel)
                            let standaloneCurrentPage = 1;
                            
                            const getCurrentPage = () => standaloneCurrentPage;
                            
                            const setCurrentPage = (page) => {
                                standaloneCurrentPage = page;
                                // Sync to standaloneEventSlide for EventMarkerManager
                                if (window.standaloneEventSlide) {
                                    window.standaloneEventSlide.currentPage = page;
                                }
                            };
                            
                            const getEventsForPage = (pageNum) => {
                                const ev = getDockEvents();
                                const start = (pageNum - 1) * eventsPerPage;
                                const end = start + eventsPerPage;
                                return ev.slice(start, end);
                            };
                            
                            const generateSliderTicks = (totalPages) => {
                                if (!ticksEl || totalPages <= 1) return;
                                ticksEl.innerHTML = '';
                                const ev = getDockEvents();
                                const totalEvents = ev.length;
                                
                                // Page labels
                                for (let i = 0; i < totalPages; i++) {
                                    const label = document.createElement('span');
                                    label.className = 'event-page-slider-label';
                                    label.style.left = `${(i / totalPages) * 100}%`;
                                    label.textContent = String(i + 1);
                                    ticksEl.appendChild(label);
                                }
                                
                                // Major ticks
                                if (totalPages > 1) {
                                    for (let i = 1; i < totalPages; i++) {
                                        const tick = document.createElement('span');
                                        tick.className = 'event-page-slider-tick event-page-slider-tick--major';
                                        tick.style.left = `${(i / totalPages) * 100}%`;
                                        ticksEl.appendChild(tick);
                                    }
                                }
                                
                                // Sub-ticks
                                for (let p = 0; p < totalPages; p++) {
                                    const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                                    if (onPage <= 1) continue;
                                    for (let k = 1; k < onPage; k++) {
                                        const sub = document.createElement('span');
                                        sub.className = 'event-page-slider-tick event-page-slider-tick--sub';
                                        sub.style.left = `${((p + k / onPage) / totalPages) * 100}%`;
                                        ticksEl.appendChild(sub);
                                    }
                                }
                                
                                // Add unfinished slot markers (red bars) for events missing descriptions
                                for (let p = 0; p < totalPages; p++) {
                                    const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                                    for (let e = 0; e < onPage; e++) {
                                        const g = p * eventsPerPage + e;
                                        const rootEv = g >= 0 && g < totalEvents ? ev[g] : null;
                                        if (!eventRootSlotMissingDescription(rootEv)) continue;
                                        const mark = document.createElement('span');
                                        mark.className = 'event-page-slider-tick event-page-slider-tick--unfinished-slot';
                                        mark.style.left = `${((p + (e + 0.5) / onPage) / totalPages) * 100}%`;
                                        mark.title = 'Unfinished: missing description';
                                        ticksEl.appendChild(mark);
                                    }
                                }
                            };
                            
                            const updateEraStrip = (totalPages) => {
                                const pageSliderEl = document.getElementById('eventPageSlider');
                                if (!pageSliderEl) return;
                                
                                let eraStrip = document.getElementById('eventPageSliderEraStrip');
                                if (!eraStrip) {
                                    const wrap = pageSliderEl.closest('.event-page-slider-wrap');
                                    if (wrap) {
                                        eraStrip = document.createElement('div');
                                        eraStrip.id = 'eventPageSliderEraStrip';
                                        eraStrip.className = 'event-page-slider-era-strip';
                                        wrap.appendChild(eraStrip);
                                    }
                                }
                                
                                if (!eraStrip) return;
                                
                                const ev = getDockEvents();
                                // Try to use EraHoverPreviewTheme first
                                if (window.EraHoverPreviewTheme?.buildGlobalEraStripeBackgroundLinearGradient) {
                                    eraStrip.style.background = window.EraHoverPreviewTheme.buildGlobalEraStripeBackgroundLinearGradient(
                                        ev,
                                        eventsPerPage,
                                        totalPages
                                    );
                                } else {
                                    // Fallback: build era stripe manually using event.eraName
                                    const eraColors = {
                                        'The Age of Progress': '#66bb6a',
                                        'Age of Progress': '#66bb6a',
                                        'The Omnic Crisis': '#ff5722',
                                        'Omnic Crisis': '#ff5722',
                                        'The Golden Age': '#ffca28',
                                        'Golden Age': '#ffca28',
                                        'The Fall of Overwatch': '#4e342e',
                                        'Fall of Overwatch': '#4e342e',
                                        'The Age of Conflict': '#42a5f5',
                                        'Age of Conflict': '#42a5f5',
                                        'The Null Sector Invasion': '#ba68c8',
                                        'Null Sector Invasion': '#ba68c8',
                                        'The Reign of Talon': '#8b1313',
                                        'Reign of Talon': '#8b1313'
                                    };
                                    
                                    const stops = [];
                                    for (let p = 0; p < totalPages; p++) {
                                        const startIdx = p * eventsPerPage;
                                        const pageEvents = ev.slice(startIdx, startIdx + eventsPerPage);
                                        
                                        // Find dominant era on this page
                                        const eraCounts = {};
                                        pageEvents.forEach(ev => {
                                            const era = ev.eraName || 'Unknown';
                                            eraCounts[era] = (eraCounts[era] || 0) + 1;
                                        });
                                        
                                        let dominantEra = 'Unknown';
                                        let maxCount = 0;
                                        Object.entries(eraCounts).forEach(([era, count]) => {
                                            if (count > maxCount) {
                                                maxCount = count;
                                                dominantEra = era;
                                            }
                                        });
                                        
                                        const color = eraColors[dominantEra] || '#888888';
                                        const startPct = (p / totalPages) * 100;
                                        const endPct = ((p + 1) / totalPages) * 100;
                                        stops.push(`${color} ${startPct}%`, `${color} ${endPct}%`);
                                    }
                                    
                                    eraStrip.style.background = `linear-gradient(to right, ${stops.join(', ')})`;
                                }
                            };
                            
                            const updatePaginationUI = () => {
                                const currentPage = getCurrentPage();
                                const totalPages = getTotalPages();
                                const pageTotal = document.getElementById('pageTotal');
                                
                                if (pageTotal) pageTotal.textContent = `/ ${totalPages}`;
                                if (pageInput) {
                                    pageInput.value = currentPage;
                                    pageInput.max = totalPages;
                                }
                                
                                if (pageSlider) {
                                    const SLIDER_RESOLUTION = 10000;
                                    pageSlider.min = '0';
                                    pageSlider.max = String(SLIDER_RESOLUTION);
                                    pageSlider.disabled = totalPages <= 1;
                                    const pageCenter = (currentPage - 0.5) / totalPages;
                                    pageSlider.value = String(Math.round(pageCenter * SLIDER_RESOLUTION));
                                }
                                
                                generateSliderTicks(totalPages);
                                updateEraStrip(totalPages);
                                
                                prevBtn.disabled = totalPages <= 1;
                                nextBtn.disabled = totalPages <= 1;
                                
                                const currentPageEvents = getEventsForPage(currentPage);
                                this.updateNumberButtons(currentPageEvents, currentPage);
                                
                                const pagination = document.getElementById('eventPagination');
                                if (pagination) {
                                    pagination.style.display = totalPages <= 1 ? 'none' : 'flex';
                                }
                            };

                            const handlePageChange = (newPage, options = {}) => {
                                const totalPages = getTotalPages();
                                const validPage = Math.max(1, Math.min(totalPages, newPage));

                                if (validPage !== getCurrentPage()) {
                                    setCurrentPage(validPage);
                                    updatePaginationUI();
                                    
                                    // Refresh event markers on Globe for new page
                                    if (window.globeEventMarkerManager) {
                                        window.globeEventMarkerManager.refreshEventMarkers(true);
                                    }
                                    
                                    // Refresh Map2DLiteLayer markers and celestial panels
                                    if (window.globeController?.map2dLite?.syncMarkers) {
                                        window.globeController.map2dLite.syncMarkers({ mode: 'pageTurn' });
                                    }
                                    
                                    // Skip sound during slider scrubbing - tick sounds play instead
                                    if (!options.skipSound && window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('page');
                                    }
                                }
                            };

                            prevBtn.addEventListener('click', (e) => {
                                e?.stopPropagation?.();
                                const current = getCurrentPage();
                                handlePageChange(current > 1 ? current - 1 : getTotalPages());
                            });

                            nextBtn.addEventListener('click', (e) => {
                                e?.stopPropagation?.();
                                const current = getCurrentPage();
                                const total = getTotalPages();
                                handlePageChange(current < total ? current + 1 : 1);
                            });
                            
                            // Event navigation buttons (prev/next event)
                            const prevEventBtn = document.getElementById('prevEventBtn');
                            const nextEventBtn = document.getElementById('nextEventBtn');
                            
                            if (prevEventBtn && nextEventBtn) {
                                const getCurrentEventIndex = () => window.standaloneEventSlide?.currentEventIndex ?? -1;
                                const getFilteredEvents = () =>
                                    window.eventManager?.getFilteredDockTimelineEvents?.() ||
                                    window.eventManager?.getDockTimelineEvents?.() ||
                                    [];
                                
                                const navigateToEvent = (direction) => {
                                    const currentEvents = getFilteredEvents();
                                    if (!currentEvents.length) return;
                                    
                                    const currentIndex = getCurrentEventIndex();
                                    const eventSlide = document.getElementById('eventSlide');
                                    const isEventOpen = eventSlide?.classList.contains('open');
                                    
                                    let targetIndex;
                                    
                                    if (isEventOpen && currentIndex >= 0) {
                                        // Event is open - navigate to next/prev event
                                        targetIndex = currentIndex + direction;
                                        
                                        // Wrap around
                                        if (targetIndex < 0) targetIndex = currentEvents.length - 1;
                                        if (targetIndex >= currentEvents.length) targetIndex = 0;
                                        
                                        // Close current event first
                                        if (eventSlide) {
                                            eventSlide.classList.remove('open');
                                        }
                                        
                                        // Open new event after brief delay
                                        setTimeout(() => {
                                            if (window.standaloneEventSlide) {
                                                window.standaloneEventSlide.showEvent(targetIndex);
                                                if (window.SoundEffectsManager?.play) {
                                                    window.SoundEffectsManager.play('eventClick');
                                                }
                                            }
                                        }, 50);
                                    } else {
                                        // No event open - load first event of current page
                                        const currentPage = getCurrentPage();
                                        const pageStart = (currentPage - 1) * eventsPerPage;
                                        const pageEnd = Math.min(pageStart + eventsPerPage, currentEvents.length);
                                        
                                        // Find first unlocked event on current page
                                        const activeFilters = window.standaloneActiveFilters || new Set();
                                        for (let i = pageStart; i < pageEnd; i++) {
                                            const event = currentEvents[i];
                                            if (event && !shouldEventBeLocked(event, activeFilters)) {
                                                targetIndex = i;
                                                break;
                                            }
                                        }
                                        
                                        // If no unlocked events, use first event on page
                                        if (targetIndex === undefined) {
                                            targetIndex = pageStart;
                                        }
                                        
                                        if (targetIndex < currentEvents.length && window.standaloneEventSlide) {
                                            window.standaloneEventSlide.showEvent(targetIndex);
                                            if (window.SoundEffectsManager?.play) {
                                                window.SoundEffectsManager.play('eventClick');
                                            }
                                        }
                                    }
                                };
                                
                                prevEventBtn.addEventListener('click', (e) => {
                                    e?.stopPropagation?.();
                                    navigateToEvent(-1);
                                });
                                
                                nextEventBtn.addEventListener('click', (e) => {
                                    e?.stopPropagation?.();
                                    navigateToEvent(1);
                                });
                                
                                // Update button states based on event panel state
                                const updateEventNavButtons = () => {
                                    const currentEvents = getFilteredEvents();
                                    const hasEvents = currentEvents.length > 0;
                                    prevEventBtn.disabled = !hasEvents;
                                    nextEventBtn.disabled = !hasEvents;
                                };
                                
                                // Call update when pagination UI updates
                                const originalUpdatePaginationUI = updatePaginationUI;
                                const enhancedUpdatePaginationUI = () => {
                                    originalUpdatePaginationUI();
                                    updateEventNavButtons();
                                };
                            }
                            
                            if (pageInput) {
                                pageInput.onchange = (e) => {
                                    e.stopPropagation();
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) handlePageChange(value);
                                };
                                pageInput.onkeydown = (e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        pageInput.blur();
                                    }
                                };
                            }
                            
                            if (pageSlider) {
                                // Globe-style slider with tick sounds and live updates
                                const SLIDER_RESOLUTION = 10000;
                                let lastPage = getCurrentPage();
                                let sliderGesture = {
                                    down: false,
                                    dragLike: false,
                                    inputEvents: 0,
                                    tapPendingPageSound: false
                                };
                                
                                // Pointer events for gesture detection
                                pageSlider.addEventListener('pointerdown', (e) => {
                                    sliderGesture.down = true;
                                    sliderGesture.dragLike = false;
                                    sliderGesture.inputEvents = 0;
                                    sliderGesture.tapPendingPageSound = false;
                                    const startX = e.clientX;
                                    const startY = e.clientY;
                                    
                                    const onMove = (ev) => {
                                        if (!sliderGesture.down) return;
                                        const dx = ev.clientX - startX;
                                        const dy = ev.clientY - startY;
                                        if (dx * dx + dy * dy > 100) {
                                            sliderGesture.dragLike = true;
                                            sliderGesture.tapPendingPageSound = false;
                                        }
                                    };
                                    
                                    const onUp = () => {
                                        window.removeEventListener('pointermove', onMove);
                                        window.removeEventListener('pointerup', onUp);
                                        window.removeEventListener('pointercancel', onUp);
                                        sliderGesture.down = false;
                                        
                                        // Play page sound on tap release
                                        if (sliderGesture.tapPendingPageSound && window.SoundEffectsManager?.play) {
                                            window.SoundEffectsManager.play('page');
                                        }
                                        sliderGesture.tapPendingPageSound = false;
                                    };
                                    
                                    window.addEventListener('pointermove', onMove);
                                    window.addEventListener('pointerup', onUp);
                                    window.addEventListener('pointercancel', onUp);
                                });
                                
                                // Input event for live page updates
                                pageSlider.addEventListener('input', () => {
                                    const tp = getTotalPages();
                                    if (tp <= 1) return;
                                    const value = parseInt(pageSlider.value, 10);
                                    const progress = value / SLIDER_RESOLUTION;
                                    const newPage = Math.min(tp, Math.max(1, Math.floor(progress * tp) + 1));
                                    
                                    if (newPage === lastPage) return;
                                    lastPage = newPage;
                                    
                                    sliderGesture.inputEvents += 1;
                                    
                                    // Update page immediately (live scrubbing) - skip sound, tick sounds play instead
                                    handlePageChange(newPage, { skipSound: true });
                                    
                                    // Detect drag vs tap
                                    const isScrubDrag = sliderGesture.dragLike || sliderGesture.inputEvents >= 2;
                                    if (isScrubDrag) {
                                        sliderGesture.tapPendingPageSound = false;
                                        // Play tick sound during scrubbing
                                        if (window.PanelResizeGearTick?.play) {
                                            window.PanelResizeGearTick.play();
                                        }
                                    } else {
                                        sliderGesture.tapPendingPageSound = true;
                                    }
                                });
                            }
                            
                            this.updatePaginationUI = updatePaginationUI;
                            updatePaginationUI();
                        },
                        
                        wireNumberButtons(pageEvents, pageNum, allEvents) {
                            const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
                            if (!buttons.length) return;
                            
                            const events = allEvents || window.eventManager?.getDockTimelineEvents?.() || [];
                            const eventsPerPage = 10; // Globe uses 10 events per page
                            const baseIndex = (pageNum - 1) * eventsPerPage;
                            
                            buttons.forEach((btn, index) => {
                                const newBtn = btn.cloneNode(true);
                                btn.parentNode.replaceChild(newBtn, btn);

                                const event = pageEvents?.[index];
                                const globalEventIndex = baseIndex + index;

                                if (!event) {
                                    newBtn.disabled = true;
                                    newBtn.style.opacity = '0.3';
                                    newBtn.style.display = 'none';
                                    return;
                                }

                                newBtn.disabled = false;
                                newBtn.style.opacity = '1';
                                newBtn.style.display = '';

                                // Set data-position to page position (1-10)
                                newBtn.dataset.position = String(index + 1);
                                newBtn.dataset.eventIndex = globalEventIndex;

                                const numEl = newBtn.querySelector('.event-number-btn__num');
                                const nameEl = newBtn.querySelector('.event-number-btn__name');
                                const imgEl = newBtn.querySelector('.event-number-btn__img');
                                const imgWrap = newBtn.querySelector('.event-number-btn__img-wrap');
                                const variantBadge = newBtn.querySelector('.event-number-btn__variant-badge');
                                const keyEl = newBtn.querySelector('.event-number-btn__key');

                                if (numEl) numEl.textContent = globalEventIndex + 1;
                                if (keyEl) keyEl.textContent = index + 1;
                                
                                // DEV ONLY: Check for overlapping coordinates on localhost
                                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                                    console.log('[DEV Overlap Check] Event:', event.name, 'coords:', event.location?.lat, event.location?.lon);
                                    
                                    const currentPageEvents = window.eventManager?.getDockTimelineEvents?.() || [];
                                    const hasOverlap = currentPageEvents.some((otherEvent, otherIndex) => {
                                        if (otherIndex === globalEventIndex) return false;
                                        const otherLat = otherEvent.location?.lat;
                                        const otherLon = otherEvent.location?.lon;
                                        const thisLat = event.location?.lat;
                                        const thisLon = event.location?.lon;
                                        const matches = otherLat === thisLat && otherLon === thisLon;
                                        if (matches) {
                                            console.log('[DEV Overlap Check] MATCH with:', otherEvent.name, 'coords:', otherLat, otherLon);
                                        }
                                        return matches;
                                    });
                                    
                                    console.log('[DEV Overlap Check] Has overlap:', hasOverlap, 'for position:', index + 1);
                                    
                                    if (hasOverlap) {
                                        keyEl.style.color = '#ff4444';
                                        keyEl.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)';
                                    } else {
                                        keyEl.style.color = '';
                                        keyEl.style.textShadow = '';
                                    }
                                }
                                
                                // Get display event (first variant for multi-events)
                                const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
                                const displayEvent = isMultiEvent && event.variants[0] 
                                    ? { ...event, ...event.variants[0] }
                                    : event;
                                
                                // Get plain name
                                const plainName = displayEvent.name || event.name || `Event ${globalEventIndex + 1}`;
                                if (nameEl) {
                                    if (window.GlitchTextService) {
                                        nameEl.innerHTML = window.GlitchTextService.getDisplayEventName(plainName);
                                    } else {
                                        nameEl.textContent = plainName;
                                    }
                                }
                                
                                // Get image path using helper
                                let imagePath = null;
                                if (window.NavigationImageHelpers?.getEventImagePath) {
                                    imagePath = window.NavigationImageHelpers.getEventImagePath(displayEvent, plainName, 'story');
                                } else if (window.eventManager?.getEventImagePath) {
                                    imagePath = window.eventManager.getEventImagePath(displayEvent.name, displayEvent.image, 'story');
                                } else {
                                    imagePath = displayEvent.image || displayEvent.imagePath || null;
                                }
                                
                                if (imgEl) {
                                    if (imagePath) {
                                        imgEl.src = imagePath;
                                        imgEl.style.display = '';
                                        if (imgWrap) imgWrap.classList.remove('event-number-btn__img-wrap--empty');
                                    } else {
                                        imgEl.removeAttribute('src');
                                        imgEl.style.display = 'none';
                                        if (imgWrap) imgWrap.classList.add('event-number-btn__img-wrap--empty');
                                    }
                                }
                                
                                // Show variant badge if multi-variant
                                if (variantBadge) {
                                    const hasVariants = Array.isArray(event.variants) && event.variants.length > 1;
                                    variantBadge.hidden = !hasVariants;
                                    variantBadge.dataset.eventIndex = globalEventIndex;
                                    variantBadge.dataset.currentVariant = '0';
                                    // Set badge text to show "1/3", "2/3", etc.
                                    if (hasVariants) {
                                        variantBadge.textContent = `1/${event.variants.length}`;
                                    }
                                }
                                
                                // Click handler - open event slide directly
                                newBtn.addEventListener('click', (e) => {
                                    e.stopPropagation();
                                    if (e.target.closest('.event-number-btn__variant-badge')) return;

                                    // Clear hover state when clicking thumbnail
                                    if (window.globeController?.interactionController) {
                                        window.globeController.interactionController.hoveredEventMarker = null;
                                    }
                                    if (window.globeController?.markerPulseService) {
                                        window.globeController.markerPulseService.hoveredEventMarker = null;
                                    }

                                    if (window.standaloneEventSlide) {
                                        window.standaloneEventSlide.showEvent(globalEventIndex);
                                        if (window.SoundEffectsManager?.play) {
                                            window.SoundEffectsManager.play('eventClick');
                                        }
                                    }
                                });
                                
                                // Variant badge click - cycles thumbnail and opens event slide
                                if (variantBadge) {
                                    variantBadge.addEventListener('click', (e) => {
                                        e.stopPropagation();
                                        const targetEvent = events[globalEventIndex];
                                        if (!targetEvent?.variants?.length) return;
                                        
                                        const currentVariant = parseInt(variantBadge.dataset.currentVariant || '0', 10);
                                        const nextVariant = (currentVariant + 1) % targetEvent.variants.length;
                                        variantBadge.dataset.currentVariant = nextVariant;
                                        // Update badge text
                                        variantBadge.textContent = `${nextVariant + 1}/${targetEvent.variants.length}`;
                                        
                                        // Play switch event sound (same as event manager)
                                        if (window.SoundEffectsManager?.play) {
                                            window.SoundEffectsManager.play('switchEvent');
                                        }
                                        
                                        // Update thumbnail image to show the variant
                                        const variantDisplayEvent = targetEvent.variants[nextVariant];
                                        if (variantDisplayEvent && imgEl) {
                                            let variantImagePath = null;
                                            if (window.NavigationImageHelpers?.getEventImagePath) {
                                                variantImagePath = window.NavigationImageHelpers.getEventImagePath(
                                                    variantDisplayEvent,
                                                    variantDisplayEvent.name,
                                                    'story'
                                                );
                                            } else if (window.eventManager?.getEventImagePath) {
                                                variantImagePath = window.eventManager.getEventImagePath(
                                                    variantDisplayEvent.name,
                                                    variantDisplayEvent.image,
                                                    'story'
                                                );
                                            } else {
                                                variantImagePath = variantDisplayEvent.image || variantDisplayEvent.imagePath || null;
                                            }
                                            
                                            if (variantImagePath) {
                                                imgEl.src = variantImagePath;
                                                imgEl.style.display = '';
                                                if (imgWrap) imgWrap.classList.remove('event-number-btn__img-wrap--empty');
                                            }
                                            
                                            // Update name to show variant name
                                            if (nameEl && variantDisplayEvent.name) {
                                                nameEl.textContent = variantDisplayEvent.name;
                                            }
                                        }
                                        
                                        // Also open the event slide with this variant
                                        if (window.standaloneEventSlide) {
                                            window.standaloneEventSlide.showStandaloneEventSlide({
                                                ...targetEvent,
                                                ...variantDisplayEvent,
                                                variantIndex: nextVariant,
                                                hasVariants: true,
                                                variants: targetEvent.variants
                                            }, globalEventIndex);
                                        }
                                    });
                                }
                                
                                // Hover effects - show preview badge only
                                newBtn.onmouseenter = () => {
                                    if (window.SummaryInfoBadge?.show && displayEvent) {
                                        const variants = isMultiEvent ? event.variants : [];
                                        const otherVariants = variants.slice(1);
                                        window.SummaryInfoBadge.show(
                                            globalEventIndex + 1,
                                            plainName,
                                            otherVariants.map(v => v.name || ''),
                                            displayEvent.eraName || '',
                                            null,
                                            [],
                                            displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `–${displayEvent.yearEnd}` : ''}` : ''
                                        );
                                    }
                                };
                                
                                newBtn.onmouseleave = () => {
                                    if (window.SummaryInfoBadge?.hide) {
                                        window.SummaryInfoBadge.hide();
                                    }
                                };
                            });
                        },
                        
                        updateNumberButtons(pageEvents, pageNum) {
                            const allEvents = window.eventManager?.getDockTimelineEvents?.() || [];
                            this.animatePageTurn(pageEvents, pageNum, allEvents);
                        },
                        
                        animatePageTurn(pageEvents, pageNum, allEvents) {
                            const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
                            if (!buttons.length) return;
                            
                            const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
                            if (prefersReducedMotion || typeof Element.prototype.animate !== 'function') {
                                this.wireNumberButtons(pageEvents, pageNum, allEvents);
                                return;
                            }
                            
                            // Match globe timing
                            const STAGGER_MS = 58;
                            const SHRINK_MS = 290;
                            const GROW_MS = 515;
                            
                            // Detect desktop layout (skews transform)
                            const isThumbsDesktop = window.matchMedia?.('(min-width: 1024px)')?.matches ?? false;
                            
                            // Cancel any existing animations
                            buttons.forEach(btn => {
                                if (btn.dataset.pageTurnToken) {
                                    try {
                                        const oldAnim = btn.getAnimations?.();
                                        if (oldAnim?.length) {
                                            oldAnim.forEach(a => a.cancel?.());
                                        }
                                    } catch (e) {}
                                }
                            });
                            
                            // Start fresh wave
                            const waveToken = Date.now().toString();
                            
                            buttons.forEach((btn, i) => {
                                // Get the event data for this button position
                                const event = pageEvents[i];
                                const globalEventIndex = (pageNum - 1) * 10 + i;
                                
                                // Handle case where there's no event for this button slot
                                if (!event) {
                                    btn.style.display = 'none';
                                    return;
                                }
                                
                                // Ensure button is visible (was hidden on pages with fewer events)
                                btn.style.display = '';
                                
                                btn.dataset.pageTurnToken = waveToken;
                                const locked = btn.dataset.locked === 'true';
                                
                                // Staggered start for each button
                                const delay = i * STAGGER_MS;
                                
                                // Step 1: Shrink out (old content)
                                const shrinkAnim = btn.animate(
                                    thumbPageTurnShrinkKeyframes(isThumbsDesktop, locked),
                                    {
                                        duration: SHRINK_MS,
                                        easing: 'cubic-bezier(0.55, 0.06, 0.68, 0.19)',
                                        delay: delay,
                                        fill: 'both'
                                    }
                                );
                                
                                shrinkAnim.onfinish = () => {
                                    // Check if this wave is still valid
                                    if (btn.dataset.pageTurnToken !== waveToken) return;
                                    
                                    // Update THIS button's content while it's invisible (between shrink and grow)
                                    this.updateSingleButtonContent(btn, event, globalEventIndex, allEvents);
                                    
                                    // Step 2: Grow in (new content)
                                    const growAnim = btn.animate(
                                        thumbPageTurnGrowKeyframes(isThumbsDesktop, locked),
                                        {
                                            duration: GROW_MS,
                                            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                                            fill: 'both'
                                        }
                                    );
                                    
                                    growAnim.onfinish = () => {
                                        delete btn.dataset.pageTurnToken;
                                        // Re-apply correct filter-based visual state (in case filters changed during animation)
                                        const finalLocked = btn.dataset.locked === 'true';
                                        if (finalLocked) {
                                            btn.style.setProperty('opacity', '0.5', 'important');
                                            btn.style.setProperty('filter', 'none', 'important');
                                            btn.classList.add('locked');
                                        } else {
                                            btn.style.setProperty('opacity', '1', 'important');
                                            btn.style.setProperty('filter', 'none', 'important');
                                            btn.classList.remove('locked');
                                        }
                                    };
                                };
                            });
                        },
                        
                        updateSingleButtonContent(btn, event, globalEventIndex, allEvents) {
                            if (!event) {
                                btn.style.display = 'none';
                                return;
                            }

                            btn.style.display = '';
                            // Calculate page position from global index (1-10)
                            const pagePosition = (globalEventIndex % 10) + 1;
                            btn.dataset.position = String(pagePosition);
                            btn.dataset.eventIndex = globalEventIndex;
                            
                            // Calculate current page from global index
                            const currentPage = Math.floor(globalEventIndex / 10) + 1;
                            const pageStart = (currentPage - 1) * 10;
                            const pageEnd = Math.min(pageStart + 10, allEvents.length);
                            const pageEvents = allEvents.slice(pageStart, pageEnd);
                            
                            // Check filter lock state
                            const activeFilters = window.standaloneActiveFilters || new Set();
                            const filtersOn = activeFilters.size > 0;
                            const isLocked = filtersOn && typeof window.shouldEventBeLocked === 'function' 
                                ? window.shouldEventBeLocked(event, activeFilters)
                                : false;
                            
                            if (isLocked) {
                                btn.disabled = true;
                                btn.setAttribute('disabled', '');
                                btn.style.pointerEvents = 'none';
                                btn.style.setProperty('opacity', '0.5', 'important');
                                btn.style.setProperty('filter', 'none', 'important');
                                btn.classList.add('locked');
                            } else {
                                btn.disabled = false;
                                btn.removeAttribute('disabled');
                                btn.style.pointerEvents = 'auto';
                                btn.style.setProperty('opacity', '1', 'important');
                                btn.style.setProperty('filter', 'none', 'important');
                                btn.classList.remove('locked');
                            }
                            btn.dataset.locked = isLocked ? 'true' : 'false';
                            
                            // DEV ONLY: Check for overlapping coordinates on localhost
                            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                                console.log('[DEV Overlap Check] Event:', event.name, 'coords:', event.lat, event.lon);
                                
                                const hasOverlap = pageEvents.some((otherEvent, otherIndex) => {
                                    if (otherIndex === (globalEventIndex % 10)) return false;
                                    const otherLat = otherEvent.lat;
                                    const otherLon = otherEvent.lon;
                                    const thisLat = event.lat;
                                    const thisLon = event.lon;
                                    
                                    // Only consider it an overlap if both have valid coordinates AND they match
                                    if (otherLat == null || otherLon == null || thisLat == null || thisLon == null) {
                                        return false;
                                    }
                                    
                                    const matches = otherLat === thisLat && otherLon === thisLon;
                                    if (matches) {
                                        console.log('[DEV Overlap Check] MATCH with:', otherEvent.name, 'coords:', otherLat, otherLon);
                                    }
                                    return matches;
                                });
                                
                                console.log('[DEV Overlap Check] Has overlap:', hasOverlap, 'for position:', pagePosition);
                                
                                const keyEl = btn.querySelector('.event-number-btn__key');
                                if (hasOverlap && keyEl) {
                                    keyEl.style.color = '#ff4444';
                                    keyEl.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.45)';
                                } else if (keyEl) {
                                    keyEl.style.color = '';
                                    keyEl.style.textShadow = '';
                                }
                            }
                            
                            // Debug logging with visual state
                            if (filtersOn || btn.style.opacity !== '1') {
                                console.log(`[VISUAL MSH] Event ${globalEventIndex}: isLocked=${isLocked}, opacity='${btn.style.opacity}', classList='${btn.classList.value}'`);
                            }
                            
                            const numEl = btn.querySelector('.event-number-btn__num');
                            const nameEl = btn.querySelector('.event-number-btn__name');
                            const imgEl = btn.querySelector('.event-number-btn__img');
                            const imgWrap = btn.querySelector('.event-number-btn__img-wrap');
                            const variantBadge = btn.querySelector('.event-number-btn__variant-badge');
                            const keyEl = btn.querySelector('.event-number-btn__key');
                            
                            if (numEl) numEl.textContent = globalEventIndex + 1;
                            if (keyEl) keyEl.textContent = (globalEventIndex % 10) + 1;
                            
                            const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
                            const displayEvent = isMultiEvent && event.variants[0]
                                ? { ...event, ...event.variants[0] }
                                : event;
                            
                            const plainName = displayEvent.name || event.name || `Event ${globalEventIndex + 1}`;
                            if (nameEl) {
                                if (window.GlitchTextService) {
                                    nameEl.innerHTML = window.GlitchTextService.getDisplayEventName(plainName);
                                } else {
                                    nameEl.textContent = plainName;
                                }
                            }
                            
                            // Check if event has description (unfinished indicator)
                            const hasDescription = displayEvent.description && displayEvent.description.trim().length > 0;
                            btn.classList.toggle('event-number-btn--unfinished', !hasDescription);
                            btn.title = hasDescription ? plainName : `${plainName} — Unfinished: missing description`;
                            
                            // Get image (dock uses main timeline event art)
                            let imagePath = null;
                            if (window.NavigationImageHelpers?.getEventImagePath) {
                                imagePath = window.NavigationImageHelpers.getEventImagePath(displayEvent, plainName, 'story');
                            } else if (window.eventManager?.getEventImagePath) {
                                imagePath = window.eventManager.getEventImagePath(displayEvent.name, displayEvent.image, 'story');
                            } else {
                                imagePath = displayEvent.image || displayEvent.imagePath || null;
                            }
                            
                            if (imgEl) {
                                if (imagePath) {
                                    imgEl.src = imagePath;
                                    imgEl.style.display = '';
                                    if (imgWrap) imgWrap.classList.remove('event-number-btn__img-wrap--empty');
                                } else {
                                    imgEl.removeAttribute('src');
                                    imgEl.style.display = 'none';
                                    if (imgWrap) imgWrap.classList.add('event-number-btn__img-wrap--empty');
                                }
                            }
                            
                            // Variant badge
                            if (variantBadge) {
                                const hasVariants = Array.isArray(event.variants) && event.variants.length > 1;
                                variantBadge.hidden = !hasVariants;
                                variantBadge.dataset.eventIndex = globalEventIndex;
                                variantBadge.dataset.currentVariant = '0';
                                if (hasVariants) {
                                    variantBadge.textContent = `1/${event.variants.length}`;
                                }
                            }
                            
                            // Click handler
                            btn.onclick = (e) => {
                                e.stopPropagation();
                                if (e.target.closest('.event-number-btn__variant-badge')) return;
                                if (window.standaloneEventSlide) {
                                    window.standaloneEventSlide.showEvent(globalEventIndex);
                                    window.SoundEffectsManager?.play?.('eventClick');
                                }
                            };
                            
                            // Variant badge click
                            if (variantBadge) {
                                variantBadge.onclick = (e) => {
                                    e.stopPropagation();
                                    const targetEvent = allEvents[globalEventIndex];
                                    if (!targetEvent?.variants?.length) return;
                                    
                                    const currentVariant = parseInt(variantBadge.dataset.currentVariant || '0', 10);
                                    const nextVariant = (currentVariant + 1) % targetEvent.variants.length;
                                    variantBadge.dataset.currentVariant = nextVariant;
                                    variantBadge.textContent = `${nextVariant + 1}/${targetEvent.variants.length}`;
                                    
                                    const variantDisplayEvent = targetEvent.variants[nextVariant];
                                    if (variantDisplayEvent && imgEl) {
                                        let variantImagePath = null;
                                        if (window.NavigationImageHelpers?.getEventImagePath) {
                                            variantImagePath = window.NavigationImageHelpers.getEventImagePath(
                                                variantDisplayEvent,
                                                variantDisplayEvent.name,
                                                'story'
                                            );
                                        } else if (window.eventManager?.getEventImagePath) {
                                            variantImagePath = window.eventManager.getEventImagePath(
                                                variantDisplayEvent.name,
                                                variantDisplayEvent.image,
                                                'story'
                                            );
                                        } else {
                                            variantImagePath = variantDisplayEvent.image || variantDisplayEvent.imagePath || null;
                                        }
                                        
                                        if (variantImagePath) {
                                            imgEl.src = variantImagePath;
                                            imgEl.style.display = '';
                                            if (imgWrap) imgWrap.classList.remove('event-number-btn__img-wrap--empty');
                                        }
                                        if (nameEl && variantDisplayEvent.name) {
                                            nameEl.textContent = variantDisplayEvent.name;
                                        }
                                    }
                                    
                                    if (window.standaloneEventSlide) {
                                        window.standaloneEventSlide.showStandaloneEventSlide({
                                            ...targetEvent,
                                            ...variantDisplayEvent,
                                            variantIndex: nextVariant,
                                            hasVariants: true,
                                            variants: targetEvent.variants
                                        }, globalEventIndex);
                                    }
                                };
                            }
                            
                            // Hover effects
                            btn.onmouseenter = () => {
                                if (window.SummaryInfoBadge?.show && displayEvent) {
                                    const variants = isMultiEvent ? event.variants : [];
                                    const otherVariants = variants.slice(1);
                                    window.SummaryInfoBadge.show(
                                        globalEventIndex + 1,
                                        plainName,
                                        otherVariants.map(v => v.name || ''),
                                        displayEvent.eraName || '',
                                        null,
                                        [],
                                        displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `–${displayEvent.yearEnd}` : ''}` : ''
                                    );
                                }
                            };
                            
                            btn.onmouseleave = () => {
                                if (window.SummaryInfoBadge?.hide) {
                                    window.SummaryInfoBadge.hide();
                                }
                            };
                        },
                        
                        toggleImageOverlay(imagePath) {
                            const overlay = document.getElementById('eventImageOverlay');
                            if (!overlay) return;
                            
                            // Play sound effect
                            if (window.SoundEffectsManager) {
                                window.SoundEffectsManager.play('switchMap');
                            }
                            
                            if (overlay.classList.contains('open')) {
                                this.hideImageOverlay();
                            } else if (imagePath) {
                                this.showImageOverlay(imagePath);
                            }
                        },
                        
                        showImageOverlay(imagePath) {
                            const overlay = document.getElementById('eventImageOverlay');
                            const img = document.getElementById('eventImage');
                            const eventSlide = document.getElementById('eventSlide');
                            
                            if (overlay && img && imagePath) {
                                img.src = imagePath;
                                img.style.display = 'block';
                                img.style.opacity = '1';
                                overlay.style.display = 'flex';
                                overlay.style.opacity = '1';
                                overlay.classList.add('open');
                                // Add slide-open class if event slide is open (positions image to the right of panel)
                                if (eventSlide?.classList.contains('open')) {
                                    overlay.classList.add('slide-open');
                                }
                                
                                // Setup click-to-hide handler if not already set
                                if (!overlay.dataset.clickHandlerSet) {
                                    overlay.dataset.clickHandlerSet = 'true';
                                    overlay.addEventListener('click', (e) => {
                                        if (e.target === overlay || e.target.tagName === 'IMG') {
                                            e.stopPropagation();
                                            this.hideImageOverlayTemporarily(5000);
                                        }
                                    });
                                }
                            }
                        },
                        
                        hideImageOverlayTemporarily(delayMs = 5000) {
                            const overlay = document.getElementById('eventImageOverlay');
                            if (!overlay || !overlay.classList.contains('open')) return;
                            
                            // Save the current image path before hiding
                            const img = document.getElementById('eventImage');
                            const savedImagePath = img?.src || this.currentImagePath;
                            
                            // Hide with gradual fade
                            this.hideImageOverlay();
                            
                            // Setup auto-restore timer
                            let restoreTimeoutId = null;
                            let activityListenersAttached = false;
                            
                            const activityEvents = ['mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
                            
                            const resetTimer = () => {
                                console.log('[IMAGE TEMP HIDE] Activity detected - resetting timer');
                                if (restoreTimeoutId) {
                                    clearTimeout(restoreTimeoutId);
                                }
                                restoreTimeoutId = setTimeout(() => {
                                    const eventSlide = document.getElementById('eventSlide');
                                    if (eventSlide?.classList.contains('open') && savedImagePath) {
                                        console.log('[IMAGE TEMP HIDE] Timer complete - restoring image');
                                        this.showImageOverlayGradually(savedImagePath, 600);
                                    }
                                    detachActivityListeners();
                                    restoreTimeoutId = null;
                                }, delayMs);
                            };
                            
                            const attachActivityListeners = () => {
                                if (activityListenersAttached) return;
                                activityListenersAttached = true;
                                activityEvents.forEach(event => {
                                    document.addEventListener(event, resetTimer, { passive: true, capture: true });
                                });
                                
                                // Listen for marker hover events
                                const onMarkerHover = () => resetTimer();
                                window.addEventListener('markerhover', onMarkerHover);
                                
                                // Listen for thumbnail hover
                                const onThumbnailHover = () => resetTimer();
                                window.addEventListener('thumbnailhover', onThumbnailHover);
                                
                                // Store cleanup functions
                                this._tempHideCleanup = () => {
                                    window.removeEventListener('markerhover', onMarkerHover);
                                    window.removeEventListener('thumbnailhover', onThumbnailHover);
                                };
                            };
                            
                            const detachActivityListeners = () => {
                                if (!activityListenersAttached) return;
                                activityListenersAttached = false;
                                activityEvents.forEach(event => {
                                    document.removeEventListener(event, resetTimer, { capture: true });
                                });
                                if (this._tempHideCleanup) {
                                    this._tempHideCleanup();
                                    this._tempHideCleanup = null;
                                }
                            };
                            
                            // Start listening for activity
                            attachActivityListeners();
                            
                            // Watch for event slide closing - cancel restore
                            let slideObserver = null;
                            const eventSlide = document.getElementById('eventSlide');
                            if (eventSlide) {
                                slideObserver = new MutationObserver((mutations) => {
                                    mutations.forEach((mutation) => {
                                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                                            if (!eventSlide.classList.contains('open')) {
                                                console.log('[IMAGE TEMP HIDE] Event slide closed - canceling restore');
                                                if (restoreTimeoutId) {
                                                    clearTimeout(restoreTimeoutId);
                                                    restoreTimeoutId = null;
                                                }
                                                detachActivityListeners();
                                                if (slideObserver) {
                                                    slideObserver.disconnect();
                                                    slideObserver = null;
                                                }
                                            }
                                        }
                                    });
                                });
                                slideObserver.observe(eventSlide, { attributes: true, attributeFilter: ['class'] });
                            }
                            
                            // Start initial timer
                            console.log(`[IMAGE TEMP HIDE] Starting ${delayMs}ms timer`);
                            restoreTimeoutId = setTimeout(() => {
                                const eventSlide = document.getElementById('eventSlide');
                                if (eventSlide?.classList.contains('open') && savedImagePath) {
                                    console.log('[IMAGE TEMP HIDE] Timer complete - restoring image');
                                    this.showImageOverlayGradually(savedImagePath, 600);
                                }
                                detachActivityListeners();
                                if (slideObserver) {
                                    slideObserver.disconnect();
                                    slideObserver = null;
                                }
                                restoreTimeoutId = null;
                            }, delayMs);
                        },
                        
                        showImageOverlayGradually(imagePath, durationMs = 1500) {
                            const overlay = document.getElementById('eventImageOverlay');
                            const img = document.getElementById('eventImage');
                            const eventSlide = document.getElementById('eventSlide');
                            
                            if (!overlay || !img || !imagePath) return;
                            
                            img.src = imagePath;
                            img.style.display = 'block';
                            img.style.opacity = '0';
                            overlay.style.display = 'flex';
                            overlay.classList.add('open');
                            // Add slide-open class if event slide is open (positions image to the right of panel)
                            if (eventSlide?.classList.contains('open')) {
                                overlay.classList.add('slide-open');
                            }
                            overlay.style.opacity = '0';
                            
                            // Gradual fade-in with progress logging
                            const startTime = Date.now();
                            const fadeInterval = 50; // Update every 50ms
                            
                            console.log(`[IMAGE RESTORE] Starting gradual fade-in over ${durationMs}ms...`);
                            
                            const fadeTimer = setInterval(() => {
                                const elapsed = Date.now() - startTime;
                                const progress = Math.min(elapsed / durationMs, 1);
                                // Ease-in curve for smooth appearance
                                const eased = progress * progress; // Quadratic ease-in
                                const opacity = eased;
                                
                                overlay.style.opacity = String(opacity);
                                img.style.opacity = String(opacity);
                                
                                // Log progress at 25%, 50%, 75%, 100%
                                if (progress >= 0.25 && progress < 0.30) console.log('[IMAGE RESTORE] Fade 25%...');
                                if (progress >= 0.50 && progress < 0.55) console.log('[IMAGE RESTORE] Fade 50%...');
                                if (progress >= 0.75 && progress < 0.80) console.log('[IMAGE RESTORE] Fade 75%...');
                                
                                if (progress >= 1) {
                                    clearInterval(fadeTimer);
                                    overlay.style.opacity = '1';
                                    img.style.opacity = '1';
                                    console.log('[IMAGE RESTORE] Fade 100% - Image fully restored!');
                                }
                            }, fadeInterval);
                        },
                        
                        hideImageOverlay() {
                            const overlay = document.getElementById('eventImageOverlay');
                            if (overlay) {
                                overlay.classList.remove('open', 'slide-open');
                                overlay.style.opacity = '0';
                                setTimeout(() => {
                                    if (!overlay.classList.contains('open')) overlay.style.display = 'none';
                                }, 600);
                            }
                        }
                    };

                    const backBtnInitMs = document.getElementById('eventSlideBack');
                    if (backBtnInitMs && !backBtnInitMs.dataset.slideNavBound) {
                        backBtnInitMs.dataset.slideNavBound = '1';
                        backBtnInitMs.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.standaloneEventSlide?.goBackSlide) {
                                await window.standaloneEventSlide.goBackSlide();
                            }
                        });
                    }
                    
                    // Wire up news ticker clicks
                    if (window.newsTickerService?.tickerContainer) {
                        window.newsTickerService.tickerContainer.addEventListener('click', (e) => {
                            const item = e.target?.closest?.('.news-ticker-item');
                            if (item) {
                                e.stopPropagation();
                                const eventIndex = parseInt(item.dataset.eventIndex, 10);
                                if (!isNaN(eventIndex)) window.standaloneEventSlide.showEvent(eventIndex);
                            }
                        });
                    }
                    
                    // Wire up Event Manager list clicks (index is into the active archive list, not the dock timeline)
                    window.eventManager.openEventFromList = function(event, index) {
                        if (!window.standaloneEventSlide) return;
                        const list = window.eventManager?.events || [];
                        let idx = typeof index === 'number' ? index : list.indexOf(event);
                        if (idx < 0 || idx >= list.length) idx = list.indexOf(event);
                        if (idx < 0 || idx >= list.length) return;
                        window.standaloneEventSlide.showEvent(idx, { eventList: list });
                        if (window.SoundEffectsManager?.play) {
                            window.SoundEffectsManager.play('eventClick');
                        }
                    };
                    
                    // Setup standalone pagination dock (wait for dock to be created)
                    if (window.standaloneEventSlide?.setupStandalonePagination) {
                        setTimeout(() => {
                            window.standaloneEventSlide.setupStandalonePagination();
                        }, 200);
                    }
                }

                testBtn.dataset.loaded = 'true';
                testBtn.textContent = 'UNLOAD Event System Load Out';
                testBtn.style.background = '#c93439';
                // Add class to body to show resize handle
                document.body.classList.add('event-system-loaded');
                if (statusService) statusService.update('✓ News ticker loaded - click again to unload', 'success');
            } catch (error) {
                console.error('Error loading news ticker:', error);
                if (statusService) statusService.update(`✗ Error: ${error.message}`, 'error');
            }
        } else {
            // UNLOAD
            console.log('[MenuServiceHelpers] UNLOAD branch entered');
            if (statusService) statusService.update('Unloading news ticker...', 'info');
            teardownMenuServiceEventSystemLayout();

            // Clear news ticker
            if (window.newsTickerService) {
                window.newsTickerService.clear();
            }

            // Remove timeline-loaded class from footer
            const footer = document.querySelector('footer');
            if (footer) {
                footer.classList.remove('timeline-loaded');
            }

            document.getElementById('eventsManageToggle')?.remove();

            // Close event slide panel if open
            const eventSlide = document.getElementById('eventSlide');
            if (eventSlide) eventSlide.classList.remove('open');

            // Hide image overlay if open
            const eventImageOverlay = document.getElementById('eventImageOverlay');
            if (eventImageOverlay) eventImageOverlay.classList.remove('open');

            // Clean up standalone event slide
            window.standaloneEventSlide = null;

            // Remove pagination dock (includes eventPagination inside it)
            const paginationDock = document.getElementById('paginationDock');
            if (paginationDock) {
                paginationDock.remove();
            }
            const paginationDockCollapseStrip = document.getElementById('paginationDockCollapseStrip');
            if (paginationDockCollapseStrip) {
                paginationDockCollapseStrip.remove();
            }
            // Also explicitly remove eventPagination if it exists outside the dock
            const eventPagination = document.getElementById('eventPagination');
            if (eventPagination) {
                eventPagination.remove();
            }

            // Remove pagination buttons and elements that may have been moved to rails
            const paginationElements = [
                'prevPageBtn',
                'prevEventBtn',
                'nextEventBtn',
                'nextPageBtn',
                'globalImageToggle',
                'filtersToggle',
                'eventsManageToggle',
                'pageInput',
                'pageTotal',
            ];
            paginationElements.forEach((id) => {
                document.getElementById(id)?.remove();
            });

            document.querySelectorAll('.page-input-container').forEach((el) => el.remove());
            ensureMenuServiceDockGlobeRailCenterRestored();

            // Clear eventNumberButtons content to prevent duplicate thumbnails
            const eventNumberButtons = document.getElementById('eventNumberButtons');
            if (eventNumberButtons) {
                eventNumberButtons.innerHTML = '';
            }

            // Close events manage panel if open
            const eventsManagePanel = document.getElementById('eventsManagePanel');
            if (eventsManagePanel) {
                eventsManagePanel.classList.remove('open');
            }

            // Clear events list
            const eventsList = document.getElementById('eventsList');
            if (eventsList) {
                eventsList.innerHTML = '';
            }

            // Remove event manager listeners flag so it can be re-initialized
            if (window.eventManager) {
                window.eventManager.listenersSetup = false;
            }

            // Cleanup SummaryInfoBadge (reset module state)
            if (window.SummaryInfoBadge?.cleanup) {
                window.SummaryInfoBadge.cleanup();
            }

            // Clear standalone filters
            if (window.standaloneActiveFilters) {
                window.standaloneActiveFilters.clear();
            }
            if (window.FilterService?.stateManager) {
                window.FilterService.stateManager.clear();
            }
            console.log('[MenuServiceHelpers] Calling FilterService.reset()...');
            console.log('[MenuServiceHelpers] window.FilterService exists:', !!window.FilterService);
            console.log('[MenuServiceHelpers] window.FilterService.reset exists:', !!(window.FilterService?.reset));
            if (window.FilterService?.reset) {
                window.FilterService.reset();
                console.log('[MenuServiceHelpers] FilterService.reset() called successfully');
            } else {
                console.log('[MenuServiceHelpers] FilterService.reset() not called - method not available');
            }

            // Close and remove filters panel
            const filtersPanel = document.getElementById('filtersPanel');
            if (filtersPanel) {
                filtersPanel.classList.remove('open');
                filtersPanel.remove();
            }

            testBtn.dataset.loaded = 'false';
            testBtn.textContent = 'LOAD Event System Load Out';
            testBtn.style.background = '#333';
            // Remove class from body to hide resize handle
            document.body.classList.remove('event-system-loaded');
            if (statusService) statusService.update('✓ News ticker unloaded', 'success');
        }
    });
    menuButtons.appendChild(autoPreloadContainer);
    menuButtons.appendChild(mapGlobeToggleContainer);
    menuButtons.appendChild(testBtn);

    return menuButtons;
}

/**
 * Appends menu buttons to the appropriate container
 * @param {HTMLElement} menuButtons - The menu buttons container
 * @param {boolean} isTestPage - Whether this is a test page
 * @param {Object} statusService - Status service for updates
 */
export function appendMenuButtons(menuButtons, isTestPage, statusService) {
    const contentContainer = document.getElementById('content');
    const targetContainer = contentContainer || document.body;
    
    if (!targetContainer) {
        console.error('No container found for menu buttons!');
        return;
    }
    
    // On test page, insert before test-container so menu appears first
    if (isTestPage) {
        const testContainer = document.querySelector('.test-container');
        if (testContainer && testContainer.parentNode) {
            testContainer.parentNode.insertBefore(menuButtons, testContainer);
        } else {
            targetContainer.appendChild(menuButtons);
        }
    } else {
        targetContainer.appendChild(menuButtons);
    }
    
    if (statusService) {
        statusService.update('✓ Menu buttons added', 'success');
    }
    
    // Set up event listeners for the newly created menu buttons
    if (window.setupMenuButtonListeners) {
        window.setupMenuButtonListeners();
    }
}

/**
 * Checks if we're on a test page
 * @returns {boolean} - True if on test page
 */
export function isTestPage() {
    const existingGlobeBtn = document.getElementById('runGlobeBtn');
    return existingGlobeBtn && existingGlobeBtn.classList.contains('test-run-button');
}

// Make available globally for script tag loading
if (typeof window !== 'undefined') {
    if (!window.ServiceMenuHelpers) {
        window.ServiceMenuHelpers = {};
    }
    window.ServiceMenuHelpers.isGitHubPages = isGitHubPages;
    window.ServiceMenuHelpers.createMenuButton = createMenuButton;
    window.ServiceMenuHelpers.removeOldTestButtons = removeOldTestButtons;
    window.ServiceMenuHelpers.createMenuButtonsContainer = createMenuButtonsContainer;
    window.ServiceMenuHelpers.appendMenuButtons = appendMenuButtons;
    window.ServiceMenuHelpers.isTestPage = isTestPage;
}
