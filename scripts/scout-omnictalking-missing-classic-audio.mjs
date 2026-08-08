#!/usr/bin/env node
/**
 * Scout The Omnic Talking hero dialogue pages for audio that fills
 * Classic lines we already have but are missing voice files.
 *
 * Scope: existing Classic (era / Classic tag) lines with empty voice only.
 * Does NOT propose new dialogues / chatters.
 *
 * Usage:
 *   node scripts/scout-omnictalking-missing-classic-audio.mjs
 *   node scripts/scout-omnictalking-missing-classic-audio.mjs --hero Winston
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { auditPath, ensureAuditWorkspace } from './lib/auditWorkspace.mjs';

ensureAuditWorkspace();

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const ORIGIN = 'https://theomnictalking.altervista.org';
const USER_AGENT = 'OverwatchAtlas/1.0 (missing Classic audio scout; local atlas tooling)';
const CACHE_DIR = auditPath('omnictalking-cache');
const OUT_JSON = auditPath('_scout-omnictalking-missing-classic-audio.json');
const OUT_CSV = auditPath('_scout-omnictalking-missing-classic-audio.csv');

const heroArgIdx = process.argv.indexOf('--hero');
const heroFilter =
    heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim().toLowerCase() : '';

/** Atlas hero → Omnitalking slug(s). Main page + `-int` interactions page. */
const HERO_SLUGS = [
    { hero: 'Ana', slugs: ['ana', 'ana-int'] },
    { hero: 'Ashe', slugs: ['ashe', 'ashe-int'] },
    { hero: 'Baptiste', slugs: ['baptiste', 'baptiste-int'] },
    { hero: 'Bastion', slugs: ['bastion', 'bastion-int'] },
    { hero: 'Brigitte', slugs: ['brigitte', 'brigitte-int'] },
    { hero: 'Cassidy', slugs: ['cassidy', 'cassidy-int', 'mccree', 'mccree-int'] },
    { hero: 'D.va', slugs: ['dva', 'dva-int', 'd-va', 'd-va-int'] },
    { hero: 'Doomfist', slugs: ['doomfist', 'doomfist-int'] },
    { hero: 'Echo', slugs: ['echo', 'echo-int'] },
    { hero: 'Genji', slugs: ['genji', 'genji-int'] },
    { hero: 'Hanzo', slugs: ['hanzo', 'hanzo-int'] },
    { hero: 'Junkrat', slugs: ['junkrat', 'junkrat-int'] },
    { hero: 'Lúcio', slugs: ['lucio', 'lucio-int'] },
    { hero: 'Mei', slugs: ['mei', 'mei-int'] },
    { hero: 'Mercy', slugs: ['mercy', 'mercy-int'] },
    { hero: 'Moira', slugs: ['moira', 'moira-int'] },
    { hero: 'Orisa', slugs: ['orisa', 'orisa-int'] },
    { hero: 'Pharah', slugs: ['pharah', 'pharah-int'] },
    { hero: 'Reaper', slugs: ['reaper', 'reaper-int'] },
    { hero: 'Reinhardt', slugs: ['reinhardt', 'reinhardt-int'] },
    { hero: 'Roadhog', slugs: ['roadhog', 'roadhog-int'] },
    { hero: 'Sigma', slugs: ['sigma', 'sigma-int'] },
    { hero: 'Soldier 76', slugs: ['soldier-76', 'soldier-76-int', 'soldier76', 'soldier76-int'] },
    { hero: 'Sombra', slugs: ['sombra', 'sombra-int'] },
    { hero: 'Symmetra', slugs: ['symmetra', 'symmetra-int'] },
    { hero: 'Torbjörn', slugs: ['torbjorn', 'torbjorn-int'] },
    { hero: 'Tracer', slugs: ['tracer', 'tracer-int'] },
    { hero: 'Widowmaker', slugs: ['widowmaker', 'widowmaker-int'] },
    { hero: 'Winston', slugs: ['winston', 'winston-int'] },
    { hero: 'Wrecking Ball', slugs: ['wrecking-ball', 'wrecking-ball-int', 'hammond', 'hammond-int'] },
    { hero: 'Zarya', slugs: ['zarya', 'zarya-int'] },
    { hero: 'Zenyatta', slugs: ['zenyatta', 'zenyatta-int'] },
];

