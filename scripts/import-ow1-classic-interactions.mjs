#!/usr/bin/env node
/**
 * Import OW1-era wiki Interactions into Dialogue Theater as Classic + Removed.
 *
 * - Names: sequential numbers (unnamed for manual audit)
 * - status: removed
 * - tags: ["Classic"]
 * - Audio: wiki page source first, then MatchTalk extract, then existing Voicelines match
 *
 * Also ensures every existing non-chatter dialogue has era tag Overwatch
 * (post-rebranding default).
 *
 * Usage:
 *   node scripts/import-ow1-classic-interactions.mjs --dry-run
 *   node scripts/import-ow1-classic-interactions.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    createDialoguePathId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import {
    normalizeHeroKey,
    resolveLineVoiceFile,
    voicelineFilenameToSubtitles,
} from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';
import {
    extractInteractionsSection,
    fetchWikiPageHtml,
    parseInteractionRows,
} from './lib/wiki-interactions-table.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import {
    DIALOGUE_THEATER_ERA_CLASSIC,
    DIALOGUE_THEATER_ERA_OVERWATCH,
    finalizeDialogueTheaterTags,
} from '../src/features/dialogue-theater/dialogue-theater-list/dialogueTheaterEraFilter.js';
import { isChatterEntry } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const USER_AGENT = 'OverwatchAtlas/1.0 (OW1 Classic interaction importer)';

/** OW1-era heroes: MatchTalk folder → wiki page title before /Quotes/Overwatch_1 */
const OW1_HEROES = [
    { folder: 'Ana', wiki: 'Ana' },
    { folder: 'Ashe', wiki: 'Ashe' },
    { folder: 'Baptiste', wiki: 'Baptiste' },
    { folder: 'Bastion', wiki: 'Bastion' },
    { folder: 'Brigitte', wiki: 'Brigitte' },
    { folder: 'Cassidy', wiki: 'Cassidy' },
    { folder: 'D.Va', wiki: 'D.Va' },
    { folder: 'Doomfist', wiki: 'Doomfist' },
    { folder: 'Echo', wiki: 'Echo' },
    { folder: 'Genji', wiki: 'Genji' },
    { folder: 'Hanzo', wiki: 'Hanzo' },
    { folder: 'Junkrat', wiki: 'Junkrat' },
    { folder: 'Lúcio', wiki: 'Lúcio' },
    { folder: 'Mei', wiki: 'Mei' },
    { folder: 'Mercy', wiki: 'Mercy' },
    { folder: 'Moira', wiki: 'Moira' },
    { folder: 'Orisa', wiki: 'Orisa' },
    { folder: 'Pharah', wiki: 'Pharah' },
    { folder: 'Reaper', wiki: 'Reaper' },
    { folder: 'Reinhardt', wiki: 'Reinhardt' },
    { folder: 'Roadhog', wiki: 'Roadhog' },
    { folder: 'Sigma', wiki: 'Sigma' },
    { folder: 'Soldier_ 76', wiki: 'Soldier:_76' },
    { folder: 'Sombra', wiki: 'Sombra' },
    { folder: 'Symmetra', wiki: 'Symmetra' },
    { folder: 'Torbjörn', wiki: 'Torbjörn' },
    { folder: 'Tracer', wiki: 'Tracer' },
    { folder: 'Widowmaker', wiki: 'Widowmaker' },
    { folder: 'Winston', wiki: 'Winston' },
    { folder: 'Wrecking Ball', wiki: 'Wrecking_Ball' },
    { folder: 'Zarya', wiki: 'Zarya' },
    { folder: 'Zenyatta', wiki: 'Zenyatta' },
];

/** Wiki OW1 speaker labels → manifest hero ids */
const WIKI_HERO_ALIASES = {
    mccree: 'Cassidy',
    jessemccree: 'Cassidy',
    'soldier:76': 'Soldier 76',
    soldier76: 'Soldier 76',
    'd.va': 'D.Va',
    dva: 'D.Va',
    lucio: 'Lúcio',
    torbjorn: 'Torbjörn',
    wreckingball: 'Wrecking Ball',
};

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ dryRun: boolean, limit: number }} */
    const opts = { dryRun: false, limit: 0 };
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--dry-run') opts.dryRun = true;
        else if (argv[i] === '--limit' && argv[i + 1]) {
            opts.limit = Math.max(0, Number(argv[++i]) || 0);
        }
    }
    return opts;
}

/**
 * @param {string} value
 * @returns {string}
 */
