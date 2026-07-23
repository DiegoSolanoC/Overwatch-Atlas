#!/usr/bin/env node
/**
 * Venture pass — add missing Ana / Echo / Mauga / Moira / Reaper / Sombra interactions.
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

async function copyVoice(hero, needle, heroFolder = hero) {
    const hit = findOgg(heroFolder, needle);
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

/**
 * @param {object[]} conversations
 * @param {string} dedupeNeedle
 * @param {string} name
 * @param {Array<[string, string, string, string?]>} specs hero, subtitle, needle, folder?
 */
async function addConv(conversations, added, dedupeNeedle, name, specs) {
    if (hasSubtitle(conversations, dedupeNeedle)) {
        console.log(`skip (exists): ${name}`);
        return;
    }
    const conv = buildBlankConversationRecord();
    conv.name = name;
    conv.scene = DEFAULT_DIALOGUE_SCENE;
    conv.lines = [];
    for (const [hero, subtitles, needle, folder] of specs) {
        conv.lines.push(makeLine(hero, subtitles, await copyVoice(hero, needle, folder || hero)));
    }
    conversations.push(conv);
    added.push(name);
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const added = [];

    await addConv(conversations, added, 'artifacts in an old necropolis', 'Cursed artifacts', [
        [
            'Ana',
            'I happened upon some artifacts in an old necropolis. Would you care to look after them?',
            'artifacts in an old necropolis',
        ],
        ['Venture', 'Would I?!', 'Would I'],
        ['Ana', 'I should warn you, they might be cursed...', 'might be cursed'],
        ['Venture', 'Ah! Even better!', 'Even better'],
    ]);

    await addConv(conversations, added, "Mina Liao's Echo", 'Mina Liao', [
        [
            'Venture',
            "No way... you're Echo! Like, Mina Liao's Echo! Oh, I have so many questions for you!",
            "Mina Liao's Echo",
        ],
        ['Echo', 'I... suppose I could answer them.', 'suppose I could answer'],
        [
            'Venture',
            "Awesome! I don't even know where to start, uh, I mean, um... what was she like?",
            'what was she like',
        ],
        ['Echo', 'She was... like me.', 'She was'],
    ]);

    await addConv(conversations, added, 'omnic archaeology', 'Omnic archaeology', [
        ['Echo', 'I understand you study omnic archaeology.', 'omnic archaeology'],
        ['Venture', "It's only my favorite specialization!", 'favorite specialization'],
        [
            'Echo',
            "What do you know of the Awakening? Could Aurora's sentience be replicated?",
            "Aurora's sentience",
        ],
        ['Venture', 'That one... might be beyond my expertise.', 'beyond my expertise'],
    ]);

    await addConv(conversations, added, 'binary counting system', 'Binary counting', [
        [
            'Echo',
            '...and, unlike with base 10, you begin at the rightmost number and work left.',
            'base 10',
        ],
        [
            'Venture',
            'Right. But... when did you pick your pronouns? Did you... download those?',
            'download those',
        ],
        [
            'Echo',
            'Do you believe we are discussing "non-binary", rather than the binary counting system?',
            'binary counting system',
        ],
        ['Venture', 'Oh! Uh... yeah.', 'Oh! Uh'],
    ]);

    // Venture "Oh! Uh... yeah." may not exist — probe for it
    // If missing, check find later

    await addConv(conversations, added, 'relics might end up in my pocket', 'Relics in my pocket', [
        [
            'Mauga',
            'Better watch it, kid, or those relics might end up in my pocket.',
            'relics might end up',
        ],
        [
            'Venture',
            "Don't do that! You don't even know their cultural value!",
            'cultural value',
        ],
        ['Mauga', "Uh, I know the value of 'a lot of money'.", 'a lot of money'],
        [
            'Venture',
            "Well... I know the value of... 'bopping you on the head'!",
            'bopping you on the head',
        ],
    ]);

    await addConv(conversations, added, 'cut of all those treasures', 'Cut of the treasures', [
        [
            'Mauga',
            'When are you gonna give me my cut of all those treasures?',
            'cut of all those treasures',
        ],
        ['Venture', 'When are you gonna stop being a big doofus?!', 'big doofus'],
        ['Mauga', 'You first.', 'You first'],
        ['Venture', 'You second! Oh... shoot.', 'You second'],
    ]);

    await addConv(conversations, added, 'bioarchaeology team', 'Bioarchaeology', [
        [
            'Venture',
            "You're a geneticist? If you're up for it, I bet our bioarchaeology team would love to have you!",
            'bioarchaeology',
        ],
        [
            'Moira',
            'The dead tell intriguing tales. But my interest lies with the living.',
            'intriguing tales',
        ],
    ]);

    await addConv(conversations, added, 'Gabrielito', 'Gabrielito', [
        [
            'Venture',
            "Hey! ¡Quiúbole, Gabrielito! How's it hangin'?",
            'Quiúbole, Gabrielito',
        ],
        ['Reaper', 'What did you call me?', 'What did you call me'],
        ['Venture', '"Gabrielito"! That\'s your nickname, right?', 'nickname, right'],
        ['Reaper', '*(growl)* Sombra...', '(growl) Sombra'],
    ]);

    await addConv(conversations, added, 'been since Ilios', 'Since Ilios', [
        ['Venture', "So... you haven't been in touch since Ilios.", 'since Ilios'],
        [
            'Sombra',
            "Be patient, escuincle. You aren't the only piece in this puzzle.",
            'escuincle',
        ],
        [
            'Venture',
            'But what kind of puzzle? Lockbox, ancient riddle, jigsaw?',
            'Lockbox',
        ],
        [
            'Sombra',
            '*(sigh)* Whatever kind makes you stop asking questions.',
            'stop asking questions',
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
