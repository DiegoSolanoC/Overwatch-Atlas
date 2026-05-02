/**
 * Removes erroneous showInCodex flags introduced when the migration script used
 * full connected-component closure instead of direct Codex edges only.
 *
 * Keeps showInCodex only when data/codex-labels.json has a DIRECT directed edge
 * between two entity nodes (hero / faction / npc) matching subject → linked.
 *
 * Run: node scripts/strip-transitive-showInCodex-from-archives.mjs
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

/** @param {{ kind: string, aliases: string[] }} a @param {{ kind: string, aliases: string[] }} b */
function directedKeys(a, b) {
    const keys = [];
    for (const fa of a.aliases) {
        for (const tb of b.aliases) {
            keys.push(`${a.kind}\0${fa}=>${b.kind}\0${tb}`);
        }
    }
    return keys;
}

function buildAllowedDirectedKeys(codex) {
    const nodes = Array.isArray(codex.nodes) ? codex.nodes : [];
    const edges = Array.isArray(codex.edges) ? codex.edges : [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const allow = new Set();
    for (const e of edges) {
        if (!e || !e.fromId || !e.toId) continue;
        const fm = entityMeta(byId.get(e.fromId));
        const tm = entityMeta(byId.get(e.toId));
        if (!fm || !tm) continue;
        for (const k of directedKeys(fm, tm)) allow.add(k);
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

/** Name tokens that might appear in allow-set keys for one archive/Codex endpoint. */
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

function connectionDirectedKeys(subjectKind, subjectName, conn) {
    const lk = normConnKind(conn.kind);
    const linkedName = conn.name != null ? String(conn.name).trim() : '';
    if (!linkedName) return [];
    const sk = String(subjectKind || 'hero').toLowerCase();
    const keys = [];
    for (const sa of rowAliases(sk, subjectName)) {
        for (const la of rowAliases(lk, linkedName)) {
            keys.push(`${sk}\0${sa}=>${lk}\0${la}`);
        }
    }
    return [...new Set(keys)];
}

function archiveRowMatchesDirectedEdge(allow, subjectKind, subjectName, conn) {
    for (const k of connectionDirectedKeys(subjectKind, subjectName, conn)) {
        if (allow.has(k)) return true;
    }
    return false;
}

const codex = readJson(codexPath);
const allow = buildAllowedDirectedKeys(codex);

let stripped = 0;
let kept = 0;
let eventsTouched = 0;

for (const [archKey, filePath] of Object.entries(archives)) {
    const doc = readJson(filePath);
    const subjectKind = archKey === 'heroes' ? 'hero' : archKey === 'factions' ? 'faction' : 'npc';
    const evs = Array.isArray(doc.events) ? doc.events : [];
    for (let i = 0; i < evs.length; i += 1) {
        const ev = evs[i];
        if (!ev) continue;
        const subjectName = eventSubjectName(ev);
        if (!subjectName) continue;
        const conns = Array.isArray(ev.connections) ? ev.connections : [];
        let touched = false;
        for (let j = 0; j < conns.length; j += 1) {
            const c = conns[j];
            if (!c || c.showInCodex !== true) continue;
            if (archiveRowMatchesDirectedEdge(allow, subjectKind, subjectName, c)) {
                kept += 1;
                continue;
            }
            delete c.showInCodex;
            stripped += 1;
            touched = true;
        }
        if (touched) eventsTouched += 1;
    }
    writeJson(filePath, doc);
}

console.log('strip-transitive-showInCodex-from-archives done.');
console.log('  allowed directed entity→entity edges from codex:', allow.size);
console.log('  showInCodex kept (matches a direct edge):', kept);
console.log('  showInCodex stripped:', stripped);
console.log('  events with ≥1 strip:', eventsTouched);
