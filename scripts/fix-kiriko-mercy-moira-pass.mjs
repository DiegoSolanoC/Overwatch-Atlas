#!/usr/bin/env node
/**
 * Kiriko + Mercy + Moira pass.
 *
 * Kiriko:
 * - Bombs (Kiriko ↔ Junkrat, 2-way multipath)
 * - Lucky Amulet / Lost Amulet / Suspicious / Softie / Last Night / New Hat (↔ Mizuki)
 * - Bandage / Cheery (↔ Moira)
 *
 * Mercy:
 * - Doctor Ziegler (Mauga ↔ Mercy)
 * - Staff Tricks (Wuyang ↔ Mercy)
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

const HERO_FOLDER = {};

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
            if (!title) continue;
            const resolved = await resolveWikiFileDownloadUrl(title);
            if (!resolved) continue;
            return ensureWiki(title);
        }
        return '';
    }
}

function makeLine(hero, subtitles, voice, id = createDialogueLineId()) {
    return {
        id,
        hero,
        voice: voice || '',
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

function finalizeVoices(conv) {
    for (const line of conv.lines) {
        if (line.voice && !fs.existsSync(path.join(VOICELINES_DIR, line.voice))) {
            line.voice = '';
        }
    }
}

/**
 * @param {object} conv
 * @param {string} label
 * @param {string[]} done
 */
