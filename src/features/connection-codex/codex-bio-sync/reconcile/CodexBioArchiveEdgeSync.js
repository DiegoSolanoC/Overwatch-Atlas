/**
 * Reconcile Codex directed edges with story-archive JSON (heroes / factions / NPCs).
 * Canvas host registers live graph state once per mount.
 */

import { codexUnorderedPairKey, edgeDirectedKey } from '../../codex-edges/topology/CodexGraphPrimitives.js';
import {
    codexBioEntityPairHasJunctionAlternatePath as topologyJunctionAlternatePath,
    codexEdgeIsBioEntityChord
} from '../../codex-edges/topology/CodexGraphTopology.js';
import { findCodexNodeIdForBioEntity } from '../../codex-edges/topology/CodexBioEntityMatching.js';
import { updateAppStatus } from '../../codex-integration/bridge/CodexAppBridge.js';

/** @type {CodexBioArchiveEdgeSyncRuntime|null} */
let _rt = null;

/**
 * @typedef {object} CodexBioArchiveEdgeSyncRuntime
 * @property {() => HTMLElement|null} getRoot
 * @property {() => object[]} getCodexAllNodes
 * @property {() => { fromId: string, toId: string }[]} getCodexEdges
 * @property {(edges: { fromId: string, toId: string }[]) => void} setCodexEdges
 * @property {() => Set<string>} getCodexUnsavedEdgeKeys
 * @property {() => string|null} getCordPendingDeletePairKey
 * @property {(k: string|null) => void} setCordPendingDeletePairKey
 * @property {(fromId: string, toId: string) => boolean} addDirectedCodexEdge
 * @property {() => void} markCodexLayoutDirty
 * @property {() => void} redrawCodexEdges
 */

/** @param {CodexBioArchiveEdgeSyncRuntime} rt */
export function registerCodexBioArchiveEdgeSyncRuntime(rt) {
    _rt = rt;
}

export function unregisterCodexBioArchiveEdgeSyncRuntime() {
    _rt = null;
}

const BIO_ARCHIVE_FILES = Object.freeze([
    ['heroes', 'src/data/story-archive-heroes.json'],
    ['factions', 'src/data/story-archive-factions.json'],
    ['npcs', 'src/data/story-archive-npcs.json']
]);

/**
 * Reconcile Codex cords with archive JSON: drop edges that no longer have a matching
 * `showInCodex` row, then add any missing links from archives. (Junction / country links are left untouched.)
 *
 * Bio↔bio chords listed in the archive are also **removed** when the graph already connects the same pair
 * through at least one junction (“break”) waypoint — same rule as skipping adds — so merged breaks do not
 * leave a misleading direct cord alongside A→J→…→B routing.
 */
