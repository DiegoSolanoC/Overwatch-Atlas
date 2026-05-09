/**
 * ComponentDOMHelpers - DOM element creation utilities for components
 * Extracted from component-loader.js to reduce duplication
 */

import { updateStatus } from '../managers/StatusManager.js';
import { getEventThumbNumberButtonsHtml } from '../../system-interface/managers/helpers/PaginationThumbMarkup.js';
import {
    applyPaginationDockViewportMode,
    initPaginationDockCollapse,
} from '../../system-interface/utils/PaginationDockCollapse.js';

/**
 * Creates or returns existing element by ID
 * @param {string} id - Element ID
 * @param {Function} createFn - Function to create element if it doesn't exist
 * @param {string} elementName - Name for status messages
 * @returns {HTMLElement|null}
 */
export function getOrCreateElement(id, createFn, elementName = null) {
    const existing = document.getElementById(id);
    if (existing) {
        return existing;
    }
    
    const element = createFn();
    if (elementName) {
        updateStatus(`✓ ${elementName} added`, 'success');
    }
    return element;
}

/**
 * Creates the music panel HTML structure
 * @returns {HTMLElement} - The created music panel
 */
export function createMusicPanel() {
    const panel = document.createElement('div');
    panel.id = 'musicPanel';
    panel.className = 'music-panel';
    panel.innerHTML = `
        <div class="music-panel-close" id="musicPanelClose">&times;</div>
        <div class="music-panel-content">
            <div class="music-actions">
                <h2 class="music-title">Music Options</h2>
                <div class="music-actions-buttons"></div>
            </div>
            <div class="music-controls-section music-controls-section--playback">
                <h3 class="music-controls-section-title">Now playing</h3>
                <div class="music-now-playing" id="musicNowPlaying">
                <div class="music-current-song-row">
                    <img class="music-playing-disc" src="src/assets/images/Icons/Music%20Icons/Playing%20Icon.png" alt="" width="32" height="32" decoding="async" />
                    <div class="music-current-song" id="musicCurrentSong">Loading...</div>
                </div>
                <div class="music-progress-container">
                    <input type="range" id="musicProgressBar" class="music-progress-bar" min="0" max="100" value="0">
                    <div class="music-time-display">
                        <span id="musicCurrentTime">0:00</span> <span id="musicTotalTime">0:00</span>
                    </div>
                    <div class="music-control-buttons">
                        <button id="pauseBtn" class="music-control-btn">
                            <img id="pauseBtnIcon" src="src/assets/images/Icons/Music%20Icons/Pause%20Icon.png" alt="Pause" class="control-icon">
                        </button>
                        <button id="skipBtn" class="music-control-btn">
                            <img id="skipBtnIcon" src="src/assets/images/Icons/Music%20Icons/Skip%20Icon.png" alt="Skip" class="control-icon">
                        </button>
                        <button id="muteBtn" class="music-control-btn">
                            <img id="muteBtnIcon" src="src/assets/images/Icons/Music%20Icons/Unmuted%20Icon.png" alt="Mute" class="control-icon">
                        </button>
                        <button id="loopBtn" type="button" class="music-control-btn" aria-label="Loop current track">
                            <img id="loopBtnIcon" src="src/assets/images/Icons/Music%20Icons/Loop%20Icon.png" alt="Loop" class="control-icon">
                        </button>
                        <button id="shuffleBtn" class="music-control-btn">
                            <img id="shuffleBtnIcon" src="src/assets/images/Icons/Music%20Icons/Shuffle%20Icon.png" alt="Shuffle" class="control-icon">
                        </button>
                    </div>
                </div>
                </div>
            </div>
            <div class="music-controls-section music-controls-section--volume">
                <h3 class="music-controls-section-title">Volume</h3>
                <div class="music-controls-section-inner">
                    <div class="music-control-row">
                        <label for="volumeSlider">Music Volume:</label>
                        <input type="range" id="volumeSlider" class="volume-slider" min="0" max="100" value="10">
                        <span id="volumeValue" class="volume-value">10%</span>
                    </div>
                    <div class="music-control-row">
                        <label for="soundEffectsSlider">Sound Effects Volume:</label>
                        <input type="range" id="soundEffectsSlider" class="volume-slider" min="0" max="100" value="50">
                        <span id="soundEffectsVolumeValue" class="volume-value">50%</span>
                    </div>
                </div>
            </div>
            <div class="music-grid" id="musicGrid"></div>
        </div>
    `;
    document.body.appendChild(panel);
    return panel;
}

