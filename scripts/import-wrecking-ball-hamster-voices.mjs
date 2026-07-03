#!/usr/bin/env node
/**
 * Import Wrecking Ball hamster-noise voicelines (MatchTalk folder .03F files)
 * and wire voicePrefix on theater lines. Translator stays in voice.
 *
 * Usage:
 *   node scripts/import-wrecking-ball-hamster-voices.mjs
 *   node scripts/import-wrecking-ball-hamster-voices.mjs --dry-run
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import {
    isWreckingBallHamsterOnlyLine,
    normalizeSubtitlesForMatch,
    parseVoicelineFilename,
    voicelineFilenameToSubtitles,
} from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

const DEFAULT_EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    'Wrecking Ball',
);

const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');

/** @type {Record<string, string>} */
const SUBTITLE_SFX_TO_GENERIC_FOLDER = {
    'hamster noises': '(hamster noises)',
    'hamster noise': '(hamster noises)',
    'angry squeaks': '(angry squeaks)',
    'scared hamster noises': '(unhappy hamster noises)',
    'scared hamster noise': '(unhappy hamster noises)',
    'bashful hamster noises': '(hamster noises)',
    squeaks: '(hamster squeaks)',
};

/**
 * @param {string} value
 * @returns {string}
 */
function norm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

/**
 * @param {string} name
 * @returns {string}
 */
function stripSfxPrefix(name) {
    return String(name || '')
        .replace(/^\(angry squeaks\)\s*/i, '')
        .replace(/^\(hamster noises\)\s*/i, '')
        .replace(/^\(angry squeaks\) \(Chinese\)_\s*/i, '')
        .replace(/^\(apologetic squeaks\)\s*/i, '')
        .replace(/^\(excited hamster squeaks\)\s*/i, '')
        .replace(/^\(hamster squeaks\)\s*/i, '')
        .replace(/^\(scared hamster noises\)\s*/i, '')
        .replace(/^\(unhappy hamster noises\)\s*/i, '')
        .replace(/^\(bashful hamster noises\)\s*/i, '')
        .trim();
}

/**
 * @param {string} folderLabel
 * @returns {boolean}
 */
function folderHasSfxPrefix(folderLabel) {
    return /^\([^)]+\)/i.test(String(folderLabel || '').trim());
}

/**
 * @param {string} dialoguePart
 * @returns {string}
 */
function stripHamsterDialoguePart(dialoguePart) {
    return String(dialoguePart || '')
        .replace(/^\(hamster_noises\)_/i, '')
        .replace(/_\(\d+\)$/i, '');
}

/**
 * @param {string} hamsterAtlasName
 * @returns {string}
 */
function translatorSiblingAtlasName(hamsterAtlasName) {
    const dialoguePart = parseVoicelineFilename(hamsterAtlasName).dialoguePart;
    const stripped = stripHamsterDialoguePart(dialoguePart);
    return `Wrecking_Ball_-_${stripped}.ogg`;
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function fileMd5(filePath) {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * @param {string} hamsterPath
 * @returns {boolean}
 */
function hamsterClipDuplicatesTranslator(hamsterPath) {
    const hamsterName = path.basename(hamsterPath);
    const translatorPath = path.join(VOICELINES_DIR, translatorSiblingAtlasName(hamsterName));
    if (!fs.existsSync(translatorPath)) return false;
    return fileMd5(hamsterPath) === fileMd5(translatorPath);
}

/**
 * Hamster .03F files get `(hamster_noises)_` when the MatchTalk folder has no SFX prefix,
 * so they never collide with translator .0B2 filenames.
 * @param {string} folderLabel
 * @param {number} [variantIndex=0]
 * @returns {string}
 */
function folderLabelToHamsterAtlasFilename(folderLabel, variantIndex = 0) {
    let dialoguePart;
    if (folderHasSfxPrefix(folderLabel)) {
        dialoguePart = String(folderLabel || '')
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/ /g, '_');
    } else {
        const stripped = stripSfxPrefix(folderLabel)
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/ /g, '_');
        dialoguePart = `(hamster_noises)_${stripped}`;
    }
    const suffix = variantIndex <= 0 ? '' : `_(${variantIndex + 1})`;
    return `Wrecking_Ball_-_${dialoguePart}${suffix}.ogg`;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function fuzzyMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const aw = a.split(' ').filter((w) => w.length > 3);
    const bw = b.split(' ').filter((w) => w.length > 3);
    if (!aw.length || !bw.length) return false;
    const overlap = aw.filter((w) => bw.includes(w)).length;
    return overlap >= Math.min(aw.length, bw.length) * 0.7;
}

