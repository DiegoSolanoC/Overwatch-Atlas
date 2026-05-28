/** CodexNodeFilters — Codex canvas slice. */
import { api } from '../../codex-canvas/core/codexCanvasApi.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import {
    exposeApplyCodexFilterState,
    getFactionMatchHelpers,
    getStandaloneActiveFiltersSet,
    getStoryFilterPlacesSync
} from '../../codex-canvas/bridge/CodexAppBridge.js';
import { redrawCodexEdges } from '../../codex-node-drawing/redraw/CodexEdgeRedraw.js';
import { capOpts, DOUBLE_RIGHT_MS, CODEX_JUNCTION_PREVIEW_DATA_URI, MAX_SUGGEST, CODEX_DEBUG_UI_PREF_KEY_LEGACY, CODEX_MODE_PREF_KEY } from '../../codex-canvas/core/canvasConstants.js';


function codexNodeMatchesFilters(nodeEl) {
    const activeFilters = getStandaloneActiveFiltersSet();
    if (!activeFilters || activeFilters.size === 0) {
        return true; // No filters active, all nodes match
    }
    
    const kind = nodeEl.dataset.codexKind;
    const hero = nodeEl.dataset.codexHero || '';
    const npc = nodeEl.dataset.codexNpc || '';
    const faction = nodeEl.dataset.codexFactionFile || '';
    const country = nodeEl.dataset.codexCountryKey || '';
    
    // Junction nodes (break points) are never filtered out
    if (kind === 'junction') {
        return true;
    }
    
    // Special case: Numbani country node matches if Efi, Adawe, or Orisa are selected
    if (kind === 'country' && country.toLowerCase() === 'numbani') {
        const numbaniRelatedFilters = ['Efi', 'Adawe', 'Orisa'];
        for (const filter of activeFilters) {
            for (const related of numbaniRelatedFilters) {
                if (filter === related || filter === `hero:${related}` || filter === `npc:${related}`) {
                    return true;
                }
            }
        }
        // Numbani node doesn't match if none of the related filters are selected
        return false;
    }
    
    // Build filter keys for this node
    const nodeFilterKeys = new Set();
    if (kind === 'hero' && hero) {
        nodeFilterKeys.add(hero);
        nodeFilterKeys.add(`hero:${hero}`);
    } else if (kind === 'npc' && npc) {
        nodeFilterKeys.add(npc);
        nodeFilterKeys.add(`npc:${npc}`);
    } else if (kind === 'faction' && faction) {
        nodeFilterKeys.add(faction);
        nodeFilterKeys.add(`faction:${faction}`);
    } else if (kind === 'country' && country) {
        nodeFilterKeys.add(country);
        nodeFilterKeys.add(`country:${country}`);
    }
    
    // Check if any of the node's filter keys are in the active filters
    for (const filter of activeFilters) {
        if (nodeFilterKeys.has(filter)) {
            return true;
        }
    }
    
    return false;
}

function applyCodexFilterState() {
    if (!s.root) return;
    
    const nodes = s.root.querySelectorAll('.codex-node');

    nodes.forEach((nodeEl) => {
        const matches = codexNodeMatchesFilters(nodeEl);

        if (matches) {
            nodeEl.classList.remove('codex-node--filtered-out');
            nodeEl.classList.add('codex-node--filter-match');
        } else {
            nodeEl.classList.add('codex-node--filtered-out');
            nodeEl.classList.remove('codex-node--filter-match');
        }
    });
}

function applyCodexEventThumbnailFilterHover(event, displayEvent) {
    const codexRoot = s.root || document.getElementById('codex-view-root');
    if (!codexRoot || !event) return;
    clearCodexEventThumbnailFilterHover();
    const disp = displayEvent && typeof displayEvent === 'object' ? displayEvent : event;
    const S = getStoryFilterPlacesSync();
    const mergeList = (a, b) => [...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])];
    const heroesRaw = S?.getStoryEventHeroTokens
        ? mergeList(S.getStoryEventHeroTokens(event), S.getStoryEventHeroTokens(disp))
        : mergeList(event.filters, disp.filters);
    const factionsRaw = S?.getStoryEventFactionTokens
        ? mergeList(S.getStoryEventFactionTokens(event), S.getStoryEventFactionTokens(disp))
        : mergeList(event.factions, disp.factions);
    const npcsRaw = S?.getStoryEventNpcTokens
        ? mergeList(S.getStoryEventNpcTokens(event), S.getStoryEventNpcTokens(disp))
        : mergeList(event.npcs, disp.npcs);
    const heroesLower = new Set(
        heroesRaw.map((h) => String(h || '').trim().toLowerCase()).filter(Boolean)
    );
    const npcsLower = new Set(
        npcsRaw.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
    );
    const factions = Array.isArray(factionsRaw) ? factionsRaw : [];
    const fh = getFactionMatchHelpers();

    codexRoot.querySelectorAll('.codex-node').forEach((el) => {
        if (!codexRoot.contains(el) || el.classList.contains('codex-node--junction')) return;
        const kind = el.dataset.codexKind;
        let match = false;
        if (kind === 'hero' && heroesLower.has(String(el.dataset.codexHero || '').trim().toLowerCase())) {
            match = true;
        }
        if (kind === 'npc' && npcsLower.has(String(el.dataset.codexNpc || '').trim().toLowerCase())) {
            match = true;
        }
        if (kind === 'faction' && factions.length) {
            const fn = el.dataset.codexFactionFile || '';
            const fd = el.dataset.codexFactionDisplay || '';
            for (let i = 0; i < factions.length; i++) {
                const ef = factions[i];
                if (fh && typeof fh.factionIdsMatch === 'function') {
                    if (fh.factionIdsMatch(fn, ef) || fh.factionIdsMatch(fd, ef)) {
                        match = true;
                        break;
                    }
                } else if (fn === ef || fd === ef) {
                    match = true;
                    break;
                }
            }
        }
        if (match) el.classList.add('codex-node--filter-hover');
    });
    redrawCodexEdges();
}

function clearCodexEventThumbnailFilterHover() {
    const codexRoot = s.root || document.getElementById('codex-view-root');
    if (!codexRoot) return;
    const els = codexRoot.querySelectorAll('.codex-node--filter-hover');
    if (!els.length) return;
    els.forEach((el) => el.classList.remove('codex-node--filter-hover'));
    redrawCodexEdges();
}


if (typeof window !== 'undefined') {
    exposeApplyCodexFilterState(applyCodexFilterState);
}


api.codexNodeMatchesFilters = codexNodeMatchesFilters;
api.applyCodexFilterState = applyCodexFilterState;
api.applyCodexEventThumbnailFilterHover = applyCodexEventThumbnailFilterHover;
api.clearCodexEventThumbnailFilterHover = clearCodexEventThumbnailFilterHover;

