#!/usr/bin/env node
/**
 * Pharah pass — add missing Brigitte / Junkrat / Kiriko / Sojourn / S76 / Torb / Zarya interactions.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const HERO_FOLDER = {
    'Soldier 76': 'Soldier_ 76',
};

function atlasFromLabel(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function findOgg(heroFolder, needle) {
    const dir = path.join(EXTRACT_ROOT, heroFolder, 'MatchTalk');
    if (!fs.existsSync(dir)) return null;
    const n = needle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    /** @type {{ source: string, label: string, score: number }[]} */
    const hits = [];
    for (const name of fs.readdirSync(dir)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
        if (norm === n) hits.push({ source: path.join(dir, name), label, score: 0 });
        else if (norm.includes(n)) {
            hits.push({
                source: path.join(dir, name),
                label,
                score: 1 + Math.abs(norm.length - n.length),
            });
        }
    }
    hits.sort((a, b) => a.score - b.score);
    return hits[0] || null;
}

async function copyVoice(hero, needle) {
    const folder = HERO_FOLDER[hero] || hero;
    const hit = findOgg(folder, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) await fsp.copyFile(hit.source, dest);
    return atlas;
}

function makeLine(hero, subtitles, voice) {
    return {
        id: createDialogueLineId(),
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
    };
}

function hasSubtitle(conversations, needle) {
    const n = needle.toLowerCase();
    return conversations.some((c) =>
        (c.lines || []).some((l) => String(l.subtitles || '').toLowerCase().includes(n)),
    );
}

async function addConv(conversations, added, dedupeNeedle, name, specs) {
    if (hasSubtitle(conversations, dedupeNeedle)) {
        console.log(`skip (exists): ${name}`);
        return;
    }
    const conv = buildBlankConversationRecord();
    conv.name = name;
    conv.scene = DEFAULT_DIALOGUE_SCENE;
    conv.lines = [];
    for (const [hero, subtitles, needle] of specs) {
        conv.lines.push(makeLine(hero, subtitles, await copyVoice(hero, needle)));
    }
    conversations.push(conv);
    added.push(name);
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const added = [];

    await addConv(conversations, added, 'overboard on the weights', 'Overboard on the weights', [
        [
            'Pharah',
            'Ooh... I think I went a bit overboard on the weights yesterday.',
            'overboard on the weights',
        ],
        [
            'Brigitte',
            "Pace yourself! That's what I always tell Reinhardt. Not that he ever listens.",
            'Pace yourself',
        ],
    ]);

    await addConv(conversations, added, 'wings on your suit again', 'Wings on your suit', [
        [
            'Brigitte',
            'Hey, can I look at the wings on your suit again?',
            'wings on your suit',
        ],
        [
            'Pharah',
            'I thought you preferred to stay on the ground.',
            'preferred to stay on the ground',
        ],
        [
            'Brigitte',
            "It's for a different idea I had. I-I just thought the view from up there would be... inspirational.",
            'inspirational',
        ],
    ]);

    await addConv(conversations, added, 'rocket lady', 'Rocket lady', [
        [
            'Junkrat',
            'Hey, rocket lady... do they make that suit in my size?',
            'Rocket Lady',
        ],
        [
            'Pharah',
            "*laughter* Oh, you couldn't handle one of these.",
            "couldn't handle one of these",
        ],
        ['Junkrat', 'Why not?! I was born to fly...', 'born to fly'],
    ]);

    await addConv(conversations, added, 'basketball courts later', 'Basketball courts', [
        [
            'Pharah',
            'I see your sneakers. You, me, the basketball courts later.',
            'basketball courts',
        ],
        ['Kiriko', "Sure. But I don't play without stakes.", 'without stakes'],
        [
            'Pharah',
            'Likewise. What are you willing to lose?',
            'willing to lose',
        ],
        ['Kiriko', "Oh, Pharah-chan... I've never lost.", "I've never lost"],
    ]);

    await addConv(conversations, added, "don't work with criminals", 'Work with criminals', [
        ['Pharah', "I don't work with criminals.", 'work with criminals'],
        [
            'Kiriko',
            "What's right isn't always what's legal.",
            "isn't always what's legal",
        ],
        ['Pharah', 'Then you change the laws.', 'change the laws'],
        ['Kiriko', 'Heh, easy for you to say.', 'easy for you to say'],
    ]);

    await addConv(conversations, added, 'get a chihuahua', 'Chihuahua', [
        ['Pharah', "I think I'm going to get a chihuahua.", 'get a chihuahua'],
        ['Sojourn', "You're joking.", "You're joking"],
        ['Pharah', "Why, what's wrong with chihuahuas?", 'wrong with chihuahuas'],
        [
            'Sojourn',
            "Uh, well, for starters, they aren't corgis.",
            "aren't corgis",
        ],
    ]);

    await addConv(conversations, added, 'mercenaries like Helix', 'Helix mercenaries', [
        [
            'Soldier 76',
            "Can't believe Ana Amari's kid took up with mercenaries like Helix.",
            'mercenaries like Helix',
        ],
        [
            'Pharah',
            'Oh, as opposed to, whatever you are?',
            'as opposed to',
        ],
    ]);

    await addConv(conversations, added, 'take it easy sometimes', 'Like mother like daughter', [
        [
            'Torbjörn',
            "Y'know, Fareeha, it's not a sign of weakness if you take it easy sometimes.",
            'take it easy sometimes',
        ],
        [
            'Pharah',
            'Mistakes arise when people turn careless.',
            'turn careless',
        ],
        [
            'Torbjörn',
            '*(sigh)* Like mother, like daughter...',
            'Like mother, like daughter',
        ],
    ]);

    await addConv(conversations, added, 'blow them up especially', 'Blow them up', [
        [
            'Zarya',
            'Just like we practiced, Amari: I pull them together, you blow them up!',
            'Just like we practiced',
        ],
        [
            'Pharah',
            "I'm not waiting, I'm going to blow them up right away!",
            'blow them up right away',
        ],
        [
            'Zarya',
            'Yes, but when I pull them together, then you blow them up especially.',
            'blow them up especially',
        ],
    ]);

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(added.length ? `Done:\n- ${added.join('\n- ')}` : 'Nothing added');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
