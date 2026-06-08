/**
 * Codex-owned connection topology + metadata.
 *
 * A connection exists between A and B when the graph has a path from A to B using
 * only junction (“break”) hops — no other portrait/faction/npc node in between.
 * Metadata (direction, ranges, showInCodex, pruned) lives in the codex JSON
 * `connections` array; archives no longer store connection rows.
 */

import { findCodexNodeIdForBioEntity } from '../codex-edge-cords/topology/CodexBioEntityMatching.js';
import { normalizeBioNameLoose } from '../codex-edge-cords/topology/CodexGraphPrimitives.js';
import {
    bioConnectionRowHasNarrativeText,
    bioConnectionRowIsDisplayable,
    bioConnectionRowIsPruned,
} from '../../system-interface/interface-shared/bio-archive/bioArchiveConnectionRows.js';
import { normalizeBioArchiveConnectionRow } from '../../system-interface/interface-shared/bio-archive/bioArchiveConnectionRanges.js';

/**
 * @param {string} kind
 */
export function archForConnKind(kind) {
    const k = String(kind || 'hero').toLowerCase();
    if (k === 'faction') return 'factions';
    if (k === 'npc') return 'npcs';
    return 'heroes';
}

/**
 * @param {{ fromId: string, toId: string }[]} edges
 */
function buildUndirectedAdjacency(edges) {
    /** @type {Map<string, Set<string>>} */
    const adj = new Map();
    for (const e of edges || []) {
        if (!e?.fromId || !e?.toId) continue;
        if (!adj.has(e.fromId)) adj.set(e.fromId, new Set());
        if (!adj.has(e.toId)) adj.set(e.toId, new Set());
        adj.get(e.fromId).add(e.toId);
        adj.get(e.toId).add(e.fromId);
    }
    return adj;
}

/**
 * @param {Map<string, object>} byId
 * @param {string} id
 */
function codexNodeIsJunction(byId, id) {
    return byId.get(id)?.kind === 'junction';
}

/**
 * @param {Map<string, object>} byId
 * @param {string} id
 */
function codexNodeIsBioEntity(byId, id) {
    const k = byId.get(id)?.kind;
    return k === 'hero' || k === 'faction' || k === 'npc';
}

/**
 * @param {object} node
 * @returns {{ arch: string, kind: string, name: string } | null}
 */
