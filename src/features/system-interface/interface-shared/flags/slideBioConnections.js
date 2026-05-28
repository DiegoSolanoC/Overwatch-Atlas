/**
 * Bio archive (heroes / factions / NPCs) read-only "Connections" block for
 * the event slide: one row per connection with portrait pillars + arrow
 * lanes, plus the click + keyboard wiring that opens the linked archive
 * row when a hero / faction / NPC portrait is activated.
 *
 * Lane / direction rules:
 *   - Standard hero↔hero or NPC↔NPC: two-direction arrows; `thisEntryLane`
 *     decides whether the subject pillar sits left or right.
 *   - Faction ↔ hero|NPC ("mixed"): single direction from faction toward
 *     the other side, regardless of which side is being viewed.
 *
 * Codex highlight: when the slide is opened by clicking a connection cord
 * in the Codex panel, `applyBioConnectionCodexHighlight` marks the matching
 * row so the user immediately sees which connection they followed. Hero
 * names use a "loose" match so "Soldier: 76" ↔ "Soldier 76" works.
 *
 * Archive image lookups (`resolveHeroImageKey` etc.) live here too because
 * they're only consumed by this and `slideStoryFilterPlaces` (it imports
 * them via this module's window namespace).
 */
(function () {
    'use strict';

    var R = window.__FlagFileResolver;

    var ICON_HERO_CAT = 'src/assets/images/Icons/Filter%20Icons/Heroes%20Icon.png';
    var ICON_FACTION_CAT = 'src/assets/images/Icons/Filter%20Icons/Factions%20Icon.png';
    var ICON_NPC_CAT = 'src/assets/images/Icons/Filter%20Icons/NPC%20Icon.png';

    function resolveHeroImageKey(token) {
        var t = R.stripTrailingCommaSep(String(token || '')).trim();
        if (!t) return '';
        var list = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
        var nk = R.normalizeKey(t);
        for (var i = 0; i < list.length; i++) {
            if (R.normalizeKey(list[i]) === nk) return String(list[i]);
        }
        return t;
    }

    function resolveNpcImageKey(token) {
        var t = R.stripTrailingCommaSep(String(token || '')).trim();
        if (!t) return '';
        var list = window.eventManager?.npcs || [];
        var nk = R.normalizeKey(t);
        for (var i = 0; i < list.length; i++) {
            if (R.normalizeKey(list[i]) === nk) return String(list[i]);
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
            if (R.normalizeKey(fn2.replace(/^\d+/, '').trim()) === R.normalizeKey(bare)) return fn2;
        }
        return null;
    }

    function filterFallbackIconSrc(kind) {
        if (kind === 'factions') return ICON_FACTION_CAT;
        if (kind === 'npcs') return ICON_NPC_CAT;
        return ICON_HERO_CAT;
    }

    function bioArchiveConnectionPortraitHtml(entityKind, token) {
        var t = R.stripTrailingCommaSep(String(token || '')).trim();
        var k = String(entityKind || 'hero').toLowerCase();
        if (k === 'character') k = 'hero';
        if (k !== 'faction' && k !== 'npc') k = 'hero';
        var fbPath = k === 'faction' ? ICON_FACTION_CAT : k === 'npc' ? ICON_NPC_CAT : ICON_HERO_CAT;
        var fb = fbPath.replace(/'/g, "\\'");
        if (!t) {
            return (
                '<img class="event-slide-bio-connections__portrait event-slide-bio-connections__portrait--fallback" src="' +
                fbPath +
                '" alt="" width="52" height="52" decoding="async" draggable="false" />'
            );
        }
        if (k === 'hero') {
            var hk = resolveHeroImageKey(t);
            var canon = hk || t;
            var src = 'src/assets/images/Filters/Heroes/' + encodeURIComponent(canon) + '.png';
            var dataEnc = encodeURIComponent(canon);
            return (
                '<img class="event-slide-filter-token-img event-slide-filter-token-img--heroes event-slide-filter-token-img--clickable-hero event-slide-bio-connections__portrait" ' +
                'data-hero-open="' + dataEnc + '" role="button" tabindex="0" ' +
                'src="' + src + '" alt="" title="Open ' + R.escapeHtmlAttr(canon) +
                ' in Heroes archive" width="52" height="52" decoding="async" draggable="false" onerror="this.onerror=null;this.src=\'' +
                fb + '\';" />'
            );
        }
        if (k === 'npc') {
            var nk = resolveNpcImageKey(t);
            var srcN = 'src/assets/images/Filters/NPCs/' + encodeURIComponent(nk || t) + '.png';
            var dataNpc = encodeURIComponent(nk || t);
            return (
                '<img class="event-slide-filter-token-img event-slide-filter-token-img--npcs event-slide-filter-token-img--clickable-npc event-slide-bio-connections__portrait" ' +
                'data-npc-open="' + dataNpc + '" role="button" tabindex="0" ' +
                'src="' + srcN + '" alt="" title="Open ' + R.escapeHtmlAttr(nk || t) +
                ' in NPCs archive" width="52" height="52" decoding="async" draggable="false" onerror="this.onerror=null;this.src=\'' +
                fb + '\';" />'
            );
        }
        var ff = resolveFactionImageFilename(t);
        if (!ff) {
            return (
                '<img class="event-slide-bio-connections__portrait event-slide-bio-connections__portrait--fallback" src="' +
                fbPath +
                '" alt="" width="52" height="52" decoding="async" draggable="false" />'
            );
        }
        var srcF = 'src/assets/images/Filters/Factions/' + encodeURIComponent(ff) + '.png';
        var dataFac = encodeURIComponent(t);
        return (
            '<img class="event-slide-filter-token-img event-slide-filter-token-img--factions event-slide-filter-token-img--clickable-faction event-slide-bio-connections__portrait" ' +
            'data-faction-open="' + dataFac + '" role="button" tabindex="0" ' +
            'src="' + srcF + '" alt="" title="Open ' + R.escapeHtmlAttr(t) +
            ' in Factions archive" width="52" height="52" decoding="async" draggable="false" onerror="this.onerror=null;this.src=\'' +
            fb + '\';" />'
        );
    }

    function normalizeBioCodexKind(k) {
        var x = String(k || 'hero').toLowerCase();
        if (x === 'character') x = 'hero';
        if (x !== 'faction' && x !== 'npc') x = 'hero';
        return x;
    }

    function bioCodexDataAttrsForRow(linkedKind, linkedName) {
        var k = normalizeBioCodexKind(linkedKind);
        var nm = linkedName != null ? String(linkedName).trim() : '';
        if (!nm) return '';
        return (
            ' data-bio-codex-kind="' + R.escapeHtmlAttr(k) +
            '" data-bio-codex-name="' + R.escapeHtmlAttr(nm) + '"'
        );
    }

    function normalizeBioCodexHeroForLooseMatch(s) {
        return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    /** "Soldier: 76" ↔ "Soldier 76" — same rule the Codex label match uses. */
    function bioCodexHeroNamesLooselyEqual(a, b) {
        var na = normalizeBioCodexHeroForLooseMatch(a);
        var nb = normalizeBioCodexHeroForLooseMatch(b);
        if (na && na === nb) return true;
        var la = na.replace(/:/g, '').replace(/\s/g, '');
        var lb = nb.replace(/:/g, '').replace(/\s/g, '');
        return la.length > 0 && la === lb;
    }

    function normalizeBioCodexNpcForMatch(s) {
        return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
    }

    function bioCodexNpcNamesMatch(specName, rowName) {
        var a = normalizeBioCodexNpcForMatch(specName);
        var b = normalizeBioCodexNpcForMatch(rowName);
        return a && b && a === b;
    }

    function bioCodexFactionNamesMatch(specName, rowName) {
        var raw = String(specName || '').trim();
        var row = String(rowName || '').trim();
        if (!raw || !row) return false;
        var fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
        if (fh && typeof fh.factionIdsMatch === 'function') {
            return fh.factionIdsMatch(raw, row) || fh.factionIdsMatch(row, raw);
        }
        return raw.toLowerCase() === row.toLowerCase();
    }

    function bioCodexSlideRowMatchesSpec(spec, rowKind, rowName) {
        if (!spec || !spec.name) return false;
        var sk = normalizeBioCodexKind(spec.kind);
        var rk = normalizeBioCodexKind(rowKind);
        if (sk !== rk) return false;
        var want = String(spec.name || '').trim();
        var have = String(rowName || '').trim();
        if (!want || !have) return false;
        if (sk === 'hero') return bioCodexHeroNamesLooselyEqual(want, have);
        if (sk === 'npc') return bioCodexNpcNamesMatch(want, have);
        return bioCodexFactionNamesMatch(want, have);
    }

    function clearBioConnectionCodexHighlight() {
        var root = typeof document !== 'undefined' ? document.getElementById('eventSlideBioConnections') : null;
        if (!root) return;
        var rows = root.querySelectorAll('.event-slide-bio-connections__row--codex-focus');
        for (var i = 0; i < rows.length; i++) {
            rows[i].classList.remove('event-slide-bio-connections__row--codex-focus');
        }
    }

    function applyBioConnectionCodexHighlight(spec) {
        clearBioConnectionCodexHighlight();
        var root = typeof document !== 'undefined' ? document.getElementById('eventSlideBioConnections') : null;
        if (!root || !spec || !spec.name) return;
        var wantK = normalizeBioCodexKind(spec.kind);
        if (wantK !== 'hero' && wantK !== 'faction' && wantK !== 'npc') return;
        var rows = root.querySelectorAll('.event-slide-bio-connections__row[data-bio-codex-kind]');
        for (var j = 0; j < rows.length; j++) {
            var row = rows[j];
            var rk = row.getAttribute('data-bio-codex-kind') || '';
            var rn = row.getAttribute('data-bio-codex-name') || '';
            if (bioCodexSlideRowMatchesSpec(spec, rk, rn)) {
                row.classList.add('event-slide-bio-connections__row--codex-focus');
            }
        }
    }

    function clearBioConnectionsSlideDom() {
        var el = typeof document !== 'undefined' ? document.getElementById('eventSlideBioConnections') : null;
        var sec = typeof document !== 'undefined' ? document.getElementById('eventBioConnectionsSection') : null;
        if (el) el.innerHTML = '';
        if (sec) sec.style.display = 'none';
    }

    function createBioConnectionsSlideHtml(ev, arch) {
        var rows = Array.isArray(ev && ev.connections) ? ev.connections : [];
        if (!rows.length) return '';
        var subjectName = '';
        if (ev && ev.name != null) subjectName = String(ev.name).trim();
        if (!subjectName && ev && Array.isArray(ev.variants) && ev.variants[0] && ev.variants[0].name != null) {
            subjectName = String(ev.variants[0].name).trim();
        }
        var subjectKind = arch === 'factions' ? 'faction' : arch === 'npcs' ? 'npc' : 'hero';
        var buckets = { hero: [], faction: [], npc: [] };
        var rowIsDisplayable =
            typeof window !== 'undefined'
            && window.BioArchiveConnectionsSync
            && typeof window.BioArchiveConnectionsSync.bioConnectionRowIsDisplayable === 'function'
                ? window.BioArchiveConnectionsSync.bioConnectionRowIsDisplayable
                : function (row) {
                    if (!row) return false;
                    var nm = row.name != null ? String(row.name).trim() : '';
                    if (!nm) return false;
                    var tOut = row.reasoningSubjectToLinked != null
                        ? String(row.reasoningSubjectToLinked).trim()
                        : '';
                    var tIn = row.reasoningLinkedToSubject != null
                        ? String(row.reasoningLinkedToSubject).trim()
                        : '';
                    var leg = row.reasoning != null ? String(row.reasoning).trim() : '';
                    if (tOut || tIn || leg) return true;
                    return row.showInCodex === true;
                };

        for (var i = 0; i < rows.length; i++) {
            var r = rows[i] || {};
            if (!rowIsDisplayable(r)) continue;
            var linkedKind = String(r.kind || 'hero').toLowerCase();
            if (linkedKind === 'character') linkedKind = 'hero';
            if (linkedKind !== 'faction' && linkedKind !== 'npc') linkedKind = 'hero';
            var linkedName = r.name != null ? String(r.name).trim() : '';
            if (!linkedName) continue;

            var tOut = r.reasoningSubjectToLinked != null ? String(r.reasoningSubjectToLinked).trim() : '';
            var tIn = r.reasoningLinkedToSubject != null ? String(r.reasoningLinkedToSubject).trim() : '';
            var leg = r.reasoning != null ? String(r.reasoning).trim() : '';
            if (!tOut && !tIn && leg) { tOut = leg; tIn = leg; }

            var factionMixed =
                (subjectKind === 'faction' && (linkedKind === 'hero' || linkedKind === 'npc')) ||
                ((subjectKind === 'hero' || subjectKind === 'npc') && linkedKind === 'faction');

            var rowHtml;
            if (factionMixed) {
                var facName = linkedKind === 'faction' ? linkedName : subjectName;
                var othKind = linkedKind === 'faction' ? subjectKind : linkedKind;
                var othName = linkedKind === 'faction' ? subjectName : linkedName;
                var tOne = String(subjectKind === 'faction' ? tOut || tIn || leg : tIn || tOut || leg).trim();
                var oneDisp = tOne
                    ? '<span class="event-slide-bio-connections__arrow-text">' + R.escapeHtmlAttr(tOne) + '</span>'
                    : '<span class="event-slide-bio-connections__arrow-text event-slide-bio-connections__arrow-text--muted">—</span>';
                var colFac =
                    '<div class="event-slide-bio-connections__portrait-col">' +
                    bioArchiveConnectionPortraitHtml('faction', facName) +
                    '</div>';
                var colOth =
                    '<div class="event-slide-bio-connections__portrait-col">' +
                    bioArchiveConnectionPortraitHtml(othKind, othName) +
                    '</div>';
                var midOne =
                    '<div class="event-slide-bio-connections__oneway-arrows" role="group" aria-label="Relationship from faction">' +
                    oneDisp +
                    '<span class="event-slide-bio-connections__arrow-glyph" aria-hidden="true">→</span>' +
                    '</div>';
                rowHtml =
                    '<div class="event-slide-bio-connections__row event-slide-bio-connections__row--dual event-slide-bio-connections__row--faction-oneway"' +
                    bioCodexDataAttrsForRow(linkedKind, linkedName) +
                    '>' + colFac + midOne + colOth + '</div>';
            } else {
                var outDisp = tOut
                    ? '<span class="event-slide-bio-connections__arrow-text">' + R.escapeHtmlAttr(tOut) + '</span>'
                    : '<span class="event-slide-bio-connections__arrow-text event-slide-bio-connections__arrow-text--muted">—</span>';
                var inDisp = tIn
                    ? '<span class="event-slide-bio-connections__arrow-text">' + R.escapeHtmlAttr(tIn) + '</span>'
                    : '<span class="event-slide-bio-connections__arrow-text event-slide-bio-connections__arrow-text--muted">—</span>';

                var laneB = String(r.thisEntryLane || 'A').toUpperCase() === 'B';
                var colThis =
                    '<div class="event-slide-bio-connections__portrait-col">' +
                    bioArchiveConnectionPortraitHtml(subjectKind, subjectName) +
                    '</div>';
                var colThem =
                    '<div class="event-slide-bio-connections__portrait-col">' +
                    bioArchiveConnectionPortraitHtml(linkedKind, linkedName) +
                    '</div>';
                var leftHtml = laneB ? colThem : colThis;
                var rightHtml = laneB ? colThis : colThem;

                var mid;
                if (laneB) {
                    mid =
                        '<div class="event-slide-bio-connections__arrows" role="group" aria-label="Relationship in each direction">' +
                        '<div class="event-slide-bio-connections__arrow-lane event-slide-bio-connections__arrow-lane--out">' +
                        inDisp +
                        '<span class="event-slide-bio-connections__arrow-glyph" aria-hidden="true">→</span>' +
                        '</div>' +
                        '<div class="event-slide-bio-connections__arrow-lane event-slide-bio-connections__arrow-lane--in">' +
                        '<span class="event-slide-bio-connections__arrow-glyph" aria-hidden="true">←</span>' +
                        outDisp +
                        '</div></div>';
                } else {
                    mid =
                        '<div class="event-slide-bio-connections__arrows" role="group" aria-label="Relationship in each direction">' +
                        '<div class="event-slide-bio-connections__arrow-lane event-slide-bio-connections__arrow-lane--out">' +
                        outDisp +
                        '<span class="event-slide-bio-connections__arrow-glyph" aria-hidden="true">→</span>' +
                        '</div>' +
                        '<div class="event-slide-bio-connections__arrow-lane event-slide-bio-connections__arrow-lane--in">' +
                        '<span class="event-slide-bio-connections__arrow-glyph" aria-hidden="true">←</span>' +
                        inDisp +
                        '</div></div>';
                }

                var rowCls =
                    'event-slide-bio-connections__row event-slide-bio-connections__row--dual' +
                    (laneB ? ' event-slide-bio-connections__row--lane-b' : '');

                rowHtml =
                    '<div class="' + rowCls + '"' +
                    bioCodexDataAttrsForRow(linkedKind, linkedName) +
                    '>' + leftHtml + mid + rightHtml + '</div>';
            }

            buckets[linkedKind].push(rowHtml);
        }
        var order = ['hero', 'faction', 'npc'];
        var out = [];
        for (var g = 0; g < order.length; g++) {
            var k = order[g];
            var arr = buckets[k];
            if (!arr.length) continue;
            out.push(
                '<div class="event-slide-bio-connections__group" data-linked-kind="' + k +
                '" role="group" aria-label="' +
                (k === 'faction' ? 'Faction' : k === 'npc' ? 'NPC' : 'Hero') +
                ' connections">' + arr.join('') + '</div>'
            );
        }
        return out.join('');
    }

    /* One-time delegation: hero / faction / NPC portraits open the matching bio archive slide. */
    function wireStoryFilterSectionBioArchiveNav(sec) {
        if (!sec || sec.dataset.bioArchiveNavWired === '1') return;
        sec.dataset.bioArchiveNavWired = '1';

        function activateFromImg(img) {
            if (!img) return;
            var em = window.eventManager;
            if (img.hasAttribute('data-hero-open') && em && typeof em.openHeroArchiveEventByName === 'function') {
                void em.openHeroArchiveEventByName(decodeURIComponent(img.getAttribute('data-hero-open') || ''));
                return;
            }
            if (img.hasAttribute('data-faction-open') && em && typeof em.openFactionArchiveEventByName === 'function') {
                void em.openFactionArchiveEventByName(decodeURIComponent(img.getAttribute('data-faction-open') || ''));
                return;
            }
            if (img.hasAttribute('data-npc-open') && em && typeof em.openNpcArchiveEventByName === 'function') {
                void em.openNpcArchiveEventByName(decodeURIComponent(img.getAttribute('data-npc-open') || ''));
            }
        }

        sec.addEventListener('click', function (e) {
            var img =
                e.target.closest('img.event-slide-filter-token-img--clickable-hero[data-hero-open]')
                || e.target.closest('img.event-slide-filter-token-img--clickable-faction[data-faction-open]')
                || e.target.closest('img.event-slide-filter-token-img--clickable-npc[data-npc-open]');
            if (!img || !sec.contains(img)) return;
            e.preventDefault();
            activateFromImg(img);
        });

        sec.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var t = e.target;
            if (!t || String(t.tagName || '').toLowerCase() !== 'img') return;
            if (!sec.contains(t)) return;
            var okHero =
                t.classList.contains('event-slide-filter-token-img--clickable-hero') && t.getAttribute('data-hero-open');
            var okFac =
                t.classList.contains('event-slide-filter-token-img--clickable-faction') && t.getAttribute('data-faction-open');
            var okNpc =
                t.classList.contains('event-slide-filter-token-img--clickable-npc') && t.getAttribute('data-npc-open');
            if (!okHero && !okFac && !okNpc) return;
            e.preventDefault();
            activateFromImg(t);
        });
    }

    function updateBioConnectionsSlideFromEvent(ev) {
        var el = typeof document !== 'undefined' ? document.getElementById('eventSlideBioConnections') : null;
        var sec = typeof document !== 'undefined' ? document.getElementById('eventBioConnectionsSection') : null;
        if (!el || !sec) return;
        var arch =
            typeof window !== 'undefined' && window.eventManager?.dataService?.getArchiveSource
                ? window.eventManager.dataService.getArchiveSource()
                : 'story';
        if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') {
            el.innerHTML = '';
            sec.style.display = 'none';
            return;
        }
        var inner = createBioConnectionsSlideHtml(ev, arch);
        el.innerHTML = inner;
        sec.style.display = inner ? 'block' : 'none';
        if (inner) wireStoryFilterSectionBioArchiveNav(sec);
    }

    window.__SlideBioConnections = {
        ICON_HERO_CAT: ICON_HERO_CAT,
        ICON_FACTION_CAT: ICON_FACTION_CAT,
        ICON_NPC_CAT: ICON_NPC_CAT,
        resolveHeroImageKey: resolveHeroImageKey,
        resolveNpcImageKey: resolveNpcImageKey,
        resolveFactionImageFilename: resolveFactionImageFilename,
        filterFallbackIconSrc: filterFallbackIconSrc,
        bioArchiveConnectionPortraitHtml: bioArchiveConnectionPortraitHtml,
        clearBioConnectionsSlideDom: clearBioConnectionsSlideDom,
        createBioConnectionsSlideHtml: createBioConnectionsSlideHtml,
        updateBioConnectionsSlideFromEvent: updateBioConnectionsSlideFromEvent,
        clearBioConnectionCodexHighlight: clearBioConnectionCodexHighlight,
        applyBioConnectionCodexHighlight: applyBioConnectionCodexHighlight,
        wireStoryFilterSectionBioArchiveNav: wireStoryFilterSectionBioArchiveNav
    };
})();
