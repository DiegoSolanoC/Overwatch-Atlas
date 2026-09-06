#!/usr/bin/env node
/**
 * Import wiki Respawn / next-round / Eliminations chatter into Hero Chatter hubs.
 *
 * Sources (from each hero's Quotes page):
 *   - ==Chatter== triggers: Respawn, Won/Lost Previous Round, Final Round
 *   - ==Eliminations== table rows (Final Blow, Team Kill, Solo Elimination, …)
 *
 * Disclaimer is set to the wiki trigger so category filters classify correctly.
 *
 * Usage:
 *   node scripts/import-match-event-chatters.mjs --dry-run
 *   node scripts/import-match-event-chatters.mjs
 *   node scripts/import-match-event-chatters.mjs --hero Ana
 *   node scripts/import-match-event-chatters.mjs --refresh-wiki
 *   node scripts/import-match-event-chatters.mjs --skip-audio
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

ensureAuditWorkspace();

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
const OUT_JSON = auditPath('_import-match-event-chatters-report.json');

const dryRun = process.argv.includes('--dry-run');
const refreshWiki = process.argv.includes('--refresh-wiki');
const skipAudio = process.argv.includes('--skip-audio');
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
        .replace(/\*([^*]+)\*/g, ' $1 ')
        // Keep parenthetical contents (Bastion beeps are entirely "(… beeps)").
        .replace(/[()]/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
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
        || cell.match(/<small>\s*''([\s\S]*?)''\s*<\/small>/i)
        || cell.match(/<small>([\s\S]*?)<\/small>/i);
    if (smallMatch) disclaimer = cleanDisclaimer(smallMatch[1]);

    let spoken = '';
    if (/\{\{QuoteTranslation/i.test(cell)) {
        spoken = extractQuoteTranslationSpoken(cell);
    } else {
        // Bastion-style: ''*considering beeps*'' → (considering beeps)
        spoken = cell
            .replace(/<small>[\s\S]*?<\/small>/gi, ' ')
            .replace(/''\*([^*]+)\*''/g, '($1)')
            .replace(/'\*([^*]+)\*'/g, '($1)');
        spoken = stripWikiMarkup(spoken);
    }
    spoken = spoken
        .replace(/\*([^*]+)\*/g, '($1)')
        .replace(/\s+/g, ' ')
        .trim();
    return { spoken, disclaimer };
}

function resolveCacheDirs() {
    /** @type {string[]} */
    const dirs = [];
    for (const d of [WIKI_QUOTES_CACHE_DIR, FALLBACK_CACHE]) {
        if (d && fs.existsSync(d) && !dirs.includes(d)) dirs.push(d);
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
    const apiUrl = new URL('https://overwatch.fandom.com/api.php');
    apiUrl.searchParams.set('action', 'parse');
    apiUrl.searchParams.set('page', pageTitle);
    apiUrl.searchParams.set('format', 'json');
    apiUrl.searchParams.set('prop', 'wikitext');
    apiUrl.searchParams.set('redirects', '1');
    const res = await fetch(apiUrl, { headers: { 'User-Agent': WIKI_USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error.info || json.error.code);
    const text = json?.parse?.wikitext?.['*'] || json?.parse?.wikitext;
    if (!text) throw new Error(`No wikitext for ${pageTitle}`);
    return String(text);
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

/**
 * Normalize a bold trigger into one of our import buckets (or null to ignore).
 * @param {string} hit
 * @returns {string|null} canonical trigger label for disclaimer
 */
function classifyChatterTrigger(hit) {
    const t = String(hit || '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    if (!t) return null;
    if (/^respawn$/i.test(t)) return 'Respawn';
    if (/won\s*previous/i.test(t)) return 'Won Previous Round';
    if (/lost\s*previous/i.test(t)) return 'Lost Previous Round';
    if (/final\s*round/i.test(t)) return 'Final Round';
    // Keep Team Kill under the current parent (Respawn) — handled by caller.
    if (/^team\s*kill$/i.test(t)) return 'Team Kill';
    return null;
}

/**
 * Triggers that end an active chatter import window.
 * @param {string} hit
 */
function isChatterSectionEnd(hit) {
    return /hero selected|match start|set[- ]?up|health|healed|on fire|nano|perk|voted|reinforcement|negative|discord|hacked|resurrect|ultimate|damage boost|booster|ally|enemy|pickup|fully healed/i.test(
        hit,
    );
}

/**
 * @param {string} sectionBody
 * @param {'chatter'|'eliminations'} mode
 * @returns {Array<{ trigger: string, spoken: string, extraDisclaimer: string, wikiAudio: string, key: string }>}
 */
function parseTriggeredQuotes(sectionBody, mode) {
    const rows = String(sectionBody || '').split(/\n\|-/);
    /** @type {Array<{ trigger: string, spoken: string, extraDisclaimer: string, wikiAudio: string, key: string }>} */
    const out = [];
    let currentTrigger = '';
    let active = mode === 'eliminations';

    for (const row of rows) {
        const triggerHits = [...row.matchAll(/'''([^']{2,100})'''/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').trim(),
        );

        for (const hit of triggerHits) {
            if (mode === 'chatter') {
                if (/^(general|minor|major|unused)$/i.test(hit)) continue;
                const classified = classifyChatterTrigger(hit);
                if (classified === 'Team Kill' && /^Respawn/i.test(currentTrigger)) {
                    currentTrigger = 'Respawn — Team Kill';
                    active = true;
                    continue;
                }
                if (classified && classified !== 'Team Kill') {
                    currentTrigger = classified;
                    active = true;
                    continue;
                }
                if (isChatterSectionEnd(hit) && !/respawn|won previous|lost previous|final round/i.test(hit)) {
                    active = false;
                    currentTrigger = hit;
                }
            } else {
                // Eliminations: any bold trigger becomes the disclaimer.
                if (hit.length >= 2 && hit.length < 90 && /[A-Za-z]/.test(hit)) {
                    if (/^(trigger|quote|audio|general|unused)$/i.test(hit)) continue;
                    currentTrigger = /^elimination\b/i.test(hit) ? hit : `Elimination — ${hit}`;
                    active = true;
                }
            }
        }

        if (!active || !currentTrigger) continue;

        const audioMatch = row.match(/\{\{Audio\|([^}]+)\}\}/i);
        const wikiAudio = audioMatch ? String(audioMatch[1]).trim() : '';
        let addedFromRow = 0;

        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            if (/rowspan|colspan|<center|<big/i.test(line)
                && !/\{\{QuoteTranslation/i.test(line)
                && !/\{\{Audio\|/i.test(line)) {
                const cellOnly = line.replace(/^\|\s*/, '').trim();
                if (!cellOnly || /rowspan|colspan|<center|<big/i.test(cellOnly)) continue;
            }

            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            if (/'''/.test(cell) && cell.length < 80 && !/\{\{QuoteTranslation/i.test(cell)) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;

            let { spoken, disclaimer } = splitQuoteAndDisclaimer(cell);
            // Bastion / non-verbal: fall back to audio filename label when quote cell is empty-ish.
            if (spoken.length < 3 && wikiAudio) {
                const fromAudio = String(wikiAudio)
                    .replace(/^File:/i, '')
                    .replace(/\.ogg$/i, '')
                    .replace(/^[^-\n]+-\s*/, '')
                    .trim();
                if (fromAudio.length >= 3) spoken = fromAudio;
            }
            if (spoken.length < 2) continue;
            if (/^(trigger|quote|audio)$/i.test(spoken)) continue;

            const key = coreKey(spoken);
            if (!key) continue;
            if (out.some((q) => q.key === key && q.trigger === currentTrigger)) continue;

            out.push({
                trigger: currentTrigger,
                spoken,
                extraDisclaimer: disclaimer,
                wikiAudio,
                key,
            });
            addedFromRow += 1;
        }

        // Audio-only rows (or quote cells that failed to parse) — use file labels.
        if (!addedFromRow && wikiAudio && active && currentTrigger) {
            const audios = [...row.matchAll(/\{\{Audio\|([^}]+)\}\}/gi)].map((m) =>
                String(m[1]).trim(),
            );
            for (const audio of audios) {
                const fromAudio = String(audio)
                    .replace(/^File:/i, '')
                    .replace(/\.ogg$/i, '')
                    .replace(/^[^-\n]+-\s*/, '')
                    .trim();
                if (fromAudio.length < 3) continue;
                const key = coreKey(fromAudio);
                if (!key || out.some((q) => q.key === key && q.trigger === currentTrigger)) continue;
                out.push({
                    trigger: currentTrigger,
                    spoken: fromAudio,
                    extraDisclaimer: '',
                    wikiAudio: audio,
                    key,
                });
            }
        }
    }

    return out;
}

/**
 * @param {string} wikitext
 */
function parseMatchEventQuotes(wikitext) {
    const chatterBody =
        String(wikitext || '').match(/==\s*Chatter\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i)?.[1] || '';
    const elimBody =
        String(wikitext || '').match(/==\s*Eliminations\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i)?.[1]
        || '';

    const fromChatter = parseTriggeredQuotes(chatterBody, 'chatter');
    const fromElim = parseTriggeredQuotes(elimBody, 'eliminations');
    return [...fromChatter, ...fromElim];
}

function blankChatter(hero) {
    return {
        id: chatterIdForHero(hero),
        name: hero,
        entryType: 'chatter',
        scene: DEFAULT_DIALOGUE_SCENE,
        lines: [],
    };
}

function existingLineKeys(chatter) {
    /** @type {Set<string>} */
    const have = new Set();
    for (const line of chatter.lines || []) {
        const k = coreKey(line.subtitles || '');
        if (k) have.add(k);
    }
    return have;
}

function composeDisclaimer(trigger, extra) {
    const parts = [String(trigger || '').trim(), String(extra || '').trim()].filter(Boolean);
    // Avoid "Respawn — Respawn" style doubles when small-note repeats trigger.
    if (parts.length === 2 && coreKey(parts[0]) === coreKey(parts[1])) return parts[0];
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

    /** @type {Record<string, { added: number, skipped: number, missingAudio: number, quotes: number, byKind: Record<string, number> }>} */
    const byHero = {};
    let totalAdded = 0;
    let totalCopied = 0;
    let totalMissingAudio = 0;
    let heroesWithQuotes = 0;

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
            || !/==\s*Chatter\s*==/i.test(wikitext);

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
                    byHero[hero] = {
                        added: 0,
                        skipped: 0,
                        missingAudio: 0,
                        quotes: 0,
                        byKind: {},
                    };
                    continue;
                }
            }
        }

        const quotes = parseMatchEventQuotes(wikitext);
        /** @type {Record<string, number>} */
        const byKind = {};
        for (const q of quotes) {
            byKind[q.trigger] = (byKind[q.trigger] || 0) + 1;
        }
        byHero[hero] = {
            added: 0,
            skipped: 0,
            missingAudio: 0,
            quotes: quotes.length,
            byKind,
        };
        if (!quotes.length) continue;
        heroesWithQuotes += 1;

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

            let voice = '';
            for (const atlas of voiceCandidates) {
                if (fs.existsSync(path.join(VOICELINES_DIR, atlas))) {
                    voice = atlas;
                    break;
                }
            }

            if (!skipAudio) {
                const hit = findMatchTalkOgg(hero, quote.spoken);
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
            } else if (!voice) {
                voice = voiceCandidates[0] || '';
                if (!voice || !fs.existsSync(path.join(VOICELINES_DIR, voice))) {
                    byHero[hero].missingAudio += 1;
                    totalMissingAudio += 1;
                }
            }

            const disclaimer = composeDisclaimer(quote.trigger, quote.extraDisclaimer);
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
        conversationsData._meta.matchEventChattersImportedAt = new Date().toISOString();
        conversationsData._meta.matchEventChattersAdded = totalAdded;
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
        skipAudio,
        heroesWithQuotes,
        totalAdded,
        totalCopied,
        totalMissingAudio,
        byHero,
    };
    await fsp.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    console.log(`\nMatch-event chatter import${dryRun ? ' (dry-run)' : ''}${skipAudio ? ' [skip-audio]' : ''}`);
    console.log(`Heroes with quotes: ${heroesWithQuotes}`);
    console.log(`Lines added: ${totalAdded}`);
    console.log(`Audio copied/downloaded: ${totalCopied}`);
    console.log(`Missing audio: ${totalMissingAudio}`);
    const notable = Object.entries(byHero)
        .filter(([, s]) => s.added > 0 || s.quotes > 0)
        .sort((a, b) => b[1].added - a[1].added || a[0].localeCompare(b[0]));
    for (const [hero, s] of notable.slice(0, 30)) {
        console.log(
            `  ${hero.padEnd(16)} quotes=${String(s.quotes).padStart(3)} +${String(s.added).padStart(3)} skip=${s.skipped} missAudio=${s.missingAudio}`,
        );
    }
    if (notable.length > 30) console.log(`  … ${notable.length - 30} more heroes`);
    console.log(`Report: ${OUT_JSON}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
