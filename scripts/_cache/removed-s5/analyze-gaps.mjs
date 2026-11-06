#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('scripts/_cache/removed-s5');
const DESC = path.join(ROOT, 'description.txt');
const VTT = path.join(ROOT, 'yt-qIJz7O5ZF_E.en.vtt');

function parseTs(ts) {
    const m = String(ts).trim().match(/^(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/);
    if (!m) {
        const short = String(ts).trim().match(/^(\d+):(\d+)$/);
        if (!short) return 0;
        return Number(short[1]) * 60 + Number(short[2]);
    }
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4] || 0) / 1000;
}

function parseChapters(desc) {
    const chapters = [];
    let inTs = false;
    for (const line of desc.split(/\r?\n/)) {
        if (/^TIMESTAMPS:/i.test(line)) {
            inTs = true;
            continue;
        }
        if (!inTs) continue;
        if (/^-----/.test(line) || /^overwatch /i.test(line) || /^#/.test(line)) break;
        const m = line.match(/^(\d+:\d+(?::\d+)?)\s+(.+)$/);
        if (!m) continue;
        chapters.push({ start: parseTs(m[1]), title: m[2].trim(), rawTime: m[1] });
    }
    for (let i = 0; i < chapters.length; i++) {
        chapters[i].end = i + 1 < chapters.length ? chapters[i + 1].start : 1289;
    }
    return chapters;
}

function parseVtt(text) {
    const cues = [];
    for (const block of text.split(/\n\n+/)) {
        const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
        const timeIdx = lines.findIndex((l) => l.includes('-->'));
        if (timeIdx < 0) continue;
        const [a, b] = lines[timeIdx].split('-->').map((s) => s.trim().split(' ')[0]);
        const body = lines
            .slice(timeIdx + 1)
            .join(' ')
            .replace(/<[^>]+>/g, '')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&#39;/g, "'")
            .trim();
        if (!body) continue;
        cues.push({ start: parseTs(a), end: parseTs(b), text: body });
    }
    return cues;
}

function chapterBits(cues, start, end) {
    const bits = [];
    let last = '';
    for (const cue of cues) {
        if (cue.end < start - 0.1 || cue.start > end + 0.1) continue;
        let t = cue.text.replace(/^>>\s*/, '').trim();
        if (!t) continue;
        if (t === last) continue;
        if (last.includes(t) && t.length < last.length * 0.9) continue;
        if (t.includes(last) && t.length > last.length) {
            bits[bits.length - 1] = { t: cue.start, text: t };
            last = t;
            continue;
        }
        bits.push({ t: cue.start, text: t });
        last = t;
    }
    return bits;
}

const chapters = parseChapters(fs.readFileSync(DESC, 'utf8'));
const cues = parseVtt(fs.readFileSync(VTT, 'utf8'));

console.log('chapters', chapters.length);
let sum = 0;
for (const ch of chapters) {
    const bits = chapterBits(cues, ch.start, ch.end);
    const gaps = [];
    for (let i = 1; i < bits.length; i++) {
        gaps.push({ i, gap: +(bits[i].t - bits[i - 1].t).toFixed(2), text: bits[i].text.slice(0, 50) });
    }
    const dur = +(ch.end - ch.start).toFixed(1);
    // Candidate splits at gaps >= 1.2s that aren't near edges
    const candidates = gaps.filter((g) => g.gap >= 1.2 && g.i >= 2 && g.i <= bits.length - 2);
    let est = 1 + candidates.length;
    // Cap absurd over-splits: typical dialogue ~8-14s
    const maxByDur = Math.max(1, Math.round(dur / 9));
    if (est > maxByDur) est = maxByDur;
    sum += est;
    if (est > 1 || dur >= 25) {
        console.log(
            `${ch.rawTime.padStart(7)} ${String(dur).padStart(5)}s est=${est} max=${maxByDur} cands=${candidates.length} bits=${bits.length} | ${ch.title}`,
        );
        for (const c of candidates.slice(0, 8)) {
            console.log(`         gap ${c.gap}s @bit${c.i}: ${c.text}`);
        }
    }
}
console.log('SUM_EST', sum);
