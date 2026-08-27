#!/usr/bin/env node
/**
 * Classic Mercy audit: replace bad YT cuts from HeroVoice extract,
 * rip missing footsteps/Brigitte/Torb lines from classic compilation,
 * add Swiss Chocolates multipath, merge Dragging Brigitte multipath.
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
const YT_CACHE = path.join(REPO, 'scripts/_cache/classic-yt');
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
        console.error(r.stderr?.slice(-600));
        throw new Error(`ffmpeg failed for ${atlas}`);
    }
    console.log(`loudnorm ${atlas}`);
    return atlas;
}

/** Cut [start, end) seconds from a compilation webm into a theater ogg. */
function cutYt(videoId, start, end, atlas) {
    const source = mustExist(path.join(YT_CACHE, `${videoId}.webm`));
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const dur = Math.max(0.2, end - start);
    const args = [
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
        dest,
    ];
    const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-600));
        throw new Error(`yt cut failed for ${atlas}`);
    }
    console.log(`yt-cut ${atlas} (${start.toFixed(2)}-${end.toFixed(2)} @ ${videoId})`);
    return atlas;
}

function line(hero, subtitles, voice, id = createDialogueLineId()) {
    return {
        id,
        hero,
        voice: voice || '',
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
        era: 'Overwatch',
        status: 'active',
    };
}

const TORB = findTorbDir();
const MERCY = path.join(EXTRACT_ROOT, 'Mercy', 'MatchTalk');
const GENJI = path.join(EXTRACT_ROOT, 'Genji', 'MatchTalk');
const MEI = path.join(EXTRACT_ROOT, 'Mei', 'MatchTalk');
const PHARAH = path.join(EXTRACT_ROOT, 'Pharah', 'MatchTalk');
const REIN = path.join(EXTRACT_ROOT, 'Reinhardt', 'MatchTalk');

const ex = {
    stayedLate: mustExist(
        path.join(
            MERCY,
            '000000043A71.0B2-You were the only other person who stayed up so late. I enjoyed our conversations.ogg',
        ),
    ),
    swissMercy: mustExist(
        path.join(MERCY, "00000002A89B.0B2-I got you some chocolates, Genji. Swiss. They're the best.ogg"),
    ),
    shareGenji: mustExist(
        path.join(GENJI, '00000002A7C2.0B2-Thank you, Angela. Perhaps you could share them with me.ogg'),
    ),
    notSwissGenji: mustExist(
        path.join(GENJI, '00000002A7BE.0B2-Angela, I have some chocolates for you. Not Swiss.ogg'),
    ),
    supposeMercy: mustExist(
        path.join(MERCY, '00000002A89D.0B2-(mock sigh) I suppose it will have to do. Thank you, Genji.ogg'),
    ),
    agedMei: mustExist(
        path.join(MEI, "0000000211C7.0B2-Dr. Ziegler, I don't think you've aged a day since I last saw you!.ogg"),
    ),
    neitherMercy: mustExist(path.join(MERCY, '00000001FF5E.0B2-And neither have you, Mei.ogg')),
    proudMercy: mustExist(
        path.join(
            MERCY,
            "00000001FF76.0B2-Pharah, if your mother could see you now, I think she'd be proud of you.ogg",
        ),
    ),
    firstTimePharah: mustExist(
        path.join(PHARAH, "00000001FCBA.0B2-There's a first time for everything, I guess.ogg"),
    ),
    holidaysMercy: mustExist(
        path.join(MERCY, '000000038085.0B2-Reinhardt, what are your plans for the holidays_.ogg'),
    ),
    gothenburgRein: mustExist(
        path.join(
            REIN,
            "000000038159.0B2-I'll probably visit Torbjörn's family in Gothenberg, like the last few years.ogg",
        ),
    ),
    appleMercy: mustExist(
        path.join(MERCY, "000000038086.0B2-(sighs) Torbjörn, I miss Ingrid's apple pie at the holidays.ogg"),
    ),
    appleTorb: mustExist(
        path.join(TORB, 'MatchTalk', '000000037EE1.0B2-Well, it just so happens she has some saved for you.ogg'),
    ),
};

