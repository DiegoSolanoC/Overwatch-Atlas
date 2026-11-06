#!/usr/bin/env node
/**
 * Expand dripping S5-removed chapters into individual interactions using
 * VTT dialogue turns, then map each to Dialogue Theater entries.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('scripts/_cache/removed-s5');
const CONV = path.resolve('src/data/dialogue-theater/conversations.json');
const VTT = path.join(ROOT, 'yt-qIJz7O5ZF_E.en.vtt');
const DESC = path.join(ROOT, 'description.txt');

function parseTs(ts) {
    const m = String(ts).trim().match(/^(?:(\d+):)?(\d+):(\d+)(?:\.(\d+))?$/);
    if (!m) {
        const short = String(ts).trim().match(/^(\d+):(\d+)$/);
        if (!short) return 0;
        return Number(short[1]) * 60 + Number(short[2]);
    }
    return Number(m[1] || 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4] || 0) / 1000;
}

function cleanVtt(raw) {
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

function parseChapters(desc) {
    const lines = desc.split(/\r?\n/);
    const chapters = [];
    let inTs = false;
    for (const line of lines) {
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
        const body = cleanVtt(lines.slice(timeIdx + 1).join(' '));
        if (!body) continue;
        cues.push({ start: parseTs(a), end: parseTs(b), text: body });
    }
    return cues;
}

function heroesFromTitle(title) {
    return title
        .split(/\s*&\s*|\s*,\s*/)
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => {
            if (/^d\.?va$/i.test(h)) return 'D.va';
            if (/^torbj/i.test(h)) return 'Torbjörn';
            if (/^lucio$/i.test(h)) return 'Lúcio';
            if (/^jetpack/i.test(h)) return 'Jetpack Cat';
            if (/^junker\s*queen$/i.test(h)) return 'Junker Queen';
            return h;
        });
}

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function heroSet(lines) {
    return new Set((lines || []).map((l) => String(l.hero || '').trim()).filter(Boolean));
}

function conversationMatchesHeroes(c, heroes) {
    const hs = heroSet(c.lines);
    return heroes.every((h) => {
        const n = norm(h);
        for (const x of hs) {
            if (norm(x) === n) return true;
        }
        return false;
    });
}

