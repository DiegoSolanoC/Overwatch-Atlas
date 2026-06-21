#!/usr/bin/env node
/**
 * Import scraped interaction folders into Dialogue Theater conversations.
 *
 * Copies .ogg voicelines into src/assets/audio/Theater/Voicelines,
 * appends conversation records to conversations.json, and refreshes theater-assets-manifest.json.
 *
 * Usage:
 *   node scripts/import-interaction-folder.mjs "C:\Users\diego\OneDrive\Escritorio\interactions\anran"
 *   node scripts/import-interaction-folder.mjs ./interactions/anran --dry-run
 *   node scripts/import-interaction-folder.mjs ./interactions/anran --replace-names
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    createDialoguePathId,
    DEFAULT_DIALOGUE_SCENE,
    normalizeConversationRecord,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { heroNameForVoicelineMatch } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { nextConversationNumber, conversationVoiceFingerprint } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const IS_CLI = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');
const RENDERS_DIR = path.join(REPO_ROOT, 'src/assets/images/Theater/Renders');
const SCENES_DIR = path.join(REPO_ROOT, 'src/assets/images/Theater/Scene');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ batchDir: string, dryRun: boolean, replaceNames: boolean, skipExistingNames: boolean }} */
    const opts = {
        batchDir: '',
        dryRun: false,
        replaceNames: false,
        skipExistingNames: false,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (arg === '--replace-names') {
            opts.replaceNames = true;
            opts.skipExistingNames = false;
        } else if (arg === '--allow-duplicates') {
            opts.skipExistingNames = false;
        } else if (!arg.startsWith('-')) {
            opts.batchDir = arg;
        }
    }

    if (!opts.batchDir) {
        throw new Error(
            'Provide the scraped hero batch folder.\n\n' +
                'Example:\n' +
                '  node scripts/import-interaction-folder.mjs "C:\\Users\\diego\\OneDrive\\Escritorio\\interactions\\anran"',
        );
    }

    return opts;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeHeroKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]/g, '');
}

/**
 * @param {string} dirPath
 * @param {Set<string>} allowedExt
 * @returns {Promise<string[]>}
 */
async function listFilesInDir(dirPath, allowedExt) {
    try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((name) => allowedExt.has(path.extname(name).toLowerCase()))
            .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } catch {
        return [];
    }
}

/**
 * @returns {Promise<{ scenes: string[], voicelines: string[], renders: Record<string, string[]> }>}
 */
export async function scanTheaterAssets() {
    const scenes = await listFilesInDir(SCENES_DIR, IMAGE_EXT);
    /** @type {Record<string, string[]>} */
    const renders = {};

    try {
        const heroDirs = await fs.readdir(RENDERS_DIR, { withFileTypes: true });
        for (const entry of heroDirs) {
            if (!entry.isDirectory()) continue;
            const files = await listFilesInDir(path.join(RENDERS_DIR, entry.name), IMAGE_EXT);
            if (files.length > 0) renders[entry.name] = files;
        }
    } catch {
        /* no renders root */
    }

    /** @type {string[]} */
    const voicelines = [];
    async function walkVoicelines(dir, prefix) {
        let entries = [];
        try {
            entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkVoicelines(full, rel);
            } else if (entry.isFile() && AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
                voicelines.push(rel.replace(/\\/g, '/'));
            }
        }
    }
    await walkVoicelines(VOICELINES_DIR, '');

    return {
        scenes,
        voicelines: voicelines.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
        renders,
    };
}

/**
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
function resolveRenderHeroFolder(heroName, rendersMap) {
    const trimmed = String(heroName || '').trim();
    if (!trimmed || !rendersMap || typeof rendersMap !== 'object') return '';

    if (Array.isArray(rendersMap[trimmed]) && rendersMap[trimmed].length > 0) {
        return trimmed;
    }

    const target = normalizeHeroKey(trimmed);
    if (!target) return '';

    for (const key of Object.keys(rendersMap)) {
        if (!Array.isArray(rendersMap[key]) || rendersMap[key].length === 0) continue;
        if (key.toLowerCase() === trimmed.toLowerCase()) return key;
        if (normalizeHeroKey(key) === target) return key;
    }

    return '';
}

/**
 * Heroic.png when present; otherwise leave blank (no Classic fallback).
 *
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 * @returns {string}
 */