// Prefer stable existing atlas names where conversations already point at them.
const voice = {
    stayedLate: (() => {
        const atlas = 'Mercy_-_you_were_the_only_one_who_stayed_up_so_late_i_enjoyed.ogg';
        copyLoudnorm(ex.stayedLate, atlas);
        return atlas;
    })(),
    swissMercy: copyLoudnorm(
        ex.swissMercy,
        "Mercy_-_I_got_you_some_chocolates,_Genji._Swiss._They're_the_best.ogg",
    ),
    shareGenji: (() => {
        const atlas = 'Genji_-_Thank_you,_Angela._Perhaps_you_could_share_them_with_me.ogg';
        copyLoudnorm(ex.shareGenji, atlas);
        return atlas;
    })(),
    notSwissGenji: copyLoudnorm(
        ex.notSwissGenji,
        'Genji_-_Angela,_I_have_some_chocolates_for_you._Not_Swiss.ogg',
    ),
    supposeMercy: copyLoudnorm(
        ex.supposeMercy,
        'Mercy_-_(mock_sigh)_I_suppose_it_will_have_to_do._Thank_you,_Genji.ogg',
    ),
    agedMei: copyLoudnorm(
        ex.agedMei,
        "Mei_-_Dr._Ziegler,_I_don't_think_you've_aged_a_day_since_I_last_saw_you!.ogg",
    ),
    neitherMercy: (() => {
        const atlas = 'Mercy_-_And_neither_have_you,_Mei.ogg';
        copyLoudnorm(ex.neitherMercy, atlas);
        return atlas;
    })(),
    proudMercy: copyLoudnorm(
        ex.proudMercy,
        "Mercy_-_Pharah,_if_your_mother_could_see_you_now,_I_think_she'd_be_proud_of_you.ogg",
    ),
    firstTimePharah: (() => {
        const atlas = "Pharah_-_There's_a_first_time_for_everything,_I_guess.ogg";
        copyLoudnorm(ex.firstTimePharah, atlas);
        return atlas;
    })(),
    // Missing from extract — cut from Mercy classic compilation
    // Word-timed windows from 9seNrt4ynZA.en.vtt (avoid mid-word starts / grainy tails)
    footstepsMercy: cutYt(
        '9seNrt4ynZA',
        174.2,
        177.45,
        "Mercy_-_Pharah,_your_mother_always_hoped_you'd_follow_in_her_footsteps.ogg",
    ),
    // RMS: "She did?" ~177.60-178.08, body ~178.50-180.02; do not start mid-phrase
    sheDidPharah: cutYt(
        '9seNrt4ynZA',
        177.52,
        180.22,
        'Pharah_-_she_did_funny_she_never_mentioned_that_to_me.ogg',
    ),
    // Third take: full "Reinhardt" (257.84), ends before Torb reply
    draggingMercy: cutYt(
        '9seNrt4ynZA',
        257.78,
        261.48,
        "Mercy_-_Reinhardt,_I_don't_approve_of_you_dragging_that_poor_girl_around_on_your_adventures.ogg",
    ),
    brigitteRein: cutYt(
        '9seNrt4ynZA',
        223.15,
        228.55,
        'Reinhardt_-_brigitte_has_made_her_choice_i_would_have_her_at_my_side.ogg',
    ),
    lindholmTorb: cutYt(
        '9seNrt4ynZA',
        261.5,
        272.35,
        'Torbjörn_-_Angela,_you_should_know_that_no_one_could_stop_Brigitte_from_doing_something_she_had_her_mind_set_on._She_is_a_Lindholm_after_all.ogg',
    ),
    holidaysMercy: (() => {
        const atlas = 'Mercy_-_Reinhardt,_what_are_your_plans_for_the_holidays.ogg';
        copyLoudnorm(ex.holidaysMercy, atlas);
        return atlas;
    })(),
    gothenburgRein: (() => {
        const atlas =
            'Reinhardt_-_ill_probably_visit_torbjorns_family_in_gothenburg_like_the_last_few_years.ogg';
        copyLoudnorm(ex.gothenburgRein, atlas);
        return atlas;
    })(),
    appleMercy: (() => {
        const atlas = "Mercy_-_(sighs)_Torbjörn,_I_miss_Ingrid's_apple_pie_at_the_holidays.ogg";
        copyLoudnorm(ex.appleMercy, atlas);
        return atlas;
    })(),
    appleTorb: (() => {
        const atlas = 'Torbjörn_-_well_it_just_so_happens_she_has_some_saved_for_you.ogg';
        copyLoudnorm(ex.appleTorb, atlas);
        return atlas;
    })(),
};

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

