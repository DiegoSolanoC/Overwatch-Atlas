#!/usr/bin/env node
/**
 * Junkrat pass:
 * - Add missing Ashe / Cassidy / Hanzo / Lúcio concert multipath / Zenyatta interactions
 * - Rebuild Got a problem as linear Reaper → Roadhog → Junkrat → Roadhog
 * - Wire Junkrat "Uh... why?" on chicken multipath from wiki
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

async function copyWiki(titles) {
    const list = Array.isArray(titles) ? titles : [titles];
    for (const title of list) {
        const resolved = await resolveWikiFileDownloadUrl(title);
        if (!resolved) continue;
        const atlas = wikiFileTitleToTheaterFilename(title);
        const dest = path.join(VOICELINES_DIR, atlas);
        if (!fs.existsSync(dest)) await downloadWikiVoicelineFile(title, dest);
        return atlas;
    }
    throw new Error(`Wiki missing: ${list.join(' | ')}`);
}

async function copyVoiceOrWiki(hero, needle, wikiTitles, heroFolder = hero) {
    try {
        return await copyVoice(hero, needle, heroFolder);
    } catch {
        return copyWiki(wikiTitles);
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
    for (const spec of specs) {
        const [hero, subtitles, needle, wiki] = spec;
        const voice = wiki
            ? await copyVoiceOrWiki(hero, needle, wiki)
            : await copyVoice(hero, needle);
        conv.lines.push(makeLine(hero, subtitles, voice));
    }
    conversations.push(conv);
    added.push(name);
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    await addConv(conversations, done, "stick o' dynamite", 'Admirable', [
        [
            'Junkrat',
            "One stick o' dynamite? Well, that's just adorable.",
            'stick o',
            ["File:Junkrat - One stick o' dynamite. Well that's just adorable.ogg"],
        ],
        ['Ashe', 'BOB!', 'Bob', ['File:Ashe - Bob (1).ogg']],
        [
            'Junkrat',
            'I meant admirable! Admirable!',
            'admirable',
            ['File:Junkrat - I meant admirable! Admirable.ogg'],
        ],
    ]);

    await addConv(conversations, done, 'rob any trains', 'Rob trains', [
        ['Cassidy', 'You rob any trains in your day?', 'rob any trains'],
        [
            'Junkrat',
            'Argh, they get all gummed up together in a big pile when I try!',
            'gummed up',
        ],
        [
            'Cassidy',
            "...You're supposed to stop them first.",
            'stop them first',
        ],
        [
            'Junkrat',
            'I do stop them. I think my problem is that I stop them a little too hard...',
            'stop them a little too hard',
        ],
    ]);

    await addConv(conversations, done, "What's on your mind, mate", 'Cheer up snacks', [
        [
            'Junkrat',
            "What's on your mind, mate?",
            "What's on your mind",
            ["File:Junkrat - What's on your mind, mate.ogg"],
        ],
        [
            'Hanzo',
            'I am thinking of what I have lost.',
            'thinking of what I have lost',
            ['File:Hanzo - I am thinking of what I have lost.ogg'],
        ],
        [
            'Junkrat',
            "What, your keys? Arrows? Snacks? I've got snacks. Cheer up!",
            'got snacks',
            [
                "File:Junkrat - What, your keys. Arrows. Snacks. I've got snacks. Cheer up.ogg",
            ],
        ],
    ]);

    // Concert multipath
    if (!hasSubtitle(conversations, 'do a concert together')) {
        const opener = makeLine(
            'Junkrat',
            'We should do a concert together.',
            await copyVoice('Junkrat', 'concert together'),
        );
        const ask = makeLine(
            'Lúcio',
            'Oh, what do you play?',
            await copyVoice('Lúcio', 'What do you play', 'Lúcio'),
        );
        const sings = [
            [
                'Laaaa',
                'I sing. Laaaa... *continues singing*',
                'Laaaa',
            ],
            [
                'Scales',
                'I sing. La la la la la la... *singing scales*',
                'singing scales',
            ],
            [
                'Operatic',
                'I-I sing! *high operatic singing*',
                'high operatic',
            ],
            [
                'Figaro',
                'I sing. Figaro, figaro-figaro-figaro-figaro, figaro... ooh-ooooh!',
                'Figaro',
            ],
        ];
        const singLines = [];
        for (const [label, sub, needle] of sings) {
            singLines.push({
                label,
                line: makeLine('Junkrat', sub, await copyVoice('Junkrat', needle)),
            });
        }
        const closer = makeLine(
            'Lúcio',
            "Wow. Yeah, uh... I'll have to get back to you on that.",
            await copyVoice('Lúcio', 'get back to you', 'Lúcio'),
        );
        const conv = buildBlankConversationRecord();
        conv.name = 'Concert together';
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.lines = [opener, ask, ...singLines.map((s) => s.line), closer];
        conv.paths = singLines.map(({ label, line }) => ({
            id: createDialoguePathId(),
            label,
            lineIds: [opener.id, ask.id, line.id, closer.id],
        }));
        conv.selectedPathId = conv.paths[0].id;
        conversations.push(conv);
        done.push('Concert together (4 paths)');
    }

    await addConv(conversations, done, 'strangest bot', 'Strangest bot', [
        [
            'Junkrat',
            "*half-whispering:* Look, he's the strangest bot I've ever seen. That's all I'm sayin'.",
            'strangest bot',
        ],
        [
            'Zenyatta',
            'Strangeness is in the eye of the beholder.',
            'Strangeness is in the eye',
        ],
        [
            'Junkrat',
            'Oh no, he heard me. This is so awkward...',
            'so awkward',
        ],
    ]);

    await addConv(conversations, done, 'interviewing this fancy robot', 'Fancy robot', [
        [
            'Junkrat',
            'Jamison Fawkes, interviewing this fancy robot. Any wisdom to share with us as the battle begins?',
            'fancy robot',
        ],
        [
            'Zenyatta',
            'Victory goes to those who maintain their focus.',
            'maintain their focus',
        ],
        [
            'Junkrat',
            'Boring! Back to you, Natasha—any car chases we could watch?',
            'Natasha',
        ],
    ]);

    // Got a problem — rebuild as linear 4-line (user/wiki Junkrat page)
    {
        const c =
            conversations.find((x) => x.id === 'f7cfc9fd-b3c4-4be5-9e35-da36eb711508') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /problem, Junker/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Got a problem not found');

        const reaper = makeLine(
            'Reaper',
            'You got a problem, Junker?',
            await copyVoiceOrWiki('Reaper', 'problem, Junker', [
                'File:Reaper - You got a problem, Junker.ogg',
            ]),
            keepId(c.lines, (l) => /problem, Junker/i.test(l.subtitles || '')),
        );
        const chuckle = makeLine(
            'Roadhog',
            '*(chuckle)*',
            await copyVoiceOrWiki('Roadhog', '(chuckle)', [
                'File:Roadhog - (chuckle) (1).ogg',
            ]),
            keepId(c.lines, (l) => /chuckle/i.test(l.subtitles || '') && !/Yeah/i.test(l.subtitles || '')),
        );
        const junkrat = makeLine(
            'Junkrat',
            "I don't do problems. Just solutions!",
            await copyVoiceOrWiki('Junkrat', 'just solutions', [
                "File:Junkrat - I don't do problems—just solutions.ogg",
                "File:Junkrat - I don't do problems - just solutions.ogg",
                "File:Junkrat - I don’t do problems - just solutions.ogg",
            ]),
            keepId(c.lines, (l) => /just solutions/i.test(l.subtitles || '')),
        );
        const yeah = makeLine(
            'Roadhog',
            '*(laughs)* Yeah!',
            await copyVoiceOrWiki('Roadhog', 'Yeah. (wet', [
                'File:Roadhog - Yeah (5).ogg',
            ]),
            keepId(c.lines, (l) => /Yeah/i.test(l.subtitles || '')),
        );

        c.name = 'Got a problem';
        c.lines = [reaper, chuckle, junkrat, yeah];
        delete c.paths;
        delete c.selectedPathId;
        done.push('Got a problem → linear 4-line');
    }

    // Chicken — wire Junkrat Uh... why
    {
        const c =
            conversations.find((x) => x.id === '2ade2627-3e81-4d77-8ea0-63b3d99509eb') ||
            conversations.find((x) =>
                (x.lines || []).some((l) =>
                    /chicken cross the road/i.test(String(l.subtitles || '')),
                ),
            );
        if (!c) throw new Error('Chicken cross conversation not found');

        const junkrat = c.lines.find(
            (l) => l.hero === 'Junkrat' && /why/i.test(String(l.subtitles || '')),
        );
        if (!junkrat) throw new Error('Junkrat why line missing on chicken multipath');

        junkrat.voice = await copyWiki(['File:Junkrat - Why.ogg']);
        junkrat.subtitles = 'Uh... why?';
        junkrat.render = 'Heroic.png';
        done.push('wired: chicken Junkrat Uh... why?');
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Done:\n- ${done.join('\n- ')}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
