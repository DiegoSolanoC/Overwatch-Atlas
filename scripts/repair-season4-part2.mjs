#!/usr/bin/env node
/**
 * Season 4 part-two repair (second Hammeh video):
 * - Split glued numbered stubs
 * - Create missing interactions
 * - Wire MatchTalk audio + normalize SFX markup
 * - Refresh theater-assets-manifest.json
 *
 * Usage:
 *   node scripts/repair-season4-part2.mjs --dry-run
 *   node scripts/repair-season4-part2.mjs
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

const HERO_FOLDER = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
    'Soldier 76': 'Soldier_ 76',
};
const ATLAS_HERO = {
    'D.va': 'D.Va',
    'D.mon': 'D.Mon',
};

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[''`´']/g, '')
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

function normalizeSfxSubtitles(text) {
    let s = String(text || '');
    s = s.replace(
        /\*\*\s*(grunts?|sighs?|chuckles?|laughs?|giggles?|scoffs?|wheezes?|heh|coughs?)\s*\*\*/gi,
        (_m, tok) => `*(${String(tok).toLowerCase()})*`,
    );
    s = s.replace(
        /(^|[^\w*])\((grunts?|sighs?|chuckles?|laughs?|giggles?|scoffs?|wheezes?|heh|coughs?)\s*\)(?!\*)/gi,
        (_m, pre, tok) => `${pre}*(${String(tok).toLowerCase()})*`,
    );
    return s;
}

function makeLine(hero, subtitles, voice, id = createDialogueLineId()) {
    return {
        id,
        hero,
        voice: voice || '',
        voicePrefix: '',
        subtitles: normalizeSfxSubtitles(subtitles),
        render: 'Heroic.png',
    };
}

function findByAllNeedles(conversations, needles) {
    const norms = needles.map((n) => norm(n)).filter(Boolean);
    if (!norms.length) return undefined;
    return conversations.find((c) => {
        const joined = norm((c.lines || []).map((l) => l.subtitles || '').join(' '));
        return norms.every((n) => joined.includes(n));
    });
}

function removeById(conversations, id) {
    const idx = conversations.findIndex((c) => c.id === id);
    if (idx >= 0) conversations.splice(idx, 1);
}

function clearSinglePath(conv) {
    delete conv.paths;
    delete conv.selectedPathId;
}

/**
 * @param {object[]} conversations
 * @param {{
 *   name: string,
 *   heroes: string[],
 *   findNeedles: string[],
 *   preferIds?: string[],
 *   lines: Array<{ hero: string, subtitles: string, needle: string }>,
 * }} spec
 */
async function upsert(conversations, spec) {
    /** @type {object | undefined} */
    let conv;
    for (const id of spec.preferIds || []) {
        conv = conversations.find((c) => c.id === id);
        if (conv) break;
    }
    if (!conv && spec.findNeedles?.length) {
        conv = findByAllNeedles(conversations, spec.findNeedles);
    }

    const built = [];
    for (const row of spec.lines) {
        const voice = await copyVoice(row.hero, row.needle);
        built.push({
            hero: row.hero,
            subtitles: row.subtitles,
            voice,
            id: undefined,
        });
    }

    if (conv && Array.isArray(conv.lines) && conv.lines.length === built.length) {
        for (let i = 0; i < built.length; i += 1) {
            built[i].id = conv.lines[i]?.id || createDialogueLineId();
        }
    }

    if (!conv) {
        conv = buildBlankConversationRecord();
        conversations.push(conv);
        console.log(`  + create ${spec.name}`);
    } else if (conv.name !== spec.name) {
        console.log(`  ~ rename "${conv.name}" → "${spec.name}"`);
    } else {
        console.log(`  ~ update ${spec.name}`);
    }

    conv.name = spec.name;
    conv.eraName = ERA;
    conv.status = conv.status || 'active';
    conv.entryType = conv.entryType || 'interaction';
    conv.heroes = spec.heroes;
    conv.lines = built.map((l) => makeLine(l.hero, l.subtitles, l.voice, l.id));
    clearSinglePath(conv);
    return conv;
}

