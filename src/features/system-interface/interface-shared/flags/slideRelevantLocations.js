/**
 * "Relevant locations" block under the event description on the slide.
 *
 * Inputs accepted by `createRelevantLocationsSlideHtml`:
 *   - legacy strings ("Cairo, Egypt"), or
 *   - `{ locationName, country, reasoning }` rows (heroes / story rows).
 *
 * Per row we:
 *   1. Strip trailing punctuation, then split `country` on commas.
 *   2. For each token, resolve to a flag PNG; fall back to the pin icon.
 *   3. If a country segment is repeated inside `locationName`, drop it from
 *      the label so we don't print "Cairo, Egypt, Egypt".
 *   4. Compose the lead (flag row / single flag / pin) + main label
 *      (`locationName` + optional `, Country`) + reasoning suffix.
 *
 * `updateRelevantLocationsSlideFromSecondaryPlaces` is the public entry the
 * slide pipeline calls after each event swap.
 */
(function () {
    'use strict';

    var R = window.__FlagFileResolver;
    var S = window.__SecondaryCountryFlags;
    var H = window.__RelevancyRowFilterHighlight;

    /** If `locName` already ends with ", Country", drop the duplicate. */
    function dedupeLocNameForHeroRow(locName, country) {
        var ln = R.stripTrailingCommaSep(locName);
        var c = R.stripTrailingCommaSep(country);
        if (!ln || !c) return ln;
        var ix = ln.lastIndexOf(',');
        if (ix < 0) return ln;
        var lastSeg = ln.slice(ix + 1).trim();
        if (lastSeg.toLowerCase() === c.toLowerCase()) {
            return R.stripTrailingCommaSep(ln.slice(0, ix));
        }
        return ln;
    }

    /**
     * Filter-menu style flag chip (8:5 tile + hover name band).
     * @param {string|null} flagFile
     * @param {string} label
     * @returns {string}
     */
    function locationFlagChipHtml(flagFile, label) {
        var fn = String(flagFile || '').trim();
        var pin = !fn;
        var src = pin ? R.LOC_ICON : R.flagSrc(fn);
        var labelText = String(label || '').trim()
            || (fn ? R.commonLabelForFlagFile(fn) : 'Location');
        var dataAttr = fn
            ? ' data-relevancy-flag-file="' + R.escapeHtmlAttr(fn) + '"'
            : '';
        var escPin = R.LOC_ICON.replace(/'/g, "\\'");
        return (
            '<div class="gallery-hero-filters__chip-wrap event-slide-filter-token-chip-wrap event-slide-filter-token-chip-wrap--flag">' +
                '<span class="filter-btn gallery-hero-filters__chip event-slide-filter-token-chip event-slide-filter-token-chip--flag" aria-hidden="true">' +
                    '<div class="filter-image-container">' +
                        '<img' + dataAttr + ' src="' + src + '" alt="" decoding="async" ' +
                        'onerror="this.onerror=null;this.src=\'' + escPin + '\';" />' +
                    '</div>' +
                    '<div class="filter-label">' +
                        '<span class="filter-label-text">' + R.slideStoryDisplayHtml(labelText) + '</span>' +
                    '</div>' +
                '</span>' +
            '</div>'
        );
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
                var s0 = R.stripTrailingCommaSep(String(item));
                if (!s0) continue;
                var ixStr = s0.lastIndexOf(',');
                if (ixStr >= 0) {
                    locName = R.stripTrailingCommaSep(s0.slice(0, ixStr));
                    country = R.stripTrailingCommaSep(s0.slice(ixStr + 1));
                } else {
                    locName = s0;
                }
            } else if (item && typeof item === 'object') {
                locName = R.stripTrailingCommaSep(item.locationName != null ? String(item.locationName) : '');
                if (!locName && item.name != null) locName = R.stripTrailingCommaSep(String(item.name));
                country = R.stripTrailingCommaSep(item.country != null ? String(item.country) : '');
                reasoning = item.reasoning != null ? String(item.reasoning).trim() : '';
            }
            if (!locName && !country && !reasoning) continue;

            /* If everything was typed as "City, Country" in Location and country column is empty, split it out. */
            if (!country && locName) {
                var inferred = R.extractCountryFromDisplay(locName);
                if (inferred) {
                    country = inferred;
                    var ixCut = locName.lastIndexOf(',');
                    if (ixCut >= 0) locName = R.stripTrailingCommaSep(locName.slice(0, ixCut));
                }
            }

            locName = dedupeLocNameForHeroRow(locName, country);

            var countryTokens = (country || '')
                .split(',')
                .map(function (s) { return R.stripTrailingCommaSep(s); })
                .filter(Boolean);
            var manyCountryTokens = countryTokens.length > 1;
            var lead = '';
            if (countryTokens.length > 0) {
                lead = '<span class="event-slide-relevant-locations__flag-row event-slide-relevant-locations__flag-row--chips">';
                for (var ti = 0; ti < countryTokens.length; ti += 1) {
                    var tok = countryTokens[ti];
                    var fTok = S.resolveManualCountryTokenToFlagFile(tok, t);
                    if (!fTok && locName) fTok = R.getResolvedFlagFilename(locName + ', ' + tok, t);
                    if (!fTok) fTok = R.getResolvedFlagFilename(tok, t);
                    lead += locationFlagChipHtml(fTok, tok);
                }
                lead += '</span>';
            } else {
                /* No country token: try place-only flag, else pin chip. */
                var flagFn = locName ? R.getResolvedFlagFilename(locName, t) : null;
                lead =
                    '<span class="event-slide-relevant-locations__flag-row event-slide-relevant-locations__flag-row--chips">' +
                    locationFlagChipHtml(flagFn, locName || 'Location') +
                    '</span>';
            }

            /* With a group label + many flags, the flags carry geography → skip the country list in prose. */
            var mainText;
            if (locName && country) {
                if (manyCountryTokens) {
                    mainText = R.slideStoryDisplayHtml(locName);
                } else {
                    mainText =
                        R.slideStoryDisplayHtml(locName) +
                        '<span class="event-slide-relevant-locations__comma-country">, ' +
                        R.slideStoryDisplayHtml(country) +
                        '</span>';
                }
            } else if (locName) {
                mainText = R.slideStoryDisplayHtml(locName);
            } else if (country) {
                if (manyCountryTokens) {
                    mainText = countryTokens
                        .map(function (tok) { return R.slideStoryDisplayHtml(tok); })
                        .join('<span class="event-slide-relevant-locations__comma-country">, </span>');
                } else {
                    mainText = R.slideStoryDisplayHtml(country);
                }
            } else {
                mainText = '';
            }

            var mainBlock = lead + '<span class="event-slide-relevant-locations__main">' + mainText + '</span>';
            var reasonSuffix = reasoning
                ? '<span class="event-slide-relevant-locations__reason">' +
                  R.slideStoryDisplayHtml(' — ' + reasoning) +
                  '</span>'
                : '';
            rowParts.push(
                '<div class="event-slide-relevant-locations__row event-slide-relevant-locations__row--with-chips">' +
                mainBlock + reasonSuffix + '</div>'
            );
        }
        if (!rowParts.length) return '';
        return rowParts.join('');
    }

    /**
     * Rows for slide display: `secondaryCountryPlaces` (story), else hero / faction / NPC `relevantLocations`,
     * else one synthetic row from legacy `secondaryCountryFlags`.
     */
    function getSecondaryCountryPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        var places = ev.secondaryCountryPlaces;
        if (Array.isArray(places) && places.length > 0) return places;
        var rel = ev.relevantLocations;
        if (Array.isArray(rel) && rel.length > 0) return rel;
        var flags = ev.secondaryCountryFlags;
        if (!Array.isArray(flags) || flags.length === 0) return [];
        var formSvc = typeof window !== 'undefined' ? window.eventManager?.formService : null;
        var countryText =
            formSvc && typeof formSvc.secondaryFlagsToFormString === 'function'
                ? formSvc.secondaryFlagsToFormString(flags)
                : flags.join(', ');
        return countryText ? [{ locationName: '', country: countryText, reasoning: '' }] : [];
    }

    function clearRelevantLocationsSlideDom() {
        var relEl = typeof document !== 'undefined' ? document.getElementById('eventSlideRelevantLocations') : null;
        var relSection = typeof document !== 'undefined' ? document.getElementById('eventRelevantLocationsSection') : null;
        if (relEl) relEl.innerHTML = '';
        if (relSection) relSection.style.display = 'none';
    }

    function updateRelevantLocationsSlideFromSecondaryPlaces(ev) {
        var relEl = typeof document !== 'undefined' ? document.getElementById('eventSlideRelevantLocations') : null;
        var relSection = typeof document !== 'undefined' ? document.getElementById('eventRelevantLocationsSection') : null;
        if (!relEl) return;
        var rows = getSecondaryCountryPlacesRowsForDisplay(ev);
        var lt = (ev && ev.locationType) || 'earth';
        var inner = rows.length ? createRelevantLocationsSlideHtml(rows, lt) : '';
        relEl.innerHTML = inner;
        if (relSection) relSection.style.display = inner ? 'block' : 'none';
        requestAnimationFrame(function () {
            var root = relSection || relEl;
            if (typeof window.__fitHeroChipLabelTextInRoot === 'function') {
                window.__fitHeroChipLabelTextInRoot(root);
            }
            if (typeof window.__wireSlideChipFloatingLabels === 'function') {
                window.__wireSlideChipFloatingLabels(root);
            }
        });
        H.scheduleApplyRelevancyRowFilterHighlight();
    }

    window.__SlideRelevantLocations = {
        createRelevantLocationsSlideHtml: createRelevantLocationsSlideHtml,
        getSecondaryCountryPlacesRowsForDisplay: getSecondaryCountryPlacesRowsForDisplay,
        clearRelevantLocationsSlideDom: clearRelevantLocationsSlideDom,
        updateRelevantLocationsSlideFromSecondaryPlaces: updateRelevantLocationsSlideFromSecondaryPlaces
    };
})();
