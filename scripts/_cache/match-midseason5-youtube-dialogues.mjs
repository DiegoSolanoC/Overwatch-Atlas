/**
 * Match Midseason 5 YouTube chapters to existing theater dialogues (no writes).
 *
 * Video: https://www.youtube.com/watch?v=6KAmomizYRQ
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
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

const VIDEO = {
    id: '6KAmomizYRQ',
    title: 'Midseason 5 - All New Hero Interactions in Overwatch!',
    url: 'https://www.youtube.com/watch?v=6KAmomizYRQ',
    chapters: [
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
    ],
};

const HERO_ALIASES = {
    dmon: 'dmon',
    'd.mon': 'dmon',
    dva: 'dva',
    'd.va': 'dva',
    soldier76: 'soldier76',
    'soldier 76': 'soldier76',
    lucio: 'lucio',
    lúcio: 'lucio',
    wreckingball: 'wreckingball',
    junkerqueen: 'junkerqueen',
    jetpackcat: 'jetpackcat',
};

function heroKey(name) {
    const raw = String(name || '').trim();
    const k = normalizeHeroKey(raw);
    return HERO_ALIASES[raw.toLowerCase()] || HERO_ALIASES[k] || k;
}

function parseChapterHeroes(title) {
    let t = String(title || '');
    t = t.replace(/\([^)]*\)/g, ' ');
    t = t.replace(/\bwith\b/gi, '&');
    t = t.replace(/\band\b/gi, '&');
    t = t.replace(/,/g, '&');
    const parts = t
        .split('&')
        .map((p) => p.trim())
        .filter(Boolean);
    return parts.map((p) => ({ display: p, key: heroKey(p) }));
}

function compactNorm(text) {
    return normalizeSubtitlesForMatch(String(text || ''))
        .replace(/_/g, '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();
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

function extractHeroToLineHero(folder) {
    const map = {
        'D.Va': 'D.va',
        'D.Mon': 'D.mon',
        'Soldier_ 76': 'Soldier 76',
    };
    return map[folder] || folder;
}

async function main() {
    ensureAuditWorkspace();
    const snapRoot = auditPath('herovoice-snapshots');
    const baseline = String(
        await fsp.readFile(path.join(snapRoot, 'LATEST_BASELINE.txt'), 'utf8'),
    ).trim();
    const post = String(await fsp.readFile(path.join(snapRoot, 'LATEST_POST.txt'), 'utf8')).trim();
    const diffRoot = path.join(snapRoot, `diff_${baseline}_vs_${post}`);

    const addedMatchTalk = loadJsonl(path.join(diffRoot, 'added.jsonl'))
        .filter((row) => /\/MatchTalk\//i.test(String(row.rel || '').replace(/\\/g, '/')))
        .map((row) => {
            const { hero, spoken } = spokenFromMatchTalkRel(row.rel);
            return {
                rel: String(row.rel).replace(/\\/g, '/'),
                heroFolder: hero,
                heroKey: heroKey(extractHeroToLineHero(hero)),
                spoken,
                norm: compactNorm(spoken),
            };
        })
        .filter((r) => r.norm.length >= 8);

    /** @type {Map<string, typeof addedMatchTalk>} */
    const newByHero = new Map();
    for (const row of addedMatchTalk) {
        if (!newByHero.has(row.heroKey)) newByHero.set(row.heroKey, []);
        newByHero.get(row.heroKey).push(row);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const list = Array.isArray(raw) ? raw : raw.conversations || [];
    const dialogues = list.filter(
        (c) => c?.entryType === 'dialogue' || (!c?.entryType && Array.isArray(c?.lines)),
    );

    const indexed = dialogues.map((c) => {
        const lines = Array.isArray(c.lines) ? c.lines : [];
        const heroes = [...new Set(lines.map((l) => heroKey(l.hero)).filter(Boolean))];
        const lineNorms = lines.map((l) => {
            const sub = stripDialogueSubtitleMarkup(String(l.subtitles || '')).trim();
            const voice = String(l.voice || '').trim();
            const keys = new Set();
            if (sub) keys.add(compactNorm(sub));
            if (voice) keys.add(compactNorm(voicelineFilenameToSubtitles(voice)));
            return {
                hero: heroKey(l.hero),
                subtitles: sub,
                norms: [...keys].filter((k) => k.length >= 8),
            };
        });
        return {
            id: String(c.id || ''),
            name: String(c.name || ''),
            status: String(c.status || ''),
            heroes,
            heroSet: new Set(heroes),
            lineNorms,
            lineCount: lines.length,
        };
    });

    function scoreConv(conv, neededKeys) {
        let cover = 0;
        for (const k of neededKeys) if (conv.heroSet.has(k)) cover += 1;
        if (cover < Math.min(2, neededKeys.length) && neededKeys.length >= 2) return -1;
        if (neededKeys.length === 1 && cover < 1) return -1;
        // Prefer exact roster match for 2-hero chapters
        let score = cover * 10;
        if (neededKeys.length >= 2 && conv.heroes.length === neededKeys.length && cover === neededKeys.length) {
            score += 50;
        }
        // Penalize huge extra casts for 2-hero chapters
        if (neededKeys.length === 2) {
            score -= Math.max(0, conv.heroes.length - 2) * 3;
        }
        return score;
    }

    function findNewLineHits(conv, neededKeys) {
        /** @type {string[]} */
        const hits = [];
        for (const hk of neededKeys) {
            const news = newByHero.get(hk) || [];
            for (const n of news) {
                for (const line of conv.lineNorms) {
                    if (line.hero !== hk) continue;
                    for (const ln of line.norms) {
                        if (
                            ln === n.norm
                            || (ln.length >= 16 && n.norm.includes(ln))
                            || (n.norm.length >= 16 && ln.includes(n.norm))
                        ) {
                            hits.push(`${hk}: ${n.spoken.slice(0, 80)}`);
                        }
                    }
                }
            }
        }
        return [...new Set(hits)];
    }

    const results = VIDEO.chapters.map((ch) => {
        const heroes = parseChapterHeroes(ch.title);
        const neededKeys = heroes.map((h) => h.key);
        const noteUpdated = /\bupdated\b/i.test(ch.title);

        const candidates = indexed
            .map((conv) => ({ conv, score: scoreConv(conv, neededKeys) }))
            .filter((x) => x.score >= 0)
            .sort((a, b) => b.score - a.score || a.conv.name.localeCompare(b.conv.name));

        const best = candidates[0]?.conv || null;
        const activeBest =
            candidates.find((c) => c.conv.status !== 'removed')?.conv || best;

        const newHits = activeBest ? findNewLineHits(activeBest, neededKeys) : [];
        const newLinesForHeroes = neededKeys.flatMap((hk) =>
            (newByHero.get(hk) || []).map((n) => `${n.heroFolder}: ${n.spoken.slice(0, 70)}`),
        );

        let matchStatus = 'missing';
        if (activeBest) {
            if (activeBest.status === 'removed') matchStatus = 'found-but-removed';
            else if (newHits.length > 0) matchStatus = 'matched-with-new-audio';
            else matchStatus = 'matched-existing-entry';
        }

        return {
            chapter: ch.title,
            start: ch.start,
            end: ch.end,
            heroes: heroes.map((h) => h.display),
            noteUpdated,
            matchStatus,
            matchedEntry: activeBest
                ? {
                    name: activeBest.name,
                    id: activeBest.id,
                    status: activeBest.status,
                    heroes: activeBest.heroes,
                    lineCount: activeBest.lineCount,
                }
                : null,
            altCandidates: candidates.slice(0, 5).map((c) => ({
                name: c.conv.name,
                status: c.conv.status,
                score: c.score,
                heroes: c.conv.heroes,
            })),
            newAudioHitsInEntry: newHits,
            newMatchTalkForChapterHeroes: [...new Set(newLinesForHeroes)].slice(0, 12),
        };
    });

    const summary = {
        video: VIDEO,
        counts: {
            chapters: results.length,
            matchedExisting: results.filter((r) => r.matchStatus.startsWith('matched')).length,
            matchedWithNewAudio: results.filter((r) => r.matchStatus === 'matched-with-new-audio')
                .length,
            foundButRemoved: results.filter((r) => r.matchStatus === 'found-but-removed').length,
            missing: results.filter((r) => r.matchStatus === 'missing').length,
        },
        results,
    };

    const outJson = path.join(diffRoot, 'midseason5-youtube-match.json');
    const outMd = path.join(diffRoot, 'midseason5-youtube-match.md');
    await fsp.writeFile(outJson, `${JSON.stringify(summary, null, 2)}\n`);

    const md = [
        `# Midseason 5 YouTube → Atlas dialogue match`,
        '',
        `Video: [${VIDEO.title}](${VIDEO.url})`,
        '',
        `| # | Chapter | Atlas entry | Status |`,
        `|---|---|---|---|`,
        ...results.map((r, i) => {
            const entry = r.matchedEntry
                ? `\`${r.matchedEntry.name}\` (${r.matchedEntry.status || 'active'})`
                : '—';
            return `| ${i + 1} | ${r.chapter} | ${entry} | ${r.matchStatus} |`;
        }),
        '',
        `## Missing (${summary.counts.missing})`,
        ...results
            .filter((r) => r.matchStatus === 'missing')
            .map((r) => `- **${r.chapter}** — heroes: ${r.heroes.join(', ')}`),
        '',
    ];
    await fsp.writeFile(outMd, `${md.join('\n')}\n`);

    console.log(JSON.stringify(summary.counts, null, 2));
    console.log('\nMATCHED:');
    for (const r of results.filter((x) => x.matchStatus.startsWith('matched'))) {
        console.log(`  [${r.matchStatus}] ${r.chapter}  →  ${r.matchedEntry?.name}`);
    }
    console.log('\nMISSING:');
    for (const r of results.filter((x) => x.matchStatus === 'missing')) {
        console.log(`  ${r.chapter}`);
        if (r.altCandidates.length) {
            console.log(`    near: ${r.altCandidates.map((a) => a.name).join(' | ')}`);
        }
    }
    console.log('\nFOUND BUT REMOVED:');
    for (const r of results.filter((x) => x.matchStatus === 'found-but-removed')) {
        console.log(`  ${r.chapter}  →  ${r.matchedEntry?.name}`);
    }
    console.log(`\nWrote ${outMd}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
