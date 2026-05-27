/**
 * Outlines slide relevancy rows whose flags / portraits intersect the active
 * `window.standaloneActiveFilters` set (so the user can see *why* an event
 * survived the filter pass without scanning the chip list).
 *
 * Two row sources are handled:
 *   - `#eventSlideRelevantLocations` rows match via `data-relevancy-flag-file`
 *     (country flag PNG filename, possibly prefixed `country:` in the filter
 *     set).
 *   - `#eventStoryFilterPlacesSection` rows match via `data-hero-open`,
 *     `data-faction-open`, `data-npc-open` (hero / faction / NPC tokens).
 *
 * Faction matching delegates to `window.FactionMatchHelpers` so display-name
 * vs numbered-filename mismatches still pair up.
 */
(function () {
    'use strict';

    function clearRelevancyRowFilterHighlight() {
        var ids = ['eventSlideRelevantLocations', 'eventStoryFilterPlacesSection'];
        for (var r = 0; r < ids.length; r++) {
            var root = typeof document !== 'undefined' ? document.getElementById(ids[r]) : null;
            if (!root) continue;
            var marked = root.querySelectorAll('.event-slide-relevant-locations__row--filter-match');
            for (var i = 0; i < marked.length; i++) {
                marked[i].classList.remove('event-slide-relevant-locations__row--filter-match');
            }
        }
    }

    function getStandaloneActiveFiltersForHighlight() {
        var af = typeof window !== 'undefined' ? window.standaloneActiveFilters : null;
        if (af && af instanceof Set && af.size > 0) return af;
        return null;
    }

    function rowMatchesActiveCastFilters(row, active) {
        if (!active || active.size === 0 || !row) return false;
        var imgs = row.querySelectorAll('img[data-hero-open]');
        var hi;
        for (hi = 0; hi < imgs.length; hi++) {
            var hn = decodeURIComponent(imgs[hi].getAttribute('data-hero-open') || '').trim();
            if (!hn) continue;
            if (active.has(hn) || active.has('hero:' + hn)) return true;
        }
        imgs = row.querySelectorAll('img[data-npc-open]');
        for (hi = 0; hi < imgs.length; hi++) {
            var nn = decodeURIComponent(imgs[hi].getAttribute('data-npc-open') || '').trim();
            if (!nn) continue;
            if (active.has(nn) || active.has('npc:' + nn)) return true;
        }
        imgs = row.querySelectorAll('img[data-faction-open]');
        var fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
        for (hi = 0; hi < imgs.length; hi++) {
            var fac = decodeURIComponent(imgs[hi].getAttribute('data-faction-open') || '').trim();
            if (!fac) continue;
            if (fh && typeof fh.activeFilterSetMatchesFactionId === 'function') {
                if (fh.activeFilterSetMatchesFactionId(active, fac)) return true;
            } else if (active.has(fac)) return true;
        }
        return false;
    }

    function rowMatchesActiveCountryFlagFilters(row, active) {
        if (!active || active.size === 0 || !row) return false;
        var imgs = row.querySelectorAll('img[data-relevancy-flag-file]');
        var keys = [];
        active.forEach(function (a) { keys.push(String(a || '')); });
        for (var i = 0; i < imgs.length; i++) {
            var fn = (imgs[i].getAttribute('data-relevancy-flag-file') || '').trim();
            if (!fn) continue;
            for (var k = 0; k < keys.length; k++) {
                var s = keys[k];
                if (s.toLowerCase().indexOf('country:') === 0) {
                    if (s.slice('country:'.length).trim() === fn) return true;
                } else if (s === fn || s.toLowerCase() === fn.toLowerCase()) {
                    return true;
                }
            }
        }
        return false;
    }

    function applyRelevancyRowFilterHighlight() {
        clearRelevancyRowFilterHighlight();
        var active = getStandaloneActiveFiltersForHighlight();
        if (!active) return;

        var locRoot = typeof document !== 'undefined' ? document.getElementById('eventSlideRelevantLocations') : null;
        if (locRoot) {
            var locRows = locRoot.querySelectorAll('.event-slide-relevant-locations__row');
            for (var li = 0; li < locRows.length; li++) {
                if (rowMatchesActiveCountryFlagFilters(locRows[li], active)) {
                    locRows[li].classList.add('event-slide-relevant-locations__row--filter-match');
                }
            }
        }

        var storyRoot = typeof document !== 'undefined' ? document.getElementById('eventStoryFilterPlacesSection') : null;
        if (storyRoot) {
            var castRows = storyRoot.querySelectorAll('.event-slide-relevant-locations__row');
            for (var ci = 0; ci < castRows.length; ci++) {
                if (rowMatchesActiveCastFilters(castRows[ci], active)) {
                    castRows[ci].classList.add('event-slide-relevant-locations__row--filter-match');
                }
            }
        }
    }

    /* Defer two frames so the slide HTML can finish swapping in (the relevancy
       block is innerHTML-replaced before this is asked to recompute). */
    function scheduleApplyRelevancyRowFilterHighlight() {
        var run = function () { applyRelevancyRowFilterHighlight(); };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function () { requestAnimationFrame(run); });
        } else {
            setTimeout(run, 0);
        }
    }

    window.__RelevancyRowFilterHighlight = {
        clearRelevancyRowFilterHighlight: clearRelevancyRowFilterHighlight,
        applyRelevancyRowFilterHighlight: applyRelevancyRowFilterHighlight,
        scheduleApplyRelevancyRowFilterHighlight: scheduleApplyRelevancyRowFilterHighlight
    };
})();
