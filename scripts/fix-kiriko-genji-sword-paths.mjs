#!/usr/bin/env node
/**
 * Merge Kiriko → Genji "tripped over your sword" into one multi-path conversation (#233).
 * Removes duplicate flat import (e.g. #974 Junker Queen branch only).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createDialogueLineId,
    createDialoguePathId,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(__dirname, '../src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(__dirname, '../src/assets/audio/Theater/Voicelines');

const GENJI_SWORD_CONV_ID = '9f0c6230-64b9-4e53-9ad8-4a7ccd4e3346';
const OPENING_SUB = 'Genji, remember the time you tripped over your sword in training?';

/** @type {Array<{ hero: string, subtitles: string, voice: string }>} */
const RESPONSES = [
    {
        hero: 'Brigitte',
        subtitles: '**laughs** Really?',
        voice: 'Brigitte_-_Really.ogg',
    },
    {
        hero: 'Cassidy',
        subtitles: 'That sounds like him.',
        voice: 'Cassidy_-_That_sounds_like_him.ogg',
    },
    {
        hero: 'Junker Queen',
        subtitles: 'Ha! Some ninja.',
        voice: 'Junker_Queen_-_Ha!_Some_ninja.ogg',
    },
    {
        hero: 'Mei',
        subtitles: 'No way! **laughs**',
        voice: 'Mei_-_No_way!_(giggle).ogg',
    },
    {
        hero: 'Mercy',
        subtitles: 'Ho ho! Wish I was there.',
        voice: 'Mercy_-_Ho_ho!_Wish_I_was_there!.ogg',
    },
    {
        hero: 'Reinhardt',
        subtitles: 'What? Haha, hahahahaha!',
        voice: 'Reinhardt_-_What__Haha!.ogg',
    },
    {
        hero: 'Tracer',
        subtitles: 'Ha! Is that true?',
        voice: 'Tracer_-_Ha!_Is_that_true_.ogg',
    },
    {
        hero: 'Winston',
        subtitles: 'Is that true?',
        voice: 'Winston_-_(chuckle)_Is_that_true_.ogg',
    },
];

/** @type {Array<{ source: string, dest: string }>} */
const VOICELINE_COPIES = [
    {
        source: 'Cassidy/MatchTalk/00000006224A.0B2-That sounds like him.ogg',
        dest: 'Cassidy_-_That_sounds_like_him.ogg',
    },
    {
        source: 'Mei/MatchTalk/0000000623C3.0B2-No way! (giggle).ogg',
        dest: 'Mei_-_No_way!_(giggle).ogg',
    },
    {
        source: 'Mercy/MatchTalk/000000061FA2.0B2-Ho ho! Wish I was there!.ogg',
        dest: 'Mercy_-_Ho_ho!_Wish_I_was_there!.ogg',
    },
    {
        source: 'Reinhardt/MatchTalk/0000000605B8.0B2-What_ Haha!.ogg',
        dest: 'Reinhardt_-_What__Haha!.ogg',
    },
    {
        source: 'Tracer/MatchTalk/000000061F76.0B2-Ha! Is that true_.ogg',
        dest: 'Tracer_-_Ha!_Is_that_true_.ogg',
    },
    {
        source: 'Winston/MatchTalk/0000000620C5.0B2-(chuckle) Is that true_.ogg',
        dest: 'Winston_-_(chuckle)_Is_that_true_.ogg',
    },
];

const HERO_VOICE_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

async function copyMissingVoicelines() {
    for (const { source, dest } of VOICELINE_COPIES) {
        const from = path.join(HERO_VOICE_ROOT, source);
        const to = path.join(VOICELINES_DIR, dest);
        try {
            await fs.access(to);
            continue;
        } catch {
            /* copy */
        }
        try {
            await fs.copyFile(from, to);
            console.log(`Copied ${dest}`);
        } catch (error) {
            console.warn(`Skip copy ${dest}: ${error instanceof Error ? error.message : error}`);
        }
    }
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 */
function isDuplicateGenjiSwordFlat(conversation) {
    if (conversation.id === GENJI_SWORD_CONV_ID) return false;
    const lines = conversation.lines || [];
    if (lines.length !== 4) return false;
    const open = String(lines[0]?.subtitles || '').trim();
    if (open !== OPENING_SUB) return false;
    const heroes = lines.map((line) => line.hero);
    return heroes.includes('Genji') && heroes.includes('Kiriko');
}

async function main() {
    await copyMissingVoicelines();

    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];
    const conv = conversations.find((row) => row.id === GENJI_SWORD_CONV_ID);
    if (!conv) {
        throw new Error(`Conversation ${GENJI_SWORD_CONV_ID} (#233) not found`);
    }

    const opener = conv.lines.find((line) => String(line.subtitles || '').trim() === OPENING_SUB);
    const genjiClose = conv.lines.find((line) =>
        String(line.subtitles || '').trim() === 'It only happened once.');
    const kirikoClose = conv.lines.find((line) =>
        String(line.subtitles || '').trim() === 'Once was enough.');

    if (!opener || !genjiClose || !kirikoClose) {
        throw new Error('#233 missing expected opener/closing lines');
    }

    /** @type {typeof conv.lines} */
    const lines = [opener];

    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialoguePath[]} */
    const paths = [];

    for (const response of RESPONSES) {
        const existing = conv.lines.find(
            (line) =>
                line.hero === response.hero
                && String(line.subtitles || '').replace(/\*+/g, '').trim()
                    === response.subtitles.replace(/\*+/g, '').trim(),
        );

        const line = existing
            ? { ...existing, voice: existing.voice || response.voice }
            : {
                id: createDialogueLineId(),
                hero: response.hero,
                voice: response.voice,
                voicePrefix: '',
                subtitles: response.subtitles,
                render: 'Heroic.png',
            };

        lines.push(line);
        paths.push({
            id: createDialoguePathId(),
            label: response.hero,
            lineIds: [opener.id, line.id, genjiClose.id, kirikoClose.id],
        });
    }

    lines.push(genjiClose, kirikoClose);

    conv.lines = lines;
    conv.paths = paths;
    conv.selectedPathId = paths[0]?.id || '';

    const before = conversations.length;
    raw.conversations = conversations.filter((row) => !isDuplicateGenjiSwordFlat(row));
    const removed = before - raw.conversations.length;

    raw._meta = {
        ...(raw._meta && typeof raw._meta === 'object' ? raw._meta : {}),
        nameResetAt: new Date().toISOString(),
    };

    await fs.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`Updated #233 with ${paths.length} paths and ${lines.length} lines`);
    console.log(`Removed ${removed} duplicate flat Genji-sword conversation(s)`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
