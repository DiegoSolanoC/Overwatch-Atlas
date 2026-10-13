#!/usr/bin/env node
/**
 * Season 4.5 + Season 5 YouTube compilations → numbered dialogue placeholders
 * (and chatter lines for elim chapters), matched to newly extracted MatchTalk.
 *
 * Sources:
 *   S4.5 https://www.youtube.com/watch?v=-Hz_6ooSZWs
 *   S5   https://www.youtube.com/watch?v=_6YaF9Z1KVQ
 *
 * Dialogue chapters → new conversations named only with numbers (manual audit).
 * Chatter chapters (S5 elim blocks) → hero chatter with wiki-shaped disclaimers.
 *
 * Usage:
 *   node scripts/import-s4.5-s5-youtube-placeholders.mjs --dry-run
 *   node scripts/import-s4.5-s5-youtube-placeholders.mjs
 *   node scripts/import-s4.5-s5-youtube-placeholders.mjs --fetch-subs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE = path.join(__dirname, '_cache');
const YT_DLP = path.join(CACHE, 'yt-dlp.exe');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const DIFF_ADDED = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'interactions',
    'overwatch-atlas-audits',
    'herovoice-snapshots',
    'diff_baseline_pre-s4.5-s5_vs_post_after-s4.5-s5',
    'added.jsonl',
);

const dryRun = process.argv.includes('--dry-run');
const fetchSubs = process.argv.includes('--fetch-subs');

/** @type {Array<{ id: string, era: string, label: string, chapters: Array<{ title: string, start: number, end: number, kind: 'dialogue'|'chatter', disclaimer?: string }> }>} */
const VIDEOS = [
    {
        id: '-Hz_6ooSZWs',
        era: 'Season 4.5 (YouTube placeholder)',
        label: 'S4.5',
        chapters: [
            { title: 'Illari and Widowmaker', start: 0, end: 10, kind: 'dialogue' },
            { title: 'Shion and Widowmaker', start: 10, end: 25, kind: 'dialogue' },
            { title: 'D.Va and Jetpack Cat', start: 25, end: 32, kind: 'dialogue' },
            { title: 'Sojourn and Winston', start: 32, end: 45, kind: 'dialogue' },
        ],
    },
    {
        id: '_6YaF9Z1KVQ',
        era: 'Season 5 (YouTube placeholder)',
        label: 'S5',
        chapters: [
            { title: 'Doctrine & Bastion', start: 0, end: 10, kind: 'dialogue' },
            { title: 'Doctrine & D.Mon', start: 10, end: 21, kind: 'dialogue' },
            { title: 'Doctrine & Doomfist', start: 21, end: 36, kind: 'dialogue' },
            { title: 'Doctrine & Genji', start: 36, end: 58, kind: 'dialogue' },
            { title: 'Doctrine & Junker Queen', start: 58, end: 71, kind: 'dialogue' },
            { title: 'Doctrine & Lúcio', start: 71, end: 78, kind: 'dialogue' },
            { title: 'Doctrine & Moira', start: 78, end: 108, kind: 'dialogue' },
            { title: 'Doctrine & Orisa', start: 108, end: 127, kind: 'dialogue' },
            { title: 'Doctrine & Reaper', start: 127, end: 152, kind: 'dialogue' },
            { title: 'Doctrine & Shion', start: 152, end: 184, kind: 'dialogue' },
            { title: 'Doctrine & Sierra', start: 184, end: 206, kind: 'dialogue' },
            { title: 'Doctrine & Sombra', start: 206, end: 249, kind: 'dialogue' },
            { title: 'Doctrine & Tracer', start: 249, end: 263, kind: 'dialogue' },
            { title: 'Doctrine & Venture', start: 263, end: 282, kind: 'dialogue' },
            { title: 'Doctrine & Widowmaker', start: 282, end: 300, kind: 'dialogue' },
            { title: 'Doctrine & Wuyang', start: 300, end: 316, kind: 'dialogue' },
            {
                title: 'Doctrine Eliminates Specific Heroes',
                start: 316,
                end: 391,
                kind: 'chatter',
                disclaimer: 'Elimination — Final Blow',
            },
            {
                title: 'Doctrine Sees Ally Eliminations',
                start: 391,
                end: 407,
                kind: 'chatter',
                disclaimer: 'Elimination — Final Blow Compliment',
            },
            {
                title: 'Other Heroes Eliminate Doctrine',
                start: 407,
                end: 423,
                kind: 'chatter',
                disclaimer: 'Elimination — Final Blow',
            },
            { title: 'Sierra & D.Va', start: 423, end: 437, kind: 'dialogue' },
            { title: 'Sierra & Junkrat', start: 437, end: 454, kind: 'dialogue' },
            { title: 'Sierra & Orisa', start: 454, end: 492, kind: 'dialogue' },
            { title: 'Sierra & Tracer', start: 492, end: 502, kind: 'dialogue' },
            { title: 'Sierra & Venture', start: 502, end: 522, kind: 'dialogue' },
            { title: 'Sierra & Winston', start: 522, end: 533, kind: 'dialogue' },
            { title: 'Sierra & Wuyang', start: 533, end: 550, kind: 'dialogue' },
            { title: 'Sierra & Zarya', start: 550, end: 579, kind: 'dialogue' },
            { title: 'Wuyang & D.Mon', start: 579, end: 594, kind: 'dialogue' },
            { title: 'Wuyang & Genji', start: 594, end: 606, kind: 'dialogue' },
            { title: 'Wuyang & Junker Queen', start: 606, end: 617, kind: 'dialogue' },
            { title: 'Wuyang & Mizuki', start: 617, end: 637, kind: 'dialogue' },
            { title: 'Wuyang & Orisa', start: 637, end: 659, kind: 'dialogue' },
            { title: 'Wuyang & Tracer', start: 659, end: 671, kind: 'dialogue' },
            { title: 'Wuyang & Zenyatta', start: 671, end: 680, kind: 'dialogue' },
            { title: 'Wuyang, Brigitte & Jetpack Cat', start: 680, end: 692, kind: 'dialogue' },
            { title: 'Junker Queen & Junkrat', start: 692, end: 711, kind: 'dialogue' },
            { title: 'Junker Queen & Mauga', start: 711, end: 723, kind: 'dialogue' },
            { title: 'Junker Queen & Roadhog', start: 723, end: 741, kind: 'dialogue' },
            { title: 'Junker Queen & Vendetta', start: 741, end: 756, kind: 'dialogue' },
            { title: 'Sojourn & Vendetta', start: 756, end: 768, kind: 'dialogue' },
            { title: 'Sojourn & Winston', start: 768, end: 788, kind: 'dialogue' },
            { title: 'Sojourn, Junkrat & Roadhog', start: 788, end: 811, kind: 'dialogue' },
            { title: 'Sombra & Doomfist', start: 811, end: 825, kind: 'dialogue' },
            { title: 'Sombra & Mizuki', start: 825, end: 837, kind: 'dialogue' },
            { title: 'Sombra & Widowmaker', start: 837, end: 854, kind: 'dialogue' },
            { title: 'Genji & Torbjörn', start: 854, end: 872, kind: 'dialogue' },
            { title: 'Genji & Zarya', start: 872, end: 884, kind: 'dialogue' },
            { title: 'Jetpack Cat, Bastion & Roadhog', start: 884, end: 894, kind: 'dialogue' },
            { title: 'Vendetta & D.Mon', start: 894, end: 909, kind: 'dialogue' },
            { title: 'Vendetta & Sigma', start: 909, end: 926, kind: 'dialogue' },
            { title: 'Winston & Wrecking Ball', start: 926, end: 962, kind: 'dialogue' },
            { title: 'Brigitte & Torbjörn', start: 962, end: 976, kind: 'dialogue' },
            { title: 'Doomfist & Widowmaker', start: 976, end: 996, kind: 'dialogue' },
            { title: 'Moira & Shion', start: 996, end: 1011, kind: 'dialogue' },
        ],
    },
];

