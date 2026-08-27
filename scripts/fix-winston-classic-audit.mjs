#!/usr/bin/env node
/**
 * Classic Winston audit: wire missing MatchTalk, replace shared/wrong-line cuts,
 * rename numbered shells. Pharah mother lines from OT (missing from local extract).
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
const OT_CACHE = path.join(REPO, 'scripts/_cache/winston-classic');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const COMIC_ID = '2b092b76-0396-4eb2-ab03-f41bef55b8aa';
const GLASSES_ID = '6eb162c6-7759-46bd-9060-a8432bb9d08f';
const NOTES_ID = '795e674a-abbf-47c8-82b5-a6c5e11625cd';
const NOTES_DUP_ID = 'b8118a1f-61be-4eff-a928-d9578bf97b96';
const MOTHER_ID = '19a136f3-02cb-4dd7-a5a8-f4510c8f304e';
const JOB_ID = 'ca8e8f5c-f353-4983-86ba-ea74ccac9635';
const FEATHER_ID = '630b40fa-15f7-4f32-93da-50c975fcbded';
const RUSSIA_ID = 'efb1a84d-0586-4700-a985-55a47cdbec83';

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

function findOt(substr) {
    const hits = fs
        .readdirSync(OT_CACHE)
        .filter((n) => n.includes(substr) && n.endsWith('.ogg'))
        .map((n) => path.join(OT_CACHE, n))
        .filter((p) => fs.statSync(p).size > 5000 && fs.statSync(p).size < 500_000);
    if (!hits.length) throw new Error(`OT cache missing valid ${substr}`);
    // Prefer smaller real audio over accidental HTML error bodies (~140KB).
    hits.sort((a, b) => fs.statSync(a).size - fs.statSync(b).size);
    return hits[0];
}

const WIN = path.join(EXTRACT_ROOT, 'Winston', 'MatchTalk');
const MEI = path.join(EXTRACT_ROOT, 'Mei', 'MatchTalk');
const S76 = path.join(EXTRACT_ROOT, 'Soldier_ 76', 'MatchTalk');
const ZARYA = path.join(EXTRACT_ROOT, 'Zarya', 'MatchTalk');
const JUNK = path.join(EXTRACT_ROOT, 'Junkrat', 'MatchTalk');
const TORB = path.join(findTorbDir(), 'MatchTalk');

const voice = {
    junkComic: (() => {
        const atlas = 'Junkrat_-_And_I_thought_I_was_supposed_to_be_the_comic_relief.ogg';
        copyLoudnorm(
            mustExist(path.join(JUNK, '00000001FF38.0B2-And I thought I was supposed to be the comic relief.ogg')),
            atlas,
        );
        return atlas;
    })(),
    winstonHey: (() => {
        const atlas = 'Winston_-_Hey....ogg';
        copyLoudnorm(mustExist(path.join(WIN, '000000037623.0B2-Hey!.ogg')), atlas);
        return atlas;
    })(),
    meiGlasses: (() => {
        const atlas = 'Mei_-_I_love_your_glasses..._so_cute!.ogg';
        copyLoudnorm(
            mustExist(path.join(MEI, '00000000BBA0.0B2-I love your glasses... so cute!.ogg')),
            atlas,
        );
        return atlas;
    })(),
    winstonThanks: (() => {
        const atlas = "Winston_-_Oh..._um,_thanks!_I_like_yours,_too!.ogg";
        copyLoudnorm(
            mustExist(path.join(WIN, "00000000BC6A.0B2-Oh... um, thanks! I like yours, too!.ogg")),
            atlas,
        );
        return atlas;
    })(),
    meiNotes: (() => {
        const atlas = 'Mei_-_(giggles)_We_should_compare_notes_sometime!.ogg';
        copyLoudnorm(
            mustExist(
                path.join(MEI, '00000000BC04.0B2-(giggles) We should compare notes sometime!.ogg'),
            ),
            atlas,
        );
        return atlas;
    })(),
    winstonTobel: (() => {
        const atlas =
            "Winston_-_That_would_be_great!_What's_your_opinion_on_the_Tobelsteins'_gravitational_models_.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    WIN,
                    "00000000BC6B.0B2-That would be great! What's your opinion on the Tobelsteins' gravitational models_.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    winstonMother: (() => {
        const atlas = 'Winston_-_Pharah._Your_mother_was_a_hero_to_me._To_all_of_us.ogg';
        copyLoudnorm(findOt('01FD5C'), atlas);
        return atlas;
    })(),
    pharahKnew: (() => {
        const atlas = 'Pharah_-_You_probably_knew_her_better_than_me.ogg';
        copyLoudnorm(findOt('01FCB9'), atlas);
        return atlas;
    })(),
    s76Job: (() => {
        const atlas = 'Soldier_76_-_Think_you_can_do_my_job,_do_you.ogg';
        copyLoudnorm(
            mustExist(path.join(S76, '00000002006E.0B2-Think you can do my job, do you_.ogg')),
            atlas,
        );
        return atlas;
    })(),
    someoneHasTo: (() => {
        const atlas = 'Winston_-_Someone_has_to.ogg';
        copyLoudnorm(mustExist(path.join(WIN, '00000000BC67.0B2-Someone has to.ogg')), atlas);
        return atlas;
    })(),
    torbFeather: (() => {
        const atlas =
            'Torbjörn_-_Winston,_are_you_still_using_that_silly_feather_duster_of_a_gun.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    TORB,
                    '00000001FFEA.0B2-Winston, are you still using that silly feather duster of a gun_.ogg',
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    askAgain: (() => {
        const atlas = "Winston_-_Why_don't_you_come_over_here_and_ask_that_again.ogg";
        copyLoudnorm(
            mustExist(
                path.join(WIN, "00000001FD5F.0B2-Why don't you come over here and ask that again_.ogg"),
            ),
            atlas,
        );
        return atlas;
    })(),
    russia: (() => {
        const atlas = "Zarya_-_Russia_has_no_need_of_Overwatch's_assistance.ogg";
        copyLoudnorm(
            mustExist(
                path.join(ZARYA, "00000002A7E9.0B2-Russia has no need of Overwatch's assistance.ogg"),
            ),
            atlas,
        );
        return atlas;
    })(),
};

// Drop known bad shared cut.
for (const old of ['Pharah_-_you_probably_knew_her_better_than_me.ogg']) {
    const p = path.join(VOICELINES_DIR, old);
    if (fs.existsSync(p) && !Object.values(voice).includes(old)) {
        fs.unlinkSync(p);
        console.log('removed', old);
    }
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

{
    const c = byId.get(COMIC_ID);
    if (!c) throw new Error('Comic Relief missing');
    c.name = 'Hey...';
    c.lines[0].voice = voice.junkComic;
    c.lines[0].subtitles = 'And I thought I was supposed to be the comic relief.';
    c.lines[1].hero = 'Winston';
    c.lines[1].voice = voice.winstonHey;
    c.lines[1].subtitles = 'Hey...';
    console.log('patched Hey...');
}

{
    const c = byId.get(GLASSES_ID);
    if (!c) throw new Error('Glasses missing');
    c.name = 'Cute Glasses';
    c.lines[0].voice = voice.meiGlasses;
    c.lines[0].subtitles = 'I love your glasses, so cute!';
    c.lines[1].voice = voice.winstonThanks;
    c.lines[1].subtitles = 'Oh, uhm, thanks. I like yours, too.';
    console.log('patched Cute Glasses');
}

{
    const c = byId.get(NOTES_ID);
    if (!c) throw new Error('Compare Notes missing');
    c.name = 'Compare Notes';
    c.lines[0].voice = voice.meiNotes;
    c.lines[0].subtitles = '**giggles** We should compare notes some time.';
    c.lines[1].voice = voice.winstonTobel;
    c.lines[1].subtitles =
        "That would be great! What's your opinion on the Tobelsteins' gravitational models?";
    console.log('patched Compare Notes');
}

{
    const dup = byId.get(NOTES_DUP_ID);
    if (dup) {
        // Keep as removed duplicate of Compare Notes — same wiring so it isn't empty.
        dup.name = 'Compare Notes';
        dup.lines[0].voice = voice.meiNotes;
        dup.lines[0].subtitles = '**giggles** We should compare notes some time.';
        dup.lines[1].voice = voice.winstonTobel;
        dup.lines[1].subtitles =
            "That would be great! What's your opinion on the Tobelsteins' gravitational models?";
        console.log('synced duplicate Compare Notes (#456)');
    }
}

{
    const c = byId.get(MOTHER_ID);
    if (!c) throw new Error('Mother Hero missing');
    c.name = 'A Hero to Us';
    c.lines[0].voice = voice.winstonMother;
    c.lines[0].subtitles = 'Pharah. Your mother was a hero to me. To all of us.';
    c.lines[1].voice = voice.pharahKnew;
    c.lines[1].subtitles = 'You probably knew her better than me.';
    console.log('patched A Hero to Us');
}

{
    const c = byId.get(JOB_ID);
    if (!c) throw new Error('Do My Job missing');
    c.name = 'Do My Job';
    c.lines[0].hero = 'Soldier 76';
    c.lines[0].voice = voice.s76Job;
    c.lines[0].subtitles = 'Think you can do my job, do you...';
    c.lines[1].voice = voice.someoneHasTo;
    c.lines[1].subtitles = 'Someone has to.';
    console.log('patched Do My Job');
}

{
    const c = byId.get(FEATHER_ID);
    if (!c) throw new Error('Feather Duster missing');
    c.name = 'Feather Duster';
    c.lines[0].hero = 'Torbjörn';
    c.lines[0].voice = voice.torbFeather;
    c.lines[0].subtitles = 'Winston, are you still using that silly feather duster of a gun?';
    c.lines[1].voice = voice.askAgain;
    c.lines[1].subtitles = "Why don't you come over here and ask that again?";
    console.log('patched Feather Duster');
}

{
    const c = byId.get(RUSSIA_ID);
    if (!c) throw new Error('Russia Assistance missing');
    c.name = 'No Need for Assistance';
    c.lines[0].voice = voice.russia;
    c.lines[0].subtitles = "Russia has no need of Overwatch's assistance.";
    console.log('patched No Need for Assistance');
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
