#!/usr/bin/env node
/**
 * Season 4 leftovers → numbered theater placeholders for manual review.
 * Also: D.Mon meerkats → Favorite Animals; refresh Match Start / Set Up chatters.
 *
 * Usage:
 *   node scripts/add-season4-numbered-leftovers.mjs --dry-run
 *   node scripts/add-season4-numbered-leftovers.mjs
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
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
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

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
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
            else if (ln.includes(n) || n.includes(ln)) {
                const score = Math.abs(ln.length - n.length) + (ln.startsWith(n) || n.startsWith(ln) ? 0 : 8);
                if (Math.min(ln.length, n.length) >= 8) hits.push({ source: full, label, score });
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
    return { atlas, label: hit.label };
}

function normalizeSfxSubtitles(text) {
    let s = String(text || '');
    s = s.replace(/_/g, '');
    s = s.replace(
        /\*\*\s*(grunts?|sighs?|chuckles?|laughs?|giggles?|scoffs?|wheezes?|heh|coughs?|snorts?|groans?|sniffling|heavy sigh|prideful beeps|disgruntled beeps|western whistle|hamster noises)\s*\*\*/gi,
        (_m, tok) => `*(${String(tok).toLowerCase()})*`,
    );
    s = s.replace(
        /(^|[^\w*])\((grunts?|sighs?|chuckles?|laughs?|giggles?|scoffs?|wheezes?|heh|coughs?|snorts?|groans?|sniffling|heavy sigh|prideful beeps|disgruntled beeps|western whistle|hamster noises)\)(?!\*)/gi,
        (_m, pre, tok) => `${pre}*(${String(tok).toLowerCase()})*`,
    );
    return s.trim();
}

function makeLine(hero, subtitles, voice) {
    return {
        id: createDialogueLineId(),
        hero,
        voice: voice || '',
        voicePrefix: '',
        subtitles: normalizeSfxSubtitles(subtitles),
        render: 'Heroic.png',
        era: ERA,
        status: 'active',
    };
}

function alreadyHas(conversations, needles) {
    const norms = needles.map((n) => norm(n)).filter(Boolean);
    return conversations.some((c) => {
        const joined = norm((c.lines || []).map((l) => l.subtitles || '').join(' '));
        return norms.every((n) => joined.includes(n));
    });
}

