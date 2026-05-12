/**
 * Render and wire the Event Manager's bottom pagination strip.
 *
 * Container: `#eventsPagination`. Lives next to `#eventsList` by default but moves into
 * `#storyArchiveBottomBar` when that strip is present (so the story-viewer chrome owns it).
 * Hidden when there's only one page.
 *
 * Controls:
 *   - Prev / Next buttons wrap at the ends (no disabled state).
 *   - `#eventsPageInput` accepts a 1..totalPages number; invalid input snaps back to the current page.
 *
 * Every navigation primes `renderService.requestPageEntranceAnimation()` so the next render
 * runs the staggered entrance wave, and plays the `page` sound effect.
 *
 * @param {{ eventManager: any, requestPageEntranceAnimation: () => void }} renderService
 * @param {Array<any>} events  Filtered events list (count + total pages derive from this).
 * @param {number} currentPage 1-based.
 * @param {number} eventsPerPage
 */
export function renderPaginationControls(renderService, events, currentPage, eventsPerPage) {
    const totalEvents = events.length;
    const totalPages = Math.max(1, Math.ceil(totalEvents / eventsPerPage));

    let paginationContainer = document.getElementById('eventsPagination');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'eventsPagination';
        paginationContainer.className = 'events-pagination';
        const eventsList = document.getElementById('eventsList');
        const storyBottom = document.getElementById('storyArchiveBottomBar');
        if (eventsList && eventsList.parentNode) {
            if (storyBottom && storyBottom.parentNode === eventsList.parentNode) {
                storyBottom.appendChild(paginationContainer);
            } else {
                eventsList.parentNode.insertBefore(paginationContainer, eventsList.nextSibling);
            }
        }
    } else {
        const storyBottom = document.getElementById('storyArchiveBottomBar');
        if (storyBottom && storyBottom.parentNode && !storyBottom.contains(paginationContainer)) {
            storyBottom.appendChild(paginationContainer);
        }
    }

    if (totalPages <= 1) {
        paginationContainer.innerHTML = '';
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    let paginationHTML = '<div class="events-pagination-controls">';
    paginationHTML += `<button type="button" class="events-pagination-btn" id="eventsPrevPage" title="Previous page (wraps to last)" aria-label="Previous page"><span class="events-pagination-btn__arrow" aria-hidden="true"><img class="ui-pagination-arrow" src="src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png" alt="" width="20" height="20" decoding="async" /></span></button>`;
    paginationHTML += `<span class="events-pagination-page-selector">`;
    paginationHTML += `<label for="eventsPageInput">Page:</label>`;
    paginationHTML += `<input type="number" inputmode="numeric" id="eventsPageInput" class="events-pagination-input" min="1" max="${totalPages}" value="${currentPage}" />`;
    paginationHTML += `<span class="events-pagination-total">of ${totalPages}</span>`;
    paginationHTML += `</span>`;
    paginationHTML += `<button type="button" class="events-pagination-btn" id="eventsNextPage" title="Next page (wraps to first)" aria-label="Next page"><span class="events-pagination-btn__arrow" aria-hidden="true"><img class="ui-pagination-arrow ui-pagination-arrow--flip-h" src="src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png" alt="" width="20" height="20" decoding="async" /></span></button>`;
    paginationHTML += '</div>';
    paginationContainer.innerHTML = paginationHTML;

    setupPaginationListeners(renderService);
}

/** Wire Prev / Next / Page-input listeners after every (re)render. */
function setupPaginationListeners(renderService) {
    const eventManager = renderService.eventManager;
    if (!eventManager) return;

    const getDisplayedEvents = () =>
        eventManager.getFilteredEvents ? eventManager.getFilteredEvents() : eventManager.events;
    const getTotalPages = () =>
        Math.max(1, Math.ceil(getDisplayedEvents().length / eventManager.eventsPerPage));

    const prevBtn = document.getElementById('eventsPrevPage');
    if (prevBtn) {
        prevBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('page');
            }
            renderService.requestPageEntranceAnimation();
            const totalPages = getTotalPages();
            if (eventManager.currentPage > 1) {
                eventManager.currentPage--;
            } else {
                eventManager.currentPage = totalPages;
            }
            if (eventManager.renderEvents) eventManager.renderEvents();
        };
    }

    const nextBtn = document.getElementById('eventsNextPage');
    if (nextBtn) {
        nextBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (window.SoundEffectsManager) {
                window.SoundEffectsManager.play('page');
            }
            renderService.requestPageEntranceAnimation();
            const totalPages = getTotalPages();
            if (eventManager.currentPage < totalPages) {
                eventManager.currentPage++;
            } else {
                eventManager.currentPage = 1;
            }
            if (eventManager.renderEvents) eventManager.renderEvents();
        };
    }

    const pageInput = document.getElementById('eventsPageInput');
    if (pageInput) {
        pageInput.onchange = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const totalPages = getTotalPages();
            const page = parseInt(pageInput.value, 10);
            if (page && page >= 1 && page <= totalPages && page !== eventManager.currentPage) {
                renderService.requestPageEntranceAnimation();
                eventManager.currentPage = page;
                if (eventManager.renderEvents) eventManager.renderEvents();
            } else {
                pageInput.value = eventManager.currentPage;
            }
        };
        pageInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                pageInput.onchange(e);
            }
            e.stopPropagation();
        };
        pageInput.onclick = (e) => {
            e.stopPropagation();
        };
    }
}
