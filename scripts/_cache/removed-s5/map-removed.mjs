#!/usr/bin/env node
/**
 * Scout dripping's Season 5 removed-interactions video and map chapters
 * to Dialogue Theater conversation entries.
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
    return (
        Number(m[1] || 0) * 3600 +
        Number(m[2]) * 60 +
        Number(m[3]) +
        Number(m[4] || 0) / 1000
    );
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
    // "Vendetta, Emre & Freja" / "Sojourn & Ashe" / "Sojourn, Brigitte & Jetpack Cat"
    return title
        .split(/\s*&\s*|\s*,\s*/)
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => {
            if (/^d\.?va$/i.test(h)) return 'D.va';
            if (/^d\.?mon$/i.test(h)) return 'D.mon';
            if (/^torbj/i.test(h)) return 'Torbjörn';
            if (/^lucio$/i.test(h)) return 'Lúcio';
            if (/^jetpack/i.test(h)) return 'Jetpack Cat';
            if (/^junker\s*queen$/i.test(h)) return 'Junker Queen';
            if (/^wrecking/i.test(h)) return 'Wrecking Ball';
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
    if (heroes.length === 0) return false;
    // All titled heroes must appear in the conversation
    return heroes.every((h) => {
        const n = norm(h);
        for (const x of hs) {
            if (norm(x) === n) return true;
            if (norm(x).includes(n) || n.includes(norm(x))) return true;
        }
        return false;
    });
}

function scoreMatch(c, heroes, cueTexts) {
    if (!conversationMatchesHeroes(c, heroes)) return 0;
    let score = 10;
    const hs = heroSet(c.lines);
    // Prefer exact hero-count closeness for non-multipath dialogues
    const extra = [...hs].filter((h) => !heroes.some((t) => norm(t) === norm(h)));
    score -= Math.max(0, extra.length) * 1.5;
    score -= Math.abs(hs.size - heroes.length) * 0.5;

    const blob = norm((c.lines || []).map((l) => l.subtitles || '').join(' '));
    const nameBlob = norm(c.name || '');
    let hit = 0;
    for (const t of cueTexts) {
        const tn = norm(t);
        if (tn.length < 12) continue;
        // take distinctive 4+ word chunks
        const words = tn.split(' ').filter(Boolean);
        for (let i = 0; i < words.length - 3; i++) {
            const chunk = words.slice(i, i + 4).join(' ');
            if (chunk.length < 14) continue;
            if (blob.includes(chunk) || nameBlob.includes(chunk)) {
                hit += 1;
                break;
            }
        }
    }
    score += hit * 5;
    if ((c.status || 'active') === 'removed') score -= 20;
    return score;
}

function chapterCueDigest(cues, start, end) {
    const out = [];
    let last = '';
    for (const cue of cues) {
        if (cue.end < start - 0.15 || cue.start > end + 0.15) continue;
        const t = cue.text.replace(/^>>\s*/, '').trim();
        if (!t || t === last) continue;
        if (last.includes(t) && t.length < last.length) continue;
        // skip pure UI/host chatter if obvious
        out.push(t);
        last = t;
    }
    return out;
}

function guessInteractionCount(title, duration, cueTexts) {
    // Rough: many chapters are one interaction; longer Vendetta/Sojourn blocks may be 2+
    if (duration < 12) return 1;
    if (duration < 25) return duration > 18 ? 2 : 1;
    if (duration < 40) return 2;
    if (duration < 55) return 3;
    return Math.max(2, Math.round(duration / 18));
}

const desc = fs.readFileSync(DESC, 'utf8');
const chapters = parseChapters(desc);
const cues = parseVtt(fs.readFileSync(VTT, 'utf8'));
const conversations = JSON.parse(fs.readFileSync(CONV, 'utf8')).conversations || [];

const batchA = chapters.slice(0, 7); // start of S5
const batchB = chapters.slice(7); // midseason

const report = [];
let totalGuessed = 0;

