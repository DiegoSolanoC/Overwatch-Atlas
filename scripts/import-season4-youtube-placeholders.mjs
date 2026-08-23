#!/usr/bin/env node
/**
 * Build Season 4 YouTube interaction placeholders from Hammeh caption VTTs,
 * matched against HeroVoice MatchTalk (preferring newly extracted lines).
 *
 * Sources:
 *   Part 1 https://www.youtube.com/watch?v=pmGQ1UAjdwc
 *   Part 2 https://www.youtube.com/watch?v=F9i6B2NZs6Q
 *
 * Usage:
 *   node scripts/import-season4-youtube-placeholders.mjs --dry-run
 *   node scripts/import-season4-youtube-placeholders.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const DIFF_ADDED = path.join(
    os.homedir(),
    'OneDrive/Escritorio/interactions/overwatch-atlas-audits/herovoice-snapshots',
    'diff_baseline_pre-tool-update_vs_post_after-tool-update/added.jsonl',
);
const CACHE = path.join(__dirname, '_cache');
const ERA = 'Season 4 (YouTube placeholder)';
const DATA_OUT = path.join(__dirname, 'data/season4-hammeh-interactions.mjs');

const VIDEOS = [
    { id: 'pmGQ1UAjdwc', part: 1, vtt: path.join(CACHE, 'yt-pmGQ1UAjdwc.en.vtt') },
    { id: 'F9i6B2NZs6Q', part: 2, vtt: path.join(CACHE, 'yt-F9i6B2NZs6Q.en.vtt') },
];

const dryRun = process.argv.includes('--dry-run');

/** @type {Record<string, string>} */
const HERO_FOLDER_ALIAS = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_ 76',
    'Wrecking Ball': 'Wrecking Ball',
    'Junker Queen': 'Junker Queen',
    'Jetpack Cat': 'Jetpack Cat',
};

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

/**
 * Parse auto-ASR VTT into speaker turns (>> markers) with timestamps.
 * @param {string} vtt
 */
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
        // Prefer the "settled" cue line without word-timing <c> tags
        const plain = lines
            .filter((l) => !l.includes('-->') && !/^\d+$/.test(l) && !/<c>/i.test(l))
            .map(cleanCaptionText)
            .filter(Boolean);
        if (!plain.length) continue;
        const text = plain[plain.length - 1];
        if (!text || text === '>>') continue;
        finals.push({ startMs, text });
    }

    // Deduplicate consecutive identical settled lines
    /** @type {Array<{ startMs: number, text: string }>} */
    const deduped = [];
    for (const row of finals) {
        const prev = deduped[deduped.length - 1];
        if (prev && norm(prev.text) === norm(row.text)) continue;
        deduped.push(row);
    }

    // Split into speaker turns on >>
    /** @type {Array<{ startMs: number, text: string }>} */
    const turns = [];
    for (const row of deduped) {
        const chunks = row.text
            .split(/\s*>>\s*/)
            .map((c) => c.trim())
            .filter(Boolean);
        if (!chunks.length) continue;
        // If line doesn't start with >>, first chunk continues previous speaker unless empty turns
        let offset = 0;
        for (const chunk of chunks) {
            if (/^\[(laughter|music|applause|silence).*\]$/i.test(chunk)) continue;
            if (chunk.length < 2) continue;
            turns.push({ startMs: row.startMs + offset, text: chunk });
            offset += 1;
        }
    }

    // Merge short continuation fragments that don't look like new sentences
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

/**
 * @returns {Promise<{ rows: Array<object>, newKeys: Set<string> }>}
 */
