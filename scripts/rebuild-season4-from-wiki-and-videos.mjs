#!/usr/bin/env node
/**
 * Season 4 second pass — rebuild YouTube placeholders from BOTH Hammeh videos
 * + wiki Quotes interaction tables (structure of truth).
 *
 * 1. Remove the first-pass numeric batch (#474–#501 style names still numeric)
 * 2. Parse Part 1 + Part 2 VTTs into MatchTalk-matched turns
 * 3. For each cluster, prefer the matching wiki Interaction row (full lines/paths)
 * 4. Also pull wiki rows for Season 4 heroes that use NEW MatchTalk takes and are
 *    not already fully present in theater
 * 5. Insert as NEW numbered names for manual review
 *
 * Sources:
 *   Part 1 https://www.youtube.com/watch?v=pmGQ1UAjdwc
 *   Part 2 https://www.youtube.com/watch?v=F9i6B2NZs6Q
 *
 * Usage:
 *   node scripts/rebuild-season4-from-wiki-and-videos.mjs --dry-run
 *   node scripts/rebuild-season4-from-wiki-and-videos.mjs
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
    createDialoguePathId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { resolveLineVoiceFile } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds, wikiPageTitleForHero } from './lib/wiki-quotes-heroes.mjs';
import {
    extractInteractionsSection,
    fetchWikiPageHtml,
    parseInteractionRows,
} from './lib/wiki-interactions-table.mjs';
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
const DATA_OUT = path.join(__dirname, 'data/season4-hammeh-interactions.mjs');
const ERA = 'Season 4 (YouTube placeholder)';

const VIDEOS = [
    { id: 'pmGQ1UAjdwc', part: 1, vtt: path.join(CACHE, 'yt-pmGQ1UAjdwc.en.vtt') },
    { id: 'F9i6B2NZs6Q', part: 2, vtt: path.join(CACHE, 'yt-F9i6B2NZs6Q.en.vtt') },
];

/** Heroes heavily featured in Season 4 / new roster for wiki sweep. */
const SEASON4_FOCUS_HEROES = [
    'D.mon',
    'D.va',
    'Domina',
    'Vendetta',
    'Mizuki',
    'Shion',
    'Anran',
    'Sierra',
    'Emre',
    'Freja',
    'Kiriko',
    'Genji',
    'Hazard',
    'Illari',
    'Junker Queen',
    'Junkrat',
    'Roadhog',
    'Mauga',
    'Sojourn',
    'Cassidy',
    'Winston',
    'Echo',
    'Brigitte',
    'Hanzo',
    'Lúcio',
    'Venture',
];

const dryRun = process.argv.includes('--dry-run');
/** First-pass numeric names still awaiting rename. */
const FIRST_PASS_NAME_MIN = 474;
const FIRST_PASS_NAME_MAX = 501;

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

