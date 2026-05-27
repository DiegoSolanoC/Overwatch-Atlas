/**
 * eventPaginationMarkup — pure HTML string builders for the dock chrome.
 *
 *   - eventPaginationInnerHtml(): innerHTML for the #eventPagination container
 *     (slider row, thumb row with prev/next page+event buttons, mobile page input).
 *   - dockCollapseStripHtml(): HTML for the dock collapse strip handle that sits
 *     above the dock and toggles the thumb row visibility.
 *
 * No DOM mutation, no listeners. Mounting is owned by mountPaginationDock.js.
 */

import { getEventThumbNumberButtonsHtml } from './PaginationThumbMarkup.js';

const ARROW_ICON_SRC = 'src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png';
const DOUBLE_ARROW_ICON_SRC = 'src/assets/images/Icons/Utility%20Icons/Double%20Arrow.png';

const ICON_IMG_STYLE = 'width: 100%; height: 100%; object-fit: contain;';

export function eventPaginationInnerHtml() {
    return `
        <div class="event-page-slider-row event-page-slider-row--desktop-only">
            <div class="event-page-slider-wrap">
                <div class="event-page-slider-ticks" id="eventPageSliderTicks" aria-hidden="true"></div>
                <input type="range" id="eventPageSlider" class="event-page-slider" min="0" max="10000" value="0" step="1"
                    title="Scrub pages" aria-label="Pages along timeline" aria-valuemin="0" aria-valuemax="10000" aria-valuenow="0" />
                <div class="event-page-slider-era-strip" id="eventPageSliderEraStrip" aria-hidden="true"></div>
            </div>
        </div>
        <div class="event-pagination-thumb-row">
            <button type="button" id="prevPageBtn" class="globe-control-btn dock-globe-rail__btn" title="Previous Page" aria-label="Previous page"><span id="prevPageBtnIcon"><img src="${DOUBLE_ARROW_ICON_SRC}" alt="" decoding="async" style="${ICON_IMG_STYLE}" /></span></button>
            <button type="button" id="prevEventBtn" class="globe-control-btn dock-globe-rail__btn" title="Previous Event" aria-label="Previous event"><span id="prevEventBtnIcon"><img src="${ARROW_ICON_SRC}" alt="" decoding="async" style="${ICON_IMG_STYLE}" /></span></button>
            <div class="event-number-buttons event-number-buttons--thumbs-desktop" id="eventNumberButtons">${getEventThumbNumberButtonsHtml()}</div>
            <button type="button" id="nextEventBtn" class="globe-control-btn dock-globe-rail__btn" title="Next Event" aria-label="Next event"><span id="nextEventBtnIcon" class="icon-flip-h"><img src="${ARROW_ICON_SRC}" alt="" decoding="async" style="${ICON_IMG_STYLE}" /></span></button>
            <button type="button" id="nextPageBtn" class="globe-control-btn dock-globe-rail__btn" title="Next Page" aria-label="Next page"><span id="nextPageBtnIcon" class="icon-flip-h"><img src="${DOUBLE_ARROW_ICON_SRC}" alt="" decoding="async" style="${ICON_IMG_STYLE}" /></span></button>
        </div>
        <div class="page-controls-row page-controls-row--page-only page-controls-row--mobile-only">
            <div class="page-input-container">
                <span class="page-label">Page</span>
                <input type="number" id="pageInput" class="page-input" min="1" value="1" title="Enter page number">
            </div>
        </div>
    `;
}

export function dockCollapseStripHtml() {
    return `
        <div class="pagination-dock-collapse-bar" id="paginationDockCollapseBar">
            <button type="button" id="paginationDockCollapseBtn" class="pagination-dock-collapse-handle"
                aria-expanded="true" aria-controls="eventNumberButtons"
                title="Collapse thumbnail strip" aria-label="Collapse thumbnail strip">
                <span class="pagination-dock-collapse-pill" aria-hidden="true">
                    <img class="ui-pagination-arrow ui-pagination-arrow--dock-collapse" src="${ARROW_ICON_SRC}" alt="" width="22" height="22" decoding="async" />
                </span>
            </button>
        </div>`;
}