function normalizeText(s) {
    let t = String(s || '')
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/&nbsp;|&#160;/gi, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\*\*[^*]+\*\*/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/^\(([^)]+)\)\s*/g, '')
        .replace(/\([^)]*\)/g, ' ');

    // Align wiki wording with Omnitalking filenames (often expand / drop apostrophes).
    t = t
        .replace(/\bgonna\b/g, 'going to')
        .replace(/\bwanna\b/g, 'want to')
        .replace(/\bgotta\b/g, 'got to')
        .replace(/\bwho'd\b/g, 'who would')
        .replace(/\bwho'd\b/g, 'who would')
        .replace(/n't\b/g, ' not')
        .replace(/'re\b/g, ' are')
        .replace(/'ve\b/g, ' have')
        .replace(/'ll\b/g, ' will')
        .replace(/'m\b/g, ' am')
        .replace(/'d\b/g, ' would')
        .replace(/'s\b/g, ' is')
        .replace(/\bthatd\b/g, 'that would')
        .replace(/\bcouldve\b/g, 'could have')
        .replace(/\bshouldve\b/g, 'should have')
        .replace(/\bwouldve\b/g, 'would have')
        .replace(/\bim\b/g, 'i am')
        .replace(/\bive\b/g, 'i have')
        .replace(/\byoure\b/g, 'you are')
        .replace(/\byouve\b/g, 'you have')
        .replace(/\byoud\b/g, 'you would')
        .replace(/\byoull\b/g, 'you will')
        .replace(/\bweve\b/g, 'we have')
        .replace(/\btheyre\b/g, 'they are')
        .replace(/\btheyve\b/g, 'they have')
        .replace(/\btheyd\b/g, 'they would')
        .replace(/\btheyll\b/g, 'they will')
        .replace(/\btheres\b/g, 'there is')
        .replace(/\bthats\b/g, 'that is')
        .replace(/\bwhats\b/g, 'what is')
        .replace(/\blets\b/g, 'let us')
        .replace(/\bdont\b/g, 'do not')
        .replace(/\bdoesnt\b/g, 'does not')
        .replace(/\bdidnt\b/g, 'did not')
        .replace(/\bcant\b/g, 'cannot')
        .replace(/\bwont\b/g, 'will not')
        .replace(/\bwouldnt\b/g, 'would not')
        .replace(/\bcouldnt\b/g, 'could not')
        .replace(/\bshouldnt\b/g, 'should not')
        .replace(/\bisnt\b/g, 'is not')
        .replace(/\barent\b/g, 'are not')
        .replace(/\bwasnt\b/g, 'was not')
        .replace(/\bwerent\b/g, 'were not')
        .replace(/\bhasnt\b/g, 'has not')
        .replace(/\bhavent\b/g, 'have not')
        .replace(/\bhadnt\b/g, 'had not');

    return t.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function isClassicLine(conversation, line) {
    if (line?.era === 'Classic') return true;
    const tags = Array.isArray(conversation?.tags) ? conversation.tags : [];
    return tags.includes('Classic');
}

function collectMissingClassic(conversations) {
    /** @type {Array<Record<string, unknown>>} */
    const out = [];
    for (const c of conversations) {
        for (const line of c.lines || []) {
            if (!isClassicLine(c, line)) continue;
            if (String(line.voice || '').trim()) continue;
            out.push({
                convId: c.id,
                convName: c.name,
                entryType: c.entryType || 'dialogue',
                lineId: line.id,
                hero: line.hero,
                subtitles: line.subtitles || '',
                disclaimer: line.disclaimer || '',
                norm: normalizeText(line.subtitles || ''),
            });
        }
    }
    return out;
}

async function fetchPage(slug) {
    await fsp.mkdir(CACHE_DIR, { recursive: true });
    const cachePath = path.join(CACHE_DIR, `${slug}.html`);
    try {
        const cached = await fsp.readFile(cachePath, 'utf8');
        if (cached.length > 500) return { html: cached, status: 200, cached: true, url: `${ORIGIN}/en/hero-dialogues/${slug}/` };
    } catch {
        /* fetch */
    }

    const url = `${ORIGIN}/en/hero-dialogues/${slug}/`;
    const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        redirect: 'follow',
    });
    if (!res.ok) {
        return { html: '', status: res.status, cached: false, url };
    }
    const html = await res.text();
    await fsp.writeFile(cachePath, html, 'utf8');
    return { html, status: res.status, cached: false, url };
}

/**
 * Omnitalking filenames encode dialogue, e.g.
 * `00000000A83A.0B2-Im-looking-forward-to-working-with-you-all.ogg`
 * @param {string} filename
 */
function textFromOmniFilename(filename) {
    let stem = String(filename || '')
        .replace(/\.(ogg|mp3|wav)$/i, '')
        .trim();
    // Drop leading hash / .0B2 speaker code
    stem = stem.replace(/^[0-9A-Fa-f]{8,}(?:\.[0-9A-Za-z]+)?-/, '');
    stem = stem.replace(/_/g, ' ').replace(/-/g, ' ');
    // Undo common contractions stripped of apostrophes in filenames
    stem = stem
        .replace(/\bIm\b/g, "I'm")
        .replace(/\bIve\b/g, "I've")
        .replace(/\bId\b/g, "I'd")
        .replace(/\bIll\b/g, "I'll")
        .replace(/\bIts\b/g, "It's")
        .replace(/\bDont\b/g, "Don't")
        .replace(/\bDoesnt\b/g, "Doesn't")
        .replace(/\bDidnt\b/g, "Didn't")
        .replace(/\bCant\b/g, "Can't")
        .replace(/\bWont\b/g, "Won't")
        .replace(/\bWouldnt\b/g, "Wouldn't")
        .replace(/\bCouldnt\b/g, "Couldn't")
        .replace(/\bShouldnt\b/g, "Shouldn't")
        .replace(/\bYoure\b/g, "You're")
        .replace(/\bTheyre\b/g, "They're")
        .replace(/\bWere\b/g, "We're")
        .replace(/\bHes\b/g, "He's")
        .replace(/\bShes\b/g, "She's")
        .replace(/\bTheres\b/g, "There's")
        .replace(/\bWhats\b/g, "What's")
        .replace(/\bLets\b/g, "Let's")
        .replace(/\bWeve\b/g, "We've")
        .replace(/\bYouve\b/g, "You've")
        .replace(/\bTheyve\b/g, "They've");
    return stem.replace(/\s+/g, ' ').trim();
}

/**
 * Extract { text, audioUrl, filename } clips from Omnitalking HTML.
 * Prefer filename-encoded dialogue (reliable); page text is secondary.
 * @param {string} html
 * @param {string} pageUrl
 */
function extractClips(html, pageUrl) {
    /** @type {Array<{ text: string, norm: string, audioUrl: string, filename: string, context: string }>} */
    const clips = [];

    const audioUrlRe =
        /https?:\/\/[^\s"'<>]+\.(?:ogg|mp3|wav)|\/wp-content\/[^\s"'<>]+\.(?:ogg|mp3|wav)|\/\/[^\s"'<>]+\.(?:ogg|mp3|wav)/gi;

    const matches = [...html.matchAll(audioUrlRe)];
    const seen = new Set();

    for (const match of matches) {
        let rawUrl = match[0];
        if (rawUrl.startsWith('//')) rawUrl = `https:${rawUrl}`;
        else if (rawUrl.startsWith('/')) rawUrl = `${ORIGIN}${rawUrl}`;

        const filename = decodeURIComponent(rawUrl.split('/').pop() || '');
        if (seen.has(rawUrl)) continue;
        seen.add(rawUrl);

        const text = textFromOmniFilename(filename);
        clips.push({
            text,
            norm: normalizeText(text || filename),
            audioUrl: rawUrl,
            filename,
            context: pageUrl,
        });
    }

    return clips;
}

function stemToken(t) {
    if (t.length > 4 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
    if (t.length > 5 && t.endsWith('ing')) return t.slice(0, -3);
    if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
    return t;
}

function scoreMatch(lineNorm, clipNorm) {
    if (!lineNorm || !clipNorm) return 0;
    if (lineNorm === clipNorm) return 100;
    if (lineNorm.includes(clipNorm) || clipNorm.includes(lineNorm)) {
        const ratio = Math.min(lineNorm.length, clipNorm.length) / Math.max(lineNorm.length, clipNorm.length);
        return Math.round(85 * ratio + 10);
    }
    const a = new Set(
        lineNorm
            .split(' ')
            .filter((t) => t.length > 2)
            .map(stemToken),
    );
    const b = new Set(
        clipNorm
            .split(' ')
            .filter((t) => t.length > 2)
            .map(stemToken),
    );
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter += 1;
    const union = a.size + b.size - inter;
    const jaccard = inter / union;
    // Require strong coverage of the shorter side to avoid short false positives.
    const coverage = inter / Math.min(a.size, b.size);
    if (jaccard < 0.5 && coverage < 0.85) return 0;
    if (coverage >= 0.9 && inter >= 4) return Math.round(70 + coverage * 25);
    if (jaccard < 0.55) return 0;
    return Math.round(jaccard * 80);
}

function csvEscape(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(absFromPublic(FILES.dialogueTheater.conversations), 'utf8'));
    const conversations = raw.conversations || [];
    let missing = collectMissingClassic(conversations);
    if (heroFilter) {
        missing = missing.filter((m) => String(m.hero).toLowerCase() === heroFilter);
    }

    console.log(`Classic lines missing audio: ${missing.length}`);

    const missingByHero = new Map();
    for (const m of missing) {
        const list = missingByHero.get(m.hero) || [];
        list.push(m);
        missingByHero.set(m.hero, list);
    }

    /** @type {Array<Record<string, unknown>>} */
    const matches = [];
    /** @type {Array<Record<string, unknown>>} */
    const pageStats = [];

    const heroes = HERO_SLUGS.filter((h) => missingByHero.has(h.hero));
    for (const { hero, slugs } of heroes) {
        const heroMissing = missingByHero.get(hero) || [];
        /** @type {Array<ReturnType<typeof extractClips>[number]>} */
        const clips = [];
        for (const slug of slugs) {
            process.stdout.write(`Fetching ${slug}… `);
            const page = await fetchPage(slug);
            if (page.status !== 200 || !page.html) {
                console.log(`HTTP ${page.status || 'fail'}`);
                pageStats.push({ hero, slug, status: page.status, clips: 0, cached: page.cached });
                await delay(200);
                continue;
            }
            const found = extractClips(page.html, page.url);
            console.log(`${found.length} audio URL(s)${page.cached ? ' (cache)' : ''}`);
            pageStats.push({ hero, slug, status: page.status, clips: found.length, cached: page.cached });
            clips.push(...found);
            await delay(350);
        }

        // Greedy unique assignment: highest score first so one clip fills one line.
        /** @type {Array<{ line: typeof heroMissing[number], clip: (typeof clips)[number], score: number }>} */
        const candidates = [];
        for (const line of heroMissing) {
            for (const clip of clips) {
                const score = scoreMatch(line.norm, clip.norm);
                if (score >= 70) candidates.push({ line, clip, score });
            }
        }
        candidates.sort((a, b) => b.score - a.score);
        const usedLines = new Set();
        const usedClips = new Set();
        for (const { line, clip, score } of candidates) {
            if (usedLines.has(line.lineId) || usedClips.has(clip.audioUrl)) continue;
            usedLines.add(line.lineId);
            usedClips.add(clip.audioUrl);
            matches.push({
                hero,
                entryType: line.entryType,
                convId: line.convId,
                convName: line.convName,
                lineId: line.lineId,
                subtitles: line.subtitles,
                score,
                audioUrl: clip.audioUrl,
                filename: clip.filename,
                matchedText: clip.text,
                page: clip.context,
            });
        }
    }

    const chatterHits = matches.filter((m) => m.entryType === 'chatter');
    const dialogueHits = matches.filter((m) => m.entryType !== 'chatter');

    const report = {
        scoutedAt: new Date().toISOString(),
        origin: ORIGIN,
        missingClassicTotal: missing.length,
        matched: matches.length,
        matchedChatter: chatterHits.length,
        matchedDialogue: dialogueHits.length,
        unmatched: missing.length - matches.length,
        pageStats,
        matches: matches.sort((a, b) => b.score - a.score || String(a.hero).localeCompare(String(b.hero))),
        unmatchedLines: missing
            .filter((m) => !matches.some((hit) => hit.lineId === m.lineId))
            .map((m) => ({
                hero: m.hero,
                entryType: m.entryType,
                convId: m.convId,
                convName: m.convName,
                lineId: m.lineId,
                subtitles: m.subtitles,
            })),
    };

    await fsp.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    const header = [
        'hero',
        'entryType',
        'score',
        'subtitles',
        'filename',
        'audioUrl',
        'convId',
        'lineId',
        'page',
    ];
    const rows = [header.join(',')].concat(
        matches.map((m) =>
            [
                m.hero,
                m.entryType,
                m.score,
                m.subtitles,
                m.filename,
                m.audioUrl,
                m.convId,
                m.lineId,
                m.page,
            ]
                .map(csvEscape)
                .join(','),
        ),
    );
    await fsp.writeFile(OUT_CSV, `${rows.join('\n')}\n`, 'utf8');

    console.log('\n=== Omnitalking missing Classic audio scout ===');
    console.log(
        JSON.stringify(
            {
                missingClassicTotal: report.missingClassicTotal,
                matched: report.matched,
                matchedChatter: report.matchedChatter,
                matchedDialogue: report.matchedDialogue,
                unmatched: report.unmatched,
                outJson: OUT_JSON,
                outCsv: OUT_CSV,
            },
            null,
            2,
        ),
    );

    // Quick Winston sample if present
    const winston = matches.filter((m) => m.hero === 'Winston').slice(0, 5);
    if (winston.length) {
        console.log('\nWinston matches sample:');
        for (const m of winston) {
            console.log(`  [${m.score}] ${m.entryType} | ${m.subtitles}`);
            console.log(`       → ${m.filename}`);
        }
    }
}

function delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
