/**
 * MenuHelpers - Utilities for menu creation
 * Extracted from component-loader.js
 */

import { updateStatus } from '../../managers/StatusManager.js';
import { getOrCreateElement, createEventPagination, createFiltersPanel } from './ComponentDOMHelpers.js';
import { createGlobeControlButton } from './ComponentLoadHelpers.js';
import { shouldEventBeLocked } from '../../managers/helpers/MarkerCreationHelpers.js';
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
    copyFilterPlaceArraysFromSource
} from '../../utils/StoryFilterPlacesSync.js';

function teardownMenuHelpersEventSystemLayout() {
    const st = window.__menuHelpersEventSystemLayout;
    if (!st) return;
    if (st.moveChrome) {
        window.removeEventListener('resize', st.moveChrome);
        window.removeEventListener('orientationchange', st.moveChrome);
    }
    if (st.moveDock) {
        window.removeEventListener('resize', st.moveDock);
        window.removeEventListener('orientationchange', st.moveDock);
    }
    window.__menuHelpersEventSystemLayout = null;
}

/** Remove stray dock/pagination chrome so a second Event System load cannot double-mount controls */
function sweepEventSystemDockOrphans() {
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

function ensureDockGlobeRailCenterRestored() {
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
 * Find marker for an event by global event index
 * Used to trigger marker hover effects from dock thumbnails
 * Handles both WebGL markers (globe view) and DOM markers (map view)
 */
function findMarkerForEvent(event, globalEventIndex) {
    if (!event) return null;

    const sceneModel = window.globeController?.sceneModel;
    if (!sceneModel) return null;

    const isMapView = sceneModel.getMapViewEnabled?.() || !!sceneModel.isMapView;

    if (isMapView) {
        // Map view: find DOM marker in map2dLite layer
        const map2dLite = window.globeController?.map2dLite;
        if (!map2dLite) return createStubForMapView(event, globalEventIndex);

        // Check all marker containers (earth, moon, mars, orbit)
        const containers = [map2dLite.markersEl, map2dLite._moonMarkersEl, map2dLite._marsMarkersEl, map2dLite._orbitMarkersEl];

        for (const container of containers) {
            if (!container) continue;
            const buttons = container.querySelectorAll('.map-2d-lite__marker');
            for (const btn of buttons) {
                const identity = btn.__map2dLiteIdentity;
                if (!identity) continue;

                const markerEvent = identity.event;
                if (!markerEvent) continue;

                // Match by name and location
                const nameMatch = markerEvent.name === event.name;
                const locationMatch =
                    markerEvent.locationType === event.locationType &&
                    markerEvent.lat === event.lat &&
                    markerEvent.lon === event.lon &&
                    markerEvent.x === event.x &&
                    markerEvent.y === event.y;

                if (nameMatch || locationMatch) {
                    // Return the stub from the button with the button element attached
                    const stub = btn.__map2dLiteStub || createStubForMapView(event, globalEventIndex);
                    stub.__domMarkerButton = btn;
                    return stub;
                }
            }
        }

        // No DOM marker found, return stub for map view
        return createStubForMapView(event, globalEventIndex);
    }

    // Globe view: find WebGL marker
    const markers = sceneModel.getMarkers?.() || [];

    for (const marker of markers) {
        if (!marker.userData?.isEventMarker) continue;

        const markerEvent = marker.userData.event;
        if (!markerEvent) continue;

        // Match by name and location
        const nameMatch = markerEvent.name === event.name;
        const locationMatch =
            markerEvent.locationType === event.locationType &&
            markerEvent.lat === event.lat &&
            markerEvent.lon === event.lon;

        if (nameMatch || locationMatch) {
            return marker;
        }
    }

    return null;
}

/**
 * Create a stub marker for map view (similar to Map2DLiteLayer's makeStubMarker)
 */
function createStubForMapView(event, globalEventIndex) {
    if (!event) return null;
    
    const filters = window.standaloneActiveFilters || new Set();
    const locked = filters.size > 0 && window.MarkerCreationHelpers?.shouldEventBeLocked 
        ? window.MarkerCreationHelpers.shouldEventBeLocked(event, filters)
        : false;
    
    // Get display event (handle variants)
    const isMultiEvent = Array.isArray(event.variants) && event.variants.length > 0;
    const displayEvent = isMultiEvent && event.variants[0] 
        ? { ...event, ...event.variants[0] } 
        : event;
    
    return {
        userData: {
            isEventMarker: true,
            isInteractive: true,
            isLocked: locked,
            event: event,
            eventName: displayEvent.name || event.name,
            locationType: displayEvent.locationType || event.locationType || 'earth',
            variantIndex: 0,
            isMainVariant: true,
            originalColor: window.MarkerCreationHelpers?.getMarkerColor?.(true) || 0xffaa00,
            isMap2dLiteProxy: true
        }
    };
}

/** Store camera state before thumbnail hover for restoration */
let _thumbnailHoverCameraState = null;

/** Store sound interval for continuous radiate sound */
let _thumbnailHoverSoundInterval = null;

/**
 * Smoothly center camera on a marker (hover preview - zooms in like zoomToMarker)
 */
function centerCameraOnMarker(marker) {
    const sceneModel = window.globeController?.sceneModel;
    if (!sceneModel || !marker) return;
    
    const isMapView = sceneModel.getMapViewEnabled?.() || !!sceneModel.isMapView;
    
    // Disable auto-rotate
    sceneModel.setAutoRotate?.(false);
    
    if (isMapView) {
        // Map view: use Map2DLiteLayer's flyToLatLon
        const ev = marker.userData?.event;
        if (ev?.lat != null && ev?.lon != null) {
            // Store map state for restoration
            const map2dLite = window.globeController?.map2dLite;
            if (map2dLite && !_thumbnailHoverCameraState) {
                _thumbnailHoverCameraState = {
                    isMapView: true,
                    tx: map2dLite._tx,
                    ty: map2dLite._ty,
                    scale: map2dLite._scale
                };
            }
            window.globeController?.map2dLite?.flyToLatLon?.(ev.lat, ev.lon);
        }
    } else {
        // Globe view: move Three.js camera
        const camera = sceneModel.getCamera?.();
        const globe = sceneModel.getGlobe?.();
        if (!camera || !globe) return;
        
        // Store current state before moving (for restoration)
        if (!_thumbnailHoverCameraState) {
            _thumbnailHoverCameraState = {
                cameraPosition: camera.position.clone(),
                isMapView: false
            };
        }
        
        // Get marker world position
        const markerWorldPos = new THREE.Vector3();
        marker.getWorldPosition(markerWorldPos);
        
        // Globe view: move camera along radial direction toward marker (like zoomToMarker)
        const targetDistance = 3.2; // Moderate zoom - closer than default (4-5) but not as close as click (2.5)
        const direction = markerWorldPos.clone().normalize();
        const targetPosition = direction.multiplyScalar(targetDistance);
        
        // Animate camera to target
        const startPosition = camera.position.clone();
        const startTime = Date.now();
        const duration = 600; // ms
        
        function animateCamera() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3); // Ease out cubic
            
            // Interpolate position
            camera.position.lerpVectors(startPosition, targetPosition, ease);
            
            // Look at marker (accounting for globe rotation)
            const currentMarkerPos = new THREE.Vector3();
            marker.getWorldPosition(currentMarkerPos);
            camera.lookAt(currentMarkerPos);
            
            if (progress < 1) {
                requestAnimationFrame(animateCamera);
            }
        }
        
        animateCamera();
    }
}

/**
 * Restore camera to position before thumbnail hover
 */
function restoreCameraFromThumbnailHover() {
    if (!_thumbnailHoverCameraState) return;
    
    const sceneModel = window.globeController?.sceneModel;
    if (!sceneModel) return;
    
    const state = _thumbnailHoverCameraState;
    const isMapView = sceneModel.getMapViewEnabled?.() || !!sceneModel.isMapView;
    
    // Only restore if we're in the same view mode we started in
    if (isMapView && state.isMapView) {
        // Map view: animate back to original transform
        const map2dLite = window.globeController?.map2dLite;
        if (map2dLite && state.tx != null) {
            const startTx = map2dLite._tx;
            const startTy = map2dLite._ty;
            const startScale = map2dLite._scale;
            const targetTx = state.tx;
            const targetTy = state.ty;
            const targetScale = state.scale;
            const startTime = Date.now();
            const duration = 500;
            
            function animateRestore() {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                
                map2dLite._tx = startTx + (targetTx - startTx) * ease;
                map2dLite._ty = startTy + (targetTy - startTy) * ease;
                map2dLite._scale = startScale + (targetScale - startScale) * ease;
                map2dLite._applyTransform();
                
                if (progress < 1) {
                    requestAnimationFrame(animateRestore);
                }
            }
            animateRestore();
        }
    } else if (!isMapView && !state.isMapView && state.cameraPosition) {
        // Globe view: animate camera back to original position
        const camera = sceneModel.getCamera?.();
        if (!camera) return;
        
        const startPos = camera.position.clone();
        const targetPos = state.cameraPosition;
        const startTime = Date.now();
        const duration = 500;
        
        function animateRestore() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            
            camera.position.lerpVectors(startPos, targetPos, ease);
            camera.lookAt(0, 0, 0); // Look at globe center
            
            if (progress < 1) {
                requestAnimationFrame(animateRestore);
            }
        }
        animateRestore();
    }
    
    // Clear stored state
    _thumbnailHoverCameraState = null;
    
    // Re-enable auto-rotate after a delay if enabled
    if (sceneModel.getAutoRotateEnabled?.()) {
        setTimeout(() => {
            if (!sceneModel.eventMarker) {
                sceneModel.setAutoRotate?.(true);
            }
        }, 1000);
    }
}

/**
 * Updates standalone pagination thumbnails based on active filters
 * Locks (disables/dims) thumbnails for events that don't match filters
 */