function fingerprint(lines) {
    return (lines || [])
        .map((l) => `${norm(l.hero)}|${norm(l.subtitles)}`)
        .filter((part) => !part.endsWith('|'))
        .join('||');
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

/**
 * Parse auto-ASR VTT into speaker turns (`>>` / `&gt;&gt;` markers).
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

function labelToSubtitles(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
}

async function indexMatchTalk() {
    /** @type {Set<string>} */
    const newRels = new Set();
    if (fs.existsSync(DIFF_ADDED)) {
        for (const line of fs.readFileSync(DIFF_ADDED, 'utf8').split(/\n/)) {
            if (!line.trim()) continue;
            try {
                const row = JSON.parse(line);
                if (row.category === 'MatchTalk' || String(row.rel || '').includes('/MatchTalk/')) {
                    newRels.add(String(row.rel).replace(/\\/g, '/'));
                }
            } catch {
                /* skip */
            }
        }
    }

    /** @type {Array<object>} */
    const rows = [];
    if (!fs.existsSync(EXTRACT_ROOT)) return { rows, newKeys: new Set() };

    for (const heroEnt of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
        if (!heroEnt.isDirectory()) continue;
        const mt = path.join(EXTRACT_ROOT, heroEnt.name, 'MatchTalk');
        if (!fs.existsSync(mt)) continue;
        for (const name of fs.readdirSync(mt)) {
            if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
            const m = name.match(/^[^-]+-(.+)\.ogg$/i);
            const label = m ? m[1] : name;
            const rel = `${heroEnt.name}/MatchTalk/${name}`.replace(/\\/g, '/');
            const key = coreKey(label);
            if (key.length < 6) continue;
            rows.push({
                heroFolder: heroEnt.name,
                label,
                key,
                rel,
                isNew: newRels.has(rel),
            });
        }
    }
    return { rows };
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
            if (ratio >= 0.72) score = 1 + Math.abs(k.length - want.length);
        } else if (want.length >= 18 && k.includes(want)) {
            score = 15;
        } else if (want.length >= 20 && k.includes(want.slice(0, 20))) {
            score = 20;
        } else if (k.length >= 20 && want.includes(k.slice(0, 20))) {
            score = 25;
        }
        if (score < bestScore) {
            bestScore = score;
            best = row;
        }
    }
    if (bestScore > 30) return null;
    return best ? { ...best, score: bestScore } : null;
}

/**
 * Match caption turns to MatchTalk, joining adjacent fragments when needed
 * (ASR often splits one voiceline across multiple cues).
 * @param {Array<{ startMs: number, text: string }>} turns
 * @param {object[]} pool
 * @param {number} part
 * @param {string[]} manifestHeroes
 */
function matchTurnsWithJoins(turns, pool, part, manifestHeroes) {
    /** @type {Array<object>} */
    const matched = [];
    let i = 0;
    while (i < turns.length) {
        let best = null;
        let bestConsume = 1;
        let bestScore = Infinity;
        let combined = '';
        for (let n = 1; n <= 4 && i + n - 1 < turns.length; n += 1) {
            const gap = n === 1 ? 0 : turns[i + n - 1].startMs - turns[i + n - 2].startMs;
            if (n > 1 && gap > 4500) break;
            combined = n === 1 ? turns[i].text : `${combined} ${turns[i + n - 1].text}`;
            const hit = matchTurn(pool, combined);
            if (!hit) continue;
            if (hit.score < bestScore) {
                best = hit;
                bestScore = hit.score;
                bestConsume = n;
                if (hit.score === 0) break;
            }
        }
        if (best) {
            const hero = folderToHeroId(best.heroFolder, manifestHeroes);
            matched.push({
                part,
                startMs: turns[i].startMs,
                caption: turns
                    .slice(i, i + bestConsume)
                    .map((t) => t.text)
                    .join(' '),
                hero,
                subtitles: labelToSubtitles(best.label),
                isNew: Boolean(best.isNew),
                key: best.key,
                rel: best.rel,
            });
            i += bestConsume;
        } else {
            i += 1;
        }
    }
    return matched;
}

/**
 * Gap-based grouping of matched turns (stricter than first pass).
 * @param {Array<object>} matched
 */
