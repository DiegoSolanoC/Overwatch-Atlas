/**
 * Resolve a `{ locationDisplayText, displayLocationType }` pair from an event
 * (root or root+variant), with the same rules the event slide / dock list /
 * marker tooltip use:
 *   - Single events: read `cityDisplayName` / `lat`/`lon` from the root.
 *   - Multi-variant events: read from the specified variant (default 0) and
 *     fall back to root when the variant omits a coordinate or city.
 *   - Off-Earth locations (moon, mars, station, marsShip) get a synthetic
 *     "Moon: (X, Y)" style label when the variant has no explicit city.
 *   - Earth events without `cityDisplayName` but with lat/lon can look up a
 *     reverse-geocoded label via `getLocationName(lat, lon)` when callers
 *     pass that function (typically `eventManager.getLocationName`).
 *
 * Pair with `getResolvedFlagFilename` from `flagFileResolver.js` to turn
 * `locationDisplayText` into a flag PNG.
 */
(function () {
    'use strict';

    var R = window.__FlagFileResolver;

    /**
     * @param {Object|null} eventRoot
     * @param {number|undefined|null} variantIndexOpt — undefined → 0
     * @param {Function|null} getLocationName — (lat, lon) => string|null
     * @returns {{ locationDisplayText: string, displayLocationType: string }}
     */
    function getFlagLocationContext(eventRoot, variantIndexOpt, getLocationName) {
        var root = eventRoot || {};
        var variants = Array.isArray(root.variants) ? root.variants : [];
        var isMulti = variants.length > 0;
        var rootLocationType = root.locationType || 'earth';

        var ix = 0;
        if (variantIndexOpt != null && variantIndexOpt !== '' && !isNaN(Number(variantIndexOpt))) {
            var nIx = Math.trunc(Number(variantIndexOpt));
            if (nIx >= 0 && nIx < variants.length) ix = nIx;
        }

        var locationName = null;
        var locationLat = root.lat;
        var locationLon = root.lon;
        var locationX = root.x;
        var locationY = root.y;
        var displayLocationType = rootLocationType;

        if (isMulti) {
            var v = variants[ix] || variants[0];
            locationName = v.cityDisplayName || null;
            displayLocationType = v.locationType || rootLocationType;
            if (displayLocationType === 'earth') {
                if (v.lat !== undefined) locationLat = v.lat;
                if (v.lon !== undefined) locationLon = v.lon;
            } else if (displayLocationType === 'moon' || displayLocationType === 'mars') {
                locationX = v.x !== undefined ? v.x : root.x;
                locationY = v.y !== undefined ? v.y : root.y;
            }
        } else {
            locationName = root.cityDisplayName || null;
            displayLocationType = rootLocationType;
        }

        if (!locationName && displayLocationType === 'earth'
            && locationLat !== undefined && locationLon !== undefined
            && typeof getLocationName === 'function') {
            locationName = getLocationName(locationLat, locationLon);
        }

        if (!locationName && displayLocationType !== 'earth') {
            if (displayLocationType === 'station') {
                locationName = 'Space Station (ISS)';
            } else if (displayLocationType === 'marsShip') {
                locationName = 'Red Promise Escape Ship';
            } else if (locationX !== undefined && locationY !== undefined) {
                locationName = (displayLocationType === 'moon' ? 'Moon' : 'Mars')
                    + ': (' + locationX.toFixed(1) + ', ' + locationY.toFixed(1) + ')';
            } else {
                locationName = displayLocationType === 'moon' ? 'Moon' : 'Mars';
            }
        }

        var locationDisplayText;
        if (locationName) {
            locationDisplayText = String(locationName);
        } else if (locationLat !== undefined && locationLon !== undefined) {
            locationDisplayText = Number(locationLat).toFixed(4) + ', ' + Number(locationLon).toFixed(4);
        } else {
            locationDisplayText = 'Unknown';
        }

        return {
            locationDisplayText: locationDisplayText,
            displayLocationType: displayLocationType || 'earth'
        };
    }

    function createLeadingGraphicHtml(locationName, locationType) {
        var fn = R.getResolvedFlagFilename(locationName, locationType);
        if (fn) return R.flagImg(fn);
        return R.pinImg();
    }

    function createLocationRowInnerHtml(locationName, locationType) {
        var text = locationName != null ? String(locationName) : '';
        return createLeadingGraphicHtml(text, locationType) + ' ' + text;
    }

    /** Sorted common country names from FLAG_FILE_BY_COMMON (for autocomplete). */
    function getCountryCommonNamesForAutocomplete() {
        var map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
        if (!map) return [];
        return Object.keys(map).sort(function (a, b) { return a.localeCompare(b); });
    }

    window.__FlagLocationContext = {
        getFlagLocationContext: getFlagLocationContext,
        createLeadingGraphicHtml: createLeadingGraphicHtml,
        createLocationRowInnerHtml: createLocationRowInnerHtml,
        getCountryCommonNamesForAutocomplete: getCountryCommonNamesForAutocomplete
    };
})();