/**
 * Creates the filters panel HTML structure
 * @returns {HTMLElement} - The created filters panel
 */
export function createFiltersPanel() {
    const panel = document.createElement('div');
    panel.id = 'filtersPanel';
    panel.className = 'filters-panel';
    panel.innerHTML = `
        <div class="filters-panel-close" id="filtersPanelClose">&times;</div>
        <div class="filters-panel-content">
            <div class="filters-actions">
                <h2 class="filters-title">Filters</h2>
                <div class="filters-toolbar">
                    <div class="filters-tabs" role="tablist">
                        <button type="button" id="heroesTab" class="filter-tab active" role="tab" aria-selected="true">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">Heroes</span>
                                <span class="filter-count" id="heroesCount">0</span>
                            </span>
                        </button>
                        <button type="button" id="factionsTab" class="filter-tab" role="tab" aria-selected="false">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">Factions</span>
                                <span class="filter-count" id="factionsCount">0</span>
                            </span>
                        </button>
                        <button type="button" id="npcsTab" class="filter-tab" role="tab" aria-selected="false">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">NPCs</span>
                                <span class="filter-count" id="npcsCount">0</span>
                            </span>
                        </button>
                        <button type="button" id="countriesTab" class="filter-tab" role="tab" aria-selected="false">
                            <span class="filter-tab-graphic">
                                <img class="filter-tab-icon" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="40" height="40" decoding="async" />
                            </span>
                            <span class="filter-tab-footer">
                                <span class="filter-tab-label">Country</span>
                                <span class="filter-count" id="countriesCount">0</span>
                            </span>
                        </button>
                    </div>
                    <div class="filters-search-wrap">
                        <label for="filtersMenuSearch" class="filters-search-label">Search current category</label>
                        <input
                            type="text"
                            id="filtersMenuSearch"
                            class="filters-search-input"
                            placeholder="Search heroes..."
                            autocomplete="off"
                            spellcheck="false"
                        />
                    </div>
                    <div class="filters-actions-buttons">
                        <button type="button" id="clearFiltersBtn" class="filters-action-btn">
                            <img class="filters-action-btn__icon" src="src/assets/images/Icons/Filter%20Icons/Clear%20Filter%20Icon.png" alt="" width="22" height="22" decoding="async" />
                            <span class="filters-action-btn__label">Clear</span>
                        </button>
                        <button type="button" id="confirmFiltersBtn" class="filters-action-btn filters-confirm-btn">
                            <img class="filters-action-btn__icon" src="src/assets/images/Icons/Filter%20Icons/Confirm%20Filter%20Icon.png" alt="" width="22" height="22" decoding="async" />
                            <span class="filters-action-btn__label">Confirm</span>
                        </button>
                    </div>
                </div>
            </div>
            <div class="filters-grid" id="filtersGrid"></div>
        </div>
    `;
    // Append to layout-container instead of body for flexbox layout
    const layoutContainer = document.querySelector('.layout-container');
    if (layoutContainer) {
        layoutContainer.appendChild(panel);
    } else {
        document.body.appendChild(panel);
    }
    return panel;
}

/**
 * Creates the event pagination HTML structure
 * @returns {HTMLElement} - The created pagination element
 */
