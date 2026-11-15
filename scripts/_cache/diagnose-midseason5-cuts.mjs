/**
 * Diagnose Midseason 5: order new MatchTalk by VTT time for clean splits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPath, ensureAuditWorkspace } from '../lib/auditWorkspace.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../..');
const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');
const VTT = fs.readFileSync(path.join(__dirname, 'midseason5-6KAmomizYRQ.en.vtt'), 'utf8');

function coreKey(t) {
    return String(t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '');
}
function clean(raw) {
    return String(raw || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/^>+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function vttMs(v) {
    const p = String(v).split(':');
    if (p.length === 3) {
        const [h, m, s] = p;
        return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
    }
    return 0;
}

const finals = [];
for (const block of VTT.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    const tl = lines.find((l) => l.includes('-->'));
    if (!tl) continue;
    const start = vttMs(tl.split('-->')[0].trim());
    const plain = lines
        .filter((l) => !l.includes('-->') && !/^\d+$/.test(l) && !/<c>/i.test(l))
        .map(clean)
        .filter(Boolean);
    if (!plain.length) continue;
    const text = plain[plain.length - 1];
    if (!text || text === '>>') continue;
    if (finals.length && coreKey(finals.at(-1).text) === coreKey(text)) continue;
    finals.push({ start, text });
}

const turns = [];
for (const row of finals) {
    for (const chunk of row.text.split(/\s*>>\s*/).map((s) => s.trim()).filter(Boolean)) {
        if (chunk.length < 2) continue;
        turns.push({ start: row.start, text: chunk, key: coreKey(chunk) });
    }
}

ensureAuditWorkspace();
const snapRoot = auditPath('herovoice-snapshots');
const baseline = fs.readFileSync(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8').trim();
const post = fs.readFileSync(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8').trim();
const added = new Set();
const addedPath = path.join(snapRoot, `diff_${baseline}_vs_${post}`, 'added.jsonl');
for (const line of fs.readFileSync(addedPath, 'utf8').split(/\n/)) {
    if (!line.trim()) continue;
    const rel = String(JSON.parse(line).rel || '').replace(/\\/g, '/');
    if (/\/MatchTalk\//i.test(rel)) added.add(rel);
}

const pool = [];
for (const h of fs.readdirSync(EXTRACT, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const walk = (dir) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(ent.name) || !/\.0B2-/i.test(ent.name)) continue;
            const rel = path.relative(EXTRACT, full).replace(/\\/g, '/');
            if (!rel.includes('/MatchTalk/')) continue;
            const m = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            const label = m ? m[1] : ent.name;
            const key = coreKey(label);
            if (key.length < 6) continue;
            pool.push({
                hero: h.name,
                label,
                key,
                rel,
                source: full,
                isNew: added.has(rel),
            });
        }
    };
    walk(path.join(EXTRACT, h.name));
}

const newPool = pool.filter((p) => p.isNew);
console.log('new MatchTalk', newPool.length, 'vtt turns', turns.length);

function bestTurn(key) {
    let best = null;
    let score = 1e9;
    for (const t of turns) {
        if (!t.key || t.key.length < 8) continue;
        let s = 1e9;
        if (t.key === key) s = 0;
        else if (key.startsWith(t.key) || t.key.startsWith(key)) {
            const r = Math.min(key.length, t.key.length) / Math.max(key.length, t.key.length);
            if (r >= 0.72) s = 1 + Math.abs(key.length - t.key.length);
        } else if (key.length >= 16 && t.key.includes(key.slice(0, 16))) s = 10;
        else if (t.key.length >= 16 && key.includes(t.key.slice(0, 16))) s = 12;
        else if (key.length >= 20 && t.key.includes(key.slice(0, 20))) s = 8;
        if (s < score) {
            score = s;
            best = t;
        }
    }
    return best && score < 40 ? { ...best, score } : null;
}

const timed = newPool
    .map((p) => ({ ...p, t: bestTurn(p.key) }))
    .filter((p) => p.t)
    .sort((a, b) => a.t.start - b.t.start);

console.log('\n=== Timed new MatchTalk (video order) ===');
for (const p of timed) {
    const sec = (p.t.start / 1000).toFixed(1);
    console.log(`${sec.padStart(6)}  ${p.hero.padEnd(14)}  ${p.label}`);
}

const unmatched = newPool.filter((p) => !bestTurn(p.key));
console.log('\nunmatched new', unmatched.length);
for (const p of unmatched.slice(0, 40)) console.log('  ', p.hero, p.label.slice(0, 80));

fs.writeFileSync(
    path.join(__dirname, 'midseason5-timed-matchtalk.json'),
    JSON.stringify(
        {
            timed: timed.map((p) => ({
                sec: p.t.start / 1000,
                hero: p.hero,
                label: p.label,
                rel: p.rel,
                source: p.source,
                score: p.t.score,
                caption: p.t.text,
            })),
            unmatched: unmatched.map((p) => ({ hero: p.hero, label: p.label, rel: p.rel })),
        },
        null,
        2,
    ),
);
console.log('\nwrote midseason5-timed-matchtalk.json');
