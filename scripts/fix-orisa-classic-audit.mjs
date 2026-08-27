#!/usr/bin/env node
/**
 * Classic Orisa audit: split mashed McCree exchange, distinct Bastion beeps,
 * wire missing Torb/Mei/graviton lines, rename numbered shells.
 *
 * Usage:
 *   node scripts/fix-orisa-classic-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
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
const OT_CACHE = path.join(REPO, 'scripts/_cache/orisa-classic');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const MCCREE_ID = '551fe357-98a5-471a-88c6-d8ec130acf2a';
const WOW_ORISA_ID = 'fb7d4221-21b6-47e0-ab8e-f55d605b932e';
const BUILD_UP_ID = '0b5eef2f-5bb9-4308-9aa5-9a7a7cd83198';
const ADORABLE_ID = '27255c9d-9e20-43e8-bb60-42097cd3bc08';
const CREATION_ID = '86db2e25-7ea4-4e89-8281-2ff2e61d07bb';
const GRAVITON_ID = '39f2d98e-0aef-4a9a-804a-d9f5c136d5fc';

const OT_FILES = {
    mccree:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/04/000000035281.0B2-Jesse-McCree.-Outlaw.-Reward_-60000000.-The-reward-could-make-up-for-Efis-grant-money.ogg',
    comeOn:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/04/0000000441B5-Hey-come-on-now.ogg',
};

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return p;
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
        console.error(r.stderr?.slice(-600));
        throw new Error(`ffmpeg failed for ${atlas}`);
    }
    console.log(`+ ${atlas}`);
    return atlas;
}

function downloadOt(url, filename) {
    fs.mkdirSync(OT_CACHE, { recursive: true });
    const dest = path.join(OT_CACHE, filename);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) return dest;
    const r = spawnSync('curl.exe', ['-sL', url, '-o', dest], { encoding: 'utf8' });
    if (r.status !== 0 || !fs.existsSync(dest) || fs.statSync(dest).size < 5000) {
        throw new Error(`OT download failed: ${url}`);
    }
    console.log(`cached ${filename} (${fs.statSync(dest).size})`);
    return dest;
}

function findHeroDir(name) {
    const want = name.toLowerCase().normalize('NFC');
    for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const n = ent.name.normalize('NFC').toLowerCase();
        if (n === want || n.replace('ö', 'o') === want.replace('ö', 'o')) {
            return path.join(EXTRACT_ROOT, ent.name);
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

const orisa = findHeroDir('Orisa');
const bastion = findHeroDir('Bastion');
const mei = findHeroDir('Mei');

const mccreeSrc = downloadOt(OT_FILES.mccree, '000000035281-Jesse-McCree-outlaw.ogg');
const comeOnSrc = downloadOt(OT_FILES.comeOn, '0000000441B5-Hey-come-on-now.ogg');

const voice = {
    mccree: copyLoudnorm(
        mccreeSrc,
        atlasName('Orisa', "Jesse McCree; outlaw. Reward_ 60 million dollars. The reward could make up for Efi's grant money"),
    ),
    comeOn: copyLoudnorm(comeOnSrc, atlasName('Cassidy', 'Hey, come on now!')),
    wowBeeps: copyLoudnorm(
        mustExist(path.join(bastion, 'MatchTalk', '000000043A38.0B2-(impressed beeps).ogg')),
        atlasName('Bastion', '(impressed beeps) Wow, An Orisa!'),
    ),
    buildBeeps: copyLoudnorm(
        mustExist(path.join(bastion, 'MatchTalk', '0000000412BD.0B2-(Torbjörn impression).ogg')),
        // Windows may store ö as replacement char; fall back via findExtract
        atlasName('Bastion', "(Torbjörn impression) Build 'em up, break 'em down"),
    ),
    creation: copyLoudnorm(
        findExtract(orisa, '000000035295'),
        atlasName('Orisa', 'Torbjörn Lindholm, you are responsible, in part, for my creation'),
    ),
    graviton: copyLoudnorm(
        findExtract(orisa, '000000035292'),
        atlasName('Orisa', 'Zarya, I have learned to utilize my graviton charge by watching you'),
    ),
    adorable: copyLoudnorm(
        findExtract(mei, '00000004CEA4'),
        atlasName('Mei', 'Orisa, you are adorable!'),
    ),
};

// If Torbjörn impression path failed encoding, rebuild buildBeeps via ID search
if (!fs.existsSync(path.join(VOICELINES_DIR, voice.buildBeeps))) {
    voice.buildBeeps = copyLoudnorm(
        findExtract(bastion, '0000000412BD'),
        atlasName('Bastion', "(Torbjörn impression) Build 'em up, break 'em down"),
    );
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

function patch(id, fn) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

patch(MCCREE_ID, (c) => {
    c.name = 'Outlaw Reward';
    c.lines[0].subtitles =
        "Jesse McCree; outlaw. Reward: 60 million dollars. The reward could make up for Efi's grant money.";
    c.lines[0].voice = voice.mccree;
    c.lines[1].hero = 'Cassidy';
    c.lines[1].subtitles = 'Hey, come on now!';
    c.lines[1].voice = voice.comeOn;
});

patch(WOW_ORISA_ID, (c) => {
    c.lines[0].subtitles = '**impressed beeps** → ("Wow, An Orisa!")';
    c.lines[0].voice = voice.wowBeeps;
});

patch(BUILD_UP_ID, (c) => {
    c.name = "Build 'Em Up";
    for (const l of c.lines) {
        if (l.hero === 'Bastion') {
            l.subtitles = `**bastion beeps** → ("Build 'em up, break 'em down")`;
            l.voice = voice.buildBeeps;
        }
    }
});

patch(ADORABLE_ID, (c) => {
    c.name = 'Adorable';
    c.lines[0].subtitles = 'Orisa, you are adorable!';
    c.lines[0].voice = voice.adorable;
});

patch(CREATION_ID, (c) => {
    c.name = 'My Creation';
    c.lines[0].subtitles = 'Torbjörn Lindholm, you are responsible, in part, for my creation.';
    c.lines[0].voice = voice.creation;
});

patch(GRAVITON_ID, (c) => {
    c.name = 'Graviton Charge';
    c.lines[0].hero = 'Orisa';
    c.lines[0].subtitles = 'Zarya, I have learned to utilize my graviton charge by watching you.';
    c.lines[0].voice = voice.graviton;
});

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('Orisa Classic audit done');
