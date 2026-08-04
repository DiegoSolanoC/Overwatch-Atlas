#!/usr/bin/env node
/**
 * Illari / Juno / Mizuki / Wuyang pass.
 *
 * - Control over Fate (Illari ↔ Mizuki) — upgrade to 2-way multipath
 * - Sunglasses (Illari ↔ Wuyang)
 * - Largest Hat (Juno ↔ Mizuki)
 * - Landing Site (Juno ↔ Tracer)
 * - Turtle (Lúcio ↔ Mizuki)
 * - Waterfall (Mizuki ↔ Wuyang)
 * - Interns (Reaper ↔ Wuyang)
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

const HERO_FOLDER = {
    Lúcio: 'Lúcio',
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

function keepId(lines, pred) {
    return (lines || []).find(pred)?.id || createDialogueLineId();
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

    // --- Control over Fate (Illari ↔ Mizuki multipath) ---
    {
        const conv =
            conversations.find((c) => c.name === 'Control over Fate') ||
            conversations.find((c) =>
                (c.lines || []).some((l) => /control over my own fate/i.test(l.subtitles || '')),
            );

        if (!conv) throw new Error('Control over Fate conversation not found');

        const illari = makeLine(
            'Illari',
            "**sigh** I wish I'd had control over my own fate that day...",
            await copyVoiceOrWiki('Illari', 'control over my own fate', [
                "File:Illari - (sigh) I wish I'd had control over my own fate that day.ogg",
            ]),
            keepId(conv.lines, (l) => /control over my own fate/i.test(l.subtitles || '')),
        );
        const beenThere = makeLine(
            'Mizuki',
            "Yeah, I've been there too.",
            await copyVoiceOrWiki('Mizuki', "I've been there too", [
                "File:Mizuki - Yeah, I've been there too.ogg",
            ]),
            keepId(conv.lines, (l) => /I've been there too/i.test(l.subtitles || '')),
        );
        const allBeen = makeLine(
            'Mizuki',
            "Yeah, we've all been there.",
            await copyVoiceOrWiki('Mizuki', "we've all been there", [
                "File:Mizuki - Yeah, we've all been there.ogg",
            ]),
            keepId(conv.lines, (l) => /we've all been there/i.test(l.subtitles || '')),
        );

        conv.name = 'Control over Fate';
        conv.scene = conv.scene || DEFAULT_DIALOGUE_SCENE;
        conv.status = 'active';
        conv.lines = [illari, beenThere, allBeen];
        conv.paths = [
            {
                id: createDialoguePathId(),
                label: "I've been there",
                lineIds: [illari.id, beenThere.id],
            },
            {
                id: createDialoguePathId(),
                label: "We've all been there",
                lineIds: [illari.id, allBeen.id],
            },
        ];
        conv.selectedPathId = conv.paths[0].id;
        pushDone(conv, 'Control over Fate (multipath)', done);
    }

    // --- Sunglasses ---
    {
        if (hasSubtitle(conversations, 'channel solar energy')) {
            console.log('skip (exists): Sunglasses');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Sunglasses';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Illari',
                    'Hey. Why do you cover your eyes when I channel solar energy?',
                    await copyVoiceOrWiki('Illari', 'cover your eyes when I channel', [
                        'File:Illari - Hey. Why do you cover your eyes when I channel solar energy.ogg',
                    ]),
                ),
                makeLine(
                    'Wuyang',
                    "Everyone knows it's not safe to look at the sun without sunglasses.",
                    await copyVoiceOrWiki('Wuyang', 'without sunglasses', [
                        "File:Wuyang - Everyone knows it's not safe to look at the sun without sunglasses.ogg",
                    ]),
                ),
                makeLine(
                    'Illari',
                    'Um... it is not safe to look at the sun at all.',
                    await copyVoiceOrWiki('Illari', 'not safe to look at the sun at all', [
                        'File:Illari - Um... It is not safe to look at the sun at all.ogg',
                    ]),
                ),
                makeLine(
                    'Wuyang',
                    'Oh. Pfft, I knew that! I was just testing you!',
                    await copyVoiceOrWiki('Wuyang', 'just testing you', [
                        'File:Wuyang - Oh. Pfft, I knew that. I was just testing you.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Sunglasses', done);
        }
    }

    // --- Largest Hat ---
    {
        if (hasSubtitle(conversations, 'largest hat I have ever seen')) {
            console.log('skip (exists): Largest Hat');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Largest Hat';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Juno',
                    'That is the largest hat I have ever seen!',
                    await copyVoiceOrWiki('Juno', 'largest hat I have ever seen', [
                        'File:Juno - That is the largest hat I have ever seen.ogg',
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'Thanks. A friend made it for me.',
                    await copyVoiceOrWiki('Mizuki', 'A friend made it for me', [
                        'File:Mizuki - Thanks. A friend made it for me.ogg',
                    ]),
                ),
                makeLine(
                    'Juno',
                    'It is handmade too? They must care about you very much...',
                    await copyVoiceOrWiki('Juno', 'handmade too', [
                        'File:Juno - It is handmade too! They must care about you very much.ogg',
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'Yeah... maybe they do.',
                    await copyVoiceOrWiki('Mizuki', 'maybe they do', [
                        'File:Mizuki - Yeah... maybe they do.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Largest Hat', done);
        }
    }

    // --- Landing Site ---
    {
        if (hasSubtitle(conversations, 'wandered so far from my landing site')) {
            console.log('skip (exists): Landing Site');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Landing Site';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Juno',
                    'How did you and Winston even find me? I wandered so far from my landing site.',
                    await copyVoiceOrWiki('Juno', 'wandered so far from my landing site', [
                        'File:Juno - How did you and Winston even find me. I wandered so far from my landing site.ogg',
                    ]),
                ),
                makeLine(
                    'Tracer',
                    "We just had to ask the locals! Not everyday a Martian drops out of the sky!",
                    await copyVoiceOrWiki('Tracer', 'Martian drops out of the sky', [
                        'File:Tracer - We just had to ask the locals! Not everyday a Martian drops out of the sky.ogg',
                    ]),
                ),
                makeLine(
                    'Juno',
                    '**embarrassed laugh** I suppose it must have been a spectacle.',
                    await copyVoiceOrWiki('Juno', 'must have been a spectacle', [
                        'File:Juno - (embarrassed laugh) I suppose it must have been a spectacle.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Landing Site', done);
        }
    }

    // --- Turtle ---
    {
        if (hasSubtitle(conversations, "favorite animal isn't a turtle")) {
            console.log('skip (exists): Turtle');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Turtle';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Lúcio',
                    "You're really tellin' me your favorite animal isn't a turtle?",
                    await copyVoiceOrWiki('Lúcio', "favorite animal isn't a turtle", [
                        "File:Lúcio - You're really telling me your favorite animal isn't a turtle.ogg",
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'What, because of the hat? Do you wear a frog on your head?',
                    await copyVoiceOrWiki('Mizuki', 'frog on your head', [
                        'File:Mizuki - What, because of the hat. Do you wear a frog on your head.ogg',
                    ]),
                ),
                makeLine(
                    'Lúcio',
                    'Yeah, sometimes!',
                    await copyVoiceOrWiki('Lúcio', 'Yeah, sometimes', [
                        'File:Lúcio - Yeah, sometimes.ogg',
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    'You gotta be kidding me.',
                    await copyVoiceOrWiki('Mizuki', 'gotta be kidding me', [
                        'File:Mizuki - You gotta be kidding me.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Turtle', done);
        }
    }

    // --- Waterfall ---
    {
        if (hasSubtitle(conversations, 'waterfall to stand under')) {
            console.log('skip (exists): Waterfall');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Waterfall';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Mizuki',
                    "**sigh** The spirits are breathing down my neck again... gotta find a waterfall to stand under.",
                    await copyVoiceOrWiki('Mizuki', 'waterfall to stand under', [
                        'File:Mizuki - The spirits are breathing down my neck again... gotta find a waterfall to stand under.ogg',
                    ]),
                ),
                makeLine(
                    'Wuyang',
                    'Uh, I could make a really big wave?',
                    await copyVoiceOrWiki('Wuyang', 'really big wave', [
                        'File:Wuyang - Uh, I could make a really big wave.ogg',
                    ]),
                ),
                makeLine(
                    'Mizuki',
                    "**frustrated huff** It's not the same.",
                    await copyVoiceOrWiki('Mizuki', "It's not the same", [
                        "File:Mizuki - (huff) It's not the same.ogg",
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Waterfall', done);
        }
    }

    // --- Interns ---
    {
        if (hasSubtitle(conversations, 'hiring interns now')) {
            console.log('skip (exists): Interns');
        } else {
            const conv = buildBlankConversationRecord();
            conv.name = 'Interns';
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.lines = [
                makeLine(
                    'Reaper',
                    'So, Overwatch is hiring interns now. How adorable.',
                    await copyVoiceOrWiki('Reaper', 'hiring interns now', [
                        'File:Reaper - So, Overwatch is hiring interns now. How adorable.ogg',
                    ]),
                ),
                makeLine(
                    'Wuyang',
                    'I know, right? I actually applied just before you ran away from Talon.',
                    await copyVoiceOrWiki('Wuyang', 'ran away from Talon', [
                        'File:Wuyang - I know, right. I actually applied just before you ran away from Talon.ogg',
                    ]),
                ),
            ];
            conversations.push(conv);
            pushDone(conv, 'Interns', done);
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
