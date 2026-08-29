#!/usr/bin/env node
/**
 * Classic Reaper audit: wire wrong shared reply files, fix mashed mirror cut,
 * pull Widow/Reaper trust-Sombra from OT, rename numbered shells.
 *
 * Anubis rat exchange: no MatchTalk / OT / wiki audio found (OW1 compilation
 * notes it as likely apocryphal). Tagged Map Specific; voices left empty.
 *
 * Usage:
 *   node scripts/fix-reaper-classic-audit.mjs
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
const OT_CACHE = path.join(REPO, 'scripts/_cache/reaper-classic');
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

const GUNS_ID = 'a8879e6c-9bed-40d3-af08-1f2de05dd637';
const MIRROR_ID = '2c8360e6-6789-48cc-9ee3-e916cfd365db';
const RAT_ID = 'f66ef715-41dc-4ee8-8a2d-2e9c32a59e22';
const END_ID = '0992ab90-ab15-4fd5-bde2-f41f9246019c';
const BAD_GUY_ID = '1f6e5e86-f687-453f-a6f2-f245a0f1794b';
const PLAN_ID = '37eb7b14-80cb-48bb-b690-f4d51fcadea3';
const TRUST_ID = '59a84315-e98a-473a-99e4-abbd3bac2d3c';

const OT_FILES = {
    trust:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/08/000000036372.0B2-I-dont-understand-how-you-can-trust-Sombra.ogg',
    uses:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/08/00000003854C.0B2-I-dont.-But-Sombra-has-her-uses-and-I-know-what-shes-been-up-to.ogg',
};

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
    const tmp = path.join(VOICELINES_DIR, `_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}.ogg`);
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

const CASS = path.join(EXTRACT_ROOT, 'Cassidy', 'MatchTalk');
const REAPER = path.join(EXTRACT_ROOT, 'Reaper', 'MatchTalk');
const SOLDIER = path.join(EXTRACT_ROOT, 'Soldier_ 76', 'MatchTalk');
const SOMBRA = path.join(EXTRACT_ROOT, 'Sombra', 'MatchTalk');

mustExist(CASS);
mustExist(REAPER);
mustExist(SOLDIER);
mustExist(SOMBRA);

const trustSrc = downloadOt(OT_FILES.trust, '000000036372-trust-Sombra.ogg');
const usesSrc = downloadOt(OT_FILES.uses, '00000003854C-Sombra-has-her-uses.ogg');

const voice = {
    guns: copyLoudnorm(
        findExtract(CASS, '00000000ACDA'),
        "Cassidy_-_You_weren't_given_those_guns_to_toss_them_around_like_trash.ogg",
    ),
    lessons: copyLoudnorm(
        findExtract(REAPER, '00000000AE91'),
        "Reaper_-_I_don't_take_lessons_from_you.ogg",
    ),
    ridiculous: copyLoudnorm(
        findExtract(REAPER, '00000000AEB7'),
        'Reaper_-_You_look_ridiculous.ogg',
    ),
    mirror: copyLoudnorm(
        findExtract(CASS, '00000000B3F5'),
        'Cassidy_-_(laughs)_Looked_in_the_mirror_lately.ogg',
    ),
    endToYou: copyLoudnorm(
        findExtract(SOLDIER, '00000000B303'),
        "Soldier_76_-_One_of_these_days,_someone's_going_to_put_an_end_to_you.ogg",
    ),
    invite: copyLoudnorm(
        findExtract(REAPER, '00000001FCC3'),
        'Reaper_-_I_invite_them_to_try.ogg',
    ),
    badGuy: copyLoudnorm(
        findExtract(SOLDIER, '00000000B304'),
        "Soldier_76_-_Well,_you_sure_take_to_this_bad_guy_thing_easily,_don't_you.ogg",
    ),
    boyScout: copyLoudnorm(
        findExtract(REAPER, '00000000AED0'),
        'Reaper_-_And_you_sure_know_how_to_play_boy_scout.ogg',
    ),
    plan: copyLoudnorm(
        findExtract(REAPER, '00000002A826'),
        'Reaper_-_Try_to_stick_to_the_plan,_Sombra.ogg',
    ),
    careful: copyLoudnorm(
        findExtract(SOMBRA, '00000002EA7C'),
        "Sombra_-_Look,_someone_has_to_be_ready_when_all_your_careful_planning_doesn't_pan_out.ogg",
    ),
    trust: copyLoudnorm(
        trustSrc,
        "Widowmaker_-_I_don't_understand_how_you_can_trust_Sombra.ogg",
    ),
    uses: copyLoudnorm(
        usesSrc,
        "Reaper_-_I_don't._But_Sombra_has_her_uses,_and_I_know_what_she's_been_up_to.ogg",
    ),
};

for (const old of [
    'Cassidy_-_looked_in_a_mirror_lately.ogg',
]) {
    const p = path.join(VOICELINES_DIR, old);
    if (fs.existsSync(p) && !Object.values(voice).includes(old)) {
        fs.unlinkSync(p);
        console.log('removed', old);
    }
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

function patch(id, fn) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

patch(GUNS_ID, (c) => {
    c.name = 'Toss Them Around';
    c.lines[0].hero = 'Cassidy';
    c.lines[0].voice = voice.guns;
    c.lines[0].subtitles = "You weren't given those guns to toss them around like trash.";
    c.lines[1].hero = 'Reaper';
    c.lines[1].voice = voice.lessons;
    c.lines[1].subtitles = "I don't take lessons from you.";
});

patch(MIRROR_ID, (c) => {
    c.name = 'Look Ridiculous';
    c.lines[0].hero = 'Reaper';
    c.lines[0].voice = voice.ridiculous;
    c.lines[0].subtitles = 'You look ridiculous.';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.mirror;
    c.lines[1].subtitles = '(laughs) Looked in the mirror lately?';
});

patch(RAT_ID, (c) => {
    c.name = 'Find in There';
    c.tags = [...new Set([...(c.tags || []), 'Classic', 'Map Specific'])];
    c.mapChoices = ['Temple of Anubis'];
    c.lines[0].hero = 'Reaper';
    c.lines[0].voice = '';
    c.lines[0].subtitles = 'What did you find in there, rat?';
    c.lines[1].hero = 'Junkrat';
    c.lines[1].voice = '';
    c.lines[1].subtitles = "No idea what ya' sayin' mate.";
    console.warn(
        'WARN: Anubis rat lines have no extract/OT/wiki audio (likely apocryphal / map-cut). Voices left empty.',
    );
});

patch(END_ID, (c) => {
    c.name = 'Put an End to You';
    c.lines[0].hero = 'Soldier 76';
    c.lines[0].voice = voice.endToYou;
    c.lines[0].subtitles = "One of these days, someone's going to put an end to you.";
    c.lines[1].hero = 'Reaper';
    c.lines[1].voice = voice.invite;
    c.lines[1].subtitles = 'I invite them to try.';
});

patch(BAD_GUY_ID, (c) => {
    c.name = 'Bad Guy Thing';
    c.lines[0].hero = 'Soldier 76';
    c.lines[0].voice = voice.badGuy;
    c.lines[0].subtitles = "Well, you sure take to this bad guy thing easily, don't you?";
    c.lines[1].hero = 'Reaper';
    c.lines[1].voice = voice.boyScout;
    c.lines[1].subtitles = 'And you sure know how to play boy scout.';
});

patch(PLAN_ID, (c) => {
    c.name = 'Stick to the Plan';
    c.lines[0].hero = 'Reaper';
    c.lines[0].voice = voice.plan;
    c.lines[0].subtitles = 'Try to stick to the plan, Sombra.';
    c.lines[1].hero = 'Sombra';
    c.lines[1].voice = voice.careful;
    c.lines[1].subtitles =
        "Look, someone has to be ready when all your careful planning doesn't pan out.";
});

patch(TRUST_ID, (c) => {
    c.name = 'Trust Sombra';
    c.lines[0].hero = 'Widowmaker';
    c.lines[0].voice = voice.trust;
    c.lines[0].subtitles = "I don't understand how you can trust Sombra.";
    c.lines[1].hero = 'Reaper';
    c.lines[1].voice = voice.uses;
    c.lines[1].subtitles =
        "I don't. But Sombra has her uses, and I know what she's been up to.";
});

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('Reaper Classic audit done');