for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const heroes = heroesFromTitle(ch.title);
    const cueTexts = chapterCueDigest(cues, ch.start, ch.end);
    const duration = ch.end - ch.start;
    const guessed = guessInteractionCount(ch.title, duration, cueTexts);
    totalGuessed += guessed;

    // Rank matching conversations
    const scored = conversations
        .map((c) => ({
            c,
            score: scoreMatch(c, heroes, cueTexts),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, Math.max(3, guessed + 2)).map((x) => ({
        id: x.c.id,
        name: x.c.name,
        status: x.c.status || 'active',
        score: Number(x.score.toFixed(2)),
        heroes: [...heroSet(x.c.lines)].join(', '),
        preview: (x.c.lines || [])
            .slice(0, 3)
            .map((l) => `${l.hero}: ${String(l.subtitles || '').slice(0, 70)}`)
            .join(' / '),
        lineCount: (x.c.lines || []).length,
        tags: x.c.tags || [],
    }));

    report.push({
        index: i + 1,
        batch: i < 7 ? 'S5 launch (first 7)' : 'Midseason 5 (following 76)',
        time: ch.rawTime,
        start: ch.start,
        end: ch.end,
        duration: Number(duration.toFixed(1)),
        title: ch.title,
        heroes,
        guessedInteractions: guessed,
        cueSample: cueTexts.slice(0, 8),
        matches: top,
        bestMatch: top[0] || null,
    });
}

const matchedIds = new Set();
const uniqueBest = [];
for (const row of report) {
    const best = row.bestMatch;
    if (!best) continue;
    if (matchedIds.has(best.id)) {
        // try next unique
        const alt = row.matches.find((m) => !matchedIds.has(m.id));
        if (alt) {
            matchedIds.add(alt.id);
            uniqueBest.push({ ...row, assigned: alt, note: 'alt (best already used)' });
        } else {
            uniqueBest.push({ ...row, assigned: best, note: 'duplicate best id' });
        }
    } else {
        matchedIds.add(best.id);
        uniqueBest.push({ ...row, assigned: best, note: 'best' });
    }
}

const out = {
    video: 'https://www.youtube.com/watch?v=qIJz7O5ZF_E',
    title: 'Season 5 - All REMOVED Hero Interactions in Overwatch!',
    claimedTotal: 83,
    chapterCount: chapters.length,
    guessedInteractionSum: totalGuessed,
    launchChapters: 7,
    midseasonChapters: chapters.length - 7,
    chapters: report,
    assignedUnique: uniqueBest.map((r) => ({
        n: r.index,
        batch: r.batch,
        time: r.time,
        title: r.title,
        guessed: r.guessedInteractions,
        entryName: r.assigned?.name,
        entryId: r.assigned?.id,
        entryStatus: r.assigned?.status,
        score: r.assigned?.score,
        heroes: r.assigned?.heroes,
        preview: r.assigned?.preview,
        note: r.note,
        cueSample: r.cueSample?.slice(0, 4),
    })),
};

fs.writeFileSync(path.join(ROOT, 'removed-map.json'), `${JSON.stringify(out, null, 2)}\n`);

// Human-readable list
const lines = [];
lines.push(`# Season 5 Removed Interactions Scout`);
lines.push(`Video: ${out.video}`);
lines.push(`Chapters in description: ${out.chapterCount}`);
lines.push(`Claimed total interactions: ${out.claimedTotal}`);
lines.push(`Sum of per-chapter guesses: ${out.guessedInteractionSum}`);
lines.push(`Unique best theater matches so far: ${matchedIds.size}`);
lines.push('');
lines.push(`## Batch A — S5 launch (first 7)`);
for (const r of uniqueBest.filter((x) => x.index <= 7)) {
    lines.push(
        `${r.index}. [${r.time}] ${r.title}  →  **${r.assigned?.name || 'UNMATCHED'}** (${r.assigned?.status || '?'}) score=${r.assigned?.score ?? '-'}`,
    );
    if (r.assigned?.preview) lines.push(`   ${r.assigned.preview}`);
}
lines.push('');
lines.push(`## Batch B — Midseason 5`);
for (const r of uniqueBest.filter((x) => x.index > 7)) {
    lines.push(
        `${r.index}. [${r.time}] ${r.title}  →  **${r.assigned?.name || 'UNMATCHED'}** (${r.assigned?.status || '?'}) score=${r.assigned?.score ?? '-'}`,
    );
    if (r.assigned?.preview) lines.push(`   ${r.assigned.preview}`);
}
lines.push('');
lines.push(`## Unmatched / weak (score < 12)`);
for (const r of report.filter((x) => !x.bestMatch || x.bestMatch.score < 12)) {
    lines.push(`- [${r.time}] ${r.title} (guessed ${r.guessedInteractions}) cues: ${r.cueSample.slice(0, 2).join(' | ')}`);
    if (r.matches[0]) lines.push(`  top: ${r.matches[0].name} score=${r.matches[0].score}`);
}

fs.writeFileSync(path.join(ROOT, 'removed-map.md'), `${lines.join('\n')}\n`);
console.log(`chapters=${chapters.length} guessedSum=${totalGuessed} uniqueMatched=${matchedIds.size}`);
console.log(`wrote ${path.join(ROOT, 'removed-map.md')}`);
