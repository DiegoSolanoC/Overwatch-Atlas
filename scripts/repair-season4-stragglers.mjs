#!/usr/bin/env node
/**
 * Season 4 stragglers from https://www.youtube.com/watch?v=VtkaDvUIQ7A
 * (through "hey gamers" ~11:02). Creates missing interactions only.
 *
 * Usage:
 *   node scripts/repair-season4-stragglers.mjs --dry-run
 *   node scripts/repair-season4-stragglers.mjs
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
    "Torbjörn": 'Torbjörn',
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
        /\*\*\s*(grunts?|sighs?|chuckles?|laughs?|giggles?|scoffs?|wheezes?|heh|coughs?|snorts?|groans?|western\s+whistle)\s*\*\*/gi,
        (_m, tok) => `*(${String(tok).toLowerCase()})*`,
    );
    s = s.replace(
        /(^|[^\w*])\((grunts?|sighs?|chuckles?|laughs?|giggles?|scoffs?|wheezes?|heh|coughs?|snorts?|groans?|western\s+whistle)\)(?!\*)/gi,
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

async function upsert(conversations, spec) {
    let conv = findByAllNeedles(conversations, spec.findNeedles);
    if (!conv && spec.name) {
        conv = conversations.find((c) => c.name === spec.name);
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
    delete conv.paths;
    delete conv.selectedPathId;
    return conv;
}

/** @type {Array<object>} */
const SPECS = [
    {
        name: 'PC bang',
        heroes: ['Anran', 'D.va'],
        findNeedles: ['friendly faces', 'PC bang'],
        lines: [
            {
                hero: 'Anran',
                subtitles:
                    "It's nice having so many friendly faces around. I'm so used to training on my own.",
                needle: 'friendly faces',
            },
            {
                hero: 'D.va',
                subtitles:
                    'That sounds just like my life before MEKA. Sweating it out at the PC bang!',
                needle: 'PC bang',
            },
            {
                hero: 'Anran',
                subtitles: "Weren't you just... gaming?",
                needle: 'Weren\'t you just... gaming',
            },
            {
                hero: 'D.va',
                subtitles: 'Hey! eSports are still sports!',
                needle: 'eSports are still sports',
            },
        ],
    },
    {
        name: 'Cat litter',
        heroes: ['Brigitte', 'Torbjörn'],
        findNeedles: ['cat litter', 'clumping'],
        lines: [
            {
                hero: 'Brigitte',
                subtitles:
                    "Papa! Have you seen a delivery of cat litter? I've been looking all over!",
                needle: 'cat litter',
            },
            {
                hero: 'Torbjörn',
                subtitles:
                    'You mean the clumping, low-dust, moisture-absorbing sand? It was perfect for cleaning up those pesky oil stains!',
                needle: 'clumping',
            },
            {
                hero: 'Torbjörn',
                subtitles: "*(chuckle)* I'm joking. I'll keep an eye out for it.",
                needle: 'keep an eye out for it',
            },
        ],
    },
    {
        name: 'Deadlock path',
        heroes: ['Cassidy', 'Bastion'],
        findNeedles: ["tearin' a path across the west", 'Appreciate the enthusiasm, Bastion'],
        lines: [
            {
                hero: 'Cassidy',
                subtitles: "*(sigh)* Deadlock's really tearin' a path across the west, these days.",
                needle: "tearin' a path across the west",
            },
            {
                hero: 'Bastion',
                subtitles: '*(western whistle)*',
                needle: 'western whistle',
            },
            {
                hero: 'Cassidy',
                subtitles:
                    "Appreciate the enthusiasm, Bastion... but I don't think I'm the right man to stop 'em.",
                needle: 'Appreciate the enthusiasm, Bastion',
            },
        ],
    },
    {
        name: 'Lasting impression',
        heroes: ['Domina', 'Vendetta'],
        findNeedles: ['new blade is rather bold', 'lasting impression'],
        lines: [
            {
                hero: 'Domina',
                subtitles: 'That new blade is rather bold, darling. Designed to terrify, is it?',
                needle: 'new blade is rather bold',
            },
            {
                hero: 'Vendetta',
                subtitles: 'Of course. I always like to leave a lasting impression.',
                needle: 'lasting impression',
            },
        ],
    },
    {
        name: 'Bounty a try',
        heroes: ['Freja', 'Roadhog'],
        findNeedles: ['give your bounty a try', 'Good luck with that'],
        lines: [
            {
                hero: 'Freja',
                subtitles: "Life's been too easy lately. Maybe I ought to give your bounty a try.",
                needle: 'give your bounty a try',
            },
            {
                hero: 'Roadhog',
                subtitles: '*(snort)* Good luck with that.',
                needle: 'Good luck with that',
            },
        ],
    },
    {
        name: 'Roasted stuff',
        heroes: ['Hanzo', 'Sojourn'],
        findNeedles: ['lending us your aid', 'roasted stuff'],
        lines: [
            {
                hero: 'Hanzo',
                subtitles:
                    'Thank you for lending us your aid, Commander. Let us sit down for tea the next time you visit.',
                needle: 'lending us your aid',
            },
            {
                hero: 'Sojourn',
                subtitles:
                    "I'll take you up on that. As long as we go somewhere that does the roasted stuff.",
                needle: 'roasted stuff',
            },
        ],
    },
    {
        name: 'Grain of sand',
        heroes: ['Junker Queen', 'Junkrat'],
        findNeedles: ["little vacation's comin'", 'grain of sand'],
        lines: [
            {
                hero: 'Junker Queen',
                subtitles: "Our little vacation's comin' up boys. Don't make me regret bringin' ya.",
                needle: "little vacation's comin'",
            },
            {
                hero: 'Junkrat',
                subtitles: "We'd never, my Queen! I'll cover every grain of sand with explosives!",
                needle: 'grain of sand',
            },
            {
                hero: 'Junker Queen',
                subtitles: '*(groan)* Bloody idiots.',
                needle: 'Bloody idiots',
            },
        ],
    },
    {
        name: 'Kingdom of wreckage',
        heroes: ['Vendetta', 'Junker Queen'],
        findNeedles: ['Do not forget our terms', 'kingdom out of wreckage'],
        lines: [
            {
                hero: 'Vendetta',
                subtitles:
                    "Do not forget our terms. I won't allow your recklessness to ruin my plans.",
                needle: 'Do not forget our terms',
            },
            {
                hero: 'Junker Queen',
                subtitles: "You doubtin' me, lady? *(laughs)* I made a kingdom out of wreckage.",
                needle: 'kingdom out of wreckage',
            },
            {
                hero: 'Vendetta',
                subtitles: "And wreckage suits you. Just don't burn down what I've built.",
                needle: "don't burn down what I've built",
            },
        ],
    },
    {
        name: 'Madam Wolf',
        heroes: ['Junkrat', 'Vendetta'],
        findNeedles: ['madam wolf', 'betray his leaders'],
        lines: [
            {
                hero: 'Junkrat',
                subtitles:
                    'If the pot was sweet enough... I might be willing to serve you, madam wolf.',
                needle: 'madam wolf',
            },
            {
                hero: 'Vendetta',
                subtitles:
                    'I have no use for the allegiance of one so willing to betray his leaders.',
                needle: 'betray his leaders',
            },
            {
                hero: 'Junkrat',
                subtitles:
                    "Who said anything about betrayal? I was only talking about teams. Mercenaries!",
                needle: 'Who said anything about betrayal',
            },
        ],
    },
    {
        name: 'Chikasa forgives',
        heroes: ['Kiriko', 'Mizuki'],
        findNeedles: ['Chikasa says she forgives', 'Does anyone else'],
        lines: [
            {
                hero: 'Kiriko',
                subtitles: 'By the way, Chikasa says she forgives you.',
                needle: 'Chikasa says she forgives',
            },
            {
                hero: 'Mizuki',
                subtitles: 'Does anyone else?',
                needle: 'Does anyone else',
            },
            {
                hero: 'Kiriko',
                subtitles: 'You know the answer to that.',
                needle: 'You know the answer to that',
            },
            {
                hero: 'Mizuki',
                subtitles: 'Well, thanks for letting me know.',
                needle: 'thanks for letting me know',
            },
        ],
    },
    {
        name: 'Fox sightseeing',
        heroes: ['Sojourn', 'Kiriko'],
        findNeedles: ['good work against the Hashimoto', 'fox sightseeing'],
        lines: [
            {
                hero: 'Sojourn',
                subtitles: 'You did some good work against the Hashimoto out there.',
                needle: 'good work against the Hashimoto',
            },
            {
                hero: 'Kiriko',
                subtitles: "Thanks. Didn't hurt having Commander Chase backing me up.",
                needle: 'Commander Chase backing me up',
            },
            {
                hero: 'Sojourn',
                subtitles:
                    "Well, if you ever want to take that fox sightseeing, you'd be welcome in Overwatch.",
                needle: 'fox sightseeing',
            },
            {
                hero: 'Kiriko',
                subtitles: "Nice of you to offer, but... I think I'm right where I want to be.",
                needle: 'right where I want to be',
            },
        ],
    },
    {
        name: 'Busan fireworks',
        heroes: ['Junker Queen', 'D.va'],
        findNeedles: ['fireworks show', 'missiles blowing up'],
        lines: [
            {
                hero: 'Junker Queen',
                subtitles: "Reckon Busan's in need of a little fireworks show!",
                needle: 'fireworks show',
            },
            {
                hero: 'D.va',
                subtitles:
                    'The only _fireworks_ show you see will be my missiles blowing up in your face!',
                needle: 'missiles blowing up',
            },
        ],
    },
    {
        name: 'Not a kid anymore',
        heroes: ['D.va', 'Freja'],
        findNeedles: ['not being the new kid anymore', "wasn't calling you a kid"],
        lines: [
            {
                hero: 'D.va',
                subtitles: 'Kinda nice not being the new kid anymore, huh?',
                needle: 'not being the new kid anymore',
            },
            {
                hero: 'D.va',
                subtitles: "I wasn't calling you a kid... wait, how old are you?",
                needle: "wasn't calling you a kid",
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
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;

    // Soft renames for known aliases already in the DB
    const renames = [
        ['Dragons Fireworks', 'Dragons available'],
        ['Remembering Pain', 'What of my actions'],
        ['517', 'Chikasa forgives'],
    ];
    for (const [from, to] of renames) {
        const c = conversations.find((x) => x.name === from);
        if (c && !conversations.some((x) => x.name === to && x.id !== c.id)) {
            console.log(`  ~ rename "${from}" → "${to}"`);
            if (!dryRun) {
                c.name = to;
                c.eraName = c.eraName || ERA;
            }
        }
    }

    console.log(`\nRepairing ${SPECS.length} stragglers${dryRun ? ' (dry-run)' : ''}…`);
    /** @type {string[]} */
    const errors = [];
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

    console.log('\n=== STRAGGLER LIST ===');
    for (let i = 0; i < SPECS.length; i += 1) {
        const spec = SPECS[i];
        const c = conversations.find((x) => x.name === spec.name);
        console.log(
            `${i + 1}. ${spec.name}${c ? ` — ${c.lines.length} lines` : dryRun ? '' : ' MISSING'}`,
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