/**
 * @param {string} dir
 * @returns {Promise<Array<{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOggs: Array<{ atlasName: string, sourceOgg: string }> }>>}
 */
async function collectHamsterFolders(dir) {
    /** @type {Array<{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOggs: Array<{ atlasName: string, sourceOgg: string }> }>} */
    const entries = [];

    async function walk(currentDir) {
        let dirents;
        try {
            dirents = await fsp.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of dirents) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                const oggs = (await fsp.readdir(fullPath))
                    .filter((name) => /\.ogg$/i.test(name))
                    .filter((name) => /\.03F\./i.test(name))
                    .sort();
                if (oggs.length > 0) {
                    const folderLabel = entry.name;
                    const sourceOggs = oggs.map((name, idx) => ({
                        atlasName: folderLabelToHamsterAtlasFilename(folderLabel, idx),
                        sourceOgg: path.join(fullPath, name),
                    }));
                    entries.push({
                        folderLabel,
                        folderPath: fullPath,
                        dialogueNorm: norm(stripSfxPrefix(folderLabel)),
                        atlasName: sourceOggs[0].atlasName,
                        sourceOggs,
                    });
                } else {
                    await walk(fullPath);
                }
            }
        }
    }

    await walk(dir);
    return entries;
}

/**
 * @param {string} subtitles
 * @returns {string}
 */
function subtitleSfxMarker(subtitles) {
    const match = String(subtitles || '').match(/^\*\*([^*]+)\*\*/);
    return match ? match[1].trim().toLowerCase() : '';
}

/**
 * @param {Array<{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOgg: string }>} folders
 * @param {string} folderLabel
 * @returns {{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOgg: string }|null}
 */
function findFolderByLabel(folders, folderLabel) {
    const target = norm(folderLabel);
    return folders.find((entry) => norm(entry.folderLabel) === target) || null;
}

/**
 * @param {Array<{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOgg: string }>} folders
 * @param {string} dialogueNorm
 * @returns {{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOgg: string }|null}
 */
function findFolderForDialogue(folders, dialogueNorm) {
    if (!dialogueNorm) return null;

    for (const entry of folders) {
        if (entry.dialogueNorm === dialogueNorm) return entry;
    }
    for (const entry of folders) {
        if (fuzzyMatch(entry.dialogueNorm, dialogueNorm)) return entry;
    }
    return null;
}

/**
 * @param {Array<{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOgg: string }>} folders
 * @param {{ voice?: string, subtitles?: string }} line
 * @returns {{ folderLabel: string, folderPath: string, dialogueNorm: string, atlasName: string, sourceOgg: string }|null}
 */
