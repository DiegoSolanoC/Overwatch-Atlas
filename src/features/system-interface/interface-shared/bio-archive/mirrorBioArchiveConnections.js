/**
 * When a Heroes / Factions / NPCs archive row is saved, mirror each
 * connection onto the linked row if that row exists in the same archive list
 * (same JSON file). Directions swap (A's "mentor of" B becomes B's "student
 * of" A), removals propagate, and faction↔(hero|npc) is forced to a single
 * directional descriptor (the faction is always slide-lane A).
 *
 * `repairMissingMirrorsForBioArchive` runs before persist to catch mirrors
 * that previous saves missed (e.g. when the slide held a stale object ref
 * that `indexOf` couldn't locate).
 *
 * Mirrors only explicit `connections[]` rows (or direct Codex cords after a codex save).
 * Junction chains in the Codex do not add archive rows for every bio along the branch.
 *
 * Compatibility note: this file used to be `BioArchiveConnectionsSync.js`
 * and exposed `window.BioArchiveConnectionsSync`. Both the file content and
 * the global keep their public surface, so existing call sites (mostly
 * `EventDataService.saveEvents`) need no changes.
 */
(function () {
    'use strict';

    function sanitizeConnectionEntityName(raw) {
        var t = String(raw == null ? '' : raw).trim();
        while (t.length > 0 && /[,;]\s*$/.test(t)) {
            t = t.replace(/[,;]\s*$/, '').trim();
        }
        return t;
    }

    function entityKindForArchive(archiveSource) {
        if (archiveSource === 'factions') return 'faction';
        if (archiveSource === 'npcs') return 'npc';
        return 'hero';
    }

    /** Mirrors only run within one archive file (heroes↔heroes, factions↔factions, npcs↔npcs). */
    function connectionTargetInThisArchive(archiveSource, linkedKind) {
        var lk = normalizeConnKind(linkedKind);
        if (archiveSource === 'heroes') return lk === 'hero';
        if (archiveSource === 'npcs') return lk === 'npc';
        if (archiveSource === 'factions') return lk === 'faction';
        return false;
    }

    function normalizeConnKind(k) {
        var x = String(k || 'hero').toLowerCase();
        if (x === 'character') x = 'hero';
        if (x !== 'faction' && x !== 'npc') x = 'hero';
        return x;
    }

    function connectionKey(kind, name) {
        return normalizeConnKind(kind) + '\0' + sanitizeConnectionEntityName(name).toLowerCase();
    }

    function normalizeBioRows(raw) {
        var ds = window.eventManager && window.eventManager.dataService;
        if (ds && typeof ds.normalizeBioArchiveConnections === 'function') {
            return ds.normalizeBioArchiveConnections(raw);
        }
        return Array.isArray(raw) ? raw : [];
    }

    /**
     * @param {Array<Object>} events
     * @param {'hero'|'faction'|'npc'} entityKind
     * @param {string} name
     * @returns {number}
     */
    function findBioEntryIndex(events, entityKind, name) {
        var nm = sanitizeConnectionEntityName(name);
        if (!Array.isArray(events) || !nm) return -1;
        var nk = normalizeConnKind(entityKind);
        var em = window.eventManager;

        if (nk === 'hero' && em && typeof em.findHeroArchiveEventIndex === 'function') {
            var ix = em.findHeroArchiveEventIndex(nm);
            if (ix >= 0) return ix;
        }
        if (nk === 'hero' && em && typeof em._heroArchiveNamesLooselyEqual === 'function') {
            for (var hi = 0; hi < events.length; hi++) {
                var hRow = events[hi];
                if (!hRow) continue;
                if (em._heroArchiveNamesLooselyEqual(hRow.name, nm)) return hi;
            }
        }
        if (nk === 'npc') {
            var want = nm.toLowerCase();
            for (var i = 0; i < events.length; i++) {
                var rn = events[i] && events[i].name != null ? String(events[i].name).trim().toLowerCase() : '';
                if (rn && rn === want) return i;
            }
            return -1;
        }
        if (nk === 'faction') {
            var fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
            var raw = nm;
            for (var j = 0; j < events.length; j++) {
                var rowName = events[j] && events[j].name != null ? String(events[j].name).trim() : '';
                if (!rowName) continue;
                if (fh && typeof fh.factionIdsMatch === 'function') {
                    if (fh.factionIdsMatch(rowName, raw) || fh.factionIdsMatch(raw, rowName)) return j;
                }
                if (rowName.toLowerCase() === raw.toLowerCase()) return j;
                var rowBare = rowName.replace(/^\d+/, '').trim().toLowerCase();
                var rawBare = raw.replace(/^\d+/, '').trim().toLowerCase();
                if (rowBare && rowBare === rawBare) return j;
            }
            return -1;
        }
        /* Fallback hero match by case-insensitive `name` (kept after the loose-equal pass). */
        var wantH = nm.toLowerCase();
        for (var hj = 0; hj < events.length; hj++) {
            var rnh = events[hj] && events[hj].name != null ? String(events[hj].name).trim().toLowerCase() : '';
            if (rnh && rnh === wantH) return hj;
        }
        return -1;
    }

    /**
     * `indexOf` fails when the slide holds a stale object ref; match by name instead.
     * @param {Array<Object>} events
     * @param {Object|null} rowRef
     * @param {string} [archiveSource]
     * @returns {number}
     */
    function resolveBioArchiveEventIndex(events, rowRef, archiveSource) {
        if (!Array.isArray(events) || !rowRef) return -1;
        var ix0 = events.indexOf(rowRef);
        if (ix0 >= 0) return ix0;
        var want = rowRef.name != null ? String(rowRef.name).trim() : '';
        if (!want) return -1;
        var arch = archiveSource || '';
        if (arch === 'npcs') return findBioEntryIndex(events, 'npc', want);
        if (arch === 'factions') return findBioEntryIndex(events, 'faction', want);
        if (arch === 'heroes') return findBioEntryIndex(events, 'hero', want);
        for (var i = 0; i < events.length; i++) {
            if (!events[i]) continue;
            var n = events[i].name != null ? String(events[i].name).trim() : '';
            if (n === want) return i;
        }
        return -1;
    }

    function linkedHasMirrorBack(linked, subjectKind, subjectName) {
        var arr = linked && Array.isArray(linked.connections) ? linked.connections : [];
        var want = connectionKey(subjectKind, subjectName);
        for (var i = 0; i < arr.length; i++) {
            if (connectionKey(arr[i].kind, arr[i].name) === want) return true;
        }
        return false;
    }

    function bioConnectionRowHasNarrativeText(c) {
        if (!c) return false;
        var R = typeof window !== 'undefined' ? window.BioArchiveConnectionRanges : null;
        if (R && typeof R.connectionRowHasNarrativeText === 'function') {
            return R.connectionRowHasNarrativeText(c);
        }
        var d = directionalTextsFromRow(c);
        return Boolean(d.toLinked || d.toSubject);
    }

    function shouldMirrorBioConnectionRow(c) {
        return bioConnectionRowHasNarrativeText(c);
    }

    function bioConnectionRowIsJunctionPhantomStub(c) {
        if (!c) return false;
        var name = c.name != null ? String(c.name).trim() : '';
        if (!name) return false;
        if (bioConnectionRowHasNarrativeText(c)) return false;
        if (c.showInCodex === true) return false;
        return true;
    }

    function pruneJunctionPhantomConnectionsInPlace(events, archiveSource) {
        var arch = archiveSource || '';
        if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return;
        if (!Array.isArray(events)) return;
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (!ev || !Array.isArray(ev.connections)) continue;
            var kept = ev.connections.filter(function (c) {
                return !bioConnectionRowIsJunctionPhantomStub(c);
            });
            if (kept.length !== ev.connections.length) {
                ev.connections = kept;
            }
        }
    }

    function directionalTextsFromRow(c) {
        var toLinked = c.reasoningSubjectToLinked != null ? String(c.reasoningSubjectToLinked).trim() : '';
        var toSubject = c.reasoningLinkedToSubject != null ? String(c.reasoningLinkedToSubject).trim() : '';
        var leg = c.reasoning != null ? String(c.reasoning).trim() : '';
        if (!toLinked && !toSubject && leg) {
            toLinked = leg;
            toSubject = leg;
        }
        return { toLinked: toLinked, toSubject: toSubject };
    }

    /** Faction ↔ hero|npc: one-way descriptor from faction toward the other (never faction↔faction). */
    function isFactionHeroNpcMixed(subjectKind, linkedKind) {
        var sk = normalizeConnKind(subjectKind);
        var lk = normalizeConnKind(linkedKind);
        if (sk === 'faction' && (lk === 'hero' || lk === 'npc')) return true;
        if ((sk === 'hero' || sk === 'npc') && lk === 'faction') return true;
        return false;
    }

    /** Force lane + single descriptor field for faction mixed links (mutates `c`). */
    function coerceFactionMixedRowInPlace(c, subjectKind) {
        var sk = normalizeConnKind(subjectKind);
        var lk = normalizeConnKind(c && c.kind);
        if (!isFactionHeroNpcMixed(sk, lk)) return;
        c.thisEntryLane = sk === 'faction' ? 'A' : 'B';
        var d = directionalTextsFromRow(c);
        if (sk === 'faction') {
            c.reasoningSubjectToLinked = (d.toLinked || d.toSubject || '').trim();
            c.reasoningLinkedToSubject = '';
        } else {
            c.reasoningLinkedToSubject = (d.toSubject || d.toLinked || '').trim();
            c.reasoningSubjectToLinked = '';
        }
    }

    function removeConnectionToSubject(connections, subjectKind, subjectName) {
        if (!Array.isArray(connections)) return [];
        var want = connectionKey(subjectKind, subjectName);
        return connections.filter(function (r) {
            return connectionKey(r.kind, r.name) !== want;
        });
    }

    function upsertMirror(connections, mirrorRow) {
        var arr = Array.isArray(connections) ? connections.slice() : [];
        var want = connectionKey(mirrorRow.kind, mirrorRow.name);
        var ix = -1;
        for (var i = 0; i < arr.length; i++) {
            if (connectionKey(arr[i].kind, arr[i].name) === want) {
                ix = i;
                break;
            }
        }
        if (ix >= 0) arr[ix] = mirrorRow;
        else arr.push(mirrorRow);
        return arr;
    }

  /**
   * @param {object} c
   * @param {'hero'|'faction'|'npc'} subjectKind
   * @param {string} subjectName
   * @param {{ copyShowInCodex?: boolean }} [options]
   */
    function mirrorBioConnectionRangeRow(range) {
        var R = typeof window !== 'undefined' ? window.BioArchiveConnectionRanges : null;
        if (R && typeof R.mirrorBioConnectionRange === 'function') {
            return R.mirrorBioConnectionRange(range);
        }
        var startEvent = range && range.startEvent != null ? String(range.startEvent).trim() : '';
        var endEvent = range && range.endEvent != null ? String(range.endEvent).trim() : '';
        var out = {
            startEvent: startEvent,
            reasoningSubjectToLinked:
                range && range.reasoningLinkedToSubject != null
                    ? String(range.reasoningLinkedToSubject).trim()
                    : '',
            reasoningLinkedToSubject:
                range && range.reasoningSubjectToLinked != null
                    ? String(range.reasoningSubjectToLinked).trim()
                    : ''
        };
        if (endEvent) out.endEvent = endEvent;
        return out;
    }

    function buildMirrorRow(c, subjectKind, subjectName, options) {
        var lk = normalizeConnKind(c.kind);
        var dir = directionalTextsFromRow(c);
        var mixed = isFactionHeroNpcMixed(subjectKind, lk);
        var laneMirror = mixed
            ? subjectKind === 'faction' ? 'B' : 'A'
            : String(c.thisEntryLane || 'A').toUpperCase() === 'B' ? 'B' : 'A';
        var mirror = {
            kind: subjectKind,
            name: subjectName,
            reasoningSubjectToLinked: dir.toSubject,
            reasoningLinkedToSubject: dir.toLinked,
            thisEntryLane: laneMirror
        };
        if (Array.isArray(c.ranges) && c.ranges.length) {
            mirror.ranges = c.ranges.map(mirrorBioConnectionRangeRow);
            var R = typeof window !== 'undefined' ? window.BioArchiveConnectionRanges : null;
            if (R && typeof R.syncLegacyReasoningFieldsFromRanges === 'function') {
                R.syncLegacyReasoningFieldsFromRanges(mirror);
            }
        }
        if (options && options.copyShowInCodex === true && c.showInCodex === true) {
            mirror.showInCodex = true;
        }
        return mirror;
    }

    /**
     * Before persisting: ensure every connection row has a reciprocal on the linked entry.
     * Idempotent; fixes missed mirrors when the slide ref didn't match `events[i]`.
     * @param {Array<Object>} events
     * @param {string} archiveSource heroes|factions|npcs
     */
    function repairMissingMirrorsForBioArchive(events, archiveSource) {
        if (!Array.isArray(events)) return;
        var arch =
            archiveSource ||
            (window.eventManager &&
                window.eventManager.dataService &&
                window.eventManager.dataService.getArchiveSource &&
                window.eventManager.dataService.getArchiveSource()) ||
            '';
        if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return;

        var subjectKind = entityKindForArchive(arch);
        var em = window.eventManager;

        for (var i = 0; i < events.length; i++) {
            var E = events[i];
            if (!E) continue;
            var subjectName = E.name != null ? String(E.name).trim() : '';
            if (!subjectName) continue;
            var conns = Array.isArray(E.connections) ? E.connections : [];
            for (var k = 0; k < conns.length; k++) {
                var c = conns[k];
                if (!c) continue;
                var lk = normalizeConnKind(c.kind);
                var ln = sanitizeConnectionEntityName(c.name);
                if (!ln) continue;
                if (connectionKey(lk, ln) === connectionKey(subjectKind, subjectName)) continue;
                if (!connectionTargetInThisArchive(arch, lk)) continue;
                var linkedIx = findBioEntryIndex(events, lk, ln);
                if (linkedIx === i) continue;
                if (linkedIx < 0) continue;
                var linked = events[linkedIx];
                if (linkedHasMirrorBack(linked, subjectKind, subjectName)) continue;
                if (!shouldMirrorBioConnectionRow(c)) continue;
                coerceFactionMixedRowInPlace(c, subjectKind);
                var mirror = buildMirrorRow(c, subjectKind, subjectName, { copyShowInCodex: false });
                linked.connections = normalizeBioRows(upsertMirror(linked.connections, mirror));
                if (em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
                    em.unsavedEventIndices.add(linkedIx);
                }
            }
        }
    }

    /**
     * Drop `showInCodex` on rows that are not backed by a direct Codex cord (junction-only links).
     * @param {Array<Object>} events
     * @param {string} archiveSource
     */
    function pruneShowInCodexWithoutDirectCodexEdge(events, archiveSource) {
        var getSnap = typeof window !== 'undefined' && window.CodexCanvasService
            ? window.CodexCanvasService.getBioArchiveCodexSnapshot
            : null;
        if (typeof getSnap !== 'function') return;

        var snap = getSnap();
        if (!snap || !Array.isArray(snap.nodes) || snap.nodes.length === 0) return;

        var arch = archiveSource || '';
        if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return;

        var allowed = snap.allowedShowInCodexPairKeys;
        if (!allowed || typeof allowed.has !== 'function' || allowed.size === 0) return;

        var subjectKind = entityKindForArchive(arch);

        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (!ev || !Array.isArray(ev.connections)) continue;
            var subjectName = ev.name != null ? String(ev.name).trim() : '';
            if (!subjectName) continue;

            var changed = false;
            for (var j = 0; j < ev.connections.length; j++) {
                var c = ev.connections[j];
                if (!c || c.showInCodex !== true) continue;
                var lk = normalizeConnKind(c.kind);
                var ln = sanitizeConnectionEntityName(c.name);
                if (!ln) continue;
                var pk = snap.pairKeyFor(arch, subjectKind, subjectName, lk, ln);
                if (pk && !allowed.has(pk)) {
                    var next = Object.assign({}, c);
                    delete next.showInCodex;
                    ev.connections[j] = next;
                    changed = true;
                }
            }
            if (changed) {
                ev.connections = normalizeBioRows(ev.connections);
            }
        }
    }

    /**
     * @param {Array<Object>} events
     * @param {string} archiveSource heroes|factions|npcs
     * @param {Object} subjectEntry Saved row (same reference as events[i] is fine).
     * @param {Array<Object>} previousConnections Snapshot before this save (for diff).
     */
    function syncMirrorsAfterSubjectSave(events, archiveSource, subjectEntry, previousConnections) {
        if (!Array.isArray(events) || !subjectEntry) return;
        var arch = archiveSource ||
            (window.eventManager &&
                window.eventManager.dataService &&
                window.eventManager.dataService.getArchiveSource &&
                window.eventManager.dataService.getArchiveSource()) || '';
        if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return;

        var subjectKind = entityKindForArchive(arch);
        var subjectName = subjectEntry.name != null ? String(subjectEntry.name).trim() : '';
        if (!subjectName) return;

        var prevList = Array.isArray(previousConnections) ? previousConnections : [];
        var newList = Array.isArray(subjectEntry.connections) ? subjectEntry.connections : [];

        var prevKeys = new Set(
            prevList
                .filter(function (c) { return c && String(c.name || '').trim(); })
                .map(function (c) { return connectionKey(c.kind, c.name); })
        );
        var newKeys = new Set(
            newList
                .filter(function (c) { return c && String(c.name || '').trim(); })
                .map(function (c) { return connectionKey(c.kind, c.name); })
        );

        var em = window.eventManager;

        /* Removals: connections present in `prev` but missing in `new` → drop mirror from linked row. */
        prevKeys.forEach(function (key) {
            if (newKeys.has(key)) return;
            var oldRow = prevList.find(function (c) { return connectionKey(c.kind, c.name) === key; });
            if (!oldRow) return;
            var lk = normalizeConnKind(oldRow.kind);
            var ln = sanitizeConnectionEntityName(oldRow.name);
            if (!ln) return;
            if (connectionKey(lk, ln) === connectionKey(subjectKind, subjectName)) return;
            if (!connectionTargetInThisArchive(arch, lk)) return;
            var linkedIx = findBioEntryIndex(events, lk, ln);
            if (linkedIx < 0) return;
            var linked = events[linkedIx];
            linked.connections = normalizeBioRows(
                removeConnectionToSubject(linked.connections || [], subjectKind, subjectName)
            );
            if (em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
                em.unsavedEventIndices.add(linkedIx);
            }
        });

        /* Upserts: every new connection row → mirror onto linked row. */
        newList.forEach(function (c) {
            if (!c) return;
            var lk = normalizeConnKind(c.kind);
            var ln = sanitizeConnectionEntityName(c.name);
            if (!ln) return;
            if (connectionKey(lk, ln) === connectionKey(subjectKind, subjectName)) return;
            if (!connectionTargetInThisArchive(arch, lk)) return;
            if (!shouldMirrorBioConnectionRow(c)) return;
            var linkedIx = findBioEntryIndex(events, lk, ln);
            if (linkedIx < 0) return;
            coerceFactionMixedRowInPlace(c, subjectKind);
            var mirror = buildMirrorRow(c, subjectKind, subjectName, { copyShowInCodex: false });
            var linked = events[linkedIx];
            linked.connections = normalizeBioRows(upsertMirror(linked.connections, mirror));
            if (em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
                em.unsavedEventIndices.add(linkedIx);
            }
        });

        subjectEntry.connections = normalizeBioRows(subjectEntry.connections);
        pruneShowInCodexWithoutDirectCodexEdge(events, arch);
        pruneJunctionPhantomConnectionsInPlace(events, arch);
        var selfIx = findBioEntryIndex(events, subjectKind, subjectName);
        if (selfIx >= 0 && em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
            em.unsavedEventIndices.add(selfIx);
        }
    }

    window.BioArchiveConnectionsSync = {
        syncMirrorsAfterSubjectSave: syncMirrorsAfterSubjectSave,
        repairMissingMirrorsForBioArchive: repairMissingMirrorsForBioArchive,
        pruneShowInCodexWithoutDirectCodexEdge: pruneShowInCodexWithoutDirectCodexEdge,
        pruneJunctionPhantomConnectionsInPlace: pruneJunctionPhantomConnectionsInPlace,
        bioConnectionRowIsDisplayable: function (c) {
            if (!c) return false;
            var name = c.name != null ? String(c.name).trim() : '';
            if (!name) return false;
            if (bioConnectionRowHasNarrativeText(c)) return true;
            if (Array.isArray(c.ranges) && c.ranges.length) return true;
            return c.showInCodex === true;
        },
        resolveBioArchiveEventIndex: resolveBioArchiveEventIndex,
        isFactionHeroNpcMixed: isFactionHeroNpcMixed
    };
})();
