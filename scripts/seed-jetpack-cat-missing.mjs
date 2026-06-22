#!/usr/bin/env node
/**
 * Download missing Jetpack Cat interaction voicelines from the wiki, write interaction
 * folders under ~/Escritorio/interactions/jetpack-cat, and patch conversations.json.
 *
 * Usage:
 *   node scripts/seed-jetpack-cat-missing.mjs
 *   node scripts/seed-jetpack-cat-missing.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createConversationId,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
    normalizeConversationRecord,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { pickHeroicRenderForHero } from '../src/features/dialogue-theater/data/loadDialogueTheaterAssets.js';
import {
    downloadWikiVoicelineFile,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');
const INTERACTIONS_DIR = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'interactions',
    'jetpack-cat',
);

const KITTEN_ME_CONVERSATION_ID = 'eb7a8eb3-c461-457a-ba01-146989a006db';
const RAMATTRA_CONVERSATION_ID = '93e776d4-ddaf-48cd-9ea5-0c10d767c519';

/** @typedef {{ hero: string, subtitles: string, voice?: string, wikiFile?: string|null, lineId?: string }} SeedLine */

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    return { dryRun: argv.includes('--dry-run') };
}

/**
 * @param {string} wikiFile
 * @returns {string}
 */
function voiceFromWikiFile(wikiFile) {
    return wikiFileTitleToTheaterFilename(wikiFile);
}

/**
 * @param {SeedLine} line
 * @param {Record<string, string[]>} rendersMap
 */
function buildLineRecord(line, rendersMap) {
    return {
        id: line.lineId || createDialogueLineId(),
        hero: line.hero,
        voice: line.voice || '',
        subtitles: line.subtitles,
        render: pickHeroicRenderForHero(line.hero, rendersMap),
    };
}

/** @type {Array<{ folder: string, partnerHero: string, conversationName: string, lines: SeedLine[] }>} */
const INTERACTIONS = [
    {
        folder: '010-mercy-kitten-me',
        partnerHero: 'Mercy',
        conversationName: 'Kitten me (Mercy)',
        lines: [
            {
                hero: 'Reinhardt',
                subtitles: 'A cat? In a jetpack?! **laugh** You’ve got to be catting me! **laugh**',
            },
            { hero: 'Jetpack Cat', subtitles: '**confused meows**' },
            {
                hero: 'Mercy',
                subtitles: 'Reinhardt… I do believe it’s “‘kitten’ me”.',
            },
            {
                hero: 'Reinhardt',
                subtitles: 'Don’t be ridiculous. She’s not a baby!',
            },
        ],
    },
    {
        folder: '011-mizuki-black-cat',
        partnerHero: 'Mizuki',
        conversationName: 'Black cat',
        lines: [
            {
                hero: 'Mizuki',
                subtitles: 'Ah, if only you were a black cat... you could ward off evil.',
                wikiFile: 'File:Mizuki - If only you were a black cat, you could help me ward off evil.ogg',
            },
            { hero: 'Jetpack Cat', subtitles: '**panicked meows**' },
            {
                hero: 'Mizuki',
                subtitles: "Sorry, jeez! You're fine the way you are, OK?",
                wikiFile: "File:Mizuki - Sorry, geez. You're fine the way you are, okay.ogg",
            },
            { hero: 'Jetpack Cat', subtitles: '**understanding meows**' },
        ],
    },
    {
        folder: '012-wrecking-ball-provoking-meows',
        partnerHero: 'Wrecking Ball',
        conversationName: 'Provoking meows',
        lines: [
            { hero: 'Jetpack Cat', subtitles: '**provoking meows**' },
            {
                hero: 'Wrecking Ball',
                subtitles: 'Mrrow... Meow meow!',
                wikiFile: 'File:Wrecking Ball - Meow... meow.ogg',
            },
            { hero: 'Jetpack Cat', subtitles: '**provoking meows**' },
            { hero: 'Wrecking Ball', subtitles: "He says, oh no you didn't." },
            { hero: 'Wrecking Ball', subtitles: 'He says, the pot is calling the kettle black.' },
            { hero: 'Wrecking Ball', subtitles: 'He says, you take that back.' },
        ],
    },
    {
        folder: '013-wrecking-ball-suspicious-mammal',
        partnerHero: 'Wrecking Ball',
        conversationName: 'Suspicious mammal',
        lines: [
            {
                hero: 'Wrecking Ball',
                subtitles: 'The hamster knows a suspicious mammal when he sees one.',
            },
            { hero: 'Jetpack Cat', subtitles: '**innocent meows**' },
            {
                hero: 'Wrecking Ball',
                subtitles: 'The cute act will not work on him. He is the master of it.',
            },
        ],
    },
];

