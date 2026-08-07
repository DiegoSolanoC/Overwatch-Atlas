/**
 * Story-archive grouped relevancy block: heroes / factions / NPCs under the
 * description, each rendered with the same row layout as the country
 * relevant-locations block, but the leading graphic is the matching filter
 * portrait instead of a flag.
 *
 * Row sources accept the same `{ locationName, country, reasoning }` shape,
 * with `country` containing comma-separated token names (e.g. "Tracer,
 * Mercy") rather than literal countries. The three `get*FilterPlacesRowsForDisplay`
 * helpers prefer the persisted `*FilterPlaces` arrays and fall back to the
 * `StoryFilterPlacesSync` migrators when the event still has only flat
 * `filters` / `factions` / `npcs` fields.
 *
 * The Event Manager dock slide presents story events from the main timeline,
 * so when `standaloneEventSlide._presentationFromDockTimeline === true`
 * we render the grouped block regardless of the live archive source.
 */
(function () {
    'use strict';

    var R = window.__FlagFileResolver;
    var B = window.__SlideBioConnections;
    var H = window.__RelevancyRowFilterHighlight;

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

    function _sfps() {
        return typeof window !== 'undefined' ? window.StoryFilterPlacesSync || null : null;
    }

    function getHeroFilterPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        if (Array.isArray(ev.heroFilterPlaces) && ev.heroFilterPlaces.length > 0) {
            return clonePlaceRowObjects(ev.heroFilterPlaces);
        }
        var sync = _sfps();
        if (sync && typeof sync.heroPlacesForEditor === 'function') {
            return clonePlaceRowObjects(sync.heroPlacesForEditor(ev));
        }
        return [];
    }

    function getFactionFilterPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        if (Array.isArray(ev.factionFilterPlaces) && ev.factionFilterPlaces.length > 0) {
            return clonePlaceRowObjects(ev.factionFilterPlaces);
        }
        var sync = _sfps();
        if (sync && typeof sync.factionPlacesForEditor === 'function') {
            return clonePlaceRowObjects(sync.factionPlacesForEditor(ev));
        }
        return [];
    }

    function getNpcFilterPlacesRowsForDisplay(ev) {
        if (!ev) return [];
        if (Array.isArray(ev.npcFilterPlaces) && ev.npcFilterPlaces.length > 0) {
            return clonePlaceRowObjects(ev.npcFilterPlaces);
        }
        var sync = _sfps();
        if (sync && typeof sync.npcPlacesForEditor === 'function') {
            return clonePlaceRowObjects(sync.npcPlacesForEditor(ev));
        }
        return [];
    }

    /**
     * Gallery-style bio chip (portrait + name band), matching Dialogue Theater multipath chips.
     * @param {'heroes'|'npcs'|'factions'} kind
     * @param {string} token
     * @param {object|null|undefined} ev
     * @returns {string}
     */
    function filterTokenChipHtml(kind, token, ev) {
        var t = R.stripTrailingCommaSep(String(token || '')).trim();
        if (!t) return '';
        var src = '';
        var label = t;
        var fb = B.filterFallbackIconSrc(kind).replace(/'/g, "\\'");
        var openAttr = '';
        var clickClass = '';
        var portraitAttrs = '';
        var title = '';

        if (kind === 'heroes') {
            var hk = B.resolveHeroImageKey(t);
            var canon = hk || t;
            label = canon;
            src = 'src/assets/images/Filters/Heroes/' + encodeURIComponent(canon) + '.png';
            openAttr = 'data-hero-open="' + encodeURIComponent(canon) + '"';
            clickClass = 'event-slide-filter-token-chip--clickable-hero';
            title = 'Open ' + R.escapeHtmlAttr(canon) + ' in Heroes archive';
        } else if (kind === 'npcs') {
            var nk = B.resolveNpcImageKey(t);
            label = nk || t;
            src = 'src/assets/images/Filters/NPCs/' + encodeURIComponent(nk || t) + '.png';
            openAttr = 'data-npc-open="' + encodeURIComponent(nk || t) + '"';
            clickClass = 'event-slide-filter-token-chip--clickable-npc';
            title = 'Open ' + R.escapeHtmlAttr(nk || t) + ' in NPCs archive';
        } else if (kind === 'factions') {
            var ff = B.resolveFactionImageFilename(t);
            if (!ff) return '';
            label = t;
            var portraitHelper = window.__FactionEventSlidePortraitLooks;
            if (ev && portraitHelper && typeof portraitHelper.buildPortraitSrcForStoryEvent === 'function') {
                src = portraitHelper.buildPortraitSrcForStoryEvent(ff, ev);
            }
            if (!src) {
                src = 'src/assets/images/Filters/Factions/' + encodeURIComponent(ff) + '/Default.png';
            }
            openAttr = 'data-faction-open="' + encodeURIComponent(t) + '"';
            clickClass = 'event-slide-filter-token-chip--clickable-faction';
            portraitAttrs =
                ' data-bio-portrait-category="factions" data-bio-portrait-key="' + R.escapeHtmlAttr(ff) + '"';
            title = 'Open ' + R.escapeHtmlAttr(t) + ' in Factions archive';
        } else {
            return '';
        }

        return (
            '<div class="gallery-hero-filters__chip-wrap event-slide-filter-token-chip-wrap">' +
                '<button type="button" class="filter-btn gallery-hero-filters__chip event-slide-filter-token-chip ' +
                clickClass + '" ' + openAttr +
                ' title="' + title + '" aria-label="' + title + '">' +
                    '<div class="filter-image-container">' +
                        '<img' + portraitAttrs + ' src="' + src + '" alt="" loading="lazy" decoding="async" ' +
                        'onerror="this.onerror=null;this.src=\'' + fb + '\';" />' +
                    '</div>' +
                    '<div class="filter-label">' +
                        '<span class="filter-label-text">' + R.slideStoryDisplayHtml(label) + '</span>' +
                    '</div>' +
                '</button>' +
            '</div>'
        );
    }

    function createStoryFilterPlacesSlideHtml(rows, kind, ev) {
        var list = Array.isArray(rows) ? rows : [];
        var rowParts = [];
        for (var i = 0; i < list.length; i++) {
            var item = list[i];
            var locName = R.stripTrailingCommaSep(item.locationName != null ? String(item.locationName) : '');
            var country = R.stripTrailingCommaSep(item.country != null ? String(item.country) : '');
            var reasoning = item.reasoning != null ? String(item.reasoning).trim() : '';
            if (!locName && !country && !reasoning) continue;

            var tokens = (country || '')
                .split(',')
                .map(function (s) { return R.stripTrailingCommaSep(s); })
                .filter(Boolean);
            var manyTokens = tokens.length > 1;
            var lead = '';
            if (tokens.length > 0) {
                lead = '<span class="event-slide-relevant-locations__flag-row event-slide-relevant-locations__flag-row--chips">';
                for (var ti = 0; ti < tokens.length; ti += 1) {
                    var one = filterTokenChipHtml(kind, tokens[ti], ev);
                    if (one) lead += one;
                }
                lead += '</span>';
            } else {
                lead =
                    '<span class="event-slide-relevant-locations__flag-row event-slide-relevant-locations__flag-row--chips">' +
                    '<div class="gallery-hero-filters__chip-wrap event-slide-filter-token-chip-wrap">' +
                        '<span class="filter-btn gallery-hero-filters__chip event-slide-filter-token-chip event-slide-filter-token-chip--static" aria-hidden="true">' +
                            '<div class="filter-image-container">' +
                                '<img src="' + B.filterFallbackIconSrc(kind).replace(/'/g, "\\'") +
                                '" alt="" decoding="async" />' +
                            '</div>' +
                        '</span>' +
                    '</div></span>';
            }

            var mainText;
            if (locName && country) {
                if (manyTokens) {
                    mainText = R.slideStoryDisplayHtml(locName);
                } else {
                    mainText =
                        R.slideStoryDisplayHtml(locName) +
                        '<span class="event-slide-relevant-locations__comma-country">, ' +
                        R.slideStoryDisplayHtml(R.stripTrailingCommaSep(tokens[0] || country)) +
                        '</span>';
                }
            } else if (locName) {
                mainText = R.slideStoryDisplayHtml(locName);
            } else if (country) {
                if (manyTokens) {
                    mainText = tokens
                        .map(function (tok) { return R.slideStoryDisplayHtml(tok); })
                        .join('<span class="event-slide-relevant-locations__comma-country">, </span>');
                } else {
                    mainText = R.slideStoryDisplayHtml(R.stripTrailingCommaSep(tokens[0] || country));
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

    function clearStoryFilterPlacesSlideDom() {
        var sec = typeof document !== 'undefined' ? document.getElementById('eventStoryFilterPlacesSection') : null;
        if (sec) {
            sec.innerHTML = '';
            sec.style.display = 'none';
        }
    }

    function updateStoryFilterPlacesSlideFromEvent(ev) {
        var sec = typeof document !== 'undefined' ? document.getElementById('eventStoryFilterPlacesSection') : null;
        if (!sec) return;
        var arch = typeof window !== 'undefined' && window.eventManager?.dataService?.getArchiveSource
            ? window.eventManager.dataService.getArchiveSource()
            : 'story';
        /* Main-timeline dock slide uses story event data even if the live archive is heroes/factions/etc. */
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
        var heroHtml = heroRows.length ? createStoryFilterPlacesSlideHtml(heroRows, 'heroes', ev) : '';
        var facHtml = facRows.length ? createStoryFilterPlacesSlideHtml(facRows, 'factions', ev) : '';
        var npcHtml = npcRows.length ? createStoryFilterPlacesSlideHtml(npcRows, 'npcs', ev) : '';
        var parts = [];
        if (heroHtml) {
            parts.push(
                '<h4 class="event-filter-header event-filter-header--category">' +
                    '<img class="event-filter-header-icon" src="' + B.ICON_HERO_CAT +
                    '" alt="" width="20" height="20" decoding="async" />' +
                    '<span class="event-filter-header-label">Relevant heroes</span>' +
                '</h4>' +
                '<div class="event-slide-relevant-locations">' + heroHtml + '</div>'
            );
        }
        if (facHtml) {
            parts.push(
                '<h4 class="event-filter-header event-filter-header--category">' +
                    '<img class="event-filter-header-icon" src="' + B.ICON_FACTION_CAT +
                    '" alt="" width="20" height="20" decoding="async" />' +
                    '<span class="event-filter-header-label">Relevant factions</span>' +
                '</h4>' +
                '<div class="event-slide-relevant-locations">' + facHtml + '</div>'
            );
        }
        if (npcHtml) {
            parts.push(
                '<h4 class="event-filter-header event-filter-header--category">' +
                    '<img class="event-filter-header-icon" src="' + B.ICON_NPC_CAT +
                    '" alt="" width="20" height="20" decoding="async" />' +
                    '<span class="event-filter-header-label">Relevant NPCs</span>' +
                '</h4>' +
                '<div class="event-slide-relevant-locations">' + npcHtml + '</div>'
            );
        }
        sec.innerHTML = parts.join('');
        sec.style.display = parts.length ? 'block' : 'none';
        B.wireStoryFilterSectionBioArchiveNav(sec);
        if (window.__BioChipPortraitBackground && typeof window.__BioChipPortraitBackground.paintBioChipPortraitBackgrounds === 'function') {
            void window.__BioChipPortraitBackground.paintBioChipPortraitBackgrounds(sec);
        }
        H.scheduleApplyRelevancyRowFilterHighlight();
    }

    window.__SlideStoryFilterPlaces = {
        getHeroFilterPlacesRowsForDisplay: getHeroFilterPlacesRowsForDisplay,
        getFactionFilterPlacesRowsForDisplay: getFactionFilterPlacesRowsForDisplay,
        getNpcFilterPlacesRowsForDisplay: getNpcFilterPlacesRowsForDisplay,
        createStoryFilterPlacesSlideHtml: createStoryFilterPlacesSlideHtml,
        clearStoryFilterPlacesSlideDom: clearStoryFilterPlacesSlideDom,
        updateStoryFilterPlacesSlideFromEvent: updateStoryFilterPlacesSlideFromEvent
    };
})();
