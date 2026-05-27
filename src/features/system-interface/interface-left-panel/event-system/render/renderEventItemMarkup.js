/**
 * renderEventItemMarkup — builds the inner HTML for one `<div class="event-item">`.
 *
 * Layout (matches dock thumbnail chrome):
 *   .event-item__thumb-block         clickable thumbnail "open on globe" target
 *     .event-item__thumb-shell
 *       .event-item__thumb-visual
 *         .event-item__thumb-media   image / spinner / placeholder
 *         .multi-event-badge         (only on multi-variant events) — clickable, cycles variant
 *         .event-item__thumb-titlebar (only in story-viewer-embedded mode) — title overlay
 *     .event-item__thumb-chrome
 *       .event-number-badge          slot numeral (with `--overlap` styling when applicable)
 *   .event-item__body
 *     .event-item-info
 *       .event-item-heading          (only when titlebar isn't overlaid on thumb)
 *       .event-item-meta             location row + year line (or description preview on satellites)
 *
 * The function is pure markup: all decisions are driven by the inputs and a small set of
 * `window.*` lookups (`LocationFlagHelpers`, `EventTimelineHelpers`, `GlitchTextService`).
 */

/** Transparent 1×1 GIF — placeholder `src` for lazy-loaded `<img>` until IO assigns the real one. */
const EVENT_LIST_LAZY_IMG_PLACEHOLDER =
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/** Loading spinner shown as a sibling under the lazy `<img>` until it loads. */
const EVENT_LIST_LOADING_SPINNER_SRC = 'src/assets/images/Misc/GIFs/loading%20asset.gif';

/** Tiny HTML-escape for satellite-archive description previews. */
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {{
 *   event: Record<string, any>,
 *   displayEvent: Record<string, any>,
 *   index: number,
 *   currentVariantIndex: number,
 *   isMultiEvent: boolean,
 *   locationName: string|null,
 *   displayLocationType: string,
 *   imagePath: string|null,
 *   isSatelliteArchive: boolean,
 *   hasOverlap: boolean,
 *   isUnfinished: boolean,
 *   useStoryArchiveDockTitle: boolean,
 * }} ctx
 * @returns {string}
 */