/** @type {Array<{ titleHint: string, lines: Array<{ hero: string, needle: string, subtitles: string }> }>} */
const ENTRIES = [
    {
        titleHint: 'blasting ship / Busan',
        lines: [
            {
                hero: 'Junker Queen',
                needle: 'Will you lot stop blasting my ship',
                subtitles:
                    "Will you lot stop blasting my ship? You're bein' a real pain in my kidneys!",
            },
            {
                hero: 'Sojourn',
                needle: "We'll stop 'blasting your ship'",
                subtitles: "We'll stop 'blasting your ship' when you stop invading Busan!",
            },
            {
                hero: 'Junker Queen',
                needle: "Well that's no fair at all",
                subtitles: "Well that's no fair at all!",
            },
        ],
    },
    {
        titleHint: 'Brigitte miss Genji',
        lines: [
            {
                hero: 'Brigitte',
                needle: 'We already miss you, Genji',
                subtitles:
                    "We already miss you, Genji. I'll be here if you ever need a training partner to knock some more sense into you!",
            },
        ],
    },
    {
        titleHint: 'Sojourn oils + Genji bruises',
        lines: [
            {
                hero: 'Sojourn',
                needle: 'oils their own joints',
                subtitles:
                    "Oh, I don't care about that. Just gonna miss having someone else who oils their own joints.",
            },
            {
                hero: 'Genji',
                needle: "I'd gladly call on you for friendship",
                subtitles:
                    "I'd gladly call on you for friendship. As for the bruises... I will manage without.",
            },
        ],
    },
    {
        titleHint: 'Gibraltar without Genji',
        lines: [
            {
                hero: 'Sojourn',
                needle: "Gibraltar won't be the same without you",
                subtitles: "Gibraltar won't be the same without you, Genji.",
            },
            {
                hero: 'Genji',
                needle: 'formidable in my absence',
                subtitles: 'Overwatch will still be formidable in my absence.',
            },
            {
                hero: 'Genji',
                needle: 'Hopefully my replacement will fill that role',
                subtitles: '*(chuckle)* Hopefully my replacement will fill that role, too.',
            },
        ],
    },
    {
        titleHint: 'Genji packet loss',
        lines: [
            {
                hero: 'Genji',
                needle: 'packet loss solution',
                subtitles: 'I wanted to thank you. The packet loss solution you gave me worked.',
            },
        ],
    },
    {
        titleHint: 'Genji koi / sparrow',
        lines: [
            {
                hero: 'Genji',
                needle: 'sparrow has finally returned',
                subtitles: '(Japanese) The sparrow has finally returned to his nest.',
            },
            {
                hero: 'Genji',
                needle: 'In a world of piranha',
                subtitles: '(Japanese) In a world of piranha, be like a koi.',
            },
            {
                hero: 'Genji',
                needle: 'The path of the koi awaits',
                subtitles: 'The path of the koi awaits.',
            },
            {
                hero: 'Genji',
                needle: 'Harmony is found in light and shadow',
                subtitles: 'Harmony is found in light and shadow.',
            },
            {
                hero: 'Genji',
                needle: 'Seek strength in stability',
                subtitles: 'Seek strength in stability.',
            },
            {
                hero: 'Genji',
                needle: 'Enjoy this moment of stasis',
                subtitles: 'Enjoy this moment of stasis.',
            },
        ],
    },
    {
        titleHint: 'Zenyatta resentment / Genji forgiveness',
        lines: [
            {
                hero: 'Zenyatta',
                needle: 'never return home',
                subtitles:
                    'I recall you swearing you would never return home. You have come far, leaving that resentment behind.',
            },
            {
                hero: 'Genji',
                needle: 'forgiveness is a form of peace',
                subtitles:
                    'Just as you taught me, forgiveness is a form of peace. Now, I choose to live each day in pursuit of it.',
            },
        ],
    },
    {
        titleHint: 'Hanzo redemption',
        lines: [
            {
                hero: 'Hanzo',
                needle: 'redemption head on',
                subtitles: 'You have my word, Kiriko. I will seek my redemption head on.',
            },
        ],
    },
    {
        titleHint: 'MEKA EMP / Vendetta',
        lines: [
            {
                hero: 'D.mon',
                needle: 'more than just my mech',
                subtitles: "Lucky for me, I'm more than just my mech.",
            },
            {
                hero: 'D.va',
                needle: 'EMP bomb without a fight',
                subtitles: 'You think MEKA is going to let you take the EMP bomb without a fight?',
            },
            {
                hero: 'Vendetta',
                needle: 'welcome your resistance',
                subtitles:
                    'I welcome your resistance... though I doubt your forces will be a challenge for mine.',
            },
        ],
    },
    {
        titleHint: 'D.Mon call the shots',
        lines: [
            {
                hero: 'D.mon',
                needle: "Don't worry, I'll call the shots",
                subtitles: "Don't worry, I'll call the shots.",
            },
        ],
    },
    {
        titleHint: 'D.Mon Hero of my Storm',
        lines: [
            {
                hero: 'D.mon',
                needle: 'Hero of my Storm',
                subtitles:
                    '*Hero of my Storm* *(amused chuckle)* I totally forgot Hana was in a movie.',
            },
        ],
    },
    {
        titleHint: 'D.Mon Emperor Alien Tyrant',
        lines: [
            {
                hero: 'D.mon',
                needle: 'The Emperor. The Alien. The Tyrant',
                subtitles: 'The Emperor. The Alien. The Tyrant. And one day... The Demon.',
            },
        ],
    },
    {
        titleHint: 'D.Mon Casino race',
        lines: [
            {
                hero: 'D.mon',
                needle: 'Casino up on that race',
                subtitles: "Maybe I'll take Casino up on that race one day.",
            },
        ],
    },
    {
        titleHint: 'D.Mon hope they practiced',
        lines: [
            {
                hero: 'D.mon',
                needle: "Hope they practiced, cause I'm not slowing down",
                subtitles: "Hope they practiced, cause I'm not slowing down.",
            },
        ],
    },
    {
        titleHint: 'D.Mon drop the pride',
        lines: [
            {
                hero: 'D.mon',
                needle: 'Drop the pride and discipline',
                subtitles: 'Drop the pride and discipline will take over.',
            },
        ],
    },
    {
        titleHint: 'JQ rust ridges',
        lines: [
            {
                hero: 'Junker Queen',
                needle: 'rust on their ridges',
                subtitles:
                    "This MEKA lot would never survive the Reckoning. They haven't even got rust on their ridges!",
            },
        ],
    },
    {
        titleHint: 'JQ step on head',
        lines: [
            {
                hero: 'Junker Queen',
                needle: "I wanna step on someone' head",
                subtitles: "What are we waiting around for? I wanna step on someone' head!",
            },
        ],
    },
    {
        titleHint: 'Lifeweaver Gibraltar condolences',
        lines: [
            {
                hero: 'Lifeweaver',
                needle: 'Claudio and Hector send their condolences',
                subtitles:
                    'Claudio and Hector send their condolences. They know what Gibraltar meant to Overwatch.',
            },
            {
                hero: 'Lifeweaver',
                needle: "I'll give them a nudge",
                subtitles: "I'll give them a nudge.",
            },
            {
                hero: 'Torbjörn',
                needle: "when they're done feeling sorry",
                subtitles:
                    "*(sigh)* Well, when they're done feeling sorry, they could help us put this place back together!",
            },
        ],
    },
    {
        titleHint: 'Mizuki never going back',
        lines: [
            {
                hero: 'Mizuki',
                needle: 'never going back to my old life',
                subtitles:
                    "I don't know if I deserve to be with Overwatch, but I'm never going back to my old life. Never.",
            },
        ],
    },
    {
        titleHint: 'Cassidy twenty years',
        lines: [
            {
                hero: 'Cassidy',
                needle: 'twenty years since I left this place',
                subtitles:
                    'Been about twenty years since I left this place behind. Always did miss it, deep down.',
            },
        ],
    },
    {
        titleHint: 'Cassidy Reyes',
        lines: [
            {
                hero: 'Cassidy',
                needle: 'not stopping Reyes here',
                subtitles:
                    'Never did forgive myself for not stopping Reyes here. Seems the world wants to make sure I never will.',
            },
        ],
    },
    {
        titleHint: 'D.Mon Korean home',
        lines: [
            {
                hero: 'D.mon',
                needle: "There's no place like home",
                subtitles: "(Korean) There's no place like home.",
            },
        ],
    },
    {
        titleHint: 'D.Mon selfies',
        lines: [
            {
                hero: 'D.mon',
                needle: 'way too many selfies',
                subtitles:
                    'Last time we were here, D.Va made me take way too many selfies. In front of people, too.',
            },
        ],
    },
    {
        titleHint: 'D.Mon model kits',
        lines: [
            {
                hero: 'D.mon',
                needle: 'model kits while I',
                subtitles: "I need to buy some model kits while I'm here.",
            },
        ],
    },
    {
        titleHint: 'D.Va K/D ratio',
        lines: [
            {
                hero: 'D.va',
                needle: 'no excuse for your K',
                subtitles: "Oh good! Now there's no excuse for your K/D ratio.",
            },
        ],
    },
    {
        titleHint: 'D.Va Busan dump',
        lines: [
            {
                hero: 'D.va',
                needle: 'turn Busan into their dump',
                subtitles:
                    'Ugh. The Junkers want to turn Busan into their dump, but they already live in one!',
            },
        ],
    },
    {
        titleHint: 'Genji three of us',
        lines: [
            {
                hero: 'Genji',
                needle: 'The three of us, together again',
                subtitles: 'The three of us, together again. Like better times.',
            },
        ],
    },
    {
        titleHint: 'Junkrat Humble Jamison',
        lines: [
            {
                hero: 'Junkrat',
                needle: 'Humble Jamison on a quest',
                subtitles: "Humble Jamison on a quest with the Queen herself. Who'd have thought?",
            },
        ],
    },
    {
        titleHint: 'Junkrat home away',
        lines: [
            {
                hero: 'Junkrat',
                needle: 'new home away from home',
                subtitles: 'Ah... my new home away from home!',
            },
        ],
    },
    {
        titleHint: 'Junkrat precious memories',
        lines: [
            {
                hero: 'Junkrat',
                needle: 'precious memories here',
                subtitles: '*(sniffling)* We made such precious memories here.',
            },
        ],
    },
    {
        titleHint: 'Roadhog Not this again',
        lines: [
            {
                hero: 'Roadhog',
                needle: 'Not this again',
                subtitles: 'Not this again.',
            },
        ],
    },
    {
        titleHint: 'Roadhog snort Same',
        lines: [
            {
                hero: 'Roadhog',
                needle: '(snort) Same',
                subtitles: '*(snort)* Same.',
            },
        ],
    },
    {
        titleHint: 'Roadhog kinda city',
        lines: [
            {
                hero: 'Roadhog',
                needle: 'My kinda city',
                subtitles: 'My kinda city.',
            },
        ],
    },
    {
        titleHint: 'Roadhog dumplings',
        lines: [
            {
                hero: 'Roadhog',
                needle: 'Good dumplings here',
                subtitles: 'Good dumplings here.',
            },
        ],
    },
    {
        titleHint: 'Bastion prideful beeps',
        lines: [
            {
                hero: 'Bastion',
                needle: 'prideful beeps',
                subtitles: '*(prideful beeps)*',
            },
        ],
    },
    {
        titleHint: 'WB champion city',
        lines: [
            {
                hero: 'Wrecking Ball',
                needle: 'champion will claim this city',
                subtitles: '*(hamster noises)* The champion will claim this city as his prize.',
            },
        ],
    },
];

