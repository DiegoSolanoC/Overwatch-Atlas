#!/usr/bin/env node
/**
 * Import Match Start (+ SetupHere when useful) extract clips into Hero Chatter hubs.
 *
 * - Adds lines that are not already present (subtitle / voice core-key match)
 * - Copies .ogg files into Theater/Voicelines and refreshes theater-assets-manifest
 * - Handles labeled `.0B2-…` takes and sound-folder `.03F` packs (Jetpack Cat, etc.)
 *
 * Usage:
 *   node scripts/import-matchstart-chatters.mjs --dry-run
 *   node scripts/import-matchstart-chatters.mjs
 *   node scripts/import-matchstart-chatters.mjs --hero "Jetpack Cat"
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { DEFAULT_DIALOGUE_SCENE } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO, 'src/data/platform/manifest.json');
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const dryRun = process.argv.includes('--dry-run');
const heroArgIdx = process.argv.indexOf('--hero');
const onlyHero = heroArgIdx >= 0 ? String(process.argv[heroArgIdx + 1] || '').trim() : '';

/** Atlas hero id → extract folder name when they differ. */
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

/**
 * @param {string} text
 * @returns {string}
 */
function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\((korean|japanese|spanish|french|dutch|swedish|arabic|haitian creole|german|russian|portuguese|mandarin|chinese)\)/gi, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * Keep parenthetical sound labels (e.g. "(cat sounds) 2") distinct.
 * @param {string} text
 * @returns {string}
 */
function soundKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * @param {string} subtitles
 * @param {string} label
 * @param {boolean} isSound
 * @returns {string}
 */
function lineKey(subtitles, label, isSound) {
    if (isSound) return soundKey(label) || soundKey(subtitles);
    return coreKey(subtitles) || coreKey(label);
}

/**
 * @param {string} label
 * @returns {string}
 */
function cleanLabel(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
}

/**
 * @param {string} label
 * @returns {string}
 */
function labelToSubtitles(label) {
    let s = cleanLabel(label);
    s = s.replace(/^\(Korean\)\s*/i, '(Korean) ');
    s = s.replace(/^\(Japanese\)\s*/i, '(Japanese) ');
    s = s.replace(/^\(Swedish\)\s*/i, '(Swedish) ');
    s = s.replace(/\s+_([^_]+)_\s*/g, ' "$1" ');
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} heroId
 * @param {string} label
 * @returns {string}
 */
