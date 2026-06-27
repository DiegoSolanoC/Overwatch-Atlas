#!/usr/bin/env node
/**
 * Wire missing dialogue lines from HeroVoice MatchTalk only (strict subtitle match).
 * Skips lines that already resolve to an on-disk voiceline file.
 *
 * Usage:
 *   node scripts/bulk-wire-missing-matchtalk.mjs
 *   node scripts/bulk-wire-missing-matchtalk.mjs --dry-run
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

/** @type {Record<string, string>} normalized line hero → HeroVoice folder name */
const HERO_FOLDER_BY_LINE = {
    lucio: 'Lúcio',
    soldier76: 'Soldier_ 76',
    dva: 'D.Va',
    wreckingball: 'Wrecking Ball',
    junkerqueen: 'Junker Queen',
    emperorsigma: 'Sigma',
    infiniteannihilatorbastion: 'Bastion',
    infinitecaptainbrigitte: 'Brigitte',
    infiniteseermercy: 'Mercy',
    infiniteadmiralsojourn: 'Sojourn',
    infiniteguardsoldier: 'Soldier_ 76',
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

/** @param {string} value */
function collapseUnderscores(value) {
    return String(value || '').replace(/_+/g, '_');
}

/**
 * @param {string} folderName
 * @returns {string}
 */
function heroFolderToFilenamePrefix(folderName) {
    return String(folderName || '')
        .trim()
        .replace(/ /g, '_')
        .replace(/_+/g, '_');
}

/**
 * @param {string} lineHero
 * @param {string[]} heroFolders
 * @returns {string}
 */
function resolveHeroFolder(lineHero, heroFolders) {
    const key = normalizeHeroKey(lineHero);
    if (HERO_FOLDER_BY_LINE[key]) return HERO_FOLDER_BY_LINE[key];

    const exact = heroFolders.find((folder) => normalizeHeroKey(folder) === key);
    if (exact) return exact;

    const loose = heroFolders.find((folder) => {
        const fk = normalizeHeroKey(folder);
        return fk.includes(key) || key.includes(fk);
    });
    return loose || String(lineHero || '').trim();
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
            const atlasName = `${heroPrefix}_-_${String(label).replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_')}.ogg`;
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
    const sfxOnly =
        /^\([^)]+\)$/.test(cleanSub) ||
        (!cleanSub && /^\*\*[^*]+\*\*/.test(String(line?.subtitles || '').trim()));
    if (sfxOnly) return null;

    const dialoguePool = heroPool.filter((entry) => isLikelyDialogueVoiceline(entry.atlasName));
    if (!dialoguePool.length) return null;

    const targetMatch = normalizeSubtitlesForMatch(cleanSub);
    const lookupNorms = [
        targetMatch.replace(/_/g, ' '),
        norm(cleanSub),
        voice ? norm(voicelineFilenameToSubtitles(voice)) : '',
    ].filter(Boolean);

    for (const entry of dialoguePool) {
        const candidateMatch = normalizeSubtitlesForMatch(entry.label);
        if (candidateMatch && targetMatch && candidateMatch === targetMatch) return entry;
    }

    for (const key of lookupNorms) {
        const dialogueNorm = norm(key);
        const exact = dialoguePool.find((entry) => entry.dialogueNorm === dialogueNorm);
        if (exact) return exact;
    }

    for (const entry of dialoguePool) {
        const candidateMatch = normalizeSubtitlesForMatch(entry.label);
        if (!candidateMatch || candidateMatch.length < 4) continue;
        if (!targetMatch) continue;
        const targetKey = collapseUnderscores(targetMatch);
        const candidateKey = collapseUnderscores(candidateMatch);
        if (targetKey.includes(candidateKey) || candidateKey.includes(targetKey)) {
            const shorter = Math.min(targetKey.length, candidateKey.length);
            const longer = Math.max(targetKey.length, candidateKey.length);
            if (shorter >= 4 && (shorter === longer || shorter / longer >= 0.45)) return entry;
        }
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
 * @param {{ voice?: string }} line
 * @returns {boolean}
 */
function lineNeedsVoice(line) {
    const voice = String(line?.voice || '').trim();
    if (!voice) return true;
    return !fs.existsSync(path.join(VOICELINES_DIR, voice));
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const extractRoot = process.argv.find((arg, i) => process.argv[i - 1] === '--extract') || DEFAULT_EXTRACT_ROOT;

    const heroFolders = fs
        .readdirSync(extractRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);

    /** @type {Map<string, { label: string, sourceOgg: string, atlasName: string, dialogueNorm: string, lineHero: string }>} */
    const fileByAtlas = new Map();

    for (const folder of heroFolders) {
        const matchTalkDir = path.join(extractRoot, folder, 'MatchTalk');
        if (!fs.existsSync(matchTalkDir)) continue;

        const heroPrefix = heroFolderToFilenamePrefix(folder);
        const files = await collectMatchTalkFiles(matchTalkDir, heroPrefix, folder);
        for (const entry of files) {
            if (!fileByAtlas.has(entry.atlasName)) fileByAtlas.set(entry.atlasName, entry);
        }
    }

    const allFiles = [...fileByAtlas.values()];
    const convRaw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));

    /** @type {Array<{ conversation: string, hero: string, subtitles: string, atlasName: string, matchLabel: string }>} */
    const wired = [];
    /** @type {Array<{ conversation: string, hero: string, subtitles: string }>} */
    const stillMissing = [];

    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            if (!String(line?.subtitles || '').trim()) continue;
            if (!lineNeedsVoice(line)) continue;

            const folder = resolveHeroFolder(String(line?.hero || ''), heroFolders);
            const folderKey = normalizeHeroKey(folder);
            const heroFiles = allFiles.filter(
                (entry) => normalizeHeroKey(entry.lineHero) === folderKey,
            );

            const hit = matchLineToFile(heroFiles, {
                ...line,
                hero: folder,
            });

            if (!hit) {
                stillMissing.push({
                    conversation: conversation.name || conversation.id,
                    hero: String(line?.hero || ''),
                    subtitles: String(line?.subtitles || '').slice(0, 120),
                });
                continue;
            }

            wired.push({
                conversation: conversation.name || conversation.id,
                hero: String(line?.hero || ''),
                subtitles: String(line?.subtitles || '').slice(0, 120),
                atlasName: hit.atlasName,
                matchLabel: hit.label,
            });
            line.voice = hit.atlasName;
        }
    }

    console.log(`MatchTalk index: ${allFiles.length} unique files`);
    console.log(`Newly wired: ${wired.length}`);
    console.log(`Still missing: ${stillMissing.length}`);

    if (wired.length) {
        console.log('\n--- Wired ---');
        for (const row of wired) {
            console.log(`  [${row.conversation}] ${row.hero}`);
            console.log(`    → ${row.atlasName}`);
        }
    }

    if (stillMissing.length) {
        console.log('\n--- Still missing ---');
        for (const row of stillMissing) {
            console.log(`  [${row.conversation}] ${row.hero}: ${row.subtitles}`);
        }
    }

    if (dryRun) {
        console.log('\n(dry-run — no files written)');
        return;
    }

    if (wired.length === 0) {
        console.log('\nNo changes to write.');
        return;
    }

    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    const toCopy = new Map();
    for (const row of wired) {
        const entry = fileByAtlas.get(row.atlasName);
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

    console.log(`\nCopied ${copied} oggs → Voicelines/`);
    console.log('Updated conversations.json + theater-assets-manifest.json');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