export function renderEventItemMarkup(ctx) {
    const {
        event,
        displayEvent,
        index,
        currentVariantIndex,
        isMultiEvent,
        locationName,
        displayLocationType,
        imagePath,
        isSatelliteArchive,
        hasOverlap,
        isUnfinished,
        useStoryArchiveDockTitle,
    } = ctx;

    // Image: always wrap so card sizing stays stable even when imagePath is null.
    const imageHtml = imagePath
        ? `<div class="event-item-preview-image event-item-preview-image--loading" style="position: relative; width: 100%; aspect-ratio: 1; overflow: hidden;"><img class="event-item-preview-image__spinner" src="${EVENT_LIST_LOADING_SPINNER_SRC}" alt="" width="56" height="56" decoding="async" draggable="false" /><img class="event-item-preview-image__photo" src="${EVENT_LIST_LAZY_IMG_PLACEHOLDER}" data-src="${imagePath}" alt="${displayEvent.name}" decoding="async" fetchpriority="low" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; z-index: 2; opacity: 0; transition: opacity 0.18s ease;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; width: 100%; height: 100%;\\'>No Image</div>';" onload="this.style.opacity='1';var p=this.closest('.event-item-preview-image');if(p)p.classList.remove('event-item-preview-image--loading');"></div>`
        : `<div class="event-item-preview-image" style="position: relative; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; background: rgba(0,0,0,0.5); width: 100%; aspect-ratio: 1;">No Image</div>`;

    // "1/3"-style variant counter; clickable to advance.
    const multiEventBadge = isMultiEvent
        ? `<div class="multi-event-badge" data-event-index="${index}" title="Click to cycle through variants">${currentVariantIndex + 1}/${event.variants.length}</div>`
        : '';

    // Slot numeral chrome (mirrors dock thumbnails).
    const overlapClass = hasOverlap ? ' event-number-badge--overlap' : '';
    const baseNumTitle = hasOverlap
        ? `Overlap detected on globe page ${Math.floor(index / 10) + 1}`
        : `Event #${index + 1}`;
    const numTitle = isUnfinished ? `${baseNumTitle} — Unfinished: missing description` : baseNumTitle;

    // Inline style for the overlap variant is duplicated in EventRenderService.renderEvents()
    // because some browsers drop the `!important` rule under heavy reflow — leave the inline
    // copy here for safety.
    const overlapStyle = hasOverlap
        ? ` style="color: rgba(255, 230, 230, 0.98) !important; text-shadow: 0 0 14px rgba(244, 67, 54, 0.75), 0 1px 3px rgba(0, 0, 0, 0.85) !important; background: linear-gradient(180deg, rgba(60, 20, 20, 0.42) 0%, transparent 78%) !important;"`
        : '';

    const eventNumberBadge = `<div class="event-number-badge event-item__thumb-key${overlapClass}" title="${numTitle}"${overlapStyle}>${index + 1}</div>`;

    // Meta row: satellite archives show description preview; story shows location + year line.
    let locationRowInner;
    let yearLine;
    if (isSatelliteArchive) {
        const descPlain = (displayEvent.description || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const preview = descPlain.length > 140 ? `${descPlain.slice(0, 137)}…` : descPlain;
        locationRowInner = preview ? escapeHtml(preview) : '—';
        yearLine = '';
    } else {
        const locationDisplayText = locationName || `${event.lat ? event.lat.toFixed(4) : '0'}, ${event.lon ? event.lon.toFixed(4) : '0'}`;
        locationRowInner = (window.LocationFlagHelpers && typeof window.LocationFlagHelpers.createLocationRowInnerHtml === 'function')
            ? window.LocationFlagHelpers.createLocationRowInnerHtml(locationDisplayText, displayLocationType)
            : `<img class="event-location-pin" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="28" height="28" decoding="async" /> ${locationDisplayText}`;
        const timelineHelpers = (typeof window !== 'undefined') ? window.EventTimelineHelpers : null;
        const yearSource = (displayEvent && (displayEvent.yearStart != null || displayEvent.yearEnd != null))
            ? displayEvent
            : event;
        yearLine = timelineHelpers && typeof timelineHelpers.formatPanelYearRangeLine === 'function'
            ? timelineHelpers.formatPanelYearRangeLine(yearSource)
            : 'Year Unknown';
    }

    const displayTitleHtml = window.GlitchTextService
        ? window.GlitchTextService.getDisplayEventName(displayEvent.name)
        : displayEvent.name;
    const headingRowHtml = `<div class="event-item-heading">
                        <h3 class="event-item-title">${displayTitleHtml}</h3>
                    </div>`;
    const thumbTitleOverlayHtml = useStoryArchiveDockTitle
        ? `<div class="event-item__thumb-titlebar">${headingRowHtml}</div>`
        : '';
    const bodyHeadingHtml = useStoryArchiveDockTitle ? '' : headingRowHtml;

    return `
        <div class="event-item__thumb-block">
            <div class="event-item__thumb-shell">
                <div class="event-item__thumb-visual">
                    <div class="event-item__thumb-media">
                        ${imageHtml}
                    </div>
                    ${multiEventBadge}
                    ${thumbTitleOverlayHtml}
                </div>
            </div>
            <div class="event-item__thumb-chrome">
                ${eventNumberBadge}
            </div>
        </div>
        <div class="event-item__body">
            <div class="event-item-info">
                ${bodyHeadingHtml}
                <div class="event-item-meta">
                    <p class="event-item-location">${locationRowInner}</p>
                    ${yearLine ? `<p class="event-item-year">${yearLine}</p>` : ''}
                </div>
            </div>
        </div>
    `;
}