function coreKey(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * @param {string} value
 * @returns {string}
 */
function dialogueNorm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * @param {string} heroName
 * @param {string[]} manifestHeroes
 * @returns {string}
 */
function resolveOw1Hero(heroName, manifestHeroes) {
    const trimmed = String(heroName || '').trim();
    const alias = WIKI_HERO_ALIASES[normalizeHeroKey(trimmed)];
    const candidate = alias || trimmed;
    return resolveManifestHeroId(candidate, manifestHeroes) || candidate;
}

/**
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
function pickHeroicRender(heroName, rendersMap) {
    const target = normalizeHeroKey(heroName);
    for (const [folder, files] of Object.entries(rendersMap || {})) {
        if (!Array.isArray(files) || !files.length) continue;
        if (normalizeHeroKey(folder) !== target) continue;
        return files.find((f) => f.toLowerCase() === 'heroic.png') || '';
    }
    return '';
}

/**
 * @param {{ hero?: string, subtitles?: string }[]} lines
 * @returns {string}
 */
function interactionFingerprint(lines) {
    return (Array.isArray(lines) ? lines : [])
        .map((line) => `${normalizeHeroKey(line.hero)}\x01${coreKey(line.subtitles)}`)
        .filter((part) => !part.endsWith('\x01'))
        .sort((a, b) => a.localeCompare(b))
        .join('\x02');
}

/**
 * @param {string} folderName
 * @returns {string}
 */
function heroFolderToFilenamePrefix(folderName) {
    if (folderName === 'Soldier_ 76') return 'Soldier_76';
    return String(folderName || '').trim().replace(/ /g, '_');
}

/**
 * @param {string} heroPrefix
 * @param {string} label
 * @returns {string}
 */
function labelToAtlasFilename(heroPrefix, label) {
    const safe = String(label || '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${heroPrefix}_-_${safe}.ogg`;
}

/**
 * @returns {Promise<Map<string, Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, core: string }>>>}
 */
async function indexMatchTalkByHeroKey() {
    /** @type {Map<string, Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, core: string }>>} */
    const byHero = new Map();

    async function walk(dir, folderName, heroPrefix) {
        let dirents;
        try {
            dirents = await fsp.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        const hk = normalizeHeroKey(folderName === 'Soldier_ 76' ? 'Soldier 76' : folderName);
        if (!byHero.has(hk)) byHero.set(hk, []);
        const bucket = byHero.get(hk);

        for (const entry of dirents) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(full, folderName, heroPrefix);
                continue;
            }
            if (!/\.ogg$/i.test(entry.name) || !/\.0B2-/i.test(entry.name)) continue;
            const match = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
            if (!match) continue;
            const label = match[1];
            bucket.push({
                label,
                sourceOgg: full,
                atlasName: labelToAtlasFilename(heroPrefix, label),
                dialogueNorm: dialogueNorm(label),
                core: coreKey(label),
            });
        }
    }

    for (const { folder } of OW1_HEROES) {
        const prefix = heroFolderToFilenamePrefix(folder);
        await walk(path.join(EXTRACT_ROOT, folder, 'MatchTalk'), folder, prefix);
    }
    return byHero;
}

/**
 * @param {Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, core: string }>} pool
 * @param {string} subtitles
 */
function findMatchTalk(pool, subtitles) {
    const wantNorm = dialogueNorm(subtitles);
    const wantCore = coreKey(subtitles);
    if (!wantNorm && !wantCore) return null;

    let best = null;
    for (const row of pool || []) {
        if (row.dialogueNorm === wantNorm || row.core === wantCore) {
            return { ...row, how: 'exact' };
        }
        const shorter = row.core.length <= wantCore.length ? row.core : wantCore;
        const longer = row.core.length <= wantCore.length ? wantCore : row.core;
        if (shorter.length >= 18 && longer.startsWith(shorter)) {
            const score = shorter.length / longer.length;
            if (score >= 0.85 && (!best || score > best.score)) {
                best = { ...row, how: 'prefix', score };
            }
        }
    }
    return best;
}

/**
 * @param {string} url
 * @param {string} destPath
 */
async function downloadFile(url, destPath) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await fsp.mkdir(path.dirname(destPath), { recursive: true });
    await fsp.writeFile(destPath, Buffer.from(await res.arrayBuffer()));
}

/**
 * @param {string} url
 * @param {string} dest
 * @param {boolean} dryRun
 */
async function downloadIfNeeded(url, dest, dryRun) {
    try {
        await fsp.access(dest);
        return 'exists';
    } catch {
        /* download */
    }
    if (dryRun) return 'would-download';
    await downloadFile(url, dest);
    return 'downloaded';
}

/**
 * @param {string} source
 * @param {string} dest
 * @param {boolean} dryRun
 */
async function copyIfNeeded(source, dest, dryRun) {
    try {
        await fsp.access(dest);
        return 'exists';
    } catch {
        /* copy */
    }
    if (dryRun) return 'would-copy';
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(source, dest);
    return 'copied';
}

