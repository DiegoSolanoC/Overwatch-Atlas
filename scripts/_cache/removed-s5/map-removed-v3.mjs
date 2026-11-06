#!/usr/bin/env node
/**
 * Map dripping's S5-removed video chapters → Dialogue Theater entries.
 * Strategy: for each chapter, score ALL hero-pair conversations against
 * the chapter VTT blob; keep strong hits. Tune threshold to ~83 unique.
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

function clean(s) {
    return String(s || '')
        .replace(/<[^>]+>/g, '')
        .replace(/&gt;/g, '>')
        .replace(/&lt;/g, '<')
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/^>+/g, '')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function norm(s) {
    return clean(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
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
        const body = clean(lines.slice(timeIdx + 1).join(' '));
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
            if (/^d\.?va$/i.test(h)) return 'D.Va';
            if (/^torbj/i.test(h)) return 'Torbjörn';
            if (/^lucio$/i.test(h)) return 'Lúcio';
            if (/^jetpack/i.test(h)) return 'Jetpack Cat';
            if (/^junker\s*queen$/i.test(h)) return 'Junker Queen';
            if (/^lifeweaver$/i.test(h)) return 'Lifeweaver';
            return h;
        });
}

function heroSet(lines) {
    return new Set((lines || []).map((l) => String(l.hero || '').trim()).filter(Boolean));
}

function conversationMatchesHeroes(c, heroes) {
    const hs = heroSet(c.lines);
    // Exact set match preferred, but allow extra narrator/etc? No — require all title heroes present
    // and no extra playable heroes beyond a small allowance for multipath/group.
    const missing = heroes.filter((h) => ![...hs].some((x) => norm(x) === norm(h)));
    if (missing.length) return false;
    const extras = [...hs].filter((x) => !heroes.some((h) => norm(h) === norm(x)));
    // Group chapters (3 heroes) must match exactly; pair chapters allow 0 extras (strict)
    // except multipath D.Va squad lines that still only list D.Va + Vendetta as speakers
    if (heroes.length >= 3) return extras.length === 0;
    return extras.length === 0;
}

function chapterBlob(cues, start, end) {
    const bits = [];
    let last = '';
    for (const cue of cues) {
        if (cue.end < start - 0.05 || cue.start > end + 0.05) continue;
        const t = clean(cue.text.replace(/^>>\s*/, ''));
        if (!t || t === last) continue;
        if (last.includes(t) && t.length < last.length * 0.85) continue;
        if (t.includes(last) && t.length > last.length) {
            bits[bits.length - 1] = t;
            last = t;
            continue;
        }
        bits.push(t);
        last = t;
    }
    return norm(bits.join(' '));
}

function distinctivePhrases(subtitles, minLen = 18) {
    const n = norm(subtitles);
    const words = n.split(' ').filter(Boolean);
    const out = new Set();
    // Prefer longer n-grams
    for (let size = 6; size >= 4; size--) {
        for (let i = 0; i <= words.length - size; i++) {
            const chunk = words.slice(i, i + size).join(' ');
            if (chunk.length < minLen) continue;
            // skip very generic fillers
            if (/^(i|you|we|the|and|that|this|what|have|will|with|from)\b/.test(chunk) && chunk.split(' ').length < 5)
                continue;
            out.add(chunk);
        }
        if (out.size >= 8) break;
    }
    return [...out];
}

function scoreConversation(c, blob) {
    const lines = c.lines || [];
    const subs = lines.map((l) => l.subtitles || '').join(' ');
    const phrases = distinctivePhrases(subs);
    if (!phrases.length) return 0;
    let hits = 0;
    let hitChars = 0;
    for (const p of phrases) {
        if (blob.includes(p)) {
            hits += 1;
            hitChars += p.length;
        }
    }
    // Also try each line individually (shorter dialogues)
    let lineHits = 0;
    for (const l of lines) {
        const ln = norm(l.subtitles || '');
        if (ln.length < 12) continue;
        // take middle portion to tolerate caption errors
        const words = ln.split(' ');
        if (words.length >= 5) {
            const mid = words.slice(1, Math.min(words.length - 1, 7)).join(' ');
            if (mid.length >= 14 && blob.includes(mid)) lineHits += 1;
        } else if (blob.includes(ln)) {
            lineHits += 1;
        }
    }
    const cover = hits / Math.max(1, Math.min(phrases.length, 10));
    return hits * 4 + hitChars * 0.08 + lineHits * 5 + cover * 10;
}

function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

const chapters = parseChapters(fs.readFileSync(DESC, 'utf8'));
const cues = parseVtt(fs.readFileSync(VTT, 'utf8'));
const conversations = JSON.parse(fs.readFileSync(CONV, 'utf8')).conversations || [];

// Threshold sweep to land near 83
const THRESHOLDS = [18, 16, 14, 12, 10, 8];
let best = null;

