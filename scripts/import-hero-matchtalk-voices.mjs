#!/usr/bin/env node
/**
 * Import hero MatchTalk / Unknown .0B2 voicelines and wire theater conversation lines.
 *
 * Usage:
 *   node scripts/import-hero-matchtalk-voices.mjs --hero Orisa --hero Ramattra
 *   node scripts/import-hero-matchtalk-voices.mjs --hero Sojourn --dry-run
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import {
    normalizeSubtitlesForMatch,
    normalizeHeroKey,
    voicelineFilenameToSubtitles,
    isLikelyDialogueVoiceline,
} from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

const DEFAULT_EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');

/** @type {Record<string, string>} */
const HERO_FOLDER_ALIASES = {
    lucio: 'Lúcio',
    'soldier:76': 'Soldier: 76',
    'soldier76': 'Soldier: 76',
    'dva': 'D.Va',
    'wreckingball': 'Wrecking Ball',
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
 * @param {string} folderName
 * @returns {string}
 */
function heroFolderToFilenamePrefix(folderName) {
    return String(folderName || '').trim().replace(/ /g, '_');
}

/**
 * @param {string} folderName
 * @returns {string}
 */
function heroFolderToLineHero(folderName) {
    const key = normalizeHeroKey(folderName);
    return HERO_FOLDER_ALIASES[key] || String(folderName || '').trim();
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
 * @param {string} dir
 * @param {string} heroPrefix
 * @param {string} lineHero
 * @returns {Promise<Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, lineHero: string }>>}
 */
async function collectMatchTalkFiles(dir, heroPrefix, lineHero) {
    /** @type {Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, lineHero: string }>} */
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
            const atlasName = labelToAtlasFilename(heroPrefix, label);
            entries.push({
                label,
                sourceOgg: fullPath,
                atlasName,
                dialogueNorm: norm(label),
                lineHero,
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

    const aw = a.split(' ').filter((w) => w.length > 2);
    const bw = b.split(' ').filter((w) => w.length > 2);
    if (!aw.length || !bw.length) return false;

    const overlap = aw.filter((w) => bw.includes(w)).length;
    const minLen = Math.min(aw.length, bw.length);
    if (overlap < Math.max(3, Math.ceil(minLen * 0.75))) return false;

    const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return lengthRatio >= 0.45;
}

/**
 * @param {Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, lineHero: string }>} pool
 * @param {{ hero?: string, voice?: string, subtitles?: string }} line
 * @returns {{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, lineHero: string }|null}
 */
function matchLineToFile(pool, line) {
    const lineHeroKey = normalizeHeroKey(line?.hero || '');
    const heroPool = pool.filter((entry) => normalizeHeroKey(entry.lineHero) === lineHeroKey);
    if (!heroPool.length) return null;

    const voice = String(line?.voice || '').trim();
    if (voice) {
        const exactVoice = heroPool.find((entry) => entry.atlasName === voice);
        if (exactVoice) return exactVoice;
    }

    const cleanSub = stripDialogueSubtitleMarkup(String(line?.subtitles || '')).trim();
    const sfxOnly = /^\([^)]+\)$/.test(cleanSub) || (!cleanSub && /^\*\*[^*]+\*\*/.test(String(line?.subtitles || '').trim()));
    if (sfxOnly) return null;

    const dialoguePool = heroPool.filter((entry) => isLikelyDialogueVoiceline(entry.atlasName));
    if (!dialoguePool.length) return null;

    const lookupNorms = [
        normalizeSubtitlesForMatch(cleanSub).replace(/_/g, ' '),
        norm(cleanSub),
        voice ? norm(voicelineFilenameToSubtitles(voice)) : '',
    ].filter(Boolean);

    for (const key of lookupNorms) {
        const dialogueNorm = norm(key);
        const exact = dialoguePool.find((entry) => entry.dialogueNorm === dialogueNorm);
        if (exact) return exact;
    }
    if (lookupNorms.some((key) => norm(key).length < 12)) return null;
    for (const key of lookupNorms) {
        const dialogueNorm = norm(key);
        const fuzzy = dialoguePool.find((entry) => fuzzyMatch(entry.dialogueNorm, dialogueNorm));
        if (fuzzy) return fuzzy;
    }
    return null;
}

/**
 * @returns {string[]}
 */
function parseHeroArgs() {
    const heroes = [];
    const argv = process.argv.slice(2);
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--hero' && argv[i + 1]) {
            heroes.push(argv[i + 1]);
            i += 1;
        }
    }
    return heroes;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const heroes = parseHeroArgs();
    if (!heroes.length) {
        console.error('Provide at least one --hero "Orisa"');
        process.exit(1);
    }

    const extractRoot = process.argv.find((arg, i) => process.argv[i - 1] === '--extract') || DEFAULT_EXTRACT_ROOT;

    /** @type {Array<{ label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, lineHero: string }>} */
    const allFiles = [];

    for (const heroFolder of heroes) {
        const heroDir = path.join(extractRoot, heroFolder);
        if (!fs.existsSync(heroDir)) {
            console.warn(`Hero folder not found: ${heroDir}`);
            continue;
        }

        const heroPrefix = heroFolderToFilenamePrefix(heroFolder);
        const lineHero = heroFolderToLineHero(heroFolder);
        const scanDirs = ['MatchTalk']
            .map((sub) => path.join(heroDir, sub))
            .filter((dir) => fs.existsSync(dir));

        for (const dir of scanDirs) {
            allFiles.push(...(await collectMatchTalkFiles(dir, heroPrefix, lineHero)));
        }
    }

    const byAtlas = new Map();
    for (const entry of allFiles) {
        if (!byAtlas.has(entry.atlasName)) byAtlas.set(entry.atlasName, entry);
    }
    const uniqueFiles = [...byAtlas.values()];

    const convRaw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    /** @type {Array<{ conversation: string, subtitles: string, atlasName: string }>} */
    const wired = [];
    /** @type {Array<{ conversation: string, hero: string, subtitles: string }>} */
    const missing = [];

    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            const heroKey = normalizeHeroKey(line?.hero || '');
            const heroWanted = heroes.some((folder) => {
                const lineHero = heroFolderToLineHero(folder);
                return normalizeHeroKey(lineHero) === heroKey;
            });
            if (!heroWanted) continue;

            const hit = matchLineToFile(uniqueFiles, line);
            if (!hit) {
                if (String(line?.subtitles || '').trim()) {
                    missing.push({
                        conversation: conversation.name || conversation.id,
                        hero: String(line?.hero || ''),
                        subtitles: String(line?.subtitles || '').slice(0, 80),
                    });
                }
                continue;
            }

            wired.push({
                conversation: conversation.name || conversation.id,
                subtitles: String(line?.subtitles || '').slice(0, 80),
                atlasName: hit.atlasName,
            });
            line.voice = hit.atlasName;
        }
    }

    console.log(`MatchTalk 0B2 index: ${uniqueFiles.length}`);
    console.log(`Lines wired: ${wired.length}`);
    console.log(`Missing MatchTalk match: ${missing.length}`);

    if (missing.length) {
        console.log('\n--- Missing ---');
        for (const row of missing.slice(0, 40)) {
            console.log(`  [${row.conversation}] ${row.hero}: ${row.subtitles}`);
        }
        if (missing.length > 40) console.log(`  ... and ${missing.length - 40} more`);
    }

    if (dryRun) {
        console.log('\n(dry-run — no files copied)');
        return;
    }

    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    const toCopy = new Map();
    for (const row of wired) {
        const entry = uniqueFiles.find((file) => file.atlasName === row.atlasName);
        if (entry) toCopy.set(entry.atlasName, entry);
    }

    let copied = 0;
    for (const entry of toCopy.values()) {
        await fsp.copyFile(entry.sourceOgg, path.join(VOICELINES_DIR, entry.atlasName));
        copied += 1;
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(convRaw, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`\nCopied ${copied} oggs → ${VOICELINES_DIR}`);
    console.log('Updated conversations + manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