/**
 * Ensure post-rebrand dialogues use Overwatch era tag.
 * @param {object[]} conversations
 * @returns {number}
 */
function ensureExistingOverwatchEra(conversations) {
    let changed = 0;
    for (const conversation of conversations) {
        if (isChatterEntry(conversation)) continue;
        const rawTags = Array.isArray(conversation.tags) ? conversation.tags : [];
        const hasClassic = rawTags.includes(DIALOGUE_THEATER_ERA_CLASSIC);
        const hasOverwatch = rawTags.includes(DIALOGUE_THEATER_ERA_OVERWATCH);
        if (hasClassic || hasOverwatch) continue;
        const hasPaths = Array.isArray(conversation.paths) && conversation.paths.length > 0;
        conversation.tags = finalizeDialogueTheaterTags(
            [...rawTags, DIALOGUE_THEATER_ERA_OVERWATCH],
            hasPaths,
        );
        changed += 1;
    }
    return changed;
}

/**
 * @param {object[]} conversations
 * @returns {Set<string>}
 */
function buildExistingFingerprints(conversations) {
    /** @type {Set<string>} */
    const fps = new Set();
    for (const conversation of conversations) {
        if (isChatterEntry(conversation)) continue;
        const fp = interactionFingerprint(
            (conversation.lines || []).map((line) => ({
                hero: line.hero,
                subtitles: line.subtitles || voicelineFilenameToSubtitles(line.voice || ''),
            })),
        );
        if (fp) fps.add(fp);
    }
    return fps;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];
    const existingMeta = raw?._meta && typeof raw._meta === 'object' ? raw._meta : {};

    const eraFixed = ensureExistingOverwatchEra(conversations);
    console.log(`Existing dialogues tagged Overwatch (was missing era): ${eraFixed}`);

    const manifestHeroes = await loadManifestHeroIds();
    const assets = await scanTheaterAssets();
    /** @type {string[]} */
    let voicelines = [...(assets.voicelines || [])];
    const rendersMap = assets.renders || {};
    const fingerprints = buildExistingFingerprints(conversations);

    console.log('Indexing MatchTalk for OW1 heroes…');
    const matchTalkByHero = await indexMatchTalkByHeroKey();

    let scanned = 0;
    let imported = 0;
    let skippedDup = 0;
    let wikiAudio = 0;
    let matchTalkAudio = 0;
    let existingAudio = 0;
    let missingAudio = 0;

    /** @type {Set<string>} */
    const importedThisRun = new Set();

    for (const { wiki } of OW1_HEROES) {
        const pageTitle = `${wiki}/Quotes/Overwatch_1`;
        process.stdout.write(`OW1 ${pageTitle}… `);
        let html;
        try {
            html = await fetchWikiPageHtml(pageTitle);
        } catch (error) {
            console.log(`skip (${error instanceof Error ? error.message : error})`);
            continue;
        }

        let sectionHtml;
        try {
            sectionHtml = extractInteractionsSection(html);
        } catch {
            console.log('no Interactions');
            continue;
        }

        const interactions = parseInteractionRows(sectionHtml);
        console.log(`${interactions.length} row(s)`);

        for (const interaction of interactions) {
            scanned += 1;
            if (opts.limit > 0 && imported >= opts.limit) break;

            const resolvedLines = (interaction.lines || []).map((line) => ({
                ...line,
                hero: resolveOw1Hero(line.hero, manifestHeroes),
                subtitles: String(line.subtitles || '').trim(),
            }));

            if (resolvedLines.length < 2) continue;
            const speakers = new Set(resolvedLines.map((l) => normalizeHeroKey(l.hero)));
            if (speakers.size < 2) continue;

            const texts = resolvedLines.map((l) => l.subtitles.toLowerCase()).join(' ');
            if (texts.includes('favorite animal')) continue;
            if (resolvedLines.some((l) => /one of the following/i.test(l.subtitles))) continue;

            const fp = interactionFingerprint(resolvedLines);
            if (!fp || fingerprints.has(fp) || importedThisRun.has(fp)) {
                skippedDup += 1;
                continue;
            }

            /** @type {Array<{ id: string, hero: string, voice: string, voicePrefix: string, subtitles: string, render: string }>} */
            const lines = [];

            for (const parsed of resolvedLines) {
                const hero = parsed.hero;
                const subtitles = parsed.subtitles;
                let voice = '';

                if (parsed.audioUrl && parsed.voiceFile) {
                    const dest = path.join(VOICELINES_DIR, parsed.voiceFile);
                    try {
                        const result = await downloadIfNeeded(parsed.audioUrl, dest, opts.dryRun);
                        if (result === 'downloaded' || result === 'would-download' || result === 'exists') {
                            voice = parsed.voiceFile;
                            wikiAudio += 1;
                            if (!voicelines.includes(voice)) voicelines.push(voice);
                        }
                    } catch (error) {
                        console.warn(
                            `  [wiki audio fail] ${parsed.voiceFile}: ${error instanceof Error ? error.message : error}`,
                        );
                    }
                }

                if (!voice) {
                    const resolved = resolveLineVoiceFile({ hero, subtitles }, voicelines);
                    if (resolved) {
                        voice = resolved;
                        existingAudio += 1;
                    }
                }

                if (!voice) {
                    const pool = matchTalkByHero.get(normalizeHeroKey(hero)) || [];
                    const hit = findMatchTalk(pool, subtitles);
                    if (hit) {
                        const dest = path.join(VOICELINES_DIR, hit.atlasName);
                        try {
                            await copyIfNeeded(hit.sourceOgg, dest, opts.dryRun);
                            voice = hit.atlasName;
                            matchTalkAudio += 1;
                            if (!voicelines.includes(voice)) voicelines.push(voice);
                        } catch (error) {
                            console.warn(
                                `  [matchtalk copy fail] ${hit.atlasName}: ${error instanceof Error ? error.message : error}`,
                            );
                        }
                    }
                }

                if (!voice) missingAudio += 1;

                lines.push({
                    id: createDialogueLineId(),
                    hero,
                    voice,
                    voicePrefix: '',
                    subtitles,
                    render: pickHeroicRender(hero, rendersMap),
                });
            }

            const conversation = buildBlankConversationRecord();
            conversation.name = String(nextConversationNumber(conversations));
            conversation.status = 'removed';
            conversation.eraName = '';
            conversation.tags = [DIALOGUE_THEATER_ERA_CLASSIC];
            conversation.scene = DEFAULT_DIALOGUE_SCENE;
            conversation.lines = lines;

            const parsedPaths = Array.isArray(interaction.paths) ? interaction.paths : [];
            if (parsedPaths.length >= 2) {
                /** @type {Array<{ id: string, label: string, lineIds: string[] }>} */
                const paths = [];
                for (const parsedPath of parsedPaths) {
                    const lineIndexes = Array.isArray(parsedPath.lineIndexes)
                        ? parsedPath.lineIndexes
                        : [];
                    const lineIds = lineIndexes
                        .filter((index) => Number.isInteger(index) && index >= 0 && index < lines.length)
                        .map((index) => lines[index].id);
                    if (!lineIds.length) continue;
                    paths.push({
                        id: createDialoguePathId(),
                        label: String(parsedPath.label || '').trim() || `Path ${paths.length + 1}`,
                        lineIds,
                    });
                }
                if (paths.length >= 2) {
                    conversation.paths = paths;
                    conversation.selectedPathId = paths[0].id;
                    conversation.tags = finalizeDialogueTheaterTags(
                        [DIALOGUE_THEATER_ERA_CLASSIC],
                        true,
                    );
                }
            }

            conversations.push(conversation);
            fingerprints.add(fp);
            importedThisRun.add(fp);
            imported += 1;

            const audioHit = lines.filter((l) => l.voice).length;
            console.log(
                `  [import] #${conversation.name} — ${lines.length} line(s), audio ${audioHit}/${lines.length}, partner ${interaction.partnerHero}`,
            );
        }

        if (opts.limit > 0 && imported >= opts.limit) break;
        await new Promise((r) => setTimeout(r, 200));
    }

    console.log('\n=== OW1 Classic import summary ===');
    console.log(
        JSON.stringify(
            {
                dryRun: opts.dryRun,
                scannedRows: scanned,
                imported,
                skippedDuplicates: skippedDup,
                wikiAudioAssignments: wikiAudio,
                matchTalkAssignments: matchTalkAudio,
                existingVoicelineAssignments: existingAudio,
                linesStillMissingAudio: missingAudio,
                existingEraFixedToOverwatch: eraFixed,
            },
            null,
            2,
        ),
    );

    if (opts.dryRun) {
        console.log('Dry run — conversations.json not written.');
        return;
    }

    await fsp.writeFile(
        CONVERSATIONS_PATH,
        `${JSON.stringify(
            {
                _meta: {
                    ...existingMeta,
                    ow1ClassicImportAt: new Date().toISOString(),
                },
                conversations,
            },
            null,
            2,
        )}\n`,
        'utf8',
    );

    const refreshed = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(refreshed, null, 2)}\n`, 'utf8');
    console.log(`Updated ${CONVERSATIONS_PATH}`);
    console.log(`Updated ${MANIFEST_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
