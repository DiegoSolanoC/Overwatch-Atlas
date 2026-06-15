/**
 * Early classic-script shim so slideBioConnections can resolve legacy NPC names
 * before ES modules finish loading.
 */
(function () {
    'use strict';

    var LEGACY = { chisaka: 'Chikasa' };

    function resolveNpcCanonicalName(name) {
        var raw = String(name != null ? name : '').trim();
        if (!raw) return '';
        var legacy = LEGACY[raw.toLowerCase()];
        if (legacy) return legacy;
        var list = window.eventManager && window.eventManager.npcs;
        if (Array.isArray(list)) {
            var lower = raw.toLowerCase();
            for (var i = 0; i < list.length; i++) {
                if (String(list[i]).toLowerCase() === lower) return String(list[i]);
            }
        }
        return raw;
    }

    window.NpcNameAliasHelpers = {
        NPC_NAME_LEGACY_TO_CANONICAL: LEGACY,
        resolveNpcCanonicalName: resolveNpcCanonicalName,
        npcNamesLooselyEqual: function (a, b) {
            var ca = resolveNpcCanonicalName(a).toLowerCase();
            var cb = resolveNpcCanonicalName(b).toLowerCase();
            return ca !== '' && ca === cb;
        },
        activeFilterSetMatchesNpcId: function (activeFilters, npcId) {
            if (!activeFilters || !activeFilters.size || npcId == null) return false;
            var canon = resolveNpcCanonicalName(npcId);
            if (!canon) return false;
            if (activeFilters.has(canon)) return true;
            var raw = String(npcId).trim();
            if (raw && activeFilters.has(raw)) return true;
            for (var f of activeFilters) {
                if (resolveNpcCanonicalName(f) === canon) return true;
            }
            return false;
        },
    };
})();