async function addFavoriteAnimalsMeerkats(conversations) {
    const fav = conversations.find((c) => c.name === 'Favorite Animals');
    if (!fav) throw new Error('Favorite Animals not found');

    const already = (fav.lines || []).some(
        (l) => /d\.?mon/i.test(l.hero) && /meerkat/i.test(l.subtitles || ''),
    );
    if (already) {
        console.log('Favorite Animals: D.mon meerkats already present');
        return;
    }

    const { atlas } = await copyVoice('D.mon', 'Meerkats. Kinda remind me');
    const line = {
        id: createDialogueLineId(),
        hero: 'D.mon',
        voice: atlas,
        voicePrefix: '',
        subtitles: 'Meerkats. Kinda remind me of the MEKA squad when they work together.',
        render: 'Heroic.png',
        era: 'Overwatch',
        status: 'active',
    };

    // Insert after D.va in the lines array
    const dvaIdx = (fav.lines || []).findIndex((l) => l.hero === 'D.va');
    if (dvaIdx >= 0) fav.lines.splice(dvaIdx + 1, 0, line);
    else fav.lines.push(line);

    const openId = fav.lines.find((l) => /favorite animal/i.test(l.subtitles || ''))?.id;
    const closeId = fav.lines.find((l) => /yeah, I can see it/i.test(l.subtitles || ''))?.id;
    if (!openId || !closeId) throw new Error('Favorite Animals missing open/close Lucio lines');

    if (!Array.isArray(fav.paths)) fav.paths = [];
    if (!fav.paths.some((p) => /d\.?mon/i.test(p.label))) {
        fav.paths.push({
            id: createDialoguePathId(),
            label: 'D.mon',
            lineIds: [openId, line.id, closeId],
        });
        // keep path labels roughly alpha
        fav.paths.sort((a, b) => String(a.label).localeCompare(String(b.label), undefined, { sensitivity: 'base' }));
    }

    if (!Array.isArray(fav.tags)) fav.tags = [];
    if (!fav.tags.includes('Multi Path')) fav.tags.push('Multi Path');

    console.log(`Favorite Animals: added D.mon meerkats → ${atlas}`);
}

