#!/usr/bin/env node
/**
 * Classic Zenyatta (+ related WB squeaks) audit fixes from HeroVoice extract.
 * YouTube rip fills lines still missing after this.
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
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

function findHeroDir(name) {
    const want = name.toLowerCase().normalize('NFC');
    for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const n = ent.name.normalize('NFC').toLowerCase();
        if (n === want || n.replace('ö', 'o') === want.replace('ö', 'o')) {
            return path.join(EXTRACT_ROOT, ent.name);
        }
    }
    if (name === 'Torbjörn') {
        for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
            if (ent.isDirectory() && /^torb/i.test(ent.name)) return path.join(EXTRACT_ROOT, ent.name);
        }
    }
    throw new Error(`Hero folder not found: ${name}`);
}

function atlasName(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function copyLoudnorm(source, atlas, { trimStart = 0, trimEnd = 0 } = {}) {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const args = ['-y'];
    if (trimStart > 0) args.push('-ss', String(trimStart));
    args.push('-i', source);
    if (trimEnd > 0) args.push('-to', String(trimEnd));
    args.push('-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libvorbis', '-q:a', '6', dest);
    const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-400));
        throw new Error(`ffmpeg failed: ${atlas}`);
    }
    console.log(`+ ${atlas}`);
    return atlas;
}

function must(...parts) {
    const p = path.join(...parts);
    if (!fs.existsSync(p)) throw new Error(`Missing ${p}`);
    return p;
}

const genji = findHeroDir('Genji');
const bastion = findHeroDir('Bastion');
const zarya = findHeroDir('Zarya');
const zen = findHeroDir('Zenyatta');
const wb = findHeroDir('Wrecking Ball');

const voice = {
    bastionVarious: copyLoudnorm(
        must(bastion, 'MatchTalk', '000000062BFF.0B2-(conversational beeps).ogg'),
        atlasName('Bastion', '(various beeps)'),
    ),
    genjiFlow: copyLoudnorm(
        must(genji, 'MatchTalk', '00000004BCE4.0B2-He is still not ready for time to flow forward again.ogg'),
        atlasName('Genji', 'He is still not ready for time to flow forward again'),
    ),
    zaryaEye: copyLoudnorm(
        must(zarya, 'MatchTalk', "00000002076B.0B2-I'll have my eye on you, omnic.ogg"),
        atlasName('Zarya', "I'll have my eye on you, omnic"),
    ),
    zenWatch: copyLoudnorm(
        must(zen, 'MatchTalk', '000000021FF3.0B2-And I will watch your back in turn.ogg'),
        atlasName('Zenyatta', 'And I will watch your back in turn'),
    ),
    wbSqueaks: copyLoudnorm(
        must(wb, 'MatchTalk', '000000064417.0B2-(hamster noises).ogg'),
        atlasName('Wrecking Ball', '(hamster squeaks)'),
    ),
    wbAngry: (() => {
        const dir = path.join(wb, 'MatchTalk', '(angry squeaks)');
        const first = fs.readdirSync(dir).find((f) => /\.ogg$/i.test(f));
        if (!first) throw new Error('no angry squeaks');
        return copyLoudnorm(path.join(dir, first), atlasName('Wrecking Ball', '(angry squeaks)'));
    })(),
    wbHamsterShort: (() => {
        const dir = path.join(wb, 'MatchTalk', '(hamster squeaks)');
        // pick a slightly longer one for dialogue beats
        const files = fs
            .readdirSync(dir)
            .filter((f) => /\.ogg$/i.test(f))
            .map((f) => ({ f, len: fs.statSync(path.join(dir, f)).size }))
            .sort((a, b) => b.len - a.len);
        return copyLoudnorm(
            path.join(dir, files[0].f),
            atlasName('Wrecking Ball', '(hamster squeaks) short'),
        );
    })(),
};

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

function patch(id, fn) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

// #471 Tell me your thoughts / Various beeps
patch('bdd612bc-cfeb-4dec-8c61-685d7602fd9c', (c) => {
    c.name = 'Tell Me Your Thoughts';
    c.lines[1].subtitles = '**various beeps**';
    c.lines[1].voice = voice.bastionVarious;
});

// #200 flow forwards
const flow = raw.conversations.find(
    (c) =>
        (c.tags || []).includes('Classic') &&
        (c.lines || []).some((l) => /flow forwards? again/i.test(l.subtitles || '')),
);
if (!flow) throw new Error('flow entry missing');
flow.name = 'Time to Flow';
for (const l of flow.lines) {
    if (/flow forwards? again/i.test(l.subtitles || '')) {
        l.voice = voice.genjiFlow;
        l.subtitles = "He's still not ready for time to flow forward again.";
    }
}
console.log('patched Time to Flow');

// Got my eye on you — Zarya had Zenyatta's reply wired
patch('001e0528-a439-40ad-9927-cdf3f9784651', (c) => {
    c.lines[0].voice = voice.zaryaEye;
    c.lines[0].subtitles = "I've got my eye on you, omnic.";
    c.lines[1].voice = voice.zenWatch;
});

// Alongside my Pupil — clear wrong Genji grateful until YT provides correct clip
patch('fa847fae-030d-4944-8ed4-416c98e2eea7', (c) => {
    c.name = 'Alongside my Pupil';
    const grateful = c.lines.find((l) => /grateful to be here/i.test(l.subtitles || ''));
    if (grateful) {
        // drop wrong Angela/other voiceline
        grateful.voice = '';
        console.log('cleared wrong Genji grateful voice (awaiting YT)');
    }
});

// WB Classic squeak-only lines
for (const c of raw.conversations) {
    if (!(c.tags || []).includes('Classic')) continue;
    for (const l of c.lines || []) {
        if (l.hero !== 'Wrecking Ball') continue;
        const sub = String(l.subtitles || '');
        if (/^\*?squeaks\*?\*?$/i.test(sub.trim()) || /^\*Squeaks\*$/i.test(sub.trim()) || sub.trim() === '*squeaks*' || sub.trim() === '*Squeaks*') {
            l.subtitles = '**hamster squeaks**';
            l.voice = voice.wbHamsterShort;
        } else if (/\*\*angry squeaks\*\*/i.test(sub) || /angry squeaks/i.test(sub)) {
            l.subtitles = '**angry squeaks**';
            l.voice = voice.wbAngry;
        } else if (/hamster squeaks/i.test(sub) && !l.voice) {
            l.subtitles = '**hamster squeaks**';
            l.voice = voice.wbSqueaks;
        }
    }
}
console.log('wired Classic WB squeak lines');

// #466 rename
const indeed = byId.get('2d1a7810');
// find by content
const indeedEntry = raw.conversations.find(
    (c) =>
        (c.tags || []).includes('Classic') &&
        (c.lines || []).some((l) => /Indeed my friend/i.test(l.subtitles || '')),
);
if (indeedEntry) {
    indeedEntry.name = 'Indeed My Friend';
    for (const l of indeedEntry.lines) {
        if (l.hero === 'Wrecking Ball') {
            l.subtitles = '**hamster squeaks**';
            l.voice = voice.wbHamsterShort;
        }
    }
    console.log('patched Indeed My Friend');
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('extract pass done');
