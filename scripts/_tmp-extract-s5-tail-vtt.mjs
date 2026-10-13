#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const VTT = path.join('scripts', '_cache', 'yt-_6YaF9Z1KVQ.en.vtt');
const chapters = [
    { title: 'Junker Queen & Roadhog (moon)', start: 723, end: 741 },
    { title: 'Sojourn & Vendetta', start: 756, end: 768 },
    { title: 'Sojourn & Winston', start: 768, end: 788 },
    { title: 'Sojourn, Junkrat & Roadhog', start: 788, end: 811 },
    { title: 'Sombra & Doomfist', start: 811, end: 825 },
    { title: 'Sombra & Mizuki', start: 825, end: 837 },
    { title: 'Sombra & Widowmaker', start: 837, end: 854 },
    { title: 'Jetpack Cat, Bastion & Roadhog', start: 884, end: 894 },
    { title: 'Vendetta & Sigma', start: 909, end: 926 },
    { title: 'Winston & Wrecking Ball', start: 926, end: 962 },
    { title: 'Doomfist & Widowmaker', start: 976, end: 996 },
    { title: 'Doctrine & Sombra (birds)', start: 206, end: 249 },
];

function clean(raw) {
    return String(raw || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/^>+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseTs(ts) {
    const m = String(ts).match(/(?:(\d+):)?(\d+):(\d+)\.(\d+)/);
    if (!m) return 0;
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

const text = fs.readFileSync(VTT, 'utf8');
const cues = [];
for (const block of text.split(/\n\n+/)) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const timeIdx = lines.findIndex((l) => l.includes('-->'));
    if (timeIdx < 0) continue;
    const [a, b] = lines[timeIdx].split('-->').map((s) => s.trim().split(' ')[0]);
    const body = clean(lines.slice(timeIdx + 1).join(' '));
    if (!body) continue;
    cues.push({ start: parseTs(a), end: parseTs(b), text: body });
}

for (const ch of chapters) {
    console.log(`\n======== ${ch.title} [${ch.start}-${ch.end}] ========`);
    let last = '';
    for (const cue of cues) {
        if (cue.end < ch.start - 0.2 || cue.start > ch.end + 0.2) continue;
        const t = cue.text.replace(/^>>\s*/, '').trim();
        if (!t || t === last) continue;
        if (last.includes(t) && t.length < last.length) continue;
        console.log(`${cue.start.toFixed(1)}  ${t}`);
        last = t;
    }
}