function vttPathForId(id) {
    return path.join(CACHE, `yt-${id}.en.vtt`);
}

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\[.*?\]/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, '');
}

function norm(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/\[music\]/gi, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanCaptionText(raw) {
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

function vttTimeToMs(value) {
    const parts = String(value || '').split(':');
    if (parts.length === 3) {
        const [h, m, s] = parts;
        return (Number(h) * 3600 + Number(m) * 60 + Number(s)) * 1000;
    }
    if (parts.length === 2) {
        const [m, s] = parts;
        return (Number(m) * 60 + Number(s)) * 1000;
    }
    return 0;
}

function parseVttTurns(vtt) {
    const blocks = String(vtt || '')
        .replace(/\r/g, '')
        .split(/\n\n+/);
    /** @type {Array<{ startMs: number, text: string }>} */
    const finals = [];
    for (const block of blocks) {
        const lines = block.split('\n').filter(Boolean);
        const timeLine = lines.find((l) => l.includes('-->'));
        if (!timeLine) continue;
        const startRaw = timeLine.split('-->')[0].trim();
        const startMs = vttTimeToMs(startRaw);
        const plain = lines
            .filter((l) => !l.includes('-->') && !/^\d+$/.test(l) && !/<c>/i.test(l))
            .map(cleanCaptionText)
            .filter(Boolean);
        if (!plain.length) continue;
        const text = plain[plain.length - 1];
        if (!text || text === '>>') continue;
        finals.push({ startMs, text });
    }

    /** @type {Array<{ startMs: number, text: string }>} */
    const deduped = [];
    for (const row of finals) {
        const prev = deduped[deduped.length - 1];
        if (prev && norm(prev.text) === norm(row.text)) continue;
        deduped.push(row);
    }

    /** @type {Array<{ startMs: number, text: string }>} */
    const turns = [];
    for (const row of deduped) {
        const chunks = row.text
            .split(/\s*>>\s*/)
            .map((c) => c.trim())
            .filter(Boolean);
        let offset = 0;
        for (const chunk of chunks) {
            if (/^\[(laughter|music|applause|silence).*\]$/i.test(chunk)) continue;
            if (chunk.length < 2) continue;
            turns.push({ startMs: row.startMs + offset, text: chunk });
            offset += 1;
        }
    }

    /** @type {Array<{ startMs: number, text: string }>} */
    const merged = [];
    for (const turn of turns) {
        const prev = merged[merged.length - 1];
        const t = turn.text;
        if (
            prev &&
            turn.startMs - prev.startMs < 2500 &&
            !/^[A-Z"“(]/.test(t) &&
            prev.text.length < 140 &&
            !/[.!?…]"?$/.test(prev.text)
        ) {
            prev.text = `${prev.text} ${t}`.replace(/\s+/g, ' ').trim();
            continue;
        }
        merged.push({ ...turn });
    }
    return merged;
}

function ensureSubs(videoId) {
    const dest = vttPathForId(videoId);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 100) return dest;
    if (!fs.existsSync(YT_DLP)) {
        throw new Error(`Missing ${YT_DLP}`);
    }
    console.log(`Fetching subs for ${videoId}…`);
    const r = spawnSync(
        YT_DLP,
        [
            '--skip-download',
            '--write-auto-sub',
            '--sub-lang',
            'en',
            '--convert-subs',
            'vtt',
            '--sub-format',
            'vtt',
            '-o',
            path.join(CACHE, 'yt-%(id)s'),
            `https://www.youtube.com/watch?v=${videoId}`,
        ],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.warn(r.stderr || r.stdout);
        throw new Error(`yt-dlp failed for ${videoId}`);
    }
    if (!fs.existsSync(dest)) throw new Error(`VTT missing after fetch: ${dest}`);
    return dest;
}

/**
 * @param {string[]} folderNeedles — path segments that must appear (e.g. MatchTalk, Elimination)
 * @returns {{ rows: Array<object>, newRels: Set<string> }}
 */
function indexExtractFolders(folderNeedles) {
    /** @type {Set<string>} */
    const newRels = new Set();
    if (fs.existsSync(DIFF_ADDED)) {
        for (const line of fs.readFileSync(DIFF_ADDED, 'utf8').split(/\n/)) {
            if (!line.trim()) continue;
            const row = JSON.parse(line);
            const rel = String(row.rel || '').replace(/\\/g, '/');
            if (folderNeedles.some((n) => rel.includes(`/${n}/`) || rel.includes(`/${n}`))) {
                newRels.add(rel);
            }
        }
    }

    /** @type {Array<object>} */
    const rows = [];
    if (!fs.existsSync(EXTRACT_ROOT)) return { rows, newRels };

    const heroes = fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const heroEnt of heroes) {
        const heroRoot = path.join(EXTRACT_ROOT, heroEnt.name);
        /** @param {string} dir */
        function walk(dir) {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, ent.name);
                if (ent.isDirectory()) {
                    walk(full);
                    continue;
                }
                if (!/\.ogg$/i.test(ent.name) || !/\.0B2-/i.test(ent.name)) continue;
                const rel = path.relative(EXTRACT_ROOT, full).replace(/\\/g, '/');
                if (!folderNeedles.some((n) => rel.includes(`/${n}/`) || rel.endsWith(`/${n}`))) continue;
                const m = ent.name.match(/\.0B2-(.+)\.ogg$/i);
                const label = m ? m[1] : ent.name;
                const key = coreKey(label);
                if (key.length < 6) continue;
                rows.push({
                    heroFolder: heroEnt.name,
                    label,
                    key,
                    rel,
                    source: full,
                    isNew: newRels.has(rel),
                });
            }
        }
        walk(heroRoot);
    }
    return { rows, newRels };
}