function pickHeroicRenderForHero(heroName, rendersMap) {
    const folder = resolveRenderHeroFolder(heroName, rendersMap);
    if (!folder) return '';

    const files = rendersMap[folder] || [];
    const heroic = files.find((file) => file.toLowerCase() === 'heroic.png');
    return heroic || '';
}

/**
 * @param {string} folderName
 * @returns {number}
 */
function folderSortKey(folderName) {
    const match = folderName.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

/**
 * @param {string} batchDir
 * @returns {string}
 */
function batchTitlePrefix(batchDir) {
    const base = path.basename(batchDir).trim();
    if (!base) return '';

    const key = base
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');

    /** @type {Record<string, string>} */
    const known = {
        lucio: 'Lúcio',
        anran: '',
    };

    if (Object.prototype.hasOwnProperty.call(known, key)) {
        return known[key];
    }

    return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * @param {string} folderName
 * @param {string} [prefix]
 * @returns {string}
 */
function conversationTitleFromFolderName(folderName, prefix = '') {
    const match = folderName.match(/^(\d+)/);
    const num = match ? String(parseInt(match[1], 10)) : folderName;
    const trimmedPrefix = String(prefix || '').trim();
    return trimmedPrefix ? `${trimmedPrefix} ${num}` : num;
}

/**
 * @param {string} value
 * @param {number} maxLen
 * @returns {string}
 */
function truncateTitle(value, maxLen = 56) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (trimmed.length <= maxLen) return trimmed;
    return `${trimmed.slice(0, maxLen - 1).trim()}…`;
}

/**
 * Prefer a short subtitle snippet; fall back to numbered folder title.
 *
 * @param {Record<string, unknown>|null|undefined} manifest
 * @param {string} folderName
 * @param {string} [prefix]
 * @returns {string}
 */
function conversationTitleFromManifest(manifest, folderName, prefix = '') {
    const lines = Array.isArray(manifest?.lines) ? manifest.lines : [];
    const firstSubtitles = lines
        .map((line) => String(line?.subtitles || '').trim())
        .find(Boolean);

    if (firstSubtitles) {
        const sentence = firstSubtitles.split(/(?<=[.!?])\s+/)[0]?.trim() || firstSubtitles;
        const title = truncateTitle(sentence.replace(/\*([^*]+)\*/g, '$1'));
        if (title) return title;
    }

    const partnerHero = String(manifest?.partnerHero || '').trim();
    const pageHero = String(manifest?.pageHero || prefix || '').trim();
    if (partnerHero && pageHero) {
        return truncateTitle(`${pageHero} & ${partnerHero}`, 64);
    }

    return conversationTitleFromFolderName(folderName, prefix);
}

/**
 * @param {Array<{ voice?: string }>} lines
 * @returns {string}
 */
export function voiceFingerprintFromLines(lines) {
    return conversationVoiceFingerprint(lines);
}

/**
 * @param {Record<string, unknown>|null|undefined} manifest
 * @returns {string}
 */
export function voiceFingerprintFromManifest(manifest) {
    const lines = Array.isArray(manifest?.lines) ? manifest.lines : [];
    return voiceFingerprintFromLines(
        lines.map((line) => ({ voice: String(line?.voiceFile || line?.voice || '').trim() })),
    );
}

/**
 * @param {string} batchDir
 * @param {string[]} folderNames
 * @returns {Promise<string[]>}
 */
async function dedupeInteractionFoldersByNumber(batchDir, folderNames) {
    /** @type {Map<number, { name: string, scrapedAt: number }>} */
    const byNumber = new Map();

    for (const name of folderNames) {
        const num = folderSortKey(name);
        if (num === Number.MAX_SAFE_INTEGER) continue;

        let scrapedAt = 0;
        try {
            const manifest = JSON.parse(
                await fs.readFile(path.join(batchDir, name, 'interaction.json'), 'utf8'),
            );
            const parsed = Date.parse(String(manifest?.scrapedAt || ''));
            if (Number.isFinite(parsed)) scrapedAt = parsed;
        } catch {
            /* keep scrapedAt 0 */
        }

        const prev = byNumber.get(num);
        if (!prev || scrapedAt >= prev.scrapedAt) {
            byNumber.set(num, { name, scrapedAt });
        }
    }

    return [...byNumber.values()]
        .map((entry) => entry.name)
        .sort((a, b) => folderSortKey(a) - folderSortKey(b));
}

/**
 * @param {string} batchDir
 * @returns {Promise<string[]>}
 */
async function listInteractionFolders(batchDir) {
    const entries = await fs.readdir(batchDir, { withFileTypes: true });
    const folderNames = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
        .map((entry) => entry.name);

    const deduped = await dedupeInteractionFoldersByNumber(batchDir, folderNames);
    if (deduped.length < folderNames.length) {
        console.log(
            `Deduped ${folderNames.length - deduped.length} duplicate numbered folder(s) from repeated scrapes.`,
        );
    }
    return deduped;
}

/**
 * @param {string} interactionDir
 * @param {Record<string, string[]>} rendersMap
 * @param {string|number} conversationName
 * @returns {Promise<import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation|null>}
 */
async function buildConversationFromFolder(interactionDir, rendersMap, conversationName) {
    const manifestHeroes = await loadManifestHeroIds();
    const manifestPath = path.join(interactionDir, 'interaction.json');
    let manifest;
    try {
        manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch {
        console.warn(`  Skipping ${path.basename(interactionDir)} — no interaction.json`);
        return null;
    }

    const folderName = path.basename(interactionDir);
    const conversation = buildBlankConversationRecord();
    conversation.name = String(conversationName);
    conversation.status = 'active';
    conversation.eraName = '';
    conversation.scene = DEFAULT_DIALOGUE_SCENE;

    const rawLines = Array.isArray(manifest.lines) ? manifest.lines : [];
    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation['lines']} */
    const lines = [];

    for (const rawLine of rawLines) {
        const hero = resolveManifestHeroId(
            heroNameForVoicelineMatch(String(rawLine?.hero || '').trim()),
            manifestHeroes,
        );
        const subtitles = String(rawLine?.subtitles || '').trim();
        const voiceFile = String(rawLine?.voiceFile || '').trim();
        const localVoicePath = voiceFile ? path.join(interactionDir, voiceFile) : '';

        let voice = '';
        if (voiceFile) {
            try {
                await fs.access(localVoicePath);
                voice = voiceFile;
            } catch {
                if (!rawLine?.audioMissing) {
                    console.warn(`  Missing local voiceline in ${folderName}: ${voiceFile}`);
                }
            }
        }

        lines.push({
            id: createDialogueLineId(),
            hero,
            voice,
            subtitles,
            render: pickHeroicRenderForHero(hero, rendersMap),
        });
    }

    if (lines.length === 0) {
        console.warn(`  Skipping ${folderName} — no dialogue lines`);
        return null;
    }

    conversation.lines = lines;

    const rawPaths = Array.isArray(manifest.paths) ? manifest.paths : [];
    if (rawPaths.length > 0) {
        /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} */
        const paths = [];

        for (const rawPath of rawPaths) {
            const lineIndexes = Array.isArray(rawPath?.lineIndexes)
                ? rawPath.lineIndexes.filter((index) => Number.isInteger(index) && index >= 0 && index < lines.length)
                : [];
            if (lineIndexes.length === 0) continue;

            paths.push({
                id: createDialoguePathId(),
                label: String(rawPath?.label || '').trim() || `Path ${paths.length + 1}`,
                lineIds: lineIndexes.map((index) => lines[index].id),
            });
        }

        if (paths.length > 0) {
            conversation.paths = paths;
            conversation.selectedPathId = paths[0].id;
        }
    }

    return conversation;
}