/** @type {Array<object>} */
const SPECS = [
    {
        name: "You're tall",
        heroes: ['Venture', 'Roadhog'],
        findNeedles: ["you're tall", "you're funny, too"],
        lines: [
            {
                hero: 'Venture',
                subtitles: "Hey! Uh... you, um... you really... you're tall!",
                needle: "you're tall",
            },
            {
                hero: 'Roadhog',
                subtitles: 'Uh huh.',
                needle: 'Uh huh',
            },
            {
                hero: 'Venture',
                subtitles: "HAHAHA! Oh, wow! And you're funny, too!",
                needle: "you're funny, too",
            },
        ],
    },
    {
        name: 'Fall to his demons',
        heroes: ['Kiriko', 'Genji'],
        findNeedles: ['send Mizuki to Overwatch', 'fall to his demons'],
        lines: [
            {
                hero: 'Kiriko',
                subtitles: 'Why did you send Mizuki to Overwatch?',
                needle: 'send Mizuki to Overwatch',
            },
            {
                hero: 'Genji',
                subtitles: 'The agents there will not let him fall to his demons.',
                needle: 'fall to his demons',
            },
            {
                hero: 'Kiriko',
                subtitles: 'Huh... you really have a lot of faith in them.',
                needle: 'lot of faith in them',
            },
            {
                hero: 'Genji',
                subtitles: 'I do. Because they never let me fall to mine.',
                needle: 'fall to mine',
            },
        ],
    },
    {
        name: 'Pocket ninja',
        heroes: ['Kiriko', 'Genji'],
        findNeedles: ["don't run off on your own again", 'pocket ninja'],
        lines: [
            {
                hero: 'Kiriko',
                subtitles:
                    "The Hashimoto don't stand a chance now that we're back together. Just don't run off on your own again, okay?",
                needle: "don't stand a chance",
            },
            {
                hero: 'Genji',
                subtitles: 'I will walk this path by your side, pocket ninja. I promise.',
                needle: 'pocket ninja',
            },
        ],
    },
    {
        name: 'Smiling onion',
        heroes: ['Illari', 'Roadhog'],
        findNeedles: ['smiling onion'],
        lines: [
            {
                hero: 'Illari',
                subtitles: 'I always see you with that smiling onion.',
                needle: 'smiling onion',
            },
            {
                hero: 'Roadhog',
                subtitles: 'Yeah? What about it?',
                needle: 'What about it',
            },
            {
                hero: 'Illari',
                subtitles: "Nothing. I think it's cute.",
                needle: "I think it's cute",
            },
        ],
    },
    {
        name: 'Hacked to pieces',
        heroes: ['Cassidy', 'Hanzo'],
        findNeedles: ['hacked to pieces', 'not what I meant'],
        lines: [
            {
                hero: 'Cassidy',
                subtitles:
                    "When I visit Genji in Japan, I'd better not find him hacked to pieces again.",
                needle: 'hacked to pieces',
            },
            {
                hero: 'Hanzo',
                subtitles: 'If you do, it will not have been by my hand.',
                needle: 'by my hand',
            },
            {
                hero: 'Cassidy',
                subtitles: "So... you'd let someone else hack him up, instead?",
                needle: 'someone else hack him up',
            },
            {
                hero: 'Hanzo',
                subtitles: '*(sighs)* That was not what I meant.',
                needle: 'not what I meant',
            },
        ],
    },
    {
        name: "Toshiro's forge",
        heroes: ['Mizuki', 'Kiriko'],
        findNeedles: ['blow up his forge', 'Toshiro-ojisan is safe'],
        lines: [
            {
                hero: 'Mizuki',
                subtitles:
                    "I'm glad Toshiro-ojisan is safe now, but I wish we didn't have to blow up his forge.",
                needle: 'blow up his forge',
            },
            {
                hero: 'Kiriko',
                subtitles: "He'll find a way to keep up his craft.",
                needle: 'keep up his craft',
            },
            {
                hero: 'Mizuki',
                subtitles: 'But that building held all his secrets.',
                needle: 'held all his secrets',
            },
            {
                hero: 'Kiriko',
                subtitles: "No, he does. Isn't that why you guys bothered keeping him alive?",
                needle: 'keeping him alive',
            },
        ],
    },
    {
        name: 'Tea leaf',
        heroes: ['Anran', 'Mizuki'],
        findNeedles: ['tea leaf standing up', 'ruined it for yourself'],
        lines: [
            {
                hero: 'Anran',
                subtitles:
                    'There was a tea leaf standing up in my cup this morning. That means good luck, right?',
                needle: 'tea leaf standing up',
            },
            {
                hero: 'Mizuki',
                subtitles: 'Not if you tell me! Ugh... You ruined it for yourself.',
                needle: 'ruined it for yourself',
            },
        ],
    },
    {
        name: 'Obake-kun',
        heroes: ['Kiriko', 'Shion'],
        findNeedles: ['sick to my stomach', 'what he put you through instead'],
        lines: [
            {
                hero: 'Kiriko',
                subtitles:
                    'When I think of what you put Mizuki through, I feel sick to my stomach.',
                needle: 'sick to my stomach',
            },
            {
                hero: 'Shion',
                subtitles:
                    'Oh, my little Obake-kun? *(laughs)* You should focus on what he put you through instead.',
                needle: 'what he put you through instead',
            },
        ],
    },
    {
        name: 'Pig Boy',
        heroes: ['Hazard', 'Roadhog'],
        findNeedles: ['thorn in your side', 'pig boy to you', "Keep pushin' omnics"],
        preferIds: [],
        lines: [
            {
                hero: 'Hazard',
                subtitles: "Keep pushin' omnics around, and the Phreaks'll be coming for you.",
                needle: "Keep pushin' omnics",
            },
            {
                hero: 'Roadhog',
                subtitles: '*(cough)* Who are you?',
                needle: 'Who are you',
            },
            {
                hero: 'Hazard',
                subtitles: "I'm about to be the thorn in your side, big boy.",
                needle: 'thorn in your side',
            },
            {
                hero: 'Roadhog',
                subtitles: "That's pig boy to you.",
                needle: 'pig boy to you',
            },
        ],
    },
    {
        name: 'Feeling regret',
        heroes: ['Mizuki', 'Echo'],
        findNeedles: ['capable of feeling regret', 'negative past events'],
        lines: [
            {
                hero: 'Mizuki',
                subtitles:
                    'Sorry if this is a rude question, but are you capable of feeling regret?',
                needle: 'capable of feeling regret',
            },
            {
                hero: 'Echo',
                subtitles:
                    'I often ponder negative past events I can no longer change. Does that reflect the experience accurately?',
                needle: 'negative past events',
            },
            {
                hero: 'Mizuki',
                subtitles: "Yeah. I'd say it does.",
                needle: "I'd say it does",
            },
        ],
    },
    {
        name: 'Knew the champ',
        heroes: ['Roadhog', 'Winston'],
        findNeedles: ['knew the champ', 'Not what he said'],
        lines: [
            {
                hero: 'Roadhog',
                subtitles: 'Hey. You knew the champ?',
                needle: 'knew the champ',
            },
            {
                hero: 'Winston',
                subtitles: 'Oh, you mean Hammond? Yes, we were friends on a Lunar Colony!',
                needle: 'friends on a Lunar Colony',
            },
            {
                hero: 'Roadhog',
                subtitles: 'Hm. Not what he said.',
                needle: 'Not what he said',
            },
        ],
    },
    {
        name: 'Overwatch isn\'t a circus',
        heroes: ['Shion', 'Sojourn'],
        findNeedles: ['performance will suffer', "isn't a circus"],
        lines: [
            {
                hero: 'Shion',
                subtitles:
                    "Since you're handling Mizuki, now... you should know that his performance will suffer if he's coddled.",
                needle: 'performance will suffer',
            },
            {
                hero: 'Sojourn',
                subtitles: "I don't need him to 'perform'. Overwatch isn't a circus.",
                needle: "isn't a circus",
            },
            {
                hero: 'Shion',
                subtitles: 'Oh? *(giggles)* You could have fooled me.',
                needle: 'could have fooled me',
            },
        ],
    },
    {
        name: 'Control his fear',
        heroes: ['Vendetta', 'Shion'],
        findNeedles: ['value fealty', 'control his fear'],
        lines: [
            {
                hero: 'Vendetta',
                subtitles:
                    'You must be ashamed, losing that boy to Overwatch. I suppose the Hashimoto do not value fealty as I do.',
                needle: 'value fealty',
            },
            {
                hero: 'Shion',
                subtitles:
                    "They can have his loyalty for all I care. As long as I control his fear, he's still mine!",
                needle: 'control his fear',
            },
        ],
    },
    {
        name: 'Miss Genji',
        heroes: ['Sojourn', 'Cassidy'],
        findNeedles: ['miss Genji that bad', 'nice of you to say'],
        lines: [
            {
                hero: 'Sojourn',
                subtitles: "What's wrong, cowboy? You miss Genji that bad?",
                needle: 'miss Genji that bad',
            },
            {
                hero: 'Cassidy',
                subtitles:
                    "*(chuckle)* He ain't the only one. Got a lot of old friends out there I've been thinking about lately.",
                needle: 'old friends out there',
            },
            {
                hero: 'Sojourn',
                subtitles:
                    "You're not trapped here, Cole. I know you'd be doing good wherever you end up.",
                needle: 'not trapped here',
            },
            {
                hero: 'Cassidy',
                subtitles: 'That makes one of us. But... nice of you to say.',
                needle: 'That makes one of us',
            },
        ],
    },
    {
        name: 'No loyalties',
        heroes: ['Mauga', 'Mizuki'],
        findNeedles: ['no loyalties', 'Slip of the tongue'],
        lines: [
            {
                hero: 'Mauga',
                subtitles: 'Funny that guys with no loyalties keep ending up at Overwatch.',
                needle: 'no loyalties',
            },
            {
                hero: 'Mizuki',
                subtitles: "Guys? You mean it's not just me?",
                needle: "it's not just me",
            },
            {
                hero: 'Mauga',
                subtitles: 'Oh, did I say that? Slip of the tongue.',
                needle: 'Slip of the tongue',
            },
        ],
    },
    {
        name: 'Strong case',
        heroes: ['Sojourn', 'Mizuki'],
        findNeedles: ['strong case for you', 'another chance at life'],
        lines: [
            {
                hero: 'Sojourn',
                subtitles: "Genji made a strong case for you, recruit. Don't let him down.",
                needle: 'strong case for you',
            },
            {
                hero: 'Mizuki',
                subtitles: "I won't. Not when you're all giving me another chance at life.",
                needle: 'another chance at life',
            },
        ],
    },
    {
        name: 'Forsaken me',
        heroes: ['Shion', 'Mizuki'],
        findNeedles: ['forsaken me', "wasn't you"],
        lines: [
            {
                hero: 'Shion',
                subtitles:
                    'Why have you forsaken me? I taught you strength, I gave you a reason to live!',
                needle: 'forsaken me',
            },
            {
                hero: 'Mizuki',
                subtitles: 'No. Toshiro-ojisan and the Yōkai did.',
                needle: 'Toshiro-ojisan and the',
            },
            {
                hero: 'Shion',
                subtitles:
                    "You think they still care for you after what you did? It's not too late to return to my side.",
                needle: 'not too late to return',
            },
            {
                hero: 'Mizuki',
                subtitles: "Never. I made my choice, and it wasn't you.",
                needle: "wasn't you",
            },
        ],
    },
    {
        name: 'Pachimaris',
        heroes: ['Mauga', 'Junkrat'],
        findNeedles: ['Enjoying the pachimaris', 'sonorific symphony'],
        lines: [
            {
                hero: 'Mauga',
                subtitles:
                    "You and ol' Mako seem to be having a good time out here. Enjoying the pachimaris?",
                needle: 'pachimaris',
            },
            {
                hero: 'Junkrat',
                subtitles:
                    'That we are! The sound of those sweet little onions are a sonorific symphony to my eardrums!',
                needle: 'sonorific symphony',
            },
            {
                hero: 'Mauga',
                subtitles: "Like when you squeeze 'em?",
                needle: "squeeze 'em",
            },
            {
                hero: 'Junkrat',
                subtitles: 'No! Like when we bomb the whole machine!',
                needle: 'bomb the whole machine',
            },
        ],
    },
];

