#!/usr/bin/env node
/**
 * Classic Roadhog audit: stay-out-of-trouble (sourced "for once" only — no empty Hey path),
 * clean Junkrat cuts.
 *
 * Usage:
 *   node scripts/fix-roadhog-classic-audit.mjs
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
const CACHE = path.join(REPO, 'scripts/_cache/roadhog-classic');
const YT_CLIP = path.join(REPO, 'scripts/_cache/classic-yt/GOR9O_gPMIk.webm');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );
const FFPROBE = FFMPEG.replace(/ffmpeg\.exe$/i, 'ffprobe.exe');

const HEY_ID = '7c31ec3c-38e7-40b9-b850-3af9dd53b839';
const TRY_ID = 'b0323756-2bc8-4fb8-9229-f32328a175c6';
const BLOW_ID = '423daf29-d24e-430f-b6e3-4864bb45e6a7';

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return p;
}

function findHeroDir(name) {
    const want = name.toLowerCase();
    for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
        if (ent.isDirectory() && ent.name.toLowerCase() === want) {
            return path.join(EXTRACT_ROOT, ent.name);
        }
    }
    throw new Error(`Hero folder not found: ${name}`);
}

function findExtract(heroDir, idOrSubstr) {
    const hits = [];
    function walk(dir) {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (/\.ogg$/i.test(ent.name) && ent.name.includes(idOrSubstr)) hits.push(full);
        }
    }
    walk(heroDir);
    if (!hits.length) throw new Error(`Extract missing ${idOrSubstr}`);
    return hits[0];
}

function atlasName(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function copyLoudnorm(source, atlas, extraArgs = []) {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const args = ['-y', ...extraArgs, '-i', source, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libvorbis', '-q:a', '6', dest];
    const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-500));
        throw new Error(`ffmpeg failed ${atlas}`);
    }
    console.log(`+ ${atlas}`);
    return atlas;
}

function durationOf(file) {
    const r = spawnSync(
        FFPROBE,
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nk=1:nw=1', file],
        { encoding: 'utf8' },
    );
    return Number(String(r.stdout || '').trim()) || 0;
}

function silenceCuts(wavPath) {
    const r = spawnSync(
        FFMPEG,
        ['-i', wavPath, '-af', 'silencedetect=noise=-35dB:d=0.12', '-f', 'null', '-'],
        { encoding: 'utf8' },
    );
    const log = `${r.stderr || ''}`;
    const starts = [...log.matchAll(/silence_start:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    const ends = [...log.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
    return { starts, ends, log };
}

fs.mkdirSync(CACHE, { recursive: true });
mustExist(YT_CLIP);
mustExist(FFMPEG);

const fullWav = path.join(CACHE, 'full.wav');
{
    const r = spawnSync(FFMPEG, ['-y', '-i', YT_CLIP, '-ac', '1', '-ar', '48000', fullWav], {
        encoding: 'utf8',
    });
    if (r.status !== 0) throw new Error('wav convert failed');
}

const total = durationOf(fullWav);
const { starts, ends } = silenceCuts(fullWav);
console.log('yt duration', total, 'silence starts', starts, 'ends', ends);

const junkratRef = findExtract(findHeroDir('Junkrat'), '00000000B7D5');
const junkratDur = durationOf(junkratRef);

// Prefer mid-clip silence; else cut using known Junkrat reply length from the end.
let splitAt = Math.max(1.5, total - junkratDur - 0.15);
const midSilences = starts.filter((t) => t > 1.2 && t < total - 1.0);
if (midSilences.length) splitAt = midSilences[0];
else if (ends.length >= 1 && ends[0] > 1.2 && ends[0] < total - 1) {
    splitAt = ends[0];
}
console.log('splitAt', splitAt, 'junkratDur', junkratDur);

const heyRaw = path.join(CACHE, 'hey-raw.wav');
spawnSync(
    FFMPEG,
    ['-y', '-i', fullWav, '-ss', '0', '-to', String(splitAt), heyRaw],
    { encoding: 'utf8' },
);

const roadhog = findHeroDir('Roadhog');
const junkrat = findHeroDir('Junkrat');

const voice = {
    hey: copyLoudnorm(heyRaw, atlasName('Roadhog', 'Hey. Stay out of trouble')),
    tryOnce: copyLoudnorm(
        findExtract(roadhog, '00000000B6CC'),
        atlasName('Roadhog', 'Try and stay out of trouble for once'),
    ),
    blow: copyLoudnorm(
        findExtract(roadhog, '00000004A345'),
        atlasName('Roadhog', "Don't blow it"),
    ),
    bestBehavior: copyLoudnorm(
        findExtract(junkrat, '00000000B7D5'),
        atlasName('Junkrat', "I'll be on me best behavior"),
    ),
    whenEver: copyLoudnorm(
        findExtract(junkrat, '000000043AB5'),
        atlasName('Junkrat', "When have I ever... Er, don't answer that"),
    ),
};

console.log('durations', {
    hey: durationOf(path.join(VOICELINES_DIR, voice.hey)),
    tryOnce: durationOf(path.join(VOICELINES_DIR, voice.tryOnce)),
    bestBehavior: durationOf(path.join(VOICELINES_DIR, voice.bestBehavior)),
    whenEver: durationOf(path.join(VOICELINES_DIR, voice.whenEver)),
});

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));
const heyConv = byId.get(HEY_ID);
const tryConv = byId.get(TRY_ID);
const blowConv = byId.get(BLOW_ID);
if (!heyConv || !blowConv) throw new Error('missing target conversations');

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

const existingTry =
    heyConv.lines?.find((l) => /stay out of trouble for once/i.test(l.subtitles || '')) ||
    tryConv?.lines?.[0] ||
    heyConv.lines?.[0];
const existingBehavior =
    heyConv.lines?.find((l) => /best behavior/i.test(l.subtitles || '')) ||
    heyConv.lines?.[1] ||
    tryConv?.lines?.[1];

// Keep only the sourced "for once" opener — do not re-add empty "Hey." path.
const lineTry = keepLine(
    existingTry,
    'Roadhog',
    'Try and stay out of trouble for once.',
    voice.tryOnce,
);
const lineBehavior = keepLine(
    existingBehavior,
    'Junkrat',
    "I'll be on me best behavior.",
    voice.bestBehavior,
);

heyConv.name = 'Stay Out of Trouble';
heyConv.tags = Array.from(
    new Set([...(heyConv.tags || []).filter((t) => t !== 'Multi Path'), 'Classic']),
);
heyConv.lines = [lineTry, lineBehavior];
delete heyConv.paths;
delete heyConv.selectedPathId;
console.log('wired single path', heyConv.name, '(no empty Hey branch)');

if (tryConv) {
    raw.conversations = raw.conversations.filter((c) => c.id !== TRY_ID);
    console.log('removed duplicate', TRY_ID);
}

blowConv.name = "Don't Blow It";
blowConv.lines[0].voice = voice.blow;
blowConv.lines[0].subtitles = "Don't blow it.";
blowConv.lines[1].voice = voice.whenEver;
blowConv.lines[1].subtitles = "When have I ever... Er, don't answer that.";
console.log('patched', blowConv.name);

// Drop legacy mashed atlas if present and unused later
const legacyMash = path.join(VOICELINES_DIR, 'Junkrat_-_ill_be_on_me_best_behavior.ogg');
const legacyWhen = path.join(VOICELINES_DIR, 'Junkrat_-_when_have_i_ever_er_dont_answer_that.ogg');

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);

// Prefer deleting only if nothing else references them
const stillUsed = new Set();
for (const c of raw.conversations) {
    for (const l of c.lines || []) if (l.voice) stillUsed.add(l.voice);
}
for (const p of [legacyMash, legacyWhen]) {
    const name = path.basename(p);
    if (fs.existsSync(p) && !stillUsed.has(name)) {
        fs.unlinkSync(p);
        console.log('removed legacy', name);
    }
}

console.log('Roadhog Classic audit done');