function pushDone(conv, label, done) {
    finalizeVoices(conv);
    done.push(
        `${label} (${conv.id}) — voices: ${conv.lines.map((l) => (l.voice ? 'yes' : 'pending')).join('/')}`,
    );
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = raw.conversations;
    /** @type {string[]} */
    const done = [];

    // --- Bombs (Kiriko ↔ Junkrat multipath) ---
    {
        if (hasSubtitle(conversations, 'pull all those heists')) {
            console.log('skip (exists): Bombs');
        } else {
            const k1 = makeLine(
                'Kiriko',
                "So, how'd you pull all those heists?",
                await copyVoiceOrWiki('Kiriko', 'pull all those heists', [
                    "File:Kiriko - So, how'd you pull all those heists.ogg",
                ]),
            );
            const j1 = makeLine(
                'Junkrat',
                'Bombs!',
                await copyVoiceOrWiki('Junkrat', 'Bombs!', ['File:Junkrat - Bombs!.ogg']),
            );
            const k2 = makeLine(
                'Kiriko',
                'Uh huh. And...?',
                await copyVoiceOrWiki('Kiriko', 'Uh huh. And', ['File:Kiriko - Uh huh. And.ogg']),
            );
            const jStep = makeLine(
                'Junkrat',
                'Was-- w-was there supposed to be another step?',
                await copyVoiceOrWiki('Junkrat', 'another step', [
                    'File:Junkrat - Was--was there supposed to be another step.ogg',
                ]),
            );
            const jMore = makeLine(
                'Junkrat',
                'Get this: more bombs!',
                await copyVoiceOrWiki('Junkrat', 'Get this', [
                    'File:Junkrat - Get this. More bombs.ogg',
                    'File:Junkrat - Get this: More bombs!.ogg',
                ]),
            );

            const conv = buildBlankConversationRecord();
            conv.name = 'Bombs';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [k1, j1, k2, jStep, jMore];
            conv.paths = [
                {
                    id: createDialoguePathId(),
                    label: 'Another step',
                    lineIds: [k1.id, j1.id, k2.id, jStep.id],
                },
                {
                    id: createDialoguePathId(),
                    label: 'More bombs',
                    lineIds: [k1.id, j1.id, k2.id, jMore.id],
                },
            ];
            conv.selectedPathId = conv.paths[0].id;
            conversations.push(conv);
            pushDone(conv, 'Bombs', done);
        }
    }

    // --- Lucky Amulet ---
    {
        if (hasSubtitle(conversations, 'Lucky Lucky Good Luck Amulet. I have a good feeling')) {
            console.log('skip (exists): Lucky Amulet');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Lucky Amulet';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mizuki',
                    'Bought another Lucky Lucky Good Luck Amulet. I have a good feeling about today.',
                    await copyVoiceOrWiki('Mizuki', 'Bought another Lucky Lucky', [
                        'File:Mizuki - Bought another Lucky Lucky Good Luck Amulet. I have a good feeling about today.ogg',
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "I hope you don't buy those often. Pretty sure they're a scam.",
                    await copyVoiceOrWiki('Kiriko', "they're a scam", [
                        "File:Kiriko - I hope you don't buy those often. Pretty sure they're a scam.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'Every week since I got to Kanezaka.',
                    await copyVoiceOrWiki('Mizuki', 'Every week since I got to Kanezaka', [
                        'File:Mizuki - Every week since I got to Kanezaka.ogg',
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "See... this is why you're broke.",
                    await copyVoiceOrWiki('Kiriko', "why you're broke", [
                        "File:Kiriko - See... this is why you're broke.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Lucky Amulet', done);
        }
    }

    // --- Lost Amulet ---
    {
        if (hasSubtitle(conversations, "lost this week's Lucky Lucky")) {
            console.log('skip (exists): Lost Amulet');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Lost Amulet';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mizuki',
                    'Kiriko. I really need your help.',
                    await copyVoiceOrWiki('Mizuki', 'really need your help', [
                        'File:Mizuki - Kiriko. I really need your help.ogg',
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "What's wrong?",
                    await copyVoiceOrWiki('Kiriko', "What's wrong", [
                        "File:Kiriko - What's wrong.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    "I lost this week's Lucky Lucky Good Luck Amulet...",
                    await copyVoiceOrWiki('Mizuki', "lost this week's Lucky Lucky", [
                        "File:Mizuki - I lost this week's Lucky Lucky Good Luck Amulet.ogg",
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "There, there. I'll pray for you later.",
                    await copyVoiceOrWiki('Kiriko', "I'll pray for you later", [
                        "File:Kiriko - There there. I'll pray for you later.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Lost Amulet', done);
        }
    }

    // --- Suspicious ---
    {
        if (hasSubtitle(conversations, 'Not sure Hanzo likes me')) {
            console.log('skip (exists): Suspicious');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Suspicious';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mizuki',
                    'Not sure Hanzo likes me much.',
                    await copyVoiceOrWiki('Mizuki', 'Not sure Hanzo likes me', [
                        'File:Mizuki - Not sure Hanzo likes me much.ogg',
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "Oh, don't take it personal. He thinks everyone's suspicious.",
                    await copyVoiceOrWiki('Kiriko', "don't take it personal", [
                        "File:Kiriko - Oh, don't take it personal. He thinks everyone's suspicious.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    "Aw, but I'm such a stand-up guy. You trust me, right?",
                    await copyVoiceOrWiki('Mizuki', "stand up guy", [
                        "File:Mizuki - Aw, but I'm such a stand-up guy. You trust me, right.ogg",
                        "File:Mizuki - Aw, but I'm such a stand up guy. You trust me, right.ogg",
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    'Uh... not when you say it like that...',
                    await copyVoiceOrWiki('Kiriko', 'not when you say it like that', [
                        'File:Kiriko - Uh... not when you say it like that.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Suspicious', done);
        }
    }

    // --- Softie ---
    {
        if (hasSubtitle(conversations, 'tagging on Hashimoto turf')) {
            console.log('skip (exists): Softie');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Softie';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mizuki',
                    "Tell Ryōta to stop tagging on Hashimoto turf. If they catch him, he's screwed.",
                    await copyVoiceOrWiki('Mizuki', 'tagging on Hashimoto turf', [
                        "File:Mizuki - Tell Ryota to stop tagging on Hashimoto turf. If they catch him, he's screwed.ogg",
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "Mizuki... You're actually a huge softie, aren't you?",
                    await copyVoiceOrWiki('Kiriko', 'huge softie', [
                        "File:Kiriko - Mizuki... You're actually a huge softie, aren't you.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    "Quit messing around. Don't you know what they do to people that piss them off?",
                    await copyVoiceOrWiki('Mizuki', 'Quit messing around', [
                        "File:Mizuki - Quit messing around. Don't you know what they do to people that piss them off.ogg",
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "Relax, I'll talk to him. It's just funny you try to hide how much you care.",
                    await copyVoiceOrWiki('Kiriko', 'hide how much you care', [
                        "File:Kiriko - Relax, I'll talk to him. It's just funny you try to hide how much you care.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Softie', done);
        }
    }

    // --- Last Night ---
    {
        if (hasSubtitle(conversations, "Where were you last night")) {
            console.log('skip (exists): Last Night');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Last Night';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Kiriko',
                    "Where were you last night? Chikasa said she couldn't get a hold of you.",
                    await copyVoiceOrWiki('Kiriko', 'Where were you last night', [
                        "File:Kiriko - Where were you last night? Chikasa said she couldn't get ahold of you.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    "If I told you, I'd have to kill you.",
                    await copyVoiceOrWiki('Mizuki', "I'd have to kill you", [
                        "File:Mizuki - If I told you, I'd have to kill you.ogg",
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "Ugh. Can't you answer normally for once?",
                    await copyVoiceOrWiki('Kiriko', 'answer normally for once', [
                        "File:Kiriko - (sigh) Can't you answer normally for once.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'Nah. I like making you mad.',
                    await copyVoiceOrWiki('Mizuki', 'making you mad', [
                        'File:Mizuki - Naw. I like making you mad.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Last Night', done);
        }
    }

    // --- New Hat ---
    {
        if (hasSubtitle(conversations, 'new hat looks lighter')) {
            console.log('skip (exists): New Hat');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'New Hat';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Kiriko',
                    'Your new hat looks lighter. Nobuto did a good job.',
                    await copyVoiceOrWiki('Kiriko', 'new hat looks lighter', [
                        'File:Kiriko - Your new hat looks lighter. Nobuto did a good job.ogg',
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'Yeah, I like it. Wish it was a little more lowkey, though.',
                    await copyVoiceOrWiki('Mizuki', 'more lowkey', [
                        'File:Mizuki - Yeah, I like it. Wish it was a little more lowkey though.ogg',
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    "Right? If the Hashimoto find out what he can make, they'll paint a target on his back for sure.",
                    await copyVoiceOrWiki('Kiriko', 'paint a target on his back', [
                        "File:Kiriko - Right? If the Hashimoto find out what he can make, they'll paint a target on his back for sure.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'They do love a fashion statement.',
                    await copyVoiceOrWiki('Mizuki', 'fashion statement', [
                        'File:Mizuki - They do love a fashion statement.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'New Hat', done);
        }
    }

    // --- Bandage (Kiriko ↔ Moira) — game says "bandage", not "band-aid" ---
    {
        if (hasSubtitle(conversations, 'carries bandages') || hasSubtitle(conversations, 'carries band-aids')) {
            console.log('skip (exists): Bandage');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Bandage';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Kiriko',
                    'You have a bandage?',
                    await copyVoiceOrWiki('Kiriko', 'You have a bandage', [
                        'File:Kiriko - You have a bandage.ogg',
                    ]),
                ),
                makeLine(
                    'Moira',
                    'Who exactly do you think I am?',
                    await copyVoiceOrWiki('Moira', 'Who exactly do you think I am', [
                        'File:Moira - Who exactly do you think I am.ogg',
                    ]),
                ),
                makeLine(
                    'Kiriko',
                    'Someone who carries bandages? Guess not.',
                    await copyVoiceOrWiki('Kiriko', 'carries bandages', [
                        'File:Kiriko - Someone who carries bandages. Guess not.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Bandage', done);
        }
    }

    // --- Cheery (Kiriko ↔ Moira) ---
    {
        if (hasSubtitle(conversations, 'You look cheery')) {
            console.log('skip (exists): Cheery');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Cheery';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Kiriko',
                    'Yikes... You look cheery.',
                    await copyVoiceOrWiki('Kiriko', 'You look cheery', [
                        'File:Kiriko - (Japanese) Yikes... You look cheery.ogg',
                        'File:Kiriko - Yikes... You look cheery.ogg',
                    ]),
                ),
                makeLine(
                    'Moira',
                    '**scoff** As cheery as you are significant.',
                    await copyVoiceOrWiki('Moira', 'As cheery as you are significant', [
                        'File:Moira - As cheery as you are significant.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Cheery', done);
        }
    }

    // --- Doctor Ziegler (Mauga ↔ Mercy) ---
    {
        if (hasSubtitle(conversations, 'I can call you Angela')) {
            console.log('skip (exists): Doctor Ziegler');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Doctor Ziegler';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mauga',
                    'Angela! **chuckle** I can call you Angela, right?',
                    await copyVoiceOrWiki('Mauga', 'call you Angela', [
                        'File:Mauga - Angela! (chuckles) I can call you Angela, right.ogg',
                    ]),
                ),
                makeLine(
                    'Mercy',
                    'For you? Doctor Ziegler.',
                    await copyVoiceOrWiki('Mercy', 'Doctor Ziegler', [
                        'File:Mercy - For you. Doctor Ziegler.ogg',
                    ]),
                ),
                makeLine(
                    'Mauga',
                    'Aw... I\'m a little hurt... "Doctor".',
                    await copyVoiceOrWiki('Mauga', "I'm a little hurt", [
                        'File:Mauga - Aw, I\'m a little hurt, Doctor.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Doctor Ziegler', done);
        }
    }

    // --- Staff Tricks (Wuyang ↔ Mercy) ---
    {
        if (hasSubtitle(conversations, 'tricks with the staff')) {
            console.log('skip (exists): Staff Tricks');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Staff Tricks';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Wuyang',
                    'Dr. Ziegler, you should join us next time we run drills! I feel like I only ever see you in the lab.',
                    await copyVoiceOrWiki('Wuyang', 'next time we run drills', [
                        'File:Wuyang - Dr. Ziegler, you should join us next time we run drills! I feel like I only ever see you in the lab.ogg',
                    ]),
                ),
                makeLine(
                    'Mercy',
                    "I'm better at working than training. Why not ask Commander Chase?",
                    await copyVoiceOrWiki('Mercy', 'better at working than training', [
                        "File:Mercy - I'm better at working than training. Why not ask Commander Chase.ogg",
                    ]),
                ),
                makeLine(
                    'Wuyang',
                    'Well... I was hoping to pick up some of your tricks with the staff.',
                    await copyVoiceOrWiki('Wuyang', 'tricks with the staff', [
                        'File:Wuyang - Well... I was hoping to pick up some of your tricks with the staff.ogg',
                    ]),
                ),
                makeLine(
                    'Mercy',
                    "If you promise to be patient with me, I'll do my best.",
                    await copyVoiceOrWiki('Mercy', 'patient with me', [
                        "File:Mercy - If you promise to be patient with me, I'll do my best.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Staff Tricks', done);
        }
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(done.join('\n') || '(nothing new)');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