/**
 * @param {SeedLine} line
 */
function prepareLineVoice(line) {
    if (line.voice) return;
    if (line.wikiFile) {
        line.voice = voiceFromWikiFile(line.wikiFile);
    }
}

/**
 * @param {boolean} dryRun
 */
async function downloadVoicelines(dryRun) {
    /** @type {Map<string, string>} */
    const toFetch = new Map();

    for (const interaction of INTERACTIONS) {
        for (const line of interaction.lines) {
            prepareLineVoice(line);
            if (line.wikiFile && line.voice) {
                toFetch.set(line.wikiFile, line.voice);
            }
        }
    }

    let downloaded = 0;
    let skipped = 0;

    for (const [wikiFile, theaterName] of toFetch) {
        const voicelineDest = path.join(VOICELINES_DIR, theaterName);
        try {
            await fs.access(voicelineDest);
            console.log(`  voiceline present: ${theaterName}`);
            skipped += 1;
            continue;
        } catch {
            /* download */
        }

        if (dryRun) {
            console.log(`  (dry-run) would download ${theaterName}`);
            continue;
        }

        await fs.mkdir(VOICELINES_DIR, { recursive: true });
        await downloadWikiVoicelineFile(wikiFile, voicelineDest);
        console.log(`  ✓ downloaded ${theaterName}`);
        downloaded += 1;
    }

    return { downloaded, skipped };
}

/**
 * @param {string} srcPath
 * @param {string} destPath
 * @param {boolean} dryRun
 */
async function copyIfMissing(srcPath, destPath, dryRun) {
    try {
        await fs.access(destPath);
        return 'skipped';
    } catch {
        /* copy */
    }
    if (dryRun) return 'would-copy';
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    await fs.copyFile(srcPath, destPath);
    return 'copied';
}

/**
 * @param {typeof INTERACTIONS[number]} interaction
 * @param {boolean} dryRun
 */
