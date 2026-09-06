#!/usr/bin/env node
/**
 * Import wiki ==Map-Specific== quotes into Hero Chatter hubs.
 *
 * - Parses Map-Specific tables from wiki quotes cache (refreshes from Fandom if needed)
 * - Appends lines onto entryType=chatter conversations (deduped by subtitle core-key)
 * - Stores map header in `disclaimer` (e.g. "Antarctic Peninsula")
 * - Copies MatchTalk / downloads wiki audio into Theater/Voicelines
 *
 * Usage:
 *   node scripts/import-map-specific-chatters.mjs --dry-run
 *   node scripts/import-map-specific-chatters.mjs
 *   node scripts/import-map-specific-chatters.mjs --hero Orisa
 *   node scripts/import-map-specific-chatters.mjs --refresh-wiki
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
    WIKI_USER_AGENT,
} from './lib/wiki-voiceline-download.mjs';
import { stripWikiMarkup } from './lib/wiki-markup.mjs';
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { DEFAULT_DIALOGUE_SCENE } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import {
    loadManifestHeroIds,
    wikiPageTitleForHero,
} from './lib/wiki-quotes-heroes.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
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
const FALLBACK_CACHE = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'Projects',
    'interactions',
    'overwatch-atlas-audits',
    '_wiki-quotes-cache',
);
const OUT_JSON = auditPath('_import-map-specific-chatters-report.json');

const dryRun = process.argv.includes('--dry-run');
const refreshWiki = process.argv.includes('--refresh-wiki');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

/** Atlas hero → MatchTalk extract folder */
const HERO_EXTRACT_FOLDER = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Jetpack Cat': 'Jetpack Cat',
    'Junker Queen': 'Junker Queen',
    'Soldier 76': 'Soldier_ 76',
    'Wrecking Ball': 'Wrecking Ball',
    Lúcio: 'Lúcio',
    Torbjörn: 'Torbjörn',
};

/** Cache file stem → Atlas hero id */
const WIKI_FILE_TO_HERO = {
    Ana: 'Ana',
    Anran: 'Anran',
    Ashe: 'Ashe',
    Baptiste: 'Baptiste',
    Bastion: 'Bastion',
    Brigitte: 'Brigitte',
    Cassidy: 'Cassidy',
    'D.Va': 'D.va',
    'D.Mon': 'D.mon',
    Domina: 'Domina',
    Doomfist: 'Doomfist',
    Echo: 'Echo',
    Emre: 'Emre',
    Freja: 'Freja',
    Genji: 'Genji',
    Hanzo: 'Hanzo',
    Hazard: 'Hazard',
    Illari: 'Illari',
    Jetpack_Cat: 'Jetpack Cat',
    Junker_Queen: 'Junker Queen',
    Junkrat: 'Junkrat',
    Juno: 'Juno',
    Kiriko: 'Kiriko',
    Lifeweaver: 'Lifeweaver',
    Lúcio: 'Lúcio',
    Mauga: 'Mauga',
    Mei: 'Mei',
    Mercy: 'Mercy',
    Mizuki: 'Mizuki',
    Moira: 'Moira',
    Orisa: 'Orisa',
    Pharah: 'Pharah',
    Ramattra: 'Ramattra',
    Reaper: 'Reaper',
    Reinhardt: 'Reinhardt',
    Roadhog: 'Roadhog',
    Shion: 'Shion',
    Sierra: 'Sierra',
    Sigma: 'Sigma',
    Sojourn: 'Sojourn',
    Soldier__76: 'Soldier 76',
    Sombra: 'Sombra',
    Symmetra: 'Symmetra',
    Torbjörn: 'Torbjörn',
    Tracer: 'Tracer',
    Vendetta: 'Vendetta',
    Venture: 'Venture',
    Widowmaker: 'Widowmaker',
    Winston: 'Winston',
    Wrecking_Ball: 'Wrecking Ball',
    Wuyang: 'Wuyang',
    Zarya: 'Zarya',
    Zenyatta: 'Zenyatta',
};

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

