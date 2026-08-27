#!/usr/bin/env node
/**
 * Classic Brigitte audit: replace bad YT multi-line cuts from HeroVoice extract,
 * wire missing MatchTalk, rename numbered shells, fix *want* emphasis.
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

const TORB = findTorbDir();
const BRIG = path.join(EXTRACT_ROOT, 'Brigitte', 'MatchTalk');
const CASS = path.join(EXTRACT_ROOT, 'Cassidy', 'MatchTalk');
const PHARAH = path.join(EXTRACT_ROOT, 'Pharah', 'MatchTalk');
const REIN = path.join(EXTRACT_ROOT, 'Reinhardt', 'MatchTalk');

const voice = {
    cassidyArmor: (() => {
        const atlas = 'Cassidy_-_Believe_me,_I_get_wanting_to_wear_the_armor_and_all,_but_following_the_old_man_around_must_be_nothing_but_trouble.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    CASS,
                    '00000004A562.0B2-Believe me, I get wanting to wear the armor and all, but following the old man around must be nothing but trouble.ogg',
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    brigitteHonor: (() => {
        const atlas = "Brigitte_-_I_don't_see_it_that_way._To_me,_it's_an_honor.ogg";
        copyLoudnorm(
            mustExist(path.join(BRIG, "00000004A200.0B2-I don't see it that way. To me, it's an honor.ogg")),
            atlas,
        );
        return atlas;
    })(),
    pharahArmor: (() => {
        const atlas = "Pharah_-_Brigitte,_I'd_love_it_if_you_could_take_a_look_at_my_armor_sometime.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    PHARAH,
                    "00000004CE11.0B2-Brigitte, I'd love it if you could take a look at my armor sometime.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    brigitteFamiliar: copyLoudnorm(
        mustExist(
            path.join(
                BRIG,
                "00000005504B.0B2-It'll take some time for me to get familiar with the design, but if you don't mind, I'd love to!.ogg",
            ),
        ),
        "Brigitte_-_It'll_take_some_time_for_me_to_get_familiar_with_the_design,_but_if_you_don't_mind,_I'd_love_to!.ogg",
    ),
    reinFalter: (() => {
        const atlas = 'Reinhardt_-_Protect_your_teammates,_make_sure_that_they_do_not_falter!.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    REIN,
                    '00000004A606.0B2-Protect your teammates, make sure that they do not falter!.ogg',
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    brigittePapa: (() => {
        const atlas = 'Brigitte_-_Papa,_what_do_you_think_of_my_armor_.ogg';
        copyLoudnorm(
            mustExist(path.join(BRIG, '00000004A207.0B2-Papa, what do you think of my armor_.ogg')),
            atlas,
        );
        return atlas;
    })(),
    torbNotBad: copyLoudnorm(
        mustExist(
            path.join(
                TORB,
                'MatchTalk',
                "00000004C491.0B2-Not bad, not bad. I'm glad you let me add a little something to it.ogg",
            ),
        ),
        "Torbjörn_-_Not_bad,_not_bad._I'm_glad_you_let_me_add_a_little_something_to_it.ogg",
    ),
    torbCore: copyLoudnorm(
        mustExist(
            path.join(
                TORB,
                'MatchTalk',
                '00000004C493.0B2-Your armor seems to be working well. I guess you were right about the core integration design.ogg',
            ),
        ),
        'Torbjörn_-_Your_armor_seems_to_be_working_well._I_guess_you_were_right_about_the_core_integration_design.ogg',
    ),
    brigitteComeAround: (() => {
        const atlas = "Brigitte_-_I_knew_you'd_come_around.ogg";
        copyLoudnorm(
            mustExist(path.join(BRIG, "00000004A1D0.0B2-I knew you'd come around.ogg")),
            atlas,
        );
        return atlas;
    })(),
    torbEngineer: copyLoudnorm(
        mustExist(
            path.join(TORB, 'MatchTalk', "00000004C494.0B2-Isn't it enough to be an engineer, Brigitte_.ogg"),
        ),
        "Torbjörn_-_Isn't_it_enough_to_be_an_engineer,_Brigitte_.ogg",
    ),
    brigitteDoMore: (() => {
        const atlas = 'Brigitte_-_I_felt_like_I_had_to_do_more.ogg';
        copyLoudnorm(
            mustExist(path.join(BRIG, '00000004A1CF.0B2-I felt like I had to do more.ogg')),
            atlas,
        );
        return atlas;
    })(),
};

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

/** @type {[string, (c: any) => void][]} */
const patches = [
    [
        '79f3d087-f3ee-4fd6-8598-a59916a16ad1',
        (c) => {
            c.name = 'Nothing but Trouble';
            c.lines[0].voice = voice.cassidyArmor;
            c.lines[0].subtitles =
                'Believe me, I get wanting to wear the armor and all, but following the old man around must be nothing but trouble.';
            c.lines[1].voice = voice.brigitteHonor;
            c.lines[1].subtitles = "I don't see it that way... to me, it's an honor.";
        },
    ],
    [
        '5067679a-f6f9-4c56-b32f-dca4d228eadd',
        (c) => {
            c.name = 'Look at My Armor';
            c.lines[0].voice = voice.pharahArmor;
            c.lines[1].voice = voice.brigitteFamiliar;
            c.lines[1].subtitles =
                "It'll take some time for me to get familiar with the design, but if you don't mind, I'd love to!";
        },
    ],
    [
        'dd57420e-eea9-451b-b428-7571b7bf8dfe',
        (c) => {
            c.name = 'Focus of the Day';
            const falter = c.lines.find((l) =>
                /falter/i.test(`${l.subtitles || ''} ${l.voice || ''}`),
            );
            if (!falter) throw new Error('falter line missing on Focus of the Day');
            falter.voice = voice.reinFalter;
            falter.subtitles = 'Protect your teammates, make sure that they do not falter!';
        },
    ],
    [
        '05297ce9-ac7a-4cb5-ab06-2371a41c5bcf',
        (c) => {
            c.name = 'Papa Armor';
            c.lines[0].voice = voice.brigittePapa;
            c.lines[1].voice = voice.torbNotBad;
            c.lines[1].subtitles =
                "Not bad, not bad! I'm glad you let me add a little something to it.";
        },
    ],
    [
        '0eb25d43-b370-4149-bd2a-76635e89093b',
        (c) => {
            c.name = 'Core Integration';
            c.lines[0].voice = voice.torbCore;
            c.lines[0].subtitles =
                'Your armor seems to be working well! I guess you were right about the core integration design.';
            c.lines[1].voice = voice.brigitteComeAround;
        },
    ],
    [
        'fbe1f9e5-f222-46bd-9d93-522e86dd9a10',
        (c) => {
            c.name = 'Enough to Be an Engineer';
            c.lines[0].voice = voice.torbEngineer;
            c.lines[0].subtitles = "Isn't it enough to be an engineer, Brigitte?";
            c.lines[1].voice = voice.brigitteDoMore;
        },
    ],
    [
        'b86b8a03-c099-45a7-87b9-dd25a8a66107',
        (c) => {
            c.name = 'Hide Your Face';
            // Audio not in HeroVoice MatchTalk / OT / known YT comps yet — keep empty, fix markup
            c.lines[0].subtitles = 'Genji, how come you hide your face?';
            c.lines[1].subtitles =
                'Because I do not *want* people to fear me... or pity me.';
        },
    ],
];

for (const [id, fn] of patches) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name} (${id.slice(0, 8)})`);
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
console.log(
    'NOTE: Hide Your Face still has empty voices — line not found in extract/Omnic Talking/YT packs.',
);
