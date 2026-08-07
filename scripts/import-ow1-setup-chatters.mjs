#!/usr/bin/env node
/**
 * Import OW1 "During Set Up" / Set-Up Chatter lines into Hero Chatter hubs.
 *
 * Each line gets:
 *   era: Classic
 *   status: removed
 *
 * Audio: wiki {{Audio|…}} first, then MatchTalk, then existing Voicelines.
 * Existing Overwatch-era chatter lines are left alone (stamped Overwatch/active on normalize).
 *
 * Usage:
 *   node scripts/import-ow1-setup-chatters.mjs --dry-run
 *   node scripts/import-ow1-setup-chatters.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import {
    downloadWikiVoicelineFile,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
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
const USER_AGENT = 'OverwatchAtlas/1.0 (OW1 setup chatter importer)';

const dryRun = process.argv.includes('--dry-run');

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

function isSetupTrigger(raw) {
    const name = String(raw || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/'''?/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!name) return false;
    const lower = name.toLowerCase();
    if (/set\s*up\s*here/i.test(lower)) return false;
    return /set[-\s]?up/i.test(lower);
}

function stripWikiMarkup(text) {
    return String(text || '')
        .replace(/\{\{[^}]+\}\}/g, ' ')
        .replace(/\[\[([^|\]]+)\|[^\]]+\]\]/g, '$1')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, '')
        .replace(/<\/?[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanDisclaimer(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/^['"()]+|['"()]+$/g, '').trim();
    text = stripWikiMarkup(text);
    return text.replace(/^['"()]+|['"()]+$/g, '').trim();
}

function splitQuoteAndDisclaimer(rawCell) {
    const cell = String(rawCell || '').trim();
    let disclaimer = '';
    const smallMatch =
        cell.match(/<small>\s*''?\(([\s\S]*?)\)''?\s*<\/small>/i)
        || cell.match(/<small>\s*''([\s\S]*?)''\s*<\/small>/i)
        || cell.match(/<small>([\s\S]*?)<\/small>/i);
    if (smallMatch) disclaimer = cleanDisclaimer(smallMatch[1]);

    let spoken = cell.replace(/<small>[\s\S]*?<\/small>/gi, ' ');
    spoken = stripWikiMarkup(spoken)
        .replace(/\*([^*]+)\*/g, '($1)')
        .replace(/\s+/g, ' ')
        .trim();
    return { spoken, disclaimer };
}

/**
 * @param {string} wikitext
 * @returns {Array<{ trigger: string, spoken: string, disclaimer: string, wikiAudio: string, key: string }>}
 */
