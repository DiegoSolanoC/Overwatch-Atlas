#!/usr/bin/env node
/**
 * Cassidy + Hanzo pass:
 * - Younger Self (Cassidy ↔ D.va)
 * - Haikus (Hanzo multipath ↔ Kiriko)
 * - Magnum Opus, Fox Secret, Have Faith, Contact Father,
 *   Hourly Patrols, Keep Up Sword, Asa-sensei
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
import {
    downloadWikiVoicelineFile,
    resolveWikiFileDownloadUrl,
    wikiFileTitleToTheaterFilename,
} from './lib/wiki-voiceline-download.mjs';
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

/** Disk MatchTalk folder when display name differs. */
const HERO_FOLDER = {
    'D.va': 'D.Va',
};

/** Theater voice filename hero prefix when display name differs. */
const ATLAS_HERO = {
    'D.va': 'D.Va',
};

function atlasFromLabel(hero, label) {
    const prefix = String(ATLAS_HERO[hero] || hero).replace(/ /g, '_');
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

async function ensureWiki(wikiTitle) {
    const resolved = await resolveWikiFileDownloadUrl(wikiTitle);
    if (!resolved) throw new Error(`Wiki file not found: ${wikiTitle}`);
    const atlas = wikiFileTitleToTheaterFilename(wikiTitle);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!fs.existsSync(dest)) {
        await downloadWikiVoicelineFile(wikiTitle, dest);
        console.log(`  downloaded ${atlas}`);
    }
    return atlas;
}

