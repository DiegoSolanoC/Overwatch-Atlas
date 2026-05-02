/**
 * Removes bio-archive connection rows that are migration fodder: all relationship
 * text fields empty AND the subject↔linked pair is not a one-hop entity↔entity
 * neighbor pair in data/codex-labels.json (any direction; junction hops excluded).
 *
 * Keeps a row if any of reasoningSubjectToLinked, reasoningLinkedToSubject, or
 * legacy `reasoning` is non-empty (authored slide copy).
 *
 * Run: node scripts/prune-empty-non-codex-adjacent-bio-connections.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const codexPath = path.join(root, 'data', 'codex-labels.json');
const archives = {
    heroes: path.join(root, 'data', 'story-archive-heroes.json'),
    factions: path.join(root, 'data', 'story-archive-factions.json'),
    npcs: path.join(root, 'data', 'story-archive-npcs.json')
};

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

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

function factionAliases(node) {
    const d = String(node.factionDisplay || '').trim();
    const fn = String(node.factionFilename || '').trim();
    const bare = fn.replace(/^\d+/, '').trim();
    const set = new Set();
    [d, bare, fn].forEach((x) => {
        const n = normLoose(x);
        if (n) set.add(n);
    });
    return [...set];
}

function entityMeta(node) {
    if (!node || node.kind === 'junction') return null;
    if (node.kind === 'hero') {
        const name = String(node.heroName || '').trim();
        if (!name) return null;
        const al = new Set([normLoose(name)]);
        const c = heroCompact(name);
        if (c) al.add(c);
        return { kind: 'hero', aliases: [...al] };
    }
    if (node.kind === 'npc') {
        const name = String(node.npcName || '').trim();
        if (!name) return null;
        return { kind: 'npc', aliases: [normLoose(name)] };
    }
    if (node.kind === 'faction') {
        const al = factionAliases(node);
        if (!al.length) return null;
        return { kind: 'faction', aliases: al };
    }
    return null;
}

function pairKey(sigA, sigB) {
    return sigA < sigB ? `${sigA}|${sigB}` : `${sigB}|${sigA}`;
}

function addUndirectedKeysForEdge(allow, a, b) {
    for (const fa of a.aliases) {
        for (const tb of b.aliases) {
            const x = `${a.kind}\0${fa}`;
            const y = `${b.kind}\0${tb}`;
            allow.add(pairKey(x, y));
        }
    }
}

function buildCodexUndirectedEntityNeighborKeys(codex) {
    const nodes = Array.isArray(codex.nodes) ? codex.nodes : [];
    const edges = Array.isArray(codex.edges) ? codex.edges : [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const allow = new Set();
    for (const e of edges) {
        if (!e || !e.fromId || !e.toId) continue;
        const fm = entityMeta(byId.get(e.fromId));
        const tm = entityMeta(byId.get(e.toId));
        if (!fm || !tm) continue;
        addUndirectedKeysForEdge(allow, fm, tm);
    }
    return allow;
}

function eventSubjectName(ev) {
    let n = ev && ev.name != null ? String(ev.name).trim() : '';
    if (!n && Array.isArray(ev?.variants) && ev.variants[0] && ev.variants[0].name != null) {
        n = String(ev.variants[0].name).trim();
    }
    return n;
}

function normConnKind(k) {
    let lk = String(k || 'hero').toLowerCase();
    if (lk === 'character') lk = 'hero';
    if (lk !== 'faction' && lk !== 'npc') lk = 'hero';
    return lk;
}

function rowAliases(kind, rawName) {
    const k = String(kind || 'hero').toLowerCase();
    const s = String(rawName || '').trim();
    if (!s) return [];
    if (k === 'hero') {
        return [...new Set([normLoose(s), heroCompact(s)].filter((x) => x && x.length))];
    }
    if (k === 'faction') {
        const bare = s.replace(/^\d+/, '').trim();
        return [...new Set([normLoose(s), normLoose(bare)].filter(Boolean))];
    }
    return [normLoose(s)].filter(Boolean);
}

function connectionHasAuthoredText(c) {
    const a = String(c?.reasoningSubjectToLinked ?? '').trim();
    const b = String(c?.reasoningLinkedToSubject ?? '').trim();
    const leg = c?.reasoning != null ? String(c.reasoning).trim() : '';
    return !!(a || b || leg);
}

function connectionMatchesCodexNeighbor(allowUndirected, subjectKind, subjectName, conn) {
    const lk = normConnKind(conn.kind);
    const linkedName = conn.name != null ? String(conn.name).trim() : '';
    if (!linkedName) return false;
    const sk = String(subjectKind || 'hero').toLowerCase();
    for (const sa of rowAliases(sk, subjectName)) {
        for (const la of rowAliases(lk, linkedName)) {
            const x = `${sk}\0${sa}`;
            const y = `${lk}\0${la}`;
            if (allowUndirected.has(pairKey(x, y))) return true;
        }
    }
    return false;
}

const codex = readJson(codexPath);
const allowUndirected = buildCodexUndirectedEntityNeighborKeys(codex);

let removed = 0;
let kept = 0;
let eventsTouched = 0;

for (const [archKey, filePath] of Object.entries(archives)) {
    const doc = readJson(filePath);
    const subjectKind =
        archKey === 'heroes' ? 'hero' : archKey === 'factions' ? 'faction' : 'npc';
    const evs = Array.isArray(doc.events) ? doc.events : [];
    for (let i = 0; i < evs.length; i += 1) {
        const ev = evs[i];
        if (!ev || !Array.isArray(ev.connections)) continue;
        const subjectName = eventSubjectName(ev);
        if (!subjectName) continue;
        const before = ev.connections.length;
        ev.connections = ev.connections.filter((c) => {
            if (!c) return false;
            if (connectionHasAuthoredText(c)) {
                kept += 1;
                return true;
            }
            if (connectionMatchesCodexNeighbor(allowUndirected, subjectKind, subjectName, c)) {
                kept += 1;
                return true;
            }
            removed += 1;
            return false;
        });
        if (ev.connections.length !== before) eventsTouched += 1;
    }
    writeJson(filePath, doc);
}

console.log('prune-empty-non-codex-adjacent-bio-connections done.');
console.log('  codex undirected entity-neighbor pair keys:', allowUndirected.size);
console.log('  connection rows kept:', kept);
console.log('  connection rows removed:', removed);
console.log('  events with ≥1 row removed:', eventsTouched);
