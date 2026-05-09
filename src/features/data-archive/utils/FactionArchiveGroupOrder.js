/**
 * Factions archive: canonical type order for Event Manager list, drag/drop, and stable resort.
 * Unknown / future types sort after known buckets and before empty ("None").
 * Classic script: exposes `window.FactionArchiveGroupOrderHelpers` for EventRenderService / EventDragDropService.
 */

(function attachFactionArchiveGroupOrder(global) {
    const FACTION_ARCHIVE_TYPE_ORDER = [
        'Major Player',
        'Criminal Groups',
        'Military Initiatives',
        'Research Institutions'
    ];

    /** Lowercase collapsed whitespace → exact label from `FACTION_ARCHIVE_TYPE_ORDER` */
    const FACTION_ARCHIVE_TYPE_ALIASES = {
        'major player': 'Major Player',
        'major players': 'Major Player',
        'criminal group': 'Criminal Groups',
        'criminal groups': 'Criminal Groups',
        'military initiative': 'Military Initiatives',
        'military initiatives': 'Military Initiatives',
        'military intiative': 'Military Initiatives',
        'military intiatives': 'Military Initiatives',
        'research institution': 'Research Institutions',
        'research institutions': 'Research Institutions',
        'research insitrutions': 'Research Institutions',
        'research insitutions': 'Research Institutions'
    };

    function normalizeFactionArchiveType(ft) {
        if (ft == null) return '';
        const collapsed = String(ft).trim().replace(/\s+/g, ' ');
        if (!collapsed) return '';
        const l = collapsed.toLowerCase();
        if (FACTION_ARCHIVE_TYPE_ALIASES[l]) return FACTION_ARCHIVE_TYPE_ALIASES[l];
        for (let i = 0; i < FACTION_ARCHIVE_TYPE_ORDER.length; i++) {
            const canon = FACTION_ARCHIVE_TYPE_ORDER[i];
            if (l === canon.toLowerCase()) return canon;
        }
        return collapsed;
    }

    function displayLabelForFactionArchiveType(ft) {
        const s = normalizeFactionArchiveType(ft);
        return s || 'None';
    }

    function factionArchiveTypeRank(ft) {
        const s = normalizeFactionArchiveType(ft);
        if (!s) return 10000;
        const i = FACTION_ARCHIVE_TYPE_ORDER.indexOf(s);
        if (i >= 0) return i;
        return 1000;
    }

    function sortFactionsArchiveEventsStable(events) {
        if (!Array.isArray(events) || events.length < 2) return;
        const decorated = events.map((e, i) => ({
            e,
            i,
            ft: normalizeFactionArchiveType(e?.factionType),
            r: factionArchiveTypeRank(e?.factionType)
        }));
        decorated.sort((a, b) => {
            if (a.r !== b.r) return a.r - b.r;
            if (a.r === 1000 && b.r === 1000) {
                const c = a.ft.localeCompare(b.ft, undefined, { sensitivity: 'base', numeric: true });
                if (c !== 0) return c;
            }
            return a.i - b.i;
        });
        events.length = 0;
        decorated.forEach((d) => events.push(d.e));
    }

    function findFirstIndexForFactionTypeInList(events, typeKey) {
        if (!Array.isArray(events)) return 0;
        const want = normalizeFactionArchiveType(typeKey);
        for (let i = 0; i < events.length; i++) {
            if (normalizeFactionArchiveType(events[i].factionType) === want) return i;
        }
        const r = factionArchiveTypeRank(typeKey);
        if (r === 1000 && want) {
            for (let i = 0; i < events.length; i++) {
                const ri = factionArchiveTypeRank(events[i].factionType);
                const wi = normalizeFactionArchiveType(events[i].factionType);
                if (ri === 1000 && wi.localeCompare(want, undefined, { sensitivity: 'base', numeric: true }) >= 0) {
                    return i;
                }
            }
        }
        for (let i = 0; i < events.length; i++) {
            if (factionArchiveTypeRank(events[i].factionType) > r) return i;
        }
        return events.length;
    }

    function moveFactionEntryToLastInItsTypeGroup(events, ev) {
        if (!Array.isArray(events) || !ev) return;
        const ix = events.indexOf(ev);
        if (ix < 0) return;
        const t = normalizeFactionArchiveType(ev.factionType);
        const r = factionArchiveTypeRank(ev.factionType);
        events.splice(ix, 1);

        let lastSame = -1;
        for (let i = 0; i < events.length; i++) {
            const ti = normalizeFactionArchiveType(events[i].factionType);
            const ri = factionArchiveTypeRank(events[i].factionType);
            const same = ri === r && (r !== 1000 ? ti === t : ti === t);
            if (same) lastSame = i;
        }
        if (lastSame >= 0) {
            events.splice(lastSame + 1, 0, ev);
            return;
        }

        let insertAt = 0;
        for (let i = 0; i < events.length; i++) {
            const ri = factionArchiveTypeRank(events[i].factionType);
            if (ri > r) {
                insertAt = i;
                break;
            }
            if (ri === r && r === 1000) {
                const cmp = normalizeFactionArchiveType(events[i].factionType).localeCompare(t, undefined, {
                    sensitivity: 'base',
                    numeric: true
                });
                if (cmp >= 0) {
                    insertAt = i;
                    break;
                }
            }
            insertAt = i + 1;
        }
        events.splice(insertAt, 0, ev);
    }

    const api = {
        FACTION_ARCHIVE_TYPE_ORDER,
        normalizeFactionArchiveType,
        displayLabelForFactionArchiveType,
        factionArchiveTypeRank,
        sortFactionsArchiveEventsStable,
        findFirstIndexForFactionTypeInList,
        moveFactionEntryToLastInItsTypeGroup
    };

    global.FactionArchiveGroupOrderHelpers = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