/**
 * @returns {Promise<import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]>}
 */
async function readConversationsFile() {
    try {
        const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
        const rows = Array.isArray(raw?.conversations) ? raw.conversations : [];
        return rows
            .map((row, index) => normalizeConversationRecord(row, `imported-${index}`))
            .filter(Boolean);
    } catch {
        return [];
    }
}

/**
 * @param {string} interactionDir
 * @param {boolean} dryRun
 * @returns {Promise<{ copied: number, skipped: number }>}
 */
async function copyVoicelinesFromInteractionFolder(interactionDir, dryRun) {
    let copied = 0;
    let skipped = 0;
    const files = await listFilesInDir(interactionDir, AUDIO_EXT);
    for (const file of files) {
        const src = path.join(interactionDir, file);
        const dest = path.join(VOICELINES_DIR, file);
        const result = await copyVoicelineIfNeeded(src, dest, dryRun);
        if (result === 'copied' || result === 'would-copy') copied += 1;
        if (result === 'skipped-existing') skipped += 1;
    }
    return { copied, skipped };
}

/**
 * @param {string} src
 * @param {string} dest
 * @param {boolean} dryRun
 */
async function copyVoicelineIfNeeded(src, dest, dryRun) {
    try {
        await fs.access(dest);
        return 'skipped-existing';
    } catch {
        /* copy */
    }

    if (dryRun) return 'would-copy';

    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
    return 'copied';
}

