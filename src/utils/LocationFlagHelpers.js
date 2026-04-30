/**
 * LocationFlagHelpers — flag image next to "City, Country" and fictional / off-world locations.
 * Depends on window.FLAG_FILE_BY_COMMON from src/data/flagFileByCommonName.js.
 */
(function () {
    'use strict';

    var FLAG_DIR = 'assets/images/flags/';
    var LOC_ICON = 'assets/images/icons/Location Icon.png';

    var FICTIONAL = {
        numbani: 'Numbani.png',
        moon: 'Moon.png',
        horizonLunarColony: 'Horizon Lunar Colony.png',
        redPromiseColony: 'Red Promise Colony.png',
        mars: 'Mars.png',
        station: 'Interstellar Journey Space Station.png',
        stationFallback: 'Space Station.png',
        marsShip: 'Mars.png'
    };

    function normalizeKey(s) {
        if (!s) return '';
        return String(s)
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    function flagSrc(filename) {
        return FLAG_DIR + filename.split('/').map(function (seg) { return encodeURIComponent(seg); }).join('/');
    }

    var ALIASES = {
        usa: 'United States',
        'u.s.a.': 'United States',
        'united states of america': 'United States',
        uk: 'United Kingdom',
        'u.k.': 'United Kingdom',
        'great britain': 'United Kingdom',
        england: 'United Kingdom',
        uae: 'United Arab Emirates',
        'russian federation': 'Russia',
        'south korea': 'South Korea',
        'north korea': 'North Korea',
        'czech republic': 'Czechia',
        turkiye: 'Turkey',
        kurjikstan: 'Kyrgyzstan',
        'democratic republic of the congo': 'DR Congo',
        oceania: 'New Zealand',
        antartica: 'Antarctica'
    };

    /** Trim trailing punctuation from country segment (e.g. "Kurjikstan.", "Antartica?"). */
    function scrubCountrySuffix(s) {
        return String(s || '').trim().replace(/[.?]+$/g, '').trim();
    }

    function resolveCountryToFilename(countryRaw) {
        var map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
        if (!map || !countryRaw) return null;
        var t = scrubCountrySuffix(String(countryRaw).trim());
        if (!t) return null;
        if (map[t]) return map[t];
        var nk = normalizeKey(t);
        if (ALIASES[nk]) {
            var canon = ALIASES[nk];
            if (map[canon]) return map[canon];
        }
        var common;
        for (common in map) {
            if (!Object.prototype.hasOwnProperty.call(map, common)) continue;
            if (normalizeKey(common) === nk) return map[common];
        }
        return null;
    }

    /** Full-display overrides (no comma, or non-country suffix handled here). */
    function trySpecialDisplayFile(locationName) {
        var n = (locationName || '').toLowerCase();
        /* Fictional Overwatch locales — run before country parsing */
        if (n.indexOf('numbani') >= 0) return FICTIONAL.numbani;
        if (n.indexOf('horizon lunar') >= 0) return FICTIONAL.horizonLunarColony;
        if (n.indexOf('red promise colony') >= 0 || n.indexOf('red promise escape ship') >= 0) {
            return FICTIONAL.redPromiseColony;
        }
        if (n.indexOf('atlantic arcology') >= 0) return 'Atlantic Arcology.png';
        if (n.indexOf('baltic sea') >= 0) return 'Sweden.png';
        if (n.indexOf('coral sea') >= 0) return 'New Zealand.png';
        if (n.indexOf('ecopoint antarctica') >= 0 || n.indexOf('ecoopint antartica') >= 0 || n.indexOf('ecopoint antartica') >= 0) {
            return 'Antarctica.png';
        }
        if (n.indexOf('secret omnium') >= 0) return 'Antarctica.png';
        if (n.indexOf('watchpoint gibraltar') >= 0) return 'Gibraltar.png';
        if (n.indexOf('gwishin omnium') >= 0) return 'China.png';
        return null;
    }

    function extractCountryFromDisplay(locationName) {
        if (!locationName || typeof locationName !== 'string') return null;
        var idx = locationName.lastIndexOf(',');
        if (idx < 0) return null;
        var c = locationName.slice(idx + 1).trim();
        return c || null;
    }

    function tryFictionalFile(locationName, locationType) {
        var n = (locationName || '').toLowerCase();
        var t = locationType || 'earth';

        if (n.indexOf('numbani') >= 0) return FICTIONAL.numbani;

        if (t === 'marsShip') return FICTIONAL.marsShip;

        if (n.indexOf('promice') >= 0
            || (n.indexOf('escape ship') >= 0 && (n.indexOf('mars') >= 0 || n.indexOf('promise') >= 0))
            || n.indexOf('martian ship') >= 0) {
            return FICTIONAL.marsShip;
        }

        if (n.indexOf('horizon lunar') >= 0) {
            return FICTIONAL.horizonLunarColony;
        }
        if (n.indexOf('lunar') >= 0 && n.indexOf('colony') >= 0) {
            return FICTIONAL.moon;
        }

        if (t === 'station' || n.indexOf('space station') >= 0 || n.indexOf('(iss)') >= 0 || n.indexOf(' iss') >= 0 || n.indexOf('interstellar journey') >= 0) {
            return FICTIONAL.station;
        }

        if (t === 'moon' || (n.indexOf('moon') >= 0 && n.indexOf('mars') < 0)) {
            return FICTIONAL.moon;
        }

        if (t === 'mars' || n.indexOf('mars:') >= 0 || n.indexOf('mars (') >= 0) {
            return FICTIONAL.mars;
        }

        return null;
    }

    function pinImg() {
        return '<img class="event-location-pin" src="' + LOC_ICON + '" alt="" width="28" height="28" decoding="async" />';
    }

    function flagImg(filename) {
        var src = flagSrc(filename);
        var esc = LOC_ICON.replace(/'/g, "\\'");
        return '<img class="event-location-flag" src="' + src + '" alt="" width="52" height="36" decoding="async" onerror="this.onerror=null;this.src=\'' + esc + '\';this.className=\'event-location-pin\';this.width=28;this.height=28;" />';
    }

    /**
     * City/label string + locationType for flag resolution — same rules as EventRenderService / event slide
     * (variant index for multi-events; optional getLocationName(lat,lon) when cityDisplayName missing).
     * @param {Object|null} eventRoot
     * @param {number|undefined|null} variantIndexOpt - multi-event variant; omit or undefined → 0
     * @param {Function|null} getLocationName - (lat, lon) => string | null
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
            if (nIx >= 0 && nIx < variants.length) {
                ix = nIx;
            }
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
                if (v.lat !== undefined) {
                    locationLat = v.lat;
                }
                if (v.lon !== undefined) {
                    locationLon = v.lon;
                }
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
            var n = (locationName || '').toLowerCase();
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

        return { locationDisplayText: locationDisplayText, displayLocationType: displayLocationType || 'earth' };
    }

    /**
     * Which flag PNG would be shown for this location (same rules as the location row). Returns null if pin only.
     */
    function getResolvedFlagFilename(locationName, locationType) {
        var special = trySpecialDisplayFile(locationName);
        if (special) return special;

        var fic = tryFictionalFile(locationName, locationType);
        if (fic) return fic;

        var country = extractCountryFromDisplay(locationName);
        if (country) {
            var fn = resolveCountryToFilename(country);
            if (fn) return fn;
        }

        return null;
    }

    function createLeadingGraphicHtml(locationName, locationType) {
        var fn = getResolvedFlagFilename(locationName, locationType);
        if (fn) return flagImg(fn);
        return pinImg();
    }

    function createLocationRowInnerHtml(locationName, locationType) {
        var text = locationName != null ? String(locationName) : '';
        return createLeadingGraphicHtml(text, locationType) + ' ' + text;
    }

    /**
     * Resolve one manual token (e.g. from "Secondary countries" field) to a flag PNG filename.
     * Tries full-display rules first, then plain country name lookup.
     */
    function resolveManualCountryTokenToFlagFile(token, locationType) {
        var trimmed = String(token || '').trim();
        if (!trimmed) return null;
        var t = locationType || 'earth';
        var viaDisplay = getResolvedFlagFilename(trimmed, t);
        if (viaDisplay) return viaDisplay;
        return resolveCountryToFilename(trimmed);
    }

    /**
     * Parse comma-separated country/location tokens into unique flag filenames (event manager country filter).
     */
    function parseSecondaryCountryList(text, locationType) {
        var tokens = (text || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        var seen = {};
        var out = [];
        tokens.forEach(function (tok) {
            var fn = resolveManualCountryTokenToFlagFile(tok, locationType);
            if (fn && !seen[fn]) {
                seen[fn] = true;
                out.push(fn);
            }
        });
        return out;
    }

    /** Sorted common country names from FLAG_FILE_BY_COMMON (for autocomplete). */
    function getCountryCommonNamesForAutocomplete() {
        var map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
        if (!map) return [];
        return Object.keys(map).sort(function (a, b) { return a.localeCompare(b); });
    }

    /**
     * Flag PNG filenames associated with an event/variant (primary location + secondary + explicit countries[]).
     * Used by filter panel country chips and marker lock logic (`country:…` keys in standaloneActiveFilters).
     */
    function collectCountryFlagFilesForEntity(ev) {
        var ordered = [];
        var seen = new Set();
        var loc = (ev && ev.cityDisplayName != null) ? String(ev.cityDisplayName) : '';
        var locType = (ev && ev.locationType) ? String(ev.locationType) : 'earth';
        var primary = getResolvedFlagFilename(loc, locType);
        if (primary) {
            seen.add(primary);
            ordered.push(primary);
        }
        var sec = Array.isArray(ev && ev.secondaryCountryFlags) ? ev.secondaryCountryFlags : [];
        sec.forEach(function (f) {
            var fn = f != null ? String(f).trim() : '';
            if (fn && !seen.has(fn)) {
                seen.add(fn);
                ordered.push(fn);
            }
        });
        var extra = Array.isArray(ev && ev.countries) ? ev.countries : [];
        extra.forEach(function (token) {
            var fn = resolveManualCountryTokenToFlagFile(String(token || ''), locType);
            if (fn && !seen.has(fn)) {
                seen.add(fn);
                ordered.push(fn);
            }
        });
        return ordered;
    }

    /** Inverse of FLAG_FILE_BY_COMMON for filter sync / labels. */
    function commonLabelForFlagFile(flagFile) {
        var map = typeof window !== 'undefined' ? window.FLAG_FILE_BY_COMMON : null;
        var file = String(flagFile || '').trim();
        if (!file) return '';
        if (map) {
            var commons = Object.keys(map);
            for (var i = 0; i < commons.length; i++) {
                if (map[commons[i]] === file) return commons[i];
            }
        }
        return file.replace(/\.png$/i, '').trim() || file;
    }

    window.LocationFlagHelpers = {
        createLeadingGraphicHtml: createLeadingGraphicHtml,
        createLocationRowInnerHtml: createLocationRowInnerHtml,
        flagSrc: flagSrc,
        getFlagLocationContext: getFlagLocationContext,
        getResolvedFlagFilename: getResolvedFlagFilename,
        parseSecondaryCountryList: parseSecondaryCountryList,
        getCountryCommonNamesForAutocomplete: getCountryCommonNamesForAutocomplete,
        collectCountryFlagFilesForEntity: collectCountryFlagFilesForEntity,
        commonLabelForFlagFile: commonLabelForFlagFile
    };
})();
