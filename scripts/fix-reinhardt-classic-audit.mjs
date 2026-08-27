#!/usr/bin/env node
/**
 * Classic Reinhardt audit: trim D.Va hope quiet tail, restore Mercy "Reinhardt." opener,
 * wire missing ice-fishing / NYE replies, replace hard-to-hear + drinks wrong line,
 * multipath Slow Brain + Post-Mission Drinks.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
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

const DRAGGING_ID = '78aaaf44-9f5e-4e87-bbfa-fc5ac37acf09';
const ICE_FISHING_ID = '1dff5f05-6879-4569-b7c4-5247a9194b5e';
const THATLL_BE_ID = '013d99e1-c700-45d9-b1a1-f6da3bc8504f';
const REBUILDING_ID = 'c651d2d5-3387-4f65-ae1f-725101da4313';
const HOPE_SOLO_ID = 'c87e05cd-4f2c-48b5-8af9-a21e810160e9';
const SLOW_BRAIN_ID = '13a24769-535e-4cf2-bca4-f02ab60df4b5';
const DRINKS_ID = 'f4fc13fd-2746-4a79-ba8d-605f6aa0fb9f';

const HOPE_ATLAS =
    'D.Va_-_Seeing_what_happened_after_the_war_here_gives_me_hope_for_the_rebuilding_of_my_country.ogg';
const MERCY_DRAG_ATLAS =
    "Mercy_-_Reinhardt,_I_don't_approve_of_you_dragging_that_poor_girl_around_on_your_adventures.ogg";

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return p;
}

function findTorbDir() {
    for (const name of fs.readdirSync(EXTRACT_ROOT)) {
        if (/^torbj/i.test(name.normalize('NFC'))) return path.join(EXTRACT_ROOT, name);
    }
    throw new Error('Torbjörn extract folder not found');
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

/** Cut [start, end) seconds from a compilation webm into a theater ogg. */
function cutYt(videoId, start, end, atlas) {
    const source = mustExist(path.join(YT_CACHE, `${videoId}.webm`));
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    // ffmpeg on Windows chokes on apostrophes in -y output paths; write via temp.
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

const REIN = path.join(EXTRACT_ROOT, 'Reinhardt', 'MatchTalk');
const TORB = path.join(findTorbDir(), 'MatchTalk');

const voice = {
    // Prior cut 6.85-14.5 left ~2.7s dead air after "country"; end before Orisa VO.
    hopeCountry: cutYt('PM7_Sk3uQLM', 6.85, 12.05, HOPE_ATLAS),
    // Third take: "reinhardt" cue ~256.96, "i" @257.84 — prior start 257.78 dropped the name.
    draggingMercy: cutYt('9seNrt4ynZA', 256.95, 261.5, MERCY_DRAG_ATLAS),
    thatllBe: (() => {
        const atlas = "Reinhardt_-_That'll_be_the_day....ogg";
        copyLoudnorm(findExtract(REIN, '000000038157'), atlas);
        return atlas;
    })(),
    lastYear: (() => {
        const atlas =
            "Reinhardt_-_Last_year__Heh,_I'll_show_you!_I'll_catch_twice_as_many_as_you_this_year!.ogg";
        copyLoudnorm(findExtract(REIN, '000000038158'), atlas);
        return atlas;
    })(),
    hardToHear: (() => {
        const atlas =
            "Reinhardt_-_Ah,_could_you_say_that_again__Sometimes_it's_hard_to_hear_you_all_the_way_down_there!.ogg";
        copyLoudnorm(findExtract(REIN, '000000021DEE'), atlas);
        return atlas;
    })(),
    heightMood: (() => {
        const atlas =
            "Reinhardt_-_Ja,_and_I_sometimes_wonder_if_your_height_is_why_you're_always_in_such_a_bad_mood.ogg";
        copyLoudnorm(findExtract(REIN, '00000000AE30'), atlas);
        return atlas;
    })(),
    drinksTorb: (() => {
        const atlas =
            'Torbjörn_-_Reinhardt._Least_number_of_eliminations_buys_the_post-mission_drinks_.ogg';
        copyLoudnorm(findExtract(TORB, '00000001FFEB'), atlas);
        return atlas;
    })(),
    kidsLaugh: (() => {
        const atlas = "Reinhardt_-_Let's_show_these_kids_how_it's_done.ogg";
        copyLoudnorm(findExtract(REIN, '00000000AE8B'), atlas);
        return atlas;
    })(),
    bestMan: (() => {
        const atlas = 'Reinhardt_-_Agreed!_Let_the_best_man_win.ogg';
        copyLoudnorm(findExtract(REIN, '000000021DED'), atlas);
        return atlas;
    })(),
};

// Drop obsolete mashed / bad-cut filenames when replaced.
for (const old of [
    'Reinhardt_-_ah_could_you_say_that_again_sometimes_its_hard_to_hear_you.ogg',
    'Reinhardt_-_agreed_let_the_best_men_win.ogg',
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
    const c = byId.get(DRAGGING_ID);
    if (!c) throw new Error('Dragging Brigitte missing');
    const mercy = c.lines.find((l) => /don't approve of you dragging/i.test(l.subtitles || ''));
    if (!mercy) throw new Error('Dragging Mercy line missing');
    mercy.voice = voice.draggingMercy;
    mercy.subtitles =
        "Reinhardt. I don't approve of you dragging that poor girl around on your adventures.";
    console.log('patched Dragging Brigitte Mercy opener');
}

{
    const c = byId.get(ICE_FISHING_ID);
    if (!c) throw new Error('Ice fishing missing');
    c.name = 'Ice Fishing';
    c.lines[1].voice = voice.lastYear;
    c.lines[1].subtitles =
        "Last year? Heh, I'll show you! I'll catch *twice* as many as you this year!";
    console.log('patched Ice Fishing');
}

{
    const c = byId.get(THATLL_BE_ID);
    if (!c) throw new Error("That'll be the day missing");
    c.name = "That'll Be the Day";
    c.lines[1].voice = voice.thatllBe;
    c.lines[1].subtitles = "That'll be the day...";
    console.log("patched That'll Be the Day");
}

{
    const hopeVoice = voice.hopeCountry;
    for (const id of [REBUILDING_ID, HOPE_SOLO_ID]) {
        const c = byId.get(id);
        if (!c) continue;
        for (const l of c.lines || []) {
            if (/Seeing what happened/i.test(l.subtitles || '')) l.voice = hopeVoice;
        }
    }
    console.log('patched D.Va hope country (trimmed quiet tail)');
}

{
    const c = byId.get(SLOW_BRAIN_ID);
    if (!c) throw new Error('Slow Brain missing');
    const torb = c.lines.find((l) => /armor slows your brain/i.test(l.subtitles || ''));
    const height = c.lines.find((l) => /height.*bad mood/i.test(l.subtitles || ''));
    const hear = c.lines.find((l) => /hard to hear you/i.test(l.subtitles || ''));
    if (!torb || !height || !hear) throw new Error('Slow Brain lines missing');
    height.voice = voice.heightMood;
    height.subtitles =
        "Ja. And I sometimes wonder if your *height* is why you're always in such a bad mood.";
    hear.voice = voice.hardToHear;
    hear.subtitles =
        "Ah, could you say that again? Sometimes it's hard to hear you all the way down there!";
    c.name = 'Slow Brain';
    c.tags = Array.from(new Set([...(c.tags || []).filter((t) => t !== 'Multi Path'), 'Classic', 'Multi Path']));
    const pathHeight = createDialoguePathId();
    const pathHear = createDialoguePathId();
    c.paths = [
        { id: pathHeight, label: 'Height', lineIds: [torb.id, height.id] },
        { id: pathHear, label: 'Hard to hear', lineIds: [torb.id, hear.id] },
    ];
    c.selectedPathId = pathHeight;
    console.log('patched Slow Brain multipath');
}

{
    const c = byId.get(DRINKS_ID);
    if (!c) throw new Error('Post-mission drinks missing');
    const torb = c.lines[0];
    const kids = c.lines.find((l) => /show these kids/i.test(l.subtitles || ''));
    const agreed = c.lines.find((l) => /best man/i.test(l.subtitles || '') || /best men/i.test(l.subtitles || ''));
    if (!torb || !kids || !agreed) throw new Error('Drinks lines missing');
    torb.hero = 'Torbjörn';
    torb.voice = voice.drinksTorb;
    torb.subtitles = 'Reinhardt. Least number of eliminations buys the post-mission drinks?';
    kids.hero = 'Reinhardt';
    kids.voice = voice.kidsLaugh;
    kids.subtitles = "**laughs** Let's show these kids how it's done.";
    agreed.hero = 'Reinhardt';
    agreed.voice = voice.bestMan;
    agreed.subtitles = 'Agreed! Let the best man win.';
    c.name = 'Post-Mission Drinks';
    c.tags = Array.from(new Set([...(c.tags || []).filter((t) => t !== 'Multi Path'), 'Classic', 'Multi Path']));
    const pathKids = createDialoguePathId();
    const pathAgreed = createDialoguePathId();
    c.paths = [
        { id: pathKids, label: 'Kids', lineIds: [torb.id, kids.id] },
        { id: pathAgreed, label: 'Best man', lineIds: [torb.id, agreed.id] },
    ];
    c.selectedPathId = pathKids;
    console.log('patched Post-Mission Drinks multipath');
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
