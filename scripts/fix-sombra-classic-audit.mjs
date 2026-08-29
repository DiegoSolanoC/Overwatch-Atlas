#!/usr/bin/env node
/**
 * Classic Sombra audit:
 * - Barista Bastion: extract Sombra opener + Zhn beep reply (ASR-silent gap)
 * - Joel / real name: clean cuts from All Sombra Interactions (ZhnDhuVp29M)
 * Subtitle "bartender" shells updated to match extract ("barista").
 *
 * Usage:
 *   node scripts/fix-sombra-classic-audit.mjs
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
const CACHE = path.join(REPO, 'scripts/_cache/sombra-classic');
const YT_CACHE = path.join(REPO, 'scripts/_cache/classic-yt');
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
const YT_DLP = path.join(REPO, 'scripts/_cache/yt-dlp.exe');

const BARISTA_ID = '4dfe4a62-1a83-43da-9455-600530933b34';
const JOEL_ID = '197657f1-cc44-41b2-8f36-fc032b461558';
const ZHN = 'ZhnDhuVp29M';

// Energy map on Zhn: beeps 10.05-12.15; pleasure 83.45-87.10; joel 87.35-92.10
const BEEP_START = 10.0;
const BEEP_DUR = 2.2;
const PLEASURE_START = 83.4;
const PLEASURE_DUR = 3.7;
const JOEL_START = 87.3;
const JOEL_DUR = 4.9;

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return p;
}

function findExtract(dir, idPrefix) {
    const hits = fs.readdirSync(dir).filter((n) => n.startsWith(idPrefix) && n.endsWith('.ogg'));
    if (!hits.length) throw new Error(`No extract ${idPrefix} in ${dir}`);
    return path.join(dir, hits[0]);
}

function copyLoudnorm(source, atlas) {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const tmp = path.join(
        VOICELINES_DIR,
        `_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}.ogg`,
    );
    const r = spawnSync(
        FFMPEG,
        ['-y', '-i', source, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'libvorbis', '-q:a', '6', tmp],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-600));
        throw new Error(`ffmpeg failed for ${atlas}`);
    }
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(tmp, dest);
    console.log(`loudnorm ${atlas}`);
    return atlas;
}

function findYtMedia(videoId) {
    const mediaExt = new Set(['.webm', '.m4a', '.mp3', '.opus', '.ogg', '.mp4', '.mkv']);
    return fs
        .readdirSync(YT_CACHE)
        .filter((n) => n.startsWith(`${videoId}.`) && mediaExt.has(path.extname(n).toLowerCase()))
        .map((n) => path.join(YT_CACHE, n))
        .find((p) => fs.statSync(p).size > 100000);
}

function ensureYtVideo(videoId) {
    fs.mkdirSync(YT_CACHE, { recursive: true });
    const existing = findYtMedia(videoId);
    if (existing) return existing;
    mustExist(YT_DLP);
    const r = spawnSync(
        YT_DLP,
        [
            '-f',
            'bestaudio/best',
            '--no-playlist',
            '-o',
            path.join(YT_CACHE, `${videoId}.%(ext)s`),
            `https://www.youtube.com/watch?v=${videoId}`,
        ],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-800));
        throw new Error(`yt-dlp failed for ${videoId}`);
    }
    return mustExist(findYtMedia(videoId));
}

function cutYt(source, start, dur, atlas, afExtra = '') {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const tmp = path.join(
        VOICELINES_DIR,
        `_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}.ogg`,
    );
    const af = [
        afExtra,
        'afade=t=in:st=0:d=0.015',
        `afade=t=out:st=${Math.max(0.05, dur - 0.08).toFixed(3)}:d=0.07`,
        'loudnorm=I=-16:TP=-1.5:LRA=11',
    ]
        .filter(Boolean)
        .join(',');
    const r = spawnSync(
        FFMPEG,
        ['-y', '-ss', String(start), '-i', source, '-t', String(dur), '-af', af, '-c:a', 'libvorbis', '-q:a', '6', tmp],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-600));
        throw new Error(`yt cut failed for ${atlas}`);
    }
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(tmp, dest);
    console.log(`yt-cut ${atlas} (${start}+${dur}s)`);
    return atlas;
}

fs.mkdirSync(CACHE, { recursive: true });
const sombraMatch = path.join(EXTRACT_ROOT, 'Sombra', 'MatchTalk');
const zhn = ensureYtVideo(ZHN);

const voice = {
    barista: copyLoudnorm(
        findExtract(sombraMatch, '0000000377E1'),
        "Sombra_-_Ah,_you'd_make_a_good_barista,_Bastion.ogg",
    ),
    beeps: cutYt(zhn, BEEP_START, BEEP_DUR, 'Bastion_-_(series_of_beeps)_barista_reply.ogg'),
    pleasure: cutYt(
        zhn,
        PLEASURE_START,
        PLEASURE_DUR,
        "Sombra_-_Pleasure_working_with_you,_McCree..._if_that_is_your_real_name.ogg",
    ),
    joel: cutYt(
        zhn,
        JOEL_START,
        JOEL_DUR,
        "Cassidy_-_Don't_know_what_you_heard,_but_my_name's_not_Joel._Best_remember_that.ogg",
    ),
};

for (const old of fs.readdirSync(VOICELINES_DIR)) {
    const drop =
        /^Sombra_-_pleasure_working_with_you_mccree/i.test(old) ||
        /^Cassidy_-_dont_know_what_you_heard_but_my_names_not_joel/i.test(old);
    if (!drop) continue;
    if (Object.values(voice).includes(old)) continue;
    fs.unlinkSync(path.join(VOICELINES_DIR, old));
    console.log('removed', old);
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

function patch(id, fn) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

patch(BARISTA_ID, (c) => {
    c.name = 'Good Barista';
    c.lines[0].hero = 'Sombra';
    c.lines[0].voice = voice.barista;
    c.lines[0].subtitles = "Ah, you'd make a good barista, Bastion.";
    c.lines[1].hero = 'Bastion';
    c.lines[1].voice = voice.beeps;
    c.lines[1].subtitles = '**series of beeps**';
});

patch(JOEL_ID, (c) => {
    c.name = 'Real Name Joel';
    c.lines[0].hero = 'Sombra';
    c.lines[0].voice = voice.pleasure;
    c.lines[0].subtitles = 'Pleasure working with you, McCree... if that is your real name.';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.joel;
    c.lines[1].subtitles = "Don't know what you heard, but my name's not Joel. Best remember that.";
});

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('Sombra Classic audit done');