function matchHamsterFolder(folders, line) {
    if (isWreckingBallHamsterOnlyLine(line)) return null;

    const voice = String(line.voice || '').trim();
    const subtitles = String(line.subtitles || '').trim();
    const cleanSub = stripDialogueSubtitleMarkup(subtitles);
    const sfx = subtitleSfxMarker(subtitles);

    const lookupNorms = [
        normalizeSubtitlesForMatch(cleanSub).replace(/_/g, ' '),
        norm(cleanSub),
        voice ? norm(stripSfxPrefix(voicelineFilenameToSubtitles(voice))) : '',
        voice ? norm(voicelineFilenameToSubtitles(voice)) : '',
    ].filter(Boolean);

    for (const key of lookupNorms) {
        const dialogueNorm = norm(key);
        const hit = findFolderForDialogue(folders, dialogueNorm);
        if (hit) return hit;
    }

    if (sfx && cleanSub) {
        const variants = [
            `(${sfx}) ${cleanSub}`,
            SUBTITLE_SFX_TO_GENERIC_FOLDER[sfx]
                ? `${SUBTITLE_SFX_TO_GENERIC_FOLDER[sfx]} ${cleanSub}`
                : '',
        ].filter(Boolean);

        for (const label of variants) {
            const hit = findFolderByLabel(folders, label);
            if (hit) return hit;
        }
    }

    if (sfx && SUBTITLE_SFX_TO_GENERIC_FOLDER[sfx]) {
        const hit = findFolderByLabel(folders, SUBTITLE_SFX_TO_GENERIC_FOLDER[sfx]);
        if (hit) return hit;
    }

    return findFolderByLabel(folders, '(hamster noises)');
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const extractRoot = process.argv.find((arg, i) => process.argv[i - 1] === '--extract') || DEFAULT_EXTRACT;

    const matchTalkDir = path.join(extractRoot, 'MatchTalk');
    const unknownDir = path.join(extractRoot, 'Unknown');
    if (!fs.existsSync(matchTalkDir)) {
        console.error(`MatchTalk not found: ${matchTalkDir}`);
        process.exit(1);
    }

    const folders = [
        ...(await collectHamsterFolders(matchTalkDir)),
        ...(fs.existsSync(unknownDir) ? await collectHamsterFolders(unknownDir) : []),
    ];

    const convRaw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    /** @type {Array<{ conversation: string, lineId: string, subtitles: string, voice: string, folder: string, atlasName: string }>} */
    const planned = [];
    /** @type {Array<{ conversation: string, subtitles: string, voice: string }>} */
    const missing = [];

    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            if (String(line?.hero || '').trim() !== 'Wrecking Ball') continue;
            if (!String(line?.voice || '').trim()) continue;
            if (isWreckingBallHamsterOnlyLine(line)) continue;

            const folder = matchHamsterFolder(folders, line);
            if (!folder) {
                missing.push({
                    conversation: conversation.name || conversation.id,
                    subtitles: String(line.subtitles || '').slice(0, 80),
                    voice: String(line.voice || ''),
                });
                continue;
            }

            planned.push({
                conversation: conversation.name || conversation.id,
                lineId: line.id,
                subtitles: String(line.subtitles || '').slice(0, 80),
                voice: String(line.voice || ''),
                folder: folder.folderLabel,
                atlasName: folder.atlasName,
                sourceOggs: folder.sourceOggs,
            });

            line.voicePrefix = folder.atlasName;
        }
    }

    console.log(`Hamster folder index: ${folders.length}`);
    console.log(`Lines to wire: ${planned.length}`);
    console.log(`Missing hamster match: ${missing.length}`);

    if (missing.length) {
        console.log('\n--- Missing hamster folders ---');
        for (const row of missing) {
            console.log(`  [${row.conversation}] ${row.subtitles}`);
            console.log(`    translator: ${row.voice}`);
        }
    }

    if (dryRun) {
        console.log('\n(dry-run — no files copied)');
        return;
    }

    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    let copied = 0;
    let skippedDuplicate = 0;
    const copiedNames = new Set();
    /** @type {string[]} */
    const duplicateWarnings = [];

    for (const row of planned) {
        const variants = Array.isArray(row.sourceOggs) ? row.sourceOggs : [];
        for (const variant of variants) {
            if (copiedNames.has(variant.atlasName)) continue;
            const dialoguePart = variant.atlasName
                .replace(/^Wrecking_Ball_-_/i, '')
                .replace(/\.ogg$/i, '');
            // Never overwrite translator voice files — only copy SFX-prefixed hamster clips.
            if (!/^\([^)]+\)_/.test(dialoguePart)) continue;
            copiedNames.add(variant.atlasName);
            const dest = path.join(VOICELINES_DIR, variant.atlasName);
            await fsp.copyFile(variant.sourceOgg, dest);
            if (hamsterClipDuplicatesTranslator(dest)) {
                skippedDuplicate += 1;
                duplicateWarnings.push(variant.atlasName);
                await fsp.unlink(dest);
                continue;
            }
            copied += 1;
        }
    }

    if (duplicateWarnings.length) {
        console.log(`\nSkipped ${skippedDuplicate} hamster clips identical to translator:`);
        for (const name of duplicateWarnings.slice(0, 12)) {
            console.log(`  ${name}`);
        }
        if (duplicateWarnings.length > 12) {
            console.log(`  …and ${duplicateWarnings.length - 12} more`);
        }
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(convRaw, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`\nCopied ${copied} hamster oggs → ${VOICELINES_DIR}`);
    console.log(`Updated conversations + manifest`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