async function indexMatchTalk() {
    /** @type {Set<string>} */
    const newRels = new Set();
    if (fs.existsSync(DIFF_ADDED)) {
        for (const line of fs.readFileSync(DIFF_ADDED, 'utf8').split(/\n/)) {
            if (!line.trim()) continue;
            const row = JSON.parse(line);
            if (row.category === 'MatchTalk' || String(row.rel || '').includes('/MatchTalk/')) {
                newRels.add(String(row.rel).replace(/\\/g, '/'));
            }
        }
    }

    /** @type {Array<object>} */
    const rows = [];
    /** @type {Set<string>} */
    const newKeys = new Set();

    const heroes = fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const heroEnt of heroes) {
        const mt = path.join(EXTRACT_ROOT, heroEnt.name, 'MatchTalk');
        if (!fs.existsSync(mt)) continue;
        const files = fs.readdirSync(mt);
        for (const name of files) {
            if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
            const m = name.match(/^[^-]+-(.+)\.ogg$/i);
            const label = m ? m[1] : name;
            const rel = `${heroEnt.name}/MatchTalk/${name}`.replace(/\\/g, '/');
            const key = coreKey(label);
            if (key.length < 6) continue;
            const isNew = newRels.has(rel);
            if (isNew) newKeys.add(`${heroEnt.name}|${key}`);
            rows.push({
                heroFolder: heroEnt.name,
                label,
                key,
                rel,
                isNew,
                atlasHint: label,
            });
        }
    }
    return { rows, newKeys };
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

/**
 * @param {Array<object>} pool
 * @param {string} text
 */
function matchTurn(pool, text) {
    const want = coreKey(text);
    if (want.length < 8) return null;

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
        }
        if (score < bestScore) {
            bestScore = score;
            best = row;
        }
    }
    if (bestScore > 40) return null;
    return best ? { ...best, score: bestScore } : null;
}

/**
 * Group matched turns into multi-line interactions.
 * @param {Array<object>} matched
 */
function groupInteractions(matched) {
    /** @type {Array<{ lines: object[], part: number, startMs: number, newCount: number }>} */
    const groups = [];
    /** @type {object[]} */
    let current = [];
    let currentPart = 0;
    let currentStart = 0;

    function flush() {
        if (current.length < 2) {
            current = [];
            return;
        }
        const heroes = new Set(current.map((l) => l.hero));
        if (heroes.size < 2) {
            current = [];
            return;
        }
        const newCount = current.filter((l) => l.isNew).length;
        if (newCount < 1) {
            current = [];
            return;
        }
        groups.push({
            lines: current,
            part: currentPart,
            startMs: currentStart,
            newCount,
        });
        current = [];
    }

    for (let i = 0; i < matched.length; i += 1) {
        const row = matched[i];
        const prev = current[current.length - 1];
        const gap = prev ? row.startMs - prev.startMs : 0;

        if (!current.length) {
            current = [row];
            currentPart = row.part;
            currentStart = row.startMs;
            continue;
        }

        const longGap = gap > 4500;
        const tooLong = current.length >= 6;
        const partChange = row.part !== currentPart;

        if (partChange || longGap || tooLong) {
            flush();
            current = [row];
            currentPart = row.part;
            currentStart = row.startMs;
            continue;
        }
        current.push(row);
    }
    flush();
    return groups;
}

function fingerprint(lines) {
    return (lines || [])
        .map((l) => `${norm(l.hero)}|${norm(l.subtitles)}`)
        .filter((part) => !part.endsWith('|'))
        .join('||');
}

function overlapsOpening(conversation, entry) {
    const opening = norm(entry.lines?.[0]?.subtitles || '');
    if (opening.length < 20) return false;
    const needle = opening.slice(0, 48);
    return (conversation.lines || []).some((l) => {
        const text = norm(l.subtitles);
        if (text.length < 20) return false;
        return text.includes(needle) || needle.includes(text.slice(0, 48));
    });
}

function pickHeroicRenderForHero(heroName, rendersMap) {
    const list = rendersMap?.[heroName] || [];
    return list.find((name) => /heroic/i.test(name)) || list[0] || 'Heroic.png';
}

function labelToSubtitles(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/^\(Korean\)\s*/i, '(Korean) ')
        .trim();
}

