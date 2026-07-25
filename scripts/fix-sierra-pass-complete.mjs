#!/usr/bin/env node
/**
 * Sierra pass completeness:
 * - Fix Welcome Party (split Ashe closer)
 * - Behind bars → Emre/Freja multipath
 * - Rename Ana 88/89
 * - Import all missing wiki interactions
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    createDialoguePathId,
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

function makeLine(hero, subtitles, voice, id = createDialogueLineId()) {
    return {
        id,
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
    };
}

function keepId(lines, pred) {
    return (lines || []).find(pred)?.id || createDialogueLineId();
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
    const done = [];

    // Rename Ana placeholders
    {
        const glory = conversations.find((c) =>
            (c.lines || []).some((l) => /reliving the glory days/i.test(String(l.subtitles || ''))),
        );
        if (glory && (/^\d+$/.test(String(glory.name || '')) || !String(glory.name || '').trim())) {
            glory.name = 'Glory days';
            done.push('renamed: Glory days');
        }
        const heart = conversations.find((c) =>
            (c.lines || []).some((l) => /heartstrings/i.test(String(l.subtitles || ''))),
        );
        if (heart && (/^\d+$/.test(String(heart.name || '')) || !String(heart.name || '').trim())) {
            heart.name = 'Heartstrings';
            done.push('renamed: Heartstrings');
        }
    }

    // Fix Welcome Party — merge split Ashe closer + wiki wording
    {
        const c = conversations.find((x) => String(x.name) === 'Welcome Party') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /welcome party/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Welcome Party not found');

        const asheOpen = makeLine(
            'Ashe',
            "How's your little base lookin' these days, sweetheart? You fix that B.O.B. shaped hole in the wall, yet?",
            await copyVoice('Ashe', 'B.O.B. shaped hole'),
            keepId(c.lines, (l) => /base lookin|base looking|shaped hole/i.test(l.subtitles || '')),
        );
        const sierra = makeLine(
            'Sierra',
            "Why don't you swing by, see for yourself? We'll even throw you a little welcome party.",
            await copyVoice('Sierra', 'welcome party'),
            keepId(c.lines, (l) => /welcome party/i.test(l.subtitles || '')),
        );
        const asheClose = makeLine(
            'Ashe',
            "I'm sure it'll be a real barn-burner. I'll bring the fireworks.",
            await copyVoice('Ashe', 'barn burner'),
            keepId(c.lines, (l) => /barn.?burner|fireworks/i.test(l.subtitles || '')),
        );
        c.name = 'Welcome Party';
        c.lines = [asheOpen, sierra, asheClose];
        delete c.paths;
        delete c.selectedPathId;
        done.push('fixed: Welcome Party (3 lines)');
    }

    // Behind bars multipath
    {
        const c =
            conversations.find((x) => String(x.name) === 'Behind bars') ||
            conversations.find((x) =>
                (x.lines || []).some((l) => /behind bars/i.test(String(l.subtitles || ''))),
            );
        if (!c) throw new Error('Behind bars not found');

        const opener = makeLine(
            'Sierra',
            "You might've gotten away from me once, but I won't quit until you're both behind bars.",
            await copyVoice('Sierra', 'behind bars'),
            keepId(c.lines, (l) => /behind bars/i.test(l.subtitles || '')),
        );
        const emre = makeLine(
            'Emre',
            "*(chuckle)* I'm working with the world's best bounty hunter. Good luck tracking us down.",
            await copyVoice('Emre', 'best bounty hunter'),
            keepId(c.lines, (l) => /bounty hunter/i.test(l.subtitles || '')),
        );
        const freja = makeLine(
            'Freja',
            "If your tracking skills are like the security at Grand Mesa, I expect I'll be fine.",
            await copyVoice('Freja', 'tracking skills'),
            keepId(c.lines, (l) => /tracking skills/i.test(l.subtitles || '')),
        );
        c.name = 'Behind bars';
        c.lines = [opener, emre, freja];
        c.paths = [
            { id: createDialoguePathId(), label: 'Emre', lineIds: [opener.id, emre.id] },
            { id: createDialoguePathId(), label: 'Freja', lineIds: [opener.id, freja.id] },
        ];
        c.selectedPathId = c.paths[0].id;
        done.push('Behind bars → Emre/Freja multipath');
    }

    // --- Missing imports ---
    await addConv(conversations, done, 'wipe your whole operation', 'Helix wipe', [
        [
            'Sierra',
            'Better watch your back, now. Helix is going to wipe your whole operation off the map.',
            'wipe your whole operation',
        ],
        [
            'Ashe',
            "I reckon they'll try. But when I'm through, the West'll be wild again.",
            "West'll be wild",
        ],
    ]);

    await addConv(conversations, done, 'liking working with Overwatch, Sierra', 'Working with Overwatch', [
        [
            'Brigitte',
            'How are you liking working with Overwatch, Sierra?',
            'liking working with Overwatch',
        ],
        [
            'Sierra',
            "Oh, it's amazing! Y'all are so smart, and kind, and... well, nothing beats working with heroes!",
            'working with heroes',
        ],
        [
            'Brigitte',
            "*chuckle* That's exactly what I've been hearing about you, too.",
            'hearing about you, too',
        ],
    ]);

    await addConv(conversations, done, 'real sharpshooters', 'Sharpshooters', [
        [
            'Cassidy',
            "I've had my problems with Helix, but I'll be damned if they don't train up some real sharpshooters.",
            'real sharpshooters',
        ],
        [
            'Sierra',
            "Careful now, cowboy. That's almost a compliment.",
            'almost a compliment',
        ],
    ]);

    await addConv(conversations, done, 'Mount Washington', 'Mount Washington', [
        [
            'Sierra',
            'I think you could use an adventure, Mei! You ever hike Mount Washington?',
            'Mount Washington',
        ],
        [
            'Mei',
            "No, but I've read about it. They have such interesting weather patterns there.",
            'weather patterns',
        ],
        [
            'Sierra',
            "Yeah, and the fog stretches for miles. I'll take you with me next time.",
            'fog stretches',
        ],
    ]);

    await addConv(conversations, done, 'glad you joined us', 'Glad you joined', [
        [
            'Sojourn',
            "I'm glad you joined us. We're going to need all the help we can get to take Talon down.",
            'glad you joined us',
        ],
        [
            'Sierra',
            "Hah, my mom always told me to stand up for what's right. And it doesn't get much more wrong than Talon.",
            "stand up for what's right",
        ],
    ]);

    await addConv(conversations, done, 'learn about Jack Morrison', 'Jack Morrison', [
        [
            'Sojourn',
            'So what exactly are you looking to learn about Jack Morrison?',
            'Jack Morrison',
        ],
        ['Sierra', "Honestly? Whatever you've got.", "Whatever you've got"],
    ]);

    await addConv(conversations, done, 'Enhancement Program', 'Enhancement Program', [
        [
            'Sierra',
            "You were the Enhancement Program's best soldier. There's gotta be something you can tell me.",
            'Enhancement Program',
        ],
        [
            'Soldier 76',
            "The Naughton project's ancient history. It's been shut down for decades.",
            'Naughton project',
        ],
        [
            'Sierra',
            `Your "ancient history" is all I've got to go on.`,
            'ancient history',
        ],
        [
            'Soldier 76',
            'Trust me, kid: the last thing you need is my past catching up to you, too.',
            'catching up to you',
        ],
    ]);

    await addConv(conversations, done, 'stay buried for a reason', 'Stay buried', [
        [
            'Sierra',
            "You know, you're not the only one chasing down leads. Maybe we can help each other.",
            'chasing down leads',
        ],
        [
            'Soldier 76',
            'Some things stay buried for a reason. Digging them up can get you killed.',
            'stay buried',
        ],
        [
            'Sierra',
            'Yeah? When did that ever stop you?',
            'ever stop you',
        ],
        ['Soldier 76', "Guess that's fair.", "Guess that's fair"],
    ]);

    await addConv(conversations, done, "Dorothy's looking", 'Dorothy', [
        [
            'Sierra',
            "Whoof, Dorothy's looking a little worse for wear after that last mission...",
            "Dorothy's looking",
        ],
        [
            'Torbjörn',
            "Just swing by my workshop after this. I'll patch her up.",
            'patch her up',
        ],
        [
            'Sierra',
            'Wow! You mean it, Dr. Lindholm? That\'d be amazing!',
            'You mean it, Dr. Lindholm',
        ],
        [
            'Torbjörn',
            'Please, Dr. Lindholm is my wife!',
            'is my wife',
        ],
    ]);

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Done:\n- ${done.join('\n- ')}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
