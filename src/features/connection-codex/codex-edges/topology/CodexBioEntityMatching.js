/**
 * Resolve codex portrait nodes ↔ story-archive entity names (minimal helpers; DOM-free).
 */

import { getFactionMatchHelpers } from '../../codex-integration/bridge/CodexAppBridge.js';
import {
    heroNamesLooselyEqualCodex,
    normalizeBioNameLoose
} from './CodexGraphPrimitives.js';

export function factionNodeMatchesToken(node, token) {
    const raw = String(token || '').trim();
    if (!raw || node.kind !== 'faction') return false;
    const fn = String(node.factionFilename || '').trim();
    const dn = String(node.factionDisplay || '').trim();
    if (fn === raw || dn === raw) return true;
    const fh = getFactionMatchHelpers();
    if (fh && typeof fh.factionIdsMatch === 'function') {
        if (fh.factionIdsMatch(fn, raw) || fh.factionIdsMatch(dn, raw)) return true;
    }
    const bare = raw.replace(/^\d+/, '').trim();
    const fnBare = fn.replace(/^\d+/, '').trim();
    return (
        normalizeBioNameLoose(fnBare) === normalizeBioNameLoose(bare)
        || normalizeBioNameLoose(dn) === normalizeBioNameLoose(bare)
    );
}

/**
 * @param {'hero'|'faction'|'npc'} kind
 * @param {string} nameToken
 * @param {Array<{ id: string, kind?: string, heroName?: string, npcName?: string, factionFilename?: string, factionDisplay?: string }>} nodes
 * @returns {string} node id or ''
 */
export function findCodexNodeIdForBioEntity(kind, nameToken, nodes) {
    const token = String(nameToken || '').trim();
    if (!token || !Array.isArray(nodes)) return '';
    const k = String(kind || 'hero').toLowerCase();
    for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (!n || n.kind === 'junction') continue;
        if (k === 'hero' && n.kind === 'hero' && heroNamesLooselyEqualCodex(n.heroName, token)) {
            return n.id;
        }
        if (k === 'npc' && n.kind === 'npc') {
            if (String(n.npcName || '').trim().toLowerCase() === token.toLowerCase()) return n.id;
        }
        if (k === 'faction' && n.kind === 'faction' && factionNodeMatchesToken(n, token)) {
            return n.id;
        }
    }
    return '';
}