export async function syncCodexEdgesFromBioArchiveConnections() {
    if (!_rt) return;
    const root = _rt.getRoot();
    const codexAllNodes = _rt.getCodexAllNodes();
    let codexEdges = _rt.getCodexEdges();
    if (!root || !Array.isArray(codexAllNodes) || codexAllNodes.length === 0) return;

    const codexUnsavedEdgeKeys = _rt.getCodexUnsavedEdgeKeys();

    /** @type {Set<string>} */
    const allowedUnorderedNodePairKeys = new Set();
    /** @type {{ arch: string, events: object[] }[]} */
    const loadedArchives = [];

    for (let fi = 0; fi < BIO_ARCHIVE_FILES.length; fi += 1) {
        const arch = BIO_ARCHIVE_FILES[fi][0];
        const url = BIO_ARCHIVE_FILES[fi][1];
        let events = [];
        try {
            const sep = url.includes('?') ? '&' : '?';
            const res = await fetch(`${url}${sep}v=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) continue;
            const data = await res.json();
            events = Array.isArray(data.events) ? data.events : [];
        } catch (_) {
            continue;
        }
        loadedArchives.push({ arch, events });
        const subjectKind = arch === 'heroes' ? 'hero' : arch === 'factions' ? 'faction' : 'npc';
        for (let ei = 0; ei < events.length; ei += 1) {
            const ev = events[ei];
            if (!ev) continue;
            let subjectName = ev.name != null ? String(ev.name).trim() : '';
            if (
                !subjectName
                && Array.isArray(ev.variants)
                && ev.variants[0]
                && ev.variants[0].name != null
            ) {
                subjectName = String(ev.variants[0].name).trim();
            }
            if (!subjectName) continue;
            const conns = Array.isArray(ev.connections) ? ev.connections : [];
            for (let ci = 0; ci < conns.length; ci += 1) {
                const c = conns[ci];
                if (!c || c.showInCodex !== true) continue;
                let lk = String(c.kind || 'hero').toLowerCase();
                if (lk === 'character') lk = 'hero';
                if (lk !== 'faction' && lk !== 'npc') lk = 'hero';
                const linkedName = c.name != null ? String(c.name).trim() : '';
                if (!linkedName) continue;
                const fromId = findCodexNodeIdForBioEntity(subjectKind, subjectName, codexAllNodes);
                const toId = findCodexNodeIdForBioEntity(lk, linkedName, codexAllNodes);
                if (!fromId || !toId || fromId === toId) continue;
                allowedUnorderedNodePairKeys.add(codexUnorderedPairKey(fromId, toId));
            }
        }
    }

    let removed = 0;
    const nextEdges = [];
    for (let ei = 0; ei < codexEdges.length; ei += 1) {
        const e = codexEdges[ei];
        if (!e || !e.fromId || !e.toId) continue;
        const nFrom = codexAllNodes.find((n) => n && n.id === e.fromId);
        const nTo = codexAllNodes.find((n) => n && n.id === e.toId);
        if (!codexEdgeIsBioEntityChord(nFrom, nTo)) {
            nextEdges.push(e);
            continue;
        }
        const pk = codexUnorderedPairKey(e.fromId, e.toId);
        const authorized = allowedUnorderedNodePairKeys.has(pk);
        const redundantChord =
            authorized && topologyJunctionAlternatePath(e.fromId, e.toId, codexAllNodes, codexEdges);
        if (authorized && !redundantChord) {
            nextEdges.push(e);
        } else {
            removed += 1;
            codexUnsavedEdgeKeys.delete(edgeDirectedKey(e.fromId, e.toId));
        }
    }
    if (removed > 0) {
        codexEdges = nextEdges;
        _rt.setCodexEdges(codexEdges);
        const pk = _rt.getCordPendingDeletePairKey();
        if (pk && !codexEdges.some((ed) => codexUnorderedPairKey(ed.fromId, ed.toId) === pk)) {
            _rt.setCordPendingDeletePairKey(null);
        }
    }

    let added = 0;
    for (let ai = 0; ai < loadedArchives.length; ai += 1) {
        const { arch, events } = loadedArchives[ai];
        const subjectKind = arch === 'heroes' ? 'hero' : arch === 'factions' ? 'faction' : 'npc';
        for (let ei = 0; ei < events.length; ei += 1) {
            const ev = events[ei];
            if (!ev) continue;
            let subjectName = ev.name != null ? String(ev.name).trim() : '';
            if (
                !subjectName
                && Array.isArray(ev.variants)
                && ev.variants[0]
                && ev.variants[0].name != null
            ) {
                subjectName = String(ev.variants[0].name).trim();
            }
            if (!subjectName) continue;
            const conns = Array.isArray(ev.connections) ? ev.connections : [];
            for (let ci = 0; ci < conns.length; ci += 1) {
                const c = conns[ci];
                if (!c || c.showInCodex !== true) continue;
                let lk = String(c.kind || 'hero').toLowerCase();
                if (lk === 'character') lk = 'hero';
                if (lk !== 'faction' && lk !== 'npc') lk = 'hero';
                const linkedName = c.name != null ? String(c.name).trim() : '';
                if (!linkedName) continue;
                const fromId = findCodexNodeIdForBioEntity(subjectKind, subjectName, codexAllNodes);
                const toId = findCodexNodeIdForBioEntity(lk, linkedName, codexAllNodes);
                if (!fromId || !toId || fromId === toId) continue;
                if (topologyJunctionAlternatePath(fromId, toId, codexAllNodes, codexEdges)) continue;
                if (_rt.addDirectedCodexEdge(fromId, toId)) added += 1;
            }
        }
    }

    if (removed > 0 || added > 0) {
        _rt.markCodexLayoutDirty();
        _rt.redrawCodexEdges();
        const parts = [];
        if (removed > 0) parts.push(`removed ${removed} orphan link(s)`);
        if (added > 0) parts.push(`added ${added} from archives`);
        updateAppStatus(`Codex: ${parts.join('; ')} (“Show in Codex”).`, 'success');
    }
}
