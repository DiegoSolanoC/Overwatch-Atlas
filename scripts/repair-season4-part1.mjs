#!/usr/bin/env node
/**
 * Season 4 part-one repair (Hammeh video pass):
 * - Rename / rebuild correct interactions
 * - Wire MatchTalk audio
 * - Clear bogus single-path multipath
 * - Fix SFX subtitle formatting
 * - Refresh theater-assets-manifest.json
 *
 * Usage:
 *   node scripts/repair-season4-part1.mjs --dry-run
 *   node scripts/repair-season4-part1.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
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

const ERA = 'Season 4 (YouTube placeholder)';
const dryRun = process.argv.includes('--dry-run');

/** Disk MatchTalk folder when display name differs. */
const HERO_FOLDER = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_ 76',
};

/** Theater voice filename hero prefix when display name differs. */
const ATLAS_HERO = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
};

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[''`´]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function atlasFromLabel(hero, label) {
    const prefix = String(ATLAS_HERO[hero] || hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

/**
 * Recursive MatchTalk .0B2 search.
 * @param {string} hero
 * @param {string} needle
 * @returns {{ source: string, label: string, score: number } | null}
 */
function findOgg(hero, needle) {
    const folder = HERO_FOLDER[hero] || hero;
    const root = path.join(EXTRACT_ROOT, folder, 'MatchTalk');
    if (!fs.existsSync(root)) return null;
    const n = norm(needle);
    if (!n) return null;

    /** @type {{ source: string, label: string, score: number }[]} */
    const hits = [];

    function walk(dir) {
        let ents;
        try {
            ents = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of ents) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(e.name) || !/\.0B2-/i.test(e.name)) continue;
            const label = e.name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
            const ln = norm(label);
            if (ln === n) hits.push({ source: full, label, score: 0 });
            else if (ln.includes(n)) {
                hits.push({
                    source: full,
                    label,
                    score: Math.abs(ln.length - n.length) + (ln.startsWith(n) ? 0 : 5),
                });
            } else if (n.includes(ln) && ln.length >= Math.min(8, n.length)) {
                // Avoid short false positives like "no" inside "naengmyeon".
                hits.push({
                    source: full,
                    label,
                    score: Math.abs(ln.length - n.length) + 10,
                });
            }
        }
    }
    walk(root);
    hits.sort((a, b) => a.score - b.score);
    return hits[0] || null;
}

/**
 * @param {string} hero
 * @param {string} needle
 */
async function copyVoice(hero, needle) {
    const hit = findOgg(hero, needle);
    if (!hit) throw new Error(`Missing MatchTalk for ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!dryRun && !fs.existsSync(dest)) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        await fsp.copyFile(hit.source, dest);
    }
    return atlas;
}

/**
 * @param {string} folderLabel e.g. "(questioning meows)"
 * @param {number} [variantIndex]
 */
async function copyJetpackSfx(folderLabel, variantIndex = 0) {
    const dir = path.join(EXTRACT_ROOT, 'Jetpack Cat', 'MatchTalk', folderLabel);
    if (!fs.existsSync(dir)) throw new Error(`Missing Jetpack folder ${folderLabel}`);
    const oggs = fs
        .readdirSync(dir)
        .filter((n) => /\.03F\./i.test(n) && /\.ogg$/i.test(n))
        .sort();
    if (!oggs.length) throw new Error(`No .03F in ${folderLabel}`);
    const idx = Math.min(variantIndex, oggs.length - 1);
    const safe = String(folderLabel).replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_');
    const atlas =
        idx <= 0 ? `Jetpack_Cat_-_${safe}.ogg` : `Jetpack_Cat_-_${safe}_(${idx + 1}).ogg`;
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!dryRun && !fs.existsSync(dest)) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        await fsp.copyFile(path.join(dir, oggs[idx]), dest);
    }
    return atlas;
}

/**
 * @param {string} hero
 * @param {string} subtitles
 * @param {string} voice
 * @param {string} [id]
 */
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

/**
 * Find conversation by any line subtitle needle (unique-ish).
 * @param {object[]} conversations
 * @param {string} needle
 */
function findBySubtitle(conversations, needle) {
    const n = norm(needle);
    return conversations.find((c) =>
        (c.lines || []).some((l) => norm(l.subtitles).includes(n)),
    );
}

