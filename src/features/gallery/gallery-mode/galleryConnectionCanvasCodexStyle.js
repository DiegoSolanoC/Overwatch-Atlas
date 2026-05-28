/**
 * Resolve Codex node colors/scales for gallery connection canvas portraits.
 */

import { FILES } from '../../../data/registry.js';

/** @type {object[]|null} */
let codexNodesCache = null;

/** @type {Promise<object[]>|null} */
let codexNodesLoadPromise = null;

/**
 * @returns {Promise<object[]>}
 */
export async function loadCodexNodesForGalleryStyle() {
    if (codexNodesCache) return codexNodesCache;
    if (codexNodesLoadPromise) return codexNodesLoadPromise;

    codexNodesLoadPromise = (async () => {
        try {
            const res = await fetch(`${FILES.connectionCodex.codexLabels}?v=${Date.now()}`, {
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json();
                codexNodesCache = Array.isArray(data?.nodes) ? data.nodes : [];
                return codexNodesCache;
            }
        } catch (err) {
            console.warn('[gallery-canvas] Could not load codex-labels for styling:', err);
        }
        codexNodesCache = [];
        return codexNodesCache;
    })();

    return codexNodesLoadPromise;
}

/**
 * @param {string} a
 * @param {string} b
 */
function heroNamesLoose(a, b) {
    const x = String(a || '').trim().toLowerCase();
    const y = String(b || '').trim().toLowerCase();
    if (!x || !y) return false;
    return x === y;
}

/**
 * @param {object} node
 * @param {string} token
 */
function factionNodeMatchesToken(node, token) {
    const raw = String(token || '').trim();
    if (!raw || node.kind !== 'faction') return false;
    const fn = String(node.factionFilename || '').trim();
    const dn = String(node.factionDisplay || '').trim();
    if (fn === raw || dn === raw) return true;
    const fh = typeof window !== 'undefined' ? window.FactionMatchHelpers : null;
    if (fh && typeof fh.factionIdsMatch === 'function') {
        if (fh.factionIdsMatch(fn, raw) || fh.factionIdsMatch(dn, raw)) return true;
    }
    const bare = raw.replace(/^\d+/, '').trim().toLowerCase();
    const fnBare = fn.replace(/^\d+/, '').trim().toLowerCase();
    return fnBare === bare || dn.toLowerCase() === bare;
}

/**
 * @param {'hero'|'faction'|'npc'} kind
 * @param {string} nameToken
 * @param {object[]} codexNodes
 * @returns {{ bgColor?: string, scale?: number }|null}
 */
export function codexVisualStyleForEntity(kind, nameToken, codexNodes) {
    const token = String(nameToken || '').trim();
    if (!token || !Array.isArray(codexNodes)) return null;
    const k = String(kind || 'hero').toLowerCase();

    for (let i = 0; i < codexNodes.length; i += 1) {
        const n = codexNodes[i];
        if (!n || n.kind === 'junction') continue;
        if (k === 'hero' && n.kind === 'hero' && heroNamesLoose(n.heroName, token)) {
            return { bgColor: n.bgColor, scale: n.scale };
        }
        if (k === 'npc' && n.kind === 'npc') {
            if (String(n.npcName || '').trim().toLowerCase() === token.toLowerCase()) {
                return { bgColor: n.bgColor, scale: n.scale };
            }
        }
        if (k === 'faction' && n.kind === 'faction' && factionNodeMatchesToken(n, token)) {
            return { bgColor: n.bgColor, scale: n.scale };
        }
    }
    return null;
}

/**
 * @param {string} hex
 * @param {number} [opacity]
 */
export function hexToRgba(hex, opacity = 0.5) {
    const cleanHex = String(hex || '#ffffff').replace('#', '');
    if (cleanHex.length < 6) return `rgba(255, 255, 255, ${opacity})`;
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
