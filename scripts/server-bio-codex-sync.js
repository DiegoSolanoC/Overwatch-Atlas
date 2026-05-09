/**
 * After Codex layout is saved, upsert hero/faction/npc bio `connections[]` rows so
 * entity links on the board appear in archive JSON (with showInCodex): direct bio↔bio edges **and**
 * bio pairs reachable only through `junction` waypoints (e.g. A → break → B). Mirrors onto both endpoints.
 */
const fs = require('fs');
const path = require('path');

const ARCHIVE_FILES = {
    heroes: 'story-archive-heroes.json',
    factions: 'story-archive-factions.json',
    npcs: 'story-archive-npcs.json',
};

function normLoose(s) {
    return String(s || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function heroCompact(s) {
    return normLoose(s)
        .replace(/:/g, '')
        .replace(/\s/g, '');
}

function sanitizeConnectionEntityName(raw) {
    let t = String(raw == null ? '' : raw).trim();
    while (t.length > 0 && /[,;]\s*$/.test(t)) {
        t = t.replace(/[,;]\s*$/, '').trim();
    }
    return t;
}

function normalizeConnKind(k) {
    let x = String(k || 'hero').toLowerCase();
    if (x === 'character') x = 'hero';
    if (x !== 'faction' && x !== 'npc') x = 'hero';
    return x;
}

function connectionKey(kind, name) {
    return `${normalizeConnKind(kind)}\0${sanitizeConnectionEntityName(name).toLowerCase()}`;
}

function nodeToBioEntity(node) {
    if (!node || !node.kind) return null;
    const k = node.kind;
    if (k === 'junction' || k === 'country') return null;
    if (k === 'hero') {
        const name = sanitizeConnectionEntityName(node.heroName);
        if (!name) return null;
        return { kind: 'hero', arch: 'heroes', connectionName: name };
    }
    if (k === 'npc') {
        const name = sanitizeConnectionEntityName(node.npcName);
        if (!name) return null;
        return { kind: 'npc', arch: 'npcs', connectionName: name };
    }
    if (k === 'faction') {
        const disp = sanitizeConnectionEntityName(node.factionDisplay);
        const fn = sanitizeConnectionEntityName(node.factionFilename);
        const connectionName = disp || fn;
        if (!connectionName) return null;
        return { kind: 'faction', arch: 'factions', connectionName };
    }
    return null;
}

function findHeroIndex(events, wantName) {
    const w = normLoose(wantName);
    const wc = heroCompact(wantName);
    for (let i = 0; i < events.length; i++) {
        const n = events[i] && events[i].name != null ? String(events[i].name).trim() : '';
        if (!n) continue;
        if (normLoose(n) === w) return i;
        if (wc.length && heroCompact(n) === wc) return i;
    }
    return -1;
}

function findNpcIndex(events, wantName) {
    const w = sanitizeConnectionEntityName(wantName).toLowerCase();
    for (let i = 0; i < events.length; i++) {
        const rn = events[i] && events[i].name != null ? String(events[i].name).trim().toLowerCase() : '';
        if (rn && rn === w) return i;
    }
    return -1;
}

function factionNameTokens(name) {
    const s = sanitizeConnectionEntityName(name);
    const set = new Set();
    const nl = normLoose(s);
    if (nl) set.add(nl);
    const bare = s.replace(/^\d+/, '').trim();
    const nb = normLoose(bare);
    if (nb) set.add(nb);
    return [...set];
}

function findFactionIndex(events, wantName) {
    const wantTokens = factionNameTokens(wantName);
    if (!wantTokens.length) return -1;
    for (let j = 0; j < events.length; j++) {
        const rowName = events[j] && events[j].name != null ? String(events[j].name).trim() : '';
        if (!rowName) continue;
        const rowTokens = factionNameTokens(rowName);
        for (const wt of wantTokens) {
            if (rowTokens.includes(wt)) return j;
        }
    }
    return -1;
}

function findEventIndexForEntity(events, arch, entity) {
    if (arch === 'heroes') return findHeroIndex(events, entity.connectionName);
    if (arch === 'npcs') return findNpcIndex(events, entity.connectionName);
    return findFactionIndex(events, entity.connectionName);
}

function entityKindForArchiveSource(arch) {
    if (arch === 'factions') return 'faction';
    if (arch === 'npcs') return 'npc';
    return 'hero';
}

function archForConnKind(k) {
    const nk = normalizeConnKind(k);
    if (nk === 'faction') return 'factions';
    if (nk === 'npc') return 'npc';
    return 'heroes';
}

function unorderedPairKey(a, b) {
    return a <= b ? `${a}\x1e${b}` : `${b}\x1e${a}`;
}

/** Undirected adjacency for path finding (Codex edges are stored directed). */
function buildUndirectedAdj(byId, edges) {
    /** @type {Map<string, string[]>} */
    const adj = new Map();
    function link(u, v) {
        if (!u || !v || u === v) return;
        if (!byId.has(u) || !byId.has(v)) return;
        if (!adj.has(u)) adj.set(u, []);
        adj.get(u).push(v);
    }
    for (const e of edges || []) {
        if (!e || !e.fromId || !e.toId) continue;
        link(e.fromId, e.toId);
        link(e.toId, e.fromId);
    }
    return adj;
}

function bioEntityResolvableInArchives(loads, entity) {
    if (!entity || !entity.arch) return false;
    const events = loads[entity.arch]?.events || [];
    return findEventIndexForEntity(events, entity.arch, entity) >= 0;
}

/**
 * All hero/faction/npc pairs that should appear as mirrored `showInCodex` archive links:
 * — direct bio↔bio edges on the Codex
 * — bio↔bio pairs connected by any path whose **interior** vertices are only `junction` nodes
 *   (e.g. Ironclad → break → Wayfinder counts as Ironclad ↔ Wayfinder).
 * @returns {{ allowedKeys: Set<string>, pairs: { a: object, b: object }[] }}
 */
function collectCodexBioConnectionPairs(loads, byId, edges) {
    /** @type {Set<string>} */
    const allowedKeys = new Set();
    /** @type {Map<string, { a: object, b: object }>} */
    const pairByKey = new Map();

    function recordPair(entityA, entityB) {
        if (!entityA || !entityB) return;
        if (!bioEntityResolvableInArchives(loads, entityA) || !bioEntityResolvableInArchives(loads, entityB)) return;
        const sa = canonicalBioEntitySignature(loads, entityA);
        const sb = canonicalBioEntitySignature(loads, entityB);
        if (!sa || !sb || sa === sb) return;
        const k = unorderedPairKey(sa, sb);
        if (pairByKey.has(k)) return;
        pairByKey.set(k, { a: entityA, b: entityB });
        allowedKeys.add(k);
    }

    const und = buildUndirectedAdj(byId, edges);
    const bioIds = [...byId.keys()].filter((id) => {
        const ent = nodeToBioEntity(byId.get(id));
        return !!ent;
    });

    for (const startId of bioIds) {
        const startNode = byId.get(startId);
        const startEnt = nodeToBioEntity(startNode);
        if (!startEnt) continue;

        const visitedJunction = new Set();
        const queue = [];

        for (const nbrId of und.get(startId) || []) {
            const nbrNode = byId.get(nbrId);
            if (!nbrNode) continue;
            const nbrEnt = nodeToBioEntity(nbrNode);
            if (nbrEnt && nbrId !== startId) {
                recordPair(startEnt, nbrEnt);
            } else if (nbrNode.kind === 'junction' && !visitedJunction.has(nbrId)) {
                visitedJunction.add(nbrId);
                queue.push(nbrId);
            }
        }

        while (queue.length) {
            const u = queue.shift();
            for (const nbrId of und.get(u) || []) {
                if (nbrId === startId) continue;
                const nbrNode = byId.get(nbrId);
                if (!nbrNode) continue;
                const nbrEnt = nodeToBioEntity(nbrNode);
                if (nbrEnt) {
                    recordPair(startEnt, nbrEnt);
                    continue;
                }
                if (nbrNode.kind === 'junction' && !visitedJunction.has(nbrId)) {
                    visitedJunction.add(nbrId);
                    queue.push(nbrId);
                }
            }
        }
    }

    return { allowedKeys, pairs: [...pairByKey.values()] };
}

/**
 * Stable signature for an archive row / codex bio entity, using the canonical row name when found.
 * @param {Record<string, { events: object[] }>} loads
 * @param {{ arch: string, kind: string, connectionName: string }} bioEntity
 */
function canonicalBioEntitySignature(loads, bioEntity) {
    if (!bioEntity || !bioEntity.arch) return '';
    const events = loads[bioEntity.arch]?.events || [];
    const ix = findEventIndexForEntity(events, bioEntity.arch, bioEntity);
    let name = sanitizeConnectionEntityName(bioEntity.connectionName);
    if (ix >= 0 && events[ix] && events[ix].name != null) {
        name = String(events[ix].name).trim();
    }
    const k = normalizeConnKind(bioEntity.kind);
    return `${bioEntity.arch}\0${connectionKey(k, name)}`;
}

/**
 * Undirected pair keys for every archive-backed entity pair implied by the Codex graph
 * (direct bio edges + bio pairs linked only through `junction` vertices). See {@link collectCodexBioConnectionPairs}.
 */
function buildAllowedEntityPairKeys(loads, byId, edges) {
    return collectCodexBioConnectionPairs(loads, byId, edges).allowedKeys;
}

/**
 * Remove `connections[]` rows with `showInCodex: true` when no matching implied Codex link exists
 * (direct bio edge or bio↔bio through junction-only paths). Narrative-only rows stay.
 * @returns {{ removed: number, dirty: { heroes: boolean, factions: boolean, npcs: boolean } }}
 */
function pruneStaleShowInCodexConnections(loads, allowedKeys) {
    let removed = 0;
    const dirty = { heroes: false, factions: false, npcs: false };
    for (const arch of Object.keys(ARCHIVE_FILES)) {
        const events = loads[arch]?.events;
        if (!Array.isArray(events)) continue;
        const subjKind = entityKindForArchiveSource(arch);
        for (let i = 0; i < events.length; i += 1) {
            const ev = events[i];
            if (!ev || !Array.isArray(ev.connections)) continue;
            const subjectName = ev.name != null ? String(ev.name).trim() : '';
            if (!subjectName) continue;
            const subjEntity = { arch, kind: subjKind, connectionName: subjectName };
            const subjectSig = canonicalBioEntitySignature(loads, subjEntity);
            const next = [];
            for (let j = 0; j < ev.connections.length; j += 1) {
                const c = ev.connections[j];
                if (!c) continue;
                if (c.showInCodex !== true) {
                    next.push(c);
                    continue;
                }
                const lk = normalizeConnKind(c.kind);
                const ln = sanitizeConnectionEntityName(c.name);
                if (!ln) {
                    next.push(c);
                    continue;
                }
                const linkedEntity = { arch: archForConnKind(lk), kind: lk, connectionName: ln };
                const linkedSig = canonicalBioEntitySignature(loads, linkedEntity);
                const pk = unorderedPairKey(subjectSig, linkedSig);
                if (allowedKeys.has(pk)) {
                    next.push(c);
                } else {
                    removed += 1;
                    dirty[arch] = true;
                }
            }
            if (next.length !== ev.connections.length) {
                ev.connections = next;
            }
        }
    }
    return { removed, dirty };
}

/**
 * Read-only: compare Codex entity edges vs archive `showInCodex` rows (for UI preview).
 * @returns {{ ok: boolean, pairsInCodex: string[], pairsInArchives: string[], onlyInArchives: string[], onlyInCodex: string[] }}
 */
function diffStoryArchivesVsCodex(dataDir, nodes, edges) {
    const loads = {};
    for (const arch of Object.keys(ARCHIVE_FILES)) {
        const p = path.join(dataDir, ARCHIVE_FILES[arch]);
        try {
            loads[arch] = JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch (_) {
            loads[arch] = { events: [] };
        }
        if (!Array.isArray(loads[arch].events)) loads[arch].events = [];
    }
    const byId = new Map();
    for (const n of nodes || []) {
        if (n && n.id) byId.set(n.id, n);
    }
    const allowedKeys = buildAllowedEntityPairKeys(loads, byId, edges);
    const codexLabels = [...allowedKeys].map((k) => k.replace(/\x1e/g, ' · ').replace(/\0/g, ' | ')).sort();

    const archiveKeys = new Set();
    /** @type {Map<string, string>} */
    const archiveKeyToLabel = new Map();
    for (const arch of Object.keys(ARCHIVE_FILES)) {
        const events = loads[arch].events;
        const subjKind = entityKindForArchiveSource(arch);
        for (let i = 0; i < events.length; i += 1) {
            const ev = events[i];
            if (!ev || !Array.isArray(ev.connections)) continue;
            const subjectName = ev.name != null ? String(ev.name).trim() : '';
            if (!subjectName) continue;
            const subjEntity = { arch, kind: subjKind, connectionName: subjectName };
            const subjectSig = canonicalBioEntitySignature(loads, subjEntity);
            for (let j = 0; j < ev.connections.length; j += 1) {
                const c = ev.connections[j];
                if (!c || c.showInCodex !== true) continue;
                const lk = normalizeConnKind(c.kind);
                const ln = sanitizeConnectionEntityName(c.name);
                if (!ln) continue;
                const linkedEntity = { arch: archForConnKind(lk), kind: lk, connectionName: ln };
                const linkedSig = canonicalBioEntitySignature(loads, linkedEntity);
                const pk = unorderedPairKey(subjectSig, linkedSig);
                if (!archiveKeyToLabel.has(pk)) {
                    archiveKeys.add(pk);
                    archiveKeyToLabel.set(
                        pk,
                        `${subjectName} ↔ ${lk} "${ln}" [${arch}]`
                    );
                }
            }
        }
    }

    const onlyInArchives = [...archiveKeys]
        .filter((k) => !allowedKeys.has(k))
        .map((k) => archiveKeyToLabel.get(k) || k)
        .sort();
    const onlyInCodex = [...allowedKeys]
        .filter((k) => !archiveKeys.has(k))
        .map((k) => k.replace(/\x1e/g, ' · ').replace(/\0/g, ' | '))
        .sort();

    return {
        ok: true,
        pairsInCodexCount: allowedKeys.size,
        pairsInArchivesShowInCodexCount: archiveKeys.size,
        onlyInArchives,
        onlyInCodex,
        pairsInCodexLabels: codexLabels,
    };
}

function upsertConnectionRow(events, eventIndex, targetKind, targetName) {
    const ev = events[eventIndex];
    if (!ev) return false;
    if (!Array.isArray(ev.connections)) ev.connections = [];
    const tk = normalizeConnKind(targetKind);
    const name = sanitizeConnectionEntityName(targetName);
    if (!name) return false;
    const key = connectionKey(tk, name);
    const ix = ev.connections.findIndex((c) => c && connectionKey(c.kind, c.name) === key);
    const base = {
        kind: tk,
        name,
        reasoningSubjectToLinked: '',
        reasoningLinkedToSubject: '',
        thisEntryLane: 'A',
        showInCodex: true,
    };
    if (ix >= 0) {
        const cur = ev.connections[ix];
        const outSubj = String(cur.reasoningSubjectToLinked ?? '').trim();
        const outLink = String(cur.reasoningLinkedToSubject ?? '').trim();
        const leg = cur.reasoning != null ? String(cur.reasoning).trim() : '';
        const mergedSubj = outSubj || (leg && !outLink ? leg : outSubj);
        const mergedLink = outLink || (leg && !outSubj ? leg : outLink);
        const already =
            normalizeConnKind(cur.kind) === tk &&
            sanitizeConnectionEntityName(cur.name) === name &&
            cur.showInCodex === true &&
            String(cur.reasoningSubjectToLinked ?? '').trim() === String(mergedSubj).trim() &&
            String(cur.reasoningLinkedToSubject ?? '').trim() === String(mergedLink).trim();
        if (already) return false;
        ev.connections[ix] = {
            ...cur,
            kind: tk,
            name,
            showInCodex: true,
            reasoningSubjectToLinked: mergedSubj,
            reasoningLinkedToSubject: mergedLink,
        };
        return true;
    }
    ev.connections.push(base);
    return true;
}

function atomicWriteJson(filePath, obj) {
    const json = JSON.stringify(obj, null, 2) + '\n';
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, json, 'utf8');
    fs.renameSync(tmpPath, filePath);
}

/**
 * @param {string} dataDir absolute path to `data/`
 * @param {object[]} nodes
 * @param {{ fromId: string, toId: string }[]} edges
 */
function syncStoryArchivesFromCodexEdges(dataDir, nodes, edges) {
    const warnings = [];
    let upserts = 0;
    const byId = new Map();
    for (const n of nodes || []) {
        if (n && n.id) byId.set(n.id, n);
    }

    const loads = {};
    const dirty = { heroes: false, factions: false, npcs: false };

    for (const arch of Object.keys(ARCHIVE_FILES)) {
        const p = path.join(dataDir, ARCHIVE_FILES[arch]);
        try {
            loads[arch] = JSON.parse(fs.readFileSync(p, 'utf8'));
        } catch (e) {
            warnings.push(`skip ${arch}: ${e.message}`);
            loads[arch] = { events: [] };
        }
        if (!Array.isArray(loads[arch].events)) loads[arch].events = [];
    }

    const { allowedKeys, pairs } = collectCodexBioConnectionPairs(loads, byId, edges);
    const { removed: pruned, dirty: dirtyPrune } = pruneStaleShowInCodexConnections(loads, allowedKeys);
    for (const k of Object.keys(dirty)) {
        if (dirtyPrune[k]) dirty[k] = true;
    }

    for (let pi = 0; pi < pairs.length; pi += 1) {
        const { a, b } = pairs[pi];
        const eventsA = loads[a.arch].events;
        const eventsB = loads[b.arch].events;
        const ixA = findEventIndexForEntity(eventsA, a.arch, a);
        const ixB = findEventIndexForEntity(eventsB, b.arch, b);
        if (ixA < 0) {
            warnings.push(`no archive row for "${a.connectionName}" (${a.arch})`);
            continue;
        }
        if (ixB < 0) {
            warnings.push(`no archive row for "${b.connectionName}" (${b.arch})`);
            continue;
        }

        if (upsertConnectionRow(eventsA, ixA, b.kind, b.connectionName)) {
            dirty[a.arch] = true;
            upserts += 1;
        }
        if (upsertConnectionRow(eventsB, ixB, a.kind, a.connectionName)) {
            dirty[b.arch] = true;
            upserts += 1;
        }
    }

    for (const arch of Object.keys(ARCHIVE_FILES)) {
        if (!dirty[arch]) continue;
        const filePath = path.join(dataDir, ARCHIVE_FILES[arch]);
        try {
            atomicWriteJson(filePath, loads[arch]);
        } catch (err) {
            warnings.push(`write ${arch} failed: ${err.message}`);
        }
    }

    return {
        bioArchiveSync: true,
        bioConnectionsUpserted: upserts,
        bioConnectionsRemoved: pruned,
        bioArchiveFilesWritten: Object.keys(dirty).filter((k) => dirty[k]),
        bioArchiveWarnings: warnings,
    };
}

module.exports = { syncStoryArchivesFromCodexEdges, diffStoryArchivesVsCodex };