/** Dedupe overlapping VTT into a progressive transcript for a chapter. */
function chapterTranscript(cues, start, end) {
    const bits = [];
    let last = '';
    for (const cue of cues) {
        if (cue.end < start - 0.1 || cue.start > end + 0.1) continue;
        let t = cue.text.replace(/^>>\s*/, '').trim();
        if (!t) continue;
        // Drop pure repeats / shrinks
        if (t === last) continue;
        if (last.includes(t) && t.length < last.length * 0.9) continue;
        // If new cue extends previous, keep only the extension-ish full line
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

/**
 * Split a chapter into interaction blocks using silence gaps + speaker-ish resets.
 * Heuristic: a gap > 1.1s in cue starts, or a clear new opening line after a closing beat.
 */
function splitInteractions(bits, chapterStart, chapterEnd, minExpected = 1) {
    if (bits.length === 0) {
        return [{ start: chapterStart, end: chapterEnd, texts: [], cueStart: chapterStart }];
    }
    const gaps = [];
    for (let i = 1; i < bits.length; i++) {
        gaps.push({ i, gap: bits[i].t - bits[i - 1].t });
    }
    // Candidate split indices: large gaps
    const large = gaps
        .filter((g) => g.gap >= 1.05)
        .sort((a, b) => b.gap - a.gap);

    // Also split when duration suggests multiple and we see medium gaps
    const duration = chapterEnd - chapterStart;
    let target = minExpected;
    if (duration >= 45) target = Math.max(target, 3);
    else if (duration >= 28) target = Math.max(target, 2);
    else if (duration >= 18) target = Math.max(target, 2);

    const splitIdx = new Set();
    for (const g of large) {
        if (splitIdx.size >= target - 1) break;
        // avoid splits too close to edges
        if (g.i < 2 || g.i > bits.length - 2) continue;
        splitIdx.add(g.i);
    }
    // If still short of target, take next-largest gaps >= 0.7s
    if (splitIdx.size < target - 1) {
        const med = gaps.filter((g) => g.gap >= 0.7).sort((a, b) => b.gap - a.gap);
        for (const g of med) {
            if (splitIdx.size >= target - 1) break;
            if (g.i < 2 || g.i > bits.length - 2) continue;
            splitIdx.add(g.i);
        }
    }

    const idxs = [...splitIdx].sort((a, b) => a - b);
    const ranges = [];
    let from = 0;
    for (const cut of idxs) {
        ranges.push(bits.slice(from, cut));
        from = cut;
    }
    ranges.push(bits.slice(from));

    return ranges
        .filter((r) => r.length > 0)
        .map((r) => ({
            start: r[0].t,
            end: r[r.length - 1].t,
            texts: r.map((x) => x.text),
            cueStart: r[0].t,
        }));
}

function scoreMatch(c, heroes, texts) {
    if (!conversationMatchesHeroes(c, heroes)) return -Infinity;
    let score = 5;
    const hs = heroSet(c.lines);
    const extra = [...hs].filter((h) => !heroes.some((t) => norm(t) === norm(h)));
    // Multipath / group chats can have extras; light penalty
    score -= Math.max(0, extra.length - 1) * 0.75;

    const blob = norm((c.lines || []).map((l) => `${l.hero} ${l.subtitles || ''}`).join(' '));
    const nameBlob = norm(c.name || '');
    const joined = texts.join(' ');
    const tn = norm(joined);

    // Strong: 5-gram hits from interaction text into subtitles
    const words = tn.split(' ').filter((w) => w.length > 2);
    let hits = 0;
    const seen = new Set();
    for (let i = 0; i < words.length - 4; i++) {
        const chunk = words.slice(i, i + 5).join(' ');
        if (chunk.length < 18 || seen.has(chunk)) continue;
        seen.add(chunk);
        if (blob.includes(chunk)) hits += 1;
    }
    score += hits * 6;

    // Name overlap with distinctive words
    for (const w of words) {
        if (w.length < 6) continue;
        if (nameBlob.includes(w)) score += 0.35;
    }

    // Prefer active (not already removed) for listing
    if ((c.status || 'active') === 'removed') score -= 8;
    return score;
}

const desc = fs.readFileSync(DESC, 'utf8');
const chapters = parseChapters(desc);
const cues = parseVtt(fs.readFileSync(VTT, 'utf8'));
const conversations = JSON.parse(fs.readFileSync(CONV, 'utf8')).conversations || [];

const usedIds = new Set();
const interactions = [];
let n = 0;

for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    const heroes = heroesFromTitle(ch.title);
    const bits = chapterTranscript(cues, ch.start, ch.end);
    const duration = ch.end - ch.start;
    let minExpected = 1;
    if (duration >= 45) minExpected = 3;
    else if (duration >= 28) minExpected = 2;
    else if (duration >= 18) minExpected = 2;

    // Known dense chapters from transcript inspection
    if (/Vendetta & D\.Va/i.test(ch.title)) minExpected = Math.max(minExpected, 5);
    if (/Vendetta & Domina/i.test(ch.title)) minExpected = Math.max(minExpected, 4);
    if (/Vendetta & Mauga/i.test(ch.title) && ch.start > 300) minExpected = Math.max(minExpected, 2);
    if (/Vendetta & Reaper/i.test(ch.title)) minExpected = Math.max(minExpected, 3);
    if (/Vendetta & Sigma/i.test(ch.title)) minExpected = Math.max(minExpected, 3);
    if (/Vendetta & Sojourn/i.test(ch.title)) minExpected = Math.max(minExpected, 3);
    if (/Vendetta & Sombra/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Vendetta & Hanzo/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Vendetta & Shion/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Sojourn & Baptiste/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Sojourn & Winston/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Freja & Emre/i.test(ch.title)) minExpected = Math.max(minExpected, 3);
    if (/Freja & Domina/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Cassidy & Ashe/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Cassidy & Genji/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Sombra & Doomfist/i.test(ch.title)) minExpected = Math.max(minExpected, 2);
    if (/Sombra & Baptiste/i.test(ch.title)) minExpected = Math.max(minExpected, 2);

    const parts = splitInteractions(bits, ch.start, ch.end, minExpected);

    for (let pi = 0; pi < parts.length; pi++) {
        n += 1;
        const part = parts[pi];
        const scored = conversations
            .map((c) => ({ c, score: scoreMatch(c, heroes, part.texts) }))
            .filter((x) => Number.isFinite(x.score) && x.score > -Infinity)
            .sort((a, b) => b.score - a.score);

        let assigned = null;
        let note = '';
        for (const s of scored) {
            if (s.score < 8) break;
            if (!usedIds.has(s.c.id)) {
                assigned = s;
                usedIds.add(s.c.id);
                note = 'unique';
                break;
            }
        }
        if (!assigned && scored[0] && scored[0].score >= 8) {
            assigned = scored[0];
            note = 'shared/reused id';
        }

        interactions.push({
            n,
            chapterIndex: ci + 1,
            chapterTime: ch.rawTime,
            chapterTitle: ch.title,
            part: pi + 1,
            partsInChapter: parts.length,
            batch: ci < 7 ? 'S5 launch (first 7)' : 'Midseason 5',
            start: Number(part.start.toFixed(2)),
            heroes,
            sample: part.texts.slice(0, 3),
            entryName: assigned?.c?.name || null,
            entryId: assigned?.c?.id || null,
            entryStatus: assigned?.c?.status || null,
            score: assigned ? Number(assigned.score.toFixed(2)) : null,
            preview: assigned
                ? (assigned.c.lines || [])
                      .slice(0, 3)
                      .map((l) => `${l.hero}: ${String(l.subtitles || '').slice(0, 65)}`)
                      .join(' / ')
                : null,
            note,
            alts: scored.slice(0, 3).map((s) => ({
                name: s.c.name,
                id: s.c.id,
                score: Number(s.score.toFixed(2)),
                used: usedIds.has(s.c.id),
            })),
        });
    }
}

const out = {
    video: 'https://www.youtube.com/watch?v=qIJz7O5ZF_E',
    claimedTotal: 83,
    foundInteractions: interactions.length,
    uniqueEntriesMatched: usedIds.size,
    unmatched: interactions.filter((x) => !x.entryId).length,
    weak: interactions.filter((x) => x.entryId && (x.score || 0) < 12).length,
    interactions,
};

fs.writeFileSync(path.join(ROOT, 'removed-map-v2.json'), `${JSON.stringify(out, null, 2)}\n`);

const md = [];
md.push(`# Season 5 Removed Interactions — Mapped List (for review)`);
md.push('');
md.push(`Source: ${out.video}`);
md.push(`Video claim: **83** removed interactions`);
md.push(`Scout found: **${out.foundInteractions}** interaction segments across ${chapters.length} chapters`);
md.push(`Unique theater entries matched: **${out.uniqueEntriesMatched}**`);
md.push(`Unmatched segments: **${out.unmatched}**`);
md.push('');
md.push(`> No status changes yet — waiting for your go-ahead to mark these \`removed\`.`);
md.push('');
md.push(`## S5 launch (first 7 chapters)`);
for (const row of interactions.filter((x) => x.batch.startsWith('S5'))) {
    md.push(
        `${row.n}. [${row.chapterTime} p${row.part}/${row.partsInChapter}] **${row.chapterTitle}** → \`${row.entryName || 'UNMATCHED'}\` _(score ${row.score ?? '-'})_`,
    );
    if (row.preview) md.push(`   ${row.preview}`);
    else if (row.sample?.length) md.push(`   cues: ${row.sample.join(' | ').slice(0, 140)}`);
}
md.push('');
md.push(`## Midseason 5`);
for (const row of interactions.filter((x) => x.batch.startsWith('Mid'))) {
    md.push(
        `${row.n}. [${row.chapterTime} p${row.part}/${row.partsInChapter}] **${row.chapterTitle}** → \`${row.entryName || 'UNMATCHED'}\` _(score ${row.score ?? '-'})_`,
    );
    if (row.preview) md.push(`   ${row.preview}`);
    else if (row.sample?.length) md.push(`   cues: ${row.sample.join(' | ').slice(0, 140)}`);
}
md.push('');
md.push(`## Needs attention`);
for (const row of interactions.filter((x) => !x.entryId || (x.score || 0) < 12)) {
    md.push(
        `- #${row.n} [${row.chapterTime}] ${row.chapterTitle} p${row.part} — ${row.entryName || 'UNMATCHED'} (score ${row.score ?? '-'})`,
    );
    if (row.alts?.length) {
        md.push(`  alts: ${row.alts.map((a) => `${a.name}(${a.score})`).join(', ')}`);
    }
}

fs.writeFileSync(path.join(ROOT, 'removed-map-v2.md'), `${md.join('\n')}\n`);
console.log(
    JSON.stringify(
        {
            found: out.foundInteractions,
            unique: out.uniqueEntriesMatched,
            unmatched: out.unmatched,
            weak: out.weak,
        },
        null,
        2,
    ),
);
