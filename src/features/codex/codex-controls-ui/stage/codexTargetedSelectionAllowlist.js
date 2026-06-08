/**
 * Allowlist for targeted selection — direct Codex bio cords and junction-bridged neighbors.
 */

import { s } from '../../codex-canvas/core/canvasSession.js';
import { collectJunctionBridgedBioNodeIdsForSeed } from '../../../system-interface/interface-shared/bio-archive/bioArchiveDirectCodexPairKeys.js';
import { isCodexConnectionPairPruned } from '../../codex-connections/CodexConnectionMeta.js';

/** Clears cached archive rows (legacy hook — codex meta is session-local now). */
export function invalidateCodexTargetedArchiveCache() {
    /* no-op: connection metadata lives on the codex payload */
}

/** @returns {null} */
export function getCodexTargetedArchiveCacheSync() {
    return null;
}

/** @returns {Promise<void>} */
export function ensureCodexTargetedArchiveCache() {
    return Promise.resolve();
}

/**
 * @param {object} node
 * @returns {{ arch: string, kind: string, name: string } | null}
 */
function seedEntityFromNode(node) {
    if (!node?.kind) return null;
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
 * @param {object} seedNode
 * @param {object} otherNode
 * @returns {boolean}
 */
function codexPairIsPrunedBetween(seedNode, otherNode) {
    const entA = seedEntityFromNode(seedNode);
    const entB = seedEntityFromNode(otherNode);
    if (!entA || !entB) return false;
    return isCodexConnectionPairPruned(
        entA.kind,
        entA.name,
        entB.kind,
        entB.name,
        s.codexConnections || [],
    );
}

/**
 * Allowed portrait node ids reachable from this seed in targeted selection.
 * @param {string} seedId
 * @returns {Set<string>}
 */
export function buildAllowedBioNodeIdsForTargetedSeed(seedId) {
    /** @type {Set<string>} */
    const allowed = new Set();
    const nodes = s.codexAllNodes || [];
    const edges = s.codexEdges || [];
    const byId = new Map();
    for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (n?.id) byId.set(n.id, n);
    }
    const seed = byId.get(seedId);
    if (!seed) return allowed;

    for (let j = 0; j < edges.length; j += 1) {
        const e = edges[j];
        if (!e) continue;
        let other = '';
        if (e.fromId === seedId) other = e.toId;
        else if (e.toId === seedId) other = e.fromId;
        if (!other) continue;
        const on = byId.get(other);
        if (on && on.kind !== 'junction') {
            if (!codexPairIsPrunedBetween(seed, on)) {
                allowed.add(other);
            }
        }
    }

    for (const bridgedId of collectJunctionBridgedBioNodeIdsForSeed(seedId, nodes, edges)) {
        const on = byId.get(bridgedId);
        if (on && !codexPairIsPrunedBetween(seed, on)) {
            allowed.add(bridgedId);
        }
    }

    return allowed;
}
