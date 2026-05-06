/**
 * Faction id matching: PNG filenames may use a numeric prefix (e.g. 25Shambali Order.png); filter chip key is manifest `filename`.
 * Event data may store the prefixed filename, manifest displayName, or other aliases — all should match
 * the same globe filter chip (filterKey = manifest filename).
 *
 * LEGACY_FACTION_BODY_ALIASES: short / old labels after renames (e.g. "Shambali" → "Shambali Order").
 */
(function attachFactionMatchHelpers(global) {
    /** Normalized body (lowercase) → canonical body for matching. */
    /** Short / pre-rename bodies (after stripping `^\d+`) → body form matching current manifest filenames. */
    const LEGACY_FACTION_BODY_ALIASES = {
        shambali: 'shambali order',
        omnica: 'omnica corporation',
        vishkar: 'vishkar corporation',
        lucheng: 'lucheng interstellar',
        ironclad: 'ironclad guild',
        crusaders: 'crusader initiative',
        volskaya: 'volskaya industries',
        crisis: 'the anubis omnic crisis',
        lumerico: 'lumérico incorporated',
        deadlock: 'deadlock rebels',
        junkers: 'junker monarchy',
        wayfinders: 'wayfinder society',
        shimada: 'shimada clan',
        hashimoto: 'hashimoto clan',
        conspiracy: 'the chernobog conspiracy',
        oasis: 'oasis ministries',
        collective: 'the martins collective',
        phreaks: 'the phreaks',
        meka: 'm.e.k.a squad',
        yokai: 'yokai gang',
        /* Legacy names → La Coterie (manifest filename 18La Coterie.png) */
        'livre tournois': 'la coterie',
        'max\'s vault': 'la coterie'
    };

    function normalizeFactionMatchKey(raw) {
        const s = String(raw ?? '').trim();
        if (!s) return '';
        if (/^\d+$/.test(s)) return s.toLowerCase();
        const rest = s.replace(/^\d+/, '').trim();
        let body = (rest || s).replace(/\s+/g, ' ').trim().toLowerCase();
        if (LEGACY_FACTION_BODY_ALIASES[body]) {
            body = LEGACY_FACTION_BODY_ALIASES[body];
        }
        return body;
    }

    function factionIdsMatch(a, b) {
        const na = normalizeFactionMatchKey(a);
        const nb = normalizeFactionMatchKey(b);
        return na !== '' && na === nb;
    }

    function activeFilterSetMatchesFactionId(activeFilters, factionId) {
        if (factionId == null || !activeFilters || activeFilters.size === 0) return false;
        const id = String(factionId).trim();
        if (!id) return false;
        if (activeFilters.has(id)) return true;
        const idNorm = normalizeFactionMatchKey(id);
        if (!idNorm) return false;
        for (const a of activeFilters) {
            if (normalizeFactionMatchKey(String(a).trim()) === idNorm) return true;
        }
        return false;
    }

    global.FactionMatchHelpers = {
        normalizeFactionMatchKey,
        factionIdsMatch,
        activeFilterSetMatchesFactionId,
        LEGACY_FACTION_BODY_ALIASES
    };
})(typeof window !== 'undefined' ? window : globalThis);
