/**
 * Content-match Midseason 5 YouTube chapters to Atlas dialogues using
 * captions + newly added MatchTalk lines (no writes).
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { auditPath, ensureAuditWorkspace } from '../lib/auditWorkspace.mjs';
import {
    normalizeHeroKey,
    normalizeSubtitlesForMatch,
    voicelineFilenameToSubtitles,
} from '../../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { stripDialogueSubtitleMarkup } from '../../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../..');
const VTT_PATH = path.join(__dirname, 'midseason5-6KAmomizYRQ.en.vtt');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

const CHAPTERS = [
    { title: 'Vendetta & Ashe', start: 0, end: 17 },
    { title: 'Vendetta & D.Mon (updated Vendetta line)', start: 17, end: 32 },
    { title: 'Vendetta & Domina', start: 32, end: 49 },
    { title: 'Vendetta & Doomfist', start: 49, end: 80 },
    { title: 'Vendetta & Junker Queen', start: 80, end: 94 },
    { title: 'Vendetta & Mauga', start: 94, end: 109 },
    { title: 'Vendetta & Shion', start: 109, end: 131 },
    { title: 'Vendetta & Sojourn', start: 131, end: 147 },
    { title: 'Vendetta & Sombra', start: 147, end: 160 },
    { title: 'Vendetta & Widowmaker', start: 160, end: 180 },
    { title: 'Juno & Ashe', start: 180, end: 193 },
    { title: 'Juno & Doctrine', start: 193, end: 207 },
    { title: 'Juno & Jetpack Cat', start: 207, end: 223 },
    { title: 'Juno & Sierra', start: 223, end: 238 },
    { title: 'Juno & Tracer', start: 238, end: 256 },
    { title: 'Juno & Winston', start: 256, end: 281 },
    { title: 'Juno & Wrecking Ball', start: 281, end: 295 },
    { title: 'Juno & Wuyang', start: 295, end: 313 },
    { title: 'Juno & Zarya', start: 313, end: 331 },
    { title: 'Ana & Doctrine', start: 331, end: 377 },
    { title: 'Ana & Lúcio', start: 377, end: 388 },
    { title: 'Ana & Reaper', start: 388, end: 435 },
    { title: 'Ana & Sierra', start: 435, end: 447 },
    { title: 'Hazard with Ana, Soldier 76 and Roadhog', start: 447, end: 462 },
    { title: 'Sojourn & D.Mon', start: 462, end: 472 },
    { title: 'Sojourn & Doomfist', start: 472, end: 502 },
    { title: 'Sojourn & Orisa', start: 502, end: 531 },
    { title: 'Sojourn & Tracer', start: 531, end: 549 },
    { title: 'Sojourn, Emre & Freja', start: 549, end: 565 },
    { title: 'D.Mon & Junker Queen', start: 565, end: 576 },
    { title: 'D.Mon & Winston', start: 576, end: 592 },
    { title: 'D.Mon & Wrecking Ball', start: 592, end: 602 },
    { title: 'Doomfist & Doctrine', start: 602, end: 615 },
    { title: 'Doomfist & Orisa', start: 615, end: 627 },
    { title: 'Doomfist & Sombra', start: 627, end: 641 },
    { title: 'Genji & Tracer', start: 641, end: 658 },
    { title: 'Genji & Winston', start: 658, end: 679 },
    { title: 'Genji & Zenyatta', start: 679, end: 693 },
    { title: 'Junker Queen & Winston', start: 693, end: 711 },
    { title: 'D.Va & Roadhog', start: 711, end: 720 },
];

function compactNorm(text) {
    return normalizeSubtitlesForMatch(String(text || ''))
        .replace(/_/g, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
}

function heroKey(name) {
    return normalizeHeroKey(String(name || ''));
}

function parseTs(ts) {
    const m = String(ts).match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
    if (!m) return 0;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

function parseVtt(text) {
    /** @type {{ start: number, end: number, text: string }[]} */
    const cues = [];
    const blocks = text.replace(/\r/g, '').split(/\n\n+/);
    for (const block of blocks) {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        if (!lines.length || lines[0].startsWith('WEBVTT')) continue;
        const timeLine = lines.find((l) => l.includes('-->'));
        if (!timeLine) continue;
        const [a, b] = timeLine.split('-->').map((s) => s.trim().split(' ')[0]);
        const start = parseTs(a);
        const end = parseTs(b);
        const texts = lines
            .filter((l) => l !== timeLine && !/^\d+$/.test(l))
            .map((l) => l.replace(/<[^>]+>/g, '').replace(/&gt;&gt;/g, '').replace(/>>/g, '').trim())
            .filter(Boolean);
        if (!texts.length) continue;
        // Keep the fuller cumulative line (YouTube auto-subs duplicate)
        const text = texts[texts.length - 1];
        cues.push({ start, end, text });
    }
    return cues;
}