/**
 * @param {object[]} conversations
 * @param {string} name
 */
function findByName(conversations, name) {
    const n = norm(name);
    return conversations.find((c) => norm(c.name) === n);
}

/**
 * Soft-delete by removing from array.
 * @param {object[]} conversations
 * @param {string} id
 */
function removeById(conversations, id) {
    const idx = conversations.findIndex((c) => c.id === id);
    if (idx >= 0) conversations.splice(idx, 1);
}

/**
 * Clear linear multipath leftovers.
 * @param {object} conv
 */
function clearSinglePath(conv) {
    delete conv.paths;
    delete conv.selectedPathId;
}

/**
 * @param {object} conv
 * @param {string} name
 * @param {Array<{hero:string,subtitles:string,voice:string}>} lines
 * @param {string[]} heroes
 */
function applyLinear(conv, name, lines, heroes) {
    conv.name = name;
    conv.eraName = ERA;
    conv.status = conv.status || 'active';
    conv.entryType = conv.entryType || 'interaction';
    conv.heroes = heroes;
    conv.lines = lines.map((l) =>
        makeLine(l.hero, l.subtitles, l.voice, l.id || createDialogueLineId()),
    );
    clearSinglePath(conv);
}

/**
 * Upsert a linear interaction.
 * @param {object[]} conversations
 * @param {{
 *   name: string,
 *   heroes: string[],
 *   findNeedles: string[],
 *   preferIds?: string[],
 *   lines: Array<{ hero: string, subtitles: string, needle?: string, jetpackFolder?: string, jetpackVariant?: number }>,
 * }} spec
 */
async function upsert(conversations, spec) {
    /** @type {object | undefined} */
    let conv;
    for (const id of spec.preferIds || []) {
        conv = conversations.find((c) => c.id === id);
        if (conv) break;
    }
    if (!conv) {
        for (const needle of spec.findNeedles) {
            conv = findBySubtitle(conversations, needle);
            if (conv) break;
        }
    }
    if (!conv) conv = findByName(conversations, spec.name);

    const builtLines = [];
    for (const row of spec.lines) {
        let voice = '';
        if (row.jetpackFolder) {
            voice = await copyJetpackSfx(row.jetpackFolder, row.jetpackVariant || 0);
        } else if (row.needle) {
            voice = await copyVoice(row.hero, row.needle);
        }
        builtLines.push({
            hero: row.hero,
            subtitles: row.subtitles,
            voice,
            id: undefined,
        });
    }

    // Preserve line ids when rewriting an existing matching conversation of same length/heroes.
    if (conv && Array.isArray(conv.lines) && conv.lines.length === builtLines.length) {
        for (let i = 0; i < builtLines.length; i += 1) {
            builtLines[i].id = conv.lines[i]?.id || createDialogueLineId();
        }
    }

    if (!conv) {
        conv = buildBlankConversationRecord();
        conversations.push(conv);
        console.log(`  + create ${spec.name}`);
    } else {
        console.log(`  ~ update ${conv.name} → ${spec.name}`);
    }

    applyLinear(conv, spec.name, builtLines, spec.heroes);
    return conv;
}

