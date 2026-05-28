/**
 * Archive-backed allowlist for targeted selection — only `showInCodex` neighbors
 * (plus direct Codex bio↔bio cords) count as branch endpoints; junction side paths are pruned.
 */

import { FILES } from '../../../../data/registry.js';
import { s } from '../../codex-canvas/core/canvasSession.js';
import { findCodexNodeIdForBioEntity } from '../../codex-edge-cords/topology/CodexBioEntityMatching.js';
import { heroNamesLooselyEqualCodex } from '../../codex-edge-cords/topology/CodexGraphPrimitives.js';

/** @type {{ heroes: object[], factions: object[], npcs: object[] } | null} */
let archiveCache = null;

/** @type {Promise<void> | null} */
let archiveCachePromise = null;

async function loadArchiveJson(url) {
    try {
        const res = await fetch(url);
        if (!res.ok) return { events: [] };
        return await res.json();
    } catch (_) {
        return { events: [] };
    }
}

/** @returns {Promise<void>} */
export function ensureCodexTargetedArchiveCache() {
    if (archiveCache) return Promise.resolve();
    if (archiveCachePromise) return archiveCachePromise;
    archiveCachePromise = (async () => {
        const [heroes, factions, npcs] = await Promise.all([
            loadArchiveJson(FILES.storyArchive.heroes),
            loadArchiveJson(FILES.storyArchive.factions),
            loadArchiveJson(FILES.storyArchive.npcs),
        ]);
        archiveCache = {
            heroes: heroes.events || [],
            factions: factions.events || [],
            npcs: npcs.events || [],
        };
    })();
    return archiveCachePromise;
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
 * @param {object} node
 * @param {{ heroes: object[], factions: object[], npcs: object[] }} cache
 * @returns {object|null}
 */
function findArchiveEventForSeedNode(node, cache) {
    const ent = seedEntityFromNode(node);
    if (!ent) return null;
    const events = cache[ent.arch] || [];
    for (let i = 0; i < events.length; i += 1) {
        const ev = events[i];
        if (!ev) continue;
        if (ent.kind === 'hero' && heroNamesLooselyEqualCodex(ev.name, ent.name)) return ev;
        if (String(ev.name || '').trim().toLowerCase() === ent.name.toLowerCase()) return ev;
    }
    return null;
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
        if (on && on.kind !== 'junction') allowed.add(other);
    }

    const ent = seedEntityFromNode(seed);
    if (!ent || !archiveCache) return allowed;

    const entry = findArchiveEventForSeedNode(seed, archiveCache);
    if (!entry) return allowed;

    const conns = entry.connections || [];
    for (let k = 0; k < conns.length; k += 1) {
        const c = conns[k];
        if (!c || c.showInCodex !== true) continue;
        const linkId = findCodexNodeIdForBioEntity(c.kind, c.name, nodes);
        if (linkId) allowed.add(linkId);
    }

    return allowed;
}
