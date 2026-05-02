/**
 * After Codex layout is saved, upsert hero/faction/npc bio `connections[]` rows so
 * entity↔entity edges drawn on the board appear in story archives (with showInCodex).
 * Mirrors each link onto both endpoints (same idea as BioArchiveConnectionsSync).
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

    for (const e of edges || []) {
        if (!e || !e.fromId || !e.toId || e.fromId === e.toId) continue;
        const fromNode = byId.get(e.fromId);
        const toNode = byId.get(e.toId);
        const a = nodeToBioEntity(fromNode);
        const b = nodeToBioEntity(toNode);
        if (!a || !b) continue;

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
        bioArchiveFilesWritten: Object.keys(dirty).filter((k) => dirty[k]),
        bioArchiveWarnings: warnings,
    };
}

module.exports = { syncStoryArchivesFromCodexEdges };
