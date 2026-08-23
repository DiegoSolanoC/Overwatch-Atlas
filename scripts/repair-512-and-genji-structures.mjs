#!/usr/bin/env node
/**
 * Repair #512 audio + correct #515/#516/#521 structures from wiki.
 * Restore Brigitte ↔ Genji farewell (was wrongly purged into chatter).
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

const dryRun = process.argv.includes('--dry-run');
const ERA = 'Season 4 (YouTube placeholder)';

const HERO_FOLDER = { 'D.va': 'D.Va', 'D.mon': 'D.Mon' };
const ATLAS_HERO = { 'D.va': 'D.Va', 'D.mon': 'D.Mon' };

function atlasFromLabel(hero, label) {
    const prefix = String(ATLAS_HERO[hero] || hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function norm(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/[''`´']/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function findOgg(hero, needle) {
    const folder = HERO_FOLDER[hero] || hero;
    const root = path.join(EXTRACT_ROOT, folder, 'MatchTalk');
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
                if (Math.min(ln.length, n.length) >= 10) {
                    hits.push({ source: full, label, score: Math.abs(ln.length - n.length) + 2 });
                }
            }
        }
    }
    walk(root);
    hits.sort((a, b) => a.score - b.score);
    return hits[0] || null;
}

async function copyVoice(hero, needle) {
    const hit = findOgg(hero, needle);
    if (!hit) throw new Error(`Missing MatchTalk ${hero}: ${needle}`);
    const atlas = atlasFromLabel(hero, hit.label);
    const dest = path.join(VOICELINES_DIR, atlas);
    if (!dryRun && !fs.existsSync(dest)) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        await fsp.copyFile(hit.source, dest);
    }
    return atlas;
}

function makeLine(hero, subtitles, voice) {
    return {
        id: createDialogueLineId(),
        hero,
        voice: voice || '',
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
        era: ERA,
        status: 'active',
    };
}

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[''`´']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : [];

    // --- #512 wire audio (wiki: Junkrat ↔ D.Mon, 4 lines) ---
    {
        const c = conversations.find((x) => x.name === '512');
        if (!c) throw new Error('#512 missing');
        const specs = [
            {
                hero: 'Junkrat',
                needle: "she's got the juice",
                subtitles:
                    "That D.Va girl... she's got the juice! The shazow! She just flies right in, and blows everything up!",
            },
            {
                hero: 'D.mon',
                needle: "Sounds like you're a big fan",
                subtitles: "Sounds like you're a big fan.",
            },
            {
                hero: 'Junkrat',
                needle: 'she was a fan of me, first',
                subtitles: 'Oh, I am! But... she was a fan of me, first, of course.',
            },
            {
                hero: 'D.mon',
                needle: 'posters on her wall',
                subtitles: 'Sure. Probably got your posters on her wall and everything.',
            },
        ];
        c.lines = [];
        for (const s of specs) {
            const voice = await copyVoice(s.hero, s.needle);
            c.lines.push(makeLine(s.hero, s.subtitles, voice));
        }
        c.eraName = ERA;
        console.log('#512 audio wired (Junkrat ↔ D.mon)');
    }

    // --- #521 wiki: D.Va ↔ Vendetta ONLY (drop D.mon mech line) ---
    {
        const c = conversations.find((x) => x.name === '521');
        if (!c) throw new Error('#521 missing');
        const dva = await copyVoice('D.va', 'EMP bomb without a fight');
        const ven = await copyVoice('Vendetta', 'welcome your resistance');
        c.lines = [
            makeLine(
                'D.va',
                'You think MEKA is going to let you take the EMP bomb without a fight?',
                dva,
            ),
            makeLine(
                'Vendetta',
                'I welcome your resistance... though I doubt your forces will be a challenge for mine.',
                ven,
            ),
        ];
        c.eraName = ERA;
        console.log('#521 trimmed to D.va ↔ Vendetta (wiki)');
    }

    // --- #515: Sojourn oils ↔ Genji fill that role ---
    {
        const c = conversations.find((x) => x.name === '515');
        if (!c) throw new Error('#515 missing');
        const soj = await copyVoice('Sojourn', 'oils their own joints');
        const gen = await copyVoice('Genji', 'fill that role');
        c.lines = [
            makeLine(
                'Sojourn',
                "Oh, I don't care about that. Just gonna miss having someone else who oils their own joints.",
                soj,
            ),
            makeLine(
                'Genji',
                '*(chuckle)* Hopefully my replacement will fill that role, too.',
                gen,
            ),
        ];
        c.eraName = ERA;
        console.log('#515 = Sojourn oils ↔ Genji fill that role');
    }

    // --- #516: Sojourn Gibraltar ↔ Genji formidable ---
    {
        const c = conversations.find((x) => x.name === '516');
        if (!c) throw new Error('#516 missing');
        const soj = await copyVoice('Sojourn', "Gibraltar won't be the same without you");
        const gen = await copyVoice('Genji', 'formidable in my absence');
        c.lines = [
            makeLine('Sojourn', "Gibraltar won't be the same without you, Genji.", soj),
            makeLine('Genji', 'Overwatch will still be formidable in my absence.', gen),
        ];
        c.eraName = ERA;
        console.log('#516 = Sojourn Gibraltar ↔ Genji formidable');
    }

    // --- Restore Brigitte ↔ Genji (training / bruises) as new numbered dialogue ---
    {
        const already = conversations.some((c) => {
            if (c.entryType === 'chatter') return false;
            const blob = (c.lines || []).map((l) => l.subtitles || '').join(' ');
            return /miss you, Genji/i.test(blob) && /bruises/i.test(blob);
        });
        if (already) {
            console.log('Brigitte↔Genji dialogue already present');
        } else {
            const br = await copyVoice('Brigitte', 'We already miss you, Genji');
            const ge = await copyVoice('Genji', 'gladly call on you for friendship');
            const conv = buildBlankConversationRecord();
            conv.name = String(nextConversationNumber(conversations));
            conv.scene = DEFAULT_DIALOGUE_SCENE;
            conv.tags = ['Overwatch', 'Season 4'];
            conv.eraName = ERA;
            conv.lines = [
                makeLine(
                    'Brigitte',
                    "We already miss you, Genji. I'll be here if you ever need a training partner to knock some more sense into you!",
                    br,
                ),
                makeLine(
                    'Genji',
                    "I'd gladly call on you for friendship. As for the bruises... I will manage without.",
                    ge,
                ),
            ];
            conversations.push(conv);
            console.log(`#${conv.name} restored Brigitte ↔ Genji (training / bruises)`);
        }

        // Remove from Brigitte chatter (belongs as dialogue)
        const chatter = conversations.find((c) => c.entryType === 'chatter' && c.name === 'Brigitte');
        if (chatter) {
            const before = chatter.lines.length;
            chatter.lines = (chatter.lines || []).filter(
                (l) => !/miss you, Genji|training partner to knock/i.test(l.subtitles || ''),
            );
            console.log(`Brigitte chatter: removed ${before - chatter.lines.length} miss-Genji line(s)`);
        }
    }

    // Keep D.mon "more than just my mech" in chatter only (not on wiki with Vendetta)
    {
        const chatter = conversations.find((c) => c.entryType === 'chatter' && /d\.?mon/i.test(c.name));
        const has = (chatter?.lines || []).some((l) => /more than just my mech/i.test(l.subtitles || ''));
        if (!has && chatter) {
            const voice = await copyVoice('D.mon', 'more than just my mech');
            chatter.lines.push(
                makeLine('D.mon', "Lucky for me, I'm more than just my mech.", voice),
            );
            console.log('D.mon chatter: ensured mech line present');
        } else {
            console.log('D.mon chatter: mech line ok');
        }
    }

    // Soften purge list: don't purge Brigitte miss Genji / bruises cores by name 514 anymore
    raw._meta = raw._meta && typeof raw._meta === 'object' ? raw._meta : {};
    if (Array.isArray(raw._meta.purgedConversationNames)) {
        raw._meta.purgedConversationNames = raw._meta.purgedConversationNames.filter((n) => n !== '514');
    }
    if (Array.isArray(raw._meta.purgedLineCores)) {
        const drop = new Set(
            [
                "We already miss you, Genji. I'll be here if you ever need a training partner to knock some more sense into you!",
                "I'd gladly call on you for friendship. As for the bruises... I will manage without.",
            ].map(coreKey),
        );
        raw._meta.purgedLineCores = raw._meta.purgedLineCores.filter((c) => !drop.has(c));
    }

    raw.conversations = conversations;

    if (dryRun) {
        console.log('Dry run — no writes.');
        return;
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log('Wrote conversations + manifest');

    for (const name of ['512', '515', '516', '521']) {
        const c = conversations.find((x) => x.name === name);
        console.log(`\n=== #${name} ===`);
        for (const l of c.lines) console.log(`  [${l.hero}] ${l.subtitles}\n    -> ${l.voice}`);
    }
    const restored = conversations.filter(
        (c) =>
            c.entryType !== 'chatter' &&
            /miss you, Genji/i.test((c.lines || []).map((l) => l.subtitles).join(' ')),
    );
    for (const c of restored) {
        console.log(`\n=== #${c.name} (Brigitte↔Genji) ===`);
        for (const l of c.lines) console.log(`  [${l.hero}] ${l.subtitles}`);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