/**
 * @typedef {object} ImportBatchContext
 * @property {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} existingConversations
 * @property {Set<string>} existingNames
 * @property {Set<string>} voiceFingerprints
 * @property {Record<string, string[]>} rendersMap
 */

/**
 * @returns {Promise<ImportBatchContext>}
 */
export async function createImportBatchContext() {
    const assets = await scanTheaterAssets();
    const existingConversations = await readConversationsFile();
    const existingNames = new Set(existingConversations.map((row) => row.name));
    const voiceFingerprints = new Set(
        existingConversations
            .map((row) => voiceFingerprintFromLines(row.lines || []))
            .filter(Boolean),
    );

    return {
        existingConversations,
        existingNames,
        voiceFingerprints,
        rendersMap: assets.renders,
    };
}

/**
 * @param {string} batchDir
 * @param {ImportBatchContext} context
 * @param {{ dryRun?: boolean, replaceNames?: boolean, skipExistingNames?: boolean, skipVoiceDuplicates?: boolean }} [options]
 * @returns {Promise<{ imported: import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[], copiedVoicelines: number, skippedVoicelines: number, skippedFolders: number }>}
 */
export async function importInteractionBatch(batchDir, context, options = {}) {
    const opts = {
        dryRun: Boolean(options.dryRun),
        replaceNames: Boolean(options.replaceNames),
        skipExistingNames: options.skipExistingNames !== false,
        skipVoiceDuplicates: options.skipVoiceDuplicates !== false,
    };

    const interactionFolders = await listInteractionFolders(batchDir);

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} */
    const imported = [];
    let copiedVoicelines = 0;
    let skippedVoicelines = 0;
    let skippedFolders = 0;
    let nextNumber = nextConversationNumber(context.existingConversations);

    for (const folderName of interactionFolders) {
        const interactionDir = path.join(batchDir, folderName);
        let manifest;
        try {
            manifest = JSON.parse(await fs.readFile(path.join(interactionDir, 'interaction.json'), 'utf8'));
        } catch {
            skippedFolders += 1;
            continue;
        }

        const fingerprint = voiceFingerprintFromManifest(manifest);

        if (opts.skipVoiceDuplicates && fingerprint && context.voiceFingerprints.has(fingerprint)) {
            const label = conversationTitleFromManifest(manifest, folderName, '');
            const voiceCopy = await copyVoicelinesFromInteractionFolder(interactionDir, opts.dryRun);
            copiedVoicelines += voiceCopy.copied;
            skippedVoicelines += voiceCopy.skipped;
            if (voiceCopy.copied > 0) {
                console.log(
                    `[skip+voicelines] ${folderName} — duplicate (${label}); copied ${voiceCopy.copied} missing file(s)`,
                );
            } else {
                console.log(`[skip] ${folderName} — duplicate voicelines (${label})`);
            }
            skippedFolders += 1;
            continue;
        }

        const conversationName = String(nextNumber);
        nextNumber += 1;

        const conversation = await buildConversationFromFolder(
            interactionDir,
            context.rendersMap,
            conversationName,
        );
        if (!conversation) {
            skippedFolders += 1;
            continue;
        }

        console.log(`[import] ${folderName} → "${conversation.name}" (${conversation.lines.length} lines)`);

        for (const line of conversation.lines) {
            if (!line.voice) continue;
            const src = path.join(interactionDir, line.voice);
            const dest = path.join(VOICELINES_DIR, line.voice);
            const result = await copyVoicelineIfNeeded(src, dest, opts.dryRun);
            if (result === 'copied' || result === 'would-copy') copiedVoicelines += 1;
            if (result === 'skipped-existing') skippedVoicelines += 1;
        }

        imported.push(conversation);
        context.existingNames.add(conversation.name);
        if (fingerprint) context.voiceFingerprints.add(fingerprint);
    }

    return { imported, copiedVoicelines, skippedVoicelines, skippedFolders };
}