function parseSetupQuotesFromChatter(wikitext) {
    const sectionMatch = String(wikitext || '').match(
        /==\s*Chatter\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i,
    );
    if (!sectionMatch) return [];
    const body = sectionMatch[1];
    const rows = body.split(/\n\|-/);
    /** @type {Array<{ trigger: string, spoken: string, disclaimer: string, wikiAudio: string, key: string }>} */
    const out = [];
    let currentTrigger = '';
    let setupActive = false;

    for (const row of rows) {
        const triggerHits = [...row.matchAll(/'''([^']{2,80})'''/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').trim(),
        );
        for (const hit of triggerHits) {
            if (/^(general|won previous|lost previous|final round|minor|major|unused)$/i.test(hit)) {
                continue;
            }
            if (isSetupTrigger(hit)) {
                currentTrigger = hit;
                setupActive = true;
            } else if (
                /hero selected|match start|respawn|health|healed|on fire|nano|perk|voted|reinforcement|negative|discord|hacked|resurrect|ultimate|damage boost|booster/i.test(
                    hit,
                )
            ) {
                setupActive = false;
                currentTrigger = hit;
            } else if (hit.length > 2 && hit.length < 48 && /[A-Za-z]/.test(hit)) {
                if (!isSetupTrigger(currentTrigger)) setupActive = false;
            }
        }

        if (!setupActive) continue;

        const audioMatch = row.match(/\{\{Audio\|([^}]+)\}\}/i);
        const wikiAudio = audioMatch ? String(audioMatch[1]).trim() : '';

        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            if (/'''/.test(cell) && cell.length < 60) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;

            const { spoken, disclaimer } = splitQuoteAndDisclaimer(cell);
            if (spoken.length < 3) continue;
            if (/^trigger$/i.test(spoken) || /^quote$/i.test(spoken)) continue;
            const key = coreKey(spoken);
            if (!key || out.some((q) => q.key === key)) continue;
            out.push({
                trigger: currentTrigger || 'During Set Up',
                spoken,
                disclaimer,
                wikiAudio,
                key,
            });
        }
    }
    return out;
}

async function fetchOw1Wikitext(pageTitle) {
    fs.mkdirSync(OW1_CACHE, { recursive: true });
    const cacheFile = path.join(
        OW1_CACHE,
        `${pageTitle.replace(/[\\/:*?"<>|]/g, '_')}.wikitext`,
    );
    if (fs.existsSync(cacheFile)) {
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
    fs.writeFileSync(cacheFile, wikitext, 'utf8');
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

function dialogueNorm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
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
                atlasName: atlasFromLabel(heroPrefix.replace(/_/g, ' ') === folder ? folder : heroPrefix, label).replace(
                    /^[^_]+/,
                    heroPrefix,
                ),
                core: coreKey(label),
                dialogueNorm: dialogueNorm(label),
            });
        }
    }
    await walk(root);
    // Fix atlas naming: HeroPrefix_-_label
    for (const e of entries) {
        e.atlasName = `${heroPrefix}_-_${String(e.label).replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_')}.ogg`;
    }
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
    let chatter = conversations.find((c) => c.id === id || (c.entryType === 'chatter' && c.name === hero));
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
    // Stamp existing lines missing era/status as Overwatch/active
    for (const line of chatter.lines) {
        if (!line.era) line.era = DIALOGUE_THEATER_ERA_OVERWATCH;
        if (!line.status) line.status = 'active';
    }
    return chatter;
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];
    const existingMeta = raw?._meta && typeof raw._meta === 'object' ? raw._meta : {};
    const assets = await scanTheaterAssets();
    /** @type {string[]} */
    let voicelines = [...(assets.voicelines || [])];

    let scanned = 0;
    let added = 0;
    let skippedDup = 0;
    let wikiAudio = 0;
    let matchTalkAudio = 0;
    let existingAudio = 0;
    let missingAudio = 0;

    for (const { folder, wiki, hero } of OW1_HEROES) {
        const pageTitle = `${wiki}/Quotes/Overwatch_1`;
        process.stdout.write(`${hero}… `);
        let wikitext;
        try {
            wikitext = await fetchOw1Wikitext(pageTitle);
        } catch (error) {
            console.log(`skip (${error instanceof Error ? error.message : error})`);
            continue;
        }

        const quotes = parseSetupQuotesFromChatter(wikitext);
        console.log(`${quotes.length} setup line(s)`);
        if (!quotes.length) continue;

        const chatter = ensureChatter(conversations, hero);
        const existingKeys = new Set(
            chatter.lines.map((l) => coreKey(l.subtitles || '')).filter(Boolean),
        );
        const matchTalk = await indexMatchTalk(folder);

        for (const quote of quotes) {
            scanned += 1;
            if (existingKeys.has(quote.key)) {
                skippedDup += 1;
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
                    wikiAudio += 1;
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
                    existingAudio += 1;
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
                    matchTalkAudio += 1;
                    if (!voicelines.includes(voice)) voicelines.push(voice);
                }
            }

            if (!voice) missingAudio += 1;

            /** @type {Record<string, unknown>} */
            const line = {
                id: randomUUID(),
                hero,
                voice,
                voicePrefix: '',
                subtitles: quote.spoken,
                render: 'Heroic.png',
                era: DIALOGUE_THEATER_ERA_CLASSIC,
                status: 'removed',
            };
            if (quote.disclaimer) line.disclaimer = quote.disclaimer;

            chatter.lines.push(line);
            existingKeys.add(quote.key);
            added += 1;
        }

        await new Promise((r) => setTimeout(r, 150));
    }

    console.log('\n=== OW1 setup chatter import ===');
    console.log(
        JSON.stringify(
            {
                dryRun,
                scanned,
                added,
                skippedDup,
                wikiAudio,
                matchTalkAudio,
                existingAudio,
                missingAudio,
            },
            null,
            2,
        ),
    );

    if (dryRun) {
        console.log('Dry run — conversations.json not written.');
        return;
    }

    await fsp.writeFile(
        CONVERSATIONS_PATH,
        `${JSON.stringify(
            {
                _meta: {
                    ...existingMeta,
                    ow1SetupChatterImportAt: new Date().toISOString(),
                },
                conversations,
            },
            null,
            2,
        )}\n`,
        'utf8',
    );
    const refreshed = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(refreshed, null, 2)}\n`, 'utf8');
    console.log(`Updated ${CONVERSATIONS_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