export function nodeToBioEntity(node) {
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
 * @param {string} subjectKind
 * @param {string} subjectName
 * @param {string} linkedKind
 * @param {string} linkedName
 */
export function codexConnectionSubjectLinkedKey(subjectKind, subjectName, linkedKind, linkedName) {
    const sk = String(subjectKind || 'hero').toLowerCase();
    const lk = String(linkedKind || 'hero').toLowerCase();
    const sn = normalizeBioNameLoose(subjectName);
    const ln = normalizeBioNameLoose(linkedName);
    return `${sk}\0${sn}\0${lk}\0${ln}`;
}

/**
 * Bio entities junction-bridged to the subject (no other bio node between).
 * @param {string} subjectKind
 * @param {string} subjectName
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @returns {{ kind: string, name: string }[]}
 */
export function listJunctionBridgedLinkedEntitiesForSubject(subjectKind, subjectName, nodes, edges) {
    const seedId = findCodexNodeIdForBioEntity(subjectKind, subjectName, nodes || []);
    if (!seedId) return [];

    const byId = new Map();
    for (const n of nodes || []) {
        if (n?.id) byId.set(n.id, n);
    }

    const adj = buildUndirectedAdjacency(edges);
    const seen = new Set([seedId]);
    const queue = [seedId];
    /** @type {Map<string, { kind: string, name: string }>} */
    const linked = new Map();

    while (queue.length) {
        const cur = queue.shift();
        for (const nb of adj.get(cur) || []) {
            if (seen.has(nb)) continue;
            if (codexNodeIsBioEntity(byId, nb)) {
                if (nb !== seedId) {
                    const ent = nodeToBioEntity(byId.get(nb));
                    if (ent) {
                        const key = `${ent.kind}:${normalizeBioNameLoose(ent.name)}`;
                        if (!linked.has(key)) linked.set(key, { kind: ent.kind, name: ent.name });
                    }
                }
                continue;
            }
            if (codexNodeIsJunction(byId, nb)) {
                seen.add(nb);
                queue.push(nb);
            }
        }
    }

    return [...linked.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {object} row
 * @param {string} subjectKind
 * @param {string} subjectName
 */
function metaRowMatchesSubject(row, subjectKind, subjectName) {
    if (!row) return false;
    const sk = String(row.subjectKind || subjectKind || 'hero').toLowerCase();
    const wantSk = String(subjectKind || 'hero').toLowerCase();
    if (sk !== wantSk) return false;
    const sn = String(row.subjectName != null ? row.subjectName : subjectName).trim();
    const wantSn = String(subjectName || '').trim();
    return normalizeBioNameLoose(sn) === normalizeBioNameLoose(wantSn);
}

/**
 * @param {object} row
 */
export function normalizeCodexConnectionMetaRow(row, subjectKind, subjectName) {
    const base = normalizeBioArchiveConnectionRow(
        {
            kind: row?.kind,
            name: row?.name,
            reasoningSubjectToLinked: row?.reasoningSubjectToLinked,
            reasoningLinkedToSubject: row?.reasoningLinkedToSubject,
            reasoning: row?.reasoning,
            thisEntryLane: row?.thisEntryLane,
            showInCodex: row?.showInCodex,
            pruned: row?.pruned,
            ranges: row?.ranges,
        },
        (s) => String(s == null ? '' : s).trim(),
    );
    if (!base) return null;
    return {
        ...base,
        subjectKind: String(subjectKind || 'hero').toLowerCase(),
        subjectName: String(subjectName || '').trim(),
        linkedKind: base.kind,
        linkedName: base.name,
    };
}

/**
 * Display + edit rows for one archive subject, derived from codex graph + stored meta.
 * @param {string} subjectKind
 * @param {string} subjectName
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 * @param {object[]} metaRows
 * @param {{ forEdit?: boolean }} [opts]
 * @returns {object[]}
 */
export function resolveCodexConnectionsForSubject(subjectKind, subjectName, nodes, edges, metaRows, opts = {}) {
    const forEdit = opts.forEdit === true;
    const sk = String(subjectKind || 'hero').toLowerCase();
    const sn = String(subjectName || '').trim();
    if (!sn) return [];

    const linkedFromGraph = listJunctionBridgedLinkedEntitiesForSubject(sk, sn, nodes, edges);
    /** @type {Map<string, object>} */
    const metaByLinked = new Map();
    for (const row of metaRows || []) {
        if (!metaRowMatchesSubject(row, sk, sn)) continue;
        const lk = String(row.linkedKind || row.kind || 'hero').toLowerCase();
        const ln = String(row.linkedName != null ? row.linkedName : row.name || '').trim();
        if (!ln) continue;
        metaByLinked.set(codexConnectionSubjectLinkedKey(sk, sn, lk, ln), row);
    }

    /** @type {object[]} */
    const out = [];
    const seen = new Set();

    for (let i = 0; i < linkedFromGraph.length; i += 1) {
        const { kind, name } = linkedFromGraph[i];
        const key = codexConnectionSubjectLinkedKey(sk, sn, kind, name);
        if (seen.has(key)) continue;
        seen.add(key);

        const stored = metaByLinked.get(key);
        const row = stored
            ? {
                kind: String(stored.linkedKind || stored.kind || kind).toLowerCase(),
                name: String(stored.linkedName != null ? stored.linkedName : stored.name || name).trim(),
                reasoningSubjectToLinked: stored.reasoningSubjectToLinked ?? '',
                reasoningLinkedToSubject: stored.reasoningLinkedToSubject ?? '',
                thisEntryLane: stored.thisEntryLane ?? 'A',
                showInCodex: stored.showInCodex === true,
                pruned: stored.pruned === true,
                ranges: Array.isArray(stored.ranges) ? stored.ranges : undefined,
            }
            : {
                kind,
                name,
                reasoningSubjectToLinked: '',
                reasoningLinkedToSubject: '',
                thisEntryLane: 'A',
            };

        if (!forEdit && bioConnectionRowIsPruned(row)) continue;
        if (!forEdit && !bioConnectionRowIsDisplayable(row)) continue;
        out.push(row);
    }

    for (const row of metaRows || []) {
        if (!metaRowMatchesSubject(row, sk, sn)) continue;
        if (!bioConnectionRowHasNarrativeText(row) && !(Array.isArray(row.ranges) && row.ranges.length)) {
            continue;
        }
        const lk = String(row.linkedKind || row.kind || 'hero').toLowerCase();
        const ln = String(row.linkedName != null ? row.linkedName : row.name || '').trim();
        if (!ln) continue;
        const key = codexConnectionSubjectLinkedKey(sk, sn, lk, ln);
        if (seen.has(key)) continue;
        if (!forEdit && bioConnectionRowIsPruned(row)) continue;
        seen.add(key);
        out.push({
            kind: lk,
            name: ln,
            reasoningSubjectToLinked: row.reasoningSubjectToLinked ?? '',
            reasoningLinkedToSubject: row.reasoningLinkedToSubject ?? '',
            thisEntryLane: row.thisEntryLane ?? 'A',
            showInCodex: row.showInCodex === true,
            pruned: row.pruned === true,
            ranges: Array.isArray(row.ranges) ? row.ranges : undefined,
        });
    }

    return out;
}

/**
 * Replace stored meta rows for one subject with editor output; keep other subjects' rows.
 * @param {object[]} metaRows
 * @param {string} subjectKind
 * @param {string} subjectName
 * @param {object[]} editorRows
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 */
export function mergeCodexConnectionMetaForSubject(metaRows, subjectKind, subjectName, editorRows, nodes, edges) {
    const sk = String(subjectKind || 'hero').toLowerCase();
    const sn = String(subjectName || '').trim();
    const allowed = new Set(
        listJunctionBridgedLinkedEntitiesForSubject(sk, sn, nodes, edges).map(
            (e) => codexConnectionSubjectLinkedKey(sk, sn, e.kind, e.name),
        ),
    );

    const kept = (metaRows || []).filter((r) => !metaRowMatchesSubject(r, sk, sn));
    const next = [...kept];
    /** @type {Set<string>} */
    const editorPairKeys = new Set();

    for (const raw of editorRows || []) {
        const normalized = normalizeCodexConnectionMetaRow(raw, sk, sn);
        if (!normalized || !normalized.linkedName) continue;
        const pairKey = codexConnectionSubjectLinkedKey(
            sk,
            sn,
            normalized.linkedKind,
            normalized.linkedName,
        );
        if (!allowed.has(pairKey) && !bioConnectionRowHasNarrativeText(normalized)) {
            if (!(Array.isArray(normalized.ranges) && normalized.ranges.length)) continue;
        }
        editorPairKeys.add(pairKey);
        next.push(normalized);
    }

    for (const row of metaRows || []) {
        if (!metaRowMatchesSubject(row, sk, sn) || row.pruned !== true) continue;
        const lk = String(row.linkedKind || row.kind || 'hero').toLowerCase();
        const ln = String(row.linkedName != null ? row.linkedName : row.name || '').trim();
        if (!ln) continue;
        const pairKey = codexConnectionSubjectLinkedKey(sk, sn, lk, ln);
        if (!allowed.has(pairKey) || editorPairKeys.has(pairKey)) continue;
        const normalized = normalizeCodexConnectionMetaRow(row, sk, sn);
        if (normalized) next.push(normalized);
    }

    return next;
}

/**
 * @param {string} subjectKind
 * @param {string} subjectName
 * @param {string} linkedKind
 * @param {string} linkedName
 * @param {object[]} metaRows
 */
export function isCodexConnectionPairPruned(subjectKind, subjectName, linkedKind, linkedName, metaRows) {
    const key = codexConnectionSubjectLinkedKey(subjectKind, subjectName, linkedKind, linkedName);
    for (const row of metaRows || []) {
        if (!metaRowMatchesSubject(row, subjectKind, subjectName)) continue;
        const lk = String(row.linkedKind || row.kind || '').toLowerCase();
        const ln = String(row.linkedName != null ? row.linkedName : row.name || '').trim();
        if (codexConnectionSubjectLinkedKey(subjectKind, subjectName, lk, ln) !== key) continue;
        if (row.pruned === true) return true;
    }
    const revKey = codexConnectionSubjectLinkedKey(linkedKind, linkedName, subjectKind, subjectName);
    for (const row of metaRows || []) {
        if (!metaRowMatchesSubject(row, linkedKind, linkedName)) continue;
        const lk = String(row.linkedKind || row.kind || '').toLowerCase();
        const ln = String(row.linkedName != null ? row.linkedName : row.name || '').trim();
        if (codexConnectionSubjectLinkedKey(linkedKind, linkedName, lk, ln) !== revKey) continue;
        if (row.pruned === true) return true;
    }
    return false;
}

/**
 * @param {object[]} metaRows
 */
export function normalizeCodexConnectionMetaList(metaRows) {
    if (!Array.isArray(metaRows)) return [];
    const out = [];
    for (let i = 0; i < metaRows.length; i += 1) {
        const r = metaRows[i];
        if (!r) continue;
        const sk = String(r.subjectKind || 'hero').toLowerCase();
        const sn = String(r.subjectName || '').trim();
        const normalized = normalizeCodexConnectionMetaRow(r, sk, sn);
        if (normalized) out.push(normalized);
    }
    return out;
}