function chapterCaptionText(cues, start, end) {
    const uniq = [];
    const seen = new Set();
    for (const cue of cues) {
        if (cue.start < start - 0.2 || cue.start >= end) continue;
        const t = cue.text.trim();
        if (!t || seen.has(t)) continue;
        // Drop pure prefixes that are substrings of a later cue
        seen.add(t);
        uniq.push(t);
    }
    // Prefer longer unique sentences
    const filtered = uniq.filter(
        (t, i) => !uniq.some((o, j) => j !== i && o.includes(t) && o.length > t.length + 8),
    );
    return filtered.join(' ');
}

function loadJsonl(file) {
    if (!fs.existsSync(file)) return [];
    return fs
        .readFileSync(file, 'utf8')
        .split(/\n/)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

function spokenFromMatchTalkRel(rel) {
    const norm = String(rel || '').replace(/\\/g, '/');
    const parts = norm.split('/').filter(Boolean);
    const hero = parts[0] || '';
    const file = parts[parts.length - 1] || '';
    const parent = parts.length >= 2 ? parts[parts.length - 2] : '';
    const m0b2 = file.match(/\.0B2-(.+)\.ogg$/i);
    if (m0b2) return { hero, spoken: m0b2[1].replace(/_/g, ' ').trim() };
    if (/\.03F\.ogg$/i.test(file) && parent && parent !== 'MatchTalk') {
        return { hero, spoken: parent.replace(/_/g, ' ').trim() };
    }
    return { hero, spoken: '' };
}

function extractFolderToHeroKey(folder) {
    const map = {
        'D.Va': 'dva',
        'D.Mon': 'dmon',
        'Soldier_ 76': 'soldier76',
        Lúcio: 'lucio',
    };
    if (map[folder]) return map[folder];
    return heroKey(folder);
}

function overlapScore(aNorm, bNorm) {
    if (!aNorm || !bNorm) return 0;
    if (aNorm === bNorm) return 1000 + aNorm.length;
    if (aNorm.length < 12 || bNorm.length < 12) return 0;
    if (aNorm.includes(bNorm)) return bNorm.length;
    if (bNorm.includes(aNorm)) return aNorm.length;
    // token overlap
    const ta = new Set(aNorm.match(/[a-z0-9]{4,}/g) || []);
    const tb = new Set(bNorm.match(/[a-z0-9]{4,}/g) || []);
    if (!ta.size || !tb.size) return 0;
    let hit = 0;
    for (const t of ta) if (tb.has(t)) hit += 1;
    const ratio = hit / Math.min(ta.size, tb.size);
    if (ratio < 0.55 || hit < 3) return 0;
    return hit * 8;
}

async function main() {
    ensureAuditWorkspace();
    const snapRoot = auditPath('herovoice-snapshots');
    const baseline = String(
        await fsp.readFile(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8'),
    ).trim();
    const post = String(await fsp.readFile(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8')).trim();
    const diffRoot = path.join(snapRoot, `diff_${baseline}_vs_${post}`);

    const cues = parseVtt(await fsp.readFile(VTT_PATH, 'utf8'));
    const added = loadJsonl(path.join(diffRoot, 'added.jsonl'))
        .filter((row) => /\/MatchTalk\//i.test(String(row.rel || '').replace(/\\/g, '/')))
        .map((row) => {
            const { hero, spoken } = spokenFromMatchTalkRel(row.rel);
            return {
                rel: String(row.rel).replace(/\\/g, '/'),
                heroKey: extractFolderToHeroKey(hero),
                spoken,
                norm: compactNorm(spoken),
            };
        })
        .filter((r) => r.norm.length >= 10);

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.conversations || [];
    const dialogues = list
        .filter((c) => c?.entryType === 'dialogue' || (!c?.entryType && Array.isArray(c?.lines)))
        .map((c) => {
            const lines = Array.isArray(c.lines) ? c.lines : [];
            return {
                id: String(c.id || ''),
                name: String(c.name || ''),
                status: String(c.status || ''),
                lines: lines.map((l) => {
                    const sub = stripDialogueSubtitleMarkup(String(l.subtitles || '')).trim();
                    const voice = String(l.voice || '').trim();
                    const norms = [];
                    if (sub) norms.push(compactNorm(sub));
                    if (voice) norms.push(compactNorm(voicelineFilenameToSubtitles(voice)));
                    return {
                        hero: heroKey(l.hero),
                        subtitles: sub,
                        norms: [...new Set(norms.filter((n) => n.length >= 10))],
                    };
                }),
            };
        });

    const results = CHAPTERS.map((ch) => {
        const caption = chapterCaptionText(cues, ch.start, ch.end);
        const captionNorm = compactNorm(caption);

        // New MatchTalk lines whose spoken text appears in this chapter caption
        const chapterNewLines = added.filter((a) => {
            if (a.norm.length < 14) return captionNorm.includes(a.norm);
            return (
                captionNorm.includes(a.norm)
                || a.norm.includes(captionNorm.slice(0, Math.min(40, captionNorm.length)))
                || overlapScore(captionNorm, a.norm) >= 24
            );
        });

        // Score each dialogue by subtitle overlap with caption + new lines
        const scored = dialogues
            .map((d) => {
                let score = 0;
                /** @type {string[]} */
                const matchedSubs = [];
                for (const line of d.lines) {
                    for (const ln of line.norms) {
                        const s = overlapScore(captionNorm, ln);
                        if (s > 0) {
                            score += s;
                            matchedSubs.push(line.subtitles.slice(0, 90));
                        }
                        for (const nl of chapterNewLines) {
                            const s2 = overlapScore(nl.norm, ln);
                            if (s2 > 0) {
                                score += s2 + 20;
                                matchedSubs.push(line.subtitles.slice(0, 90));
                            }
                        }
                    }
                }
                return {
                    dialogue: d,
                    score,
                    matchedSubs: [...new Set(matchedSubs)].slice(0, 4),
                };
            })
            .filter((x) => x.score >= 24)
            .sort((a, b) => b.score - a.score);

        const best = scored[0] || null;
        let matchStatus = 'missing';
        if (best) {
            if (best.dialogue.status === 'removed') matchStatus = 'found-but-removed';
            else if (chapterNewLines.length > 0 && best.score >= 40) matchStatus = 'matched-new-content';
            else matchStatus = 'matched-existing-content';
        }

        return {
            chapter: ch.title,
            start: ch.start,
            end: ch.end,
            captionPreview: caption.slice(0, 220),
            newMatchTalkInChapter: chapterNewLines.map((n) => `${n.heroKey}: ${n.spoken}`).slice(0, 8),
            matchStatus,
            matchedEntry: best
                ? {
                    name: best.dialogue.name,
                    id: best.dialogue.id,
                    status: best.dialogue.status,
                    score: best.score,
                    matchedSubs: best.matchedSubs,
                }
                : null,
            runnersUp: scored.slice(1, 4).map((s) => ({
                name: s.dialogue.name,
                status: s.dialogue.status,
                score: s.score,
            })),
        };
    });

    const summary = {
        video: 'https://www.youtube.com/watch?v=6KAmomizYRQ',
        title: 'Midseason 5 - All New Hero Interactions in Overwatch!',
        counts: {
            chapters: results.length,
            matchedNewContent: results.filter((r) => r.matchStatus === 'matched-new-content').length,
            matchedExistingContent: results.filter((r) => r.matchStatus === 'matched-existing-content')
                .length,
            foundButRemoved: results.filter((r) => r.matchStatus === 'found-but-removed').length,
            missing: results.filter((r) => r.matchStatus === 'missing').length,
        },
        results,
    };

    const outJson = path.join(diffRoot, 'midseason5-youtube-content-match.json');
    const outMd = path.join(diffRoot, 'midseason5-youtube-content-match.md');
    await fsp.writeFile(outJson, `${JSON.stringify(summary, null, 2)}\n`);

    const md = [
        `# Midseason 5 content match (captions + new MatchTalk)`,
        '',
        `Video: ${summary.title}`,
        `URL: ${summary.video}`,
        '',
        `| # | Chapter | Atlas entry | Status |`,
        `|---|---|---|---|`,
        ...results.map((r, i) => {
            const entry = r.matchedEntry
                ? `\`${r.matchedEntry.name}\` (${r.matchedEntry.status || 'active'}, score ${r.matchedEntry.score})`
                : '—';
            return `| ${i + 1} | ${r.chapter} | ${entry} | ${r.matchStatus} |`;
        }),
        '',
        `## Missing (${summary.counts.missing})`,
        ...results
            .filter((r) => r.matchStatus === 'missing')
            .flatMap((r) => [
                `- **${r.chapter}**`,
                `  - caption: ${r.captionPreview.slice(0, 160)}…`,
                `  - new MatchTalk: ${r.newMatchTalkInChapter.join(' | ') || '(none detected in caption)'}`,
            ]),
        '',
        `## Found but removed (${summary.counts.foundButRemoved})`,
        ...results
            .filter((r) => r.matchStatus === 'found-but-removed')
            .map((r) => `- **${r.chapter}** → \`${r.matchedEntry?.name}\``),
        '',
    ];
    await fsp.writeFile(outMd, `${md.join('\n')}\n`);

    console.log(JSON.stringify(summary.counts, null, 2));
    console.log('\n=== MATCHED (new content) ===');
    for (const r of results.filter((x) => x.matchStatus === 'matched-new-content')) {
        console.log(`  ${r.chapter}  →  ${r.matchedEntry?.name}`);
    }
    console.log('\n=== MATCHED (existing content overlap) ===');
    for (const r of results.filter((x) => x.matchStatus === 'matched-existing-content')) {
        console.log(`  ${r.chapter}  →  ${r.matchedEntry?.name}`);
    }
    console.log('\n=== MISSING ===');
    for (const r of results.filter((x) => x.matchStatus === 'missing')) {
        console.log(`  ${r.chapter}`);
        console.log(`    newMT: ${r.newMatchTalkInChapter.slice(0, 3).join(' || ') || '—'}`);
    }
    console.log('\n=== FOUND BUT REMOVED ===');
    for (const r of results.filter((x) => x.matchStatus === 'found-but-removed')) {
        console.log(`  ${r.chapter}  →  ${r.matchedEntry?.name}`);
    }
    console.log(`\nWrote ${outMd}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