async function main() {
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error('Extract missing:', EXTRACT_ROOT);
        process.exit(1);
    }

    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : [];

    await addFavoriteAnimalsMeerkats(conversations);

    let next = nextConversationNumber(conversations);
    let created = 0;
    /** @type {Array<{ name: string, hint: string, lines: number }>} */
    const report = [];

    for (const spec of ENTRIES) {
        const needles = spec.lines.map((l) => l.needle);
        if (alreadyHas(conversations, needles.slice(0, Math.min(2, needles.length)))) {
            console.log(`skip (exists): ${spec.titleHint}`);
            continue;
        }

        const built = [];
        for (const row of spec.lines) {
            const { atlas } = await copyVoice(row.hero, row.needle);
            built.push(makeLine(row.hero, row.subtitles, atlas));
        }

        const conv = buildBlankConversationRecord();
        conv.name = String(next++);
        conv.scene = DEFAULT_DIALOGUE_SCENE;
        conv.tags = ['Overwatch', 'Season 4'];
        conv.eraName = ERA;
        conv.lines = built;
        conversations.push(conv);
        created += 1;
        report.push({ name: conv.name, hint: spec.titleHint, lines: built.length });
        console.log(`#${conv.name} (${spec.titleHint}) — ${built.length} lines`);
    }

    if (!dryRun) {
        raw.conversations = conversations;
        await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
        const assets = await scanTheaterAssets();
        await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
        console.log(`Theater manifest refreshed (${assets.voicelines?.length ?? 0} voicelines).`);
    }

    console.log(`\nCreated ${created} numbered entries (next would be ${next})`);
    if (dryRun) console.log('Dry run — no writes.');
    else {
        console.log('\nNumbered for review:');
        for (const r of report) console.log(`  #${r.name}  ${r.hint}  (${r.lines} lines)`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