async function main() {
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error(`Extract missing: ${EXTRACT_ROOT}`);
        process.exit(1);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    /** @type {object[]} */
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;

    // Drop badly glued numbered stubs; content is rebuilt via SPECS.
    const killIds = [
        'be2e1178-4edb-4459-9825-1ac35d285623', // leftover if any
    ];
    // Find by characteristic glued fingerprints
    const killNeedles = [
        { needle: "you're funny, too", andAlso: 'fall to his demons', why: 'Venture+Genji glue' },
        { needle: 'lot of faith in them', andAlso: 'pocket ninja', why: 'faith+pocket glue' },
        { needle: 'tea leaf standing up', andAlso: 'sick to my stomach', why: 'tea+obake glue' },
        { needle: 'Obake-kun', andAlso: 'thorn in your side', why: 'obake+hazard glue' },
        { needle: 'pig boy to you', andAlso: 'feeling regret', why: 'pigboy+regret glue' },
        { needle: 'negative past events', andAlso: 'Lunar Colony', why: 'echo+winston glue' },
        { needle: 'Lunar Colony', andAlso: 'performance will suffer', why: 'winston+shion glue' },
        { needle: 'control his fear', andAlso: 'miss Genji', why: 'fear+cowboy glue' },
        { needle: 'no loyalties', andAlso: 'strong case for you', why: 'loyalties+recruit glue' },
        { needle: 'smiling onion', andAlso: "wasn't you", why: 'onion+choice glue if any' },
    ];

    for (const rule of killNeedles) {
        const hits = conversations.filter((c) => {
            const joined = (c.lines || []).map((l) => l.subtitles || '').join(' | ');
            return (
                joined.toLowerCase().includes(rule.needle.toLowerCase()) &&
                joined.toLowerCase().includes(rule.andAlso.toLowerCase())
            );
        });
        for (const c of hits) {
            // Don't kill if it's already a clean single-topic entry matching a SPEC name
            if (SPECS.some((s) => s.name === c.name)) continue;
            console.log(`  - remove ${c.name} (${rule.why}) id=${c.id.slice(0, 8)}`);
            if (!dryRun) removeById(conversations, c.id);
            else killIds.push(c.id);
        }
    }

    // Clean preferIds placeholders
    for (const spec of SPECS) {
        if (spec.preferIds) {
            spec.preferIds = spec.preferIds.filter((id) => !id.includes('/*'));
        }
    }

    console.log(`\nRepairing ${SPECS.length} part-two interactions${dryRun ? ' (dry-run)' : ''}…`);
    /** @type {string[]} */
    const errors = [];

    // Process in order; for find collisions, prefer creating fresh when find would hit wrong topic.
    // Use exclusive findNeedles that uniquely identify each conversation.
    for (const spec of SPECS) {
        try {
            if (dryRun) {
                for (const row of spec.lines) {
                    const hit = findOgg(row.hero, row.needle);
                    if (!hit) throw new Error(`no MatchTalk ${row.hero}: ${row.needle}`);
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

    if (!dryRun) {
        raw.conversations = conversations;
        await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
        const assets = await scanTheaterAssets();
        await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`);
        console.log(
            `\nWrote conversations + theater assets (${assets.voicelines?.length || 0} voicelines)`,
        );
    }

    console.log('\n=== PART-TWO LIST ===');
    for (let i = 0; i < SPECS.length; i += 1) {
        const spec = SPECS[i];
        const c = conversations.find((x) => x.name === spec.name);
        const empty = c ? (c.lines || []).filter((l) => !l.voice).length : -1;
        console.log(
            `${i + 1}. ${spec.name}${c ? ` — ${c.lines.length} lines${empty ? ` (${empty} missing audio)` : ''}` : ' MISSING'}`,
        );
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
