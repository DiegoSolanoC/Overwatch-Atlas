#!/usr/bin/env node
/**
 * Import OW1 ==Map-Specific== quotes into Hero Chatter hubs.
 *
 * Format (matches existing OW1 setup + OW2 map-specific conventions):
 *   era: Classic
 *   status: removed
 *   disclaimer: map name (+ optional extra note)
 *   render: Heroic.png
 *
 * Audio: wiki {{Audio|…}} → MatchTalk → existing Theater/Voicelines.
 *
 * Usage:
 *   node scripts/import-ow1-map-specific-chatters.mjs --dry-run
 *   node scripts/import-ow1-map-specific-chatters.mjs
 *   node scripts/import-ow1-map-specific-chatters.mjs --hero Hanzo
 *   node scripts/import-ow1-map-specific-chatters.mjs --refresh-wiki
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    downloadWikiVoicelineFile,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import { stripWikiMarkup } from './lib/wiki-markup.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { DEFAULT_DIALOGUE_SCENE } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import {
    DIALOGUE_THEATER_ERA_CLASSIC,
    DIALOGUE_THEATER_ERA_OVERWATCH,
} from '../src/features/dialogue-theater/dialogue-theater-list/dialogueTheaterEraFilter.js';
import { resolveLineVoiceFile } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';

ensureAuditWorkspace();

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const OW1_CACHE = path.join(WIKI_QUOTES_CACHE_DIR, 'overwatch_1');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const WIKI_ORIGIN = 'https://overwatch.fandom.com';
const USER_AGENT = 'OverwatchAtlas/1.0 (OW1 map-specific chatter importer)';
const OUT_JSON = auditPath('_import-ow1-map-specific-chatters-report.json');

const dryRun = process.argv.includes('--dry-run');
const refreshWiki = process.argv.includes('--refresh-wiki');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

/** MatchTalk folder → wiki title stem for /Quotes/Overwatch_1 */
const OW1_HEROES = [
    { folder: 'Ana', wiki: 'Ana', hero: 'Ana' },
    { folder: 'Ashe', wiki: 'Ashe', hero: 'Ashe' },
    { folder: 'Baptiste', wiki: 'Baptiste', hero: 'Baptiste' },
    { folder: 'Bastion', wiki: 'Bastion', hero: 'Bastion' },
    { folder: 'Brigitte', wiki: 'Brigitte', hero: 'Brigitte' },
    { folder: 'Cassidy', wiki: 'Cassidy', hero: 'Cassidy' },
    { folder: 'D.Va', wiki: 'D.Va', hero: 'D.va' },
    { folder: 'Doomfist', wiki: 'Doomfist', hero: 'Doomfist' },
    { folder: 'Echo', wiki: 'Echo', hero: 'Echo' },
    { folder: 'Genji', wiki: 'Genji', hero: 'Genji' },
    { folder: 'Hanzo', wiki: 'Hanzo', hero: 'Hanzo' },
    { folder: 'Junkrat', wiki: 'Junkrat', hero: 'Junkrat' },
    { folder: 'Lúcio', wiki: 'Lúcio', hero: 'Lúcio' },
    { folder: 'Mei', wiki: 'Mei', hero: 'Mei' },
    { folder: 'Mercy', wiki: 'Mercy', hero: 'Mercy' },
    { folder: 'Moira', wiki: 'Moira', hero: 'Moira' },
    { folder: 'Orisa', wiki: 'Orisa', hero: 'Orisa' },
    { folder: 'Pharah', wiki: 'Pharah', hero: 'Pharah' },
    { folder: 'Reaper', wiki: 'Reaper', hero: 'Reaper' },
    { folder: 'Reinhardt', wiki: 'Reinhardt', hero: 'Reinhardt' },
    { folder: 'Roadhog', wiki: 'Roadhog', hero: 'Roadhog' },
    { folder: 'Sigma', wiki: 'Sigma', hero: 'Sigma' },
    { folder: 'Soldier_ 76', wiki: 'Soldier:_76', hero: 'Soldier 76' },
    { folder: 'Sombra', wiki: 'Sombra', hero: 'Sombra' },
    { folder: 'Symmetra', wiki: 'Symmetra', hero: 'Symmetra' },
    { folder: 'Torbjörn', wiki: 'Torbjörn', hero: 'Torbjörn' },
    { folder: 'Tracer', wiki: 'Tracer', hero: 'Tracer' },
    { folder: 'Widowmaker', wiki: 'Widowmaker', hero: 'Widowmaker' },
    { folder: 'Winston', wiki: 'Winston', hero: 'Winston' },
    { folder: 'Wrecking Ball', wiki: 'Wrecking_Ball', hero: 'Wrecking Ball' },
    { folder: 'Zarya', wiki: 'Zarya', hero: 'Zarya' },
    { folder: 'Zenyatta', wiki: 'Zenyatta', hero: 'Zenyatta' },
];

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*([^*]+)\*/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function dialogueNorm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function cleanDisclaimer(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/^['"()]+|['"()]+$/g, '').trim();
    text = stripWikiMarkup(text);
    return text.replace(/^['"()]+|['"()]+$/g, '').trim();
}

function extractQuoteTranslationSpoken(cell) {
    const raw = String(cell || '');
    if (!/\{\{QuoteTranslation/i.test(raw)) return '';
    const quote = raw.match(/\|\s*quote\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
    const translation = raw.match(/\|\s*translation\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
    const script = raw.match(/\|\s*script\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
    if (quote && translation && script) {
        return stripWikiMarkup(`${quote} (${script}) ${translation}`);
    }
    return stripWikiMarkup(quote || translation);
}

function splitQuoteAndDisclaimer(rawCell) {
    const cell = String(rawCell || '').trim();
    let disclaimer = '';
    const smallMatch =
        cell.match(/<small>\s*''?\(([\s\S]*?)\)''?\s*<\/small>/i)
        || cell.match(/''\(([^)]+)\)''/)
        || cell.match(/<small>\s*''([\s\S]*?)''\s*<\/small>/i)
        || cell.match(/<small>([\s\S]*?)<\/small>/i);
    if (smallMatch) disclaimer = cleanDisclaimer(smallMatch[1]);

    let spoken = cell
        .replace(/<small>[\s\S]*?<\/small>/gi, ' ')
        .replace(/''\([^)]+\)''/g, ' ')
        .replace(/\*\s*chuckle\s*\*/gi, '(chuckle)')
        .replace(/\*([^*]+)\*/g, '($1)')
        .replace(/''([^']+)''/g, '$1');
    const qt = extractQuoteTranslationSpoken(spoken);
    if (qt) spoken = qt;
    else spoken = stripWikiMarkup(spoken);
    spoken = spoken.replace(/\s+/g, ' ').trim();
    return { spoken, disclaimer };
}

function cleanMapHeader(raw) {
    let text = String(raw || '');
    text = text
        .replace(/\|?\s*rowspan\s*=\s*"?\d+"?\s*\|?/gi, ' ')
        .replace(/<\/?center>/gi, ' ')
        .replace(/<\/?big>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' — ')
        .replace(/'''/g, '');
    text = stripWikiMarkup(text);
    return text
        .replace(/\s+/g, ' ')
        .replace(/\s*—\s*/g, ' — ')
        .trim();
}

/**
 * @param {string} wikitext
 * @returns {Array<{ map: string, spoken: string, extraDisclaimer: string, wikiAudio: string, key: string }>}
 */
function parseMapSpecificQuotes(wikitext) {
    const sectionMatch = String(wikitext || '').match(
        /==\s*Map-Specific\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i,
    );
    if (!sectionMatch) return [];
    const body = sectionMatch[1];
    const rows = body.split(/\n\|-/);
    /** @type {Array<{ map: string, spoken: string, extraDisclaimer: string, wikiAudio: string, key: string }>} */
    const out = [];
    let currentMap = '';

    for (const row of rows) {
        const mapCell = row.match(
            /\|\s*(?:rowspan\s*=\s*"?\d+"?\s*\|)?\s*<center>[\s\S]*?<\/center>/i,
        );
        if (mapCell) {
            currentMap = cleanMapHeader(mapCell[0]);
        } else {
            // OW1 pages sometimes use '''Map''' without <center>
            const boldMap = row.match(/\|\s*(?:rowspan\s*=\s*"?\d+"?\s*\|)?\s*'''([^']+)'''/);
            if (boldMap) currentMap = cleanMapHeader(boldMap[1]);
        }

        const audioMatch = row.match(/\{\{Audio\|([^}]+)\}\}/i);
        const wikiAudio = audioMatch ? String(audioMatch[1]).trim() : '';

        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            if (/<center>/i.test(line)) continue;

            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;
            if (/'''/.test(cell) && cell.length < 48 && !/\{\{QuoteTranslation/i.test(cell)) {
                // map label cell without quote body
                if (!currentMap) currentMap = cleanMapHeader(cell);
                continue;
            }
            if (/rowspan\s*=/i.test(cell)) continue;
            if (/^\|/.test(cell)) continue;

            const { spoken, disclaimer } = splitQuoteAndDisclaimer(cell);
            if (spoken.length < 2) continue;
            if (/^(map|quote|audio)$/i.test(spoken)) continue;
            if (/rowspan\s*=/i.test(spoken)) continue;
            if (/^['"][^'"]+['"]$/.test(spoken) && spoken.length < 48) continue;
            if (/^Horizon Lunar Colony(\s*\([^)]+\))?$/i.test(spoken.replace(/^['"]|['"]$/g, ''))) {
                continue;
            }

            const key = coreKey(spoken);
            if (!key) continue;
            if (out.some((q) => q.key === key && q.map === currentMap)) continue;

            out.push({
                map: currentMap || 'Map-Specific',
                spoken,
                extraDisclaimer: disclaimer,
                wikiAudio,
                key,
            });
        }
    }

    return out;
}

function composeDisclaimer(map, extra) {
    const parts = [String(map || '').trim(), String(extra || '').trim()].filter(Boolean);
    return parts.join(' — ');
}

async function fetchOw1Wikitext(pageTitle) {
    fs.mkdirSync(OW1_CACHE, { recursive: true });
    const cacheFile = path.join(
        OW1_CACHE,
        `${pageTitle.replace(/[\\/:*?"<>|]/g, '_')}.wikitext`,
    );
    if (!refreshWiki && fs.existsSync(cacheFile)) {
        return fs.readFileSync(cacheFile, 'utf8');
    }
    const apiUrl = new URL('/api.php', WIKI_ORIGIN);
    apiUrl.searchParams.set('action', 'parse');
    apiUrl.searchParams.set('page', pageTitle);
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('prop', 'wikitext');
    apiUrl.searchParams.set('redirects', '1');
    const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.info || json.error.code);
    const wikitext = json.parse?.wikitext?.['*'] || '';
    if (!wikitext) throw new Error('empty wikitext');
    if (!dryRun) fs.writeFileSync(cacheFile, wikitext, 'utf8');
    return wikitext;
}

function atlasFromWikiAudio(wikiAudio) {
    const title = String(wikiAudio || '').trim();
    if (!title) return '';
    try {
        return wikiFileTitleToTheaterFilename(
            title.startsWith('File:') ? title : `File:${title}`,
        );
    } catch {
        return '';
    }
}

function atlasFromLabel(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

async function indexMatchTalk(folder) {
    /** @type {Array<{ label: string, sourceOgg: string, atlasName: string, core: string, dialogueNorm: string }>} */
    const entries = [];
    const heroPrefix = folder === 'Soldier_ 76' ? 'Soldier_76' : folder.replace(/ /g, '_');
    const root = path.join(EXTRACT_ROOT, folder, 'MatchTalk');

    async function walk(dir) {
        let dirents;
        try {
            dirents = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of dirents) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(entry.name) || !/\.0B2-/i.test(entry.name)) continue;
            const match = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
            if (!match) continue;
            const label = match[1];
            entries.push({
                label,
                sourceOgg: full,
                atlasName: `${heroPrefix}_-_${String(label).replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_')}.ogg`,
                core: coreKey(label),
                dialogueNorm: dialogueNorm(label),
            });
        }
    }
    await walk(root);
    return entries;
}

function findMatchTalk(pool, spoken) {
    const want = coreKey(spoken);
    const wantNorm = dialogueNorm(spoken);
    for (const row of pool) {
        if (row.core === want || row.dialogueNorm === wantNorm) return row;
    }
    for (const row of pool) {
        const shorter = row.core.length <= want.length ? row.core : want;
        const longer = row.core.length <= want.length ? want : row.core;
        if (shorter.length >= 18 && longer.startsWith(shorter) && shorter.length / longer.length >= 0.85) {
            return row;
        }
    }
    return null;
}

function ensureChatter(conversations, hero) {
    const id = chatterIdForHero(hero);
    let chatter = conversations.find(
        (c) => c.id === id || (c.entryType === 'chatter' && c.name === hero),
    );
    if (!chatter) {
        chatter = {
            id,
            entryType: 'chatter',
            name: hero,
            status: 'active',
            eraName: '',
            tags: [],
            scene: DEFAULT_DIALOGUE_SCENE,
            lines: [],
        };
        conversations.push(chatter);
    }
    if (!Array.isArray(chatter.lines)) chatter.lines = [];
    for (const line of chatter.lines) {
        if (!line.era) line.era = DIALOGUE_THEATER_ERA_OVERWATCH;
        if (!line.status) line.status = 'active';
    }
    return chatter;
}

async function main() {
    const heroes = onlyHero
        ? OW1_HEROES.filter((h) => h.hero.toLowerCase() === onlyHero.toLowerCase())
        : OW1_HEROES;
    if (onlyHero && !heroes.length) {
        console.error(`Unknown OW1 hero: ${onlyHero}`);
        process.exit(1);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];
    const existingMeta = raw?._meta && typeof raw._meta === 'object' ? raw._meta : {};
    const assets = await scanTheaterAssets();
    /** @type {string[]} */
    let voicelines = [...(assets.voicelines || [])];

    /** @type {Record<string, { quotes: number, added: number, skipped: number, missingAudio: number }>} */
    const byHero = {};
    let totalAdded = 0;
    let totalSkipped = 0;
    let totalMissingAudio = 0;
    let wikiAudioHits = 0;
    let matchTalkHits = 0;
    let existingAudioHits = 0;
    let heroesWithMaps = 0;

    for (const { folder, wiki, hero } of heroes) {
        const pageTitle = `${wiki}/Quotes/Overwatch_1`;
        process.stdout.write(`${hero}… `);
        let wikitext;
        try {
            wikitext = await fetchOw1Wikitext(pageTitle);
        } catch (error) {
            console.log(`skip (${error instanceof Error ? error.message : error})`);
            byHero[hero] = { quotes: 0, added: 0, skipped: 0, missingAudio: 0 };
            continue;
        }

        const quotes = parseMapSpecificQuotes(wikitext);
        console.log(`${quotes.length} map line(s)`);
        byHero[hero] = { quotes: quotes.length, added: 0, skipped: 0, missingAudio: 0 };
        if (!quotes.length) continue;
        heroesWithMaps += 1;

        const chatter = ensureChatter(conversations, hero);
        const existingKeys = new Set(
            chatter.lines.map((l) => coreKey(l.subtitles || '')).filter(Boolean),
        );
        const matchTalk = await indexMatchTalk(folder);

        for (const quote of quotes) {
            if (existingKeys.has(quote.key)) {
                byHero[hero].skipped += 1;
                totalSkipped += 1;
                continue;
            }

            let voice = '';
            const fromWiki = atlasFromWikiAudio(quote.wikiAudio);
            if (fromWiki) {
                const dest = path.join(VOICELINES_DIR, fromWiki);
                try {
                    if (!dryRun) {
                        await fsp.mkdir(path.dirname(dest), { recursive: true });
                        try {
                            await fsp.access(dest);
                        } catch {
                            const wikiTitle = quote.wikiAudio.startsWith('File:')
                                ? quote.wikiAudio
                                : `File:${quote.wikiAudio}`;
                            await downloadWikiVoicelineFile(wikiTitle, dest);
                        }
                    }
                    voice = fromWiki;
                    wikiAudioHits += 1;
                    if (!voicelines.includes(voice)) voicelines.push(voice);
                } catch {
                    /* fall through */
                }
            }

            if (!voice) {
                const resolved = resolveLineVoiceFile(
                    { hero, subtitles: quote.spoken },
                    voicelines,
                );
                if (resolved) {
                    voice = resolved;
                    existingAudioHits += 1;
                }
            }

            if (!voice) {
                const hit = findMatchTalk(matchTalk, quote.spoken);
                if (hit) {
                    const dest = path.join(VOICELINES_DIR, hit.atlasName);
                    if (!dryRun) {
                        try {
                            await fsp.access(dest);
                        } catch {
                            await fsp.mkdir(path.dirname(dest), { recursive: true });
                            await fsp.copyFile(hit.sourceOgg, dest);
                        }
                    }
                    voice = hit.atlasName;
                    matchTalkHits += 1;
                    if (!voicelines.includes(voice)) voicelines.push(voice);
                }
            }

            if (!voice) {
                voice = atlasFromLabel(hero, quote.spoken);
                byHero[hero].missingAudio += 1;
                totalMissingAudio += 1;
            }

            const disclaimer = composeDisclaimer(quote.map, quote.extraDisclaimer);
            /** @type {Record<string, unknown>} */
            const line = {
                id: randomUUID(),
                hero,
                voice: voice || '',
                voicePrefix: '',
                subtitles: quote.spoken,
                render: 'Heroic.png',
                era: DIALOGUE_THEATER_ERA_CLASSIC,
                status: 'removed',
            };
            if (disclaimer) line.disclaimer = disclaimer;

            if (!dryRun) chatter.lines.push(line);
            existingKeys.add(quote.key);
            byHero[hero].added += 1;
            totalAdded += 1;
        }

        await new Promise((r) => setTimeout(r, 120));
    }

    if (!dryRun) {
        const payload = {
            ...raw,
            conversations,
            _meta: {
                ...existingMeta,
                ow1MapSpecificChattersImportedAt: new Date().toISOString(),
                ow1MapSpecificChattersAdded: totalAdded,
            },
        };
        await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        try {
            const nextAssets = await scanTheaterAssets();
            await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(nextAssets, null, 2)}\n`, 'utf8');
        } catch (err) {
            console.warn('theater-assets-manifest refresh failed:', err.message || err);
        }
    }

    const report = {
        dryRun,
        heroesWithMaps,
        totalAdded,
        totalSkipped,
        totalMissingAudio,
        wikiAudioHits,
        matchTalkHits,
        existingAudioHits,
        byHero,
    };
    await fsp.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`\nOW1 Map-Specific chatter import${dryRun ? ' (dry-run)' : ''}`);
    console.log(`Heroes with Map-Specific: ${heroesWithMaps}`);
    console.log(`Lines added: ${totalAdded}`);
    console.log(`Skipped (already present): ${totalSkipped}`);
    console.log(`Audio: wiki=${wikiAudioHits} matchTalk=${matchTalkHits} existing=${existingAudioHits} missing=${totalMissingAudio}`);
    for (const [hero, s] of Object.entries(byHero)
        .filter(([, v]) => v.quotes > 0)
        .sort((a, b) => b[1].added - a[1].added || a[0].localeCompare(b[0]))) {
        console.log(
            `  ${hero.padEnd(16)} quotes=${String(s.quotes).padStart(3)} +${String(s.added).padStart(3)} skip=${s.skipped} missAudio=${s.missingAudio}`,
        );
    }
    console.log(`Report: ${OUT_JSON}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
