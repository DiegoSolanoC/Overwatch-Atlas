/**
 * Map a country name or full "City, Country" display string to a flag PNG
 * filename, plus the canonical `<img>` / pin markup wrappers used by every
 * slide and dock view.
 *
 * The real-world country lookup goes through `window.FLAG_FILE_BY_COMMON`
 * (populated by `Interactive-Worldview/worldview-shared-assets/data/flagFileByCommonName.js`). On
 * top of that we apply:
 *   - `ALIASES`     : historical / colloquial names that map to a canonical
 *                     entry in the map (e.g. "USA" → "United States").
 *   - `FICTIONAL`   : Overwatch-specific locales (Numbani, Lunar Colony,
 *                     space station, Mars, etc.) that have hand-authored
 *                     PNGs but no real-world country row.
 *   - `trySpecialDisplayFile` : full-display overrides where the substring
 *                     itself dictates the flag (e.g. "Atlantic Arcology",
 *                     "Baltic Sea" → Sweden, "Coral Sea" → New Zealand).
 *
 * Everything else in this file is plain-data — no DOM, no globals beyond
 * `FLAG_FILE_BY_COMMON`. The slide-side rendering modules import these
 * resolvers and stitch them into HTML.
 */
(function () {
    'use strict';

    var FLAG_DIR = 'src/assets/images/Filters/Flags/';
    var LOC_ICON = 'src/assets/images/Icons/Filter%20Icons/Location%20Icon.png';

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

    /** Trim trailing punctuation from country segment ("Kurjikstan.", "Antartica?"). */
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
        for (var common in map) {
            if (!Object.prototype.hasOwnProperty.call(map, common)) continue;
            if (normalizeKey(common) === nk) return map[common];
        }
        return null;
    }

    /** Full-display overrides (no comma, or non-country suffix handled here). */
    function trySpecialDisplayFile(locationName) {
        var n = (locationName || '').toLowerCase();
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

    /** Strip trailing ", , ," so "Cairo, Egypt," still resolves to Egypt. */
    function stripTrailingCommaSep(s) {
        return String(s == null ? '' : s)
            .replace(/\u00a0/g, ' ')
            .replace(/,+\s*$/g, '')
            .trim();
    }

    function extractCountryFromDisplay(locationName) {
        if (!locationName || typeof locationName !== 'string') return null;
        var s = stripTrailingCommaSep(locationName);
        if (!s) return null;
        var idx = s.lastIndexOf(',');
        if (idx < 0) return null;
        var c = s.slice(idx + 1).trim();
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
        if (n.indexOf('horizon lunar') >= 0) return FICTIONAL.horizonLunarColony;
        if (n.indexOf('lunar') >= 0 && n.indexOf('colony') >= 0) return FICTIONAL.moon;
        if (t === 'station' || n.indexOf('space station') >= 0 || n.indexOf('(iss)') >= 0
            || n.indexOf(' iss') >= 0 || n.indexOf('interstellar journey') >= 0) {
            return FICTIONAL.station;
        }
        if (t === 'moon' || (n.indexOf('moon') >= 0 && n.indexOf('mars') < 0)) return FICTIONAL.moon;
        if (t === 'mars' || n.indexOf('mars:') >= 0 || n.indexOf('mars (') >= 0) return FICTIONAL.mars;
        return null;
    }

    function pinImg() {
        return '<img class="event-location-pin" src="' + LOC_ICON + '" alt="" width="28" height="28" decoding="async" />';
    }

    function flagImg(filename) {
        var fn = String(filename || '').trim();
        var src = flagSrc(filename);
        var esc = LOC_ICON.replace(/'/g, "\\'");
        var dataAttr = '';
        if (fn) {
            var safe = fn.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            dataAttr = ' data-relevancy-flag-file="' + safe + '"';
        }
        return (
            '<img class="event-location-flag"' +
            dataAttr +
            ' src="' +
            src +
            '" alt="" width="52" height="36" decoding="async" onerror="this.onerror=null;this.src=\'' +
            esc +
            '\';this.className=\'event-location-pin\';this.width=28;this.height=28;" />'
        );
    }

    /** Resolve which flag PNG corresponds to a location display string (null = no flag, pin only). */
    function getResolvedFlagFilename(locationName, locationType) {
        var loc = stripTrailingCommaSep(locationName);
        if (!loc) return null;
        var special = trySpecialDisplayFile(loc);
        if (special) return special;
        var fic = tryFictionalFile(loc, locationType);
        if (fic) return fic;
        var country = extractCountryFromDisplay(loc);
        if (country) {
            var fn = resolveCountryToFilename(country);
            if (fn) return fn;
        }
        return null;
    }

    function escapeHtmlAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /** Slide prose: pass through `GlitchTextService` so Olivia/Colomar glitch applies, falls back to escaped plain text. */
    function slideStoryDisplayHtml(plain) {
        var s = String(plain == null ? '' : plain);
        var gts = typeof window !== 'undefined' && window.GlitchTextService;
        if (gts && typeof gts.getDisplayText === 'function') return gts.getDisplayText(s);
        return escapeHtmlAttr(s);
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

    var api = {
        FLAG_DIR: FLAG_DIR,
        LOC_ICON: LOC_ICON,
        FICTIONAL: FICTIONAL,
        normalizeKey: normalizeKey,
        flagSrc: flagSrc,
        scrubCountrySuffix: scrubCountrySuffix,
        resolveCountryToFilename: resolveCountryToFilename,
        trySpecialDisplayFile: trySpecialDisplayFile,
        stripTrailingCommaSep: stripTrailingCommaSep,
        extractCountryFromDisplay: extractCountryFromDisplay,
        tryFictionalFile: tryFictionalFile,
        pinImg: pinImg,
        flagImg: flagImg,
        getResolvedFlagFilename: getResolvedFlagFilename,
        escapeHtmlAttr: escapeHtmlAttr,
        slideStoryDisplayHtml: slideStoryDisplayHtml,
        commonLabelForFlagFile: commonLabelForFlagFile
    };

    /* Module-level singleton so sibling slice files reach these via window
       without each one repeating the IIFE. The public LocationFlagHelpers
       facade re-exports the user-facing subset. */
    window.__FlagFileResolver = api;
})();
