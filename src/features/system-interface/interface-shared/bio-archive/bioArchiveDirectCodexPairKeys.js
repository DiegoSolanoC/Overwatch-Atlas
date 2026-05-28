/**
 * Direct Codex cords only — used to validate `showInCodex` archive rows (not junction reachability).
 */

import { findCodexNodeIdForBioEntity } from '../../../connection-codex/codex-edge-cords/topology/CodexBioEntityMatching.js';
import { normalizeBioNameLoose } from '../../../connection-codex/codex-edge-cords/topology/CodexGraphPrimitives.js';

/**
 * @param {string} arch
 * @param {string} kind
 * @param {string} name
 */
function archiveEntitySignature(arch, kind, name) {
    const k = String(kind || 'hero').toLowerCase();
    const nk = k === 'faction' ? 'faction' : k === 'npc' ? 'npc' : 'hero';
    const n = String(name || '').trim();
    return `${arch}\0${nk}\0${normalizeBioNameLoose(n)}`;
}

/**
 * @param {string} a
 * @param {string} b
 */
function unorderedSigPairKey(a, b) {
    return a <= b ? `${a}\x1e${b}` : `${b}\x1e${a}`;
}

/**
 * @param {object} node
 * @returns {{ arch: string, kind: string, name: string } | null}
 */
function nodeToBioEntity(node) {
    if (!node || !node.kind) return null;
    if (node.kind === 'junction' || node.kind === 'country') return null;
    if (node.kind === 'hero') {
        const name = String(node.heroName || '').trim();
        return name ? { arch: 'heroes', kind: 'hero', name } : null;
    }
    if (node.kind === 'npc') {
        const name = String(node.npcName || '').trim();
        return name ? { arch: 'npcs', kind: 'npc', name } : null;
    }
    if (node.kind === 'faction') {
        const name = String(node.factionDisplay || node.factionFilename || '').trim();
        return name ? { arch: 'factions', kind: 'faction', name } : null;
    }
    return null;
}

/**
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {Set<string>}
 */
export function buildDirectCodexBioPairKeySet(nodes, edges) {
    /** @type {Set<string>} */
    const allowed = new Set();
    const byId = new Map();
    for (const n of nodes || []) {
        if (n?.id) byId.set(n.id, n);
    }

    for (const e of edges || []) {
        if (!e?.fromId || !e?.toId) continue;
        const entA = nodeToBioEntity(byId.get(e.fromId));
        const entB = nodeToBioEntity(byId.get(e.toId));
        if (!entA || !entB) continue;
        const sa = archiveEntitySignature(entA.arch, entA.kind, entA.name);
        const sb = archiveEntitySignature(entB.arch, entB.kind, entB.name);
        if (sa && sb && sa !== sb) allowed.add(unorderedSigPairKey(sa, sb));
    }

    return allowed;
}

/**
 * @param {string} subjectArch
 * @param {string} subjectKind
 * @param {string} subjectName
 * @param {string} linkedKind
 * @param {string} linkedName
 * @param {object[]} [codexNodes]
 */
/**
 * @param {string} fromId
 * @param {string} toId
 * @param {object[]} codexNodes
 * @returns {string}
 */
export function pairKeyForCodexBioNodeIds(fromId, toId, codexNodes) {
    if (!fromId || !toId || fromId === toId || !Array.isArray(codexNodes)) return '';
    const byId = new Map();
    for (const n of codexNodes) {
        if (n?.id) byId.set(n.id, n);
    }
    const entA = nodeToBioEntity(byId.get(fromId));
    const entB = nodeToBioEntity(byId.get(toId));
    if (!entA || !entB) return '';
    const sa = archiveEntitySignature(entA.arch, entA.kind, entA.name);
    const sb = archiveEntitySignature(entB.arch, entB.kind, entB.name);
    if (!sa || !sb || sa === sb) return '';
    return unorderedSigPairKey(sa, sb);
}

export function pairKeyForBioArchiveConnection(
    subjectArch,
    subjectKind,
    linkedKind,
    subjectName,
    linkedName,
    codexNodes,
) {
    let lk = String(linkedKind || 'hero').toLowerCase();
    if (lk === 'character') lk = 'hero';
    if (lk !== 'faction' && lk !== 'npc') lk = 'hero';

    let linkedArch = 'heroes';
    if (lk === 'faction') linkedArch = 'factions';
    else if (lk === 'npc') linkedArch = 'npcs';

    const sk = String(subjectKind || 'hero').toLowerCase();
    const subArch = String(subjectArch || 'heroes');

    let subName = String(subjectName || '').trim();
    let linkName = String(linkedName || '').trim();
    if (codexNodes?.length) {
        const subId = findCodexNodeIdForBioEntity(sk, subName, codexNodes);
        const linkId = findCodexNodeIdForBioEntity(lk, linkName, codexNodes);
        for (const n of codexNodes) {
            if (n?.id === subId && n.kind === 'hero') subName = String(n.heroName || subName).trim();
            if (n?.id === linkId) {
                if (n.kind === 'hero') linkName = String(n.heroName || linkName).trim();
                else if (n.kind === 'npc') linkName = String(n.npcName || linkName).trim();
                else if (n.kind === 'faction') {
                    linkName = String(n.factionDisplay || n.factionFilename || linkName).trim();
                }
            }
        }
    }

    const sa = archiveEntitySignature(subArch, sk, subName);
    const sb = archiveEntitySignature(linkedArch, lk, linkName);
    if (!sa || !sb || sa === sb) return '';
    return unorderedSigPairKey(sa, sb);
}