async function writeInteractionFolder(interaction, dryRun) {
    const dir = path.join(INTERACTIONS_DIR, interaction.folder);
    if (dryRun) {
        console.log(`  (dry-run) would write ${dir}`);
        return;
    }

    await fs.mkdir(dir, { recursive: true });

    /** @type {Array<Record<string, unknown>>} */
    const lineRecords = [];
    for (const line of interaction.lines) {
        prepareLineVoice(line);
        const voiceFile = line.voice || null;
        let downloaded = false;

        if (voiceFile) {
            const src = path.join(VOICELINES_DIR, voiceFile);
            const dest = path.join(dir, voiceFile);
            const result = await copyIfMissing(src, dest, dryRun);
            downloaded = result === 'copied';
        }

        lineRecords.push({
            hero: line.hero,
            subtitles: line.subtitles,
            voiceFile,
            audioUrl: null,
            audioMissing: !voiceFile,
            downloaded,
        });
    }

    const manifest = {
        sourcePage: 'https://overwatch.fandom.com/wiki/Jetpack_Cat/Quotes',
        pageHero: 'Jetpack Cat',
        partnerHero: interaction.partnerHero,
        folder: interaction.folder,
        scrapedAt: new Date().toISOString(),
        lineCount: interaction.lines.length,
        missingAudioCount: lineRecords.filter((row) => row.audioMissing).length,
        lines: lineRecords,
    };

    await fs.writeFile(path.join(dir, 'interaction.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

/**
 * @param {Array<{ voice?: string, subtitles?: string, hero?: string }>} lines
 */
function voiceFingerprint(lines) {
    return lines
        .map((line) => `${line.hero || ''}:${line.voice || line.subtitles || ''}`)
        .join('|');
}

async function readConversations() {
    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const rows = Array.isArray(raw?.conversations) ? raw.conversations : [];
    return rows
        .map((row, index) => normalizeConversationRecord(row, `seed-${index}`))
        .filter(Boolean);
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {Record<string, string[]>} rendersMap
 */
function patchExistingConversations(conversations, rendersMap) {
    const kittenMe = conversations.find((row) => row.id === KITTEN_ME_CONVERSATION_ID);
    if (kittenMe) {
        const wuyangLine = kittenMe.lines.find((line) => line.hero === 'Wuyang');
        if (wuyangLine) {
            wuyangLine.voice = "Wuyang_-_Uh..._shouldn't_it_be_kitten_me.ogg";
        }
    }

    const ramattra = conversations.find((row) => row.id === RAMATTRA_CONVERSATION_ID);
    if (ramattra && !ramattra.lines.some((line) => line.hero === 'Jetpack Cat')) {
        ramattra.lines.push(
            buildLineRecord({ hero: 'Jetpack Cat', subtitles: '**proud purring**' }, rendersMap),
        );
    }
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {Record<string, string[]>} rendersMap
 */
function addNewConversations(conversations, rendersMap) {
    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} */
    const added = [];

    for (const interaction of INTERACTIONS) {
        const existing = conversations.find(
            (row) =>
                row.name === interaction.conversationName ||
                voiceFingerprint(row.lines) === voiceFingerprint(interaction.lines),
        );
        if (existing) {
            console.log(`  conversation exists: ${interaction.conversationName}`);
            continue;
        }

        const lines = interaction.lines.map((line) => {
            prepareLineVoice(line);
            return buildLineRecord(line, rendersMap);
        });

        const conversation = {
            id: createConversationId(),
            name: interaction.conversationName,
            status: 'active',
            eraName: '',
            scene: DEFAULT_DIALOGUE_SCENE,
            lines,
        };

        added.push(conversation);
        conversations.push(conversation);
        console.log(`  + conversation: ${interaction.conversationName} (${lines.length} lines)`);
    }

    return added;
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    console.log(`Interactions folder: ${INTERACTIONS_DIR}`);
    console.log(`Dry run: ${opts.dryRun ? 'yes' : 'no'}\n`);

    console.log('Downloading wiki voicelines…');
    const dl = await downloadVoicelines(opts.dryRun);
    console.log(`Voicelines: ${dl.downloaded} downloaded, ${dl.skipped} already present\n`);

    console.log('Writing interaction folders…');
    for (const interaction of INTERACTIONS) {
        console.log(`[${interaction.folder}] ${interaction.conversationName}`);
        await writeInteractionFolder(interaction, opts.dryRun);
    }

    const assets = await scanTheaterAssets();
    const conversations = await readConversations();
    console.log('\nPatching conversations.json…');
    patchExistingConversations(conversations, assets.renders || {});
    const added = addNewConversations(conversations, assets.renders || {});

    if (!opts.dryRun) {
        await fs.writeFile(
            CONVERSATIONS_PATH,
            `${JSON.stringify({ conversations }, null, 2)}\n`,
            'utf8',
        );
        const refreshed = await scanTheaterAssets();
        await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(refreshed, null, 2)}\n`, 'utf8');
        console.log(`\nUpdated: ${CONVERSATIONS_PATH}`);
        console.log(`Updated: ${MANIFEST_PATH}`);
    }

    console.log(`\nAdded ${added.length} new conversation(s).`);
    console.log(
        'Note: Reinhardt/Mercy catting-me, most Jetpack Cat meows, and several Wrecking Ball lines have no wiki audio yet.',
    );
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
