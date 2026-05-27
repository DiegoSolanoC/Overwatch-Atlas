/**
 * Country-flag chips, primary-row mirroring on story events, and the
 * country-filter feed that powers `country:<flagFile>` lock keys.
 *
 * Inputs the rest of the slide / event-manager flow lean on:
 *   - `getSecondaryCountryFlagFilenamesForEntity(ev)` — best source list,
 *     preferring `secondaryCountryPlaces`, then bio `relevantLocations`,
 *     then legacy `secondaryCountryFlags`.
 *   - `collectCountryFlagFilesForEntity(ev)` — primary + secondary +
 *     explicit `countries[]`, deduped in display order. Used by the filter
 *     panel and `markers/filtering/entityMatchesActiveFilters.js`.
 *   - `ensurePrimaryLocationAsFirstSecondaryPlace(node)` — on save, prepend
 *     a row mirroring `cityDisplayName` so the secondary list always
 *     surfaces the base country flag.
 *   - `migrateAllStoryEventsSecondaryPlaces(events)` — idempotent migration
 *     that strips persisted `secondaryCountryFlags` and keeps the grouped
 *     `secondaryCountryPlaces` rows authoritative.
 */
(function () {
    'use strict';

    var R = window.__FlagFileResolver;

    function resolveManualCountryTokenToFlagFile(token, locationType) {
        var trimmed = R.stripTrailingCommaSep(token);
        if (!trimmed) return null;
        // Prefer explicit real-country resolution first so moon/mars event types
        // don't override Earth country tokens like "Gibraltar" / "Australia".
        var directCountry = R.resolveCountryToFilename(trimmed);
        if (directCountry) return directCountry;
        var t = locationType || 'earth';
        var viaDisplay = R.getResolvedFlagFilename(trimmed, t);
        if (viaDisplay) return viaDisplay;
        return null;
    }

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

    function deriveSecondaryCountryFlagFilenamesFromPlaces(places, locationType) {
        var lt = locationType || 'earth';
        var seen = {};
        var out = [];
        if (!Array.isArray(places)) return out;
        places.forEach(function (row) {
            var c = row && row.country != null ? String(row.country) : '';
            parseSecondaryCountryList(c, lt).forEach(function (fn) {
                if (fn && !seen[fn]) {
                    seen[fn] = true;
                    out.push(fn);
                }
            });
        });
        return out;
    }

    /** True when the first `secondaryCountryPlaces` row already mirrors the primary `cityDisplayName` row. */
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

    /** Idempotent. Prepends one row mirroring the primary location so grouped relevancy shows the base country. */
    function ensurePrimaryLocationAsFirstSecondaryPlace(node) {
        if (!node || typeof node !== 'object') return;
        var city = R.stripTrailingCommaSep(node.cityDisplayName != null ? String(node.cityDisplayName) : '').trim();
        if (!city) return;
        var lt = node.locationType || 'earth';
        var primaryFn = R.getResolvedFlagFilename(city, lt);
        if (!primaryFn) return;

        var places = Array.isArray(node.secondaryCountryPlaces) ? node.secondaryCountryPlaces : [];
        if (firstSecondaryRowAlreadyMatchesPrimary(places, city, lt, primaryFn)) return;

        var countryToken = R.extractCountryFromDisplay(city);
        if (countryToken) {
            var viaTok = resolveManualCountryTokenToFlagFile(countryToken, lt);
            if (viaTok !== primaryFn) countryToken = R.commonLabelForFlagFile(primaryFn);
        } else {
            countryToken = R.commonLabelForFlagFile(primaryFn);
        }

        var primaryRow = { locationName: city, country: countryToken, reasoning: '' };
        node.secondaryCountryPlaces = [primaryRow].concat(places);
    }

    /** Drop persisted `secondaryCountryFlags`. Filenames are always derived from places. */
    function syncSecondaryCountryFlagsOnEntity(node) {
        if (!node || typeof node !== 'object') return;
        delete node.secondaryCountryFlags;
    }

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
            if (Array.isArray(flags) && flags.length > 0) {
                var countryText =
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

    function migrateStoryEventSecondaryPlaces(ev) {
        if (!ev) return;
        if (Array.isArray(ev.variants) && ev.variants.length > 0) {
            ev.variants.forEach(_migrateOneStoryTimelineNode);
        } else {
            _migrateOneStoryTimelineNode(ev);
        }
    }

    function migrateAllStoryEventsSecondaryPlaces(events) {
        if (!Array.isArray(events)) return;
        events.forEach(migrateStoryEventSecondaryPlaces);
    }

    /** Primary + secondary + explicit `countries[]`, deduped in display order. */
    function collectCountryFlagFilesForEntity(ev) {
        var ordered = [];
        var seen = new Set();
        var loc = (ev && ev.cityDisplayName != null) ? String(ev.cityDisplayName) : '';
        var locType = (ev && ev.locationType) ? String(ev.locationType) : 'earth';
        var primary = R.getResolvedFlagFilename(loc, locType);
        if (primary) {
            seen.add(primary);
            ordered.push(primary);
        }
        getSecondaryCountryFlagFilenamesForEntity(ev).forEach(function (f) {
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

    window.__SecondaryCountryFlags = {
        resolveManualCountryTokenToFlagFile: resolveManualCountryTokenToFlagFile,
        parseSecondaryCountryList: parseSecondaryCountryList,
        deriveSecondaryCountryFlagFilenamesFromPlaces: deriveSecondaryCountryFlagFilenamesFromPlaces,
        ensurePrimaryLocationAsFirstSecondaryPlace: ensurePrimaryLocationAsFirstSecondaryPlace,
        syncSecondaryCountryFlagsOnEntity: syncSecondaryCountryFlagsOnEntity,
        getSecondaryCountryFlagFilenamesForEntity: getSecondaryCountryFlagFilenamesForEntity,
        migrateStoryEventSecondaryPlaces: migrateStoryEventSecondaryPlaces,
        migrateAllStoryEventsSecondaryPlaces: migrateAllStoryEventsSecondaryPlaces,
        collectCountryFlagFilesForEntity: collectCountryFlagFilesForEntity
    };
})();