function groupMatchedTurns(matched) {
    /** @type {Array<{ lines: object[], part: number, startMs: number }>} */
    const groups = [];
    /** @type {object[]} */
    let current = [];
    let part = 0;
    let startMs = 0;

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
        // Drop exact duplicate consecutive lines
        const cleaned = [];
        for (const line of current) {
            const prev = cleaned[cleaned.length - 1];
            if (prev && fingerprint([prev]) === fingerprint([line])) continue;
            cleaned.push(line);
        }
        if (cleaned.length < 2) {
            current = [];
            return;
        }
        groups.push({ lines: cleaned, part, startMs });
        current = [];
    }

    for (const turn of matched) {
        if (!current.length) {
            current = [turn];
            part = turn.part;
            startMs = turn.startMs;
            continue;
        }
        const gap = turn.startMs - current[current.length - 1].startMs;
        // Hammeh plays interactions nearly back-to-back — split on a short pause
        // OR when the speaking pair clearly changes after a beat.
        const prevHeroes = new Set(current.map((l) => l.hero));
        const pairChanged =
            gap > 3500 &&
            current.length >= 2 &&
            !prevHeroes.has(turn.hero) &&
            prevHeroes.size >= 2;
        if (turn.part !== part || gap > 9000 || pairChanged) {
            flush();
            current = [turn];
            part = turn.part;
            startMs = turn.startMs;
            continue;
        }
        current.push(turn);
    }
    flush();
    return groups;
}

function pickHeroicRenderForHero(heroName, rendersMap) {
    const list = rendersMap?.[heroName] || [];
    return list.find((name) => /heroic/i.test(name)) || list[0] || 'Heroic.png';
}

/**
 * Find wiki interaction that best covers a video cluster.
 * @param {object[]} wikiRows
 * @param {object[]} clusterLines
 */
function findWikiCover(wikiRows, clusterLines) {
    const clusterKeys = clusterLines.map((l) => coreKey(l.subtitles)).filter((k) => k.length >= 10);
    if (!clusterKeys.length) return null;

    let best = null;
    let bestHits = 0;
    for (const row of wikiRows) {
        const wikiKeys = (row.lines || []).map((l) => coreKey(l.subtitles));
        let hits = 0;
        for (const ck of clusterKeys) {
            if (wikiKeys.some((wk) => wk === ck || wk.startsWith(ck) || ck.startsWith(wk))) hits += 1;
        }
        if (hits > bestHits) {
            bestHits = hits;
            best = row;
        }
    }
    // Need most of the cluster covered (avoid false wiki glue)
    if (!best || bestHits < Math.max(2, Math.ceil(clusterKeys.length * 0.75))) return null;
    return best;
}

function conversationFullyHasWikiRow(conversations, wikiRow) {
    const want = fingerprint(wikiRow.lines || []);
    if (!want) return false;
    return conversations.some((c) => {
        if (c.entryType === 'chatter') return false;
        return fingerprint(c.lines || []) === want;
    });
}

function conversationRoughlyHasWikiRow(conversations, wikiRow) {
    const open = norm(wikiRow.lines?.[0]?.subtitles || '');
    if (open.length < 20) return false;
    const needle = open.slice(0, 40);
    return conversations.some((c) => {
        if (c.entryType === 'chatter') return false;
        const lines = c.lines || [];
        if (lines.length < (wikiRow.lines || []).length) return false;
        return lines.some((l) => {
            const text = norm(l.subtitles);
            return text.includes(needle) || needle.includes(text.slice(0, 40));
        });
    });
}

/**
 * @param {object} wikiRow
 * @param {string[]} manifestHeroes
 */
function normalizeWikiRow(wikiRow, manifestHeroes) {
    const lines = (wikiRow.lines || []).map((line) => {
        const hero = resolveManifestHeroId(line.hero, manifestHeroes) || String(line.hero || '').trim();
        return {
            hero,
            subtitles: String(line.subtitles || '').trim(),
        };
    });
    /** @type {Array<{ label: string, lineIndexes: number[] }>} */
    const paths = Array.isArray(wikiRow.paths)
        ? wikiRow.paths.map((p) => ({
              label: String(p.label || '').trim(),
              lineIndexes: Array.isArray(p.lineIndexes) ? p.lineIndexes.map(Number) : [],
          }))
        : [];
    return { lines, paths, partnerHero: wikiRow.partnerHero || '' };
}

