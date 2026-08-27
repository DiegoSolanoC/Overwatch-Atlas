#!/usr/bin/env node
/**
 * Classic D.Va audit: mirror self-talk, For a friend multipath, Eichenwalde
 * rebuilding multipath + Rein cut, wire No AI "all ears".
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createConversationId,
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

const FOR_A_FRIEND_ID = '72c99752-7f76-4fb5-8231-c8e9a3c3f19c';
const REBUILDING_ID = 'c651d2d5-3387-4f65-ae1f-725101da4313';
const NO_AI_ID = '383448a0-6600-4e4b-a37c-638dab0413fe';
const BROKEN_FRIEND_SHELL_ID = '2e360e6e-bed8-40d3-b258-0d5cbdefcc41';

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

function line(hero, subtitles, voice, extras = {}) {
    return {
        id: extras.id || createDialogueLineId(),
        hero,
        voice: voice || '',
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
        era: 'Overwatch',
        status: 'active',
        ...(extras.mirror ? { mirror: true } : {}),
        ...(extras.disclaimer ? { disclaimer: extras.disclaimer } : {}),
    };
}

const DVA = path.join(EXTRACT_ROOT, 'D.Va', 'MatchTalk');
const REIN = path.join(EXTRACT_ROOT, 'Reinhardt', 'MatchTalk');

const voice = {
    hacking: cutYt(
        'T4iMtphiJus',
        7.0,
        10.25,
        "D.Va_-_It's_me!_Someone_must_be_hacking.ogg",
    ),
    banned: cutYt(
        'T4iMtphiJus',
        10.25,
        12.55,
        "D.Va_-_I_hope_we_don't_get_banned_for_this.ogg",
    ),
    destructionHome: (() => {
        const atlas =
            'D.Va_-_The_destruction_caused_by_the_omnics_here..._it_reminds_me_of_home.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    DVA,
                    '00000002EF7D.0B2-The destruction caused by the omnics here... it reminds me of home.ogg',
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    // Clean map comps (Overwatch Interactions) — not GRZ NGT subtitled BGM rips.
    hopeCountry: cutYt(
        'PM7_Sk3uQLM',
        6.85,
        14.5,
        'D.Va_-_Seeing_what_happened_after_the_war_here_gives_me_hope_for_the_rebuilding_of_my_country.ogg',
    ),
    thingsDestroyed: cutYt(
        'M_xALVMKggc',
        12.65,
        18.65,
        'Reinhardt_-_Things_can_be_destroyed,_but_as_long_as_the_people_are_strong,_they_can_always_be_rebuilt.ogg',
    ),
    reinFriend: (() => {
        const atlas =
            "Reinhardt_-_I_was_wondering_if_you'd_sign_something_for_me..._it's_(clears_throat)_for_a_friend.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    REIN,
                    "000000021E07.0B2-I was wondering if you'd sign something for me... it's (clears throat) for a friend.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    ofCourse: (() => {
        const atlas = 'D.Va_-_Of_course._Here_you_go..._love,_D.Va.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    DVA,
                    "00000000B9B5.0B2-(giggles) Of course. Here you go... love, D.Va!.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    afterMatch: (() => {
        const atlas =
            "D.Va_-_Aw,_after_this_match_is_over._Right_now..._it's_time_to_get_serious.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    DVA,
                    "00000000B945.0B2-Aw, after this match is over. Right now... it's time to get serious.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    allEars: (() => {
        const atlas = "D.Va_-_Well,_if_you_want_to_give_me_some_upgrades,_I'm_all_ears.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    DVA,
                    "00000002EF93.0B2-Well, if you want to give me some upgrades, I'm all ears!.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
};

// Remove obsolete bad Rein cut filename if present (replaced above with punctuated name).
const oldReinCut = path.join(
    VOICELINES_DIR,
    'Reinhardt_-_things_can_be_destroyed_but_as_long_as_the_people_are_strong.ogg',
);
if (fs.existsSync(oldReinCut)) {
    fs.unlinkSync(oldReinCut);
    console.log('removed bad Rein cut', path.basename(oldReinCut));
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = Array.isArray(raw.conversations) ? raw.conversations : null;
if (!conversations) throw new Error('conversations.json shape unexpected');

const byId = new Map(conversations.map((c) => [c.id, c]));

// --- Mirror: It's me / get banned ---
{
    const existing = conversations.find(
        (c) =>
            c.name === "It's Me" ||
            (Array.isArray(c.lines) &&
                c.lines.some((l) => /Someone must be hacking/i.test(l.subtitles || ''))),
    );
    const id = existing?.id || createConversationId();
    const lineA = line('D.va', "It's me! Someone must be hacking.", voice.hacking, {
        id: existing?.lines?.[0]?.id,
        mirror: true,
    });
    const lineB = line(
        'D.va',
        "I hope we don't get banned for this.",
        voice.banned,
        { id: existing?.lines?.[1]?.id, mirror: true },
    );
    const entry = {
        id,
        entryType: 'dialogue',
        name: "It's Me",
        status: 'removed',
        eraName: '',
        tags: ['Classic'],
        scene: 'Default.png',
        lines: [lineA, lineB],
    };
    if (existing) {
        Object.assign(existing, entry);
        console.log('updated mirror', id);
    } else {
        conversations.push(entry);
        console.log('added mirror', id);
    }
}

// --- For a friend multipath ---
{
    const c = byId.get(FOR_A_FRIEND_ID);
    if (!c) throw new Error('For a friend missing');
    const reinId = c.lines?.[0]?.id || createDialogueLineId();
    const signId = c.lines?.[1]?.id || createDialogueLineId();
    const seriousId = createDialogueLineId();
    const pathSign = createDialoguePathId();
    const pathSerious = createDialoguePathId();
    c.name = 'For a friend';
    c.status = 'removed';
    c.tags = ['Classic', 'Multi Path'];
    c.lines = [
        line(
            'Reinhardt',
            "I was wondering if you'd sign something for me... it's **clears throat** for a friend.",
            voice.reinFriend,
            { id: reinId },
        ),
        line('D.va', 'Of course! Here you go. Love, D.Va.', voice.ofCourse, { id: signId }),
        line(
            'D.va',
            "Aww. After this match is over. Right now, it's time to get serious!",
            voice.afterMatch,
            { id: seriousId },
        ),
    ];
    c.paths = [
        { id: pathSign, label: 'Sign', lineIds: [reinId, signId] },
        { id: pathSerious, label: 'Serious', lineIds: [reinId, seriousId] },
    ];
    c.selectedPathId = pathSign;
    console.log('updated For a friend multipath');
}

// Keep broken shell removed (duplicate of For a friend).
{
    const shell = byId.get(BROKEN_FRIEND_SHELL_ID);
    if (shell) {
        shell.status = 'removed';
        shell.tags = ['Classic'];
        console.log('kept shell 146 removed');
    }
}

// --- Rebuilding multipath (Home / Hope) ---
{
    const c = byId.get(REBUILDING_ID);
    if (!c) throw new Error('Rebuilding entry missing');
    const homeId = c.lines?.[0]?.id || createDialogueLineId();
    const hopeExisting = conversations
        .flatMap((x) => x.lines || [])
        .find((l) => /Seeing what happened/i.test(l.subtitles || ''));
    const hopeId = hopeExisting?.id || createDialogueLineId();
    const reinId =
        c.lines?.find((l) => /Things can be destroyed/i.test(l.subtitles || ''))?.id ||
        createDialogueLineId();
    const pathHome = createDialoguePathId();
    const pathHope = createDialoguePathId();
    c.name = 'Rebuilding';
    c.status = 'removed';
    c.tags = ['Classic', 'Multi Path', 'Map Specific'];
    c.mapChoices = ['Eichenwalde', 'Volskaya Industries'];
    c.lines = [
        line(
            'D.va',
            'The destruction caused by the omnics here... It reminds me of home.',
            voice.destructionHome,
            { id: homeId },
        ),
        line(
            'D.va',
            'Seeing what happened after the war here gives me hope for the rebuilding of my country.',
            voice.hopeCountry,
            { id: hopeId },
        ),
        line(
            'Reinhardt',
            'Things can be destroyed, but as long as the people are strong, they can always be rebuilt.',
            voice.thingsDestroyed,
            { id: reinId },
        ),
    ];
    c.paths = [
        { id: pathHome, label: 'Home', lineIds: [homeId, reinId] },
        { id: pathHope, label: 'Hope', lineIds: [hopeId, reinId] },
    ];
    c.selectedPathId = pathHome;
    console.log('updated Rebuilding multipath');

    const soloIdx = conversations.findIndex((x) => x.name === 'Hope for Rebuilding');
    if (soloIdx >= 0) {
        conversations.splice(soloIdx, 1);
        console.log('removed Hope for Rebuilding solo');
    }
}

// --- No AI: wire all ears ---
{
    const c = byId.get(NO_AI_ID);
    if (!c) throw new Error('No AI missing');
    const ears = c.lines?.find((l) => /all ears/i.test(l.subtitles || ''));
    if (!ears) throw new Error('No AI ears line missing');
    ears.voice = voice.allEars;
    ears.subtitles = "Well, if you wanna give me some upgrades, I'm all ears!";
    console.log('wired No AI all ears');
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
