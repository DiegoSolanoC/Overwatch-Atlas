#!/usr/bin/env node
/**
 * Classic Zarya audit: replace wrong/mashed cuts from HeroVoice extract,
 * wire missing Sombra/Zarya lines, multipath Rein keep-training replies.
 *
 * Usage:
 *   node scripts/fix-zarya-classic-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createDialogueLineId,
    createDialoguePathId,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
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
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const REMINDING_ID = '9ba39c13-8ad4-4e3c-af85-b3d9f1f1ef8f';
const HERO_RUSSIANS_ID = '6ba3f20f-e00c-42bf-b04a-cf049c81a441';
const TRAITORS_ID = '4451c75a-ddd4-425e-ad19-b3b6fe2d1390';
const STILL_MAN_ID = 'aac1e055-889a-4abd-904a-74c76797e6dd';
const TRAINING_ID = 'c71fa250-4193-480a-ba4c-799e05865d82';

function findHeroDir(name) {
    const want = name.toLowerCase().normalize('NFC');
    for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const n = ent.name.normalize('NFC').toLowerCase();
        if (n === want || n.replace('ö', 'o') === want.replace('ö', 'o')) {
            return path.join(EXTRACT_ROOT, ent.name);
        }
    }
    if (/^torb/i.test(name)) {
        for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
            if (ent.isDirectory() && /^torb/i.test(ent.name)) {
                return path.join(EXTRACT_ROOT, ent.name);
            }
        }
    }
    throw new Error(`Hero folder not found: ${name}`);
}

function findExtract(heroDir, substr) {
    const hits = [];
    function walk(dir) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (/\.ogg$/i.test(ent.name) && ent.name.includes(substr)) hits.push(full);
        }
    }
    walk(heroDir);
    if (!hits.length) throw new Error(`Extract missing ${substr} under ${heroDir}`);
    return hits[0];
}

function atlasName(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function copyLoudnorm(source, atlas) {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const r = spawnSync(
        FFMPEG,
        ['-y', '-i', source, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libvorbis', '-q:a', '6', dest],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-500));
        throw new Error(`ffmpeg failed ${atlas}`);
    }
    console.log(`+ ${atlas}`);
    return atlas;
}

function keepLine(base, hero, subtitles, voiceFile) {
    return {
        id: base?.id || createDialogueLineId(),
        hero,
        voice: voiceFile,
        voicePrefix: '',
        subtitles,
        render: base?.render || 'Heroic.png',
        era: base?.era || '',
        status: base?.status || 'active',
    };
}

const zarya = findHeroDir('Zarya');
const torb = findHeroDir('Torbjörn');
const sombra = findHeroDir('Sombra');
const rein = findHeroDir('Reinhardt');

const voice = {
    reminding: copyLoudnorm(
        findExtract(torb, '00000002A8FB'),
        atlasName('Torbjörn', "(sighs) Believe me, I don't need reminding"),
    ),
    heroRussians: copyLoudnorm(
        findExtract(zarya, '00000002A7EE'),
        atlasName('Zarya', "She's a hero to all Russians. I do not care what you have to say"),
    ),
    knowWhat: copyLoudnorm(
        findExtract(zarya, '000000035FC2'),
        atlasName('Zarya', "I know what you are. I'm only sorry that you do not"),
    ),
    traitors: copyLoudnorm(
        findExtract(sombra, '0000000377DE'),
        atlasName(
            'Sombra',
            'Katya Volskaya and Aleksandra Zaryanova... Traitors to your own country. You deserve each other',
        ),
    ),
    must: copyLoudnorm(
        findExtract(zarya, '000000035FBE'),
        atlasName('Zarya', 'I do what I must, for my people'),
    ),
    keepTraining: copyLoudnorm(
        findExtract(rein, '00000000AE4B'),
        atlasName(
            'Reinhardt',
            'Keep training, and maybe someday you can learn to handle a real weapon!',
        ),
    ),
    gotThis: copyLoudnorm(
        findExtract(zarya, '00000000B482'),
        atlasName('Zarya', "I think I've got this, old man"),
    ),
    hammer: copyLoudnorm(
        findExtract(zarya, '00000000ACBA'),
        atlasName('Zarya', "That hammer doesn't look so heavy"),
    ),
    suffering: copyLoudnorm(
        findExtract(zarya, '00000002A7EB'),
        atlasName('Zarya', 'The suffering of my people rests heavily upon your shoulders, Torbjörn'),
    ),
};

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

function patch(id, fn) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

patch(REMINDING_ID, (c) => {
    c.name = "Don't Need Reminding";
    c.lines[0].voice = voice.suffering;
    c.lines[0].subtitles =
        'The suffering of my people rests heavily upon your shoulders, Torbjörn.';
    c.lines[1].voice = voice.reminding;
    c.lines[1].subtitles = "**sigh** Believe me, I don't need reminding.";
});

patch(HERO_RUSSIANS_ID, (c) => {
    c.name = 'Hero to All Russians';
    c.lines[1].voice = voice.heroRussians;
    c.lines[1].subtitles = "She's a hero to all Russians. I do not care what you have to say.";
});

patch(TRAITORS_ID, (c) => {
    c.name = 'Traitors';
    c.lines[0].hero = 'Sombra';
    c.lines[0].voice = voice.traitors;
    c.lines[0].subtitles =
        'Katya Volskaya and Aleksandra Zaryanova... Traitors to your own country. You deserve each other.';
    c.lines[1].voice = voice.must;
    c.lines[1].subtitles = 'I do what I must, for my people.';
});

patch(STILL_MAN_ID, (c) => {
    c.lines[1].voice = voice.knowWhat;
    c.lines[1].subtitles = "I know what you are. I'm only sorry that you do not.";
});

patch(TRAINING_ID, (c) => {
    c.name = 'Real Weapon';
    c.tags = Array.from(new Set([...(c.tags || []), 'Classic', 'Multi Path']));
    const reinLine = keepLine(
        c.lines.find((l) => l.hero === 'Reinhardt') || c.lines[0],
        'Reinhardt',
        'Keep training, and maybe someday you can learn to handle a real weapon!',
        voice.keepTraining,
    );
    const gotThis = keepLine(
        c.lines.find((l) => /got this, old man/i.test(l.subtitles || '')),
        'Zarya',
        "I think I've got this, old man.",
        voice.gotThis,
    );
    const hammer = keepLine(
        c.lines.find((l) => /hammer doesn't look/i.test(l.subtitles || '')),
        'Zarya',
        "That hammer doesn't look so heavy.",
        voice.hammer,
    );
    c.lines = [reinLine, gotThis, hammer];
    const pathGot = createDialoguePathId();
    const pathHammer = createDialoguePathId();
    c.paths = [
        { id: pathGot, label: "Got this", lineIds: [reinLine.id, gotThis.id] },
        { id: pathHammer, label: 'Hammer', lineIds: [reinLine.id, hammer.id] },
    ];
    c.selectedPathId = pathGot;
});

// Drop legacy mashed filenames if unused
const legacy = [
    'Torbjörn_-_believe_me_i_dont_need_reminding.ogg',
    'Zarya_-_i_know_what_you_are_im_only_sorry_that_you_do_not.ogg',
    'Reinhardt_-_keep_training_and_maybe_someday_you_can_learn_to_handle_a_real.ogg',
];

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);

const used = new Set();
for (const c of raw.conversations) {
    for (const l of c.lines || []) if (l.voice) used.add(l.voice);
}
for (const name of legacy) {
    const p = path.join(VOICELINES_DIR, name);
    if (fs.existsSync(p) && !used.has(name)) {
        fs.unlinkSync(p);
        console.log('removed legacy', name);
    }
}

console.log('Zarya Classic audit done');
