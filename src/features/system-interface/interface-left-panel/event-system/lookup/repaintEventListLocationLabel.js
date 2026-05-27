/**
 * Repaint every `.event-item-location` cell in the manager list whose backing event's
 * coordinates match the just-resolved `(lat, lon)`.
 *
 * Called from `LocationLabelResolver.enhanceLocationWithCountry()` after a Nominatim
 * reverse-geocode returns. The match uses the same 0.01° tolerance the resolver uses for
 * its sync lookup so the same row gets refreshed both for cached and online resolutions.
 *
 * Markup is built via `LocationFlagHelpers.createLocationRowInnerHtml` (with flag chip)
 * when available; otherwise a plain icon + label is used as a fallback.
 */
export function repaintEventListLocationLabel(eventManager, lat, lon, locationName) {
    if (!eventManager) return;

    const eventItems = document.querySelectorAll('.event-item');
    eventItems.forEach((item) => {
        const locationEl = item.querySelector('.event-item-location');
        if (!locationEl) return;

        const itemIndex = parseInt(item.dataset.index);
        if (itemIndex !== undefined && eventManager.events && eventManager.events[itemIndex]) {
            const event = eventManager.events[itemIndex];
            const tolerance = 0.01;
            if (Math.abs(event.lat - lat) < tolerance && Math.abs(event.lon - lon) < tolerance) {
                const rowInner = (typeof window !== 'undefined' && window.LocationFlagHelpers && typeof window.LocationFlagHelpers.createLocationRowInnerHtml === 'function')
                    ? window.LocationFlagHelpers.createLocationRowInnerHtml(locationName, 'earth')
                    : `<img class="event-location-pin" src="src/assets/images/Icons/Filter%20Icons/Location%20Icon.png" alt="" width="28" height="28" decoding="async" /> ${locationName}`;
                locationEl.innerHTML = rowInner;
            }
        }
    });
}
