#!/usr/bin/env node
/**
 * Classic Mei audit:
 * - Time joke: Mei empty + Cassidy mash → clean cuts from All McCree Interactions (A2)
 * - Front lines: Soldier wrongly wired to Mei reply → extract 02B780 + Mei 02ED55
 * - Little robot: Torb truncated → extract 01FFEC; Mei hammer re-loudnorm 02ED69
 *
 * Usage:
 *   node scripts/fix-mei-classic-audit.mjs
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

const TIME_ID = '05f16ea5-dfe3-4a91-8e04-1e07e605c88f';
const FRONT_ID = 'a38ccf71-8d25-4e9a-b34b-a19f8657bde6';
const ROBOT_ID = '01748291-9e98-49d4-8932-8cd64d83f6cc';
const A2 = 'A2blrgHnrcY';
// Energy map: Mei@182.75–184.95; Cassidy soft@185.4, speech@186.1 … there@~192.3; smoking@192.4
const MEI_TIME_START = 182.7;
const MEI_TIME_DUR = 2.45;
const CASS_TIME_START = 185.4;
const CASS_TIME_DUR = 6.9;

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return p;
}

function findExtract(dir, idPrefix) {
    const hits = fs.readdirSync(dir).filter((n) => n.startsWith(idPrefix) && n.endsWith('.ogg'));
    if (!hits.length) throw new Error(`No extract ${idPrefix} in ${dir}`);
    return path.join(dir, hits[0]);
}

function findExtractRecursive(heroDir, idPrefix) {
    const hits = [];
    function walk(d) {
        for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, ent.name);
            if (ent.isDirectory()) walk(full);
            else if (ent.name.startsWith(idPrefix) && ent.name.endsWith('.ogg')) hits.push(full);
        }
    }
    walk(heroDir);
    if (!hits.length) throw new Error(`No extract ${idPrefix} under ${heroDir}`);
    return hits[0];
}

function findHeroDir(name) {
    const want = name
        .toLowerCase()
        .normalize('NFC')
        .replace(/[öô]/g, 'o')
        .replace(/[äâ]/g, 'a')
        .replace(/[üû]/g, 'u');
    for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const n = ent.name
            .normalize('NFC')
            .toLowerCase()
            .replace(/[öô]/g, 'o')
            .replace(/[äâ]/g, 'a')
            .replace(/[üû]/g, 'u');
        if (n === want || n.includes(want) || (want === 'torbjorn' && /torbj/i.test(ent.name))) {
            return path.join(EXTRACT_ROOT, ent.name);
        }
    }
    throw new Error(`Hero folder not found: ${name}`);
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

function cutYt(source, start, dur, atlas) {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const tmp = path.join(
        VOICELINES_DIR,
        `_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}.ogg`,
    );
    const af = [
        'afade=t=in:st=0:d=0.015',
        `afade=t=out:st=${Math.max(0.05, dur - 0.08).toFixed(3)}:d=0.07`,
        'loudnorm=I=-16:TP=-1.5:LRA=11',
    ].join(',');
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

const MEI = path.join(EXTRACT_ROOT, 'Mei', 'MatchTalk');
const SOLDIER = path.join(EXTRACT_ROOT, 'Soldier_ 76', 'MatchTalk');
const TORB = findHeroDir('Torbjörn');
const a2 = ensureYtVideo(A2);

const voice = {
    meiTime: cutYt(
        a2,
        MEI_TIME_START,
        MEI_TIME_DUR,
        'Mei_-_Hey,_McCree,_do_you_know_what_time_it_is.ogg',
    ),
    cassTime: cutYt(
        a2,
        CASS_TIME_START,
        CASS_TIME_DUR,
        "Cassidy_-_Well,_I'd_say_it's_about..._now_I_see_what_you're_doing_there.ogg",
    ),
    front: copyLoudnorm(
        findExtract(SOLDIER, '00000002B780'),
        'Soldier_76_-_The_front_lines_are_no_place_for_a_scientist.ogg',
    ),
    watchBack: copyLoudnorm(
        findExtract(MEI, '00000002ED55'),
        "Mei_-_I_guess_it's_a_good_thing_I_have_you_to_watch_my_back.ogg",
    ),
    robot: copyLoudnorm(
        findExtractRecursive(TORB, '00000001FFEC'),
        'Torbjörn_-_I_was_wondering_if_I_could_take_a_look_at_your_little_robot.ogg',
    ),
    hammer: copyLoudnorm(
        findExtract(MEI, '00000002ED69'),
        'Mei_-_I_suppose_so..._just_keep_that_hammer_to_yourself.ogg',
    ),
};

for (const old of fs.readdirSync(VOICELINES_DIR)) {
    const drop =
        /^Cassidy_-_well_id_say_its_about_now_i_see/i.test(old) ||
        /^Torbj.*_i_was_wondering_if_i_could_have_a_look_at_your_little/i.test(old);
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

patch(TIME_ID, (c) => {
    c.name = 'What Time Is It';
    c.lines[0].hero = 'Mei';
    c.lines[0].voice = voice.meiTime;
    c.lines[0].subtitles = 'Hey, McCree, do you know what time it is?';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.cassTime;
    c.lines[1].subtitles = "Well, I'd say it's about... now I see what you're doing there!";
});

patch(FRONT_ID, (c) => {
    c.name = 'Front Lines Scientist';
    c.lines[0].hero = 'Soldier 76';
    c.lines[0].voice = voice.front;
    c.lines[0].subtitles = 'The front lines are no place for a scientist.';
    c.lines[1].hero = 'Mei';
    c.lines[1].voice = voice.watchBack;
    c.lines[1].subtitles = "I guess it's a good thing I have you to watch my back.";
});

patch(ROBOT_ID, (c) => {
    c.name = 'Little Robot';
    c.lines[0].hero = 'Torbjörn';
    c.lines[0].voice = voice.robot;
    c.lines[0].subtitles = 'I was wondering if I could take a look at your little robot.';
    c.lines[1].hero = 'Mei';
    c.lines[1].voice = voice.hammer;
    c.lines[1].subtitles = 'I suppose so... just keep that hammer to yourself.';
});

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('Mei Classic audit done');