function cleanDisclaimer(raw) {
    let text = String(raw || '').trim();
    text = text.replace(/^['"()]+|['"()]+$/g, '').trim();
    text = stripWikiMarkup(text);
    text = text.replace(/^['"()]+|['"()]+$/g, '').trim();
    return text;
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
        || cell.match(/''\(([^)]+)\)''/);
    if (smallMatch) {
        disclaimer = cleanDisclaimer(smallMatch[1]);
    }
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
    text = text
        .replace(/\s+/g, ' ')
        .replace(/\s*—\s*/g, ' — ')
        .trim();
    return text;
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
        }

        const audioMatch = row.match(/\{\{Audio\|([^}]+)\}\}/i);
        const wikiAudio = audioMatch ? String(audioMatch[1]).trim() : '';

        const lines = row.split(/\n/).map((l) => l.trim());
        for (const line of lines) {
            if (!line.startsWith('|')) continue;
            if (/rowspan|colspan|<center|<big|^\|\s*!/i.test(line)
                && !/\{\{QuoteTranslation/i.test(line)
                && !/\{\{Audio\|/i.test(line)) {
                const cellOnly = line.replace(/^\|\s*/, '').trim();
                if (!cellOnly || /rowspan|colspan|<center|<big/i.test(cellOnly)) continue;
            }
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            if (/<center>/i.test(line)) continue;

            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;

            const { spoken, disclaimer } = splitQuoteAndDisclaimer(cell);
            if (spoken.length < 2) continue;
            if (/^(map|quote|audio)$/i.test(spoken)) continue;

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

function atlasFromWikiAudio(wikiAudio) {
    const title = String(wikiAudio || '').trim();
    if (!title) return '';
    try {
        return wikiFileTitleToTheaterFilename(
            title.startsWith('File:') ? title : `File:${title}`,
        );
    } catch (_) {
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

function extractFolderForHero(hero) {
    return HERO_EXTRACT_FOLDER[hero] || hero;
}

function findMatchTalkOgg(hero, needle) {
    const dir = path.join(EXTRACT_ROOT, extractFolderForHero(hero), 'MatchTalk');
    if (!fs.existsSync(dir)) return null;
    const nKey = coreKey(needle);
    if (!nKey) return null;

    /** @type {{ source: string, label: string, score: number } | null} */
    let best = null;
    const walk = (abs) => {
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
            const full = path.join(abs, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            const labeled = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            if (!labeled) continue;
            const label = labeled[1];
            const k = coreKey(label);
            if (!k) continue;
            let score = 0;
            if (k === nKey) score = 100;
            else if (k.startsWith(nKey) || nKey.startsWith(k)) score = 80;
            else if (k.includes(nKey) || nKey.includes(k)) score = 50;
            if (!score) continue;
            if (!best || score > best.score) best = { source: full, label, score };
        }
    };
    walk(dir);
    return best;
}

function existingLineKeys(chatter) {
    /** @type {Set<string>} */
    const have = new Set();
    for (const line of chatter.lines || []) {
        const k = coreKey(line?.subtitles);
        if (k) have.add(k);
    }
    return have;
}

function resolveCacheDirs() {
    ensureAuditWorkspace();
    /** @type {string[]} */
    const dirs = [];
    if (fs.existsSync(WIKI_QUOTES_CACHE_DIR)) dirs.push(WIKI_QUOTES_CACHE_DIR);
    if (FALLBACK_CACHE !== WIKI_QUOTES_CACHE_DIR && fs.existsSync(FALLBACK_CACHE)) {
        dirs.push(FALLBACK_CACHE);
    }
    return dirs;
}

function findCachedWikitext(fileStem, cacheDirs) {
    for (const dir of cacheDirs) {
        const p = path.join(dir, `${fileStem}.wikitext`);
        if (fs.existsSync(p)) return p;
    }
    return '';
}

async function fetchQuotesWikitext(pageTitle) {
    const url = new URL('https://overwatch.fandom.com/api.php');
    url.searchParams.set('action', 'parse');
    url.searchParams.set('page', pageTitle);
    url.searchParams.set('prop', 'wikitext');
    url.searchParams.set('format', 'json');
    url.searchParams.set('formatversion', '2');
    const res = await fetch(url, { headers: { 'User-Agent': WIKI_USER_AGENT } });
    if (!res.ok) throw new Error(`Wiki HTTP ${res.status} for ${pageTitle}`);
    const json = await res.json();
    const text = json?.parse?.wikitext;
    if (!text) throw new Error(`No wikitext for ${pageTitle}`);
    return String(text);
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

function composeDisclaimer(map, extra) {
    const parts = [String(map || '').trim(), String(extra || '').trim()].filter(Boolean);
    return parts.join(' — ');
}

async function main() {
    const heroes = await loadManifestHeroIds();
    const targetHeroes = onlyHero
        ? heroes.filter((h) => h.toLowerCase() === onlyHero.toLowerCase())
        : heroes;
    if (onlyHero && !targetHeroes.length) {
        console.error(`Hero not in manifest: ${onlyHero}`);
        process.exit(1);
    }

    const cacheDirs = resolveCacheDirs();
    const primaryCache = cacheDirs[0] || WIKI_QUOTES_CACHE_DIR;
    fs.mkdirSync(primaryCache, { recursive: true });

    const conversationsData = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    if (!Array.isArray(conversationsData.conversations)) {
        conversationsData.conversations = [];
    }

    /** @type {Record<string, { added: number, skipped: number, missingAudio: number, quotes: number }>} */
    const byHero = {};
    let totalAdded = 0;
    let totalCopied = 0;
    let totalMissingAudio = 0;
    let heroesWithMaps = 0;

    const stemByHero = new Map(
        Object.entries(WIKI_FILE_TO_HERO).map(([stem, hero]) => [hero, stem]),
    );

    for (const hero of targetHeroes) {
        const fileStem = stemByHero.get(hero) || hero.replace(/ /g, '_');
        let wikiPath = findCachedWikitext(fileStem, cacheDirs);
        let wikitext = wikiPath ? fs.readFileSync(wikiPath, 'utf8') : '';

        const needsFetch =
            refreshWiki
            || !wikitext
            || !/==\s*Map-Specific\s*==/i.test(wikitext);

        if (needsFetch) {
            try {
                const pageTitle = wikiPageTitleForHero(hero);
                wikitext = await fetchQuotesWikitext(pageTitle);
                wikiPath = path.join(primaryCache, `${fileStem}.wikitext`);
                if (!dryRun) {
                    await fsp.writeFile(wikiPath, wikitext, 'utf8');
                }
                console.log(`Fetched wiki: ${pageTitle}`);
            } catch (err) {
                console.warn(`Wiki fetch failed for ${hero}:`, err.message || err);
                if (!wikitext) {
                    byHero[hero] = { added: 0, skipped: 0, missingAudio: 0, quotes: 0 };
                    continue;
                }
            }
        }

        const quotes = parseMapSpecificQuotes(wikitext);
        byHero[hero] = { added: 0, skipped: 0, missingAudio: 0, quotes: quotes.length };
        if (!quotes.length) continue;
        heroesWithMaps += 1;

        const chatterId = chatterIdForHero(hero);
        let chatter = conversationsData.conversations.find((c) => c.id === chatterId);
        if (!chatter) {
            chatter = blankChatter(hero);
            conversationsData.conversations.push(chatter);
        }
        if (!Array.isArray(chatter.lines)) chatter.lines = [];
        const have = existingLineKeys(chatter);

        for (const quote of quotes) {
            if (have.has(quote.key)) {
                byHero[hero].skipped += 1;
                continue;
            }

            const voiceCandidates = [
                atlasFromWikiAudio(quote.wikiAudio),
                atlasFromLabel(hero, quote.spoken),
            ].filter(Boolean);

            const hit = findMatchTalkOgg(hero, quote.spoken);
            let voice = '';
            for (const atlas of voiceCandidates) {
                if (fs.existsSync(path.join(VOICELINES_DIR, atlas))) {
                    voice = atlas;
                    break;
                }
            }

            if (!voice && hit) {
                voice = voiceCandidates[0] || atlasFromLabel(hero, hit.label);
                const dest = path.join(VOICELINES_DIR, voice);
                if (!dryRun && !fs.existsSync(dest)) {
                    await fsp.copyFile(hit.source, dest);
                    totalCopied += 1;
                } else if (dryRun && !fs.existsSync(dest)) {
                    totalCopied += 1;
                }
            } else if (!voice && quote.wikiAudio) {
                const wikiTitle = quote.wikiAudio.startsWith('File:')
                    ? quote.wikiAudio
                    : `File:${quote.wikiAudio}`;
                try {
                    voice = atlasFromWikiAudio(quote.wikiAudio) || voiceCandidates[0] || '';
                    const dest = path.join(VOICELINES_DIR, voice);
                    if (voice && !fs.existsSync(dest)) {
                        if (dryRun) {
                            totalCopied += 1;
                        } else {
                            await downloadWikiVoicelineFile(wikiTitle, dest);
                            totalCopied += 1;
                        }
                    }
                } catch (err) {
                    voice = voiceCandidates[0] || '';
                    byHero[hero].missingAudio += 1;
                    totalMissingAudio += 1;
                    console.warn(`Audio download failed (${hero}):`, err.message || err);
                }
            } else if (!voice) {
                voice = voiceCandidates[0] || '';
                byHero[hero].missingAudio += 1;
                totalMissingAudio += 1;
            }

            const disclaimer = composeDisclaimer(quote.map, quote.extraDisclaimer);
            /** @type {object} */
            const line = {
                id: randomUUID(),
                hero,
                voice: voice || '',
                voicePrefix: '',
                subtitles: quote.spoken,
                render: 'Heroic.png',
            };
            if (disclaimer) line.disclaimer = disclaimer;

            if (!dryRun) {
                chatter.lines.push(line);
            }
            have.add(quote.key);
            byHero[hero].added += 1;
            totalAdded += 1;
        }
    }

    if (!dryRun) {
        conversationsData._meta = conversationsData._meta || {};
        conversationsData._meta.mapSpecificChattersImportedAt = new Date().toISOString();
        conversationsData._meta.mapSpecificChattersAdded = totalAdded;
        await fsp.writeFile(
            CONVERSATIONS_PATH,
            `${JSON.stringify(conversationsData, null, 2)}\n`,
            'utf8',
        );
        try {
            const assets = await scanTheaterAssets();
            await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
        } catch (err) {
            console.warn('theater-assets-manifest refresh failed:', err.message || err);
        }
    }

    const report = {
        dryRun,
        heroesWithMaps,
        totalAdded,
        totalCopied,
        totalMissingAudio,
        byHero,
    };
    await fsp.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`\nMap-Specific chatter import${dryRun ? ' (dry-run)' : ''}`);
    console.log(`Heroes with Map-Specific quotes: ${heroesWithMaps}`);
    console.log(`Lines added: ${totalAdded}`);
    console.log(`Audio copied/downloaded: ${totalCopied}`);
    console.log(`Missing audio: ${totalMissingAudio}`);
    const notable = Object.entries(byHero)
        .filter(([, s]) => s.added > 0 || s.quotes > 0)
        .sort((a, b) => b[1].added - a[1].added || a[0].localeCompare(b[0]));
    for (const [hero, s] of notable.slice(0, 25)) {
        console.log(
            `  ${hero.padEnd(16)} quotes=${String(s.quotes).padStart(3)} +${String(s.added).padStart(3)} skip=${s.skipped} missAudio=${s.missingAudio}`,
        );
    }
    if (notable.length > 25) console.log(`  … ${notable.length - 25} more heroes`);
    console.log(`Report: ${OUT_JSON}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
