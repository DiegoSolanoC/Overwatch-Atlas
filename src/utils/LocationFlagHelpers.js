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

    /** Strip trailing ", , ," so "Cairo, Egypt," still resolves to Egypt (otherwise last segment is empty → pin). */
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

    function createLeadingGraphicHtml(locationName, locationType) {
        var fn = getResolvedFlagFilename(locationName, locationType);
        if (fn) return flagImg(fn);
        return pinImg();
    }

    function createLocationRowInnerHtml(locationName, locationType) {
        var text = locationName != null ? String(locationName) : '';
        return createLeadingGraphicHtml(text, locationType) + ' ' + text;
    }

    function escapeHtmlAttr(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * Hero archive slide: rows with flag from `country` (same rules as secondary countries) + reasoning.
     * Accepts legacy string[] ("Place, Country") or { locationName, country, reasoning }[].
     * @param {Array<string|{locationName?:string,name?:string,country?:string,reasoning?:string}>|null|undefined} entries
     * @param {string} [locationType]
     * @returns {string} HTML fragment
     */
    /** If location text already ends with ", Country", avoid duplicating country in the label. */
    function dedupeLocNameForHeroRow(locName, country) {
        var ln = stripTrailingCommaSep(locName);
        var c = stripTrailingCommaSep(country);
        if (!ln || !c) return ln;
        var ix = ln.lastIndexOf(',');
        if (ix < 0) return ln;
        var lastSeg = ln.slice(ix + 1).trim();
        if (lastSeg.toLowerCase() === c.toLowerCase()) {
            return stripTrailingCommaSep(ln.slice(0, ix));
        }
        return ln;
    }

    function createRelevantLocationsSlideHtml(entries, locationType) {
        var t = locationType || 'earth';
        var list = Array.isArray(entries) ? entries : [];
        var rowParts = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var locName = '';
            var country = '';
            var reasoning = '';
            if (typeof item === 'string') {
                var s0 = stripTrailingCommaSep(String(item));
                if (!s0) continue;
                var ix = s0.lastIndexOf(',');
                if (ix >= 0) {
                    locName = stripTrailingCommaSep(s0.slice(0, ix));
                    country = stripTrailingCommaSep(s0.slice(ix + 1));
                } else {
                    locName = s0;
                }
            } else if (item && typeof item === 'object') {
                locName = stripTrailingCommaSep(
                    item.locationName != null ? String(item.locationName) : ''
                );
                if (!locName && item.name != null) locName = stripTrailingCommaSep(String(item.name));
                country = stripTrailingCommaSep(item.country != null ? String(item.country) : '');
                reasoning = item.reasoning != null ? String(item.reasoning).trim() : '';
            }
            if (!locName && !country && !reasoning) continue;

            /* If everything was typed in "Location" as "City, Country" and country column is empty, split for flag lookup. */
            if (!country && locName) {
                var inferred = extractCountryFromDisplay(locName);
                if (inferred) {
                    country = inferred;
                    var ixCut = locName.lastIndexOf(',');
                    if (ixCut >= 0) {
                        locName = stripTrailingCommaSep(locName.slice(0, ixCut));
                    }
                }
            }

            locName = dedupeLocNameForHeroRow(locName, country);

            /* Multiple countries in one field (e.g. "Egypt, Angola") → one flag each in a row. */
            var countryTokens = (country || '')
                .split(',')
                .map(function (s) {
                    return stripTrailingCommaSep(s);
                })
                .filter(Boolean);
            var manyCountryTokens = countryTokens.length > 1;
            var lead = '';
            if (country && countryTokens.length > 1) {
                lead = '<span class="event-slide-relevant-locations__flag-row">';
                for (var ti = 0; ti < countryTokens.length; ti += 1) {
                    var tok = countryTokens[ti];
                    var fMulti = resolveManualCountryTokenToFlagFile(tok, t);
                    if (!fMulti && locName) {
                        fMulti = getResolvedFlagFilename(locName + ', ' + tok, t);
                    }
                    if (!fMulti) {
                        fMulti = getResolvedFlagFilename(tok, t);
                    }
                    lead += fMulti ? flagImg(fMulti) : pinImg();
                }
                lead += '</span>';
            } else {
                /* Single country token: prefer explicit `country`, then "Place, Country", then place-only. */
                var flagFn = null;
                if (country) {
                    flagFn = resolveManualCountryTokenToFlagFile(country, t);
                }
                if (!flagFn && locName && country) {
                    flagFn = getResolvedFlagFilename(locName + ', ' + country, t);
                }
                if (!flagFn && locName) {
                    flagFn = getResolvedFlagFilename(locName, t);
                }
                lead = flagFn ? flagImg(flagFn) : pinImg();
            }

            /* With a group label + many countries: flags carry geography; do not repeat the full country list in prose. */
            var mainText;
            if (locName && country) {
                if (manyCountryTokens) {
                    mainText = escapeHtmlAttr(locName);
                } else {
                    mainText =
                        escapeHtmlAttr(locName) +
                        '<span class="event-slide-relevant-locations__comma-country">, ' +
                        escapeHtmlAttr(country) +
                        '</span>';
                }
            } else if (locName) {
                mainText = escapeHtmlAttr(locName);
            } else if (country) {
                if (manyCountryTokens) {
                    mainText =
                        escapeHtmlAttr(String(countryTokens.length)) +
                        ' countries';
                } else {
                    mainText = escapeHtmlAttr(country);
                }
            } else {
                mainText = '';
            }

            var mainBlock =
                lead + '<span class="event-slide-relevant-locations__main">' + mainText + '</span>';

            var reasonSuffix = reasoning
                ? '<span class="event-slide-relevant-locations__reason">' +
                  escapeHtmlAttr(' — ' + reasoning) +
                  '</span>'
                : '';
            rowParts.push(
                '<div class="event-slide-relevant-locations__row">' + mainBlock + reasonSuffix + '</div>'
            );
        }
        if (!rowParts.length) return '';
        return rowParts.join('');
    }

    /**
     * Rows for slide display: `secondaryCountryPlaces` (story), else hero/faction/NPC `relevantLocations`,
     * else one synthetic row from legacy `secondaryCountryFlags`.
     * @param {Object|null} ev
     * @returns {Array<{locationName?: string, country?: string, reasoning?: string}>}
     */
    function getSecondaryCountryPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        var places = ev.secondaryCountryPlaces;
        if (Array.isArray(places) && places.length > 0) {
            return places;
        }
        var rel = ev.relevantLocations;
        if (Array.isArray(rel) && rel.length > 0) {
            return rel;
        }
        var flags = ev.secondaryCountryFlags;
        if (!Array.isArray(flags) || flags.length === 0) return [];
        var formSvc = typeof window !== 'undefined' ? window.eventManager?.formService : null;
        var countryText =
            formSvc && typeof formSvc.secondaryFlagsToFormString === 'function'
                ? formSvc.secondaryFlagsToFormString(flags)
                : flags.join(', ');
        return countryText ? [{ locationName: '', country: countryText, reasoning: '' }] : [];
    }

    /** Hide hero/story shared "Relevant locations" block under the description. */
    function clearRelevantLocationsSlideDom() {
        var relEl = typeof document !== 'undefined' ? document.getElementById('eventSlideRelevantLocations') : null;
        var relSection = typeof document !== 'undefined' ? document.getElementById('eventRelevantLocationsSection') : null;
        if (relEl) relEl.innerHTML = '';
        if (relSection) relSection.style.display = 'none';
    }

    /**
     * Slide "Relevant locations" block: same HTML as hero editor, from `secondaryCountryPlaces`, `relevantLocations`, or legacy flags.
     * @param {Object|null} ev
     */
    function updateRelevantLocationsSlideFromSecondaryPlaces(ev) {
        var relEl = typeof document !== 'undefined' ? document.getElementById('eventSlideRelevantLocations') : null;
        var relSection = typeof document !== 'undefined' ? document.getElementById('eventRelevantLocationsSection') : null;
        if (!relEl) return;
        var rows = getSecondaryCountryPlacesRowsForDisplay(ev);
        var lt = (ev && ev.locationType) || 'earth';
        var inner = rows.length ? createRelevantLocationsSlideHtml(rows, lt) : '';
        relEl.innerHTML = inner;
        if (relSection) relSection.style.display = inner ? 'block' : 'none';
    }

    var ICON_HERO_CAT = 'assets/images/icons/Heroes Icon.png';
    var ICON_FACTION_CAT = 'assets/images/icons/Factions Icon.png';
    var ICON_NPC_CAT = 'assets/images/icons/NPC Icon.png';

    function clonePlaceRowObjects(arr) {
        if (!Array.isArray(arr)) return [];
        return arr.map(function (p) {
            return {
                locationName: p && p.locationName != null ? String(p.locationName) : '',
                country: p && p.country != null ? String(p.country) : '',
                reasoning: p && p.reasoning != null ? String(p.reasoning) : ''
            };
        });
    }

    function migrateHeroPlacesFromFilters(filters) {
        if (!Array.isArray(filters) || filters.length === 0) return [];
        return [{ locationName: '', country: filters.join(', '), reasoning: '' }];
    }

    function migrateFactionPlacesFromFactions(factions) {
        if (!Array.isArray(factions) || factions.length === 0) return [];
        var formSvc = typeof window !== 'undefined' ? window.eventManager?.formService : null;
        var manifest =
            window.eventManager?.factions?.length > 0
                ? window.eventManager.factions
                : window.globeController?.dataModel?.factions || [];
        var display =
            formSvc && typeof formSvc.factionsArrayToFormDisplayString === 'function'
                ? formSvc.factionsArrayToFormDisplayString(factions, manifest || [])
                : factions.map(function (f) { return String(f).replace(/^\d+/, '').trim(); }).join(', ');
        return [{ locationName: '', country: display, reasoning: '' }];
    }

    function migrateNpcPlacesFromNpcs(npcs) {
        if (!Array.isArray(npcs) || npcs.length === 0) return [];
        return [{ locationName: '', country: npcs.join(', '), reasoning: '' }];
    }

    /** @param {Object|null} ev */
    function getHeroFilterPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        if (Array.isArray(ev.heroFilterPlaces) && ev.heroFilterPlaces.length > 0) {
            return clonePlaceRowObjects(ev.heroFilterPlaces);
        }
        return migrateHeroPlacesFromFilters(ev.filters || []);
    }

    function getFactionFilterPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        if (Array.isArray(ev.factionFilterPlaces) && ev.factionFilterPlaces.length > 0) {
            return clonePlaceRowObjects(ev.factionFilterPlaces);
        }
        return migrateFactionPlacesFromFactions(ev.factions || []);
    }

    function getNpcFilterPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        if (Array.isArray(ev.npcFilterPlaces) && ev.npcFilterPlaces.length > 0) {
            return clonePlaceRowObjects(ev.npcFilterPlaces);
        }
        return migrateNpcPlacesFromNpcs(ev.npcs || []);
    }

    function resolveHeroImageKey(token) {
        var t = stripTrailingCommaSep(String(token || '')).trim();
        if (!t) return '';
        var list = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
        var nk = normalizeKey(t);
        for (var i = 0; i < list.length; i++) {
            if (normalizeKey(list[i]) === nk) return String(list[i]);
        }
        return t;
    }

    function resolveNpcImageKey(token) {
        var t = stripTrailingCommaSep(String(token || '')).trim();
        if (!t) return '';
        var list = window.eventManager?.npcs || [];
        var nk = normalizeKey(t);
        for (var i = 0; i < list.length; i++) {
            if (normalizeKey(list[i]) === nk) return String(list[i]);
        }
        return t;
    }

    function resolveFactionImageFilename(rawFaction) {
        var raw = String(rawFaction || '').trim();
        if (!raw) return null;
        var factions =
            window.eventManager?.factions?.length > 0
                ? window.eventManager.factions
                : window.globeController?.dataModel?.factions || [];
        var fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
        for (var i = 0; i < factions.length; i++) {
            var f = factions[i];
            var fn = f && f.filename ? String(f.filename).trim() : '';
            var dn = f && f.displayName ? String(f.displayName).trim() : '';
            if (!fn) continue;
            if (fn === raw || dn === raw) return fn;
            if (fh && typeof fh.factionIdsMatch === 'function') {
                if (fh.factionIdsMatch(fn, raw) || fh.factionIdsMatch(dn, raw)) return fn;
            }
        }
        var bare = raw.replace(/^\d+/, '').trim();
        for (var j = 0; j < factions.length; j++) {
            var f2 = factions[j];
            var fn2 = f2 && f2.filename ? String(f2.filename).trim() : '';
            if (!fn2) continue;
            if (normalizeKey(fn2.replace(/^\d+/, '').trim()) === normalizeKey(bare)) return fn2;
        }
        return null;
    }

    function filterFallbackIconSrc(kind) {
        if (kind === 'factions') return ICON_FACTION_CAT;
        if (kind === 'npcs') return ICON_NPC_CAT;
        return ICON_HERO_CAT;
    }

    function filterTokenImgHtml(kind, token) {
        var t = stripTrailingCommaSep(String(token || '')).trim();
        if (!t) return '';
        var src = '';
        var fb = filterFallbackIconSrc(kind).replace(/'/g, "\\'");
        if (kind === 'heroes') {
            var hk = resolveHeroImageKey(t);
            var canon = hk || t;
            src = 'assets/images/heroes/' + encodeURIComponent(canon) + '.png';
            var dataEnc = encodeURIComponent(canon);
            return (
                '<img class="event-slide-filter-token-img event-slide-filter-token-img--heroes event-slide-filter-token-img--clickable-hero" ' +
                'data-hero-open="' +
                dataEnc +
                '" role="button" tabindex="0" ' +
                'src="' +
                src +
                '" alt="" title="Open ' +
                escapeHtmlAttr(canon) +
                ' in Heroes archive" width="52" height="52" decoding="async" onerror="this.onerror=null;this.src=\'' +
                fb +
                '\';" />'
            );
        }
        if (kind === 'npcs') {
            var nk = resolveNpcImageKey(t);
            src = 'assets/images/npcs/' + encodeURIComponent(nk || t) + '.png';
        } else if (kind === 'factions') {
            var ff = resolveFactionImageFilename(t);
            if (!ff) return '';
            src = 'assets/images/factions/' + encodeURIComponent(ff) + '.png';
        } else {
            return '';
        }
        return (
            '<img class="event-slide-filter-token-img event-slide-filter-token-img--' +
            kind +
            '" src="' +
            src +
            '" alt="" width="52" height="52" decoding="async" onerror="this.onerror=null;this.src=\'' +
            fb +
            '\';" />'
        );
    }

    /** One-time: hero portraits in story relevancy open that hero’s Heroes archive slide. */
    function wireStoryFilterSectionHeroArchiveNav(sec) {
        if (!sec || sec.dataset.heroArchiveNavWired === '1') return;
        sec.dataset.heroArchiveNavWired = '1';

        function activateFromImg(img) {
            if (!img) return;
            var enc = img.getAttribute('data-hero-open');
            if (!enc) return;
            var name = decodeURIComponent(enc);
            var em = window.eventManager;
            if (em && typeof em.openHeroArchiveEventByName === 'function') {
                void em.openHeroArchiveEventByName(name);
            }
        }

        sec.addEventListener('click', function (e) {
            var img = e.target.closest('img.event-slide-filter-token-img--clickable-hero[data-hero-open]');
            if (!img || !sec.contains(img)) return;
            e.preventDefault();
            activateFromImg(img);
        });

        sec.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var t = e.target;
            if (!t || String(t.tagName || '').toLowerCase() !== 'img') return;
            if (!t.classList.contains('event-slide-filter-token-img--clickable-hero')) return;
            if (!t.getAttribute('data-hero-open')) return;
            if (!sec.contains(t)) return;
            e.preventDefault();
            activateFromImg(t);
        });
    }

    /**
     * Story slide: grouped heroes / factions / NPCs — same row layout as relevant locations, filter icons instead of flags.
     * @param {Array<{locationName?:string,country?:string,reasoning?:string}>} rows
     * @param {'heroes'|'factions'|'npcs'} kind
     */
    function createStoryFilterPlacesSlideHtml(rows, kind) {
        var list = Array.isArray(rows) ? rows : [];
        var rowParts = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var locName = stripTrailingCommaSep(item.locationName != null ? String(item.locationName) : '');
            var country = stripTrailingCommaSep(item.country != null ? String(item.country) : '');
            var reasoning = item.reasoning != null ? String(item.reasoning).trim() : '';
            if (!locName && !country && !reasoning) continue;

            var tokens = (country || '')
                .split(',')
                .map(function (s) { return stripTrailingCommaSep(s); })
                .filter(Boolean);
            var manyTokens = tokens.length > 1;
            var lead = '';
            if (tokens.length > 0) {
                lead = '<span class="event-slide-relevant-locations__flag-row">';
                for (var ti = 0; ti < tokens.length; ti += 1) {
                    var one = filterTokenImgHtml(kind, tokens[ti]);
                    if (one) lead += one;
                }
                lead += '</span>';
            } else {
                lead =
                    '<img class="event-slide-filter-token-img event-slide-filter-token-img--' +
                    kind +
                    '" src="' +
                    filterFallbackIconSrc(kind).replace(/'/g, "\\'") +
                    '" alt="" width="44" height="44" decoding="async" />';
            }

            var mainText;
            if (locName && country) {
                if (manyTokens) {
                    mainText = escapeHtmlAttr(locName);
                } else {
                    mainText =
                        escapeHtmlAttr(locName) +
                        '<span class="event-slide-relevant-locations__comma-country">, ' +
                        escapeHtmlAttr(stripTrailingCommaSep(tokens[0] || country)) +
                        '</span>';
                }
            } else if (locName) {
                mainText = escapeHtmlAttr(locName);
            } else if (country) {
                if (manyTokens) {
                    mainText = escapeHtmlAttr(String(tokens.length)) + ' ' + (kind === 'factions' ? 'factions' : kind === 'npcs' ? 'NPCs' : 'heroes');
                } else {
                    mainText = escapeHtmlAttr(stripTrailingCommaSep(tokens[0] || country));
                }
            } else {
                mainText = '';
            }

            var mainBlock =
                lead + '<span class="event-slide-relevant-locations__main">' + mainText + '</span>';
            var reasonSuffix = reasoning
                ? '<span class="event-slide-relevant-locations__reason">' +
                  escapeHtmlAttr(' — ' + reasoning) +
                  '</span>'
                : '';
            rowParts.push(
                '<div class="event-slide-relevant-locations__row">' + mainBlock + reasonSuffix + '</div>'
            );
        }
        if (!rowParts.length) return '';
        return rowParts.join('');
    }

    function clearStoryFilterPlacesSlideDom() {
        var sec = typeof document !== 'undefined' ? document.getElementById('eventStoryFilterPlacesSection') : null;
        if (sec) {
            sec.innerHTML = '';
            sec.style.display = 'none';
        }
    }

    /**
     * Renders grouped hero / faction / NPC rows under the description (read-only, like Relevant locations).
     * @param {Object|null} ev
     */
    function updateStoryFilterPlacesSlideFromEvent(ev) {
        var sec = typeof document !== 'undefined' ? document.getElementById('eventStoryFilterPlacesSection') : null;
        if (!sec) return;
        var arch = typeof window !== 'undefined' && window.eventManager?.dataService?.getArchiveSource
            ? window.eventManager.dataService.getArchiveSource()
            : 'story';
        /** Main-timeline dock slide uses story event data even if Event Manager archive is still heroes/factions/etc. */
        var dockStoryPresentation =
            typeof window !== 'undefined'
            && window.standaloneEventSlide
            && window.standaloneEventSlide._presentationFromDockTimeline === true;
        var useStoryGroupedRelevancy = arch === 'story' || dockStoryPresentation;
        if (!useStoryGroupedRelevancy) {
            sec.innerHTML = '';
            sec.style.display = 'none';
            return;
        }
        var heroRows = getHeroFilterPlacesRowsForDisplay(ev);
        var facRows = getFactionFilterPlacesRowsForDisplay(ev);
        var npcRows = getNpcFilterPlacesRowsForDisplay(ev);
        var heroHtml = heroRows.length ? createStoryFilterPlacesSlideHtml(heroRows, 'heroes') : '';
        var facHtml = facRows.length ? createStoryFilterPlacesSlideHtml(facRows, 'factions') : '';
        var npcHtml = npcRows.length ? createStoryFilterPlacesSlideHtml(npcRows, 'npcs') : '';
        var parts = [];
        if (heroHtml) {
            parts.push(
                '<h4 class="event-filter-header event-filter-header--category">' +
                    '<img class="event-filter-header-icon" src="' +
                    ICON_HERO_CAT +
                    '" alt="" width="20" height="20" decoding="async" />' +
                    '<span class="event-filter-header-label">Relevant heroes</span>' +
                '</h4>' +
                '<div class="event-slide-relevant-locations">' +
                    heroHtml +
                '</div>'
            );
        }
        if (facHtml) {
            parts.push(
                '<h4 class="event-filter-header event-filter-header--category">' +
                    '<img class="event-filter-header-icon" src="' +
                    ICON_FACTION_CAT +
                    '" alt="" width="20" height="20" decoding="async" />' +
                    '<span class="event-filter-header-label">Relevant factions</span>' +
                '</h4>' +
                '<div class="event-slide-relevant-locations">' +
                    facHtml +
                '</div>'
            );
        }
        if (npcHtml) {
            parts.push(
                '<h4 class="event-filter-header event-filter-header--category">' +
                    '<img class="event-filter-header-icon" src="' +
                    ICON_NPC_CAT +
                    '" alt="" width="20" height="20" decoding="async" />' +
                    '<span class="event-filter-header-label">Relevant NPCs</span>' +
                '</h4>' +
                '<div class="event-slide-relevant-locations">' +
                    npcHtml +
                '</div>'
            );
        }
        sec.innerHTML = parts.join('');
        sec.style.display = parts.length ? 'block' : 'none';
        wireStoryFilterSectionHeroArchiveNav(sec);
    }

    /**
     * Resolve one manual token (e.g. from "Secondary countries" field) to a flag PNG filename.
     * Tries full-display rules first, then plain country name lookup.
     */
    function resolveManualCountryTokenToFlagFile(token, locationType) {
        var trimmed = stripTrailingCommaSep(token);
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

    /**
     * Story timeline: flatten `secondaryCountryPlaces[].country` (comma-separated allowed) into unique flag filenames.
     * @param {Array<{locationName?: string, country?: string, reasoning?: string}>} places
     * @param {string} [locationType]
     * @returns {string[]}
     */
    function deriveSecondaryCountryFlagFilenamesFromPlaces(places, locationType) {
        var lt = locationType || 'earth';
        var seen = {};
        var out = [];
        if (!Array.isArray(places)) return out;
        places.forEach(function (row) {
            var c = row && row.country != null ? String(row.country) : '';
            var list = parseSecondaryCountryList(c, lt);
            list.forEach(function (fn) {
                if (fn && !seen[fn]) {
                    seen[fn] = true;
                    out.push(fn);
                }
            });
        });
        return out;
    }

    /**
     * True when the first `secondaryCountryPlaces` row is already the primary location row
     * (same location label as `cityDisplayName` and at least one resolved flag matches the primary).
     */
    function firstSecondaryRowAlreadyMatchesPrimary(places, city, lt, primaryFn) {
        if (!Array.isArray(places) || !places.length || !city || !primaryFn) return false;
        var p0 = places[0];
        if (String(p0.locationName || '').trim() !== city) return false;
        var derived = deriveSecondaryCountryFlagFilenamesFromPlaces([p0], lt);
        for (var di = 0; di < derived.length; di++) {
            if (derived[di] === primaryFn) return true;
        }
        return false;
    }

    /**
     * Story timeline: prepend one row derived from the primary location so grouped relevant-locations
     * always includes the base country (same flag as the location line). Idempotent.
     * @param {Object|null} node - single event or one variant object
     */
    function ensurePrimaryLocationAsFirstSecondaryPlace(node) {
        if (!node || typeof node !== 'object') return;
        var city = stripTrailingCommaSep(node.cityDisplayName != null ? String(node.cityDisplayName) : '').trim();
        if (!city) return;
        var lt = node.locationType || 'earth';
        var primaryFn = getResolvedFlagFilename(city, lt);
        if (!primaryFn) return;

        var places = Array.isArray(node.secondaryCountryPlaces) ? node.secondaryCountryPlaces : [];
        if (firstSecondaryRowAlreadyMatchesPrimary(places, city, lt, primaryFn)) {
            return;
        }

        var countryToken = extractCountryFromDisplay(city);
        if (countryToken) {
            var viaTok = resolveManualCountryTokenToFlagFile(countryToken, lt);
            if (viaTok !== primaryFn) {
                countryToken = commonLabelForFlagFile(primaryFn);
            }
        } else {
            countryToken = commonLabelForFlagFile(primaryFn);
        }

        var primaryRow = { locationName: city, country: countryToken, reasoning: '' };
        node.secondaryCountryPlaces = [primaryRow].concat(places);
    }

    /**
     * Mutates a single event or variant: sets `secondaryCountryFlags` from `secondaryCountryPlaces`, or clears it.
     * @param {Object|null} node
     */
    function syncSecondaryCountryFlagsOnEntity(node) {
        if (!node || typeof node !== 'object') return;
        var places = node.secondaryCountryPlaces;
        var lt = node.locationType || 'earth';
        if (Array.isArray(places) && places.length > 0) {
            var derived = deriveSecondaryCountryFlagFilenamesFromPlaces(places, lt);
            node.secondaryCountryFlags = derived.length > 0 ? derived : undefined;
        } else {
            node.secondaryCountryFlags = undefined;
        }
    }

    /**
     * Flag filenames for country filter / chips: prefer grouped `secondaryCountryPlaces`, else legacy `secondaryCountryFlags`.
     * @param {Object|null} ev
     * @returns {string[]}
     */
    function getSecondaryCountryFlagFilenamesForEntity(ev) {
        if (!ev) return [];
        var places = ev.secondaryCountryPlaces;
        var lt = ev.locationType || 'earth';
        if (Array.isArray(places) && places.length > 0) {
            return deriveSecondaryCountryFlagFilenamesFromPlaces(places, lt);
        }
        var rel = ev.relevantLocations;
        if (Array.isArray(rel) && rel.length > 0) {
            return deriveSecondaryCountryFlagFilenamesFromPlaces(rel, lt);
        }
        return Array.isArray(ev.secondaryCountryFlags) ? ev.secondaryCountryFlags.slice() : [];
    }

    function _migrateOneStoryTimelineNode(node) {
        if (!node || typeof node !== 'object') return;
        var places = node.secondaryCountryPlaces;
        if (!Array.isArray(places) || places.length === 0) {
            var flags = node.secondaryCountryFlags;
            var formSvc = typeof window !== 'undefined' ? window.eventManager?.formService : null;
            var countryText = '';
            if (Array.isArray(flags) && flags.length > 0) {
                countryText =
                    formSvc && typeof formSvc.secondaryFlagsToFormString === 'function'
                        ? formSvc.secondaryFlagsToFormString(flags)
                        : flags.join(', ');
                node.secondaryCountryPlaces = [{ locationName: '', country: countryText, reasoning: '' }];
            } else {
                node.secondaryCountryPlaces = [];
            }
        }
        ensurePrimaryLocationAsFirstSecondaryPlace(node);
        syncSecondaryCountryFlagsOnEntity(node);
    }

    /**
     * Main timeline story events: ensure `secondaryCountryPlaces` exists and `secondaryCountryFlags` stays in sync.
     * @param {Object} ev
     */
    function migrateStoryEventSecondaryPlaces(ev) {
        if (!ev) return;
        if (Array.isArray(ev.variants) && ev.variants.length > 0) {
            ev.variants.forEach(_migrateOneStoryTimelineNode);
        } else {
            _migrateOneStoryTimelineNode(ev);
        }
    }

    /**
     * @param {Array<Object>} events
     */
    function migrateAllStoryEventsSecondaryPlaces(events) {
        if (!Array.isArray(events)) return;
        events.forEach(migrateStoryEventSecondaryPlaces);
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
        var sec = getSecondaryCountryFlagFilenamesForEntity(ev);
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
        createRelevantLocationsSlideHtml: createRelevantLocationsSlideHtml,
        getSecondaryCountryPlacesRowsForDisplay: getSecondaryCountryPlacesRowsForDisplay,
        clearRelevantLocationsSlideDom: clearRelevantLocationsSlideDom,
        updateRelevantLocationsSlideFromSecondaryPlaces: updateRelevantLocationsSlideFromSecondaryPlaces,
        getHeroFilterPlacesRowsForDisplay: getHeroFilterPlacesRowsForDisplay,
        getFactionFilterPlacesRowsForDisplay: getFactionFilterPlacesRowsForDisplay,
        getNpcFilterPlacesRowsForDisplay: getNpcFilterPlacesRowsForDisplay,
        createStoryFilterPlacesSlideHtml: createStoryFilterPlacesSlideHtml,
        clearStoryFilterPlacesSlideDom: clearStoryFilterPlacesSlideDom,
        updateStoryFilterPlacesSlideFromEvent: updateStoryFilterPlacesSlideFromEvent,
        flagSrc: flagSrc,
        getFlagLocationContext: getFlagLocationContext,
        getResolvedFlagFilename: getResolvedFlagFilename,
        parseSecondaryCountryList: parseSecondaryCountryList,
        deriveSecondaryCountryFlagFilenamesFromPlaces: deriveSecondaryCountryFlagFilenamesFromPlaces,
        syncSecondaryCountryFlagsOnEntity: syncSecondaryCountryFlagsOnEntity,
        getSecondaryCountryFlagFilenamesForEntity: getSecondaryCountryFlagFilenamesForEntity,
        migrateStoryEventSecondaryPlaces: migrateStoryEventSecondaryPlaces,
        migrateAllStoryEventsSecondaryPlaces: migrateAllStoryEventsSecondaryPlaces,
        getCountryCommonNamesForAutocomplete: getCountryCommonNamesForAutocomplete,
        collectCountryFlagFilesForEntity: collectCountryFlagFilesForEntity,
        commonLabelForFlagFile: commonLabelForFlagFile
    };
})();
