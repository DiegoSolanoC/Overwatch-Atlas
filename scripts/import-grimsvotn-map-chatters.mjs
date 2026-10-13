#!/usr/bin/env node
/**
 * Import Season 5 Watchpoint: Grímsvötn map chatter from HeroVoice extract.
 *
 * Wiki Map-Specific tables do not list the prison yet; lines are curated from the
 * s4.5/s5 extract (prison / Helix / "here" / Grímsvötn by name) and tagged with
 * the same disclaimer shape as other Watchpoint maps (e.g. Watchpoint: Gibraltar).
 *
 * Usage:
 *   node scripts/import-grimsvotn-map-chatters.mjs --dry-run
 *   node scripts/import-grimsvotn-map-chatters.mjs
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
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const MAP_DISCLAIMER = 'Watchpoint: Grímsvötn';
const dryRun = process.argv.includes('--dry-run');

/**
 * Curated extract paths → spoken label needle (matched against .0B2- label).
 * @type {Array<{ hero: string, folder: string, needle: string, subtitles?: string }>}
 */
const LINES = [
    {
        hero: 'Ana',
        folder: 'MatchTalk',
        needle: "I hope Doomfist knows the chaos he's unleashed",
    },
    {
        hero: 'Doctrine',
        folder: 'MatchTalk',
        needle: 'This prison could not confine my genius',
        subtitles:
            'This prison could not confine my genius... Now, it is a palace of my design.',
    },
    {
        hero: 'Doctrine',
        folder: 'MatchTalk',
        needle: 'Mortality will not imprison me',
    },
    {
        hero: 'Doctrine',
        folder: 'MatchTalk',
        needle: 'Pray tell, how did you twist yourself free of your confinement',
    },
    {
        hero: 'Doctrine',
        folder: 'MatchTalk',
        needle: "How breathtaking it was, bearing witness to the Widowmaker's work in my first moments of freedom",
    },
    {
        hero: 'Doomfist',
        folder: 'MatchTalk',
        needle: "I've found this facility more pleasant outside a cell",
    },
    {
        hero: 'Reaper',
        folder: 'MatchTalk',
        needle: 'Akande was right about what he said here',
        subtitles:
            'Akande was right about what he said here. All that red tape really was holding me back.',
    },
    {
        hero: 'Sierra',
        folder: 'MatchTalk',
        needle: "Some of Helix's best agents stationed here",
        subtitles:
            "Some of Helix's best agents stationed here, and they still couldn't keep Doomfist in... or out.",
    },
    {
        hero: 'Sierra',
        folder: 'MatchTalk',
        needle: "You'll be behind bars for the rest of your days once Helix catches up to you",
    },
    {
        hero: 'Sierra',
        folder: 'MatchTalk',
        needle: 'this place really got torn up',
        subtitles: 'Dang... this place really got torn up.',
    },
    {
        hero: 'Sierra',
        folder: 'MatchTalk',
        needle: 'this place is downright homey',
        subtitles: "Never been much for settling down, but this place is downright homey!",
    },
    {
        hero: 'Sombra',
        folder: 'MatchTalk',
        needle: 'cracking open Grímsvötn',
        subtitles:
            "I know stopping Vendetta's priority one, but cracking open Grímsvötn feels a little... drastic.",
    },
    {
        hero: 'Sombra',
        folder: 'MatchTalk',
        needle: "just because I broke you out of jail doesn't mean we're friends",
        subtitles: "Listen, just because I broke you out of jail doesn't mean we're friends.",
    },
    {
        hero: 'Widowmaker',
        folder: 'MatchTalk',
        needle: 'Such a brutal place',
        subtitles:
            "Such a brutal place... but still better than the Bartalotti's gauche decor.",
    },
];

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function cleanLabel(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
}

function labelToSubtitles(label) {
    let s = cleanLabel(label);
    s = s.replace(/\s+_([^_]+)_\s*/g, ' "$1" ');
    return s.replace(/\s+/g, ' ').trim();
}