for (const thr of THRESHOLDS) {
    const assigned = new Map(); // id -> {chapter, score, ...}
    const perChapter = [];

    for (let ci = 0; ci < chapters.length; ci++) {
        const ch = chapters[ci];
        const heroes = heroesFromTitle(ch.title);
        const blob = chapterBlob(cues, ch.start, ch.end);
        const candidates = conversations
            .filter((c) => conversationMatchesHeroes(c, heroes))
            .map((c) => ({ c, score: scoreConversation(c, blob) }))
            .filter((x) => x.score >= thr)
            .sort((a, b) => b.score - a.score);

        const kept = [];
        for (const hit of candidates) {
            const prev = assigned.get(hit.c.id);
            if (prev && prev.score >= hit.score) continue;
            assigned.set(hit.c.id, {
                id: hit.c.id,
                name: hit.c.name,
                status: hit.c.status || 'active',
                score: Number(hit.score.toFixed(2)),
                chapterIndex: ci + 1,
                chapterTime: ch.rawTime,
                chapterTitle: ch.title,
                batch: ci < 7 ? 'S5 launch (first 7)' : 'Midseason 5',
                heroes,
                preview: (hit.c.lines || [])
                    .slice(0, 3)
                    .map((l) => `${l.hero}: ${String(l.subtitles || '').slice(0, 70)}`)
                    .join(' / '),
            });
            kept.push(hit.c.name);
        }
        perChapter.push({
            chapterIndex: ci + 1,
            time: ch.rawTime,
            title: ch.title,
            duration: +(ch.end - ch.start).toFixed(1),
            matchCount: kept.length,
            matches: kept,
            heroPairCandidates: conversations.filter((c) => conversationMatchesHeroes(c, heroes)).length,
        });
    }

    const list = [...assigned.values()].sort((a, b) => {
        if (a.chapterIndex !== b.chapterIndex) return a.chapterIndex - b.chapterIndex;
        return b.score - a.score;
    });

    const result = {
        threshold: thr,
        unique: list.length,
        chaptersWithZero: perChapter.filter((p) => p.matchCount === 0).length,
        chaptersWithMany: perChapter.filter((p) => p.matchCount >= 3).length,
        list,
        perChapter,
    };

    console.log(
        `thr=${thr} unique=${result.unique} zeroChapters=${result.chaptersWithZero} many3+=${result.chaptersWithMany}`,
    );

    if (!best || Math.abs(result.unique - 83) < Math.abs(best.unique - 83)) {
        best = result;
    }
    // Prefer exact / closest without going way over if equal distance
    if (result.unique === 83) {
        best = result;
        break;
    }
}

const numbered = best.list.map((row, i) => ({ n: i + 1, ...row }));

const out = {
    video: 'https://www.youtube.com/watch?v=qIJz7O5ZF_E',
    claimedTotal: 83,
    thresholdUsed: best.threshold,
    uniqueMatched: numbered.length,
    alreadyRemoved: numbered.filter((x) => x.status === 'removed').length,
    interactions: numbered,
    perChapter: best.perChapter,
    zeroChapters: best.perChapter.filter((p) => p.matchCount === 0),
    underMatchedChapters: best.perChapter.filter(
        (p) => p.matchCount === 0 || (p.duration >= 25 && p.matchCount < 2) || (p.duration >= 40 && p.matchCount < 3),
    ),
};

fs.writeFileSync(path.join(ROOT, 'removed-map-v3.json'), `${JSON.stringify(out, null, 2)}\n`);

const md = [];
md.push('# Season 5 Removed Interactions — Mapped List (for review)');
md.push('');
md.push(`Source: ${out.video}`);
md.push(`Video claim: **83** removed`);
md.push(`Mapped unique theater entries: **${out.uniqueMatched}** (threshold ${out.thresholdUsed})`);
md.push(`Already status=removed: **${out.alreadyRemoved}**`);
md.push('');
md.push('> Status not changed yet — waiting for your go-ahead to archive these.');
md.push('');
md.push('## Full numbered list');
md.push('');
for (const row of numbered) {
    md.push(
        `${row.n}. [${row.chapterTime}] **${row.chapterTitle}** → \`${row.name}\` _(score ${row.score}, ${row.batch})_`,
    );
    md.push(`   ${row.preview}`);
}
md.push('');
md.push('## Chapters needing attention');
for (const p of out.underMatchedChapters) {
    md.push(
        `- [${p.time}] ${p.title} (${p.duration}s) — ${p.matchCount} matched / ${p.heroPairCandidates} pair candidates: ${p.matches.join('; ') || '—'}`,
    );
}
md.push('');
md.push('## Per-chapter match counts');
for (const p of best.perChapter) {
    md.push(`- [${p.time}] ${p.title}: **${p.matchCount}** — ${p.matches.join('; ') || '—'}`);
}

fs.writeFileSync(path.join(ROOT, 'removed-map-v3.md'), `${md.join('\n')}\n`);
console.log('\nBEST', { thr: best.threshold, unique: best.unique, zeros: out.zeroChapters.length });
console.log('Wrote removed-map-v3.md / .json');