/** Heroes named in a chapter title like "Doctrine & Orisa" / "Wuyang, Brigitte & Jetpack Cat". */
function heroesFromChapterTitle(title, manifestHeroes) {
    const raw = String(title || '')
        .replace(/\b(and|&|,)\b/gi, '|')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
    /** @type {string[]} */
    const out = [];
    for (const part of raw) {
        const id = resolveManifestHeroId(part, manifestHeroes) || folderToHeroId(part, manifestHeroes);
        if (id && !/eliminat|sees ally|other heroes|specific/i.test(id)) out.push(id);
        // also keep folder-style
        if (part && !out.includes(part)) {
            const folded = folderToHeroId(part, manifestHeroes);
            if (folded) out.push(folded);
        }
    }
    return [...new Set(out.map((h) => String(h)))];
}

function matchTurn(pool, text, { preferNew = true, preferHeroes = [] } = {}) {
    const want = coreKey(text);
    if (want.length < 8) return null;

    const prefer = new Set(
        (preferHeroes || []).map((h) =>
            String(h || '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, ''),
        ),
    );

    let best = null;
    let bestScore = Infinity;
    for (const row of pool) {
        const k = row.key;
        if (!k) continue;
        let score = Infinity;
        if (k === want) score = 0;
        else if (k.startsWith(want) || want.startsWith(k)) {
            const ratio = Math.min(k.length, want.length) / Math.max(k.length, want.length);
            if (ratio >= 0.82) score = 1 + Math.abs(k.length - want.length);
        } else if (want.length >= 18 && k.includes(want.slice(0, 18))) {
            score = 20;
        } else if (k.length >= 18 && want.includes(k.slice(0, 18))) {
            score = 25;
        } else if (want.length >= 22 && k.includes(want.slice(0, 22))) {
            score = 22;
        }
        if (score === Infinity) continue;

        const heroNorm = String(row.heroFolder || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
        if (prefer.size && prefer.has(heroNorm)) score -= 8;
        if (preferNew && row.isNew) score -= 0.25;

        if (score < bestScore) {
            bestScore = score;
            best = row;
        }
    }
    if (bestScore > 40) return null;
    return best ? { ...best, score: bestScore } : null;
}

function folderToHeroId(folder, manifestHeroes) {
    const map = {
        'D.Va': 'D.va',
        'D.Mon': 'D.mon',
        'Soldier_ 76': 'Soldier 76',
    };
    if (map[folder]) return map[folder];
    return resolveManifestHeroId(folder, manifestHeroes) || folder;
}

function labelToSubtitles(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^\((Korean|Shona|Japanese|Spanish|French|Chinese|Vietnamese|Danish)\)\s*/i, (m) => `${m.trim()} `)
        .trim();
}

function atlasVoiceName(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = labelToSubtitles(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

async function copyVoice(hero, hit) {
    const atlas = atlasVoiceName(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!dryRun) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    }
    return atlas;
}

function pickHeroicRenderForHero(heroName, rendersMap) {
    const list = rendersMap?.[heroName] || [];
    return list.find((name) => /heroic/i.test(name)) || list[0] || 'Heroic.png';
}

function fingerprint(lines) {
    return (lines || [])
        .map((l) => `${norm(l.hero)}|${norm(l.subtitles)}`)
        .filter((part) => !part.endsWith('|'))
        .join('||');
}

function overlapsOpening(conversation, entryLines) {
    const opening = norm(entryLines?.[0]?.subtitles || '');
    if (opening.length < 20) return false;
    const needle = opening.slice(0, 48);
    return (conversation.lines || []).some((l) => {
        const text = norm(l.subtitles);
        if (text.length < 20) return false;
        return text.includes(needle) || needle.includes(text.slice(0, 48));
    });
}

function chapterForTime(chapters, startMs) {
    const sec = startMs / 1000;
    for (const ch of chapters) {
        if (sec >= ch.start && sec < ch.end) return ch;
    }
    return null;
}

function blankChatter(heroId) {
    return {
        id: chatterIdForHero(heroId),
        entryType: 'chatter',
        name: heroId,
        status: 'active',
        eraName: '',
        tags: [],
        scene: DEFAULT_DIALOGUE_SCENE,
        lines: [],
    };
}

async function main() {
    if (fetchSubs) {
        for (const video of VIDEOS) ensureSubs(video.id);
    }

    const manifestHeroes = await loadManifestHeroIds();
    const { rows: dialoguePool } = indexExtractFolders(['MatchTalk']);
    const { rows: elimPool } = indexExtractFolders([
        'Elimination',
        'KillStreak',
        'Multikill',
        'TeamKill',
        'Revenge',
        'MeleeEnemyKilledRemark',
        'Teammate',
    ]);
    console.log(
        `Pools: MatchTalk=${dialoguePool.length} (new=${dialoguePool.filter((r) => r.isNew).length}), ` +
            `elim/ally=${elimPool.length} (new=${elimPool.filter((r) => r.isNew).length})`,
    );

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;
    const assets = await scanTheaterAssets();

    /** @type {string[]} */
    const addedDialogues = [];
    /** @type {string[]} */
    const skippedDialogues = [];
    let chatterAdded = 0;
    let chatterSkipped = 0;
    let unmatched = 0;

    for (const video of VIDEOS) {
        const vttFile = ensureSubs(video.id);
        const turns = parseVttTurns(fs.readFileSync(vttFile, 'utf8'));
        console.log(`\n[${video.label}] ${video.id}: ${turns.length} caption turns, ${video.chapters.length} chapters`);

        /** @type {Map<string, Array<object>>} */
        const dialogueByChapter = new Map();
        /** @type {Map<string, Array<object>>} */
        const chatterByChapter = new Map();

        for (const turn of turns) {
            const ch = chapterForTime(video.chapters, turn.startMs);
            if (!ch) continue;

            const preferHeroes = heroesFromChapterTitle(ch.title, manifestHeroes);
            const pool = ch.kind === 'chatter' ? elimPool : dialoguePool;
            let hit = matchTurn(pool, turn.text, { preferNew: true, preferHeroes });
            // Chatter fallback: short lines often only in Elimination
            if (!hit && ch.kind === 'chatter') {
                hit = matchTurn(dialoguePool, turn.text, { preferNew: true, preferHeroes });
            }
            if (!hit) {
                unmatched += 1;
                continue;
            }
            const hero = folderToHeroId(hit.heroFolder, manifestHeroes);
            const row = {
                chapterTitle: ch.title,
                kind: ch.kind,
                disclaimer: ch.disclaimer || '',
                startMs: turn.startMs,
                caption: turn.text,
                hero,
                subtitles: labelToSubtitles(hit.label),
                isNew: Boolean(hit.isNew),
                rel: hit.rel,
                source: hit.source,
                label: hit.label,
                score: hit.score,
            };
            const key = ch.title;
            if (ch.kind === 'chatter') {
                const list = chatterByChapter.get(key) || [];
                list.push(row);
                chatterByChapter.set(key, list);
            } else {
                const list = dialogueByChapter.get(key) || [];
                list.push(row);
                dialogueByChapter.set(key, list);
            }
        }

        // --- Dialogues: one numbered entry per chapter ---
        for (const ch of video.chapters.filter((c) => c.kind === 'dialogue')) {
            const lines = dialogueByChapter.get(ch.title) || [];
            if (lines.length < 2) {
                console.log(`  skip dialogue "${ch.title}" (matched ${lines.length})`);
                skippedDialogues.push(`${video.label}:${ch.title}`);
                continue;
            }

            // Collapse consecutive identical hero+subtitle
            /** @type {typeof lines} */
            const compact = [];
            for (const line of lines) {
                const prev = compact[compact.length - 1];
                if (prev && prev.hero === line.hero && coreKey(prev.subtitles) === coreKey(line.subtitles)) {
                    continue;
                }
                compact.push(line);
            }
            if (compact.length < 2) {
                skippedDialogues.push(`${video.label}:${ch.title}`);
                continue;
            }

            const entryLines = [];
            for (const line of compact) {
                const voice = await copyVoice(line.hero, line);
                entryLines.push({
                    hero: resolveManifestHeroId(line.hero, manifestHeroes) || line.hero,
                    subtitles: line.subtitles,
                    voice,
                    isNew: line.isNew,
                });
            }

            const exists = conversations.some((c) => {
                if (String(c.entryType || '') === 'chatter') return false;
                if (fingerprint(c.lines || []) === fingerprint(entryLines)) return true;
                return overlapsOpening(c, entryLines);
            });
            if (exists) {
                console.log(`  exists "${ch.title}"`);
                skippedDialogues.push(`${video.label}:${ch.title}`);
                continue;
            }

            const conversation = buildBlankConversationRecord();
            conversation.name = String(nextConversationNumber(conversations));
            conversation.status = 'active';
            conversation.eraName = video.era;
            conversation.scene = DEFAULT_DIALOGUE_SCENE;
            conversation.tags = ['Overwatch'];
            conversation.lines = entryLines.map((line) => ({
                id: createDialogueLineId(),
                hero: line.hero,
                voice: line.voice || '',
                voicePrefix: '',
                subtitles: line.subtitles,
                render: pickHeroicRenderForHero(line.hero, assets.renders || {}),
                era: 'Overwatch',
                status: 'active',
            }));

            if (!dryRun) conversations.push(conversation);
            else conversations.push(conversation); // keep numbering sequential in dry-run memory
            const heroes = [...new Set(entryLines.map((l) => l.hero))];
            const newN = entryLines.filter((l) => l.isNew).length;
            addedDialogues.push(
                `${conversation.name} [${video.label}] ${ch.title} (${heroes.join('+')}, new=${newN}/${entryLines.length})`,
            );
            console.log(`  + #${conversation.name} "${ch.title}" lines=${entryLines.length}`);
        }

        // --- Chatter elim chapters ---
        for (const ch of video.chapters.filter((c) => c.kind === 'chatter')) {
            const lines = chatterByChapter.get(ch.title) || [];
            console.log(`  chatter "${ch.title}": ${lines.length} matched turns → ${ch.disclaimer}`);
            /** @type {Set<string>} */
            const seen = new Set();
            for (const line of lines) {
                const key = `${line.hero}::${ch.disclaimer}::${coreKey(line.subtitles)}`;
                if (seen.has(key)) continue;
                seen.add(key);

                const chatterId = chatterIdForHero(line.hero);
                let chatter = conversations.find((c) => c.id === chatterId);
                if (!chatter) {
                    chatter = blankChatter(line.hero);
                    conversations.push(chatter);
                }
                if (!Array.isArray(chatter.lines)) chatter.lines = [];

                const already = chatter.lines.some(
                    (l) =>
                        coreKey(l.subtitles) === coreKey(line.subtitles) &&
                        String(l.disclaimer || '') === ch.disclaimer,
                );
                if (already) {
                    chatterSkipped += 1;
                    continue;
                }

                const voice = await copyVoice(line.hero, line);
                if (!dryRun) {
                    chatter.lines.push({
                        id: randomUUID(),
                        hero: line.hero,
                        voice,
                        voicePrefix: '',
                        subtitles: line.subtitles,
                        render: pickHeroicRenderForHero(line.hero, assets.renders || {}),
                        era: 'Overwatch',
                        status: 'active',
                        disclaimer: ch.disclaimer,
                    });
                }
                chatterAdded += 1;
            }
        }
    }

    console.log(`\nDialogues added: ${addedDialogues.length}`);
    addedDialogues.forEach((a) => console.log(' ', a));
    console.log(`Dialogues skipped: ${skippedDialogues.length}`);
    console.log(`Chatter lines added: ${chatterAdded}, skipped existing: ${chatterSkipped}`);
    console.log(`Unmatched caption turns: ${unmatched}`);

    if (dryRun) {
        console.log('\nDry run — conversations not written.');
        return;
    }

    raw.conversations = conversations;
    raw._meta = raw._meta || {};
    raw._meta.s45S5YoutubePlaceholdersAt = new Date().toISOString();
    raw._meta.s45S5YoutubeDialogueCount = addedDialogues.length;
    raw._meta.s45S5YoutubeChatterCount = chatterAdded;

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const theaterAssets = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(theaterAssets, null, 2)}\n`, 'utf8');
    console.log(`\nWrote ${CONVERSATIONS_PATH}`);
    console.log('Names are numbers only — rename / edit on audit pass.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
