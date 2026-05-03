/**
 * Heroes archive: canonical **Role** + **Subrole** order for Event Manager list, filter panel, drag/drop.
 * Classic script: exposes `window.HeroArchiveRoleOrderHelpers`.
 */

(function attachHeroArchiveRoleOrder(global) {
    /** @type {string[]} */
    const HERO_ARCHIVE_ROLE_ORDER = ['Tank', 'Damage', 'Support'];

    const HERO_ARCHIVE_ROLE_ALIASES = {
        tank: 'Tank',
        damage: 'Damage',
        dps: 'Damage',
        support: 'Support'
    };

    /** @type {Record<string, string[]>} */
    const HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE = {
        Tank: ['Initiator', 'Bruiser', 'Stalwart'],
        Damage: ['Specialist', 'Sharpshooter', 'Flanker', 'Recon'],
        Support: ['Tactician', 'Medic', 'Survivor']
    };

    const HERO_ARCHIVE_SUBROLE_ALIASES = {
        initiator: 'Initiator',
        bruiser: 'Bruiser',
        stalwart: 'Stalwart',
        specialist: 'Specialist',
        sharpshooter: 'Sharpshooter',
        flanker: 'Flanker',
        recon: 'Recon',
        tactician: 'Tactician',
        medic: 'Medic',
        survivor: 'Survivor'
    };

    function normalizeHeroArchiveRole(r) {
        if (r == null) return '';
        const collapsed = String(r).trim().replace(/\s+/g, ' ');
        if (!collapsed) return '';
        const l = collapsed.toLowerCase();
        if (HERO_ARCHIVE_ROLE_ALIASES[l]) return HERO_ARCHIVE_ROLE_ALIASES[l];
        for (let i = 0; i < HERO_ARCHIVE_ROLE_ORDER.length; i++) {
            const canon = HERO_ARCHIVE_ROLE_ORDER[i];
            if (l === canon.toLowerCase()) return canon;
        }
        return collapsed;
    }

    function displayLabelForHeroArchiveRole(r) {
        const s = normalizeHeroArchiveRole(r);
        return s || 'None';
    }

    function heroArchiveRoleRank(r) {
        const s = normalizeHeroArchiveRole(r);
        if (!s) return 10000;
        const i = HERO_ARCHIVE_ROLE_ORDER.indexOf(s);
        if (i >= 0) return i;
        return 1000;
    }

    function subroleListForRole(roleNorm) {
        if (!roleNorm) return [];
        const list = HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE[roleNorm];
        return Array.isArray(list) ? list : [];
    }

    function normalizeHeroArchiveSubrole(sub, roleNorm) {
        const role = normalizeHeroArchiveRole(roleNorm);
        if (!role) return '';
        const collapsed = sub == null ? '' : String(sub).trim().replace(/\s+/g, ' ');
        if (!collapsed) return '';
        const l = collapsed.toLowerCase();
        if (HERO_ARCHIVE_SUBROLE_ALIASES[l]) return HERO_ARCHIVE_SUBROLE_ALIASES[l];
        const list = subroleListForRole(role);
        for (let i = 0; i < list.length; i++) {
            const canon = list[i];
            if (l === canon.toLowerCase()) return canon;
        }
        return collapsed;
    }

    function displayLabelForHeroArchiveSubrole(sub, roleNorm) {
        const role = normalizeHeroArchiveRole(roleNorm);
        const s = normalizeHeroArchiveSubrole(sub, role);
        return s || 'None';
    }

    function heroArchiveSubroleRank(sub, roleNorm) {
        const role = normalizeHeroArchiveRole(roleNorm);
        const s = normalizeHeroArchiveSubrole(sub, role);
        if (!s) return 10000;
        const list = subroleListForRole(role);
        const i = list.indexOf(s);
        if (i >= 0) return i;
        return 1000;
    }

    function sortHeroesArchiveEventsStable(events) {
        if (!Array.isArray(events) || events.length < 2) return;
        const decorated = events.map((e, i) => {
            const hr = normalizeHeroArchiveRole(e?.heroRole);
            const r = heroArchiveRoleRank(e?.heroRole);
            const hs = normalizeHeroArchiveSubrole(e?.heroSubRole, hr);
            const sr = heroArchiveSubroleRank(e?.heroSubRole, hr);
            return { e, i, hr, r, hs, sr };
        });
        decorated.sort((a, b) => {
            if (a.r !== b.r) return a.r - b.r;
            if (a.sr !== b.sr) return a.sr - b.sr;
            if (a.sr === 1000 && b.sr === 1000) {
                const c = a.hs.localeCompare(b.hs, undefined, { sensitivity: 'base', numeric: true });
                if (c !== 0) return c;
            }
            return a.i - b.i;
        });
        events.length = 0;
        decorated.forEach((d) => events.push(d.e));
    }

    function findFirstIndexForHeroRoleInList(events, roleKey) {
        if (!Array.isArray(events)) return 0;
        const want = normalizeHeroArchiveRole(roleKey);
        for (let i = 0; i < events.length; i++) {
            if (normalizeHeroArchiveRole(events[i].heroRole) === want) return i;
        }
        const r = heroArchiveRoleRank(roleKey);
        if (r === 1000 && want) {
            for (let i = 0; i < events.length; i++) {
                const ri = heroArchiveRoleRank(events[i].heroRole);
                const wi = normalizeHeroArchiveRole(events[i].heroRole);
                if (ri === 1000 && wi.localeCompare(want, undefined, { sensitivity: 'base', numeric: true }) >= 0) {
                    return i;
                }
            }
        }
        for (let i = 0; i < events.length; i++) {
            if (heroArchiveRoleRank(events[i].heroRole) > r) return i;
        }
        return events.length;
    }

    function findFirstIndexForHeroRoleAndSubroleInList(events, roleKey, subroleKey) {
        if (!Array.isArray(events)) return 0;
        const wantR = normalizeHeroArchiveRole(roleKey);
        const wantS = normalizeHeroArchiveSubrole(subroleKey, wantR);
        for (let i = 0; i < events.length; i++) {
            if (normalizeHeroArchiveRole(events[i].heroRole) !== wantR) continue;
            const si = normalizeHeroArchiveSubrole(events[i].heroSubRole, wantR);
            if (si === wantS) return i;
        }
        const sr = heroArchiveSubroleRank(subroleKey, wantR);
        if (sr === 1000 && wantS) {
            for (let i = 0; i < events.length; i++) {
                if (normalizeHeroArchiveRole(events[i].heroRole) !== wantR) continue;
                const wi = normalizeHeroArchiveSubrole(events[i].heroSubRole, wantR);
                const ri2 = heroArchiveSubroleRank(events[i].heroSubRole, wantR);
                if (ri2 === 1000 && wi.localeCompare(wantS, undefined, { sensitivity: 'base', numeric: true }) >= 0) {
                    return i;
                }
            }
        }
        for (let i = 0; i < events.length; i++) {
            if (normalizeHeroArchiveRole(events[i].heroRole) !== wantR) continue;
            if (heroArchiveSubroleRank(events[i].heroSubRole, wantR) > sr) return i;
        }
        for (let i = 0; i < events.length; i++) {
            if (heroArchiveRoleRank(events[i].heroRole) > heroArchiveRoleRank(wantR)) return i;
        }
        return events.length;
    }

    function moveHeroEntryToLastInItsRoleGroup(events, ev) {
        if (!Array.isArray(events) || !ev) return;
        const ix = events.indexOf(ev);
        if (ix < 0) return;
        const t = normalizeHeroArchiveRole(ev.heroRole);
        const r = heroArchiveRoleRank(ev.heroRole);
        events.splice(ix, 1);

        let lastSame = -1;
        for (let i = 0; i < events.length; i++) {
            const ti = normalizeHeroArchiveRole(events[i].heroRole);
            const ri = heroArchiveRoleRank(events[i].heroRole);
            const same = ri === r && (r !== 1000 ? ti === t : ti === t);
            if (same) lastSame = i;
        }
        if (lastSame >= 0) {
            events.splice(lastSame + 1, 0, ev);
            return;
        }

        let insertAt = 0;
        for (let i = 0; i < events.length; i++) {
            const ri = heroArchiveRoleRank(events[i].heroRole);
            if (ri > r) {
                insertAt = i;
                break;
            }
            if (ri === r && r === 1000) {
                const cmp = normalizeHeroArchiveRole(events[i].heroRole).localeCompare(t, undefined, {
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

    function moveHeroEntryToLastInItsSubroleGroup(events, ev) {
        if (!Array.isArray(events) || !ev) return;
        const ix = events.indexOf(ev);
        if (ix < 0) return;
        const roleN = normalizeHeroArchiveRole(ev.heroRole);
        const r = heroArchiveRoleRank(ev.heroRole);
        const subN = normalizeHeroArchiveSubrole(ev.heroSubRole, roleN);
        const sr = heroArchiveSubroleRank(ev.heroSubRole, roleN);
        events.splice(ix, 1);

        let lastSame = -1;
        for (let i = 0; i < events.length; i++) {
            const ti = normalizeHeroArchiveRole(events[i].heroRole);
            const si = normalizeHeroArchiveSubrole(events[i].heroSubRole, ti);
            if (ti === roleN && si === subN) lastSame = i;
        }
        if (lastSame >= 0) {
            events.splice(lastSame + 1, 0, ev);
            return;
        }

        let insertAt = 0;
        for (let i = 0; i < events.length; i++) {
            const ri = heroArchiveRoleRank(events[i].heroRole);
            const ti = normalizeHeroArchiveRole(events[i].heroRole);
            if (ri > r) {
                insertAt = i;
                break;
            }
            if (ri === r && ti.localeCompare(roleN, undefined, { sensitivity: 'base', numeric: true }) > 0) {
                insertAt = i;
                break;
            }
            if (ri === r && ti === roleN) {
                const sri = heroArchiveSubroleRank(events[i].heroSubRole, roleN);
                if (sri > sr) {
                    insertAt = i;
                    break;
                }
                if (sri === sr && sr === 1000) {
                    const cmp = normalizeHeroArchiveSubrole(events[i].heroSubRole, roleN).localeCompare(subN, undefined, {
                        sensitivity: 'base',
                        numeric: true
                    });
                    if (cmp >= 0) {
                        insertAt = i;
                        break;
                    }
                }
            }
            insertAt = i + 1;
        }
        events.splice(insertAt, 0, ev);
    }

    const api = {
        HERO_ARCHIVE_ROLE_ORDER,
        HERO_ARCHIVE_SUBROLE_ORDER_BY_ROLE,
        normalizeHeroArchiveRole,
        displayLabelForHeroArchiveRole,
        heroArchiveRoleRank,
        normalizeHeroArchiveSubrole,
        displayLabelForHeroArchiveSubrole,
        heroArchiveSubroleRank,
        sortHeroesArchiveEventsStable,
        findFirstIndexForHeroRoleInList,
        findFirstIndexForHeroRoleAndSubroleInList,
        moveHeroEntryToLastInItsRoleGroup,
        moveHeroEntryToLastInItsSubroleGroup
    };

    global.HeroArchiveRoleOrderHelpers = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
