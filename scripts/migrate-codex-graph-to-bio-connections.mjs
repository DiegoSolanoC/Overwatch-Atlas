/**
 * Optional bootstrap: for each DIRECTED edge in data/codex-labels.json whose endpoints
 * are both entity nodes (hero / faction / npc), upsert mirrored bio connections on both
 * archive rows with showInCodex: true and empty relationship text.
 *
 * Does NOT connect nodes that only share a path through junctions (no transitive closure).
 *
 * Run: node scripts/migrate-codex-graph-to-bio-connections.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const codexPath = path.join(root, 'src', 'data', 'codex-labels.json');
const files = {
    heroes: path.join(root, 'src', 'data', 'story-archive-heroes.json'),
    factions: path.join(root, 'src', 'data', 'story-archive-factions.json'),
    npcs: path.join(root, 'src', 'data', 'story-archive-npcs.json')
};

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function entityMeta(node) {
    if (!node || node.kind === 'junction') return null;
    if (node.kind === 'hero') {
        return { kind: 'hero', name: String(node.heroName || '').trim(), arch: 'heroes' };
    }
    if (node.kind === 'npc') {
        return { kind: 'npc', name: String(node.npcName || '').trim(), arch: 'npcs' };
    }
    if (node.kind === 'faction') {
        const name = String(node.factionDisplay || node.factionFilename || '').trim();
        return { kind: 'faction', name, arch: 'factions' };
    }
    return null;
}

function connKey(kind, name) {
    return `${kind}\0${String(name || '').trim().toLowerCase()}`;
}

function upsertConnection(rows, kind, name, extra) {
    const k = connKey(kind, name);
    const ix = rows.findIndex((r) => connKey(r.kind, r.name) === k);
    const row = {
        kind,
        name: String(name).trim(),
        reasoningSubjectToLinked: '',
        reasoningLinkedToSubject: '',
        thisEntryLane: 'A',
        showInCodex: true,
        ...extra
    };
    if (ix >= 0) {
        rows[ix] = { ...rows[ix], ...row };
    } else {
        rows.push(row);
    }
}

const codex = readJson(codexPath);
const nodes = Array.isArray(codex.nodes) ? codex.nodes : [];
const edges = Array.isArray(codex.edges) ? codex.edges : [];
const byId = new Map(nodes.map((n) => [n.id, n]));

const pairSeen = new Set();
const directedPairs = [];

for (const e of edges) {
    if (!e || !e.fromId || !e.toId || e.fromId === e.toId) continue;
    const fm = entityMeta(byId.get(e.fromId));
    const tm = entityMeta(byId.get(e.toId));
    if (!fm || !tm) continue;
    const key = `${connKey(fm.kind, fm.name)}=>${connKey(tm.kind, tm.name)}`;
    if (pairSeen.has(key)) continue;
    pairSeen.add(key);
    directedPairs.push({ fm, tm });
}

const archives = {
    heroes: readJson(files.heroes),
    factions: readJson(files.factions),
    npcs: readJson(files.npcs)
};

function findEventIndex(doc, name) {
    const want = String(name || '').trim().toLowerCase();
    const evs = doc.events || [];
    for (let i = 0; i < evs.length; i += 1) {
        const nm = evs[i] && evs[i].name != null ? String(evs[i].name).trim().toLowerCase() : '';
        if (nm === want) return i;
    }
    return -1;
}

let applied = 0;
let skipped = 0;

for (const { fm, tm } of directedPairs) {
    const docFrom = archives[fm.arch];
    const docTo = archives[tm.arch];
    const ixFrom = findEventIndex(docFrom, fm.name);
    const ixTo = findEventIndex(docTo, tm.name);
    if (ixFrom < 0 || ixTo < 0) {
        skipped += 1;
        continue;
    }
    const rowFrom = docFrom.events[ixFrom];
    const rowTo = docTo.events[ixTo];
    if (!Array.isArray(rowFrom.connections)) rowFrom.connections = [];
    if (!Array.isArray(rowTo.connections)) rowTo.connections = [];
    upsertConnection(rowFrom.connections, tm.kind, tm.name, { thisEntryLane: 'A' });
    upsertConnection(rowTo.connections, fm.kind, fm.name, { thisEntryLane: 'A' });
    applied += 1;
}

writeJson(files.heroes, archives.heroes);
writeJson(files.factions, archives.factions);
writeJson(files.npcs, archives.npcs);

console.log('migrate-codex-graph-to-bio-connections done (direct edges only).');
console.log('  unique directed entity→entity edges:', directedPairs.length);
console.log('  pair-upserts applied (both sides):', applied);
console.log('  skipped (missing archive row):', skipped);