export function updateStandalonePaginationForFilters() {
    const activeFilters = window.standaloneActiveFilters || new Set();
    const events = window.eventManager?.getDockTimelineEvents?.() || [];
    const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
    
    // Get stack trace to find who's calling this function
    const stack = new Error().stack;
    const caller = stack?.split('\n')[2]?.trim() || 'unknown';
    
    console.log(`[FILTER DEBUG] 🔄 updateStandalonePaginationForFilters() called`);
    console.log(`[FILTER DEBUG]    Caller: ${caller}`);
    console.log(`[FILTER DEBUG]    Active filters: [${Array.from(activeFilters).join(', ')}]`);
    console.log(`[FILTER DEBUG]    Total events: ${events.length}, buttons found: ${buttons.length}`);
    
    if (!buttons.length) {
        console.log(`[FILTER DEBUG]    No buttons found - skipping update`);
        return;
    }
    
    const eventsPerPage = 10;
    const currentPage = window.standaloneEventSlide?.currentPage || 1;
    const startIndex = (currentPage - 1) * eventsPerPage;
    
    let lockedCount = 0;
    let unlockedCount = 0;
    let hiddenCount = 0;
    
    buttons.forEach((btn, index) => {
        const eventIndex = startIndex + index;
        const event = events[eventIndex];
        
        if (!event) {
            // No event for this slot - hide button
            btn.style.display = 'none';
            hiddenCount++;
            return;
        }
        
        // Check if this event should be locked based on filters
        const isLocked = activeFilters.size > 0 && shouldEventBeLocked(event, activeFilters);
        
        if (isLocked) {
            btn.disabled = true;
            btn.classList.add('locked');
            btn.style.setProperty('opacity', '0.5', 'important');
            btn.style.setProperty('filter', 'none', 'important');
            btn.style.pointerEvents = 'none';
            btn.title = btn.title.replace(' — Filtered out', '') + ' — Filtered out';
            btn.dataset.isLocked = 'true';
            lockedCount++;
        } else {
            btn.disabled = false;
            btn.classList.remove('locked');
            // Force clear any lingering visual lock styles
            btn.style.setProperty('opacity', '1', 'important');
            btn.style.setProperty('filter', 'none', 'important');
            btn.style.display = 'flex';
            btn.style.pointerEvents = 'auto';
            btn.dataset.isLocked = 'false';
            // Remove " — Filtered out" from title if present
            if (btn.title && btn.title.includes(' — Filtered out')) {
                btn.title = btn.title.replace(' — Filtered out', '');
            }
            unlockedCount++;
            // Debug visual state
            console.log(`[VISUAL] Pagination #${eventIndex} UNLOCKED: opacity='${btn.style.opacity}', filter='${btn.style.filter}', classList='${btn.classList.value}'`);
        }
    });
    
    console.log(`[FILTER DEBUG]    Pagination update complete: ${lockedCount} locked, ${unlockedCount} unlocked, ${hiddenCount} hidden`);
    
    // Update slider ticks for filter hits
    updateStandaloneSliderTicks(activeFilters, events, eventsPerPage, currentPage);
    
    // === GLOBE INTEGRATION ===
    // NOTE: Do NOT call applyFilters here - it creates an infinite loop:
    // updateStandalonePaginationForFilters -> applyFilters -> _syncPaginationUiAfterFilters -> updateStandalonePaginationForFilters
    // applyFilters already calls back to this function via _syncPaginationUiAfterFilters
    // The sync should only go one way: applyFilters -> updateStandalonePaginationForFilters
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
    
    // Clear existing filter-hit classes from ticks and number labels
    const existingHits = ticksEl.querySelectorAll('.event-page-slider-tick--filter-hit, .event-page-slider-num.filter-hit');
    existingHits.forEach(el => {
        el.classList.remove('event-page-slider-tick--filter-hit', 'filter-hit');
    });
    
    const totalEvents = events.length;
    const totalPages = Math.ceil(totalEvents / eventsPerPage);
    
    // Color event number labels green based on filter matches
    const numLabels = ticksEl.querySelectorAll('.event-page-slider-num');
    numLabels.forEach(label => {
        const eventIndex = parseInt(label.dataset.eventIndex, 10);
        const event = eventIndex >= 0 && eventIndex < totalEvents ? events[eventIndex] : null;
        if (event && !shouldEventBeLocked(event, activeFilters)) {
            label.classList.add('filter-hit');
        }
    });
    
    if (!activeFilters || activeFilters.size === 0) return;
    
    // Color event position ticks green based on filter matches
    const eventTicks = ticksEl.querySelectorAll('.event-page-slider-tick--event');
    eventTicks.forEach(tick => {
        const eventIndex = parseInt(tick.dataset.eventIndex, 10);
        const event = eventIndex >= 0 && eventIndex < totalEvents ? events[eventIndex] : null;
        if (event && !shouldEventBeLocked(event, activeFilters)) {
            tick.classList.add('event-page-slider-tick--filter-hit');
        }
    });
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
 * Creates a main menu button
 * @param {Object} config - Button configuration
 * @param {string} config.id - Button ID
 * @param {string} config.title - Button title
 * @param {string} config.imagePath - Path to button image
 * @param {string} config.label - Button label text
 * @param {string} config.description - Button description text
 * @returns {HTMLElement} - The created button
 */
export function createMenuButton({ id, title, imagePath, label, description }) {
    // Wrapper contains button + external label
    const wrapper = document.createElement('div');
    wrapper.className = 'main-menu-btn-wrapper';

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
        </div>
    `;

    // External dark label below button with description only
    const externalLabel = document.createElement('div');
    externalLabel.className = 'main-menu-external-label';
    externalLabel.innerHTML = `<div class="main-menu-external-label__desc">${description}</div>`;

    // Move label inside the button so it shares the same coordinate space
    button.appendChild(externalLabel);
    wrapper.appendChild(button);

    // Keep reference to button for event handlers
    wrapper.button = button;

    return wrapper;
}

/**
 * Creates the main menu buttons container
 * @param {Function} setupGlobeHandler - Handler for Interactive Globe button
 * @param {Function} setupGlossaryHandler - Handler for Connection Codex button (optional)
 * @param {Function} setupBiographyHandler - Handler for Character Bios button (optional)
 * @returns {HTMLElement} - The menu buttons container
 */
export function createMenuButtons(setupGlobeHandler, setupGlossaryHandler = null, setupBiographyHandler = null) {
    const menuButtons = document.createElement('div');
    menuButtons.className = 'main-menu-buttons';

    // Container for the three main buttons (horizontal row)
    const mainButtonsRow = document.createElement('div');
    mainButtonsRow.className = 'main-menu-buttons-row';
    mainButtonsRow.style.cssText = `
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: flex-start;
        gap: 30px;
        width: 100%;
    `;

    // Interactive Globe/Map button
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

    if (setupGlobeHandler) {
        globeBtn.button.addEventListener('click', setupGlobeHandler);
    }

    mainButtonsRow.appendChild(globeBtn);

    // Connection Codex button (always shown now)
    const glossaryBtn = createMenuButton({
        id: 'runGlossaryBtn',
        title: 'Connection Codex',
        imagePath: 'assets/images/menu/Concept%20Glossary.png',
        label: 'Connection Codex',
        description: 'Study how everything Connects in the Conspiracy Board'
    });

    if (setupGlossaryHandler) {
        glossaryBtn.button.addEventListener('click', setupGlossaryHandler);
    }

    mainButtonsRow.appendChild(glossaryBtn);

    // Story Archive button - always show now
    const biographyBtn = createMenuButton({
        id: 'runBiographyBtn',
        title: 'Story Archive',
        imagePath: 'assets/images/menu/Character%20Bios.png',
        label: 'Story Archive',
        description: 'Explore the Story and Concepts through a series of Slides'
    });

    if (setupBiographyHandler) {
        biographyBtn.button.addEventListener('click', setupBiographyHandler);
    }

    mainButtonsRow.appendChild(biographyBtn);
    menuButtons.appendChild(mainButtonsRow);

    // Visual separator between main buttons and event system controls
    const separator = document.createElement('div');
    separator.style.cssText = `
        width: 60%;
        height: 1px;
        background: linear-gradient(90deg, transparent, #555, transparent);
        margin: 30px auto 10px auto;
    `;
    menuButtons.appendChild(separator);

    // Container for Auto-preload checkbox, Map/Globe toggle, and Event System Load Out button (horizontal row)
    const eventSystemContainer = document.createElement('div');
    eventSystemContainer.style.cssText = `
        margin-top: 10px;
        display: flex;
        flex-direction: row;
        align-items: center;
        justify-content: center;
        gap: 15px;
        width: 100%;
    `;

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

    // Event System Load Out button (small, second)
    const testBtn = document.createElement('button');
    testBtn.id = 'testBtn';
    testBtn.className = 'test-btn';
    testBtn.textContent = 'LOAD Event System Load Out';
    testBtn.style.cssText = `
        padding: 8px 16px;
        font-size: 12px;
        background: #333;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
        cursor: pointer;
    `;

    // Hide event system load out button on GitHub Pages
    if (isGitHubPages) {
        testBtn.style.display = 'none';
    }

    eventSystemContainer.appendChild(autoPreloadContainer);
    eventSystemContainer.appendChild(mapGlobeToggleContainer);
    eventSystemContainer.appendChild(testBtn);
    menuButtons.appendChild(eventSystemContainer);

    testBtn.addEventListener('click', async () => {
        const isLoaded = testBtn.dataset.loaded === 'true';

        if (!isLoaded) {
            // LOAD
            updateStatus('Loading Event System...', 'info');
            try {
                teardownMenuHelpersEventSystemLayout();
                sweepEventSystemDockOrphans();

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
                    mobileClassName: 'dock-globe-rail__btn'
                });

                // Create global image display toggle button
                // Default to ON (true) if not set or if set to false (for new users)
                const storedValue = localStorage.getItem('globalImageToggle');
                const globalImageToggleState = storedValue === null ? true : storedValue !== 'false';
                // Initialize localStorage if not set
                if (storedValue === null) {
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
                    mobileClassName: 'dock-globe-rail__btn'
                });

                // Setup global image toggle button handler (wait for button to be in DOM)
                setTimeout(() => {
                    const globalImageToggleBtn = document.getElementById('globalImageToggle');
                    if (globalImageToggleBtn) {
                        // Set initial state
                        if (globalImageToggleState) {
                            globalImageToggleBtn.classList.add('active');
                        }
                        
                        // Remove any existing listeners by cloning
                        const newBtn = globalImageToggleBtn.cloneNode(true);
                        globalImageToggleBtn.parentNode.replaceChild(newBtn, globalImageToggleBtn);
                        
                        newBtn.addEventListener('click', (e) => {
                            console.log('[DEBUG global button click] Global image toggle button clicked');
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const currentState = localStorage.getItem('globalImageToggle') === 'true';
                            const newState = !currentState;
                            localStorage.setItem('globalImageToggle', newState.toString());
                            console.log('[DEBUG global button click] State changed:', currentState, '->', newState);
                            
                            // Flash feedback (green for ON, red for OFF)
                            if (window.flashButton) {
                                window.flashButton(newBtn, newState ? 'flash-green' : 'flash-red');
                            }
                            
                            // Update button label to reflect new state
                            const labelEl = newBtn.querySelector('.globe-control-btn__label');
                            if (labelEl) {
                                labelEl.textContent = newState ? 'Image On' : 'Image Off';
                                console.log('[DEBUG global button click] Label updated to:', labelEl.textContent);
                            }
                            if (newState) {
                                newBtn.classList.add('active');
                                console.log('[DEBUG global button click] Added active class');
                            } else {
                                newBtn.classList.remove('active');
                                console.log('[DEBUG global button click] Removed active class');
                            }

                            // Ensure the event slide is open, then apply image state.
                            const eventSlide = document.getElementById('eventSlide');
                            const isSlideOpen = !!eventSlide?.classList.contains('open');
                            const ss = window.standaloneEventSlide;
                            if (!isSlideOpen && ss?.showStandaloneEventSlide) {
                                const events = window.eventManager?.events || [];
                                let idx = Number.isFinite(ss.currentEventIndex) ? ss.currentEventIndex : 0;
                                if (idx < 0) idx = 0;
                                if (idx >= events.length) idx = Math.max(0, events.length - 1);
                                const eventToOpen = ss.currentEventData || events[idx];
                                if (eventToOpen) {
                                    const arch = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                                    ss._presentationFromDockTimeline = arch === 'story';
                                    ss.showStandaloneEventSlide(eventToOpen, idx);
                                }
                            }

                            setTimeout(() => {
                                const slideNowOpen = !!document.getElementById('eventSlide')?.classList.contains('open');
                                if (!slideNowOpen || !ss) return;
                                if (newState) {
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
                            
                            // Play sound
                            if (window.SoundEffectsManager) {
                                window.SoundEffectsManager.play('imageDisplay');
                            }
                        });
                    }
                }, 100);

                // Move Filters, Global Image Toggle, and Page Input Container between dock rail and page controls row
                function moveButtonsToPageControlsRow() {
                    const isMobilePortrait = window.innerWidth <= 768 && window.innerHeight > window.innerWidth;
                    /* Portrait row order + membership: moveElements / moveDock (replaceChildren). Avoid legacy insertBefore/appendChild here — it fought moveDock and scrambled control order. */
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

                window.__menuHelpersEventSystemLayout = {
                    moveChrome: moveButtonsToPageControlsRow,
                    moveDock: null,
                };
                window.addEventListener('resize', moveButtonsToPageControlsRow);
                window.addEventListener('orientationchange', moveButtonsToPageControlsRow);

                // Initialize EventManager if not already loaded
                if (!window.eventManager) {
                    const { initializeEventManager } = await import('./EventManagerHelpers.js');
                    window.eventManager = await initializeEventManager();
                }

                // Initialize FlashButtonHelper for Event System (works in all modes)
                if (!window.flashButton) {
                    await import('../../utils/FlashButtonHelper.js');
                }

                // Initialize EventMarkerManager for Globe (if Globe is loaded)
                if (window.globeController?.sceneModel && !window.globeEventMarkerManager) {
                    updateStatus('Initializing event markers...', 'info');
                    window.globeEventMarkerManager = new EventMarkerManager(
                        window.globeController.sceneModel,
                        window.globeController.dataModel
                    );
                    // Add event markers to the globe
                    await window.globeEventMarkerManager.addEventMarkers(true);
                    updateStatus('✓ Event markers added', 'success');
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

                // Update ticker with all events
                const events = window.eventManager.events || [];
                window.newsTickerService.updateTicker(events);

                // Wire up Event Manager panel controls (no dock toggle — panel only via e.g. All Events)
                if (window.eventManager && !window.eventManager.listenersSetup) {
                    window.eventManager.setupEventListeners();
                }

                
                // Create pagination dock for standalone mode
                getOrCreateElement('eventPagination', () => {
                    updateStatus('Creating pagination dock...', 'info');
                    return createEventPagination();
                }, 'Pagination dock');

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
                    
                    /* Dock bar: Prev Page, Prev Event, Image, Textbox, Filters, Next Event, Next Page (image/filters join center rail when trapezoid dock). */
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

                    if (!window.__menuHelpersEventSystemLayout) {
                        window.__menuHelpersEventSystemLayout = {};
                    }
                    window.__menuHelpersEventSystemLayout.moveDock = moveElements;
                    window.addEventListener('resize', moveElements);
                    window.addEventListener('orientationchange', moveElements);
                }, 200);

                // Create filters panel for standalone mode (decoupled from globe)
                getOrCreateElement('filtersPanel', () => {
                    updateStatus('Creating filters panel...', 'info');
                    return createFiltersPanel();
                }, 'Filters panel');

                // Initialize FilterService for standalone mode
                if (window.FilterService && typeof window.FilterService.init === 'function') {
                    window.FilterService.init();
                    updateStatus('✓ Filter panel initialized', 'success');
                }

                // Setup standalone filter state (decoupled from globe sceneModel)
                if (!window.standaloneActiveFilters) {
                    window.standaloneActiveFilters = new Set();
                }

                // Override FilterService confirm handler for standalone mode
                // Set flag to prevent FilterService from overriding these handlers
                window._menuHelpersFilterHandlersInstalled = true;
                
                const confirmFiltersBtn = document.getElementById('confirmFiltersBtn');
                if (confirmFiltersBtn) {
                    // Remove old listeners by cloning
                    const newConfirmBtn = confirmFiltersBtn.cloneNode(true);
                    confirmFiltersBtn.parentNode.replaceChild(newConfirmBtn, confirmFiltersBtn);
                    // Add standalone handler
                    newConfirmBtn.addEventListener('click', () => {
                        // Apply filters to standalone state
                        if (window.FilterService?.stateManager?.selectedFilters) {
                            window.standaloneActiveFilters = new Set(window.FilterService.stateManager.selectedFilters);
                        }
                        // Log filter state with matches
                        const activeFilters = window.standaloneActiveFilters || new Set();
                        const filterStr = activeFilters.size > 0 ? `[${Array.from(activeFilters).join(', ')}]` : '[]';
                        const currentPage = window.standaloneEventSlide?.currentPage || 1;
                        // Calculate matching events on current page
                        const allEvents = window.eventManager?.events || [];
                        const pageStart = (currentPage - 1) * 10;
                        const pageEnd = Math.min(pageStart + 10, allEvents.length);
                        const matching = [];
                        for (let i = pageStart; i < pageEnd; i++) {
                            const evt = allEvents[i];
                            if (evt && typeof window.shouldEventBeLocked === 'function' && !window.shouldEventBeLocked(evt, activeFilters)) {
                                matching.push((i % 10) + 1);
                            }
                        }
                        const matchStr = matching.length > 0 ? `[${matching.join(', ')}]` : '[]';
                        console.log(`[FILTERS] 🔵 CONFIRM: ${filterStr} | Page ${currentPage} matches: ${matchStr}`);
                        // Play sound
                        if (window.SoundEffectsManager) {
                            window.SoundEffectsManager.play('filterConfirm');
                        }
                        // Update dock thumbnails to reflect locked state
                        updateStandalonePaginationForFilters();
                        // Apply filters to Globe markers (if EventMarkerManager exists)
                        if (window.globeEventMarkerManager) {
                            window.globeEventMarkerManager.applyFilters();
                        } else if (window.globeController?.eventMarkerManager) {
                            window.globeController.eventMarkerManager.applyFilters();
                        }
                        // Apply filter state to Codex nodes
                        if (typeof window.applyCodexFilterState === 'function') {
                            window.applyCodexFilterState();
                        }
                        // Close panel
                        const filtersPanel = document.getElementById('filtersPanel');
                        if (filtersPanel) filtersPanel.classList.remove('open');
                        const filtersToggle = document.getElementById('filtersToggle');
                        if (filtersToggle) filtersToggle.classList.remove('active');
                        if (typeof window.syncFiltersPanelTrapIcon === 'function') {
                            window.syncFiltersPanelTrapIcon();
                        }
                        updateStatus('✓ Filters applied', 'success');
                    });
                }

                // Override Clear button for standalone mode
                const clearFiltersBtn = document.getElementById('clearFiltersBtn');
                if (clearFiltersBtn) {
                    const newClearBtn = clearFiltersBtn.cloneNode(true);
                    clearFiltersBtn.parentNode.replaceChild(newClearBtn, clearFiltersBtn);
                    newClearBtn.addEventListener('click', () => {
                        // Clear standalone filters
                        window.standaloneActiveFilters.clear();
                        if (window.FilterService?.stateManager) {
                            window.FilterService.stateManager.clear();
                        }
                        // Log clear (all events match when no filters)
                        const currentPage = window.standaloneEventSlide?.currentPage || 1;
                        console.log(`[FILTERS] 🟡 CLEAR: [] | Page ${currentPage} matches: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]`);
                        if (window.SoundEffectsManager) {
                            window.SoundEffectsManager.play('filterClear');
                        }
                        // Update buttons and thumbnails
                        if (window.FilterService?.updateButtonStates) {
                            window.FilterService.updateButtonStates();
                        }
                        updateStandalonePaginationForFilters();
                        // Clear filters from Globe markers (if EventMarkerManager exists)
                        if (window.globeEventMarkerManager) {
                            window.globeEventMarkerManager.applyFilters();
                        }
                        // Apply filter state to Codex nodes (clears filtered-out state)
                        if (typeof window.applyCodexFilterState === 'function') {
                            window.applyCodexFilterState();
                        }
                        updateStatus('✓ Filters cleared', 'success');
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
                        /** True when the slide row comes from the main-timeline dock (thumbs / story), not satellite Event Manager rows. Do not infer via `allEvents === getDockTimelineEvents()` — references can differ while content is still dock. */
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
                         * @param {{ eventList?: Array<Object>, keepSlideHistory?: boolean }} [options] - `eventList` for Event Manager rows; omit for dock. `keepSlideHistory` when following relevancy / prev-next while Back stack is active.
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
                        
                        // Show event slide with event data
                        showStandaloneEventSlide(eventData, globalIndex) {
                            if (!eventData) return;
                            
                            const isMultiEvent = Array.isArray(eventData.variants) && eventData.variants.length > 0;
                            const variantIndex = eventData.variantIndex || 0;
                            const displayEvent = isMultiEvent && eventData.variants[variantIndex] 
                                ? { ...eventData, ...eventData.variants[variantIndex] }
                                : eventData;
                            
                            // Get event data for display
                            let eventName = displayEvent.name || eventData.name || 'Unnamed Event';
                            const description = displayEvent.description || '';

                            // Get image path — dock rows are always main-timeline story art
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
                            
                            // Call the full displaySlide method with all features
                            this.displaySlide(eventName, imagePath, description, eventData, isMultiEvent, displayEvent);
                            
                            // Update nav buttons
                            this.updateNavButtons();
                        },
                        
                        // Display the slide panel
                        displaySlide(eventName, imagePath, description, eventData, isMultiEvent, displayEvent) {
                            const eventSlide = document.getElementById('eventSlide');
                            if (!eventSlide) return;
                            /* Fresh open from a closed panel: drop stale back-stack (X, hideEventSlide, filters, etc.). */
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
                            const eventSlideLocation = document.getElementById('eventSlideLocation');
                            const eventSlideTimelineMeta = document.getElementById('eventSlideTimelineMeta');
                            const dockStoryPresentationActive = !!this._presentationFromDockTimeline;
                            const archiveSourceSlide = dockStoryPresentationActive
                                ? 'story'
                                : (window.eventManager?.dataService?.getArchiveSource?.() || 'story');
                            const isSatelliteArchive = !dockStoryPresentationActive && archiveSourceSlide !== 'story';
                            
                            // Store the image path for later use when toggling
                            this.currentImagePath = imagePath;
                            
                            // Cancel any active editing
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
                            
                            // Update content (with glitch applied)
                            if (eventSlideTitle) {
                                eventSlideTitle.innerHTML = applyGlitch(eventName);
                            }
                            if (eventSlideText) {
                                eventSlideText.innerHTML = applyGlitch(description) || 'No description available.';
                            }
                            
                            // Display location and years under title (Story timeline only)
                            const target = displayEvent || eventData;
                            if (!isSatelliteArchive) {
                                if (eventSlideLocation && target.cityDisplayName) {
                                    // Get location flag
                                    const lh = window.LocationFlagHelpers;
                                    const flagFile = lh?.getResolvedFlagFilename?.(target.cityDisplayName, target.locationType || 'earth');
                                    
                                    if (flagFile) {
                                        eventSlideLocation.innerHTML = `<img class="event-slide-location-flag" src="assets/images/flags/${flagFile}" alt="" width="24" height="16" decoding="async"> ${target.cityDisplayName}`;
                                    } else {
                                        eventSlideLocation.textContent = target.cityDisplayName;
                                    }
                                    eventSlideLocation.style.display = 'block';
                                } else if (eventSlideLocation) {
                                    eventSlideLocation.style.display = 'none';
                                }
                                
                                if (eventSlideTimelineMeta) {
                                    const yearStart = target.yearStart || target.year;
                                    const yearEnd = target.yearEnd;
                                    let yearText = '';
                                    if (yearStart) {
                                        yearText = String(yearStart);
                                        if (yearEnd) {
                                            yearText += ` – ${yearEnd}`;
                                        }
                                    }
                                    if (yearText) {
                                        eventSlideTimelineMeta.textContent = yearText;
                                        eventSlideTimelineMeta.style.display = 'block';
                                    } else {
                                        eventSlideTimelineMeta.style.display = 'none';
                                    }
                                }
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
                                        target
                                    );
                                    window.LocationFlagHelpers?.updateBioConnectionsSlideFromEvent?.(target);
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
                                        // Toggle glitch
                                        const newEnabled = window.GlitchTextService?.toggle?.() || false;
                                        // Update button state
                                        glitchToggleBtn.classList.toggle('event-glitch-toggle-btn--on', newEnabled);
                                        glitchToggleBtn.setAttribute('aria-pressed', String(newEnabled));
                                        glitchToggleBtn.title = newEnabled ? 'Glitch effect on' : 'Glitch effect off';
                                        // Re-apply to current view
                                        const currentEvent = isMultiEvent ? eventData.variants[this.currentVariantIndex || 0] : eventData;
                                        if (eventSlideTitle) {
                                            eventSlideTitle.innerHTML = applyGlitch(currentEvent?.name || eventName);
                                        }
                                        if (eventSlideText) {
                                            eventSlideText.innerHTML = applyGlitch(currentEvent?.description || description) || 'No description available.';
                                        }
                                        // Wire click handlers on new glitch elements
                                        setTimeout(wireGlitchClickToggle, 100);
                                        // Play sound
                                        if (window.SoundEffectsManager?.play) {
                                            window.SoundEffectsManager.play(newEnabled ? 'hackOn' : 'hackOff');
                                        }
                                    };
                                    // Start animation if enabled
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
                            // Run after glitch applied
                            setTimeout(wireGlitchClickToggle, 100);
                            
                            // Setup variant toggles
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
                                            
                                            // Update location and years for variant
                                            if (eventSlideLocation && v.cityDisplayName) {
                                                // Get location flag for variant
                                                const lh = window.LocationFlagHelpers;
                                                const flagFile = lh?.getResolvedFlagFilename?.(v.cityDisplayName, v.locationType || 'earth');
                                                
                                                if (flagFile) {
                                                    eventSlideLocation.innerHTML = `<img class="event-slide-location-flag" src="assets/images/flags/${flagFile}" alt="" width="24" height="16" decoding="async"> ${v.cityDisplayName}`;
                                                } else {
                                                    eventSlideLocation.textContent = v.cityDisplayName;
                                                }
                                                eventSlideLocation.style.display = 'block';
                                            } else if (eventSlideLocation) {
                                                eventSlideLocation.style.display = 'none';
                                            }
                                            
                                            if (eventSlideTimelineMeta) {
                                                const vYearStart = v.yearStart || v.year;
                                                const vYearEnd = v.yearEnd;
                                                let vYearText = '';
                                                if (vYearStart) {
                                                    vYearText = String(vYearStart);
                                                    if (vYearEnd) {
                                                        vYearText += ` – ${vYearEnd}`;
                                                    }
                                                }
                                                if (vYearText) {
                                                    eventSlideTimelineMeta.textContent = vYearText;
                                                    eventSlideTimelineMeta.style.display = 'block';
                                                } else {
                                                    eventSlideTimelineMeta.style.display = 'none';
                                                }
                                            }
                                            
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
                                            // Re-wire glitch clicks after variant switch
                                            setTimeout(wireGlitchClickToggle, 100);
                                        });
                                        variantToggles.appendChild(btn);
                                    });
                                } else {
                                    variantToggles.style.display = 'none';
                                }
                            }
                            
                            // Update sources and filters
                            this.updateSourcesAndFilters(displayEvent);
                            
                            // Wire up prev/next buttons
                            this.wireNavButtons(eventData);
                            
                            // Wire edit/save buttons
                            this.wireEditButtons(eventData, displayEvent, editBtn, saveBtn, eventSlideTitle, eventSlideText);
                            
                            // Show the panel
                            // Mutual exclusion: opening Event Info closes Filters.
                            const filtersPanel = document.getElementById('filtersPanel');
                            const filtersToggle = document.getElementById('filtersToggle');
                            if (filtersPanel?.classList.contains('open')) {
                                filtersPanel.classList.remove('open');
                                filtersToggle?.classList.remove('active');
                            }
                            eventSlide.classList.add('open');
                            
                            // Wire close button
                            if (eventSlideClose) {
                                eventSlideClose.onclick = () => {
                                    console.log('[eventSlideClose] Close button clicked (MenuHelpers)');
                                    this.cancelEdit();
                                    this.clearSlideHistory();
                                    eventSlide.classList.remove('open');
                                    this.hideImageOverlay();
                                    
                                    // Reset camera when closing event slide
                                    console.log('[eventSlideClose] Resetting camera on close');
                                    if (window.globeController?.interactionController) {
                                        window.globeController.interactionController.stopFollowingStation();
                                        window.globeController.interactionController.restorePlanesVisibility?.();
                                    }
                                    if (window.globeController?.cameraControlService) {
                                        window.globeController.cameraControlService.resetCameraToDefault();
                                    }
                                    
                                    if (window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('eventClick');
                                    }
                                };
                            }
                            
                            // Wire image toggle
                            if (eventImageToggle) {
                                eventImageToggle.onclick = () => {
                                    // Use the standalone event slide's toggle method which syncs with global state
                                    // Pass the stored image path
                                    this.toggleImageOverlay(this.currentImagePath);
                                };
                            }
                            
                            // Show image based on global toggle state
                            // Default to ON (true) if not set
                            const storedValue = localStorage.getItem('globalImageToggle');
                            const globalImageToggleEnabled = storedValue === null ? true : storedValue !== 'false';
                            setTimeout(() => {
                                if (globalImageToggleEnabled && imagePath) {
                                    this.showImageOverlay(imagePath);
                                } else {
                                    this.hideImageOverlay();
                                }
                            }, 100);
                            
                            // On mobile, if no image, start in full-screen mode
                            const isMobile = window.innerWidth <= 768;
                            if (isMobile && !imagePath && eventSlide) {
                                eventSlide.classList.add('full-screen');
                            }

                            this.updateBackButtonVisibility?.();
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
                                // Do not clear relevant locations here: displaySlide already filled them for bio satellites;
                                // clearing would wipe Ana (relevantLocations) right after render.
                                return;
                            }
                            // Update sources section
                            const sourcesSection = document.getElementById('eventSourcesSection');
                            const sourcesList = document.getElementById('eventSourcesList');
                            if (sourcesSection && sourcesList && event) {
                                if (event.sources && event.sources.length > 0) {
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
                                            link.addEventListener('click', () => {
                                                if (window.SoundEffectsManager?.play) {
                                                    window.SoundEffectsManager.play('filterConfirm');
                                                }
                                            });
                                            item.appendChild(link);
                                        } else {
                                            item.textContent = source.text;
                                            item.className = 'event-source-text';
                                        }
                                        sourcesList.appendChild(item);
                                    });
                                    sourcesSection.style.display = 'block';
                                } else {
                                    sourcesSection.style.display = 'none';
                                }
                            }
                            
                            // Update filters section with icon chips (matching globe mode)
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
                                          if (event?.secondaryCountryFlags?.length) {
                                              out.push(...event.secondaryCountryFlags);
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
                        
                        wireEditButtons(eventData, displayEvent, editBtn, saveBtn, titleEl, textEl) {
                            if (!editBtn || !saveBtn) return;

                            if (!isEventSlideEditDevHost()) {
                                editBtn.style.display = 'none';
                                saveBtn.style.display = 'none';
                                editBtn.disabled = true;
                                saveBtn.disabled = true;
                                return;
                            }
                            
                            // Reset state
                            this.isEditing = false;
                            editBtn.textContent = 'Edit';
                            editBtn.style.display = 'block';
                            saveBtn.style.display = 'none';
                            
                            // Remove old listeners by cloning
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
                            const isSatelliteArchive = !dockStoryPresentationActive && archiveSourceEdit !== 'story';
                            
                            // Initialize variant index
                            const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
                            this.currentVariantIndex = isMulti ? 0 : -1;
                            
                            const eventSlide = document.getElementById('eventSlide');
                            const eventSlideScrollable = document.getElementById('eventSlideScrollable');
                            const titleEl = document.getElementById('eventSlideTitle');
                            const textEl = document.getElementById('eventSlideText');
                            
                            // Add editing class
                            eventSlide?.classList.add('event-slide--inline-editing');
                            const orderRow = document.getElementById('eventSlideOrderRow');
                            if (!isSatelliteArchive && orderRow) {
                                orderRow.removeAttribute('hidden');
                                orderRow.setAttribute('aria-hidden', 'false');
                            }

                            // Make title and description editable
                            if (titleEl) {
                                titleEl.contentEditable = 'true';
                                titleEl.setAttribute('spellcheck', 'true');
                            }
                            if (textEl) {
                                textEl.contentEditable = 'true';
                                textEl.setAttribute('spellcheck', 'true');
                            }
                            
                            // Create or show inline editor
                            let editor = document.getElementById('eventSlideInlineEditor');
                            if (!editor) {
                                editor = this.createInlineEditor();
                                eventSlideScrollable?.insertBefore(editor, eventSlideScrollable.firstChild);
                            }
                            editor.style.display = isSatelliteArchive ? 'none' : 'block';
                            
                            // Move description element into the description container
                            const descContainer = document.getElementById('eventSlideEditDescriptionContainer');
                            if (!isSatelliteArchive && descContainer && textEl) {
                                // Store original parent for restoration
                                this.descriptionOriginalParent = textEl.parentNode;
                                this.descriptionOriginalNextSibling = textEl.nextSibling;
                                descContainer.appendChild(textEl);
                            }
                            
                            // Populate editor fields
                            if (!isSatelliteArchive) {
                                this.populateInlineEditor(eventData, displayEvent);
                            }
                            
                            // Enable predictive/autocomplete behavior (same service used in EventManager edit modal)
                            const filtersInput = document.getElementById('eventSlideEditFilters');
                            const factionsInput = document.getElementById('eventSlideEditFactions');
                            const npcsInput = document.getElementById('eventSlideEditNpcs');
                            
                            const relElHero = document.getElementById('eventSlideRelevantLocations');
                            const relSectionHero = document.getElementById('eventRelevantLocationsSection');
                            const heroLocEdit = document.getElementById('eventSlideHeroLocationsEdit');
                            const locContainer = document.getElementById('eventSlideEditRelevantLocations');
                            const isBioEdit =
                                archiveSourceEdit === 'heroes'
                                || archiveSourceEdit === 'factions'
                                || archiveSourceEdit === 'npcs';
                            if (isSatelliteArchive && isBioEdit) {
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
                                        window.BioArchiveConnectionsEditor.render(connContainer, conns);
                                        const addConn = document.getElementById('eventSlideAddBioConnectionBtn');
                                        if (addConn) {
                                            addConn.onclick = () =>
                                                window.BioArchiveConnectionsEditor?.addRow?.();
                                        }
                                    }
                                }
                            } else if (heroLocEdit) {
                                heroLocEdit.setAttribute('hidden', '');
                                heroLocEdit.style.display = 'none';
                            }

                            const addSecPlacesBtn = document.getElementById('eventSlideAddSecondaryCountryPlaceBtn');
                            if (!isSatelliteArchive && addSecPlacesBtn && window.HeroRelevantLocationsEditor?.addRow) {
                                addSecPlacesBtn.onclick = () =>
                                    window.HeroRelevantLocationsEditor.addRow({
                                        containerId: 'eventSlideEditSecondaryCountryPlaces',
                                        placeholders: STORY_SECONDARY_PLACES_EDITOR_OPTS.placeholders,
                                        autocompleteType: STORY_SECONDARY_PLACES_EDITOR_OPTS.autocompleteType
                                    });
                                const addHeroFp = document.getElementById('eventSlideAddHeroFilterPlaceBtn');
                                if (addHeroFp) {
                                    addHeroFp.onclick = () =>
                                        window.HeroRelevantLocationsEditor.addRow({
                                            containerId: 'eventSlideEditHeroFilterPlaces',
                                            placeholders: STORY_HERO_FILTER_PLACES_OPTS.placeholders,
                                            autocompleteType: STORY_HERO_FILTER_PLACES_OPTS.autocompleteType
                                        });
                                }
                                const addFactionFp = document.getElementById('eventSlideAddFactionFilterPlaceBtn');
                                if (addFactionFp) {
                                    addFactionFp.onclick = () =>
                                        window.HeroRelevantLocationsEditor.addRow({
                                            containerId: 'eventSlideEditFactionFilterPlaces',
                                            placeholders: STORY_FACTION_FILTER_PLACES_OPTS.placeholders,
                                            autocompleteType: STORY_FACTION_FILTER_PLACES_OPTS.autocompleteType
                                        });
                                }
                                const addNpcFp = document.getElementById('eventSlideAddNpcFilterPlaceBtn');
                                if (addNpcFp) {
                                    addNpcFp.onclick = () =>
                                        window.HeroRelevantLocationsEditor.addRow({
                                            containerId: 'eventSlideEditNpcFilterPlaces',
                                            placeholders: STORY_NPC_FILTER_PLACES_OPTS.placeholders,
                                            autocompleteType: STORY_NPC_FILTER_PLACES_OPTS.autocompleteType
                                        });
                                }
                            }

                            if (!isSatelliteArchive) {
                            // Reset setup flag each time we enter edit mode so options stay in sync
                            if (filtersInput) filtersInput.dataset.autocompleteSetup = 'false';
                            if (factionsInput) factionsInput.dataset.autocompleteSetup = 'false';
                            if (npcsInput) npcsInput.dataset.autocompleteSetup = 'false';
                            
                            const auto = window.eventManager?.formService?.autocompleteService || window.EventFormService?.autocompleteService;
                            if (auto && typeof auto.setupAutocomplete === 'function') {
                                const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
                                const npcList = window.eventManager?.npcs || [];
                                const factionList = window.eventManager?.factions?.length
                                    ? window.eventManager.factions
                                    : (window.globeController?.dataModel?.factions || []);
                                
                                if (filtersInput) auto.setupAutocomplete(filtersInput, heroes, 'heroes');
                                if (factionsInput) auto.setupAutocomplete(factionsInput, factionList, 'factions');
                                if (npcsInput && npcList.length > 0) auto.setupAutocomplete(npcsInput, npcList, 'npcs');
                            }
                            }
                            
                            // Update buttons
                            editBtn.textContent = 'Cancel';
                            saveBtn.style.display = 'inline-flex';
                            
                            // Play sound
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('uiClick');
                            }
                        },
                        
                        createInlineEditor() {
                            const editor = document.createElement('div');
                            editor.id = 'eventSlideInlineEditor';
                            editor.className = 'event-slide-inline-editor';
                            editor.innerHTML = `
                                <div class="event-slide-inline-editor__placement" id="eventSlidePlacementBlock">
                                    <div class="event-slide-inline-editor__row" id="eventSlideCityLookupRow">
                                        <label class="event-slide-inline-editor__label" for="eventSlideEditCityLookup">City name (for coordinate lookup)</label>
                                        <div class="event-slide-inline-editor__lookup-row">
                                            <input class="event-slide-inline-editor__input event-slide-inline-editor__input--grow" id="eventSlideEditCityLookup" type="text" spellcheck="true" autocomplete="on" />
                                            <label class="event-slide-inline-editor__inline-check"><input type="checkbox" id="eventSlideUseCodeLookup" checked /> Code lookup</label>
                                            <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideLookupCityBtn">Lookup</button>
                                        </div>
                                    </div>
                                    <div class="event-slide-inline-editor__row">
                                        <div class="event-slide-inline-editor__label">Location type</div>
                                        <div class="event-slide-inline-editor__loc-types" role="group" aria-label="Location type">
                                            <button type="button" class="event-slide-loc-type-btn active" data-location-type="earth">Earth</button>
                                            <button type="button" class="event-slide-loc-type-btn" data-location-type="moon">Moon</button>
                                            <button type="button" class="event-slide-loc-type-btn" data-location-type="mars">Mars</button>
                                            <button type="button" class="event-slide-loc-type-btn" data-location-type="station">Station</button>
                                            <button type="button" class="event-slide-loc-type-btn" data-location-type="marsShip">Ship</button>
                                        </div>
                                        <input type="hidden" id="eventSlideEditLocationType" value="earth" />
                                    </div>
                                    <div class="event-slide-inline-editor__year-row" id="eventSlideLatLonRow" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; margin-bottom: 10px;">
                                        <div class="event-slide-inline-editor__year-cell">
                                            <label class="event-slide-inline-editor__label" for="eventSlideEditLat">Latitude</label>
                                            <input class="event-slide-inline-editor__input" id="eventSlideEditLat" type="number" step="any" autocomplete="off" />
                                        </div>
                                        <div class="event-slide-inline-editor__year-cell">
                                            <label class="event-slide-inline-editor__label" for="eventSlideEditLon">Longitude</label>
                                            <input class="event-slide-inline-editor__input" id="eventSlideEditLon" type="number" step="any" autocomplete="off" />
                                        </div>
                                    </div>
                                    <div class="event-slide-inline-editor__year-row" id="eventSlideXyRow" style="display: none; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; margin-bottom: 10px;">
                                        <div class="event-slide-inline-editor__year-cell">
                                            <label class="event-slide-inline-editor__label" for="eventSlideEditX">X (0–100)</label>
                                            <input class="event-slide-inline-editor__input" id="eventSlideEditX" type="number" step="any" min="0" max="100" autocomplete="off" />
                                        </div>
                                        <div class="event-slide-inline-editor__year-cell">
                                            <label class="event-slide-inline-editor__label" for="eventSlideEditY">Y (0–100)</label>
                                            <input class="event-slide-inline-editor__input" id="eventSlideEditY" type="number" step="any" min="0" max="100" autocomplete="off" />
                                        </div>
                                    </div>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <label class="event-slide-inline-editor__label" for="eventSlideEditCityDisplayName">Location label</label>
                                    <input class="event-slide-inline-editor__input" id="eventSlideEditCityDisplayName" type="text" spellcheck="true" autocomplete="on" />
                                </div>
                                <div class="event-slide-inline-editor__row event-slide-inline-editor__year-row">
                                    <div class="event-slide-inline-editor__year-cell">
                                        <label class="event-slide-inline-editor__label" for="eventSlideEditYearStart">First year</label>
                                        <input class="event-slide-inline-editor__input" id="eventSlideEditYearStart" type="number" step="1" />
                                    </div>
                                    <div class="event-slide-inline-editor__year-cell">
                                        <label class="event-slide-inline-editor__label" for="eventSlideEditYearEnd">Second year (optional)</label>
                                        <input class="event-slide-inline-editor__input" id="eventSlideEditYearEnd" type="number" step="1" />
                                    </div>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <label class="event-slide-inline-editor__label" for="eventSlideEditEraName">Era name (optional)</label>
                                    <input class="event-slide-inline-editor__input" id="eventSlideEditEraName" type="text" spellcheck="true" autocomplete="on" />
                                </div>
                                <div class="event-slide-inline-editor__row" id="eventSlideEditDescriptionContainer">
                                    <label class="event-slide-inline-editor__label">Description</label>
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
                                    <label class="event-slide-inline-editor__label" for="eventSlideEditHeadlines">Headlines (one per line)</label>
                                    <textarea class="event-slide-inline-editor__textarea" id="eventSlideEditHeadlines" rows="4" spellcheck="true"></textarea>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Sources</div>
                                    <div class="event-slide-inline-editor__sources" id="eventSlideEditSources"></div>
                                    <div class="event-slide-inline-editor__actions">
                                        <button type="button" class="event-slide-inline-editor__small-btn" id="eventSlideAddSourceBtn">+ Source</button>
                                    </div>
                                </div>
                                <div class="event-slide-inline-editor__row">
                                    <div class="event-slide-inline-editor__label">Variants</div>
                                    <div class="event-slide-inline-variant-bar" id="eventSlideInlineVariantBar"></div>
                                    <p class="event-slide-inline-editor__hint">Switch tabs to edit another variant. + / − add or remove (saved when you click Save).</p>
                                </div>
                                <div class="event-slide-inline-editor__row event-slide-inline-editor__row--delete">
                                    <button type="button" class="event-slide-inline-editor__delete-btn" id="eventSlideInlineDeleteBtn">Delete event</button>
                                </div>
                            `;
                            
                            // Wire add source button
                            setTimeout(() => {
                                const addBtn = document.getElementById('eventSlideAddSourceBtn');
                                addBtn?.addEventListener('click', () => this.addSourceRow());
                                
                                const deleteBtn = document.getElementById('eventSlideInlineDeleteBtn');
                                deleteBtn?.addEventListener('click', () => this.deleteCurrentEvent());
                                
                                // Wire variant bar
                                const variantBar = document.getElementById('eventSlideInlineVariantBar');
                                if (variantBar) {
                                    variantBar.addEventListener('click', (e) => {
                                        const btn = e.target.closest('button');
                                        if (!btn || !this.isEditing) return;
                                        if (btn.dataset.role === 'variant-tab') {
                                            const idx = parseInt(btn.dataset.variantIndex, 10);
                                            if (!Number.isNaN(idx)) this.onVariantTabSelect(idx);
                                        } else if (btn.dataset.role === 'add-variant') {
                                            this.onVariantAdd();
                                        } else if (btn.dataset.role === 'remove-variant') {
                                            this.onVariantRemove();
                                        } else if (btn.dataset.role === 'make-primary') {
                                            this.onVariantMakePrimary();
                                        }
                                    });
                                }
                                
                                // Wire location type buttons
                                const locBtns = document.querySelectorAll('.event-slide-loc-type-btn');
                                locBtns.forEach(btn => {
                                    btn.addEventListener('click', (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const hid = document.getElementById('eventSlideEditLocationType');
                                        if (hid) hid.value = btn.dataset.locationType || 'earth';
                                        this.syncLocationTypeUI();
                                    });
                                });
                                
                                // Wire city lookup button
                                const lookupBtn = document.getElementById('eventSlideLookupCityBtn');
                                lookupBtn?.addEventListener('click', (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (window.eventManager?.lookupCitySlide) {
                                        window.eventManager.lookupCitySlide();
                                    }
                                });
                            }, 0);
                            
                            return editor;
                        },
                        
                        populateInlineEditor(eventData, displayEvent) {
                            const target = displayEvent || eventData;
                            const archPop = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                            const isBioPop =
                                archPop === 'heroes' || archPop === 'factions' || archPop === 'npcs';

                            // Set field values
                            const cityInput = document.getElementById('eventSlideEditCityDisplayName');
                            const cityLookupInput = document.getElementById('eventSlideEditCityLookup');
                            const yearStartInput = document.getElementById('eventSlideEditYearStart');
                            const yearEndInput = document.getElementById('eventSlideEditYearEnd');
                            const eraInput = document.getElementById('eventSlideEditEraName');
                            const filtersInput = document.getElementById('eventSlideEditFilters');
                            const factionsInput = document.getElementById('eventSlideEditFactions');
                            const npcsInput = document.getElementById('eventSlideEditNpcs');
                            const headlinesInput = document.getElementById('eventSlideEditHeadlines');
                            const locationTypeInput = document.getElementById('eventSlideEditLocationType');
                            const latInput = document.getElementById('eventSlideEditLat');
                            const lonInput = document.getElementById('eventSlideEditLon');
                            const xInput = document.getElementById('eventSlideEditX');
                            const yInput = document.getElementById('eventSlideEditY');
                            
                            if (cityInput) cityInput.value = target.cityDisplayName || '';
                            if (cityLookupInput) cityLookupInput.value = (target.cityDisplayName || eventData.cityDisplayName || '').trim();
                            if (yearStartInput) yearStartInput.value = target.yearStart || target.year || '';
                            if (yearEndInput) yearEndInput.value = target.yearEnd || '';
                            if (eraInput) eraInput.value = target.eraName || '';
                            if (filtersInput) filtersInput.value = (target.filters || []).join(', ');
                            if (factionsInput) factionsInput.value = (target.factions || []).join(', ');
                            if (npcsInput) npcsInput.value = (target.npcs || []).join(', ');
                            
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

                            if (headlinesInput) headlinesInput.value = (target.headlines || []).join('\n');

                            const emList = window.eventManager;
                            const numEl = document.getElementById('eventSlideEditEventNumber');
                            const listIdx = emList?.events ? emList.events.indexOf(eventData) : -1;
                            if (numEl && emList?.events?.length && listIdx >= 0) {
                                numEl.min = '1';
                                numEl.max = String(emList.events.length);
                                numEl.value = String(listIdx + 1);
                            }

                            // Set location type and coordinates
                            const locType = target.locationType || eventData.locationType || 'earth';
                            if (locationTypeInput) locationTypeInput.value = locType;
                            
                            if (latInput) latInput.value = '';
                            if (lonInput) lonInput.value = '';
                            if (xInput) xInput.value = '';
                            if (yInput) yInput.value = '';
                            
                            if (locType === 'earth') {
                                if (latInput && target.lat != null) latInput.value = String(target.lat);
                                if (lonInput && target.lon != null) lonInput.value = String(target.lon);
                            } else {
                                if (xInput && target.x != null) xInput.value = String(target.x);
                                if (yInput && target.y != null) yInput.value = String(target.y);
                                if ((locType === 'station' || locType === 'marsShip') && xInput && yInput) {
                                    if (!String(xInput.value).trim()) xInput.value = '50';
                                    if (!String(yInput.value).trim()) yInput.value = '50';
                                }
                            }
                            
                            // Sync location type UI
                            this.syncLocationTypeUI();
                            
                            // Render sources
                            this.renderSourcesEditor(target.sources || []);
                            
                            // Render variant bar
                            this.renderVariantBar(eventData);
                        },
                        
                        syncLocationTypeUI() {
                            const hid = document.getElementById('eventSlideEditLocationType');
                            const type = hid ? hid.value : 'earth';
                            const latLonRow = document.getElementById('eventSlideLatLonRow');
                            const xyRow = document.getElementById('eventSlideXyRow');
                            const locBtns = document.querySelectorAll('.event-slide-loc-type-btn');
                            
                            if (latLonRow) latLonRow.style.display = type === 'earth' ? 'grid' : 'none';
                            if (xyRow) xyRow.style.display = type === 'earth' ? 'none' : 'grid';
                            
                            locBtns.forEach(btn => {
                                if (btn.dataset.locationType === type) {
                                    btn.classList.add('active');
                                } else {
                                    btn.classList.remove('active');
                                }
                            });
                        },
                        
                        renderSourcesEditor(sources) {
                            const container = document.getElementById('eventSlideEditSources');
                            if (!container) return;
                            
                            container.innerHTML = '';
                            const srcs = Array.isArray(sources) && sources.length > 0 ? sources : [{ text: '', url: '' }];
                            
                            srcs.forEach((s, idx) => {
                                const row = document.createElement('div');
                                row.className = 'event-slide-inline-editor__source-row';
                                row.innerHTML = `
                                    <input class="event-slide-inline-editor__input" data-role="source-text" type="text" placeholder="Source text" value="${s.text || ''}" />
                                    <input class="event-slide-inline-editor__input" data-role="source-url" type="text" placeholder="URL (optional)" value="${s.url || ''}" />
                                    <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-remove">−</button>
                                `;
                                row.querySelector('[data-role="source-remove"]').addEventListener('click', () => {
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
                                <input class="event-slide-inline-editor__input" data-role="source-text" type="text" placeholder="Source text" />
                                <input class="event-slide-inline-editor__input" data-role="source-url" type="text" placeholder="URL (optional)" />
                                <button type="button" class="event-slide-inline-editor__small-btn" data-role="source-remove">−</button>
                            `;
                            row.querySelector('[data-role="source-remove"]').addEventListener('click', () => {
                                if (container.children.length > 1) row.remove();
                            });
                            container.appendChild(row);
                        },
                        
                        renderVariantBar(eventData) {
                            const bar = document.getElementById('eventSlideInlineVariantBar');
                            if (!bar || !this.isEditing) return;
                            
                            const variants = eventData.variants && eventData.variants.length > 0
                                ? eventData.variants
                                : null;
                            const n = variants ? variants.length : 1;
                            let cur = this.currentVariantIndex ?? 0;
                            if (cur >= n) cur = n - 1;
                            if (cur < 0) cur = 0;
                            
                            bar.innerHTML = '';
                            for (let i = 0; i < n; i++) {
                                const b = document.createElement('button');
                                b.type = 'button';
                                b.className = 'event-slide-inline-variant-tab';
                                if (i === cur) b.classList.add('active');
                                b.textContent = String(i + 1);
                                b.dataset.variantIndex = String(i);
                                b.dataset.role = 'variant-tab';
                                b.title = i === 0 ? 'Primary variant' : `Variant ${i + 1}`;
                                bar.appendChild(b);
                            }
                            const addB = document.createElement('button');
                            addB.type = 'button';
                            addB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action';
                            addB.textContent = '+';
                            addB.title = 'Add variant';
                            addB.dataset.role = 'add-variant';
                            bar.appendChild(addB);
                            if (variants && variants.length > 1) {
                                const remB = document.createElement('button');
                                remB.type = 'button';
                                remB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action event-slide-inline-variant-action--remove';
                                remB.textContent = '−';
                                remB.title = 'Remove current variant';
                                remB.dataset.role = 'remove-variant';
                                bar.appendChild(remB);
                                
                                // Add "Make Primary" button if not on primary
                                if (cur > 0) {
                                    const makePrimaryB = document.createElement('button');
                                    makePrimaryB.type = 'button';
                                    makePrimaryB.className = 'event-slide-inline-editor__small-btn event-slide-inline-variant-action';
                                    makePrimaryB.textContent = '★';
                                    makePrimaryB.title = 'Make this variant primary';
                                    makePrimaryB.dataset.role = 'make-primary';
                                    bar.appendChild(makePrimaryB);
                                }
                            }
                        },
                        
                        onVariantTabSelect(index) {
                            const cur = this.currentVariantIndex ?? 0;
                            if (index === cur) return;
                            
                            // Save current variant data before switching
                            this.saveCurrentVariantData();
                            
                            this.currentVariantIndex = index;
                            const { eventData } = this.editTarget;
                            const target = eventData.variants[index];
                            this.populateInlineEditor(eventData, target);
                            this.renderVariantBar(eventData);
                        },
                        
                        onVariantAdd() {
                            this.saveCurrentVariantData();
                            
                            const { eventData } = this.editTarget;
                            if (!eventData) return;
                            
                            if (!eventData.variants || eventData.variants.length === 0) {
                                this.convertRootEventToMulti(eventData);
                                const newIdx = eventData.variants.length - 1;
                                this.currentVariantIndex = newIdx;
                            } else {
                                const last = eventData.variants[eventData.variants.length - 1];
                                const lt = last?.locationType || eventData.locationType || 'earth';
                                const nv = {
                                    name: '',
                                    description: '',
                                    filters: [],
                                    factions: [],
                                    npcs: [],
                                    sources: undefined,
                                    headlines: undefined,
                                    locationType: lt,
                                    secondaryCountryPlaces: [],
                                    heroFilterPlaces: [],
                                    factionFilterPlaces: [],
                                    npcFilterPlaces: []
                                };
                                if (lt === 'earth') {
                                    nv.lat = last?.lat;
                                    nv.lon = last?.lon;
                                } else {
                                    nv.x = last?.x;
                                    nv.y = last?.y;
                                }
                                if (last?.cityDisplayName) nv.cityDisplayName = last.cityDisplayName;
                                eventData.variants.push(nv);
                                const newIdx = eventData.variants.length - 1;
                                this.currentVariantIndex = newIdx;
                            }
                            
                            const target = eventData.variants[this.currentVariantIndex];
                            this.populateInlineEditor(eventData, target);
                            this.renderVariantBar(eventData);
                        },
                        
                        onVariantRemove() {
                            const { eventData } = this.editTarget;
                            if (!eventData?.variants || eventData.variants.length <= 1) return;
                            if (!confirm('Remove this variant? This cannot be undone except by canceling edit without saving.')) {
                                return;
                            }
                            
                            this.saveCurrentVariantData();
                            
                            const cur = this.currentVariantIndex ?? 0;
                            const vars = eventData.variants;
                            
                            if (vars.length === 2) {
                                const keep = vars[1 - cur];
                                this.collapseMultiToSingleRoot(eventData, keep);
                                this.currentVariantIndex = 0;
                            } else {
                                vars.splice(cur, 1);
                                const newIdx = Math.min(cur, vars.length - 1);
                                this.currentVariantIndex = newIdx;
                            }
                            
                            const target = eventData.variants && eventData.variants.length > 0
                                ? eventData.variants[this.currentVariantIndex]
                                : eventData;
                            this.populateInlineEditor(eventData, target);
                            this.renderVariantBar(eventData);
                        },
                        
                        onVariantMakePrimary() {
                            const { eventData } = this.editTarget;
                            if (!eventData?.variants || eventData.variants.length <= 1) return;
                            
                            const cur = this.currentVariantIndex ?? 0;
                            if (cur === 0) return; // Already primary
                            
                            if (!confirm(`Make variant ${cur + 1} the primary variant? This will swap it with the current primary and update the root event name/description.`)) {
                                return;
                            }
                            
                            this.saveCurrentVariantData();
                            
                            // Swap variant at cur with variant at 0
                            const vars = eventData.variants;
                            const temp = vars[0];
                            vars[0] = vars[cur];
                            vars[cur] = temp;
                            
                            // Update root event name and description to match new primary
                            const newPrimary = vars[0];
                            eventData.name = newPrimary.name || eventData.name;
                            eventData.description = newPrimary.description || eventData.description;
                            
                            // Update current index to 0 (the new primary)
                            this.currentVariantIndex = 0;
                            
                            // Re-render with new primary
                            const target = vars[0];
                            this.populateInlineEditor(eventData, target);
                            this.renderVariantBar(eventData);
                            
                            // Update the title and description display elements
                            const titleEl = document.getElementById('eventSlideTitle');
                            const textEl = document.getElementById('eventSlideText');
                            if (titleEl) titleEl.textContent = eventData.name;
                            if (textEl) textEl.innerHTML = eventData.description;
                        },
                        
                        saveCurrentVariantData() {
                            if (!this.editTarget) return;
                            const { eventData } = this.editTarget;
                            
                            const isMulti = Array.isArray(eventData.variants) && eventData.variants.length > 0;
                            if (!isMulti) return;
                            
                            const vIdx = this.currentVariantIndex ?? 0;
                            const target = eventData.variants[vIdx];
                            if (!target) return;
                            
                            // Collect data from form fields
                            const cityInput = document.getElementById('eventSlideEditCityDisplayName');
                            const yearStartInput = document.getElementById('eventSlideEditYearStart');
                            const yearEndInput = document.getElementById('eventSlideEditYearEnd');
                            const eraInput = document.getElementById('eventSlideEditEraName');
                            const filtersInput = document.getElementById('eventSlideEditFilters');
                            const factionsInput = document.getElementById('eventSlideEditFactions');
                            const npcsInput = document.getElementById('eventSlideEditNpcs');
                            const headlinesInput = document.getElementById('eventSlideEditHeadlines');
                            const locationTypeInput = document.getElementById('eventSlideEditLocationType');
                            const latInput = document.getElementById('eventSlideEditLat');
                            const lonInput = document.getElementById('eventSlideEditLon');
                            const xInput = document.getElementById('eventSlideEditX');
                            const yInput = document.getElementById('eventSlideEditY');
                            
                            if (cityInput) target.cityDisplayName = cityInput.value;
                            if (yearStartInput) target.yearStart = yearStartInput.value;
                            if (yearEndInput) target.yearEnd = yearEndInput.value;
                            if (eraInput) target.eraName = eraInput.value;
                            const heroFpElSv = document.getElementById('eventSlideEditHeroFilterPlaces');
                            if (heroFpElSv && window.HeroRelevantLocationsEditor?.collect) {
                                const hr = window.HeroRelevantLocationsEditor.collect(heroFpElSv);
                                const fr = window.HeroRelevantLocationsEditor.collect(
                                    document.getElementById('eventSlideEditFactionFilterPlaces')
                                );
                                const nr = window.HeroRelevantLocationsEditor.collect(
                                    document.getElementById('eventSlideEditNpcFilterPlaces')
                                );
                                applyStoryFilterPlacesToTarget(target, hr, fr, nr);
                            } else {
                                if (filtersInput) target.filters = filtersInput.value.split(',').map(s => s.trim()).filter(s => s);
                                if (factionsInput) target.factions = factionsInput.value.split(',').map(s => s.trim()).filter(s => s);
                                if (npcsInput) target.npcs = npcsInput.value.split(',').map(s => s.trim()).filter(s => s);
                            }
                            const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
                            const places =
                                window.HeroRelevantLocationsEditor?.collect?.(secPlacesEl) ?? [];
                            target.secondaryCountryPlaces = places;
                            if (window.LocationFlagHelpers?.syncSecondaryCountryFlagsOnEntity) {
                                window.LocationFlagHelpers.syncSecondaryCountryFlagsOnEntity(target);
                            }
                            if (headlinesInput) target.headlines = headlinesInput.value.split('\n').map(s => s.trim()).filter(s => s);
                            if (locationTypeInput) target.locationType = locationTypeInput.value;
                            if (latInput) target.lat = parseFloat(latInput.value) || null;
                            if (lonInput) target.lon = parseFloat(lonInput.value) || null;
                            if (xInput) target.x = parseFloat(xInput.value) || null;
                            if (yInput) target.y = parseFloat(yInput.value) || null;
                        },
                        
                        convertRootEventToMulti(eventData) {
                            // Move root event data into first variant
                            const firstVariant = {
                                name: eventData.name || '',
                                description: eventData.description || '',
                                cityDisplayName: eventData.cityDisplayName || '',
                                yearStart: eventData.yearStart || eventData.year,
                                yearEnd: eventData.yearEnd || null,
                                eraName: eventData.eraName || '',
                                filters: [...(eventData.filters || [])],
                                factions: [...(eventData.factions || [])],
                                npcs: [...(eventData.npcs || [])],
                                headlines: [...(eventData.headlines || [])],
                                sources: eventData.sources ? [...eventData.sources] : undefined,
                                lat: eventData.lat,
                                lon: eventData.lon,
                                x: eventData.x,
                                y: eventData.y,
                                locationType: eventData.locationType,
                                secondaryCountryFlags: Array.isArray(eventData.secondaryCountryFlags)
                                    ? [...eventData.secondaryCountryFlags]
                                    : undefined,
                                secondaryCountryPlaces: Array.isArray(eventData.secondaryCountryPlaces)
                                    ? eventData.secondaryCountryPlaces.map((p) => ({
                                          locationName: p.locationName,
                                          country: p.country,
                                          reasoning: p.reasoning
                                      }))
                                    : [],
                                ...copyFilterPlaceArraysFromSource(eventData)
                            };
                            eventData.variants = [firstVariant];
                            delete eventData.heroFilterPlaces;
                            delete eventData.factionFilterPlaces;
                            delete eventData.npcFilterPlaces;
                        },
                        
                        collapseMultiToSingleRoot(eventData, keepVariant) {
                            // Move variant data back to root
                            eventData.name = keepVariant.name || '';
                            eventData.description = keepVariant.description || '';
                            eventData.cityDisplayName = keepVariant.cityDisplayName || '';
                            eventData.yearStart = keepVariant.yearStart;
                            eventData.yearEnd = keepVariant.yearEnd;
                            eventData.eraName = keepVariant.eraName || '';
                            eventData.filters = [...(keepVariant.filters || [])];
                            eventData.factions = [...(keepVariant.factions || [])];
                            eventData.npcs = [...(keepVariant.npcs || [])];
                            eventData.headlines = [...(keepVariant.headlines || [])];
                            eventData.sources = keepVariant.sources ? [...keepVariant.sources] : undefined;
                            eventData.lat = keepVariant.lat;
                            eventData.lon = keepVariant.lon;
                            eventData.x = keepVariant.x;
                            eventData.y = keepVariant.y;
                            eventData.locationType = keepVariant.locationType;
                            eventData.secondaryCountryFlags = Array.isArray(keepVariant.secondaryCountryFlags)
                                ? [...keepVariant.secondaryCountryFlags]
                                : undefined;
                            eventData.secondaryCountryPlaces = Array.isArray(keepVariant.secondaryCountryPlaces)
                                ? keepVariant.secondaryCountryPlaces.map((p) => ({
                                      locationName: p.locationName,
                                      country: p.country,
                                      reasoning: p.reasoning
                                  }))
                                : [];
                            const fp = copyFilterPlaceArraysFromSource(keepVariant);
                            if (fp.heroFilterPlaces.length) eventData.heroFilterPlaces = fp.heroFilterPlaces;
                            else delete eventData.heroFilterPlaces;
                            if (fp.factionFilterPlaces.length) eventData.factionFilterPlaces = fp.factionFilterPlaces;
                            else delete eventData.factionFilterPlaces;
                            if (fp.npcFilterPlaces.length) eventData.npcFilterPlaces = fp.npcFilterPlaces;
                            else delete eventData.npcFilterPlaces;
                            delete eventData.variants;
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
                                    this.hideEventSlide();
                                }
                            }
                        },
                        
                        hideEventSlide() {
                            console.log('[DEBUG] hideEventSlide called');
                            const eventSlide = document.getElementById('eventSlide');
                            // Only play sound if panel was actually open
                            const wasOpen = eventSlide?.classList.contains('open');
                            if (eventSlide) {
                                eventSlide.classList.remove('open');
                                this.hideImageOverlay();
                            }
                            this.cancelEdit();
                            
                            // Reset camera when closing event slide
                            console.log('[hideEventSlide] Resetting camera on close');
                            if (window.globeController?.interactionController) {
                                window.globeController.interactionController.stopFollowingStation();
                                window.globeController.interactionController.restorePlanesVisibility?.();
                            }
                            if (window.globeController?.cameraControlService) {
                                window.globeController.cameraControlService.resetCameraToDefault();
                            }
                            
                            // Play close sound for event system only if it was actually closed
                            if (wasOpen && window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('eventClick');
                            }
                        },
                        
                        cancelEdit(editBtn, saveBtn) {
                            if (!this.isEditing) {
                                // Just hide editor if exists
                                const editor = document.getElementById('eventSlideInlineEditor');
                                if (editor) editor.style.display = 'none';
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
                            const editor = document.getElementById('eventSlideInlineEditor');
                            
                            // Restore original state
                            if (this.originalState && this.editTarget) {
                                Object.assign(this.editTarget.eventData, this.originalState);
                            }
                            
                            // Disable editing
                            if (titleEl) {
                                titleEl.contentEditable = 'false';
                                titleEl.removeAttribute('spellcheck');
                            }
                            if (textEl) {
                                textEl.contentEditable = 'false';
                                textEl.removeAttribute('spellcheck');
                            }
                            
                            // Restore description element to its original location
                            if (this.descriptionOriginalParent && textEl) {
                                const originalParent = this.descriptionOriginalParent;
                                const originalNextSibling = this.descriptionOriginalNextSibling;
                                if (originalNextSibling) {
                                    originalParent.insertBefore(textEl, originalNextSibling);
                                } else {
                                    originalParent.appendChild(textEl);
                                }
                                this.descriptionOriginalParent = null;
                                this.descriptionOriginalNextSibling = null;
                            }
                            
                            // Hide editor
                            if (editor) editor.style.display = 'none';
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

                            const archiveSource = window.eventManager?.dataService?.getArchiveSource?.() || 'story';
                            const titleElEarly = document.getElementById('eventSlideTitle');
                            const textElEarly = document.getElementById('eventSlideText');

                            if (archiveSource !== 'story') {
                                const cleanName = (titleElEarly?.textContent || '').trim();
                                const cleanDesc = (textElEarly?.innerHTML || '').trim();
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

                                if (titleElEarly) {
                                    titleElEarly.contentEditable = 'false';
                                    titleElEarly.removeAttribute('spellcheck');
                                }
                                if (textElEarly) {
                                    textElEarly.contentEditable = 'false';
                                    textElEarly.removeAttribute('spellcheck');
                                }
                                if (this.descriptionOriginalParent && textElEarly) {
                                    const originalParent = this.descriptionOriginalParent;
                                    const originalNextSibling = this.descriptionOriginalNextSibling;
                                    if (originalNextSibling) {
                                        originalParent.insertBefore(textElEarly, originalNextSibling);
                                    } else {
                                        originalParent.appendChild(textElEarly);
                                    }
                                    this.descriptionOriginalParent = null;
                                    this.descriptionOriginalNextSibling = null;
                                }
                                document.getElementById('eventSlideInlineEditor')?.style && (document.getElementById('eventSlideInlineEditor').style.display = 'none');
                                document.getElementById('eventSlide')?.classList.remove('event-slide--inline-editing');
                                const orderRowSat = document.getElementById('eventSlideOrderRow');
                                if (orderRowSat) {
                                    orderRowSat.setAttribute('hidden', '');
                                    orderRowSat.setAttribute('aria-hidden', 'true');
                                }
                                if (editBtn) editBtn.textContent = 'Edit';
                                if (saveBtn) saveBtn.style.display = 'none';
                                this.isEditing = false;
                                this.editTarget = null;
                                this.originalState = null;
                                this.updateSourcesAndFilters(normalized);
                                this.allEvents = window.eventManager?.events || [];
                                // Dock is main-timeline only; satellite saves do not change it — avoid dock thumb/page-turn refresh
                                if (window.eventManager?.renderEvents) window.eventManager.renderEvents();
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
                                if (window.SoundEffectsManager?.play) window.SoundEffectsManager.play('save');
                                return;
                            }
                            
                            // Save current variant data before saving
                            this.saveCurrentVariantData();
                            
                            const isMultiEvent = eventData.variants && eventData.variants.length > 0;
                            const target = isMultiEvent ? eventData.variants[this.currentVariantIndex || 0] : eventData;
                            
                            // Gather values from inline editor
                            const cityInput = document.getElementById('eventSlideEditCityDisplayName');
                            const yearStartInput = document.getElementById('eventSlideEditYearStart');
                            const yearEndInput = document.getElementById('eventSlideEditYearEnd');
                            const eraInput = document.getElementById('eventSlideEditEraName');
                            const filtersInput = document.getElementById('eventSlideEditFilters');
                            const factionsInput = document.getElementById('eventSlideEditFactions');
                            const npcsInput = document.getElementById('eventSlideEditNpcs');
                            const headlinesInput = document.getElementById('eventSlideEditHeadlines');
                            const locationTypeInput = document.getElementById('eventSlideEditLocationType');
                            const latInput = document.getElementById('eventSlideEditLat');
                            const lonInput = document.getElementById('eventSlideEditLon');
                            const xInput = document.getElementById('eventSlideEditX');
                            const yInput = document.getElementById('eventSlideEditY');
                            const titleEl = document.getElementById('eventSlideTitle');
                            const textEl = document.getElementById('eventSlideText');
                            
                            // Update target
                            if (target) {
                                if (titleEl) target.name = titleEl.textContent || target.name;
                                if (textEl) target.description = textEl.innerHTML || target.description;
                                if (cityInput) target.cityDisplayName = cityInput.value;
                                if (yearStartInput) target.yearStart = parseInt(yearStartInput.value) || target.yearStart;
                                if (yearEndInput) target.yearEnd = parseInt(yearEndInput.value) || null;
                                if (eraInput) target.eraName = eraInput.value || null;
                                const heroFpSave = document.getElementById('eventSlideEditHeroFilterPlaces');
                                if (heroFpSave && window.HeroRelevantLocationsEditor?.collect) {
                                    const hr = window.HeroRelevantLocationsEditor.collect(heroFpSave);
                                    const fr = window.HeroRelevantLocationsEditor.collect(
                                        document.getElementById('eventSlideEditFactionFilterPlaces')
                                    );
                                    const nr = window.HeroRelevantLocationsEditor.collect(
                                        document.getElementById('eventSlideEditNpcFilterPlaces')
                                    );
                                    applyStoryFilterPlacesToTarget(target, hr, fr, nr);
                                } else {
                                    if (filtersInput) target.filters = filtersInput.value.split(',').map(s => s.trim()).filter(Boolean);
                                    if (factionsInput) target.factions = factionsInput.value.split(',').map(s => s.trim()).filter(Boolean);
                                    if (npcsInput) target.npcs = npcsInput.value.split(',').map(s => s.trim()).filter(Boolean);
                                }

                                const secPlacesEl = document.getElementById('eventSlideEditSecondaryCountryPlaces');
                                const places =
                                    window.HeroRelevantLocationsEditor?.collect?.(secPlacesEl) ?? [];
                                target.secondaryCountryPlaces = places;
                                if (window.LocationFlagHelpers?.syncSecondaryCountryFlagsOnEntity) {
                                    window.LocationFlagHelpers.syncSecondaryCountryFlagsOnEntity(target);
                                }

                                if (headlinesInput) target.headlines = headlinesInput.value.split('\n').map(s => s.trim()).filter(Boolean);
                                
                                // Save location type and coordinates
                                const locType = locationTypeInput ? locationTypeInput.value : 'earth';
                                target.locationType = locType;
                                
                                if (locType === 'earth') {
                                    const lat = latInput ? parseFloat(latInput.value) : null;
                                    const lon = lonInput ? parseFloat(lonInput.value) : null;
                                    if (!Number.isNaN(lat)) target.lat = lat;
                                    if (!Number.isNaN(lon)) target.lon = lon;
                                    delete target.x;
                                    delete target.y;
                                } else {
                                    const x = xInput ? parseFloat(xInput.value) : null;
                                    const y = yInput ? parseFloat(yInput.value) : null;
                                    if (!Number.isNaN(x)) target.x = x;
                                    if (!Number.isNaN(y)) target.y = y;
                                    delete target.lat;
                                    delete target.lon;
                                }
                                
                                // Gather sources
                                const sourceRows = document.querySelectorAll('#eventSlideEditSources .event-slide-inline-editor__source-row');
                                target.sources = Array.from(sourceRows).map(row => ({
                                    text: row.querySelector('[data-role="source-text"]')?.value || '',
                                    url: row.querySelector('[data-role="source-url"]')?.value || ''
                                })).filter(s => s.text || s.url);
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
                            
                            // Mark as unsaved and persist to localStorage
                            if (window.eventManager) {
                                const idx = window.eventManager.events.indexOf(eventData);
                                if (idx >= 0) {
                                    window.eventManager.unsavedEventIndices.add(idx);
                                }
                                // Persist changes to localStorage immediately
                                if (window.eventManager.dataService && typeof window.eventManager.dataService.saveEvents === 'function') {
                                    window.eventManager.dataService.saveEvents();
                                }
                            }

                            if (window.eventManager?.refreshGlobeEvents) {
                                window.eventManager.refreshGlobeEvents();
                            }
                            
                            // Disable editing
                            if (titleEl) {
                                titleEl.contentEditable = 'false';
                                titleEl.removeAttribute('spellcheck');
                            }
                            if (textEl) {
                                textEl.contentEditable = 'false';
                                textEl.removeAttribute('spellcheck');
                            }
                            
                            // Restore description element to its original location
                            if (this.descriptionOriginalParent && textEl) {
                                const originalParent = this.descriptionOriginalParent;
                                const originalNextSibling = this.descriptionOriginalNextSibling;
                                if (originalNextSibling) {
                                    originalParent.insertBefore(textEl, originalNextSibling);
                                } else {
                                    originalParent.appendChild(textEl);
                                }
                                this.descriptionOriginalParent = null;
                                this.descriptionOriginalNextSibling = null;
                            }
                            
                            // Hide editor
                            const eventSlide = document.getElementById('eventSlide');
                            const editor = document.getElementById('eventSlideInlineEditor');
                            if (editor) editor.style.display = 'none';
                            eventSlide?.classList.remove('event-slide--inline-editing');
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
                            
                            // Refresh display
                            this.updateSourcesAndFilters(target);
                            
                            // Reload events from localStorage to get updated data
                            if (window.eventManager?.dataService?.loadEvents) {
                                window.eventManager.dataService.loadEvents();
                                // Update allEvents reference
                                this.allEvents = window.eventManager.events || [];
                            }
                            
                            // Regenerate slider ticks to update unfinished markers
                            // Force a full regeneration by calling generateSliderTicks directly
                            const ticksEl = document.getElementById('eventPageSliderTicks');
                            const pageSlider = document.getElementById('eventPageSlider');
                            if (ticksEl && pageSlider && this.allEvents) {
                                const totalPages = Math.max(1, Math.ceil(this.allEvents.length / 50));
                                ticksEl.innerHTML = '';
                                // Call the local generateSliderTicks function
                                // We need to access it from the closure - let's trigger updatePaginationUI instead
                                if (this.updatePaginationUI) {
                                    this.updatePaginationUI();
                                }
                            }
                            
                            // Play sound
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('save');
                            }
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
                        
                        // Toggle image overlay
                        toggleImageOverlay(imagePath) {
                            console.log('[DEBUG standalone toggleImageOverlay] FUNCTION ENTRY - called, overlay open:', document.getElementById('eventImageOverlay')?.classList.contains('open'), 'imagePath:', imagePath, 'this.currentImagePath:', this.currentImagePath);
                            const overlay = document.getElementById('eventImageOverlay');
                            const img = document.getElementById('eventImage');
                            const toggleBtn = document.getElementById('eventImageToggle');
                            console.log('[DEBUG standalone toggleImageOverlay] After getting elements, overlay:', !!overlay, 'img:', !!img, 'toggleBtn:', !!toggleBtn);
                            if (!overlay) {
                                console.error('[DEBUG standalone toggleImageOverlay] Early return: no overlay');
                                return;
                            }
                            
                            if (window.SoundEffectsManager) {
                                window.SoundEffectsManager.play('imageDisplay');
                            }
                            
                            if (overlay.classList.contains('open')) {
                                console.log('[DEBUG standalone toggleImageOverlay] Hiding image');
                                this.hideImageOverlay();
                                if (toggleBtn) toggleBtn.textContent = 'Show Image';
                                // Sync with global toggle state
                                localStorage.setItem('globalImageToggle', 'false');
                                this.updateGlobalToggleButtonLabel(false);
                            } else {
                                console.log('[DEBUG standalone toggleImageOverlay] Showing image');
                                // Show image - use provided imagePath, then stored path, then current img src
                                const finalImagePath = imagePath || this.currentImagePath || (img?.src && img.src !== window.location.href ? img.src : null);
                                console.log('[DEBUG standalone toggleImageOverlay] finalImagePath:', finalImagePath);
                                if (finalImagePath) {
                                    this.showImageOverlay(finalImagePath);
                                    if (toggleBtn) toggleBtn.textContent = 'Hide Image';
                                    // Sync with global toggle state
                                    localStorage.setItem('globalImageToggle', 'true');
                                    this.updateGlobalToggleButtonLabel(true);
                                } else {
                                    console.error('[DEBUG standalone toggleImageOverlay] No image path available!');
                                }
                            }
                        },
                        
                        // Update global toggle button label
                        updateGlobalToggleButtonLabel(isOn) {
                            const globalBtn = document.getElementById('globalImageToggle');
                            if (globalBtn) {
                                const labelEl = globalBtn.querySelector('.globe-control-btn__label');
                                if (labelEl) {
                                    labelEl.textContent = isOn ? 'Image On' : 'Image Off';
                                }
                                if (isOn) {
                                    globalBtn.classList.add('active');
                                } else {
                                    globalBtn.classList.remove('active');
                                }
                            }
                        },
                        
                        // Show image overlay
                        showImageOverlay(imagePath) {
                            const overlay = document.getElementById('eventImageOverlay');
                            const img = document.getElementById('eventImage');
                            const eventSlide = document.getElementById('eventSlide');
                            const toggleBtn = document.getElementById('eventImageToggle');
                            
                            if (overlay && img && imagePath) {
                                img.src = imagePath;
                                img.style.display = 'block';
                                img.style.opacity = '1';
                                overlay.style.display = 'flex';
                                overlay.classList.add('open');
                                if (eventSlide?.classList.contains('open')) {
                                    overlay.classList.add('slide-open');
                                }
                                overlay.style.opacity = '1';
                                if (toggleBtn) toggleBtn.textContent = 'Hide Image';
                            }
                        },
                        
                        // Hide image overlay
                        hideImageOverlay() {
                            console.log('[DEBUG standalone hideImageOverlay] Called, delegating to hideImageOverlayGradually');
                            // Use the gradual fade-out approach
                            this.hideImageOverlayGradually(600);
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
                            const prevBtn = document.getElementById('prevPageBtn');
                            const nextBtn = document.getElementById('nextPageBtn');
                            const pageInput = document.getElementById('pageInput');
                            const pageSlider = document.getElementById('eventPageSlider');
                            const ticksEl = document.getElementById('eventPageSliderTicks');
                            
                            if (!prevBtn || !nextBtn) return;
                            
                            const getDockEvents = () => window.eventManager?.getDockTimelineEvents?.() || [];
                            const eventsPerPage = 10; // Globe uses 10 events per page
                            
                            if (!getDockEvents().length) {
                                console.warn('MenuHelpers: No dock timeline events available for pagination');
                                return;
                            }
                            
                            console.log('MenuHelpers: Setting up pagination with', getDockEvents().length, 'dock story events');
                            
                            // Calculate total pages
                            const getTotalPages = () => {
                                const currentEvents = getDockEvents();
                                return Math.max(1, Math.ceil(currentEvents.length / eventsPerPage));
                            };
                            
                            // STANDALONE: Track our own current page (don't rely on globe dataModel)
                            let standaloneCurrentPage = 1;
                            
                            const getCurrentPage = () => standaloneCurrentPage;
                            
                            const setCurrentPage = (page) => {
                                standaloneCurrentPage = page;
                                // Sync to standaloneEventSlide for filter matching
                                if (window.standaloneEventSlide) {
                                    window.standaloneEventSlide.currentPage = page;
                                }
                            };
                            
                            // Get events for a specific page (mimics DataModel.getEventsForCurrentPage)
                            const getEventsForPage = (pageNum) => {
                                const ev = getDockEvents();
                                const start = (pageNum - 1) * eventsPerPage;
                                const end = start + eventsPerPage;
                                return ev.slice(start, end);
                            };
                            
                            // Generate slider ticks matching globe implementation
                            const generateSliderTicks = (totalPages) => {
                                if (!ticksEl || totalPages <= 1) return;
                                
                                ticksEl.innerHTML = '';
                                const currentEvents = getDockEvents();
                                const totalEvents = currentEvents.length;
                                
                                // Add page number labels at the start of each page segment
                                for (let i = 0; i < totalPages; i++) {
                                    const label = document.createElement('span');
                                    label.className = 'event-page-slider-label';
                                    label.style.left = `${(i / totalPages) * 100}%`;
                                    label.textContent = String(i + 1);
                                    ticksEl.appendChild(label);
                                }
                                
                                // Add major tick marks between pages
                                if (totalPages > 1) {
                                    for (let i = 1; i < totalPages; i++) {
                                        const tick = document.createElement('span');
                                        tick.className = 'event-page-slider-tick event-page-slider-tick--major';
                                        tick.style.left = `${(i / totalPages) * 100}%`;
                                        ticksEl.appendChild(tick);
                                    }
                                }
                                
                                // Add event number labels (1-10) for each page position
                                for (let p = 0; p < totalPages; p++) {
                                    const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                                    for (let e = 0; e < onPage; e++) {
                                        const numLabel = document.createElement('span');
                                        numLabel.className = 'event-page-slider-num';
                                        numLabel.dataset.eventIndex = p * eventsPerPage + e;
                                        numLabel.dataset.pagePosition = e + 1; // 1-10 position
                                        numLabel.style.left = `${((p + (e + 0.5) / onPage) / totalPages) * 100}%`;
                                        numLabel.textContent = String(e + 1);
                                        ticksEl.appendChild(numLabel);
                                    }
                                }
                                
                                // Add event position ticks (one per event slot, centered)
                                for (let p = 0; p < totalPages; p++) {
                                    const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                                    for (let e = 0; e < onPage; e++) {
                                        const tick = document.createElement('span');
                                        tick.className = 'event-page-slider-tick event-page-slider-tick--event';
                                        tick.dataset.eventIndex = p * eventsPerPage + e;
                                        tick.dataset.pagePosition = e + 1; // 1-10
                                        // Centered on each event position
                                        tick.style.left = `${((p + (e + 0.5) / onPage) / totalPages) * 100}%`;
                                        ticksEl.appendChild(tick);
                                    }
                                }
                                
                                // Add unfinished slot markers (red bars) for events missing descriptions
                                for (let p = 0; p < totalPages; p++) {
                                    const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                                    for (let e = 0; e < onPage; e++) {
                                        const g = p * eventsPerPage + e;
                                        const rootEv = g >= 0 && g < totalEvents ? currentEvents[g] : null;
                                        if (!eventRootSlotMissingDescription(rootEv)) continue;
                                        const mark = document.createElement('span');
                                        mark.className = 'event-page-slider-tick event-page-slider-tick--unfinished-slot';
                                        mark.style.left = `${((p + (e + 0.5) / onPage) / totalPages) * 100}%`;
                                        mark.title = 'Unfinished: missing description';
                                        ticksEl.appendChild(mark);
                                    }
                                }
                            };
                            
                            // Update era strip
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
                                
                                const currentEvents = getDockEvents();
                                
                                // Try to use EraHoverPreviewTheme first
                                if (window.EraHoverPreviewTheme?.buildGlobalEraStripeBackgroundLinearGradient) {
                                    eraStrip.style.background = window.EraHoverPreviewTheme.buildGlobalEraStripeBackgroundLinearGradient(
                                        currentEvents,
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
                                        const pageEvents = currentEvents.slice(startIdx, startIdx + eventsPerPage);
                                        
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
                            
                            // Update pagination UI
                            const updatePaginationUI = () => {
                                const currentPage = getCurrentPage();
                                const totalPages = getTotalPages();
                                const pageTotal = document.getElementById('pageTotal');
                                
                                if (pageTotal) pageTotal.textContent = `/ ${totalPages}`;
                                if (pageInput) {
                                    pageInput.value = currentPage;
                                    pageInput.max = totalPages;
                                }
                                
                                // Update slider using globe's EVENT_PAGE_SLIDER_RESOLUTION
                                if (pageSlider) {
                                    const SLIDER_RESOLUTION = 10000;
                                    pageSlider.min = '0';
                                    pageSlider.max = String(SLIDER_RESOLUTION);
                                    pageSlider.disabled = totalPages <= 1;
                                    
                                    // Calculate slider value for page center (same as globe)
                                    const pageCenter = (currentPage - 0.5) / totalPages;
                                    pageSlider.value = String(Math.round(pageCenter * SLIDER_RESOLUTION));
                                }
                                
                                // Generate ticks and era strip
                                generateSliderTicks(totalPages);
                                updateEraStrip(totalPages);
                                
                                // Update filter-hit ticks for current filter state
                                const activeFilters = window.standaloneActiveFilters || new Set();
                                const currentEvents = getDockEvents();
                                updateStandaloneSliderTicks(activeFilters, currentEvents, eventsPerPage, currentPage);
                                
                                // Update buttons
                                prevBtn.disabled = totalPages <= 1;
                                nextBtn.disabled = totalPages <= 1;
                                
                                // Update number button content with current page events
                                const currentPageEvents = getEventsForPage(currentPage);
                                this.updateNumberButtons(currentPageEvents, currentPage);
                                
                                // Update news ticker with current page events
                                if (window.newsTickerService) {
                                    window.newsTickerService.updateTicker(currentPageEvents);
                                }
                                
                                // Show/hide pagination
                                const pagination = document.getElementById('eventPagination');
                                if (pagination) {
                                    pagination.style.display = totalPages <= 1 ? 'none' : 'flex';
                                }
                            };
                            
                            // Helper to calculate matching events on a page
                            const getMatchingEventsOnPage = (pageNum) => {
                                const activeFilters = window.standaloneActiveFilters || new Set();
                                if (activeFilters.size === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                                
                                const dockEv = getDockEvents();
                                const pageStart = (pageNum - 1) * 10;
                                const pageEnd = Math.min(pageStart + 10, dockEv.length);
                                const matching = [];
                                
                                for (let i = pageStart; i < pageEnd; i++) {
                                    const event = dockEv[i];
                                    if (event && !shouldEventBeLocked(event, activeFilters)) {
                                        matching.push((i % 10) + 1); // 1-based index on page
                                    }
                                }
                                return matching;
                            };
                            
                            // Handle page change
                            const handlePageChange = (newPage, options = {}) => {
                                const totalPages = getTotalPages();
                                const validPage = Math.max(1, Math.min(totalPages, newPage));
                                const currentPage = getCurrentPage();
                                
                                if (validPage !== currentPage) {
                                    setCurrentPage(validPage);
                                    updatePaginationUI();
                                    
                                    // Log page change with filter state and matches
                                    const activeFilters = window.standaloneActiveFilters || new Set();
                                    const filterStr = activeFilters.size > 0 ? `[${Array.from(activeFilters).join(', ')}]` : '[]';
                                    const matching = getMatchingEventsOnPage(validPage);
                                    const matchStr = matching.length > 0 ? `[${matching.join(', ')}]` : '[]';
                                    console.log(`[FILTERS] 📄 PAGE ${validPage}: ${filterStr} | Matches: ${matchStr}`);
                                    
                                    // Refresh event markers on Globe for new page
                                    if (window.globeEventMarkerManager) {
                                        window.globeEventMarkerManager.refreshEventMarkers(true);
                                    }
                                    
                                    // Refresh Map2DLiteLayer markers and celestial panels
                                    if (window.globeController?.map2dLite?.syncMarkers) {
                                        window.globeController.map2dLite.syncMarkers({ mode: 'pageTurn' });
                                    }
                                    
                                    // Update news ticker with current page events
                                    if (window.newsTickerService) {
                                        const currentPageEvents = getEventsForPage(validPage);
                                        window.newsTickerService.updateTicker(currentPageEvents);
                                    }
                                    
                                    // Skip sound during slider scrubbing - tick sounds play instead
                                    if (!options.skipSound && window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('page');
                                    }
                                }
                            };
                            
                            // Prev button
                            prevBtn.onclick = (e) => {
                                e?.stopPropagation?.();
                                const current = getCurrentPage();
                                if (current > 1) {
                                    handlePageChange(current - 1);
                                } else {
                                    handlePageChange(getTotalPages()); // Wrap to last
                                }
                            };
                            
                            // Next button
                            nextBtn.onclick = (e) => {
                                e?.stopPropagation?.();
                                const current = getCurrentPage();
                                const total = getTotalPages();
                                if (current < total) {
                                    handlePageChange(current + 1);
                                } else {
                                    handlePageChange(1); // Wrap to first
                                }
                            };
                            
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
                                
                                prevEventBtn.onclick = (e) => {
                                    e?.stopPropagation?.();
                                    navigateToEvent(-1);
                                };
                                
                                nextEventBtn.onclick = (e) => {
                                    e?.stopPropagation?.();
                                    navigateToEvent(1);
                                };
                                
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
                            
                            // Page input
                            if (pageInput) {
                                pageInput.onchange = (e) => {
                                    e.stopPropagation();
                                    const value = parseInt(e.target.value, 10);
                                    if (!isNaN(value)) {
                                        handlePageChange(value);
                                    }
                                };
                                
                                pageInput.onkeydown = (e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        pageInput.blur();
                                    }
                                };
                            }
                            
                            // Page slider - Globe-style with tick sounds and live updates
                            if (pageSlider) {
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
                            
                            // Store for external access
                            this.updatePaginationUI = updatePaginationUI;
                            
                            // Initial update
                            updatePaginationUI();
                        },
                        
                        wireNumberButtons(pageEvents, pageNum, allEvents) {
                            const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
                            if (!buttons.length) return;
                            
                            const events = allEvents || window.eventManager?.getDockTimelineEvents?.() || [];
                            const eventsPerPage = 10;
                            const baseIndex = (pageNum - 1) * eventsPerPage;
                            
                            // Get active filters for lock state check
                            const activeFilters = window.standaloneActiveFilters || new Set();
                            const filtersOn = activeFilters.size > 0;
                            
                            buttons.forEach((btn, index) => {
                                // Remove old listeners by cloning
                                const newBtn = btn.cloneNode(true);
                                btn.parentNode.replaceChild(newBtn, btn);
                                
                                const event = pageEvents?.[index];
                                const globalEventIndex = baseIndex + index;
                                
                                if (!event) {
                                    newBtn.disabled = true;
                                    newBtn.style.opacity = '0.3';
                                    newBtn.style.display = 'none';
                                    newBtn.classList.remove('locked');
                                    return;
                                }
                                
                                // Check if this event should be locked based on filters
                                const isLocked = filtersOn && shouldEventBeLocked(event, activeFilters);
                                
                                newBtn.disabled = isLocked;
                                newBtn.style.opacity = isLocked ? '0.5' : '1';
                                newBtn.style.display = '';
                                newBtn.classList.toggle('locked', isLocked);
                                newBtn.dataset.isLocked = isLocked ? 'true' : 'false';
                                newBtn.dataset.eventIndex = globalEventIndex;
                                // Set data-position to page position (1-10)
                                newBtn.dataset.position = String(index + 1);
                                
                                // Update button number
                                const numEl = newBtn.querySelector('.event-number-btn__num');
                                if (numEl) numEl.textContent = globalEventIndex + 1;
                                
                                // Update button content
                                const nameEl = newBtn.querySelector('.event-number-btn__name');
                                const imgEl = newBtn.querySelector('.event-number-btn__img');
                                const imgWrap = newBtn.querySelector('.event-number-btn__img-wrap');
                                const variantBadge = newBtn.querySelector('.event-number-btn__variant-badge');
                                const keyEl = newBtn.querySelector('.event-number-btn__key');
                                
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
                                
                                // Check if event has description (unfinished indicator)
                                // Use same logic as eventRootSlotMissingDescription
                                const d = displayEvent.description;
                                let hasDescription = false;
                                if (d) {
                                    const textContent = d.replace(/<[^>]*>/g, '').trim();
                                    if (textContent !== 'No description available.' && textContent !== 'No description available' && textContent.length > 0) {
                                        hasDescription = true;
                                    }
                                }
                                newBtn.classList.toggle('event-number-btn--unfinished', !hasDescription);
                                newBtn.title = hasDescription ? plainName : `${plainName} — Unfinished: missing description`;
                                
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
                                newBtn.onclick = (e) => {
                                    e.stopPropagation();
                                    
                                    // Check if clicking variant badge
                                    if (e.target.closest('.event-number-btn__variant-badge')) {
                                        return;
                                    }
                                    
                                    // Alert if locked event was clicked (should not happen)
                                    const btnLocked = newBtn.dataset.isLocked === 'true';
                                    if (btnLocked || newBtn.disabled) {
                                        console.error(`[FILTERS] 🚨 LOCKED EVENT CLICKED: #${globalEventIndex} "${event.name || 'unnamed'}"`);
                                        return; // Don't open locked events
                                    }

                                    // Clear hover state when clicking thumbnail
                                    if (window.globeController?.interactionController) {
                                        window.globeController.interactionController.hoveredEventMarker = null;
                                    }
                                    if (window.globeController?.markerPulseService) {
                                        window.globeController.markerPulseService.hoveredEventMarker = null;
                                    }

                                    // Show event in standalone panel
                                    if (window.standaloneEventSlide) {
                                        window.standaloneEventSlide.showEvent(globalEventIndex);
                                    }

                                    if (window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('eventClick');
                                    }
                                };
                                
                                // Variant badge click - cycles thumbnail and opens event slide
                                if (variantBadge) {
                                    variantBadge.onclick = (e) => {
                                        e.stopPropagation();
                                        
                                        const targetEvent = events[globalEventIndex];
                                        if (!targetEvent?.variants?.length) return;
                                        
                                        const currentVariant = parseInt(variantBadge.dataset.currentVariant || '0', 10);
                                        const nextVariant = (currentVariant + 1) % targetEvent.variants.length;
                                        variantBadge.dataset.currentVariant = nextVariant;
                                        // Update badge text
                                        variantBadge.textContent = `${nextVariant + 1}/${targetEvent.variants.length}`;
                                        
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
                                    };
                                }
                                
                                // Hover effects - show preview badge and trigger marker hover
                                newBtn.onmouseenter = () => {
                                    // Show preview badge
                                    if (window.SummaryInfoBadge?.show && event) {
                                        const hoverLines = window.SummaryInfoBadge.getHoverPreviewLines 
                                            ? window.SummaryInfoBadge.getHoverPreviewLines(event)
                                            : { eraName: displayEvent.eraName || '', primaryRowFlag: null, otherRowFlags: [], yearLine: displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `–${displayEvent.yearEnd}` : ''}` : '' };
                                        
                                        const variants = isMultiEvent ? event.variants : [];
                                        const otherVariants = variants.slice(1);
                                        
                                        window.SummaryInfoBadge.show(
                                            globalEventIndex + 1,
                                            plainName,
                                            otherVariants.map(v => v.name || ''),
                                            hoverLines.eraName || displayEvent.eraName || '',
                                            hoverLines.primaryRowFlag || null,
                                            hoverLines.otherRowFlags || [],
                                            hoverLines.yearLine || (displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `–${displayEvent.yearEnd}` : ''}` : '')
                                        );
                                    }

                                    // Trigger marker hover effect based on view mode
                                    const sceneModel = window.globeController?.sceneModel;
                                    const isMapView = sceneModel?.getMapViewEnabled?.() || !!sceneModel?.isMapView;

                                    if (isMapView) {
                                        // Map view: find DOM marker and set hover
                                        // Force cycle to this event if it's in an overlap group
                                        let marker = findMarkerForEvent(event, globalEventIndex);
                                        let markerBtn = marker?.__domMarkerButton;
                                        
                                        console.log('[Map Thumbnail Hover] Initial marker:', marker?.stub?.userData?.eventName, 'markerBtn:', !!markerBtn);
                                        
                                        if (window.globeController?.map2dLite) {
                                            const targetMarker = window.globeController.map2dLite.forceCycleToEvent(event);
                                            if (targetMarker) {
                                                marker = targetMarker; // Use the switched marker
                                                markerBtn = targetMarker.btn; // Use the button from the switched marker
                                                console.log('[Map Thumbnail Hover] Switched to target marker, btn:', !!markerBtn, 'has wave:', !!markerBtn?.querySelector('.map-2d-lite__marker-wave'));
                                            }
                                            window.globeController.map2dLite.pauseOverlapCycling();
                                        }
                                        
                                        if (markerBtn) {
                                            const ms = window.globeController?.interactionController?.markerService;
                                            ms?.setDomLiteMarkerHover?.(marker);
                                            // Play radiate sound effect and start continuous loop
                                            if (window.SoundEffectsManager?.play) {
                                                window.SoundEffectsManager.play('radiate');
                                                // Clear any existing sound loop
                                                if (_thumbnailHoverSoundInterval) {
                                                    clearInterval(_thumbnailHoverSoundInterval);
                                                }
                                                // Start continuous sound loop (every 1.2s matches wave animation)
                                                _thumbnailHoverSoundInterval = setInterval(() => {
                                                    if (window.SoundEffectsManager?.play) {
                                                        window.SoundEffectsManager.play('radiate');
                                                    }
                                                }, 1200);
                                            }
                                            // Add hover class to DOM marker button to trigger wave animation
                                            markerBtn.classList.add('map-2d-lite__marker--synthetic-hover');
                                            console.log('[Map Thumbnail Hover] Added synthetic-hover class to button');
                                        } else {
                                            console.log('[Map Thumbnail Hover] No markerBtn found!');
                                        }
                                        
                                        // Center map on marker
                                        if (event.lat != null && event.lon != null) {
                                            window.globeController?.map2dLite?.flyToLatLon?.(event.lat, event.lon);
                                        }
                                    } else {
                                        // Globe view: use WebGL marker with pulse
                                        let marker = findMarkerForEvent(event, globalEventIndex);
                                        if (marker) {
                                            // Force cycle to this event if it's in an overlap group
                                            if (window.globeEventMarkerManager) {
                                                const targetMarker = window.globeEventMarkerManager.forceCycleToEvent(event);
                                                if (targetMarker) {
                                                    marker = targetMarker; // Use the switched marker
                                                }
                                                window.globeEventMarkerManager.pauseOverlapCycling();
                                            }
                                            
                                            const ic = window.globeController?.interactionController;
                                            if (ic?.pulseService) {
                                                ic.pulseService.setHoveredMarker(marker); // Glow effect
                                                ic.startEventMarkerPulse(marker); // Pulse rings
                                            }
                                            // Center camera on marker
                                            centerCameraOnMarker(marker);
                                        }
                                    }
                                };
                                
                                newBtn.onmouseleave = () => {
                                    if (window.SummaryInfoBadge?.hide) {
                                        window.SummaryInfoBadge.hide();
                                    }

                                    // Clear marker hover effect based on view mode
                                    const sceneModel = window.globeController?.sceneModel;
                                    const isMapView = sceneModel?.getMapViewEnabled?.() || !!sceneModel?.isMapView;

                                    if (isMapView) {
                                        // Map view: clear DOM-lite hover and reset to default view
                                        const ms = window.globeController?.interactionController?.markerService;
                                        ms?.setDomLiteMarkerHover?.(null);
                                        // Remove hover class from DOM marker button
                                        // Need to find the correct button for overlap groups
                                        const marker = findMarkerForEvent(event, globalEventIndex);
                                        let markerBtn = marker?.__domMarkerButton;
                                        
                                        // For overlap groups, find the currently visible marker's button
                                        if (window.globeController?.map2dLite && !markerBtn) {
                                            const group = window.globeController.map2dLite.overlapGroups.find(g => 
                                                g.markers.some(m => {
                                                    const markerEvent = m.stub.userData.event;
                                                    if (!markerEvent) return false;
                                                    return markerEvent.name === event.name &&
                                                           markerEvent.lat === event.lat &&
                                                           markerEvent.lon === event.lon;
                                                })
                                            );
                                            if (group) {
                                                const visibleMarker = group.markers[group.currentIndex];
                                                if (visibleMarker) {
                                                    markerBtn = visibleMarker.btn;
                                                }
                                            }
                                        }
                                        
                                        if (markerBtn) {
                                            markerBtn.classList.remove('map-2d-lite__marker--synthetic-hover');
                                        }
                                        // Clear continuous sound loop
                                        if (_thumbnailHoverSoundInterval) {
                                            clearInterval(_thumbnailHoverSoundInterval);
                                            _thumbnailHoverSoundInterval = null;
                                        }
                                        window.globeController?.map2dLite?.resetView?.();
                                        // Resume overlap cycling
                                        window.globeController?.map2dLite?.resumeOverlapCycling?.();
                                    } else {
                                        // Globe view: clear WebGL pulse effects and restore camera
                                        const ic = window.globeController?.interactionController;
                                        if (ic?.pulseService) {
                                            const hoveredMarker = ic.pulseService.getHoveredMarker();
                                            if (hoveredMarker) {
                                                ic.stopEventMarkerPulse(hoveredMarker);
                                                ic.pulseService.setHoveredMarker(null);
                                            }
                                        }
                                        restoreCameraFromThumbnailHover();
                                        // Resume overlap cycling
                                        window.globeEventMarkerManager?.resumeOverlapCycling?.();
                                    }
                                };
                            });
                        },
                        
                        updateNumberButtons(pageEvents, pageNum) {
                            // Get all events for indexing (dock = main story timeline only)
                            const allEvents = window.eventManager?.getDockTimelineEvents?.() || [];
                            
                            // Animate with content swap during animation (like globe)
                            this.animatePageTurn(pageEvents, pageNum, allEvents);
                        },
                        
                        animatePageTurn(pageEvents, pageNum, allEvents) {
                            const buttons = document.querySelectorAll('#eventNumberButtons .event-number-btn');
                            if (!buttons.length) return;
                            
                            const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
                            if (prefersReducedMotion || typeof Element.prototype.animate !== 'function') {
                                // Fallback: just update content without animation
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
                            
                            // Get active filters for lock state check
                            const activeFilters = window.standaloneActiveFilters || new Set();
                            const filtersOn = activeFilters.size > 0;
                            
                            // Helper to set up click handler
                            const setupClickHandler = (button, eventIndex) => {
                                if (!window.standaloneEventSlide) {
                                    console.error('[DEBUG] Cannot setup click handler - standaloneEventSlide not available!');
                                    return;
                                }
                                button.onclick = (e) => {
                                    e.stopPropagation();
                                    if (e.target.closest('.event-number-btn__variant-badge')) return;
                                    console.log('[DEBUG Click] Opening event', eventIndex);
                                    window.standaloneEventSlide.showEvent(eventIndex);
                                    window.SoundEffectsManager?.play?.('eventClick');
                                };
                            };
                            
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
                                
                                // IMMEDIATELY set up click handler with CORRECT index
                                // (will be refreshed again in updateSingleButtonContent, but this ensures it's right from start)
                                setupClickHandler(btn, globalEventIndex);
                                
                                // Calculate CORRECT lock state for this event (not from old button state)
                                const isLocked = filtersOn && event && shouldEventBeLocked(event, activeFilters);
                                
                                btn.dataset.pageTurnToken = waveToken;
                                btn.dataset.locked = isLocked ? 'true' : 'false';
                                
                                // Set initial disabled state for animation (will be updated in updateSingleButtonContent)
                                if (isLocked) {
                                    btn.disabled = true;
                                    btn.setAttribute('disabled', '');
                                    btn.style.pointerEvents = 'none';
                                } else {
                                    btn.disabled = false;
                                    btn.removeAttribute('disabled');
                                    btn.style.pointerEvents = 'auto';
                                }
                                
                                // Staggered start for each button
                                const delay = i * STAGGER_MS;
                                
                                // Step 1: Shrink out with CORRECT lock state
                                const shrinkAnim = btn.animate(
                                    thumbPageTurnShrinkKeyframes(isThumbsDesktop, isLocked),
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
                                    
                                    // RECALCULATE lock state AFTER content update (button now has new dataset.locked)
                                    const newLocked = btn.dataset.locked === 'true';
                                    
                                    // ENSURE click handler is set with correct index (redundancy for safety)
                                    setupClickHandler(btn, globalEventIndex);
                                    
                                    // Step 2: Grow in (new content) with CORRECT lock state
                                    const growAnim = btn.animate(
                                        thumbPageTurnGrowKeyframes(isThumbsDesktop, newLocked),
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
                                        // Final safety: ensure click handler is still set correctly
                                        if (!btn.onclick || btn.dataset.eventIndex !== String(globalEventIndex)) {
                                            setupClickHandler(btn, globalEventIndex);
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
                            
                            // Check filter lock state (like wireNumberButtons does)
                            const activeFilters = window.standaloneActiveFilters || new Set();
                            const filtersOn = activeFilters.size > 0;
                            const isLocked = filtersOn && shouldEventBeLocked(event, activeFilters);
                            
                            // Explicitly handle disabled state (property AND attribute)
                            if (isLocked) {
                                btn.disabled = true;
                                btn.setAttribute('disabled', '');
                                btn.style.pointerEvents = 'none';
                                btn.style.setProperty('opacity', '0.5', 'important');
                                btn.style.setProperty('filter', 'none', 'important');
                            } else {
                                btn.disabled = false;
                                btn.removeAttribute('disabled');
                                btn.style.pointerEvents = 'auto';
                                btn.style.setProperty('opacity', '1', 'important');
                                btn.style.setProperty('filter', 'none', 'important');
                            }
                            btn.classList.toggle('locked', isLocked);
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
                                console.log(`[VISUAL] Event ${globalEventIndex}: isLocked=${isLocked}, opacity='${btn.style.opacity}', disabled=${btn.disabled}, classList=${btn.classList.value}`);
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
                            // Use same logic as eventRootSlotMissingDescription
                            const d = displayEvent.description;
                            let hasDescription = false;
                            if (d) {
                                const textContent = d.replace(/<[^>]*>/g, '').trim();
                                if (textContent !== 'No description available.' && textContent !== 'No description available' && textContent.length > 0) {
                                    hasDescription = true;
                                }
                            }
                            btn.classList.toggle('event-number-btn--unfinished', !hasDescription);
                            btn.title = hasDescription ? plainName : `${plainName} — Unfinished: missing description`;
                            
                            // Get image (dock thumbs always use main timeline event art)
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
                                console.log('[DEBUG Click updateSingleButtonContent] Clicked, globalEventIndex:', globalEventIndex, 'event name:', event.name);
                                if (e.target.closest('.event-number-btn__variant-badge')) {
                                    console.log('[DEBUG Click] Variant badge clicked, ignoring');
                                    return;
                                }
                                if (window.standaloneEventSlide) {
                                    console.log('[DEBUG Click] Opening event via standaloneEventSlide');
                                    window.standaloneEventSlide.showEvent(globalEventIndex);
                                    window.SoundEffectsManager?.play?.('eventClick');
                                } else {
                                    console.log('[DEBUG Click] standaloneEventSlide not available!');
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
                                    
                                    // Play switch event sound (same as event manager)
                                    if (window.SoundEffectsManager?.play) {
                                        window.SoundEffectsManager.play('switchEvent');
                                    }
                                    
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
                            
                            // Hover effects - show preview badge and trigger marker hover
                            btn.onmouseenter = () => {
                                // Show preview badge
                                if (window.SummaryInfoBadge?.show && event) {
                                    const hoverLines = window.SummaryInfoBadge.getHoverPreviewLines 
                                        ? window.SummaryInfoBadge.getHoverPreviewLines(event)
                                        : { eraName: displayEvent.eraName || '', primaryRowFlag: null, otherRowFlags: [], yearLine: displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `–${displayEvent.yearEnd}` : ''}` : '' };
                                    
                                    const variants = isMultiEvent ? event.variants : [];
                                    const otherVariants = variants.slice(1);
                                    
                                    window.SummaryInfoBadge.show(
                                        globalEventIndex + 1,
                                        plainName,
                                        otherVariants.map(v => v.name || ''),
                                        hoverLines.eraName || displayEvent.eraName || '',
                                        hoverLines.primaryRowFlag || null,
                                        hoverLines.otherRowFlags || [],
                                        hoverLines.yearLine || (displayEvent.yearStart ? `${displayEvent.yearStart}${displayEvent.yearEnd ? `–${displayEvent.yearEnd}` : ''}` : '')
                                    );
                                }

                                // Trigger marker hover effect based on view mode
                                const sceneModel = window.globeController?.sceneModel;
                                const isMapView = sceneModel?.getMapViewEnabled?.() || !!sceneModel?.isMapView;

                                if (isMapView) {
                                    // Map view: find DOM marker and set hover
                                    // Force cycle to this event if it's in an overlap group
                                    let marker = findMarkerForEvent(event, globalEventIndex);
                                    let markerBtn = marker?.__domMarkerButton;
                                    
                                    if (window.globeController?.map2dLite) {
                                        const targetMarker = window.globeController.map2dLite.forceCycleToEvent(event);
                                        if (targetMarker) {
                                            marker = targetMarker; // Use the switched marker
                                            markerBtn = targetMarker.btn; // Use the button from the switched marker
                                        }
                                        window.globeController.map2dLite.pauseOverlapCycling();
                                    }
                                    
                                    if (markerBtn) {
                                        const ms = window.globeController?.interactionController?.markerService;
                                        ms?.setDomLiteMarkerHover?.(marker);
                                        // Play radiate sound effect and start continuous loop
                                        if (window.SoundEffectsManager?.play) {
                                            window.SoundEffectsManager.play('radiate');
                                            // Clear any existing sound loop
                                            if (_thumbnailHoverSoundInterval) {
                                                clearInterval(_thumbnailHoverSoundInterval);
                                            }
                                            // Start continuous sound loop (every 1.2s matches wave animation)
                                            _thumbnailHoverSoundInterval = setInterval(() => {
                                                if (window.SoundEffectsManager?.play) {
                                                    window.SoundEffectsManager.play('radiate');
                                                }
                                            }, 1200);
                                        }
                                        // Add hover class to DOM marker button to trigger wave animation
                                        markerBtn.classList.add('map-2d-lite__marker--synthetic-hover');
                                    }
                                    // Center map on marker
                                    if (event.lat != null && event.lon != null) {
                                        window.globeController?.map2dLite?.flyToLatLon?.(event.lat, event.lon);
                                    }
                                } else {
                                    // Globe view: use WebGL marker with pulse
                                    let marker = findMarkerForEvent(event, globalEventIndex);
                                    if (marker) {
                                        // Force cycle to this event if it's in an overlap group
                                        if (window.globeEventMarkerManager) {
                                            const targetMarker = window.globeEventMarkerManager.forceCycleToEvent(event);
                                            if (targetMarker) {
                                                marker = targetMarker; // Use the switched marker
                                            }
                                            window.globeEventMarkerManager.pauseOverlapCycling();
                                        }
                                        
                                        const ic = window.globeController?.interactionController;
                                        if (ic?.pulseService) {
                                            ic.pulseService.setHoveredMarker(marker); // Glow effect
                                            ic.startEventMarkerPulse(marker); // Pulse rings
                                        }
                                        // Center camera on marker
                                        centerCameraOnMarker(marker);
                                    }
                                }
                            };

                            btn.onmouseleave = () => {
                                if (window.SummaryInfoBadge?.hide) {
                                    window.SummaryInfoBadge.hide();
                                }

                                // Clear marker hover effect based on view mode
                                const sceneModel = window.globeController?.sceneModel;
                                const isMapView = sceneModel?.getMapViewEnabled?.() || !!sceneModel?.isMapView;

                                if (isMapView) {
                                    // Map view: clear DOM-lite hover and reset to default view
                                    const ms = window.globeController?.interactionController?.markerService;
                                    ms?.setDomLiteMarkerHover?.(null);
                                    // Remove hover class from DOM marker button
                                    // Need to find the correct button for overlap groups
                                    const marker = findMarkerForEvent(event, globalEventIndex);
                                    let markerBtn = marker?.__domMarkerButton;
                                    
                                    // For overlap groups, find the currently visible marker's button
                                    if (window.globeController?.map2dLite && !markerBtn) {
                                        const group = window.globeController.map2dLite.overlapGroups.find(g => 
                                            g.markers.some(m => {
                                                const markerEvent = m.stub.userData.event;
                                                if (!markerEvent) return false;
                                                return markerEvent.name === event.name &&
                                                       markerEvent.lat === event.lat &&
                                                       markerEvent.lon === event.lon;
                                            })
                                        );
                                        if (group) {
                                            const visibleMarker = group.markers[group.currentIndex];
                                            if (visibleMarker) {
                                                markerBtn = visibleMarker.btn;
                                            }
                                        }
                                    }
                                    
                                    if (markerBtn) {
                                        markerBtn.classList.remove('map-2d-lite__marker--synthetic-hover');
                                    }
                                    // Clear continuous sound loop
                                    if (_thumbnailHoverSoundInterval) {
                                        clearInterval(_thumbnailHoverSoundInterval);
                                        _thumbnailHoverSoundInterval = null;
                                    }
                                    window.globeController?.map2dLite?.resetView?.();
                                    // Resume overlap cycling
                                    window.globeController?.map2dLite?.resumeOverlapCycling?.();
                                } else {
                                    // Globe view: clear WebGL pulse effects and restore camera
                                    const ic = window.globeController?.interactionController;
                                    if (ic?.pulseService) {
                                        const hoveredMarker = ic.pulseService.getHoveredMarker();
                                        if (hoveredMarker) {
                                            ic.stopEventMarkerPulse(hoveredMarker);
                                            ic.pulseService.setHoveredMarker(null);
                                        }
                                    }
                                    restoreCameraFromThumbnailHover();
                                    // Resume overlap cycling
                                    window.globeEventMarkerManager?.resumeOverlapCycling?.();
                                }
                            };
                        },
                        
                        toggleImageOverlay(imagePath) {
                            console.log('[DEBUG uiView/globe toggleImageOverlay] FUNCTION ENTRY - called, overlay open:', document.getElementById('eventImageOverlay')?.classList.contains('open'), 'imagePath:', imagePath);
                            const overlay = document.getElementById('eventImageOverlay');
                            const toggleBtn = document.getElementById('eventImageToggle');
                            if (!overlay) {
                                console.error('[DEBUG uiView/globe toggleImageOverlay] Early return: no overlay');
                                return;
                            }
                            
                            // Play sound effect
                            if (window.SoundEffectsManager) {
                                window.SoundEffectsManager.play('imageDisplay');
                            }
                            
                            if (overlay.classList.contains('open')) {
                                console.log('[DEBUG uiView/globe toggleImageOverlay] Hiding image');
                                this.hideImageOverlay();
                                if (toggleBtn) toggleBtn.textContent = 'Show Image';
                                // Sync with global toggle state
                                localStorage.setItem('globalImageToggle', 'false');
                                if (window.standaloneEventSlide?.updateGlobalToggleButtonLabel) {
                                    window.standaloneEventSlide.updateGlobalToggleButtonLabel(false);
                                }
                            } else if (imagePath) {
                                console.log('[DEBUG uiView/globe toggleImageOverlay] Showing image with path:', imagePath);
                                this.showImageOverlay(imagePath);
                                if (toggleBtn) toggleBtn.textContent = 'Hide Image';
                                // Sync with global toggle state
                                localStorage.setItem('globalImageToggle', 'true');
                                if (window.standaloneEventSlide?.updateGlobalToggleButtonLabel) {
                                    window.standaloneEventSlide.updateGlobalToggleButtonLabel(true);
                                }
                            } else {
                                console.error('[DEBUG uiView/globe toggleImageOverlay] No imagePath provided and overlay not open');
                            }
                        },
                        
                        showImageOverlay(imagePath) {
                            const overlay = document.getElementById('eventImageOverlay');
                            const img = document.getElementById('eventImage');
                            const eventSlide = document.getElementById('eventSlide');
                            const toggleBtn = document.getElementById('eventImageToggle');
                            
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
                                
                                // Update button text
                                if (toggleBtn) toggleBtn.textContent = 'Hide Image';
                                
                                // On mobile, remove full-screen class from event slide when showing image
                                const isMobile = window.innerWidth <= 768;
                                if (isMobile && eventSlide) {
                                    eventSlide.classList.remove('full-screen');
                                }
                                
                                // Setup click-to-hide handler if not already set (desktop only)
                                if (!overlay.dataset.clickHandlerSet) {
                                    overlay.dataset.clickHandlerSet = 'true';
                                    overlay.addEventListener('click', (e) => {
                                        // Don't hide on mobile
                                        const isMobile = window.innerWidth <= 768;
                                        if (isMobile) return;
                                        
                                        if (e.target === overlay || e.target.tagName === 'IMG') {
                                            e.stopPropagation();
                                            this.hideImageOverlayTemporarily(5000);
                                        }
                                    });
                                }
                            }
                        },
                        
                        hideImageOverlayTemporarily(delayMs = 5000) {
                            console.log('[DEBUG standalone hideImageOverlayTemporarily] Called');
                            const overlay = document.getElementById('eventImageOverlay');
                            if (!overlay || !overlay.classList.contains('open')) {
                                console.log('[DEBUG standalone hideImageOverlayTemporarily] Early return - overlay not open');
                                return;
                            }
                            
                            // Save the current image path before hiding
                            const img = document.getElementById('eventImage');
                            const savedImagePath = img?.src || this.currentImagePath;
                            
                            console.log('[DEBUG standalone hideImageOverlayTemporarily] Calling hideImageOverlayGradually');
                            // Hide with gradual fade
                            this.hideImageOverlayGradually(600);
                            
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
                                    // Only restore if event slide is still open and we have a saved path
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
                            
                            // Setup click handler for temporary hide if not already set
                            if (!overlay.dataset.clickHandlerSetup) {
                                overlay.dataset.clickHandlerSetup = 'true';
                                overlay.addEventListener('click', (e) => {
                                    // Only hide if clicking the image itself or overlay (not other controls)
                                    if (e.target === overlay || e.target.tagName === 'IMG') {
                                        e.stopPropagation();
                                        console.log('[IMAGE CLICK] Click detected, hiding temporarily for 5 seconds');
                                        this.hideImageOverlayTemporarily(5000);
                                    }
                                });
                            }
                            
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
                        
                        hideImageOverlayGradually(durationMs = 600) {
                            const overlay = document.getElementById('eventImageOverlay');
                            const img = document.getElementById('eventImage');
                            const toggleBtn = document.getElementById('eventImageToggle');
                            
                            if (!overlay) return;
                            
                            // Disable pointer events immediately
                            overlay.style.setProperty('pointer-events', 'none');
                            
                            // Gradual fade-out
                            const startTime = Date.now();
                            const fadeInterval = 50; // Update every 50ms
                            
                            console.log(`[IMAGE HIDE] Starting gradual fade-out over ${durationMs}ms...`);
                            
                            const fadeTimer = setInterval(() => {
                                const elapsed = Date.now() - startTime;
                                const progress = Math.min(elapsed / durationMs, 1);
                                // Ease-out curve for smooth disappearance
                                const eased = 1 - (1 - progress) * (1 - progress); // Quadratic ease-out
                                const opacity = 1 - eased;
                                
                                overlay.style.opacity = String(opacity);
                                if (img) {
                                    img.style.opacity = String(opacity);
                                }
                                
                                // Log progress at 25%, 50%, 75%, 100%
                                if (progress >= 0.25 && progress < 0.30) console.log('[IMAGE HIDE] Fade 25%...');
                                if (progress >= 0.50 && progress < 0.55) console.log('[IMAGE HIDE] Fade 50%...');
                                if (progress >= 0.75 && progress < 0.80) console.log('[IMAGE HIDE] Fade 75%...');
                                
                                if (progress >= 1) {
                                    clearInterval(fadeTimer);
                                    overlay.style.opacity = '0';
                                    overlay.classList.remove('open', 'slide-open', 'fade-in');
                                    overlay.style.display = 'none';
                                    if (img) {
                                        img.style.opacity = '0';
                                        img.style.display = 'none';
                                        img.src = '';
                                    }
                                    if (toggleBtn) toggleBtn.textContent = 'Show Image';
                                    console.log('[IMAGE HIDE] Fade 100% - Image fully hidden!');
                                }
                            }, fadeInterval);
                        },
                        
                        hideImageOverlay() {
                            const overlay = document.getElementById('eventImageOverlay');
                            const eventSlide = document.getElementById('eventSlide');
                            const toggleBtn = document.getElementById('eventImageToggle');
                            if (overlay) {
                                overlay.classList.remove('open');
                                // Only remove slide-open if event slide is closed
                                if (!eventSlide?.classList.contains('open')) {
                                    overlay.classList.remove('slide-open');
                                }
                                overlay.style.display = 'none';
                                overlay.style.opacity = '0';
                            }
                            
                            const img = document.getElementById('eventImage');
                            if (img) {
                                img.classList.remove('fade-in', 'fade-out');
                                img.style.display = 'none';
                                img.style.opacity = '0';
                            }
                            
                            // Update button text
                            if (toggleBtn) toggleBtn.textContent = 'Show Image';
                            
                            // On mobile, add full-screen class to event slide when hiding image
                            const isMobile = window.innerWidth <= 768;
                            if (isMobile && eventSlide?.classList.contains('open')) {
                                eventSlide.classList.add('full-screen');
                                console.log('[hideImageOverlay] Added full-screen class to event slide on mobile');
                                console.log('[hideImageOverlay] eventSlide classes:', eventSlide.className);
                                console.log('[hideImageOverlay] eventSlide computed top:', window.getComputedStyle(eventSlide).top);
                            }
                        },
                    };

                    const backBtnInit = document.getElementById('eventSlideBack');
                    if (backBtnInit && !backBtnInit.dataset.slideNavBound) {
                        backBtnInit.dataset.slideNavBound = '1';
                        backBtnInit.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.standaloneEventSlide?.goBackSlide) {
                                await window.standaloneEventSlide.goBackSlide();
                            }
                        });
                    }
                    
                    // Wire up Event Manager list clicks (index is into the *active* archive list, not the dock timeline)
                    window.eventManager.openEventFromList = function(event, index) {
                        if (window.standaloneEventSlide) {
                            const list = window.eventManager?.events || [];
                            let idx = typeof index === 'number' ? index : list.indexOf(event);
                            if (idx < 0 || idx >= list.length) idx = list.indexOf(event);
                            if (idx < 0 || idx >= list.length) return;
                            window.standaloneEventSlide.showEvent(idx, { eventList: list });
                            if (window.SoundEffectsManager?.play) {
                                window.SoundEffectsManager.play('eventClick');
                            }
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
                updateStatus('✓ News ticker loaded - click again to unload', 'success');
            } catch (error) {
                console.error('Error loading news ticker:', error);
                updateStatus(`✗ Error: ${error.message}`, 'error');
            }
        } else {
            // UNLOAD
            updateStatus('Unloading news ticker...', 'info');
            teardownMenuHelpersEventSystemLayout();

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
            if (eventSlide) {
                eventSlide.classList.remove('open');
            }

            // Hide image overlay if open
            const eventImageOverlay = document.getElementById('eventImageOverlay');
            if (eventImageOverlay) {
                eventImageOverlay.classList.remove('open');
            }

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
            // Clear eventNumberButtons content to prevent duplicate thumbnails
            const eventNumberButtons = document.getElementById('eventNumberButtons');
            if (eventNumberButtons) {
                eventNumberButtons.innerHTML = '';
            }

            document.getElementById('globalImageToggle')?.remove();
            document.querySelectorAll('.page-input-container').forEach((el) => el.remove());
            ensureDockGlobeRailCenterRestored();

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
            if (window.FilterService?.reset) {
                window.FilterService.reset();
            }

            // Remove filters toggle button
            const filtersToggle = document.getElementById('filtersToggle');
            if (filtersToggle) {
                filtersToggle.remove();
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
            updateStatus('✓ News ticker unloaded', 'success');
        }
    });
    menuButtons.appendChild(testBtn);

    return menuButtons;
}

/**
 * Gets or creates the test container
 * @returns {HTMLElement} - The test container
 */
export function getOrCreateTestContainer() {
    let testContainer = document.querySelector('.test-container');
    if (!testContainer) {
        updateStatus('Creating test container...', 'info');
        testContainer = document.createElement('div');
        testContainer.className = 'test-container';
        testContainer.id = 'testContainer';
        document.getElementById('content').appendChild(testContainer);
        updateStatus('✓ Test container created', 'success');
    }
    return testContainer;
}

// Make updateStandalonePaginationForFilters available globally
if (typeof window !== 'undefined') {
    window.updateStandalonePaginationForFilters = updateStandalonePaginationForFilters;
}
