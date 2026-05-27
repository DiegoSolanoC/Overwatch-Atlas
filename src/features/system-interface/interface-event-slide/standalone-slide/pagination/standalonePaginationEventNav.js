/**
 * Prev/next event buttons for standalone pagination.
 */
import { shouldEventBeLocked } from '../../../interface-globe-markers/filtering/shouldEventBeLocked.js';

/** @param {object} ctx */
export function wireStandaloneEventNavButtons(ctx) {
    const { getDockEvents, getTotalPages, getCurrentPage, handlePageChange, eventsPerPage } = ctx;
    let { updatePaginationUI } = ctx;
    // Event navigation buttons (prev/next event)
    const prevEventBtn = document.getElementById('prevEventBtn');
    const nextEventBtn = document.getElementById('nextEventBtn');
    
    if (prevEventBtn && nextEventBtn) {
        const getCurrentEventIndex = () => window.standaloneEventSlide?.currentEventIndex ?? -1;
        const getFilteredEvents = () =>
            window.eventManager?.getFilteredDockTimelineEvents?.() ||
            window.eventManager?.getDockTimelineEvents?.() ||
            [];
        
        const dockIndexFromFilteredSlot = (listIndex, list) => {
            const dock = getDockEvents();
            const filtered = list || getFilteredEvents();
            if (
                listIndex < 0
                || !filtered.length
                || listIndex >= filtered.length
                || !dock.length
            ) {
                return listIndex;
            }
            const ev = filtered[listIndex];
            if (!ev) return listIndex;
            const di = dock.indexOf(ev);
            return di !== -1 ? di : listIndex;
        };
        
        const syncPaginationToDockIndex = (dockIdx) => {
            if (!Number.isFinite(dockIdx) || dockIdx < 0) return;
            const totalPages = getTotalPages();
            const targetPage = Math.max(
                1,
                Math.min(totalPages, Math.floor(dockIdx / eventsPerPage) + 1)
            );
            if (targetPage !== getCurrentPage()) {
                handlePageChange(targetPage, { skipSound: true });
            }
        };
        
        const navigateToEvent = (direction) => {
            const currentEvents = getFilteredEvents();
            if (!currentEvents.length) return;
            
            const currentIndex = getCurrentEventIndex();
            const eventSlide = document.getElementById('eventSlide');
            const isEventOpen = eventSlide?.classList.contains('open');
            
            let targetIndex;
            
            if (isEventOpen && currentIndex >= 0) {
                // currentEventIndex is always a dock-timeline index from showEvent()
                const dock = getDockEvents();
                if (!dock.length) return;
                
                let dockIdx;
                if (currentEvents === dock) {
                    dockIdx = currentIndex + direction;
                    if (dockIdx < 0) dockIdx = dock.length - 1;
                    if (dockIdx >= dock.length) dockIdx = 0;
                } else {
                    const atDock = dock[currentIndex];
                    let curF = currentEvents.indexOf(atDock);
                    if (curF === -1) {
                        curF = direction > 0 ? -1 : currentEvents.length;
                    }
                    let nextF = curF + direction;
                    if (nextF < 0) nextF = currentEvents.length - 1;
                    if (nextF >= currentEvents.length) nextF = 0;
                    dockIdx = dock.indexOf(currentEvents[nextF]);
                    if (dockIdx === -1) return;
                }
                
                syncPaginationToDockIndex(dockIdx);
                
                // Keep panel open: closing + delayed reopen caused visible jitter
                if (window.standaloneEventSlide) {
                    window.standaloneEventSlide.showEvent(dockIdx, {
                        keepSlideHistory: true
                    });
                    if (window.SoundEffectsManager?.play) {
                        window.SoundEffectsManager.play('eventClick');
                    }
                }
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
                    const dockIdx = dockIndexFromFilteredSlot(
                        targetIndex,
                        currentEvents
                    );
                    syncPaginationToDockIndex(dockIdx);
                    window.standaloneEventSlide.showEvent(dockIdx);
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
        updatePaginationUI = () => {
            originalUpdatePaginationUI();
            updateEventNavButtons();
        };
    }

    ctx.updatePaginationUI = updatePaginationUI;
}