function atlasVoiceName(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = cleanLabel(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

/**
 * @param {string} hero
 * @param {string} folder
 * @param {string} needle
 */
function findExtractClip(hero, folder, needle) {
    const dir = path.join(EXTRACT_ROOT, hero, folder);
    if (!fs.existsSync(dir)) return null;
    const want = coreKey(needle);
    if (!want) return null;

    /** @type {{ source: string, label: string, score: number } | null} */
    let best = null;
    const walk = (abs) => {
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
            const full = path.join(abs, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            const m = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            if (!m) continue;
            const label = m[1];
            const k = coreKey(label);
            if (!k) continue;
            let score = 0;
            if (k === want) score = 100;
            else if (k.includes(want) || want.includes(k)) score = 70;
            if (!score) continue;
            if (!best || score > best.score) best = { source: full, label, score };
        }
    };
    walk(dir);
    return best;
}

async function copyTheater(atlasName, sourceAbs) {
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (dryRun) return false;
    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    if (!fs.existsSync(dest)) {
        await fsp.copyFile(sourceAbs, dest);
        return true;
    }
    return false;
}

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
    const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    if (!Array.isArray(data.conversations)) data.conversations = [];

    let added = 0;
    let skipped = 0;
    let missing = 0;
    let copied = 0;

    for (const spec of LINES) {
        const hit = findExtractClip(spec.hero, spec.folder, spec.needle);
        if (!hit) {
            console.warn(`MISSING audio: ${spec.hero} — ${spec.needle}`);
            missing += 1;
            continue;
        }

        const subtitles = spec.subtitles || labelToSubtitles(hit.label);
        const key = coreKey(subtitles);
        const chatterId = chatterIdForHero(spec.hero);
        let chatter = data.conversations.find((c) => c.id === chatterId);
        if (!chatter) {
            chatter = blankChatter(spec.hero);
            data.conversations.push(chatter);
        }
        if (!Array.isArray(chatter.lines)) chatter.lines = [];

        const already = chatter.lines.some((line) => {
            const sameText = coreKey(line.subtitles) === key;
            const sameMap = String(line.disclaimer || '') === MAP_DISCLAIMER;
            return sameText && sameMap;
        });
        // Also skip if same text already tagged as this map under a longer disclaimer
        const alreadyMap = chatter.lines.some(
            (line) =>
                coreKey(line.subtitles) === key
                && /gr[ií]msv/i.test(String(line.disclaimer || '')),
        );
        if (already || alreadyMap) {
            console.log(`skip ${spec.hero}: ${subtitles.slice(0, 60)}`);
            skipped += 1;
            continue;
        }

        const voice = atlasVoiceName(spec.hero, hit.label);
        const didCopy = await copyTheater(voice, hit.source);
        if (didCopy) copied += 1;

        if (dryRun) {
            console.log(`DRY ${spec.hero} [${MAP_DISCLAIMER}] ${subtitles}`);
            added += 1;
            continue;
        }

        chatter.lines.push({
            id: randomUUID(),
            hero: spec.hero,
            voice,
            voicePrefix: '',
            subtitles,
            render: 'Heroic.png',
            era: 'Overwatch',
            status: 'active',
            disclaimer: MAP_DISCLAIMER,
        });
        added += 1;
        console.log(`+ ${spec.hero}: ${subtitles.slice(0, 72)}`);
    }

    console.log(
        `\nAdded: ${added}, skipped: ${skipped}, missing: ${missing}, files copied: ${copied}`,
    );

    if (dryRun) {
        console.log('Dry run — no writes.');
        return;
    }

    if (added === 0) {
        console.log('Nothing to write.');
        return;
    }

    data._meta = data._meta || {};
    data._meta.grimsvotnMapChattersAt = new Date().toISOString();
    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Theater manifest refreshed (${assets.voicelines.length} voicelines).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
