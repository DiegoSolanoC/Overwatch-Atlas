#!/usr/bin/env node
/**
 * Sombra pass — add missing Ashe / Kiriko / Mizuki / Wuyang interactions.
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

async function copyVoice(hero, needle) {
    const hit = findOgg(hero, needle);
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

    await addConv(conversations, added, 'contacts with Los Muertos', 'Los Muertos', [
        [
            'Ashe',
            'You still have any contacts with Los Muertos?',
            'Los Muertos',
        ],
        ['Sombra', "I might. What's in it for me?", "What's in it for me"],
        [
            'Ashe',
            "I'd offer you money, but I don't think that's what you're after.",
            "that's what you're after",
        ],
        [
            'Sombra',
            'No. So... any good stories about the cowboy?',
            'stories about the cowboy',
        ],
    ]);

    await addConv(conversations, added, "Hashimoto's calls", 'Hashimoto calls', [
        [
            'Sombra',
            "You'll never guess what I heard when I tapped the Hashimoto's calls.",
            "Hashimoto's calls",
        ],
        [
            'Kiriko',
            "I don't do guesses. What's your price?",
            "don't do guesses",
        ],
        [
            'Sombra',
            '*(tongue click)* I have a feeling we\'re going to get along.',
            'tongue click',
        ],
    ]);

    await addConv(conversations, added, 'fox girl asked for more Hashimoto', 'Fox girl intel', [
        [
            'Sombra',
            'That fox girl asked for more Hashimoto intel. Think I should tell her the truth?',
            'fox girl asked',
        ],
        [
            'Mizuki',
            "Only if you're prepared to regret it.",
            'prepared to regret',
        ],
    ]);

    await addConv(conversations, added, 'know a liar when I see one', 'Know a liar', [
        [
            'Sombra',
            'Your friends might be fooled by your little act, but I know a liar when I see one.',
            'know a liar',
        ],
        [
            'Mizuki',
            "I'm not lying. Just not telling the whole truth.",
            'whole truth',
        ],
        [
            'Sombra',
            'Sure, whatever helps you sleep at night.',
            'sleep at night',
        ],
    ]);

    await addConv(conversations, added, 'Peeked at your grades', 'Peeked at your grades', [
        [
            'Sombra',
            'Peeked at your grades. Pretty good for someone studying through a Null Sector attack.',
            'Peeked at your grades',
        ],
        [
            'Wuyang',
            "Thanks! Honestly, I'm pretty proud of-- oh, HEY! That's private!",
            "that's private",
        ],
        ['Sombra', 'Not to me.', 'Not to me'],
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
