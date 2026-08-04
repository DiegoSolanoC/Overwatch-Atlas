#!/usr/bin/env node
/**
 * Import Jetpack Cat MatchTalk voicelines and wire theater lines.
 *
 * Usage:
 *   node scripts/import-jetpack-cat-matchtalk.mjs
 *   node scripts/import-jetpack-cat-matchtalk.mjs --dry-run
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

const DEFAULT_EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    'Jetpack Cat',
);

const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');

/** @type {Record<string, string>} */
const SUBTITLE_SFX_TO_FOLDER = {
    'provoking meows': '(provoking meows)',
    'innocent meows': '(innocent meows)',
    'innocent meow': '(innocent meows)',
    'confused meows': '(confused meows)',
    'happy meows': '(happy meows)',
    'grumbling meows': '(grumbling meows)',
    'proud purring': '(proud purring)',
    'contented meows': '(contented meows)',
    'disappointed meows': '(disappointed meows)',
    'contented purrs': '(contented meowing)',
    'questioning meows': '(questioning meows)',
    'question meows': '(questioning meows)',
    'pouty meows': '(pouty meows)',
    'doubtful meows': '(doubtful meows)',
    'panicked meows': '(cat sounds)',
    'understanding meows': '(agreeing meows)',
    meows: '(meows)',
    'angry meow': '(angry meows)',
    'angry hiss': '(angry hiss)',
    hiss: '(hisses)',
    'eager meows': '(eager meows)',
    'eager meowing': '(eager meowing)',
    'enthusiastic meows': '(enthusiastic meows)',
    'enthusiastic meow': '(enthusiastic meows)',
    'affirmative meows': '(affirmative meows)',
    'affirmative meow': '(affirmative meows)',
    'agreeing meows': '(agreeing meows)',
    'agreeing meow': '(agreeing meows)',
    'placated meows': '(placated meows)',
};

/** @type {Record<string, string>} */
const PLAIN_TEXT_TO_FOLDER = {
    'meow meow!': '(meows)',
    'meow meow.': '(meows)',
    'meow? meow meow.': '(questioning meows)',
};

/**
 * @param {string} folderLabel
 * @returns {string}
 */
function folderLabelToAtlasFilename(folderLabel, variantIndex = 0) {
    const safe = String(folderLabel || '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    if (variantIndex <= 0) return `Jetpack_Cat_-_${safe}.ogg`;
    return `Jetpack_Cat_-_${safe}_(${variantIndex + 1}).ogg`;
}

/**
 * @param {string} subtitles
 * @returns {string}
 */
function resolveFolderLabel(subtitles) {
    const raw = String(subtitles || '').trim();
    const boldMatch = raw.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
        const key = boldMatch[1].trim().toLowerCase();
        if (SUBTITLE_SFX_TO_FOLDER[key]) return SUBTITLE_SFX_TO_FOLDER[key];
    }

    const italicParenMatch = raw.match(/^\*\(([^)]+)\)\*$/);
    if (italicParenMatch) {
        const key = italicParenMatch[1].trim().toLowerCase();
        if (SUBTITLE_SFX_TO_FOLDER[key]) return SUBTITLE_SFX_TO_FOLDER[key];
        return `(${key})`;
    }

    const plain = stripDialogueSubtitleMarkup(raw).trim().toLowerCase();
    if (PLAIN_TEXT_TO_FOLDER[plain]) return PLAIN_TEXT_TO_FOLDER[plain];
    if (SUBTITLE_SFX_TO_FOLDER[plain]) return SUBTITLE_SFX_TO_FOLDER[plain];
    if (/^\([^)]+\)$/.test(plain) && SUBTITLE_SFX_TO_FOLDER[plain.slice(1, -1)]) {
        return SUBTITLE_SFX_TO_FOLDER[plain.slice(1, -1)];
    }

    return '';
}

/**
 * @param {string} matchTalkDir
 * @returns {Promise<Map<string, { folderLabel: string, folderPath: string, oggs: string[] }>>}
 */
async function indexMatchTalkFolders(matchTalkDir) {
    /** @type {Map<string, { folderLabel: string, folderPath: string, oggs: string[] }>} */
    const index = new Map();

    for (const entry of await fsp.readdir(matchTalkDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const folderPath = path.join(matchTalkDir, entry.name);
        const oggs = (await fsp.readdir(folderPath))
            .filter((name) => /\.ogg$/i.test(name))
            .filter((name) => /\.03F\./i.test(name))
            .sort();
        if (oggs.length === 0) continue;
        index.set(entry.name, {
            folderLabel: entry.name,
            folderPath,
            oggs,
        });
    }

    return index;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const extractRoot = process.argv.find((arg, i) => process.argv[i - 1] === '--extract') || DEFAULT_EXTRACT;
    const matchTalkDir = path.join(extractRoot, 'MatchTalk');

    if (!fs.existsSync(matchTalkDir)) {
        console.error(`MatchTalk not found: ${matchTalkDir}`);
        process.exit(1);
    }

    const folders = await indexMatchTalkFolders(matchTalkDir);
    const convRaw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));

    /** @type {Map<string, number>} */
    const folderUseCount = new Map();
    /** @type {Array<{ conversation: string, subtitles: string, atlasName: string, source: string }>} */
    const planned = [];
    /** @type {Array<{ conversation: string, subtitles: string }>} */
    const missing = [];

    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            if (String(line?.hero || '').trim() !== 'Jetpack Cat') continue;
            if (String(line?.voice || '').trim()) continue;

            const folderLabel = resolveFolderLabel(line.subtitles || '');
            if (!folderLabel) {
                missing.push({
                    conversation: conversation.name || conversation.id,
                    subtitles: String(line.subtitles || '').slice(0, 80),
                });
                continue;
            }

            const folder = folders.get(folderLabel);
            if (!folder) {
                missing.push({
                    conversation: conversation.name || conversation.id,
                    subtitles: `${String(line.subtitles || '').slice(0, 60)} [no folder: ${folderLabel}]`,
                });
                continue;
            }

            const useIndex = folderUseCount.get(folderLabel) || 0;
            folderUseCount.set(folderLabel, useIndex + 1);
            const sourceOgg = path.join(folder.folderPath, folder.oggs[useIndex % folder.oggs.length]);
            const atlasName = folderLabelToAtlasFilename(folderLabel, useIndex);

            planned.push({
                conversation: conversation.name || conversation.id,
                subtitles: String(line.subtitles || '').slice(0, 60),
                atlasName,
                source: sourceOgg,
            });

            line.voice = atlasName;
        }
    }

    console.log(`MatchTalk folders indexed: ${folders.size}`);
    console.log(`Jetpack Cat lines to wire: ${planned.length}`);
    console.log(`Missing mapping: ${missing.length}`);

    if (missing.length) {
        console.log('\n--- Unmapped lines ---');
        for (const row of missing) {
            console.log(`  [${row.conversation}] ${row.subtitles}`);
        }
    }

    if (dryRun) {
        console.log('\n(dry-run — no files copied)');
        return;
    }

    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    const copiedNames = new Set();
    let copied = 0;

    for (const row of planned) {
        if (copiedNames.has(row.atlasName)) continue;
        copiedNames.add(row.atlasName);
        await fsp.copyFile(row.source, path.join(VOICELINES_DIR, row.atlasName));
        copied += 1;
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(convRaw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`\nCopied ${copied} Jetpack Cat oggs`);
    console.log('Updated conversations + manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
