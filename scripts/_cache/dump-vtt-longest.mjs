import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
function vttMs(v) {
    const p = String(v).split(':');
    if (p.length === 3) {
        const [h, m, s] = p;
        return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
    }
    return 0;
}

/** Collect every plain caption payload with time */
const rows = [];
for (const block of VTT.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    const tl = lines.find((l) => l.includes('-->'));
    if (!tl) continue;
    const start = vttMs(tl.split('-->')[0].trim());
    for (const l of lines) {
        if (l.includes('-->') || /^\d+$/.test(l) || /<c>/i.test(l)) continue;
        const text = clean(l);
        if (!text || text === '>>') continue;
        rows.push({ start, text });
    }
}

// For each >> split segment stream, keep growing strings; emit when next doesn't extend
const emitted = [];
let cur = null;
for (const row of rows) {
    const parts = row.text.split(/\s*>>\s*/).map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
        if (!cur) {
            cur = { start: row.start, text: part };
            continue;
        }
        const a = cur.text.toLowerCase().replace(/[^a-z0-9]+/g, '');
        const b = part.toLowerCase().replace(/[^a-z0-9]+/g, '');
        if (b.startsWith(a.slice(0, Math.min(20, a.length))) && part.length >= cur.text.length) {
            cur.text = part;
            continue;
        }
        if (a.startsWith(b) && cur.text.length >= part.length) continue;
        // new turn
        emitted.push(cur);
        cur = { start: row.start, text: part };
    }
}
if (cur) emitted.push(cur);

// dedupe identical neighbors
const out = [];
for (const e of emitted) {
    const prev = out[out.length - 1];
    if (prev && prev.text === e.text) continue;
    out.push(e);
}

const needles = [
    'learn th',
    'good healt',
    'But is th',
    'decide for others',
    'performing',
    'Really',
    'Beirut',
    'not as special',
    'Busan was nice',
    'Sorry',
    'seen you somewhere',
    'definitely not on Mars',
    'abandoning projects',
    'robot squids',
    'hyperbolically',
    'rash mistake',
    'clarity of mind',
    'Looks like I made',
];

console.log('Total turns', out.length);
for (const n of needles) {
    console.log(`\n--- ${n} ---`);
    for (const e of out) {
        if (e.text.toLowerCase().includes(n.toLowerCase())) {
            console.log(((e.start / 1000).toFixed(1) + 's').padStart(7), JSON.stringify(e.text));
        }
    }
}