/** @type {[string, (c: any) => void][]} */
const patches = [
    [
        '1f89314c-40af-40a5-8c76-7fcaabd2bf1f',
        (c) => {
            c.name = 'Staying late';
            c.lines[1].voice = voice.stayedLate;
            c.lines[1].subtitles =
                'You were the only other person who stayed up so late. I enjoyed our conversations.';
        },
    ],
    [
        '00aba855-c8f3-4047-b1a3-365724b6d1f1',
        (c) => {
            c.name = 'Swiss Chocolates';
            c.tags = ['Classic', 'Multi Path'];
            const mercySwiss = line(
                'Mercy',
                "I got you some chocolates, Genji. Swiss, they're the best!",
                voice.swissMercy,
            );
            const genjiShare = line(
                'Genji',
                'Thank you, Angela. Perhaps you could share them with me?',
                voice.shareGenji,
                c.lines[0]?.id || createDialogueLineId(),
            );
            const genjiNotSwiss = line(
                'Genji',
                'Angela, I have some chocolates for you. ...Not Swiss.',
                voice.notSwissGenji,
            );
            const mercySuppose = line(
                'Mercy',
                '**sigh** I suppose it will have to do. Thank you, Genji.',
                voice.supposeMercy,
            );
            c.lines = [mercySwiss, genjiShare, genjiNotSwiss, mercySuppose];
            const pathSwiss = createDialoguePathId();
            const pathNotSwiss = createDialoguePathId();
            c.paths = [
                { id: pathSwiss, label: 'Swiss', lineIds: [mercySwiss.id, genjiShare.id] },
                {
                    id: pathNotSwiss,
                    label: 'Not Swiss',
                    lineIds: [genjiNotSwiss.id, mercySuppose.id],
                },
            ];
            c.selectedPathId = pathSwiss;
        },
    ],
    [
        'efea32df-4975-4738-af52-73232326e656',
        (c) => {
            c.name = 'Aged a Day';
            c.lines[0].hero = 'Mei';
            c.lines[0].voice = voice.agedMei;
            c.lines[0].subtitles =
                "Doctor Ziegler, I don't think you've aged a day since I last saw you.";
            c.lines[1].hero = 'Mercy';
            c.lines[1].voice = voice.neitherMercy;
            c.lines[1].subtitles = 'And neither have you, Mei.';
        },
    ],
    [
        'bdf01a95-1660-44a6-8b8e-94b817c3b647',
        (c) => {
            c.name = "Mother's Footsteps";
            c.lines[0].voice = voice.footstepsMercy;
            c.lines[0].subtitles = "Pharah, your mother always hoped you'd follow in her footsteps.";
            c.lines[1].voice = voice.sheDidPharah;
            c.lines[1].subtitles = 'She did? Funny, she never mentioned that to me.';
        },
    ],
    [
        '74e00e30-6525-4af7-a704-b169861d3289',
        (c) => {
            c.name = 'Mother Would Be Proud';
            c.lines[0].voice = voice.proudMercy;
            c.lines[0].subtitles =
                "Pharah, if your mother could see you now, I think she'd be proud of you.";
            c.lines[1].voice = voice.firstTimePharah;
            c.lines[1].subtitles = "There's a first time for everything, I guess.";
        },
    ],
    [
        '78aaaf44-9f5e-4e87-bbfa-fc5ac37acf09',
        (c) => {
            c.name = 'Dragging Brigitte';
            c.tags = ['Classic', 'Multi Path'];
            const mercyOpenId = c.lines[0].id;
            const reinId = c.lines[1].id;
            const torbId = createDialogueLineId();
            c.lines[0].voice = voice.draggingMercy;
            c.lines[0].subtitles =
                "Reinhardt. I don't approve of you dragging that poor girl around on your adventures.";
            c.lines[1].voice = voice.brigitteRein;
            c.lines[1].subtitles = 'Brigitte has made her choice. I would have her at my side.';
            c.lines.push(
                line(
                    'Torbjörn',
                    'Angela, you should know that no one could stop Brigitte from doing something she had her mind set on. She is a Lindholm after all.',
                    voice.lindholmTorb,
                    torbId,
                ),
            );
            const pathRein = createDialoguePathId();
            const pathTorb = createDialoguePathId();
            c.paths = [
                { id: pathRein, label: 'Reinhardt', lineIds: [mercyOpenId, reinId] },
                { id: pathTorb, label: 'Torbjörn', lineIds: [mercyOpenId, torbId] },
            ];
            c.selectedPathId = pathRein;
        },
    ],
    [
        '047989d6-291d-4bf4-8ddc-cfb27c1e37d0',
        (c) => {
            c.name = 'Holiday Plans';
            c.lines[0].voice = voice.holidaysMercy;
            c.lines[0].subtitles = 'Reinhardt, what are your plans for the holidays?';
            c.lines[1].voice = voice.gothenburgRein;
            c.lines[1].subtitles =
                "I'll probably visit Torbjörn's family in Gothenburg, like the last few years.";
        },
    ],
    [
        '16a87fa9-7e9c-42a1-adcb-94817d12f8eb',
        (c) => {
            c.name = "Ingrid's Apple Pie";
            c.lines[0].voice = voice.appleMercy;
            c.lines[0].subtitles = "**sighs** Torbjörn, I miss Ingrid's apple pie at the holidays.";
            c.lines[1].voice = voice.appleTorb;
            c.lines[1].subtitles = '**chuckles** Well, it just so happens she has some saved for you.';
        },
    ],
];

for (const [id, fn] of patches) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name} (${id.slice(0, 8)})`);
}

const before = raw.conversations.length;
raw.conversations = raw.conversations.filter((c) => c.id !== '6e06a1ac-2f93-4935-84ea-527d9c848088');
if (raw.conversations.length !== before - 1) {
    throw new Error('failed to delete Classic #302 (merged into Dragging Brigitte)');
}
console.log('deleted Classic #302 (merged into Dragging Brigitte multipath)');

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