export function createEventPagination() {
    // Check if pagination already exists
    if (document.getElementById('eventPagination')) {
        return document.getElementById('eventPagination');
    }

    // Also check if pagination buttons already exist (they may have been moved to dock rails)
    const existingButtons = ['prevPageBtn', 'prevEventBtn', 'nextEventBtn', 'nextPageBtn'].filter(
        id => document.getElementById(id)
    );
    if (existingButtons.length > 0) {
        const existingPagination = document.getElementById('eventPagination');
        if (existingPagination) {
            return existingPagination;
        }
        // Orphan nav buttons (e.g. after a partial unload): remove so we can mount a fresh #eventPagination.
        existingButtons.forEach((id) => document.getElementById(id)?.remove());
    }

    const pagination = document.createElement('div');
    pagination.id = 'eventPagination';
    pagination.className = 'event-pagination';
    pagination.innerHTML = `
        <div class="event-page-slider-row event-page-slider-row--desktop-only">
            <div class="event-page-slider-wrap">
                <div class="event-page-slider-ticks" id="eventPageSliderTicks" aria-hidden="true"></div>
                <input type="range" id="eventPageSlider" class="event-page-slider" min="0" max="10000" value="0" step="1"
                    title="Scrub pages" aria-label="Pages along timeline" aria-valuemin="0" aria-valuemax="10000" aria-valuenow="0" />
                <div class="event-page-slider-era-strip" id="eventPageSliderEraStrip" aria-hidden="true"></div>
            </div>
        </div>
        <div class="event-pagination-thumb-row">
            <button type="button" id="prevPageBtn" class="globe-control-btn dock-globe-rail__btn" title="Previous Page" aria-label="Previous page"><span id="prevPageBtnIcon"><img src="src/assets/images/Icons/Utility%20Icons/Double%20Arrow.png" alt="" decoding="async" style="width: 100%; height: 100%; object-fit: contain;" /></span></button>
            <button type="button" id="prevEventBtn" class="globe-control-btn dock-globe-rail__btn" title="Previous Event" aria-label="Previous event"><span id="prevEventBtnIcon"><img src="src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png" alt="" decoding="async" style="width: 100%; height: 100%; object-fit: contain;" /></span></button>
            <div class="event-number-buttons event-number-buttons--thumbs-desktop" id="eventNumberButtons">${getEventThumbNumberButtonsHtml()}</div>
            <button type="button" id="nextEventBtn" class="globe-control-btn dock-globe-rail__btn" title="Next Event" aria-label="Next event"><span id="nextEventBtnIcon" class="icon-flip-h"><img src="src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png" alt="" decoding="async" style="width: 100%; height: 100%; object-fit: contain;" /></span></button>
            <button type="button" id="nextPageBtn" class="globe-control-btn dock-globe-rail__btn" title="Next Page" aria-label="Next page"><span id="nextPageBtnIcon" class="icon-flip-h"><img src="src/assets/images/Icons/Utility%20Icons/Double%20Arrow.png" alt="" decoding="async" style="width: 100%; height: 100%; object-fit: contain;" /></span></button>
        </div>
        <div class="page-controls-row page-controls-row--page-only page-controls-row--mobile-only">
            <div class="page-input-container">
                <span class="page-label">Page</span>
                <input type="number" id="pageInput" class="page-input" min="1" value="1" title="Enter page number">
            </div>
        </div>
    `;
    
    // Dock below .layout-container for all viewports; mobile keeps dock visually collapsed (see PaginationDockCollapse).
    const DOCK_COLLAPSE_STRIP_HTML = `
        <div class="pagination-dock-collapse-bar" id="paginationDockCollapseBar">
            <button type="button" id="paginationDockCollapseBtn" class="pagination-dock-collapse-handle"
                aria-expanded="true" aria-controls="eventNumberButtons"
                title="Collapse thumbnail strip" aria-label="Collapse thumbnail strip">
                <span class="pagination-dock-collapse-pill" aria-hidden="true">
                    <img class="ui-pagination-arrow ui-pagination-arrow--dock-collapse" src="src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png" alt="" width="22" height="22" decoding="async" />
                </span>
            </button>
        </div>`;

    const setupPaginationPlacement = () => {
        // Prevent creating duplicate dock elements if already exists
        if (document.getElementById('paginationDock') && document.getElementById('paginationDockCollapseStrip')) {
            return;
        }

        let dock = document.getElementById('paginationDock');

        if (!dock) {
            dock = document.createElement('div');
            dock.id = 'paginationDock';
            dock.className = 'pagination-dock';
            const layoutContainer = document.querySelector('.layout-container');
            const footer = document.querySelector('footer');
            if (layoutContainer && layoutContainer.parentNode) {
                if (footer) {
                    layoutContainer.parentNode.insertBefore(dock, footer);
                } else {
                    layoutContainer.parentNode.insertBefore(dock, layoutContainer.nextSibling);
                }
            }
        }

        const layoutContainer = document.querySelector('.layout-container');
        let strip = document.getElementById('paginationDockCollapseStrip');
        if (layoutContainer && layoutContainer.parentNode && dock.parentNode === layoutContainer.parentNode) {
            if (!strip) {
                strip = document.createElement('div');
                strip.id = 'paginationDockCollapseStrip';
                strip.className = 'pagination-dock-collapse-strip';
                strip.innerHTML = DOCK_COLLAPSE_STRIP_HTML;
                layoutContainer.parentNode.insertBefore(strip, dock);
            } else if (strip.nextSibling !== dock) {
                layoutContainer.parentNode.insertBefore(strip, dock);
            }
        }

        if (!dock.querySelector('.pagination-dock-pattern')) {
            const patternOverlay = document.createElement('div');
            patternOverlay.className = 'pagination-dock-pattern';
            dock.insertBefore(patternOverlay, dock.firstChild);
        }

        const DOCK_BORDER_SRC = 'src/assets/images/Misc/UI/Dock%20Border.png';

        if (pagination.parentNode !== dock) {
            dock.appendChild(pagination);
        }
        pagination.style.removeProperty('position');
        pagination.style.removeProperty('bottom');
        pagination.style.removeProperty('left');
        pagination.style.removeProperty('right');
        pagination.style.removeProperty('transform');
        pagination.style.removeProperty('top');

        /* Fill only (under rail); white outline is a separate sibling SVG above the rail (see TRAPEZOID_BORDER_SVG). */
        /* Top y=3 matches border path; y=0 caused colored fill above the white outline. */
        const TRAPEZOID_FILL_SVG = `<svg class="pagination-dock-top-trapezoid__svg" xmlns="http://www.w3.org/2000/svg" data-dock-trap-v="10" viewBox="-12 -12 124 124" preserveAspectRatio="none" overflow="visible" focusable="false" aria-hidden="true">
<polygon class="pagination-dock-top-trapezoid__fill" points="2,3 98,3 112,100 -12,100" />
</svg>`;
        const TRAPEZOID_BORDER_SVG = `<svg class="pagination-dock-top-trapezoid__border-svg" xmlns="http://www.w3.org/2000/svg" data-dock-trap-border-v="2" viewBox="-12 -12 124 124" preserveAspectRatio="none" overflow="visible" focusable="false" aria-hidden="true">
<path d="M -12,100 Q -5,52 2,3 L 98,3 Q 105,52 112,100" fill="none" stroke="#ffffff" stroke-width="8" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round" />
</svg>`;

        let capRow = dock.querySelector('.pagination-dock-top-cap-row');
        if (!capRow) {
            capRow = document.createElement('div');
            capRow.className = 'pagination-dock-top-cap-row';

            const leftSide = document.createElement('div');
            leftSide.className =
                'pagination-dock-top-border-side pagination-dock-top-border-side--left';
            leftSide.setAttribute('aria-hidden', 'true');
            const imgL = document.createElement('img');
            imgL.className = 'pagination-dock-top-border-img';
            imgL.src = DOCK_BORDER_SRC;
            imgL.alt = '';
            imgL.decoding = 'async';
            leftSide.appendChild(imgL);

            const trapEl = document.createElement('div');
            trapEl.className = 'pagination-dock-top-trapezoid';

            const rightSide = document.createElement('div');
            rightSide.className =
                'pagination-dock-top-border-side pagination-dock-top-border-side--right';
            rightSide.setAttribute('aria-hidden', 'true');
            const imgR = document.createElement('img');
            imgR.className = 'pagination-dock-top-border-img';
            imgR.src = DOCK_BORDER_SRC;
            imgR.alt = '';
            imgR.decoding = 'async';
            rightSide.appendChild(imgR);

            capRow.append(leftSide, trapEl, rightSide);
        }

        if (pagination.parentNode === dock) {
            dock.insertBefore(capRow, pagination);
        } else {
            dock.appendChild(capRow);
        }

        const legacyWrap = dock.querySelector(':scope > .pagination-dock-top-border-wrap');
        if (legacyWrap) {
            const imgs = Array.from(legacyWrap.querySelectorAll('.pagination-dock-top-border-img'));
            const leftSide = capRow.querySelector('.pagination-dock-top-border-side--left');
            const rightSide = capRow.querySelector('.pagination-dock-top-border-side--right');
            if (imgs[0] && leftSide) leftSide.replaceChildren(imgs[0]);
            if (imgs[1] && rightSide) rightSide.replaceChildren(imgs[1]);
            legacyWrap.remove();
        }

        const orphanTrap = dock.querySelector(':scope > .pagination-dock-top-trapezoid');
        if (orphanTrap && orphanTrap.parentElement !== capRow) {
            const mid = capRow.querySelector('.pagination-dock-top-trapezoid');
            if (mid && mid !== orphanTrap) {
                capRow.replaceChild(orphanTrap, mid);
            }
        }

        /* Cap row + trapezoid host focusable dock controls (#dockGlobeRailCenter); never aria-hide them */
        capRow.removeAttribute('aria-hidden');
        capRow.querySelector('.pagination-dock-top-border-side--left')?.setAttribute('aria-hidden', 'true');
        capRow.querySelector('.pagination-dock-top-border-side--right')?.setAttribute('aria-hidden', 'true');

        const trap = capRow.querySelector('.pagination-dock-top-trapezoid');
        trap?.removeAttribute('aria-hidden');
        if (trap) {
            trap.querySelectorAll(
                '.pagination-dock-top-trapezoid__svg[data-dock-trap-v="8"], .pagination-dock-top-trapezoid__svg[data-dock-trap-v="9"]'
            ).forEach((el) => el.remove());
            if (!trap.querySelector('.pagination-dock-top-trapezoid__svg[data-dock-trap-v="10"]')) {
                trap.insertAdjacentHTML('afterbegin', TRAPEZOID_FILL_SVG);
            }
        }
        const ensureDockGlobeRailCenter = () => {
            let el = document.getElementById('dockGlobeRailCenter');
            if (el) return el;
            el = document.createElement('div');
            el.id = 'dockGlobeRailCenter';
            el.className = 'dock-globe-rail dock-globe-rail--center';
            el.setAttribute('aria-label', 'Pagination and navigation');
            const left = document.getElementById('dockGlobeRailLeft');
            if (left?.parentNode) {
                left.parentNode.insertBefore(el, left.nextSibling);
            } else {
                document.body.appendChild(el);
            }
            return el;
        };
        const centerRailDock = ensureDockGlobeRailCenter();
        if (centerRailDock && trap && centerRailDock.parentNode !== trap) {
            trap.appendChild(centerRailDock);
        }
        trap?.querySelectorAll('.pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="1"]').forEach((el) => el.remove());
        if (trap && !trap.querySelector('.pagination-dock-top-trapezoid__border-svg[data-dock-trap-border-v="2"]')) {
            trap.insertAdjacentHTML('beforeend', TRAPEZOID_BORDER_SVG);
        }

        applyPaginationDockViewportMode();
        initPaginationDockCollapse();
    };
    
    // Initial placement (one-time, no resize listener to avoid accumulation)
    document.getElementById('content').appendChild(pagination);
    // Defer dock setup to ensure layout-container exists
    requestAnimationFrame(() => {
        setupPaginationPlacement();
        // Trigger resize so globe/map adjusts to new container size
        // Use setTimeout to ensure CSS has been applied
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 100);
    });
    
    return pagination;
}
