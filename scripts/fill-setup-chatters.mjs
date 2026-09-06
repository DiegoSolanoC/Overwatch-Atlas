#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Fill Hero Chatter entries with wiki Set-Up Chatter / During Set-Up lines.
 *
 * - Parses ==Chatter== tables from scripts/_wiki-quotes-cache
 * - Copies MatchTalk audio into Theater/Voicelines when available
 * - Writes lines onto entryType=chatter conversations (random/manual later)
 * - Moves matched classification rows out of the Chatter bucket
 *
 * Usage: node scripts/fill-setup-chatters.mjs [--dry-run]
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
import { stripWikiMarkup } from './lib/wiki-markup.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { DEFAULT_DIALOGUE_SCENE } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CACHE_DIR = WIKI_QUOTES_CACHE_DIR;
const CLASSIFY_JSON = auditPath('_audit-matchtalk-wiki-classify.json');
const CLASSIFY_CSV = auditPath('_audit-matchtalk-wiki-classify.csv');
const MANIFEST_PATH = path.join(REPO, 'src/data/platform/manifest.json');
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const dryRun = process.argv.includes('--dry-run');

/** Cache file stem → Atlas manifest hero id */
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
        // Keep spoken English lead-in; language note goes into disclaimer later if needed.
        return stripWikiMarkup(`${quote} (${script}) ${translation}`);
    }
    return stripWikiMarkup(quote || translation);
}

