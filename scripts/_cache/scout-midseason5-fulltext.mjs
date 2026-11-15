import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { auditPath, ensureAuditWorkspace } from '../lib/auditWorkspace.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');
const VTT = fs.readFileSync(path.join(__dirname, 'midseason5-6KAmomizYRQ.en.vtt'), 'utf8');

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
function coreKey(t) {
    return String(t || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '');
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
    if (finals.length && coreKey(finals.at(-1).text) === coreKey(text)) {
        // keep longer
        if (text.length > finals.at(-1).text.length) finals[finals.length - 1] = { start, text };
        continue;
    }
    finals.push({ start, text });
}

// merge growth captions into fullest form per turn window
const turns = [];
for (const row of finals) {
    const chunks = row.text.split(/\s*>>\s*/).map((s) => s.trim()).filter(Boolean);
    for (const chunk of chunks) {
        if (chunk.length < 2) continue;
        const prev = turns[turns.length - 1];
        if (prev && coreKey(chunk).startsWith(coreKey(prev.text).slice(0, 12)) && chunk.length > prev.text.length) {
            prev.text = chunk;
            continue;
        }
        if (prev && coreKey(prev.text).startsWith(coreKey(chunk)) && prev.text.length >= chunk.length) continue;
        turns.push({ start: row.start, text: chunk, key: coreKey(chunk) });
    }
}

const { conversations: list } = JSON.parse(fs.readFileSync(absFromPublic(FILES.dialogueTheater.conversations), 'utf8'));

function bestCaption(sub) {
    const want = coreKey(sub);
    if (want.length < 10) return null;
    let best = null;
    let score = 1e9;
    for (const t of turns) {
        let s = 1e9;
        if (t.key === want) s = 0;
        else if (t.key.startsWith(want) || want.startsWith(t.key.slice(0, Math.min(want.length, 40)))) {
            s = 1 + Math.abs(t.key.length - want.length);
        } else if (want.length >= 18 && t.key.includes(want.slice(0, 18))) s = 10;
        if (s < score) {
            score = s;
            best = t;
        }
    }
    return best && score < 50 ? best : null;
}

console.log('=== Midseason / renamed targets: caption expansion ===');
const targets = list.filter((c) => {
    const n = String(c.name || '');
    return (
        /^[0-9]+$/.test(n)
        || ['Turned In by Family', 'Waned over time', 'Busan was Nice', 'Loving the Bleach look'].includes(n)
        || String(c.eraName || '').includes('Midseason')
    );
});

for (const c of targets) {
    for (const l of c.lines || []) {
        const sub = String(l.subtitles || '');
        if (!sub) {
            console.log(`${c.name} | ${l.hero} | EMPTY`);
            continue;
        }
        const cap = bestCaption(sub);
        if (!cap) continue;
        if (cap.text.length > sub.length + 2 || /th$|healt$|the$|a$|to$|for$|and$|of$|in$/i.test(sub.trim())) {
            console.log(`${c.name} | ${l.hero}`);
            console.log(`  NOW: ${JSON.stringify(sub)}`);
            console.log(`  CAP: ${JSON.stringify(cap.text)}`);
        }
    }
}

// Roadhog Sorry / Lucio Really
ensureAuditWorkspace();
const snapRoot = auditPath('herovoice-snapshots');
const baseline = fs.readFileSync(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8').trim();
const post = fs.readFileSync(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8').trim();
const added = new Set();
for (const line of fs.readFileSync(path.join(snapRoot, `diff_${baseline}_vs_${post}`, 'added.jsonl'), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const rel = String(JSON.parse(line).rel || '').replace(/\\/g, '/');
    if (/\/MatchTalk\//i.test(rel)) added.add(rel);
}

function findMatchTalk(heroFolders, re) {
    for (const hero of heroFolders) {
        const root = path.join(EXTRACT, hero);
        if (!fs.existsSync(root)) continue;
        const walk = (dir) => {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) walk(full);
                else if (/\.ogg$/i.test(ent.name) && /MatchTalk/i.test(full) && re.test(ent.name + full)) {
                    const rel = path.relative(EXTRACT, full).replace(/\\/g, '/');
                    console.log((added.has(rel) ? 'NEW' : 'old'), rel);
                }
            }
        };
        walk(root);
    }
}

console.log('\n=== Roadhog Sorry-ish ===');
findMatchTalk(['Roadhog'], /Sorry|sorry/);
console.log('\n=== Lúcio Really ===');
findMatchTalk(['Lúcio', 'Lucio'], /Really/);
console.log('\n=== Ana No ===');
findMatchTalk(['Ana'], /^00000006BEB8|0B2-No\.ogg/);

// list evasive meow durations to pick a reasonable take
console.log('\n=== evasive meows takes ===');
const evasiveDir = path.join(EXTRACT, 'Jetpack Cat', 'MatchTalk', '(evasive meows)');
if (fs.existsSync(evasiveDir)) {
    for (const n of fs.readdirSync(evasiveDir).filter((x) => /\.ogg$/i.test(x))) {
        const full = path.join(evasiveDir, n);
        const st = fs.statSync(full);
        console.log(n, 'bytes', st.size);
    }
}
