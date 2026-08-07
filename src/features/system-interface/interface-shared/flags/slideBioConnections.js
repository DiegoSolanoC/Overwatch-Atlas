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
        var H = window.NpcNameAliasHelpers;
        if (H && typeof H.resolveNpcCanonicalName === 'function') {
            t = H.resolveNpcCanonicalName(t);
        }
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

    /**
     * Gallery-style bio chip for archive Connections (same visual as story
     * relevancy / Dialogue Theater multipath chips). Click attrs open the
     * linked archive entry via wireStoryFilterSectionBioArchiveNav.
     */
    function connectionChipShellHtml(opts) {
        var src = opts.src || '';
        var label = opts.label != null ? String(opts.label) : '';
        var fb = opts.fb || '';
        var openAttr = opts.openAttr || '';
        var clickClass = opts.clickClass || '';
        var portraitAttrs = opts.portraitAttrs || '';
        var title = opts.title || '';
        var isStatic = opts.isStatic === true;
        var tag = isStatic ? 'span' : 'button type="button"';
        var closeTag = isStatic ? 'span' : 'button';
        var staticClass = isStatic ? ' event-slide-filter-token-chip--static' : '';
        var interactiveAttrs = isStatic
            ? ' aria-hidden="true"'
            : ' ' + openAttr + ' title="' + title + '" aria-label="' + title + '"';
        var labelHtml = label
            ? (
                '<div class="filter-label">' +
                    '<span class="filter-label-text">' + R.slideStoryDisplayHtml(label) + '</span>' +
                '</div>'
            )
            : '';
        return (
            '<div class="gallery-hero-filters__chip-wrap event-slide-filter-token-chip-wrap event-slide-bio-connections__chip">' +
                '<' + tag + ' class="filter-btn gallery-hero-filters__chip event-slide-filter-token-chip' +
                staticClass + (clickClass ? ' ' + clickClass : '') + '"' + interactiveAttrs + '>' +
                    '<div class="filter-image-container">' +
                        '<img' + portraitAttrs + ' src="' + src + '" alt="" loading="lazy" decoding="async" draggable="false" ' +
                        'onerror="this.onerror=null;this.src=\'' + fb + '\';" />' +
                    '</div>' +
                    labelHtml +
                '</' + closeTag + '>' +
            '</div>'
        );
    }

    function bioArchiveConnectionPortraitHtml(entityKind, token) {
        var t = R.stripTrailingCommaSep(String(token || '')).trim();
        var k = String(entityKind || 'hero').toLowerCase();
        if (k === 'character') k = 'hero';
        if (k !== 'faction' && k !== 'npc') k = 'hero';
        var fbPath = k === 'faction' ? ICON_FACTION_CAT : k === 'npc' ? ICON_NPC_CAT : ICON_HERO_CAT;
        var fb = fbPath.replace(/'/g, "\\'");
        if (!t) {
            return connectionChipShellHtml({
                src: fbPath,
                label: '',
                fb: fb,
                isStatic: true
            });
        }
        if (k === 'hero') {
            var hk = resolveHeroImageKey(t);
            var canon = hk || t;
            return connectionChipShellHtml({
                src: 'src/assets/images/Filters/Heroes/' + encodeURIComponent(canon) + '.png',
                label: canon,
                fb: fb,
                openAttr: 'data-hero-open="' + encodeURIComponent(canon) + '"',
                clickClass: 'event-slide-filter-token-chip--clickable-hero',
                title: 'Open ' + R.escapeHtmlAttr(canon) + ' in Heroes archive'
            });
        }
        if (k === 'npc') {
            var nk = resolveNpcImageKey(t);
            var npcLabel = nk || t;
            return connectionChipShellHtml({
                src: 'src/assets/images/Filters/NPCs/' + encodeURIComponent(npcLabel) + '.png',
                label: npcLabel,
                fb: fb,
                openAttr: 'data-npc-open="' + encodeURIComponent(npcLabel) + '"',
                clickClass: 'event-slide-filter-token-chip--clickable-npc',
                title: 'Open ' + R.escapeHtmlAttr(npcLabel) + ' in NPCs archive'
            });
        }
        var ff = resolveFactionImageFilename(t);
        if (!ff) {
            return connectionChipShellHtml({
                src: fbPath,
                label: t,
                fb: fb,
                isStatic: true
            });
        }
        return connectionChipShellHtml({
            src: 'src/assets/images/Filters/Factions/' + encodeURIComponent(ff) + '/Default.png',
            label: t,
            fb: fb,
            openAttr: 'data-faction-open="' + encodeURIComponent(t) + '"',
            clickClass: 'event-slide-filter-token-chip--clickable-faction',
            portraitAttrs:
                ' data-bio-portrait-category="factions" data-bio-portrait-key="' + R.escapeHtmlAttr(ff) + '"',
            title: 'Open ' + R.escapeHtmlAttr(t) + ' in Factions archive'
        });
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
                    if (row.pruned === true) return false;
                    return true;
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

        function activateFromTarget(el) {
            if (!el) return;
            var em = window.eventManager;
            if (el.hasAttribute('data-hero-open') && em && typeof em.openHeroArchiveEventByName === 'function') {
                void em.openHeroArchiveEventByName(decodeURIComponent(el.getAttribute('data-hero-open') || ''));
                return;
            }
            if (el.hasAttribute('data-faction-open') && em && typeof em.openFactionArchiveEventByName === 'function') {
                void em.openFactionArchiveEventByName(decodeURIComponent(el.getAttribute('data-faction-open') || ''));
                return;
            }
            if (el.hasAttribute('data-npc-open') && em && typeof em.openNpcArchiveEventByName === 'function') {
                void em.openNpcArchiveEventByName(decodeURIComponent(el.getAttribute('data-npc-open') || ''));
            }
        }

        sec.addEventListener('click', function (e) {
            var el =
                e.target.closest(
                    'button.event-slide-filter-token-chip[data-hero-open], ' +
                    'button.event-slide-filter-token-chip[data-faction-open], ' +
                    'button.event-slide-filter-token-chip[data-npc-open], ' +
                    'img.event-slide-filter-token-img--clickable-hero[data-hero-open], ' +
                    'img.event-slide-filter-token-img--clickable-faction[data-faction-open], ' +
                    'img.event-slide-filter-token-img--clickable-npc[data-npc-open]'
                );
            if (!el || !sec.contains(el)) return;
            e.preventDefault();
            activateFromTarget(el);
        });

        sec.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var t = e.target;
            if (!t || !sec.contains(t)) return;
            var tag = String(t.tagName || '').toLowerCase();
            if (tag !== 'img' && tag !== 'button') return;
            var ok =
                t.hasAttribute('data-hero-open')
                || t.hasAttribute('data-faction-open')
                || t.hasAttribute('data-npc-open');
            if (!ok) return;
            e.preventDefault();
            activateFromTarget(t);
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
        function paint(viewEv) {
            var inner = createBioConnectionsSlideHtml(viewEv, arch);
            el.innerHTML = inner;
            sec.style.display = inner ? 'block' : 'none';
            if (inner) {
                wireStoryFilterSectionBioArchiveNav(sec);
                if (window.__BioChipPortraitBackground && typeof window.__BioChipPortraitBackground.paintBioChipPortraitBackgrounds === 'function') {
                    void window.__BioChipPortraitBackground.paintBioChipPortraitBackgrounds(sec);
                }
            }
        }
        var svc = typeof window !== 'undefined' ? window.CodexConnectionService : null;
        if (svc && typeof svc.resolveConnectionsForArchiveEntry === 'function') {
            svc.resolveConnectionsForArchiveEntry(arch, ev).then(function (conns) {
                var viewEv = Object.assign({}, ev, { connections: conns });
                paint(viewEv);
            }).catch(function () {
                paint(Object.assign({}, ev, { connections: [] }));
            });
            return;
        }
        paint(ev);
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