/**
 * @param {ImportBatchContext} context
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} imported
 * @param {{ dryRun?: boolean, replaceNames?: boolean }} [options]
 */
export async function persistImportedConversations(context, imported, options = {}) {
    if (imported.length === 0) return;

    let nextConversations = [...context.existingConversations];
    if (options.replaceNames) {
        const importedNames = new Set(imported.map((row) => row.name));
        nextConversations = nextConversations.filter((row) => !importedNames.has(row.name));
    }
    nextConversations.push(...imported);
    context.existingConversations = nextConversations;

    if (options.dryRun) return;

    await fs.mkdir(path.dirname(CONVERSATIONS_PATH), { recursive: true });
    await fs.writeFile(
        CONVERSATIONS_PATH,
        `${JSON.stringify({ conversations: nextConversations }, null, 2)}\n`,
        'utf8',
    );

    const assets = await scanTheaterAssets();
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
}

async function main() {
    const opts = parseArgs(process.argv);
    const batchDir = path.resolve(opts.batchDir);

    try {
        const stat = await fs.stat(batchDir);
        if (!stat.isDirectory()) throw new Error('Not a directory');
    } catch {
        throw new Error(`Batch folder not found: ${batchDir}`);
    }

    const interactionFolders = await listInteractionFolders(batchDir);
    if (interactionFolders.length === 0) {
        throw new Error(`No interaction folders found in ${batchDir}`);
    }

    const context = await createImportBatchContext();

    console.log(`Batch folder: ${batchDir}`);
    console.log(`Interaction folders: ${interactionFolders.length}`);
    console.log(`Dry run: ${opts.dryRun ? 'yes' : 'no'}\n`);

    const { imported, copiedVoicelines, skippedVoicelines } = await importInteractionBatch(
        batchDir,
        context,
        opts,
    );

    if (imported.length === 0) {
        console.log('\nNothing imported.');
        return;
    }

    await persistImportedConversations(context, imported, opts);

    console.log(`\nImported conversations: ${imported.length}`);
    console.log(`Voicelines copied: ${copiedVoicelines}`);
    console.log(`Voicelines already present: ${skippedVoicelines}`);
    if (!opts.dryRun) {
        console.log(`Updated: ${CONVERSATIONS_PATH}`);
        console.log(`Updated: ${MANIFEST_PATH}`);
    }
}

if (IS_CLI) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
