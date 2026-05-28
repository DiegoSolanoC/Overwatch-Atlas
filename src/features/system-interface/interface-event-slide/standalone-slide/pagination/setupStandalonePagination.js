/**
 * Extracted from the standalone-slide factory (window.standaloneEventSlide).
 * The factory's $name method delegates here so the factory file stays
 * scannable; the heavy body lives in this single-purpose file.
 *
 * The slide parameter is the standalone-slide controller (i.e. acts as
 * the original method's 	his).
 */

import {
    getDockTimelineEventsForPagination,
    isHeroBiographyDockFilterActive,
} from '../../../../hero-biography/hero-biography-mode/heroBiographyDockTimeline.js';
import { shouldEventBeLocked } from '../../../interface-globe-markers/filtering/shouldEventBeLocked.js';
import {
    updateStandaloneSliderTicks,
    eventRootSlotMissingDescription
} from '../../../interface-load-unload/pagination/standalonePaginationFilterSync.js';
import { wireStandaloneEventNavButtons } from './standalonePaginationEventNav.js';

export function runSetupStandalonePagination(slide) {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const pageInput = document.getElementById('pageInput');
        const pageSlider = document.getElementById('eventPageSlider');
        const ticksEl = document.getElementById('eventPageSliderTicks');
        
        if (!prevBtn || !nextBtn) return;
        
        const getDockEvents = () => getDockTimelineEventsForPagination();
        const eventsPerPage = 10; // Globe uses 10 events per page
        
        if (!getDockEvents().length) {
            return;
        }
        
        
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
            if (!ticksEl || totalPages < 1) return;

            ticksEl.innerHTML = '';
            const currentEvents = getDockEvents();
            const totalEvents = currentEvents.length;
            if (totalEvents <= 0) return;

            const pages = Math.max(1, totalPages);

            // Add page number labels at the start of each page segment
            for (let i = 0; i < pages; i++) {
                const label = document.createElement('span');
                label.className = 'event-page-slider-label';
                label.style.left = `${(i / pages) * 100}%`;
                label.textContent = String(i + 1);
                ticksEl.appendChild(label);
            }

            // Hide redundant "page 1" label when the whole strip is one page
            if (pages === 1) {
                const lonePageLabel = ticksEl.querySelector('.event-page-slider-label');
                if (lonePageLabel) lonePageLabel.style.display = 'none';
            }
            
            // Add major tick marks between pages
            if (pages > 1) {
                for (let i = 1; i < pages; i++) {
                    const tick = document.createElement('span');
                    tick.className = 'event-page-slider-tick event-page-slider-tick--major';
                    tick.style.left = `${(i / pages) * 100}%`;
                    ticksEl.appendChild(tick);
                }
            }
            
            // Add event number labels (1-10) for each page position
            for (let p = 0; p < pages; p++) {
                const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                for (let e = 0; e < onPage; e++) {
                    const numLabel = document.createElement('span');
                    numLabel.className = 'event-page-slider-num';
                    numLabel.dataset.eventIndex = p * eventsPerPage + e;
                    numLabel.dataset.pagePosition = e + 1; // 1-10 position
                    numLabel.style.left = `${((p + (e + 0.5) / onPage) / pages) * 100}%`;
                    numLabel.textContent = String(e + 1);
                    ticksEl.appendChild(numLabel);
                }
            }
            
            // Add event position ticks (one per event slot, centered)
            for (let p = 0; p < pages; p++) {
                const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                for (let e = 0; e < onPage; e++) {
                    const tick = document.createElement('span');
                    tick.className = 'event-page-slider-tick event-page-slider-tick--event';
                    tick.dataset.eventIndex = p * eventsPerPage + e;
                    tick.dataset.pagePosition = e + 1; // 1-10
                    // Centered on each event position
                    tick.style.left = `${((p + (e + 0.5) / onPage) / pages) * 100}%`;
                    ticksEl.appendChild(tick);
                }
            }
            
            // Add unfinished slot markers (red bars) for events missing descriptions
            for (let p = 0; p < pages; p++) {
                const onPage = Math.min(eventsPerPage, Math.max(0, totalEvents - p * eventsPerPage));
                for (let e = 0; e < onPage; e++) {
                    const g = p * eventsPerPage + e;
                    const rootEv = g >= 0 && g < totalEvents ? currentEvents[g] : null;
                    if (!eventRootSlotMissingDescription(rootEv)) continue;
                    const mark = document.createElement('span');
                    mark.className = 'event-page-slider-tick event-page-slider-tick--unfinished-slot';
                    mark.style.left = `${((p + (e + 0.5) / onPage) / pages) * 100}%`;
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
        
        // Update pagination UI. The `animate` flag is forwarded to
        // `slide.updateNumberButtons` — the initial seed call passes
        // `{ animate: false }` so the boot doesn't visibly stagger
        // thumbnails after the loading overlay drops.
        let updatePaginationUI = (options = {}) => {
            const animate = options.animate !== false;
            const currentPage = getCurrentPage();
            const totalPages = getTotalPages();
            const currentEvents = getDockEvents();
            const pageTotal = document.getElementById('pageTotal');
            
            if (pageTotal) pageTotal.textContent = `/ ${totalPages}`;
            if (pageInput) {
                pageInput.value = currentPage;
                pageInput.max = totalPages;
            }
            
            // Update slider using globe's EVENT_PAGE_SLIDER_RESOLUTION
            if (pageSlider) {
                const SLIDER_RESOLUTION = 10000;
                const slotsOnCurrentPage = Math.min(
                    eventsPerPage,
                    Math.max(0, currentEvents.length - (currentPage - 1) * eventsPerPage),
                );
                pageSlider.min = '0';
                pageSlider.max = String(SLIDER_RESOLUTION);
                // One page: still scrub across event slots on that page (hero-bio short lists).
                pageSlider.disabled = totalPages <= 1 && slotsOnCurrentPage <= 1;

                const pages = Math.max(1, totalPages);
                const pageCenter = (currentPage - 0.5) / pages;
                pageSlider.value = String(Math.round(pageCenter * SLIDER_RESOLUTION));
            }
            
            // Generate ticks and era strip
            generateSliderTicks(totalPages);
            updateEraStrip(totalPages);
            
            // Update filter-hit ticks for current filter state
            const activeFilters = isHeroBiographyDockFilterActive()
                ? new Set()
                : (window.standaloneActiveFilters || new Set());
            updateStandaloneSliderTicks(activeFilters, currentEvents, eventsPerPage, currentPage);
            
            // Update buttons
            prevBtn.disabled = totalPages <= 1;
            nextBtn.disabled = totalPages <= 1;
            
            // Update number button content with current page events
            const currentPageEvents = getEventsForPage(currentPage);
            slide.updateNumberButtons(currentPageEvents, currentPage, { animate });
            
            // Update news ticker with current page events
            if (window.newsTickerService) {
                window.newsTickerService.updateTicker(currentPageEvents);
            }
            
            // Keep thumbnails visible even when events fit on one page (hero bio filters).
            const pagination = document.getElementById('eventPagination');
            if (pagination) {
                pagination.style.display = currentEvents.length > 0 ? 'flex' : 'none';
                pagination.classList.toggle('event-pagination--single-page', totalPages <= 1);
            }

            window.dispatchEvent(
                new CustomEvent('atlas-dock-timeline-page-changed', {
                    detail: { page: currentPage },
                }),
            );
            if (typeof window.__codexApplyTimelineGateFromDock === 'function') {
                window.__codexApplyTimelineGateFromDock();
            }
        };
        
        // Helper to calculate matching events on a page
        const getMatchingEventsOnPage = (pageNum) => {
            const activeFilters = isHeroBiographyDockFilterActive()
                ? new Set()
                : (window.standaloneActiveFilters || new Set());
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
        
        const paginationCtx = {
            getDockEvents,
            getTotalPages,
            getCurrentPage,
            handlePageChange,
            eventsPerPage,
            updatePaginationUI
        };
        wireStandaloneEventNavButtons(paginationCtx);
        updatePaginationUI = paginationCtx.updatePaginationUI;

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
                const value = parseInt(pageSlider.value, 10);
                const progress = value / SLIDER_RESOLUTION;

                if (tp <= 1) {
                    // Single-page lists: thumb moves across event slots (visual only).
                    return;
                }

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
        slide.updatePaginationUI = updatePaginationUI;

        window.standaloneDockPagination = {
            goToPage: (page, options) => handlePageChange(page, options),
            getTotalPages,
            getCurrentPage,
            getDockEvents,
            eventsPerPage,
        };

        // Initial seed: skip the page-turn animation so the user sees the
        // populated thumbnails immediately (the boot loading overlay is
        // still up at this point and would otherwise mask a 1.4s stagger).
        updatePaginationUI({ animate: false });
}