async function loadWikiRowsForHeroes(heroes, manifestHeroes) {
    /** @type {object[]} */
    const all = [];
    /** @type {Map<string, object[]>} */
    const byHero = new Map();

    for (const hero of heroes) {
        let html;
        try {
            html = await fetchWikiPageHtml(wikiPageTitleForHero(hero));
        } catch (err) {
            console.warn(`wiki fetch failed ${hero}:`, err.message || err);
            continue;
        }
        let section;
        try {
            section = extractInteractionsSection(html);
        } catch {
            continue;
        }
        const rows = parseInteractionRows(section).map((row) => normalizeWikiRow(row, manifestHeroes));
        byHero.set(hero, rows);
        for (const row of rows) all.push(row);
        console.log(`  wiki ${hero}: ${rows.length} interactions`);
    }
    return { all, byHero };
}

async function main() {
    const manifestHeroes = await loadManifestHeroIds();
    const { rows: matchPool } = await indexMatchTalk();
    console.log(`MatchTalk index: ${matchPool.length}`);

    /** @type {Array<object>} */
    const matchedTurns = [];
    for (const video of VIDEOS) {
        if (!fs.existsSync(video.vtt)) {
            console.warn(`Missing VTT: ${video.vtt}`);
            continue;
        }
        const turns = parseVttTurns(fs.readFileSync(video.vtt, 'utf8'));
        console.log(`Part ${video.part}: ${turns.length} caption turns`);
        const matched = matchTurnsWithJoins(turns, matchPool, video.part, manifestHeroes);
        console.log(`  → matched ${matched.length} MatchTalk lines`);
        matchedTurns.push(...matched);
    }
    console.log(`Matched caption→MatchTalk turns: ${matchedTurns.length}`);

    console.log('\nLoading wiki interactions…');
    const { all: wikiRows } = await loadWikiRowsForHeroes(SEASON4_FOCUS_HEROES, manifestHeroes);
    console.log(`Wiki rows loaded: ${wikiRows.length}`);

    const newKeys = new Set(matchPool.filter((r) => r.isNew).map((r) => r.key));

    // Score wiki rows by how many video-matched turns they cover (both parts).
    /** @type {Map<object, { hits: number, parts: Set<number>, newHits: number }>} */
    const wikiScores = new Map();
    for (const row of wikiRows) {
        wikiScores.set(row, { hits: 0, parts: new Set(), newHits: 0 });
    }

    for (const turn of matchedTurns) {
        const tk = turn.key || coreKey(turn.subtitles);
        if (tk.length < 10) continue;
        for (const row of wikiRows) {
            const wikiKeys = (row.lines || []).map((l) => coreKey(l.subtitles));
            const hit = wikiKeys.some(
                (wk) => wk === tk || (wk.length >= 12 && (wk.startsWith(tk) || tk.startsWith(wk))),
            );
            if (!hit) continue;
            const score = wikiScores.get(row);
            score.hits += 1;
            score.parts.add(turn.part);
            if (turn.isNew) score.newHits += 1;
        }
    }

    /** @type {Map<string, { lines: object[], paths: object[], sourcePart: number|null, source: string, heroes: string[] }>} */
    const selected = new Map();

    function addEntry(entry, source) {
        const fp = fingerprint(entry.lines);
        if (!fp || selected.has(fp)) return false;
        const heroes = [...new Set(entry.lines.map((l) => l.hero))];
        selected.set(fp, {
            lines: entry.lines,
            paths: entry.paths || [],
            sourcePart: entry.sourcePart ?? null,
            source,
            heroes,
        });
        return true;
    }

    let fromVideoWiki = 0;
    for (const row of wikiRows) {
        const score = wikiScores.get(row);
        // Need at least 2 caption hits covering the row (or 1 hit if row is only 2 lines)
        const minHits = Math.min(2, (row.lines || []).length);
        // Accept a single solid hit when the row also has new MatchTalk audio
        const keys = (row.lines || []).map((l) => coreKey(l.subtitles));
        const hasNew = keys.some((k) =>
            k.length >= 10 && [...newKeys].some((nk) => nk === k || nk.startsWith(k) || k.startsWith(nk)),
        );
        if (!score || (score.hits < minHits && !(score.hits >= 1 && hasNew))) continue;
        const parts = [...score.parts].sort((a, b) => a - b);
        const sourcePart = parts.length === 1 ? parts[0] : parts[0] || null;
        if (
            addEntry(
                {
                    lines: row.lines,
                    paths: row.paths,
                    sourcePart,
                },
                `wiki+video-p${parts.join('+') || '?'}`,
            )
        ) {
            fromVideoWiki += 1;
        }
    }
    console.log(`Wiki rows evidenced in videos: ${fromVideoWiki}`);

    // Also keep unmatched video clusters as fallback (rare — ASR-only leftovers)
    const videoGroups = groupMatchedTurns(matchedTurns);
    let videoOnly = 0;
    let videoClusters = 0;
    for (const group of videoGroups) {
        videoClusters += 1;
        const cover = findWikiCover(wikiRows, group.lines);
        if (cover) {
            const addedCover = addEntry(
                {
                    lines: cover.lines,
                    paths: cover.paths,
                    sourcePart: group.part,
                },
                `wiki+video-cluster-p${group.part}`,
            );
            // If the wiki cover is already in the pool, only skip when the
            // cluster is essentially that same interaction.
            if (addedCover || fingerprint(cover.lines) === fingerprint(group.lines)) {
                continue;
            }
        }
        if (
            addEntry(
                {
                    lines: group.lines.map((l) => ({ hero: l.hero, subtitles: l.subtitles })),
                    paths: [],
                    sourcePart: group.part,
                },
                `video-only-p${group.part}`,
            )
        ) {
            videoOnly += 1;
        }
    }
    console.log(`Video clusters: ${videoClusters}, video-only leftovers: ${videoOnly}`);

    // Wiki sweep: remaining rows with ≥1 NEW MatchTalk line
    let wikiNew = 0;
    for (const row of wikiRows) {
        const keys = (row.lines || []).map((l) => coreKey(l.subtitles));
        const hasNew = keys.some((k) =>
            k.length >= 10 && [...newKeys].some((nk) => nk === k || nk.startsWith(k) || k.startsWith(nk)),
        );
        if (!hasNew) continue;
        if (
            addEntry(
                { lines: row.lines, paths: row.paths, sourcePart: null },
                'wiki-new-matchtalk',
            )
        ) {
            wikiNew += 1;
        }
    }
    console.log(`Extra wiki rows with new MatchTalk: ${wikiNew}`);
    console.log(`Unique candidates: ${selected.size}`);

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    /** @type {object[]} */
    let conversations = Array.isArray(raw.conversations) ? raw.conversations : [];

    // Remove first-pass numeric leftovers only (leave user-renamed entries alone)
    const before = conversations.length;
    const removed = [];
    conversations = conversations.filter((c) => {
        if (c.entryType === 'chatter') return true;
        const n = Number.parseInt(String(c.name || ''), 10);
        const isPureNumeric = String(c.name || '').trim() === String(n);
        if (isPureNumeric && n >= FIRST_PASS_NAME_MIN && n <= FIRST_PASS_NAME_MAX) {
            removed.push(String(c.name));
            return false;
        }
        return true;
    });
    console.log(`\nRemoved first-pass numeric entries: ${removed.length} (${before} → ${conversations.length})`);
    if (removed.length) console.log(`  #${removed.join(', #')}`);

    const assets = await scanTheaterAssets();
    /** @type {string[]} */
    const added = [];
    /** @type {string[]} */
    const skipped = [];

    /** @type {Array<object>} */
    const serializable = [];

    for (const entry of selected.values()) {
        if (conversationFullyHasWikiRow(conversations, entry)) {
            skipped.push(`full-dup ${entry.lines[0]?.subtitles?.slice(0, 40)}`);
            continue;
        }
        // If a renamed/manual entry already has the same opening with enough lines, skip
        if (conversationRoughlyHasWikiRow(conversations, entry) && entry.source.startsWith('wiki')) {
            // Still add if first-pass left a truncated copy that we just removed;
            // rough check against remaining conversations only.
            const remainingRough = conversationRoughlyHasWikiRow(conversations, entry);
            if (remainingRough) {
                const existing = conversations.find((c) => {
                    const open = norm(entry.lines[0]?.subtitles || '').slice(0, 40);
                    return (c.lines || []).some((l) => norm(l.subtitles).includes(open));
                });
                if (existing && (existing.lines || []).length >= entry.lines.length) {
                    skipped.push(`have ${existing.name}: ${entry.lines[0]?.subtitles?.slice(0, 40)}`);
                    continue;
                }
            }
        }

        const conversation = buildBlankConversationRecord();
        conversation.name = String(nextConversationNumber(conversations));
        conversation.status = 'active';
        conversation.eraName = ERA;
        conversation.scene = DEFAULT_DIALOGUE_SCENE;
        conversation.tags = ['Overwatch'];

        conversation.lines = entry.lines.map((line) => {
            const hero = resolveManifestHeroId(line.hero, manifestHeroes) || line.hero;
            const subtitles = String(line.subtitles || '').trim();
            const voice =
                resolveLineVoiceFile({ hero, subtitles }, assets.voicelines || []) || '';
            return {
                id: createDialogueLineId(),
                hero,
                voice,
                voicePrefix: '',
                subtitles,
                render: pickHeroicRenderForHero(hero, assets.renders || {}),
                era: 'Overwatch',
                status: 'active',
            };
        });

        if (entry.paths?.length) {
            conversation.paths = entry.paths.map((p) => ({
                id: createDialoguePathId(),
                label: p.label || '',
                lineIds: (p.lineIndexes || [])
                    .map((idx) => conversation.lines[idx]?.id)
                    .filter(Boolean),
            }));
            conversation.selectedPathId = conversation.paths[0]?.id || '';
        }

        conversations.push(conversation);
        const label = `${conversation.name} [p${entry.sourcePart ?? '-'} ${entry.source}] ${entry.heroes.join('+')} (${entry.lines.length} lines)`;
        added.push(label);
        serializable.push({
            name: conversation.name,
            heroes: entry.heroes,
            sourcePart: entry.sourcePart,
            source: entry.source,
            lines: entry.lines,
        });
    }

    console.log(`\nAdded: ${added.length}`);
    added.forEach((a) => console.log(' ', a));
    console.log(`Skipped: ${skipped.length}`);

    const dataModule = `/**
 * Season 4 interactions — second pass (wiki structure + both Hammeh videos).
 * Part 1: https://www.youtube.com/watch?v=pmGQ1UAjdwc
 * Part 2: https://www.youtube.com/watch?v=F9i6B2NZs6Q
 *
 * Numbered placeholders for manual rename / cleanup.
 * Generated ${new Date().toISOString()}
 */
export const SEASON4_INTERACTIONS = ${JSON.stringify(serializable, null, 2)};
`;

    if (dryRun) {
        console.log('\nDry run — no writes.');
        return;
    }

    raw.conversations = conversations;
    raw._meta = raw._meta || {};
    raw._meta.season4YoutubePlaceholdersAt = new Date().toISOString();
    raw._meta.season4YoutubePlaceholderCount = added.length;
    raw._meta.season4YoutubeRebuildPass = 2;
    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    await fsp.writeFile(DATA_OUT, dataModule, 'utf8');
    await scanTheaterAssets();
    console.log(`\nWrote ${CONVERSATIONS_PATH}`);
    console.log(`Wrote ${DATA_OUT}`);
    console.log(`Era: "${ERA}" — entries are numbered for your manual pass.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
