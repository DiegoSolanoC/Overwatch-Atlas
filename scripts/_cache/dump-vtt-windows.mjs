import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vtt = fs.readFileSync(path.join(__dirname, 'midseason5-6KAmomizYRQ.en.vtt'), 'utf8');

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

const rows = [];
for (const block of vtt.replace(/\r/g, '').split(/\n\n+/)) {
    const lines = block.split('\n').filter(Boolean);
    const tl = lines.find((l) => l.includes('-->'));
    if (!tl) continue;
    const start = vttMs(tl.split('-->')[0].trim());
    const plain = lines
        .filter((l) => !l.includes('-->') && !/^\d+$/.test(l) && !/<c>/i.test(l))
        .map(clean)
        .filter(Boolean);
    if (!plain.length) continue;
    rows.push({ start, text: plain[plain.length - 1] });
}

const windows = [
    [330, 380],
    [375, 395],
    [280, 300],
    [210, 230],
    [705, 725],
];
for (const [a, b] of windows) {
    console.log(`\n==== ${a}-${b} ====`);
    for (const r of rows.filter((x) => x.start / 1000 >= a && x.start / 1000 <= b)) {
        console.log(String((r.start / 1000).toFixed(1)).padStart(6), JSON.stringify(r.text));
    }
}
