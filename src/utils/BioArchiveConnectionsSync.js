/**
 * When a Heroes / Factions / NPCs archive row is saved, mirror each connection onto the linked row
 * if that row exists in the same archive list (same JSON). Directions swap; removals propagate.
 *
 * Debugging:
 *   - Warnings when a linked archive row cannot be resolved (always logged).
 *   - Verbose: `window.DEBUG_BIO_CONNECTIONS = true` or `localStorage.setItem('debug_bio_connections','1')` then refresh.
 *   - `window.BioArchiveConnectionsSync.setDebug(true|false)` toggles verbose for this session.
 */
(function () {
    'use strict';

    var _verboseBioConnDebug = false;

    function dbgVerboseEnabled() {
        if (_verboseBioConnDebug) return true;
        try {
            if (typeof window !== 'undefined' && window.DEBUG_BIO_CONNECTIONS === true) return true;
            if (typeof localStorage !== 'undefined' && localStorage.getItem('debug_bio_connections') === '1') {
                return true;
            }
        } catch (e) {}
        return false;
    }

    function dbg() {
        if (!dbgVerboseEnabled()) return;
        var args = ['[BioConnSync]'].concat(Array.prototype.slice.call(arguments));
        console.log.apply(console, args);
    }

    function dbgWarn() {
        var args = ['[BioConnSync]'].concat(Array.prototype.slice.call(arguments));
        console.warn.apply(console, args);
    }

    function sampleEventNames(events, limit) {
        if (!Array.isArray(events)) return [];
        var lim = limit != null ? limit : 15;
        var out = [];
        for (var i = 0; i < events.length && out.length < lim; i++) {
            var e = events[i];
            if (!e) continue;
            out.push(e.name != null ? String(e.name) : '(no name)');
        }
        return out;
    }

    function entityKindForArchive(archiveSource) {
        if (archiveSource === 'factions') return 'faction';
        if (archiveSource === 'npcs') return 'npc';
        return 'hero';
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

    /** Trailing commas/semicolons from autocomplete or CSV habits break hero row matching ("Pharah," vs "Pharah"). */
    function sanitizeConnectionEntityName(raw) {
        var t = String(raw == null ? '' : raw).trim();
        while (t.length > 0 && /[,;]\s*$/.test(t)) {
            t = t.replace(/[,;]\s*$/, '').trim();
        }
        return t;
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

        if (nk === 'hero') {
            var wantH = nm.toLowerCase();
            for (var hj = 0; hj < events.length; hj++) {
                var rnh = events[hj] && events[hj].name != null ? String(events[hj].name).trim().toLowerCase() : '';
                if (rnh && rnh === wantH) return hj;
            }
        }

        if (dbgVerboseEnabled()) {
            dbgWarn('findBioEntryIndex: no match', {
                entityKind: nk,
                searchName: name,
                searchNameSanitized: nm,
                eventsCount: events.length,
                sampleRowNames: sampleEventNames(events, 20)
            });
        }
        return -1;
    }

    /**
     * `indexOf` fails when the slide holds a stale object ref; match by archive name instead.
     * @param {Array<Object>} events
     * @param {Object|null} rowRef
     * @param {string} [archiveSource]
     * @returns {number}
     */
    function resolveBioArchiveEventIndex(events, rowRef, archiveSource) {
        if (!Array.isArray(events) || !rowRef) return -1;
        var ix0 = events.indexOf(rowRef);
        if (ix0 >= 0) {
            dbg('resolveIndex: indexOf hit', { idx: ix0, name: rowRef.name, archiveSource: archiveSource });
            return ix0;
        }
        var want = rowRef.name != null ? String(rowRef.name).trim() : '';
        if (!want) return -1;
        var arch = archiveSource || '';
        var ix1 = -1;
        if (arch === 'npcs') {
            ix1 = findBioEntryIndex(events, 'npc', want);
        } else if (arch === 'factions') {
            ix1 = findBioEntryIndex(events, 'faction', want);
        } else if (arch === 'heroes') {
            ix1 = findBioEntryIndex(events, 'hero', want);
        } else {
            for (var i = 0; i < events.length; i++) {
                if (!events[i]) continue;
                var n = events[i].name != null ? String(events[i].name).trim() : '';
                if (n === want) {
                    ix1 = i;
                    break;
                }
            }
        }
        dbg('resolveIndex: fallback', {
            wantedName: want,
            archiveSource: arch,
            idx: ix1,
            eventsCount: events.length,
            hadIndexOf: false
        });
        if (ix1 < 0) {
            dbgWarn('resolveBioArchiveEventIndex: could not place slide row in events[]', {
                rowName: want,
                archiveSource: arch,
                eventsCount: events.length,
                sampleRowNames: sampleEventNames(events, 25)
            });
        }
        return ix1;
    }

    function linkedHasMirrorBack(linked, subjectKind, subjectName) {
        var arr = linked && Array.isArray(linked.connections) ? linked.connections : [];
        var want = connectionKey(subjectKind, subjectName);
        for (var i = 0; i < arr.length; i++) {
            if (connectionKey(arr[i].kind, arr[i].name) === want) return true;
        }
        return false;
    }

    /**
     * Before persisting: ensure every connection row has a reciprocal on the linked entry (same archive list).
     * Idempotent; fixes missed mirrors when slide ref did not match `events[i]`.
     * @param {Array<Object>} events
     * @param {string} archiveSource
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

        dbg('repairMissingMirrorsForBioArchive: start', {
            archive: arch,
            eventsCount: events.length
        });

        var subjectKind = entityKindForArchive(arch);
        var em = window.eventManager;
        var repaired = 0;
        var skippedHasBack = 0;
        var skippedNoLinked = 0;

        for (var i = 0; i < events.length; i++) {
            var E = events[i];
            if (!E) continue;
            var subjectName = E.name != null ? String(E.name).trim() : '';
            if (!subjectName) continue;
            var conns = Array.isArray(E.connections) ? E.connections : [];
            dbg('repair: subject row', { index: i, subjectName: subjectName, connectionCount: conns.length });
            for (var k = 0; k < conns.length; k++) {
                var c = conns[k];
                if (!c) continue;
                var lk = normalizeConnKind(c.kind);
                var ln = sanitizeConnectionEntityName(c.name);
                if (!ln) continue;
                if (connectionKey(lk, ln) === connectionKey(subjectKind, subjectName)) continue;
                var linkedIx = findBioEntryIndex(events, lk, ln);
                if (linkedIx === i) {
                    dbg('repair: skip self-loop', { subjectName: subjectName, connectionName: ln });
                    continue;
                }
                if (linkedIx < 0) {
                    skippedNoLinked += 1;
                    dbgWarn('repair: linked archive row NOT FOUND (mirror impossible)', {
                        fromSubject: subjectName,
                        connectionKind: lk,
                        connectionName: ln,
                        connectionNameJson: JSON.stringify(ln),
                        archive: arch,
                        eventsCount: events.length,
                        sampleRowNames: sampleEventNames(events, 30)
                    });
                    continue;
                }
                var linked = events[linkedIx];
                if (linkedHasMirrorBack(linked, subjectKind, subjectName)) {
                    skippedHasBack += 1;
                    dbg('repair: already has back-link', {
                        subjectName: subjectName,
                        linkedName: linked && linked.name,
                        linkedIndex: linkedIx
                    });
                    continue;
                }
                var dir = directionalTextsFromRow(c);
                var mirror = {
                    kind: subjectKind,
                    name: subjectName,
                    reasoningSubjectToLinked: dir.toSubject,
                    reasoningLinkedToSubject: dir.toLinked
                };
                dbg('repair: ADD mirror', {
                    ontoLinked: linked.name,
                    ontoIndex: linkedIx,
                    mirrorFrom: subjectName,
                    mirror: mirror
                });
                linked.connections = normalizeBioRows(upsertMirror(linked.connections, mirror));
                repaired += 1;
                if (em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
                    em.unsavedEventIndices.add(linkedIx);
                }
            }
        }
        dbg('repairMissingMirrorsForBioArchive: done', {
            archive: arch,
            repairedRows: repaired,
            skippedAlreadyHadBackLink: skippedHasBack,
            skippedLinkedNotInList: skippedNoLinked
        });
        if (typeof console !== 'undefined' && console.info) {
            console.info('[BioConnSync] repair summary (always)', {
                archive: arch,
                eventsCount: events.length,
                mirrorsAdded: repaired,
                skippedLinkedAlreadyPresent: skippedHasBack,
                skippedLinkedNameNotInArchive: skippedNoLinked
            });
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
        if (ix >= 0) {
            arr[ix] = mirrorRow;
        } else {
            arr.push(mirrorRow);
        }
        return arr;
    }

    function directionalTextsFromRow(c) {
        var toLinked =
            c.reasoningSubjectToLinked != null ? String(c.reasoningSubjectToLinked).trim() : '';
        var toSubject =
            c.reasoningLinkedToSubject != null ? String(c.reasoningLinkedToSubject).trim() : '';
        var leg = c.reasoning != null ? String(c.reasoning).trim() : '';
        if (!toLinked && !toSubject && leg) {
            toLinked = leg;
            toSubject = leg;
        }
        return { toLinked: toLinked, toSubject: toSubject };
    }

    /**
     * @param {Array<Object>} events
     * @param {string} archiveSource heroes|factions|npcs
     * @param {Object} subjectEntry Saved row (same reference as events[i] is fine).
     * @param {Array<Object>} previousConnections Snapshot before this save (deep enough for diff).
     */
    function syncMirrorsAfterSubjectSave(events, archiveSource, subjectEntry, previousConnections) {
        if (!Array.isArray(events) || !subjectEntry) return;
        var arch = archiveSource || (window.eventManager && window.eventManager.dataService && window.eventManager.dataService.getArchiveSource && window.eventManager.dataService.getArchiveSource()) || '';
        if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return;

        var subjectKind = entityKindForArchive(arch);
        var subjectName = subjectEntry.name != null ? String(subjectEntry.name).trim() : '';
        if (!subjectName) return;

        dbg('syncMirrorsAfterSubjectSave: start', {
            archive: arch,
            subjectKind: subjectKind,
            subjectName: subjectName,
            eventsCount: events.length,
            prevConnCount: Array.isArray(previousConnections) ? previousConnections.length : 0,
            newConnCount: Array.isArray(subjectEntry.connections) ? subjectEntry.connections.length : 0
        });

        var prevList = Array.isArray(previousConnections) ? previousConnections : [];
        var newList = Array.isArray(subjectEntry.connections) ? subjectEntry.connections : [];

        var prevKeys = new Set(
            prevList
                .filter(function (c) {
                    return c && String(c.name || '').trim();
                })
                .map(function (c) {
                    return connectionKey(c.kind, c.name);
                })
        );
        var newKeys = new Set(
            newList
                .filter(function (c) {
                    return c && String(c.name || '').trim();
                })
                .map(function (c) {
                    return connectionKey(c.kind, c.name);
                })
        );

        var em = window.eventManager;

        prevKeys.forEach(function (key) {
            if (newKeys.has(key)) return;
            var oldRow = prevList.find(function (c) {
                return connectionKey(c.kind, c.name) === key;
            });
            if (!oldRow) return;
            var lk = normalizeConnKind(oldRow.kind);
            var ln = sanitizeConnectionEntityName(oldRow.name);
            if (!ln) return;
            if (connectionKey(lk, ln) === connectionKey(subjectKind, subjectName)) return;
            var linkedIx = findBioEntryIndex(events, lk, ln);
            if (linkedIx < 0) {
                dbgWarn('sync(remove): linked row not found', {
                    subjectName: subjectName,
                    oldConnectionKind: lk,
                    oldConnectionName: ln,
                    archive: arch,
                    sampleRowNames: sampleEventNames(events, 25)
                });
                return;
            }
            var linked = events[linkedIx];
            var next = removeConnectionToSubject(linked.connections || [], subjectKind, subjectName);
            linked.connections = normalizeBioRows(next);
            if (em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
                em.unsavedEventIndices.add(linkedIx);
            }
        });

        newList.forEach(function (c) {
            if (!c) return;
            var lk = normalizeConnKind(c.kind);
            var ln = sanitizeConnectionEntityName(c.name);
            if (!ln) return;
            if (connectionKey(lk, ln) === connectionKey(subjectKind, subjectName)) return;
            var linkedIx = findBioEntryIndex(events, lk, ln);
            if (linkedIx < 0) {
                dbgWarn('sync(upsert): linked row not found', {
                    subjectName: subjectName,
                    connectionKind: lk,
                    connectionName: ln,
                    connectionNameJson: JSON.stringify(ln),
                    archive: arch,
                    sampleRowNames: sampleEventNames(events, 25)
                });
                return;
            }
            var dir = directionalTextsFromRow(c);
            var mirror = {
                kind: subjectKind,
                name: subjectName,
                reasoningSubjectToLinked: dir.toSubject,
                reasoningLinkedToSubject: dir.toLinked
            };
            var linked = events[linkedIx];
            dbg('sync(upsert): writing mirror', {
                linkedIndex: linkedIx,
                linkedRowName: linked && linked.name,
                mirror: mirror
            });
            linked.connections = normalizeBioRows(upsertMirror(linked.connections, mirror));
            if (em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
                em.unsavedEventIndices.add(linkedIx);
            }
        });

        subjectEntry.connections = normalizeBioRows(subjectEntry.connections);

        var selfIx = findBioEntryIndex(events, subjectKind, subjectName);
        if (selfIx >= 0 && em && em.unsavedEventIndices && typeof em.unsavedEventIndices.add === 'function') {
            em.unsavedEventIndices.add(selfIx);
        }
        dbg('syncMirrorsAfterSubjectSave: end', { subjectName: subjectName });
    }

    function setDebug(on) {
        _verboseBioConnDebug = !!on;
        console.log('[BioConnSync] verbose debug ' + (_verboseBioConnDebug ? 'ON' : 'OFF'));
    }

    window.BioArchiveConnectionsSync = {
        syncMirrorsAfterSubjectSave: syncMirrorsAfterSubjectSave,
        repairMissingMirrorsForBioArchive: repairMissingMirrorsForBioArchive,
        resolveBioArchiveEventIndex: resolveBioArchiveEventIndex,
        setDebug: setDebug,
        /** @returns {boolean} */
        isDebugVerbose: function () {
            return dbgVerboseEnabled();
        }
    };
})();