function splitQuoteAndDisclaimer(rawCell) {
    const cell = String(rawCell || '').trim();
    let disclaimer = '';
    const smallMatch = cell.match(/<small>\s*''?\(([\s\S]*?)\)''?\s*<\/small>/i)
        || cell.match(/<small>\s*''([\s\S]*?)''\s*<\/small>/i)
        || cell.match(/<small>([\s\S]*?)<\/small>/i);
    if (smallMatch) {
        disclaimer = cleanDisclaimer(smallMatch[1]);
    }

    let spoken = '';
    if (/\{\{QuoteTranslation/i.test(cell)) {
        spoken = extractQuoteTranslationSpoken(cell);
    } else {
        spoken = cell.replace(/<small>[\s\S]*?<\/small>/gi, ' ');
        spoken = stripWikiMarkup(spoken);
    }

    if (!disclaimer) {
        const trailing = spoken.match(/\s*\((with[\s\S]+)\)\s*$/i)
            || spoken.match(/\s*\((during[\s\S]+)\)\s*$/i)
            || spoken.match(/\s*\((while[\s\S]+)\)\s*$/i)
            || spoken.match(/\s*\((if[\s\S]+)\)\s*$/i)
            || spoken.match(/\s*\((when[\s\S]+)\)\s*$/i)
            || spoken.match(/\s*\((only[\s\S]+)\)\s*$/i);
        if (trailing) {
            disclaimer = cleanDisclaimer(trailing[1]);
            spoken = spoken.slice(0, trailing.index).trim();
        }
    }

    spoken = spoken
        .replace(/\*([^*]+)\*/g, '($1)')
        .replace(/\s+/g, ' ')
        .trim();
    return { spoken, disclaimer };
}

/**
 * Parse Set-Up / During Set-Up quotes from a hero Quotes Chatter section.
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
            } else if (/hero selected|match start|respawn|health|healed|on fire|nano|perk|voted|reinforcement|negative|discord|hacked|resurrect|ultimate|damage boost|booster/i.test(hit)) {
                setupActive = false;
                currentTrigger = hit;
            } else if (hit.length > 2 && hit.length < 48 && /[A-Za-z]/.test(hit)) {
                // Sub-trigger under Match Start etc. — leave setupActive as-is only if still setup
                if (!isSetupTrigger(currentTrigger)) setupActive = false;
            }
        }

        if (!setupActive) continue;

        const audioMatch = row.match(/\{\{Audio\|([^}]+)\}\}/i);
        const wikiAudio = audioMatch ? String(audioMatch[1]).trim() : '';

        const lines = row.split(/\n/).map((l) => l.trim());
        for (const line of lines) {
            if (!line.startsWith('|')) continue;
            if (/rowspan|colspan|center>|big>/i.test(line) && !/\{\{QuoteTranslation/i.test(line)) {
                // Trigger / layout cells — skip unless this row is a QuoteTranslation quote cell.
                if (!/\{\{Audio\|/i.test(line) && !/\{\{QuoteTranslation/i.test(line)) {
                    const cellOnly = line.replace(/^\|\s*/, '').trim();
                    if (!cellOnly || /rowspan|colspan|<center|<big/i.test(cellOnly)) continue;
                }
            }
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            if (/'''/.test(cell) && cell.length < 60 && !/\{\{QuoteTranslation/i.test(cell)) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;

            const { spoken, disclaimer } = splitQuoteAndDisclaimer(cell);
            if (spoken.length < 3) continue;
            if (/^trigger$/i.test(spoken) || /^quote$/i.test(spoken)) continue;

            const key = coreKey(spoken);
            if (!key) continue;
            if (out.some((q) => q.key === key)) continue;

            out.push({
                trigger: currentTrigger || 'Set-Up Chatter',
                spoken,
                disclaimer,
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

/**
 * @param {string} hero
 * @param {string} needle
 */
function findMatchTalkOgg(hero, needle) {
    const dir = path.join(EXTRACT_ROOT, extractFolderForHero(hero), 'MatchTalk');
    if (!fs.existsSync(dir)) return null;
    const n = String(needle || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const nKey = coreKey(needle);
    if (!n && !nKey) return null;

    /** @type {{ source: string, label: string, score: number }[]} */
    const hits = [];
    for (const name of fs.readdirSync(dir)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        const labelKey = coreKey(label);
        if (nKey && labelKey === nKey) {
            hits.push({ source: path.join(dir, name), label, score: 0 });
            continue;
        }
        if (n && norm === n) {
            hits.push({ source: path.join(dir, name), label, score: 1 });
            continue;
        }
        if (nKey && labelKey && (labelKey.startsWith(nKey) || nKey.startsWith(labelKey))) {
            hits.push({
                source: path.join(dir, name),
                label,
                score: 2 + Math.abs(labelKey.length - nKey.length),
            });
            continue;
        }
        if (n && (norm.includes(n) || n.includes(norm))) {
            hits.push({
                source: path.join(dir, name),
                label,
                score: 10 + Math.abs(norm.length - n.length),
            });
        }
    }
    hits.sort((a, b) => a.score - b.score);
    return hits[0] || null;
}

function rebuildClassifyCsv(rows) {
    const header = [
        'wikiBucket',
        'hero',
        'label',
        'matchHow',
        'matchScore',
        'wikiQuote',
        'atlasName',
        'sourceRel',
        'wikiPage',
    ];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [header.join(',')];
    for (const row of rows) {
        lines.push(
            [
                row.wikiBucket,
                row.hero,
                row.label,
                row.matchHow,
                row.matchScore,
                row.wikiQuote,
                row.atlasName,
                row.sourceRel,
                row.wikiPage,
            ]
                .map(esc)
                .join(','),
        );
    }
    return `${lines.join('\n')}\n`;
}

async function main() {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const heroes = Array.isArray(manifest.heroes) ? manifest.heroes : [];
    const conversationsData = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    const classify = JSON.parse(fs.readFileSync(CLASSIFY_JSON, 'utf8'));

    /** @type {Map<string, object[]>} */
    const classifyByHeroKey = new Map();
    for (const row of classify.rows || []) {
        if (String(row.wikiBucket || '') !== 'Chatter') continue;
        const hero = String(row.hero || '').trim();
        const key = coreKey(row.wikiQuote || row.label);
        if (!hero || !key) continue;
        if (!classifyByHeroKey.has(hero)) classifyByHeroKey.set(hero, []);
        classifyByHeroKey.get(hero).push(row);
    }

    /** @type {Set<string>} */
    const addressedAtlasNames = new Set();
    /** @type {Set<string>} */
    const addressedKeys = new Set();

    /** @type {Record<string, number>} */
    const filledByHero = {};
    let totalLines = 0;
    let copiedAudio = 0;
    let missingAudio = 0;
    let withDisclaimer = 0;

    for (const [fileStem, hero] of Object.entries(WIKI_FILE_TO_HERO)) {
        if (!heroes.includes(hero)) continue;
        const wikiPath = path.join(CACHE_DIR, `${fileStem}.wikitext`);
        if (!fs.existsSync(wikiPath)) {
            console.warn(`No wiki cache for ${hero} (${fileStem})`);
            continue;
        }
        const quotes = parseSetupQuotesFromChatter(fs.readFileSync(wikiPath, 'utf8'));
        if (quotes.length === 0) {
            filledByHero[hero] = 0;
            continue;
        }

        const classifyRows = classifyByHeroKey.get(hero) || [];
        /** @type {object[]} */
        const lines = [];

        for (const quote of quotes) {
            const matchRow =
                classifyRows.find((r) => coreKey(r.wikiQuote || r.label) === quote.key)
                || classifyRows.find((r) => coreKey(r.label) === quote.key)
                || classifyRows.find((r) => {
                    const rk = coreKey(r.label);
                    return rk && (quote.key.startsWith(rk) || rk.startsWith(quote.key));
                });

            const voiceCandidates = [
                matchRow?.atlasName || '',
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
                    copiedAudio += 1;
                } else if (dryRun) {
                    copiedAudio += 1;
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
                            copiedAudio += 1;
                        } else {
                            await downloadWikiVoicelineFile(wikiTitle, dest);
                            copiedAudio += 1;
                        }
                    } else if (voice && fs.existsSync(dest)) {
                        /* already present */
                    } else {
                        missingAudio += 1;
                    }
                } catch (err) {
                    voice = voiceCandidates[0] || '';
                    missingAudio += 1;
                    console.warn(`Wiki download failed (${hero}):`, err.message || err);
                }
            } else if (!voice) {
                voice = voiceCandidates[0] || '';
                missingAudio += 1;
            }

            /** @type {object} */
            const line = {
                id: randomUUID(),
                hero,
                voice: voice || '',
                voicePrefix: '',
                subtitles: quote.spoken,
                render: 'Heroic.png',
            };
            if (quote.disclaimer) {
                line.disclaimer = quote.disclaimer;
                withDisclaimer += 1;
            }
            lines.push(line);
            totalLines += 1;

            if (matchRow?.atlasName) addressedAtlasNames.add(matchRow.atlasName);
            addressedKeys.add(`${hero}::${quote.key}`);
            if (matchRow) {
                const mk = coreKey(matchRow.wikiQuote || matchRow.label);
                if (mk) addressedKeys.add(`${hero}::${mk}`);
            }
        }

        filledByHero[hero] = lines.length;

        const chatterId = chatterIdForHero(hero);
        let row = conversationsData.conversations.find((c) => c.id === chatterId);
        if (!row) {
            row = {
                id: chatterId,
                entryType: 'chatter',
                name: hero,
                status: 'active',
                eraName: '',
                tags: [],
                scene: DEFAULT_DIALOGUE_SCENE,
                lines: [],
            };
            conversationsData.conversations.push(row);
        }

        row.entryType = 'chatter';
        row.name = hero;
        row.scene = row.scene || DEFAULT_DIALOGUE_SCENE;
        row.tags = Array.isArray(row.tags) ? row.tags : [];
        row.lines = lines;
        delete row.paths;
        delete row.selectedPathId;
    }

    // Heroes with no wiki cache mapping still keep stubs
    for (const hero of heroes) {
        if (filledByHero[hero] != null) continue;
        filledByHero[hero] = 0;
    }

    // Clear addressed setup rows from Chatter classification bucket
    const remainingRows = [];
    /** @type {object[]} */
    const addressedRows = [];
    for (const row of classify.rows || []) {
        if (String(row.wikiBucket || '') !== 'Chatter') {
            remainingRows.push(row);
            continue;
        }
        const hero = String(row.hero || '').trim();
        const key = `${hero}::${coreKey(row.wikiQuote || row.label)}`;
        const byAtlas = row.atlasName && addressedAtlasNames.has(row.atlasName);
        if (byAtlas || addressedKeys.has(key)) {
            addressedRows.push({
                ...row,
                wikiBucket: 'Addressed: Set-Up Chatter',
            });
            continue;
        }
        remainingRows.push(row);
    }

    const nextRows = [...remainingRows, ...addressedRows];
    const bucketCounts = {};
    for (const row of nextRows) {
        const b = String(row.wikiBucket || 'Other');
        bucketCounts[b] = (bucketCounts[b] || 0) + 1;
    }

    classify.rows = nextRows;
    classify.summary = {
        ...(classify.summary || {}),
        classifiedTotal: nextRows.length,
        bucketCounts,
        setupChattersAddressedAt: new Date().toISOString(),
        setupChattersAddressed: addressedRows.length,
    };
    classify.generatedAt = new Date().toISOString();

    conversationsData._meta = conversationsData._meta || {};
    conversationsData._meta.setupChattersFilledAt = new Date().toISOString();
    conversationsData._meta.setupChattersLineCount = totalLines;

    console.log(`Setup chatter lines filled: ${totalLines}`);
    console.log(`With disclaimer: ${withDisclaimer}`);
    console.log(`Audio copied: ${copiedAudio}${dryRun ? ' (dry-run)' : ''}`);
    console.log(`Missing audio files: ${missingAudio}`);
    console.log(`Classification addressed: ${addressedRows.length}`);
    console.log(`Chatter bucket remaining: ${bucketCounts.Chatter || 0}`);
    console.log('Per hero:');
    for (const hero of heroes) {
        console.log(`  ${hero}: ${filledByHero[hero] || 0}`);
    }

    if (dryRun) {
        console.log('\nDry run — no files written.');
        return;
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(conversationsData, null, 2)}\n`, 'utf8');
    await fsp.writeFile(CLASSIFY_JSON, `${JSON.stringify(classify, null, 2)}\n`, 'utf8');
    await fsp.writeFile(CLASSIFY_CSV, rebuildClassifyCsv(nextRows), 'utf8');
    await scanTheaterAssets();
    console.log(`\nWrote ${CONVERSATIONS_PATH}`);
    console.log(`Updated classification + theater assets manifest.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
