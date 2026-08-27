#!/usr/bin/env node
/**
 * Classic Doomfist audit: replace bad YT multi-line cuts from HeroVoice / OT,
 * wire missing Cassidy "Talon wears" reply, rename numbered shells.
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
const OT_CACHE = path.join(REPO, 'scripts/_cache/doomfist-classic');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const REAL_CLOTHES_ID = '88342f70-8242-4d21-b637-e97aff2e835f';
const HOSPITAL_ID = '28e80879-bb9c-44cb-b71c-c0702463c263';
const HINT_ID = '420cd0f4-857a-4715-8bfc-e4fe697a694b';

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return p;
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
    console.log(`loudnorm ${atlas}`);
    return atlas;
}

const DOOM = path.join(EXTRACT_ROOT, 'Doomfist', 'MatchTalk');
const CASS = path.join(EXTRACT_ROOT, 'Cassidy', 'MatchTalk');
const REIN = path.join(EXTRACT_ROOT, 'Reinhardt', 'MatchTalk');

const voice = {
    winningSide: (() => {
        const atlas =
            'Doomfist_-_You_know,_McCree,_the_winning_side_would_pay_much_better._Maybe,_buy_yourself_some_real_clothes.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    OT_CACHE,
                    '00000004142E-You-know-McCree-the-winning-side-would-pay-much-better.-Maybe-buy-yourself-some-real-clothes.ogg',
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    clothes: (() => {
        const atlas = 'Cassidy_-_My_clothes!_Have_you_seen_some_of_the_things_Talon_wears.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    OT_CACHE,
                    '00000004A538-My-clothes_-Have-you-seen-some-of-the-things-Talon-wears_.ogg',
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    putAway: (() => {
        const atlas = "Cassidy_-_They_wouldn't_even_have_to_pay_me_to_put_you_away.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    CASS,
                    "00000004A54E.0B2-They wouldn't even have to pay me to put you away.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    hospital: (() => {
        const atlas = 'Doomfist_-_Then_how_would_you_afford_the_hospital_bills_.ogg';
        copyLoudnorm(
            mustExist(
                path.join(DOOM, '00000004143F.0B2-Then how would you afford the hospital bills_.ogg'),
            ),
            atlas,
        );
        return atlas;
    })(),
    hint: (() => {
        const atlas = "Doomfist_-_You_don't_take_a_hint,_do_you,_Reinhardt.ogg";
        copyLoudnorm(
            mustExist(
                path.join(DOOM, "000000041466.0B2-You don't take a hint, do you Reinhardt_.ogg"),
            ),
            atlas,
        );
        return atlas;
    })(),
    stayDown: (() => {
        const atlas =
            "Reinhardt_-_And_you_don't_know_how_to_stay_down_when_you're_beaten.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    REIN,
                    "00000004A602.0B2-And you don't know to stay down when you're beaten.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
};

// Drop obsolete bad-cut filenames when replaced by punctuated atlas names.
for (const old of [
    'Doomfist_-_you_know_mccree_the_winning_side_would_pay_much_better_maybe_buy.ogg',
    'Cassidy_-_they_wouldnt_have_to_pay_me_to_put_you_away.ogg',
    "Doomfist_-_You_don't_take_a_hint,_do_you_Reinhardt_.ogg",
    'Reinhardt_-_and_you_dont_know_how_to_stay_down_when_you_are_beaten.ogg',
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
    const c = byId.get(REAL_CLOTHES_ID);
    if (!c) throw new Error('Real Clothes missing');
    c.name = 'Real Clothes';
    c.lines[0].voice = voice.winningSide;
    c.lines[0].subtitles =
        'You know, McCree, the winning side would pay much better. Maybe, buy yourself some real clothes?';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.clothes;
    c.lines[1].subtitles = 'My clothes!? Have you seen some of the things Talon wears?';
    console.log('patched Real Clothes');
}

{
    const c = byId.get(HOSPITAL_ID);
    if (!c) throw new Error('Hospital Bills missing');
    c.name = 'Hospital Bills';
    c.lines[0].hero = 'Cassidy';
    c.lines[0].voice = voice.putAway;
    c.lines[0].subtitles = "They wouldn't even have to pay me to put you away!";
    c.lines[1].voice = voice.hospital;
    c.lines[1].subtitles = 'Then how would you afford the hospital bills?';
    console.log('patched Hospital Bills');
}

{
    const c = byId.get(HINT_ID);
    if (!c) throw new Error('Take a Hint missing');
    c.name = 'Take a Hint';
    c.lines[0].voice = voice.hint;
    c.lines[0].subtitles = "You don't take a hint, do you, Reinhardt?";
    c.lines[1].voice = voice.stayDown;
    c.lines[1].subtitles = "And you don't know how to stay down when you're beaten.";
    console.log('patched Take a Hint');
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
