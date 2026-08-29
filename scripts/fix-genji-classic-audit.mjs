#!/usr/bin/env node
/**
 * Classic Genji audit: fix wrong shared reply files, recut mashed YT clips,
 * wire extract for Cassidy bullet / Hanzo empire / better-than-me.
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

const FASTER_ID = 'e6aa251c-4338-4500-83d4-1f930c2de55f';
const ROUTE66_ID = '6e0cefc3-a7ad-4057-b203-81ef3b73a2ca';
const RECOGNIZE_ID = '9707a16e-3722-4712-8837-a66d57b4dd94';
const EMPIRE_ID = 'bd7e0d4a-e99b-4954-8fa8-200f8f5dd16f';
const BETTER_ID = 'a9be1a27-9a47-498c-81f8-0d18ce3a61c6';

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
    const tmp = path.join(VOICELINES_DIR, `_tmp_${Date.now()}.ogg`);
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

function cutYt(videoId, start, end, atlas) {
    const source = mustExist(path.join(YT_CACHE, `${videoId}.webm`));
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const tmp = path.join(VOICELINES_DIR, `_tmp_${Date.now()}.ogg`);
    const dur = Math.max(0.2, end - start);
    const r = spawnSync(
        FFMPEG,
        [
            '-y',
            '-ss',
            String(start),
            '-i',
            source,
            '-t',
            String(dur),
            '-af',
            'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-c:a',
            'libvorbis',
            '-q:a',
            '6',
            tmp,
        ],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-600));
        throw new Error(`yt cut failed for ${atlas}`);
    }
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(tmp, dest);
    console.log(`yt-cut ${atlas} (${start.toFixed(2)}-${end.toFixed(2)} @ ${videoId})`);
    return atlas;
}

const CASS = path.join(EXTRACT_ROOT, 'Cassidy', 'MatchTalk');
const GENJI = path.join(EXTRACT_ROOT, 'Genji', 'MatchTalk');
const HANZO = path.join(EXTRACT_ROOT, 'Hanzo', 'MatchTalk');

const voice = {
    fasterBullet: (() => {
        const atlas =
            "Cassidy_-_You_might_be_fast,_Genji,_but_you_ain't_faster_than_a_bullet.ogg";
        copyLoudnorm(findExtract(CASS, '00000002A881'), atlas);
        return atlas;
    })(),
    findOut: (() => {
        const atlas = "Genji_-_Why_don't_we_find_out.ogg";
        copyLoudnorm(findExtract(GENJI, '00000002A7C0'), atlas);
        return atlas;
    })(),
    // LuC9kfFJ8qo: Genji why@175.60 … McCree@178.16; Cassidy "the"@178.32 — end before Cassidy.
    comeBack: cutYt(
        'LuC9kfFJ8qo',
        175.45,
        178.16,
        'Genji_-_Why_have_you_come_back_to_this_place,_McCree.ogg',
    ),
    // Cassidy "the"@178.32 … speech ends ~183.55; next "how'd"@185.12
    unfinished: cutYt(
        'LuC9kfFJ8qo',
        178.28,
        183.7,
        'Cassidy_-_The_only_thing_it_ever_is..._Unfinished_business,_and_unhappy_history.ogg',
    ),
    // CzVg5SQ7TlI: what's@43.12 … me@46.31; Hanzo "you may"@46.64 — end on "me".
    recognize: cutYt(
        'CzVg5SQ7TlI',
        42.95,
        46.30,
        "Genji_-_What's_wrong,_Hanzo__Don't_you_recognize_me.ogg",
    ),
    brotherNot: (() => {
        const atlas =
            'Hanzo_-_You_may_call_yourself_my_brother,_but_you_are_not_the_Genji_I_knew.ogg';
        copyLoudnorm(findExtract(HANZO, '000000021193'), atlas);
        return atlas;
    })(),
    empire: (() => {
        const atlas = 'Hanzo_-_We_could_have_built_an_empire_together.ogg';
        copyLoudnorm(findExtract(HANZO, '00000000B1FC'), atlas);
        return atlas;
    })(),
    dreamNotMine: (() => {
        const atlas = 'Genji_-_That_was_your_dream,_not_mine.ogg';
        copyLoudnorm(findExtract(GENJI, '00000000BAC9'), atlas);
        return atlas;
    })(),
    betterThan: (() => {
        const atlas = 'Hanzo_-_Think_you_can_do_better_than_me.ogg';
        copyLoudnorm(findExtract(HANZO, '00000000B214'), atlas);
        return atlas;
    })(),
    certain: (() => {
        const atlas = 'Genji_-_I_am_certain_of_it.ogg';
        copyLoudnorm(findExtract(GENJI, '00000000BA4C'), atlas);
        return atlas;
    })(),
};

for (const old of [
    'Genji_-_why_have_you_come_back_to_this_place_mccree.ogg',
    'Cassidy_-_the_only_thing_it_ever_is_unfinished_business_and_unhappy_history.ogg',
    'Genji_-_whats_wrong_hanzo_dont_you_recognize_me.ogg',
    'Hanzo_-_together_we_couldve_built_an_empire.ogg',
]) {
    const p = path.join(VOICELINES_DIR, old);
    if (fs.existsSync(p) && !Object.values(voice).includes(old)) {
        fs.unlinkSync(p);
        console.log('removed', old);
    }
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

{
    const c = byId.get(FASTER_ID);
    if (!c) throw new Error('Faster than a bullet missing');
    c.name = 'Faster Than a Bullet';
    c.lines[0].hero = 'Cassidy';
    c.lines[0].voice = voice.fasterBullet;
    c.lines[0].subtitles = "You might be fast, Genji, but you ain't faster than a bullet.";
    c.lines[1].hero = 'Genji';
    c.lines[1].voice = voice.findOut;
    c.lines[1].subtitles = "Why don't we find out?";
    console.log('patched Faster Than a Bullet');
}

{
    const c = byId.get(ROUTE66_ID);
    if (!c) throw new Error('Route 66 Genji/Cassidy missing');
    c.name = 'Unfinished Business';
    c.tags = Array.from(new Set([...(c.tags || []), 'Classic', 'Map Specific']));
    c.mapChoices = ['Route 66'];
    c.lines[0].hero = 'Genji';
    c.lines[0].voice = voice.comeBack;
    c.lines[0].subtitles = 'Why have you come back to this place, McCree?';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.unfinished;
    c.lines[1].subtitles = 'The only thing it ever is... Unfinished business, and unhappy history.';
    console.log('patched Unfinished Business (Route 66)');
}

{
    const c = byId.get(RECOGNIZE_ID);
    if (!c) throw new Error('Recognize me missing');
    c.name = "Don't You Recognize Me";
    c.lines[0].hero = 'Genji';
    c.lines[0].voice = voice.recognize;
    c.lines[0].subtitles = "What's wrong, Hanzo? Don't you recognize me?";
    c.lines[1].hero = 'Hanzo';
    c.lines[1].voice = voice.brotherNot;
    c.lines[1].subtitles = 'You may call yourself my brother, but you are not the Genji I knew.';
    console.log('patched Recognize Me');
}

{
    const c = byId.get(EMPIRE_ID);
    if (!c) throw new Error('Empire missing');
    c.name = 'Built an Empire';
    c.lines[0].hero = 'Hanzo';
    c.lines[0].voice = voice.empire;
    c.lines[0].subtitles = 'We could have built an empire together.';
    c.lines[1].hero = 'Genji';
    c.lines[1].voice = voice.dreamNotMine;
    c.lines[1].subtitles = 'That was your dream. Not mine.';
    console.log('patched Built an Empire');
}

{
    const c = byId.get(BETTER_ID);
    if (!c) throw new Error('Better than me missing');
    c.name = 'Better Than Me';
    c.lines[0].hero = 'Hanzo';
    c.lines[0].voice = voice.betterThan;
    c.lines[0].subtitles = 'Think you can do better than me?';
    c.lines[1].hero = 'Genji';
    c.lines[1].voice = voice.certain;
    c.lines[1].subtitles = 'I am certain of it.';
    console.log('patched Better Than Me');
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
