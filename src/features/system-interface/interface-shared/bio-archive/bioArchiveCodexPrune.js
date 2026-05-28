/**
 * Drop archive `connections[]` rows with `showInCodex: true` when no direct Codex cord exists
 * (matches scripts/server-bio-codex-sync.js). Narrative rows without `showInCodex` are kept.
 */

import { fetchCanonicalCodexJson } from '../../../connection-codex/codex-data/load/CodexJsonRepository.js';
import {
    buildDirectCodexBioPairKeySet,
    pairKeyForBioArchiveConnection,
} from './bioArchiveDirectCodexPairKeys.js';
import { bioConnectionRowIsJunctionPhantomStub } from './bioArchiveConnectionRows.js';

/**
 * @param {unknown} data
 * @returns {{ nodes: object[], edges: object[] }}
 */
function extractCodexNodesEdges(data) {
    if (!data || typeof data !== 'object') return { nodes: [], edges: [] };
    if (Array.isArray(data.nodes)) {
        return {
            nodes: data.nodes,
            edges: Array.isArray(data.edges) ? data.edges : [],
        };
    }
    return { nodes: [], edges: [] };
}

/**
 * @param {string} archiveSource
 */
function entityKindForArchive(archiveSource) {
    if (archiveSource === 'factions') return 'faction';
    if (archiveSource === 'npcs') return 'npc';
    return 'hero';
}

/**
 * @param {object[]} nodes
 * @param {object[]} edges
 */
export function buildBioArchiveCodexPruneSnapshot(nodes, edges) {
    const allowedShowInCodexPairKeys = buildDirectCodexBioPairKeySet(nodes, edges || []);
    return {
        allowedShowInCodexPairKeys,
        pairKeyFor(arch, subjectKind, subjectName, linkedKind, linkedName) {
            return pairKeyForBioArchiveConnection(
                arch,
                subjectKind,
                linkedKind,
                subjectName,
                linkedName,
                nodes,
            );
        },
    };
}

/**
 * @returns {ReturnType<typeof buildBioArchiveCodexPruneSnapshot> | null}
 */
export function getBioArchiveCodexPruneSnapshotFromCanvas() {
    const fn =
        typeof window !== 'undefined' && window.CodexCanvasService?.getBioArchiveCodexSnapshot;
    if (typeof fn !== 'function') return null;
    const snap = fn();
    if (!snap?.allowedShowInCodexPairKeys) return null;
    return snap;
}

/**
 * @param {object[]} events
 * @param {string} archiveSource
 * @param {ReturnType<typeof buildBioArchiveCodexPruneSnapshot>} snap
 * @returns {boolean} whether any row was removed
 */
export function pruneShowInCodexConnectionsInPlace(events, archiveSource, snap) {
    if (!Array.isArray(events) || !snap?.allowedShowInCodexPairKeys) return false;

    const arch = archiveSource || '';
    if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return false;

    const allowed = snap.allowedShowInCodexPairKeys;
    if (!allowed?.size) return false;

    const subjectKind = entityKindForArchive(arch);
    let anyChanged = false;

    for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (!ev || !Array.isArray(ev.connections)) continue;
        const subjectName = ev.name != null ? String(ev.name).trim() : '';
        if (!subjectName) continue;

        const kept = [];
        let changed = false;
        for (let j = 0; j < ev.connections.length; j++) {
            const c = ev.connections[j];
            if (!c) continue;
            if (c.showInCodex !== true) {
                kept.push(c);
                continue;
            }
            const lk = String(c.kind || 'hero').toLowerCase();
            const ln = String(c.name != null ? c.name : '').trim();
            if (!ln) {
                kept.push(c);
                continue;
            }
            const pk = snap.pairKeyFor(arch, subjectKind, subjectName, lk, ln);
            if (pk && allowed.has(pk)) {
                kept.push(c);
            } else {
                changed = true;
            }
        }
        if (changed) {
            ev.connections = kept;
            anyChanged = true;
        }
    }

    return anyChanged;
}

/**
 * @param {object[]} events
 * @param {string} archiveSource
 * @returns {Promise<boolean>}
 */
export async function pruneBioArchiveEventsFromCanonicalCodex(events, archiveSource) {
    const arch = archiveSource || '';
    if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return false;
    if (!Array.isArray(events)) return false;

    let snap = getBioArchiveCodexPruneSnapshotFromCanvas();
    if (!snap) {
        const canonical = await fetchCanonicalCodexJson();
        if (!canonical.ok) return false;
        const { nodes, edges } = extractCodexNodesEdges(canonical.data);
        if (!nodes.length) return false;
        snap = buildBioArchiveCodexPruneSnapshot(nodes, edges);
    }

    return pruneShowInCodexConnectionsInPlace(events, arch, snap);
}

/**
 * Remove mirror stubs with no narrative text and no `showInCodex` (does not touch the Codex canvas).
 * @param {object[]} events
 * @param {string} archiveSource
 * @returns {boolean}
 */
export function pruneJunctionPhantomConnectionsInPlace(events, archiveSource) {
    const arch = archiveSource || '';
    if (arch !== 'heroes' && arch !== 'factions' && arch !== 'npcs') return false;
    if (!Array.isArray(events)) return false;

    let anyChanged = false;
    for (let i = 0; i < events.length; i += 1) {
        const ev = events[i];
        if (!ev || !Array.isArray(ev.connections)) continue;
        const kept = ev.connections.filter((c) => !bioConnectionRowIsJunctionPhantomStub(c));
        if (kept.length !== ev.connections.length) {
            ev.connections = kept;
            anyChanged = true;
        }
    }
    return anyChanged;
}