async function main() {
    const manifestHeroes = await loadManifestHeroIds();
    const { rows: pool } = await indexMatchTalk();
    console.log(`MatchTalk index: ${pool.length} (new=${pool.filter((r) => r.isNew).length})`);

    /** @type {Array<object>} */
    const matchedTurns = [];

    for (const video of VIDEOS) {
        if (!fs.existsSync(video.vtt)) {
            console.error(`Missing VTT: ${video.vtt}`);
            process.exit(1);
        }
        const turns = parseVttTurns(fs.readFileSync(video.vtt, 'utf8'));
        console.log(`Video part ${video.part}: ${turns.length} caption turns`);

        for (const turn of turns) {
            const hit = matchTurn(pool, turn.text);
            if (!hit) continue;
            const hero = folderToHeroId(hit.heroFolder, manifestHeroes);
            matchedTurns.push({
                part: video.part,
                startMs: turn.startMs,
                caption: turn.text,
                hero,
                subtitles: labelToSubtitles(hit.label),
                isNew: Boolean(hit.isNew),
                rel: hit.rel,
                score: hit.score,
            });
        }
    }

    console.log(`Matched turns: ${matchedTurns.length} (new lines ${matchedTurns.filter((t) => t.isNew).length})`);

    const groups = groupInteractions(matchedTurns);
    console.log(`Grouped interactions: ${groups.length}`);

    /** @type {Array<object>} */
    const entries = groups.map((g, idx) => {
        const heroes = [...new Set(g.lines.map((l) => l.hero))];
        return {
            sourcePart: g.part,
            startMs: g.startMs,
            newLineCount: g.newCount,
            heroes,
            lines: g.lines.map((l) => ({
                hero: l.hero,
                subtitles: l.subtitles,
                _caption: l.caption,
                _isNew: l.isNew,
                _rel: l.rel,
            })),
            _tmpName: `S4p${g.part}-${String(idx + 1).padStart(3, '0')}`,
        };
    });

    // Write data module for review / re-import
    const serializable = entries.map((e) => ({
        heroes: e.heroes,
        sourcePart: e.sourcePart,
        newLineCount: e.newLineCount,
        lines: e.lines.map((l) => ({ hero: l.hero, subtitles: l.subtitles })),
    }));
    const dataModule = `/**
 * Season 4 interactions from Hammeh YouTube (auto-matched to MatchTalk).
 * Part 1: https://www.youtube.com/watch?v=pmGQ1UAjdwc
 * Part 2: https://www.youtube.com/watch?v=F9i6B2NZs6Q
 *
 * Captions are ASR — placeholders for manual rename / cleanup.
 * Generated ${new Date().toISOString()}
 */
export const SEASON4_INTERACTIONS = ${JSON.stringify(serializable, null, 2)};
`;
    if (!dryRun) {
        await fsp.mkdir(path.dirname(DATA_OUT), { recursive: true });
        await fsp.writeFile(DATA_OUT, dataModule, 'utf8');
        console.log(`Wrote ${DATA_OUT}`);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;
    const assets = await scanTheaterAssets();

    /** @type {string[]} */
    const added = [];
    /** @type {string[]} */
    const skipped = [];

    for (const entry of entries) {
        const exists = conversations.some((c) => {
            if (fingerprint(c.lines || []) === fingerprint(entry.lines)) return true;
            return overlapsOpening(c, entry);
        });
        if (exists) {
            skipped.push(entry._tmpName);
            continue;
        }

        const conversation = buildBlankConversationRecord();
        conversation.name = String(nextConversationNumber(conversations));
        conversation.status = 'active';
        conversation.eraName = ERA;
        conversation.scene = DEFAULT_DIALOGUE_SCENE;
        conversation.tags = ['Overwatch'];

        conversation.lines = entry.lines.map((line) => {
            const hero = resolveManifestHeroId(line.hero, manifestHeroes) || line.hero;
            return {
                id: createDialogueLineId(),
                hero,
                voice: '',
                voicePrefix: '',
                subtitles: line.subtitles,
                render: pickHeroicRenderForHero(hero, assets.renders || {}),
                era: 'Overwatch',
                status: 'active',
            };
        });

        conversations.push(conversation);
        added.push(`${conversation.name} (p${entry.sourcePart}, new=${entry.newLineCount}, ${entry.heroes.join('+')})`);
    }

    console.log(`\nAdded: ${added.length}`);
    added.forEach((a) => console.log(' ', a));
    console.log(`Skipped existing: ${skipped.length}`);

    if (dryRun) {
        console.log('\nDry run — conversations not written.');
        return;
    }

    raw.conversations = conversations;
    raw._meta = raw._meta || {};
    raw._meta.season4YoutubePlaceholdersAt = new Date().toISOString();
    raw._meta.season4YoutubePlaceholderCount = added.length;
    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    await scanTheaterAssets();
    console.log(`\nWrote ${CONVERSATIONS_PATH}`);
    console.log(`Era tag: "${ERA}" — rename manually, then wire audio.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