async function main() {
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error(`Extract missing: ${EXTRACT_ROOT}`);
        process.exit(1);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    /** @type {object[]} */
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;

    // --- Remove / neutralize bad glued stubs that will be rebuilt cleanly ---
    const killNeedles = [
        // Glued past-life + celebrities
        { id: 'be2e1178-4edb-4459-9825-1ac35d285623', why: '484 glued past life + celebrities' },
        // Glued fireworks + mizuki opener
        { id: '84832da6-6e70-4d71-9832-77a72c133893', why: '487 glued fireworks + lying' },
        // Duplicate incomplete forgiveness (keep other rebuild)
        { id: '7ce76567-b59b-4412-a302-f493b5a7cbb5', why: 'dup forgiveness incomplete' },
        { id: '3dd93e22-f5a5-4bff-8596-2885764f8e28', why: 'dup forgiveness incomplete' },
    ];
    for (const k of killNeedles) {
        const c = conversations.find((x) => x.id === k.id);
        if (c) {
            console.log(`  - remove ${c.name} (${k.why})`);
            if (!dryRun) removeById(conversations, k.id);
        }
    }

    /** @type {Array<object>} */
    const specs = [
        {
            name: 'Closed restaurant',
            heroes: ['D.mon', 'D.va'],
            findNeedles: ['jjimjilbang', 'naengmyeon'],
            preferIds: ['b2f9a2b7-39ad-47ee-95a8-fd11b16bbd0d'],
            lines: [
                {
                    hero: 'D.mon',
                    subtitles: 'Remember that little jjimjilbang that we used to go to?',
                    needle: 'jjimjilbang',
                },
                {
                    hero: 'D.va',
                    subtitles: 'Duh! How could I forget?',
                    needle: 'How could I forget',
                },
                {
                    hero: 'D.mon',
                    subtitles: 'It closed down! I had to find a new one.',
                    needle: 'closed down',
                },
                {
                    hero: 'D.va',
                    subtitles: 'Nooooo! They had the best naengmyeon!',
                    needle: 'naengmyeon',
                },
            ],
        },
        {
            name: "You didn't leave",
            heroes: ['D.mon', 'D.va'],
            findNeedles: ['leaving MEKA squad', 'exactly where you should be'],
            preferIds: ['96929005-143a-46ab-beea-86655a60fb1f'],
            lines: [
                {
                    hero: 'D.mon',
                    subtitles:
                        "You leaving MEKA squad feels like ages ago. We've all really changed since.",
                    needle: 'leaving MEKA',
                },
                {
                    hero: 'D.va',
                    subtitles: 'Sometimes it feels wrong that I found a home somewhere else.',
                    needle: 'found a home somewhere else',
                },
                {
                    hero: 'D.mon',
                    subtitles:
                        "Hana... you didn't actually leave us. You just grew. You're exactly where you should be.",
                    needle: 'exactly where you should be',
                },
            ],
        },
        {
            name: 'You miss me',
            heroes: ['D.va', 'D.mon'],
            findNeedles: ['moved on fast', "don't miss you"],
            preferIds: ['f04e62d2-f390-430a-8a12-04decfec24d8'],
            lines: [
                {
                    hero: 'D.va',
                    subtitles: 'You guys sure moved on fast after I left!',
                    needle: 'moved on fast',
                },
                {
                    hero: 'D.mon',
                    subtitles:
                        "We changed strategies to survive, Hana. Not because we don't miss you.",
                    needle: "don't miss you",
                },
                {
                    hero: 'D.va',
                    subtitles: 'Well, duh. *(giggle)* Of course you guys miss me.',
                    needle: 'Of course you guys miss me',
                },
                {
                    hero: 'D.mon',
                    subtitles: "Don't make me take that back.",
                    needle: 'take that back',
                },
            ],
        },
        {
            name: "Don't talk much",
            heroes: ['D.mon', 'Roadhog'],
            findNeedles: ['kind of smart', "don't talk enough"],
            preferIds: ['0ef20362-3ae2-4835-b949-265a6eaf980e'],
            lines: [
                {
                    hero: 'D.mon',
                    subtitles: 'The Junkers are a mess... but you actually seem kind of smart.',
                    needle: 'kind of smart',
                },
                {
                    hero: 'Roadhog',
                    subtitles: 'Oh yeah?',
                    needle: 'Oh yeah',
                },
                {
                    hero: 'D.mon',
                    subtitles: "Or maybe you just don't talk enough for people to know.",
                    needle: "don't talk enough",
                },
                {
                    hero: 'Roadhog',
                    subtitles: '*(heh)* Maybe.',
                    needle: '(heh) Maybe',
                },
            ],
        },
        {
            name: 'Tokki is cuter',
            heroes: ['Roadhog', 'D.mon'],
            findNeedles: ["Tokki's cuter", "thing's Beast"],
            lines: [
                {
                    hero: 'Roadhog',
                    subtitles: "That thing's Beast?",
                    needle: "thing's Beast",
                },
                {
                    hero: 'D.mon',
                    subtitles: 'Sure is.',
                    needle: 'Sure is',
                },
                {
                    hero: 'Roadhog',
                    subtitles: "Hm... Tokki's cuter.",
                    needle: "Tokki's cuter",
                },
            ],
        },
        {
            name: 'In a past life',
            heroes: ['Junkrat', 'D.mon'],
            findNeedles: ['thick as thieves', 'not even in your dreams'],
            lines: [
                {
                    hero: 'Junkrat',
                    subtitles:
                        "Fate's made us enemies... but I reckon in a past life, we were thick as thieves. Just two kittens napping on a windowsill.",
                    needle: 'thick as thieves',
                },
                {
                    hero: 'D.mon',
                    subtitles: 'Yeah... not even in your dreams, dude.',
                    needle: 'not even in your dreams',
                },
            ],
        },
        {
            name: 'Soldier celebrities',
            heroes: ['Domina', 'D.mon'],
            findNeedles: ['soldiers of their celebrities'],
            preferIds: ['e622f853-8951-43f6-bef9-8339778b7486'],
            lines: [
                {
                    hero: 'Domina',
                    subtitles: 'MEKA is rather clever to make soldiers of their celebrities.',
                    needle: 'soldiers of their celebrities',
                },
                {
                    hero: 'D.mon',
                    subtitles:
                        "Uh, other way around. We're here to protect the people, not walk a runway.",
                    needle: 'not walk a runway',
                },
                {
                    hero: 'Domina',
                    subtitles:
                        'Hmm, perhaps... though war can be quite glamorous once you clear away the rubble.',
                    needle: 'clear away the rubble',
                },
            ],
        },
        {
            name: 'Real competition',
            heroes: ['Genji', 'D.mon'],
            findNeedles: ['real competition', "didn't hear"],
            preferIds: ['9db7bf9d-faf7-47a4-b89f-8888daa81886'],
            lines: [
                {
                    hero: 'Genji',
                    subtitles:
                        "Finally, I've been relieved of my duty. Now Hana can drag you to the arcade instead.",
                    needle: 'relieved of my duty',
                },
                {
                    hero: 'D.mon',
                    subtitles:
                        "Don't be like that. It's hard for her to find real competition to play with.",
                    needle: 'real competition to play',
                },
                {
                    hero: 'Genji',
                    subtitles: 'Wait. She sees me as real competition?',
                    needle: 'sees me as real competition',
                },
                {
                    hero: 'D.mon',
                    subtitles: "Yeah. But you didn't hear that from me.",
                    needle: "didn't hear that from me",
                },
            ],
        },
        {
            name: 'Lock in',
            heroes: ['Lifeweaver', 'D.mon'],
            findNeedles: ['friend like you in her corner', 'needs to lock in'],
            lines: [
                {
                    hero: 'Lifeweaver',
                    subtitles: "Hana's lucky to have a friend like you in her corner, isn't she?",
                    needle: 'friend like you in her corner',
                },
                {
                    hero: 'D.mon',
                    subtitles: 'Yeah, well, someone needs to remind her when she needs to lock in.',
                    needle: 'needs to lock in',
                },
                {
                    hero: 'Lifeweaver',
                    subtitles: "*(sigh)* I do believe Satya's said the same of me.",
                    needle: "Satya's said the same",
                },
            ],
        },
        {
            name: 'Arcade Girls',
            heroes: ['D.mon', 'Kiriko'],
            findNeedles: ['arcade stick together', 'hardcore arcade girl'],
            preferIds: ['878e3648-c86f-4970-b0ab-3188a73a38b9'],
            lines: [
                {
                    hero: 'D.mon',
                    subtitles: 'You and Hana are pretty tight now.',
                    needle: 'pretty tight now',
                },
                {
                    hero: 'Kiriko',
                    subtitles: 'Well, girls that hit the arcade stick together.',
                    needle: 'arcade stick together',
                },
                {
                    hero: 'D.mon',
                    subtitles: "I'm a hardcore arcade girl. Does that earn me an invite?",
                    needle: 'hardcore arcade girl',
                },
                {
                    hero: 'Kiriko',
                    subtitles: "Obviously! Someone's got to bump her to second on the leaderboards.",
                    needle: 'second on the leaderboards',
                },
            ],
        },
        {
            name: 'Put together',
            heroes: ['Illari', 'D.mon'],
            findNeedles: ['seem so put together', 'key word there is'],
            preferIds: ['7464fc1c-5168-46c4-9c68-c60d9341350d'],
            lines: [
                {
                    hero: 'Illari',
                    subtitles:
                        'Being looked up to, seen as a hero, relied on... you seem so put together.',
                    needle: 'seem so put together',
                },
                {
                    hero: 'D.mon',
                    subtitles: 'The key word there is *seem*. I have my moments too.',
                    needle: 'I have my moments too',
                },
            ],
        },
        {
            name: 'Gracie too',
            heroes: ['Junker Queen', 'Jetpack Cat'],
            findNeedles: ["make 'em bleed, Gracie", 'look more like a Carnage'],
            lines: [
                {
                    hero: 'Junker Queen',
                    subtitles: "It's time to make 'em bleed, Gracie.",
                    needle: "make 'em bleed, Gracie",
                },
                {
                    hero: 'Jetpack Cat',
                    subtitles: '*(questioning meows)*',
                    jetpackFolder: '(questioning meows)',
                },
                {
                    hero: 'Junker Queen',
                    subtitles:
                        "What, your name's Gracie too? Funny, you look more like a Carnage!",
                    needle: 'look more like a Carnage',
                },
                {
                    hero: 'Jetpack Cat',
                    subtitles: '*(unamused meows)*',
                    jetpackFolder: '(unamused meows)',
                },
            ],
        },
        {
            name: 'Dragons available',
            heroes: ['Junker Queen', 'Hanzo'],
            findNeedles: ['dragons available to rent', 'little fireworks'],
            lines: [
                {
                    hero: 'Junker Queen',
                    subtitles: 'Those dragons available to rent?',
                    needle: 'dragons available to rent',
                },
                {
                    hero: 'Hanzo',
                    subtitles: 'Absolutely not.',
                    needle: 'Absolutely not',
                },
                {
                    hero: 'Junker Queen',
                    subtitles:
                        "I want 'em swirling around the New Junk City arena. A proper lightshow for when we crown our champs.",
                    needle: 'swirling around the New Junk City',
                },
                {
                    hero: 'Hanzo',
                    subtitles: 'Then have your foolish lackeys set off their little fireworks!',
                    needle: 'foolish lackeys',
                },
            ],
        },
        {
            name: 'Earn her forgiveness',
            heroes: ['Mizuki', 'Genji'],
            findNeedles: ['hate me for lying', 'earn her forgiveness'],
            lines: [
                {
                    hero: 'Mizuki',
                    subtitles: "Kiriko says she doesn't hate me for lying, but I bet she does.",
                    needle: 'hate me for lying',
                },
                {
                    hero: 'Genji',
                    subtitles:
                        'I do not believe so. Though it will take time to earn her forgiveness.',
                    needle: 'earn her forgiveness',
                },
                {
                    hero: 'Mizuki',
                    subtitles: 'How long did it take for you and Hanzo?',
                    needle: 'How long did it take for you and Hanzo',
                },
                {
                    hero: 'Genji',
                    subtitles:
                        'We have come a long way, but I suspect it is still a work in progress.',
                    needle: 'still a work in progress',
                },
            ],
        },
        {
            name: 'Bot Leader',
            heroes: ['Junker Queen', 'Shion'],
            findNeedles: ['bot run things around here'],
            preferIds: ['17c20635-e694-418d-9a8b-8868771c234f'],
            lines: [
                {
                    hero: 'Junker Queen',
                    subtitles:
                        'They might let a bot run things around here, but Junkertown would rip you to shreds!',
                    needle: 'bot run things around here',
                },
                {
                    hero: 'Shion',
                    subtitles:
                        "(scoff) If I ever leave Japan, your little garbage pile is the last place I'd visit.",
                    needle: 'little garbage pile',
                },
            ],
        },
        {
            name: 'Trying on your hat',
            heroes: ['Mizuki', 'Brigitte'],
            findNeedles: ['try on your hat', 'good impression on the team'],
            preferIds: ['7cdc884e-a45b-4452-aea4-37467b7893f4'],
            lines: [
                {
                    hero: 'Mizuki',
                    subtitles:
                        'Brigitte... If you were me, how would you make a good impression on the team?',
                    needle: 'good impression on the team',
                },
                {
                    hero: 'Brigitte',
                    subtitles: "Oh, that's easy. Just let them try on your hat!",
                    needle: 'try on your hat',
                },
                {
                    hero: 'Mizuki',
                    subtitles: "*(laughs)* That's pretty good. Wait, you're serious?",
                    needle: "you're serious",
                },
                {
                    hero: 'Brigitte',
                    subtitles: "Well, it worked for Cassidy, so I'd say it's worth a shot!",
                    needle: "worth a shot",
                },
            ],
        },
        {
            name: 'Monument to my leadership',
            heroes: ['Vendetta', 'Domina'],
            findNeedles: ['monument to my leadership', 'commend you, Vaira'],
            lines: [
                {
                    hero: 'Vendetta',
                    subtitles:
                        "I commend you, Vaira. Your company's shielding has proven quite useful so far.",
                    needle: 'commend you, Vaira',
                },
                {
                    hero: 'Domina',
                    subtitles:
                        'Of course! Paired with those new armaments, your victory is all but assured.',
                    needle: 'new armaments',
                },
                {
                    hero: 'Vendetta',
                    subtitles: 'When Vishkar rebuilds, I expect a monument to my leadership.',
                    needle: 'monument to my leadership',
                },
                {
                    hero: 'Domina',
                    subtitles: 'Consider it done, my dear.',
                    needle: 'Consider it done',
                },
            ],
        },
        {
            name: 'The harness',
            heroes: ['Vendetta', 'Sigma'],
            findNeedles: ['Prepare yourself, Subject Sigma', 'moments become millennia'],
            lines: [
                {
                    hero: 'Vendetta',
                    subtitles: 'Prepare yourself, Subject Sigma. I will have need of you soon.',
                    needle: 'Prepare yourself, Subject Sigma',
                },
                {
                    hero: 'Sigma',
                    subtitles:
                        'How soon is soon when time slips away? When moments become millennia?',
                    needle: 'moments become millennia',
                },
                {
                    hero: 'Vendetta',
                    subtitles:
                        "Enough. Doctor O'Deorain will harness your power when the time is right.",
                    needle: 'harness your power',
                },
                {
                    hero: 'Sigma',
                    subtitles: 'The harness... yes. Of course.',
                    needle: 'The harness',
                },
            ],
        },
        {
            name: 'Silly little piggy',
            heroes: ['Shion', 'Roadhog'],
            findNeedles: ['terrible under that mask', 'Silly little piggy'],
            lines: [
                {
                    hero: 'Shion',
                    subtitles: "I just know there's something terrible under that mask of yours.",
                    needle: 'terrible under that mask',
                },
                {
                    hero: 'Roadhog',
                    subtitles: '*(wheeze)* None of your business.',
                    needle: 'None of your business',
                },
                {
                    hero: 'Shion',
                    subtitles: 'Silly little piggy... Everything I want is my business.',
                    needle: 'Silly little piggy',
                },
            ],
        },
        {
            name: 'Mindless Rage',
            heroes: ['Vendetta', 'Mizuki'],
            findNeedles: ['Hashimoto to victory', 'mindless as hers'],
            preferIds: ['58e3c832-81d4-42ad-b5ae-b2491467f552'],
            lines: [
                {
                    hero: 'Vendetta',
                    subtitles:
                        'Even in her own keep, Shion could not lead the Hashimoto to victory. How pitiful.',
                    needle: 'Hashimoto to victory',
                },
                {
                    hero: 'Mizuki',
                    subtitles:
                        "Better not let her hear you talking like that. She's killed for a lot less.",
                    needle: 'killed for a lot less',
                },
                {
                    hero: 'Vendetta',
                    subtitles:
                        "(chuckle) She could not best me. Rage as mindless as hers is a weakness I've long since overcome.",
                    needle: 'mindless as hers',
                },
                {
                    hero: 'Mizuki',
                    subtitles: '*(sigh)* Uh huh... whatever you say.',
                    needle: 'whatever you say',
                },
            ],
        },
        {
            name: 'Sold us out',
            heroes: ['Kiriko', 'Mizuki'],
            findNeedles: ['sold us out', 'never betray you guys'],
            preferIds: ['3ae78be6-a4c0-40ca-bc95-7e482e90f9a2'],
            lines: [
                {
                    hero: 'Kiriko',
                    subtitles: "Was there ever a world where you'd have sold us out?",
                    needle: 'sold us out',
                },
                {
                    hero: 'Mizuki',
                    subtitles: 'No. I realized pretty quick that I could never betray you guys.',
                    needle: 'never betray you guys',
                },
            ],
        },
        {
            name: 'Hard to Talk',
            heroes: ['Kiriko', 'Mizuki'],
            findNeedles: ['bike accident', 'really hard to talk about'],
            preferIds: ['9c315d3c-d604-4049-97e8-4775b2c90a06'],
            lines: [
                {
                    hero: 'Kiriko',
                    subtitles:
                        'That story about losing your arm in a bike accident. Was that a lie, too?',
                    needle: 'bike accident',
                },
                {
                    hero: 'Mizuki',
                    subtitles: 'Not entirely. There was a bike involved.',
                    needle: 'bike involved',
                },
                {
                    hero: 'Kiriko',
                    subtitles: 'Still skirting around the details, huh?',
                    needle: 'skirting around the details',
                },
                {
                    hero: 'Mizuki',
                    subtitles:
                        "I'm not trying to hide anything, Kiriko. It's just... really hard to talk about.",
                    needle: 'hard to talk about',
                },
            ],
        },
        {
            name: 'Keeping the hat',
            heroes: ['Mizuki', 'Kiriko'],
            findNeedles: ['thank Nobuto', 'keep the hat'],
            preferIds: ['c75fb16a-721f-4daf-b364-514c2b94c4ef'],
            lines: [
                {
                    hero: 'Mizuki',
                    subtitles: 'Will you thank Nobuto for letting me keep the hat?',
                    needle: 'thank Nobuto',
                },
                {
                    hero: 'Kiriko',
                    subtitles: "It's fine. Not like he would have made you give it back.",
                    needle: 'give it back',
                },
                {
                    hero: 'Mizuki',
                    subtitles: "He doesn't want to hear from me, does he?",
                    needle: "doesn't want to hear from me",
                },
                {
                    hero: 'Kiriko',
                    subtitles:
                        'Can you blame him? You know what the Hashimoto did to his sister.',
                    needle: 'Hashimoto did to his sister',
                },
            ],
        },
        {
            name: 'One two C4',
            heroes: ['Junkrat', 'Roadhog'],
            findNeedles: ['One, two, C4', 'deton-eight'],
            lines: [
                {
                    hero: 'Junkrat',
                    subtitles: 'One, two, C4 - no wait, wait for it.',
                    needle: 'One, two, C4',
                },
                {
                    hero: 'Roadhog',
                    subtitles: '*(grunts)*',
                    needle: '(grunts)',
                },
                {
                    hero: 'Junkrat',
                    subtitles: 'Five, six, deton-eight! *(laughs)*',
                    needle: 'deton-eight',
                },
            ],
        },
        {
            name: 'Piggy Mary',
            heroes: ['Junkrat', 'Roadhog'],
            findNeedles: ['piggy mary', 'bosom friend'],
            lines: [
                {
                    hero: 'Junkrat',
                    subtitles:
                        "Saw there's a whole shop dedicated to your little pachis here... think they'll have that limited edition Piggy Mary?",
                    needle: 'little pachis',
                },
                {
                    hero: 'Roadhog',
                    subtitles: 'Hope so.',
                    needle: 'Hope so',
                },
                {
                    hero: 'Junkrat',
                    subtitles:
                        "Then you'll have it, my dear bosom friend! I'll even threaten the shopkeep if I have to!",
                    needle: 'bosom friend',
                },
                {
                    hero: 'Roadhog',
                    subtitles: 'Thanks.',
                    needle: 'Thanks',
                },
            ],
        },
        {
            name: 'Missouri',
            heroes: ['Junkrat', 'Roadhog'],
            findNeedles: ["We've got a ship", 'Missouri'],
            lines: [
                {
                    hero: 'Junkrat',
                    subtitles:
                        "We're doing it, Mako! We've got a ship, we've got a dream, and we're seeing the world!",
                    needle: "We've got a ship",
                },
                {
                    hero: 'Roadhog',
                    subtitles: 'Yup.',
                    needle: 'Yup',
                },
                {
                    hero: 'Junkrat',
                    subtitles:
                        'Where to next? One of them temples in Beijing? The sunlit shores of Santorini? Or maybe... maybe Missouri?',
                    needle: 'sunlit shores of Santorini',
                },
                {
                    hero: 'Roadhog',
                    subtitles: 'Ooh... Missouri.',
                    needle: 'Missouri',
                },
            ],
        },
        {
            name: 'Sounds like a nightmare',
            heroes: ['Junkrat', 'Illari'],
            findNeedles: ['fantastical explosion', 'sounds like a nightmare'],
            lines: [
                {
                    hero: 'Junkrat',
                    subtitles:
                        'My biggest dream is to set off a fantastical explosion, incinerate everything and everyone as the place is burnt to smithereens. What do you think?',
                    needle: 'fantastical explosion',
                },
                {
                    hero: 'Illari',
                    subtitles: 'I think that sounds like a nightmare.',
                    needle: 'sounds like a nightmare',
                },
            ],
        },
        {
            name: 'More than Mistakes',
            heroes: ['Genji', 'Hanzo'],
            findNeedles: ['more than his mistakes'],
            preferIds: ['1ca433de-585e-46c8-b56b-72c42c3e1836'],
            lines: [
                {
                    hero: 'Genji',
                    subtitles:
                        'Mizuki did not choose his upbringing, brother. Try to see him for more than his mistakes.',
                    needle: 'more than his mistakes',
                },
                {
                    hero: 'Hanzo',
                    subtitles: 'Absolutely not. He should be punished for his failures.',
                    needle: 'punished for his failures',
                },
                {
                    hero: 'Genji',
                    subtitles: 'As I was punished for mine.',
                    needle: 'punished for mine',
                },
                {
                    hero: 'Hanzo',
                    subtitles: 'Perhaps... a more tempered view would be best.',
                    needle: 'more tempered view',
                },
            ],
        },
        {
            name: 'What of my actions',
            heroes: ['Shion', 'Mizuki'],
            findNeedles: ['what ever shall I put you through', 'what of my actions'],
            preferIds: ['b0cc66a6-2607-41f2-a619-c6b056c650e3'],
            lines: [
                {
                    hero: 'Shion',
                    subtitles:
                        'Mizuki, Mizuki... when I get my hands on you, what ever shall I put you through?',
                    needle: 'what ever shall I put you through',
                },
                {
                    hero: 'Mizuki',
                    subtitles: "Your words don't scare me anymore.",
                    needle: "don't scare me anymore",
                },
                {
                    hero: 'Shion',
                    subtitles:
                        'And what of my actions? How much pain does that body of yours remember?',
                    needle: 'what of my actions',
                },
                {
                    hero: 'Mizuki',
                    subtitles: 'Not as much as yours will if you come after me.',
                    needle: 'if you come after me',
                },
            ],
        },
    ];

    console.log(`\nRepairing ${specs.length} part-one interactions${dryRun ? ' (dry-run)' : ''}…`);

    /** @type {string[]} */
    const errors = [];
    for (const spec of specs) {
        try {
            if (dryRun) {
                // Still validate MatchTalk hits without writing.
                for (const row of spec.lines) {
                    if (row.jetpackFolder) {
                        const dir = path.join(
                            EXTRACT_ROOT,
                            'Jetpack Cat',
                            'MatchTalk',
                            row.jetpackFolder,
                        );
                        if (!fs.existsSync(dir)) throw new Error(`missing ${row.jetpackFolder}`);
                    } else if (row.needle) {
                        const hit = findOgg(row.hero, row.needle);
                        if (!hit) throw new Error(`no MatchTalk ${row.hero}: ${row.needle}`);
                    }
                }
                console.log(`  ok ${spec.name}`);
            } else {
                await upsert(conversations, spec);
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${spec.name}: ${msg}`);
            console.error(`  ! ${spec.name}: ${msg}`);
        }
    }

    // Clear leftover single-path multipath on any Season 4 linear entries we touched by name.
    if (!dryRun) {
        for (const spec of specs) {
            const c = findByName(conversations, spec.name);
            if (c && Array.isArray(c.paths) && c.paths.length <= 1) clearSinglePath(c);
        }
    }

    if (!dryRun) {
        raw.conversations = conversations;
        await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
        const assets = await scanTheaterAssets();
        await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`);
        console.log(`\nWrote conversations + theater assets (${assets.voicelines?.length || 0} voicelines)`);
    }

    if (errors.length) {
        console.error(`\n${errors.length} errors`);
        process.exit(1);
    }
    console.log('Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
