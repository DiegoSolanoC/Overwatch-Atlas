#!/usr/bin/env node
/**
 * Import Wrecking Ball translator voicelines from MatchTalk / Unknown .0B2 root files.
 * These are the spoken English lines (voice), distinct from folder .03F hamster noises (voicePrefix).
 *
 * Usage:
 *   node scripts/import-wrecking-ball-translator-voices.mjs
 *   node scripts/import-wrecking-ball-translator-voices.mjs --dry-run
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import {
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
 * @param {string} label
 * @returns {string}
 */
function labelToTranslatorAtlasFilename(label) {
    const stripped = stripSfxPrefix(label);
    const safe = stripped.replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_');
    return `Wrecking_Ball_-_${safe}.ogg`;
}

/**
 * @param {string} dir
 * @returns {Promise<Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string }>>}
 */
async function collectTranslatorFiles(dir) {
    /** @type {Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string }>} */
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
                await walk(fullPath);
                continue;
            }
            if (!/\.ogg$/i.test(entry.name)) continue;
            if (!/\.0B2-/i.test(entry.name)) continue;

            const match = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
            if (!match) continue;

            const label = match[1];
            const atlasName = labelToTranslatorAtlasFilename(label);
            entries.push({
                label,
                sourceOgg: fullPath,
                atlasName,
                dialogueNorm: norm(stripSfxPrefix(label)),
            });
        }
    }

    await walk(dir);
    return entries;
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
 * @param {Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string }>} translators
 * @param {{ voice?: string, subtitles?: string }} line
 * @returns {{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string }|null}
 */
function matchTranslatorFile(translators, line) {
    const voice = String(line.voice || '').trim();
    if (voice) {
        const hit = translators.find((entry) => entry.atlasName === voice);
        if (hit) return hit;
    }

    const cleanSub = stripDialogueSubtitleMarkup(String(line.subtitles || '')).trim();
    const lookupNorms = [
        normalizeSubtitlesForMatch(cleanSub).replace(/_/g, ' '),
        norm(cleanSub),
        voice ? norm(stripSfxPrefix(voicelineFilenameToSubtitles(voice))) : '',
    ].filter(Boolean);

    for (const key of lookupNorms) {
        const dialogueNorm = norm(key);
        const exact = translators.find((entry) => entry.dialogueNorm === dialogueNorm);
        if (exact) return exact;
    }
    for (const key of lookupNorms) {
        const dialogueNorm = norm(key);
        const fuzzy = translators.find((entry) => fuzzyMatch(entry.dialogueNorm, dialogueNorm));
        if (fuzzy) return fuzzy;
    }
    return null;
}

/**
 * True when a translator ogg was overwritten with a hamster clip (same size as hamster base variant).
 * @param {string} atlasName
 * @returns {boolean}
 */
function isCorruptedTranslator(atlasName) {
    const { dialoguePart } = parseVoicelineFilename(atlasName);
    if (/^\([^)]+\)_/i.test(dialoguePart)) return false;

    const translatorPath = path.join(VOICELINES_DIR, atlasName);
    const hamsterPath = path.join(
        VOICELINES_DIR,
        `Wrecking_Ball_-_(hamster_noises)_${dialoguePart}.ogg`,
    );
    if (!fs.existsSync(translatorPath) || !fs.existsSync(hamsterPath)) return false;
    return fs.statSync(translatorPath).size === fs.statSync(hamsterPath).size;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const extractRoot = process.argv.find((arg, i) => process.argv[i - 1] === '--extract') || DEFAULT_EXTRACT;

    const scanDirs = [
        path.join(extractRoot, 'MatchTalk'),
        path.join(extractRoot, 'Unknown'),
    ].filter((dir) => fs.existsSync(dir));

    const translators = [];
    for (const dir of scanDirs) {
        translators.push(...(await collectTranslatorFiles(dir)));
    }

    const byAtlas = new Map();
    for (const entry of translators) {
        if (!byAtlas.has(entry.atlasName)) byAtlas.set(entry.atlasName, entry);
    }
    const uniqueTranslators = [...byAtlas.values()];

    const convRaw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    /** @type {Array<{ conversation: string, lineId: string, subtitles: string, voice: string, atlasName: string, sourceOgg: string, corrupted: boolean }>} */
    const planned = [];
    /** @type {Array<{ conversation: string, subtitles: string, voice: string }>} */
    const missing = [];

    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            if (String(line?.hero || '').trim() !== 'Wrecking Ball') continue;
            const voice = String(line?.voice || '').trim();
            if (!voice) continue;
            if (/^\([^)]+\)_/i.test(parseVoicelineFilename(voice).dialoguePart)) continue;

            const hit = matchTranslatorFile(uniqueTranslators, line);
            if (!hit) {
                missing.push({
                    conversation: conversation.name || conversation.id,
                    subtitles: String(line.subtitles || '').slice(0, 80),
                    voice,
                });
                continue;
            }

            const corrupted = isCorruptedTranslator(hit.atlasName);
            planned.push({
                conversation: conversation.name || conversation.id,
                lineId: line.id,
                subtitles: String(line.subtitles || '').slice(0, 80),
                voice,
                atlasName: hit.atlasName,
                sourceOgg: hit.sourceOgg,
                corrupted,
            });

            if (!line.voice || line.voice !== hit.atlasName) {
                line.voice = hit.atlasName;
            }
        }
    }

    const corruptedRows = planned.filter((row) => row.corrupted);
    console.log(`Translator 0B2 index: ${uniqueTranslators.length}`);
    console.log(`Theater lines to import/verify: ${planned.length}`);
    console.log(`Corrupted (hamster overwrote translator): ${corruptedRows.length}`);
    console.log(`Missing 0B2 match: ${missing.length}`);

    if (corruptedRows.length) {
        console.log('\n--- Restoring corrupted translators ---');
        for (const row of corruptedRows) {
            console.log(`  [${row.conversation}] ${row.atlasName}`);
        }
    }

    if (missing.length) {
        console.log('\n--- Missing translator 0B2 ---');
        for (const row of missing) {
            console.log(`  [${row.conversation}] ${row.subtitles}`);
            console.log(`    voice: ${row.voice}`);
        }
    }

    if (dryRun) {
        console.log('\n(dry-run — no files copied)');
        return;
    }

    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    let copied = 0;
    const copiedNames = new Set();

    for (const row of planned) {
        if (copiedNames.has(row.atlasName)) continue;
        copiedNames.add(row.atlasName);
        await fsp.copyFile(row.sourceOgg, path.join(VOICELINES_DIR, row.atlasName));
        copied += 1;
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(convRaw, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`\nCopied ${copied} translator oggs → ${VOICELINES_DIR}`);
    console.log('Updated conversations + manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