function atlasVoiceName(heroId, label) {
    const prefix = String(heroId || '')
        .trim()
        .replace(/:/g, '')
        .replace(/\s+/g, '_');
    const body = cleanLabel(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

/**
 * @param {string} heroId
 * @returns {string}
 */
function resolveExtractFolder(heroId) {
    if (HERO_EXTRACT_FOLDER[heroId]) return HERO_EXTRACT_FOLDER[heroId];
    const direct = path.join(EXTRACT_ROOT, heroId);
    if (fs.existsSync(direct)) return heroId;
    if (!fs.existsSync(EXTRACT_ROOT)) return heroId;
    const dirs = fs.readdirSync(EXTRACT_ROOT);
    const want = coreKey(heroId);
    const hit = dirs.find((d) => coreKey(d) === want);
    return hit || heroId;
}

/**
 * @param {string} heroFolder
 * @param {string} category MatchStartTalk | SetupHere
 * @returns {Array<{ label: string, source: string, kind: '0B2'|'03F', folderLabel: string }>}
 */
function listCategoryClips(heroFolder, category) {
    const dir = path.join(EXTRACT_ROOT, heroFolder, category);
    if (!fs.existsSync(dir)) return [];

    /** @type {Array<{ label: string, source: string, kind: '0B2'|'03F', folderLabel: string }>} */
    const out = [];

    /** @param {string} abs @param {string} folderLabel */
    function walk(abs, folderLabel) {
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
            const full = path.join(abs, ent.name);
            if (ent.isDirectory()) {
                walk(full, ent.name);
                continue;
            }
            if (!/\.ogg$/i.test(ent.name)) continue;

            const labeled = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            if (labeled) {
                out.push({
                    label: labeled[1],
                    source: full,
                    kind: '0B2',
                    folderLabel: folderLabel || '',
                });
                continue;
            }

            if (/\.03F/i.test(ent.name) && folderLabel) {
                out.push({
                    label: folderLabel,
                    source: full,
                    kind: '03F',
                    folderLabel,
                });
            }
        }
    }

    walk(dir, '');
    return out;
}

/**
 * Deduplicate sound-folder takes into numbered labels: "(cat sounds)", "(cat sounds) 2", …
 * Labeled 0B2 takes keep their dialogue label (first take wins on core key).
 *
 * @param {Array<{ label: string, source: string, kind: '0B2'|'03F', folderLabel: string }>} clips
 * @param {string} categoryTag short tag e.g. Match Start
 * @returns {Array<{ label: string, source: string, subtitles: string, isSound: boolean }>}
 */
function normalizeClipsForImport(clips, categoryTag) {
    /** @type {Array<{ label: string, source: string, subtitles: string, isSound: boolean }>} */
    const out = [];
    /** @type {Map<string, number>} */
    const soundCounts = new Map();
    /** @type {Set<string>} */
    const seenLabeled = new Set();

    for (const clip of clips) {
        if (clip.kind === '0B2') {
            const key = coreKey(clip.label);
            if (!key || seenLabeled.has(key)) continue;
            seenLabeled.add(key);
            const subtitles = labelToSubtitles(clip.label);
            out.push({ label: clip.label, source: clip.source, subtitles, isSound: false });
            continue;
        }

        // Sound folders — keep each take as its own chatter line; include
        // category in the label so Match Start / Set Up don't share filenames.
        const base = cleanLabel(clip.folderLabel || clip.label) || 'sounds';
        const n = (soundCounts.get(base) || 0) + 1;
        soundCounts.set(base, n);
        const label = n <= 1 ? `${categoryTag} ${base}` : `${categoryTag} ${base} ${n}`;
        const subtitles =
            n <= 1 ? `**${base}**` : `**${base}** (${categoryTag} ${n})`;
        out.push({ label, source: clip.source, subtitles, isSound: true });
    }

    return out;
}

/**
 * @param {string} atlasName
 * @param {string} sourceAbs
 */
async function copyTheater(atlasName, sourceAbs) {
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (dryRun) return atlasName;
    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    if (!fs.existsSync(dest)) {
        await fsp.copyFile(sourceAbs, dest);
    }
    return atlasName;
}

/**
 * @param {object} chatter
 * @param {string} heroId
 * @returns {Set<string>}
 */
function existingKeys(chatter, heroId) {
    const keys = new Set();
    for (const line of chatter.lines || []) {
        const subRaw = String(line?.subtitles || '').trim();
        // Register both keys so labeled dialogue and sound-pack lines dedupe correctly.
        const ck = coreKey(subRaw);
        const sk = soundKey(subRaw);
        if (ck) keys.add(ck);
        if (sk) keys.add(sk);
        const voice = String(line?.voice || '').trim();
        if (voice) {
            const base = voice.replace(/\.ogg$/i, '');
            const sep = base.indexOf('_-_');
            const dialogue = (sep >= 0 ? base.slice(sep + 3) : base).replace(/_/g, ' ');
            const vck = coreKey(dialogue);
            const vsk = soundKey(dialogue);
            if (vck) keys.add(vck);
            if (vsk) keys.add(vsk);
        }
    }
    void heroId;
    return keys;
}

/**
 * @param {string} heroId
 * @returns {object}
 */
function blankChatter(heroId) {
    return {
        id: chatterIdForHero(heroId),
        entryType: 'chatter',
        name: heroId,
        status: 'active',
        eraName: '',
        tags: [],
        scene: DEFAULT_DIALOGUE_SCENE,
        lines: [],
    };
}

async function main() {
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error(`Extract missing: ${EXTRACT_ROOT}`);
        process.exit(1);
    }

    const platform = JSON.parse(await fsp.readFile(MANIFEST_PATH, 'utf8'));
    /** @type {string[]} */
    const heroes = Array.isArray(platform.heroes) ? platform.heroes : [];
    const targetHeroes = onlyHero
        ? heroes.filter((h) => h.toLowerCase() === onlyHero.toLowerCase())
        : heroes;

    if (onlyHero && targetHeroes.length === 0) {
        console.error(`Hero not in manifest: ${onlyHero}`);
        process.exit(1);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    /** @type {object[]} */
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : [];
    const byId = new Map(conversations.map((c) => [c.id, c]));

    let heroesTouched = 0;
    let linesAdded = 0;
    let filesCopied = 0;
    /** @type {Array<{ hero: string, added: number, matchStart: number, setup: number }>} */
    const summary = [];

    for (const heroId of targetHeroes) {
        const folder = resolveExtractFolder(heroId);
        const matchStartRaw = listCategoryClips(folder, 'MatchStartTalk');
        const setupRaw = listCategoryClips(folder, 'SetupHere');

        // Sound-only packs (.03F under "(cat sounds)" etc.) only when the hero has
        // no labeled MatchStartTalk dialogue — otherwise we'd flood Wrecking Ball /
        // similar with dozens of squeak variants.
        const hasLabeledMatchStart = matchStartRaw.some((c) => c.kind === '0B2');
        const matchStartClips = hasLabeledMatchStart
            ? matchStartRaw.filter((c) => c.kind === '0B2')
            : matchStartRaw;
        const setupClips = hasLabeledMatchStart
            ? setupRaw.filter((c) => c.kind === '0B2')
            : setupRaw;

        const matchStart = normalizeClipsForImport(matchStartClips, 'Match Start');
        const setup = normalizeClipsForImport(setupClips, 'Set Up');

        /** Prefer Match Start first, then SetupHere extras not already keyed. */
        /** @type {Array<{ label: string, source: string, subtitles: string, isSound: boolean }>} */
        const pool = [];
        /** @type {Set<string>} */
        const poolKeys = new Set();
        for (const clip of [...matchStart, ...setup]) {
            const key = lineKey(clip.subtitles, clip.label, clip.isSound);
            if (!key || poolKeys.has(key)) continue;
            poolKeys.add(key);
            pool.push(clip);
        }

        if (pool.length === 0) continue;

        const chatterId = chatterIdForHero(heroId);
        let chatter = byId.get(chatterId);
        if (!chatter) {
            chatter = blankChatter(heroId);
            conversations.push(chatter);
            byId.set(chatterId, chatter);
        }
        if (!Array.isArray(chatter.lines)) chatter.lines = [];

        // Drop blank placeholder lines (empty subtitles + empty voice)
        const beforeLen = chatter.lines.length;
        chatter.lines = chatter.lines.filter(
            (line) => String(line?.subtitles || '').trim() || String(line?.voice || '').trim(),
        );
        const removedBlank = beforeLen - chatter.lines.length;

        const have = existingKeys(chatter, heroId);
        let added = 0;

        for (const clip of pool) {
            const key = lineKey(clip.subtitles, clip.label, clip.isSound);
            if (!key || have.has(key)) continue;

            const voice = atlasVoiceName(heroId, clip.label);
            const dest = path.join(VOICELINES_DIR, voice);
            const existed = fs.existsSync(dest);
            await copyTheater(voice, clip.source);
            if (!dryRun && !existed && fs.existsSync(dest)) filesCopied += 1;

            chatter.lines.push({
                id: randomUUID(),
                hero: heroId,
                voice,
                voicePrefix: '',
                subtitles: clip.subtitles,
                render: 'Heroic.png',
                era: 'Overwatch',
                status: 'active',
            });
            have.add(key);
            added += 1;
            linesAdded += 1;
        }

        if (added > 0 || removedBlank > 0) {
            heroesTouched += 1;
            summary.push({
                hero: heroId,
                added,
                matchStart: matchStart.length,
                setup: setup.length,
            });
            console.log(
                `${heroId}: +${added} (MatchStart ${matchStart.length}, SetupHere ${setup.length}` +
                    (removedBlank ? `, removed ${removedBlank} blank` : '') +
                    ')',
            );
        }
    }

    console.log(
        `\nHeroes touched: ${heroesTouched}, lines added: ${linesAdded}, files copied: ${filesCopied}`,
    );

    if (dryRun) {
        console.log('Dry run — no writes.');
        return;
    }

    if (linesAdded === 0 && heroesTouched === 0) {
        console.log('Nothing to write.');
        return;
    }

    raw.conversations = conversations;
    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Theater manifest refreshed (${assets.voicelines.length} voicelines).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