async function copyVoiceOrWiki(hero, needle, wikiTitles) {
    try {
        return await copyVoice(hero, needle);
    } catch {
        const list = Array.isArray(wikiTitles) ? wikiTitles : [wikiTitles];
        for (const title of list) {
            const resolved = await resolveWikiFileDownloadUrl(title);
            if (!resolved) continue;
            return ensureWiki(title);
        }
        throw new Error(`No MatchTalk/wiki for ${hero}: ${needle}`);
    }
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

function hasSubtitle(conversations, needle) {
    const n = needle.toLowerCase();
    return conversations.some((c) =>
        (c.lines || []).some((l) => String(l.subtitles || '').toLowerCase().includes(n)),
    );
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {string[]} done
 * @param {string} dedupeNeedle
 * @param {string} name
 * @param {[string, string, string, string|string[]|null][]} specs hero, subtitles, matchtalk needle, wiki
 */
async function addConv(conversations, done, dedupeNeedle, name, specs) {
    if (hasSubtitle(conversations, dedupeNeedle)) {
        console.log(`skip (exists): ${name}`);
        return;
    }
    const conv = buildBlankConversationRecord();
    conv.name = name;
    conv.scene = DEFAULT_DIALOGUE_SCENE;
    conv.lines = [];
    for (const [hero, subtitles, needle, wiki] of specs) {
        const voice = wiki
            ? await copyVoiceOrWiki(hero, needle, wiki)
            : await copyVoice(hero, needle);
        conv.lines.push(makeLine(hero, subtitles, voice));
    }
    conversations.push(conv);
    done.push(`${name} (${conv.id})`);
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    // --- Younger Self ---
    await addConv(conversations, done, 'hat and cigar', 'Younger Self', [
        [
            'Cassidy',
            'You remind me of myself when I was younger.',
            'remind me of myself when I was younger',
            ['File:Cassidy - You remind me of myself when I was younger.ogg'],
        ],
        [
            'D.va',
            "Uh, I'm way cooler than you!",
            'way cooler than you',
            ["File:D.Va - Uh, I'm way cooler than you.ogg"],
        ],
        [
            'Cassidy',
            "That's exactly what I would've said! All you're missin' is the hat and cigar.",
            'hat and cigar',
            [
                "File:Cassidy - That's exactly what I would've said. All you're missing is the hat and cigar.ogg",
            ],
        ],
    ]);

    // --- Haikus multipath ---
    {
        if (hasSubtitle(conversations, 'reciting your haikus')) {
            console.log('skip (exists): Haikus');
        } else {
            const stone = makeLine(
                'Hanzo',
                'Weighted like a stone. Blade, sharpened - yearns to punish. Strikes the final blow.',
                await copyVoice('Hanzo', 'Weighted like a stone'),
            );
            const wind = makeLine(
                'Hanzo',
                'Swifter than the wind. A rushing crimson river. Stains the earth with red.',
                await copyVoice('Hanzo', 'Swifter than the wind'),
            );
            const groan = makeLine(
                'Kiriko',
                "**groans** You're reciting your haikus out loud again...",
                await copyVoice('Kiriko', 'reciting your haikus'),
            );
            const conv = buildBlankConversationRecord();
            conv.name = 'Haikus';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [stone, wind, groan];
            conv.paths = [
                { id: createDialoguePathId(), label: 'Stone', lineIds: [stone.id, groan.id] },
                { id: createDialoguePathId(), label: 'Wind', lineIds: [wind.id, groan.id] },
            ];
            conv.selectedPathId = conv.paths[0].id;
            conversations.push(conv);
            done.push(`Haikus (${conv.id})`);
        }
    }

    await addConv(conversations, done, "father's magnum opus", 'Magnum Opus', [
        [
            'Hanzo',
            "The Shimada weapons were masterworks, but those ofuda were your father's magnum opus.",
            'magnum opus',
        ],
        [
            'Kiriko',
            'He made them for grandma when he proposed. Bringing the fox spirit to life really won her over.',
            'for grandma when he proposed',
        ],
        [
            'Hanzo',
            'A sentimental, yet powerful gift. I see why she was impressed.',
            'sentimental, yet powerful',
        ],
    ]);

    await addConv(conversations, done, 'fox spirit a secret', 'Fox Secret', [
        [
            'Kiriko',
            'Is it true that my dad had to keep the fox spirit a secret from the clan?',
            'fox spirit a secret',
        ],
        [
            'Hanzo',
            'Indeed. He was forbidden from crafting more anima avatars after forging our dragons.',
            'forbidden from crafting',
        ],
        [
            'Kiriko',
            'Why? You used them to help people.',
            'used them to help people',
        ],
        [
            'Hanzo',
            'The scenes that haunt my memories... prove otherwise.',
            'haunt my memories',
        ],
    ]);

    await addConv(conversations, done, 'Have faith, Kiriko', 'Have Faith', [
        [
            'Kiriko',
            'Do you think Genji will ever come back?',
            'Genji will ever come back',
            ['File:Kiriko - Do you think Genji will ever come back.ogg'],
        ],
        [
            'Hanzo',
            'Have faith, Kiriko. The years have changed us all, but he will return just as I have.',
            'Have faith, Kiriko',
            [
                'File:Hanzo - Have faith, Kiriko. The years have changed us all, but he will return just as I have.ogg',
            ],
        ],
    ]);

    await addConv(conversations, done, 'harder to contact him', 'Contact Father', [
        [
            'Hanzo',
            'Have you heard from your father?',
            'heard from your father',
            ['File:Hanzo - Have you heard from your father.ogg'],
        ],
        [
            'Kiriko',
            "A little. It's been harder to contact him since you escaped the Hashimoto.",
            'harder to contact him',
            [
                "File:Kiriko - A little. It's been harder to contact him since you escaped the Hashimoto.ogg",
            ],
        ],
        [
            'Hanzo',
            'I did not wish to make matters worse for him. I\'m sorry.',
            'make matters worse for him',
            ["File:Hanzo - I did not wish to make matters worse for him. I'm sorry.ogg"],
        ],
        [
            'Kiriko',
            "**reassuring sigh** Don't be. I'm sure he's just glad you're back.",
            "just glad you're back",
            ["File:Kiriko - Don't be. I'm sure he's just glad you're back.ogg"],
        ],
    ]);

    await addConv(conversations, done, 'hourly patrols', 'Hourly Patrols', [
        [
            'Kiriko',
            'The Hashimoto run hourly patrols. We can sneak into the castle when they change shifts.',
            'hourly patrols',
            [
                'File:Kiriko - The Hashimoto run hourly patrols. We can sneak into the castle when they change shifts.ogg',
            ],
        ],
        [
            'Hanzo',
            'I am... impressed. Your preparations are quite diligent.',
            'preparations are quite diligent',
            ['File:Hanzo - I am... impressed. Your preparations are quite diligent.ogg'],
        ],
        [
            'Kiriko',
            'Well, I had to kill time until someone came back...',
            'kill time until someone',
            ['File:Kiriko - Well, I had to kill time until someone came back.ogg'],
        ],
        [
            'Hanzo',
            'Right. Then I will make your patience worthwhile.',
            'patience worthwhile',
            ['File:Hanzo - Right. Then I will make your patience worthwhile.ogg'],
        ],
    ]);

    await addConv(conversations, done, 'kept up with the sword', 'Keep Up Sword', [
        [
            'Kiriko',
            "My mom wants to know if you've kept up with the sword.",
            'kept up with the sword',
            ["File:Kiriko - My mom wants to know if you've kept up with the sword.ogg"],
        ],
        [
            'Hanzo',
            'I swore... never to wield a blade again.',
            'never to wield a blade',
            ['File:Hanzo - I swore never to wield a blade again.ogg'],
        ],
        [
            'Kiriko',
            "Mm. I'll tell her you're thinking of picking it back up.",
            'picking it back up',
            ["File:Kiriko - I'll tell her you're thinking about picking it back up.ogg"],
        ],
    ]);

    await addConv(conversations, done, 'Send my greetings to', 'Asa-sensei', [
        [
            'Hanzo',
            'Send my greetings to... Asa-sensei.',
            'Send my greetings to',
            ['File:Hanzo - Send my greetings to Asa-sensei.ogg'],
        ],
        [
            'Kiriko',
            'You can say hi yourself.',
            'say hi yourself',
            ['File:Kiriko - You can say hi yourself.ogg'],
        ],
    ]);

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(done.length ? done.join('\n') : 'nothing added');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
