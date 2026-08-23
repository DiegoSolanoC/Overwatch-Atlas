#!/usr/bin/env node
/**
 * Wire MatchTalk audio for YouTube placeholder conversation batches only.
 *
 * Usage:
 *   node scripts/wire-youtube-placeholder-matchtalk.mjs
 *   node scripts/wire-youtube-placeholder-matchtalk.mjs --dry-run
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import {
    normalizeSubtitlesForMatch,
    normalizeHeroKey,
    voicelineFilenameToSubtitles,
    isLikelyDialogueVoiceline,
} from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const DEFAULT_EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const TARGET_ERAS = new Set([
    'Midseason 3 (YouTube placeholder)',
    'Season 3 launch (YouTube placeholder)',
    'Season 4 (YouTube placeholder)',
]);

/** @type {Record<string, string>} */
const HERO_FOLDER_BY_LINE = {
    lucio: 'Lúcio',
    soldier76: 'Soldier_ 76',
    'soldier:76': 'Soldier_ 76',
    dva: 'D.Va',
    dmon: 'D.Mon',
    wreckingball: 'Wrecking Ball',
    junkerqueen: 'Junker Queen',
    jetpackcat: 'Jetpack Cat',
};

function norm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function heroFolderToFilenamePrefix(folderName) {
    return String(folderName || '')
        .trim()
        .replace(/ /g, '_')
        .replace(/_+/g, '_');
}

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
            if (!/\.ogg$/i.test(entry.name) || !/\.0B2-/i.test(entry.name)) continue;
            const match = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
            if (!match) continue;
            const label = match[1];
            const atlasName = `${heroPrefix}_-_${String(label)
                .replace(/[\\/:*?"<>|]/g, '')
                .replace(/ /g, '_')}.ogg`;
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

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const extractRoot =
        process.argv.find((arg, i) => process.argv[i - 1] === '--extract') || DEFAULT_EXTRACT_ROOT;

    if (!fs.existsSync(extractRoot)) {
        console.error(`HeroVoice root not found: ${extractRoot}`);
        process.exit(1);
    }

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
    const conversations = Array.isArray(convRaw.conversations) ? convRaw.conversations : convRaw;

    /** @type {Array<{ conversation: string, era: string, hero: string, atlasName: string, subtitles: string }>} */
    const wired = [];
    /** @type {Array<{ conversation: string, era: string, hero: string, subtitles: string }>} */
    const missing = [];
    /** @type {Map<string, { label: string, sourceOgg: string, atlasName: string }>} */
    const toCopy = new Map();

    let targetLines = 0;
    let alreadyHadVoice = 0;

    for (const conversation of conversations) {
        const era = String(conversation?.eraName || '').trim();
        if (!TARGET_ERAS.has(era)) continue;

        for (const line of conversation.lines || []) {
            if (!String(line?.subtitles || '').trim()) continue;
            targetLines += 1;

            if (String(line?.voice || '').trim()) {
                alreadyHadVoice += 1;
                // Still try to resolve a better MatchTalk take if missing on disk later — keep existing.
                continue;
            }

            const folder = resolveHeroFolder(String(line?.hero || ''), heroFolders);
            const folderKey = normalizeHeroKey(folder);
            const heroFiles = allFiles.filter(
                (entry) => normalizeHeroKey(entry.lineHero) === folderKey,
            );
            const hit = matchLineToFile(heroFiles, { ...line, hero: folder });
            if (!hit) {
                missing.push({
                    conversation: conversation.name || conversation.id,
                    era,
                    hero: String(line?.hero || ''),
                    subtitles: String(line?.subtitles || '').slice(0, 100),
                });
                continue;
            }

            line.voice = hit.atlasName;
            toCopy.set(hit.atlasName, hit);
            wired.push({
                conversation: conversation.name || conversation.id,
                era,
                hero: String(line?.hero || ''),
                atlasName: hit.atlasName,
                subtitles: String(line?.subtitles || '').slice(0, 80),
            });
        }
    }

    console.log(`MatchTalk index: ${allFiles.length}`);
    console.log(`Placeholder lines: ${targetLines}`);
    console.log(`Already had voice: ${alreadyHadVoice}`);
    console.log(`Newly wired: ${wired.length}`);
    console.log(`Still missing: ${missing.length}`);

    const byEra = {};
    for (const row of wired) {
        byEra[row.era] = (byEra[row.era] || 0) + 1;
    }
    console.log('Wired by era:', byEra);

    if (missing.length) {
        console.log('\n--- Still missing (sample) ---');
        for (const row of missing.slice(0, 40)) {
            console.log(`  [${row.conversation}] ${row.hero}: ${row.subtitles}`);
        }
        if (missing.length > 40) console.log(`  ... and ${missing.length - 40} more`);
    }

    if (dryRun) {
        console.log('\n(dry-run — no write)');
        return;
    }

    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    let copied = 0;
    for (const entry of toCopy.values()) {
        const dest = path.join(VOICELINES_DIR, entry.atlasName);
        try {
            await fsp.access(dest);
        } catch {
            await fsp.copyFile(entry.sourceOgg, dest);
            copied += 1;
        }
    }

    const payload = Array.isArray(convRaw.conversations)
        ? { ...convRaw, conversations }
        : conversations;
    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`\nCopied ${copied} new oggs`);
    console.log('Updated conversations + manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
