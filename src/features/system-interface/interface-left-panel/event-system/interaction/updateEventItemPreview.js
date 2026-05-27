/**
 * Compose the location-text string for a variant preview, mirroring the rules from the
 * full event renderer:
 *   - Prefer `variant.cityDisplayName` if set.
 *   - For Earth + lat/lon, ask `eventManager.getLocationName()` for the reverse-geocoded
 *     city, falling back to the raw `(lat, lon)` if the lookup is empty.
 *   - Hard-code station / marsShip names; for moon/mars without an explicit city, format
 *     the panel coordinates.
 *   - Final fallback is the planet name itself (Moon / Mars), then `"Unknown"`.
 */
function resolveVariantLocationText(eventManager, event, variant) {
    let locationName = variant.cityDisplayName || null;
    const variantLocationType = variant.locationType || (event.locationType || 'earth');

    if (!locationName && variantLocationType === 'earth' && variant.lat !== undefined && variant.lon !== undefined) {
        if (eventManager.getLocationName) {
            locationName = eventManager.getLocationName(variant.lat, variant.lon);
        }
    }
    if (!locationName && variantLocationType === 'earth' && variant.lat !== undefined && variant.lon !== undefined) {
        locationName = `${variant.lat.toFixed(4)}, ${variant.lon.toFixed(4)}`;
    }
    if (!locationName && variantLocationType !== 'earth') {
        if (variantLocationType === 'station') {
            locationName = 'Space Station (ISS)';
        } else if (variantLocationType === 'marsShip') {
            locationName = 'Red Promise Escape Ship';
        } else if (variant.x !== undefined && variant.y !== undefined) {
            locationName = `${variantLocationType === 'moon' ? 'Moon' : 'Mars'}: (${variant.x.toFixed(1)}, ${variant.y.toFixed(1)})`;
        } else {
            locationName = variantLocationType === 'moon' ? 'Moon' : 'Mars';
        }
    }
    return { locText: locationName || 'Unknown', variantLocationType };
}

/**
 * Repaint a single manager-list card to reflect a specific variant of a multi-event.
 *
 * Touches every visible piece of the card:
 *   - **Image**: regenerated from `variant.name` + `variant.image`. No cache-bust since
 *     variant images were already preloaded with the page.
 *   - **Title**: routed through `GlitchTextService.getDisplayEventName` when available so
 *     the glitch styling stays consistent with the other cards.
 *   - **Search hit classes / pills**: cleared then re-applied based on
 *     `eventManager.getSearchMatchAxesForItem` so a variant swap correctly toggles whether
 *     the filter/country search highlights apply.
 *   - **Location**: built with `LocationFlagHelpers.createLocationRowInnerHtml` when
 *     available (matches the renderer's location row exactly); falls back to a plain
 *     pin-icon row otherwise.
 *   - **Year**: prefers the variant's own `yearStart`/`yearEnd` if present; otherwise falls
 *     back to the parent event's timeline.
 *   - **Multi-event badge**: shows `current/total`.
 *   - **Unfinished class**: tracks whether the variant has a description (used to dim or
 *     stripe cards in the manager list).
 *
 * @param {any} interactionService Owning EventInteractionService.
 * @param {number} _eventIndex Currently unused but kept in the signature for parity with callers.
 * @param {*} event Parent event object.
 * @param {HTMLElement} itemElement Manager-list card root element.
 * @param {number} variantIndex Variant to show.
 */
export function updateEventItemPreview(interactionService, _eventIndex, event, itemElement, variantIndex) {
    if (!interactionService.eventManager) return;

    const variant = event.variants[variantIndex];

    const imageContainer = itemElement.querySelector('.event-item-preview-image');
    const imagePath = interactionService.eventManager.getEventImagePath
        ? interactionService.eventManager.getEventImagePath(variant.name, variant.image)
        : null;
    const imagePathWithCache = imagePath || null;

    if (imagePathWithCache) {
        imageContainer.innerHTML = `<img src="${imagePathWithCache}" alt="${variant.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; display: block;" onerror="this.style.display='none'; this.parentElement.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; width: 100%; height: 100%;\\'>No Image</div>';" onload="">`;
    } else {
        imageContainer.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.3); font-size: 12px; width: 100%; height: 100%;">No Image</div>';
    }

    const titleElement = itemElement.querySelector('.event-item-title');
    if (titleElement) {
        titleElement.innerHTML = window.GlitchTextService
            ? window.GlitchTextService.getDisplayEventName(variant.name)
            : variant.name;
    }

    itemElement.classList.remove('event-item--search-hit-filter', 'event-item--search-hit-country');
    const oldPills = itemElement.querySelector('.event-search-hit-pills-row');
    if (oldPills) oldPills.remove();
    if (interactionService.eventManager.getSearchMatchAxesForItem) {
        const axes = interactionService.eventManager.getSearchMatchAxesForItem(variant);
        if (axes.filterActive || axes.countryActive) {
            if (axes.filterHit) itemElement.classList.add('event-item--search-hit-filter');
            if (axes.countryHit) itemElement.classList.add('event-item--search-hit-country');
        }
    }

    const locationElement = itemElement.querySelector('.event-item-location');
    if (locationElement) {
        const { locText, variantLocationType } = resolveVariantLocationText(interactionService.eventManager, event, variant);
        const rowInner = (typeof window !== 'undefined' && window.LocationFlagHelpers && typeof window.LocationFlagHelpers.createLocationRowInnerHtml === 'function')
            ? window.LocationFlagHelpers.createLocationRowInnerHtml(locText, variantLocationType)
            : `<img class="event-location-pin" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="28" height="28" decoding="async" /> ${locText}`;
        locationElement.innerHTML = rowInner;
    }

    const yearElement = itemElement.querySelector('.event-item-year');
    if (yearElement) {
        const timelineHelpers = (typeof window !== 'undefined') ? window.EventTimelineHelpers : null;
        const yearSource = (variant && (variant.yearStart != null || variant.yearEnd != null)) ? variant : event;
        yearElement.textContent = timelineHelpers && typeof timelineHelpers.formatPanelYearRangeLine === 'function'
            ? timelineHelpers.formatPanelYearRangeLine(yearSource)
            : 'Year Unknown';
    }

    const badge = itemElement.querySelector('.multi-event-badge');
    if (badge) {
        badge.textContent = `${variantIndex + 1}/${event.variants.length}`;
    }

    const hasDescription = variant.description && variant.description.trim().length > 0;
    itemElement.classList.toggle('event-item--unfinished', !hasDescription);
}
