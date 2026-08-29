#!/usr/bin/env node
/**
 * Classic Symmetra / Torbjörn / Widow+Hanzo / Ashe+Cassidy audit:
 * - Embodiment of Chaos → Multi Path (embodiment | skyscrapers)
 * - Order & discipline wrong wire → Symmetra extract 036D07
 * - Dress chuckle empty → Torb extract 00ADA0
 * - Arm exchange → OT 037EE2 + 02ECD5 (not in extract)
 * - Hanzo bow wrong wire → extract 00B22C
 * - Ashe/Cassidy bygones + dartboard → OT; ambitious trio → extract
 *
 * Usage:
 *   node scripts/fix-symmetra-torb-widow-ashe-classic-audit.mjs
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
const OT_CACHE = path.join(REPO, 'scripts/_cache/symmetra-torb-ashe-classic');
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

const EMBODIMENT_ID = '946d7c1c-81a6-4497-a6d9-21c741a1caa6';
const ORDER_ID = '1ed7c4f9-e5ef-432e-9b2f-ff59879c3498';
const BOW_ID = '6103c7d9-3704-4cec-ad17-a1c52851099d';
const DRESS_ID = 'fdf6be8a-df58-4d3a-88f1-0a6e19db4a52';
const ARM_ID = '065ec2d3-d7e9-470b-b48b-bfadafd20aa5';
const BYGONES_ID = 'a485bdb9-31a6-4a59-9079-c9ab4f6e52a9';
const AMBITIOUS_ID = '1046f236-1402-4c58-be20-1e3e55676d51';
const DARTBOARD_ID = 'f19850ec-2119-4e77-818e-e8d666f06a3f';

const OT = {
    torbArm:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/07/000000037EE2-McCree-what-happened-to-your-arm_.ogg',
    cassidyAdmire:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/07/00000002ECD5-Always-admired-yours-figured-Id-get-one-of-my-own.ogg',
    bygones:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/03/McCree_-_Ashe_how_about_we_let_bygones_be_bygones.ogg',
    wayWorks:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/03/Ashe_-_Aw_you_know_thats_not_the_way_it_works_Jesse.ogg',
    exception:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/03/McCree_-_I_was_hoping_youd_make_an_exception_for_old_times_sake.ogg',
    brave:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/05/000000055195-Brave-of-you-to-show-your-face-around-here-Jesse.ogg',
    picture:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/05/000000054FC5-Well-I-heard-how-much-you-missed-me.-Still-have-a-picture-of-me-at-the-hideout-I-hear.ogg',
    dartboard:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/05/000000055194-On-the-dart-board.ogg',
    flattering:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/05/000000054FC6-Bet-you-look-at-it-every-day.-Flattering-really.ogg',
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
            .replace(/[üû]/g, 'u')
            .replace(/torbj.rn/i, 'torbjorn');
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

function line(hero, subtitles, voiceFile, id = createDialogueLineId()) {
    return {
        id,
        hero,
        voice: voiceFile || '',
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
        era: 'Overwatch',
        status: 'active',
    };
}

mustExist(FFMPEG);
mustExist(EXTRACT_ROOT);

const SYM = path.join(findHeroDir('Symmetra'), 'MatchTalk');
const HANZO = path.join(findHeroDir('Hanzo'), 'MatchTalk');
const TORB = findHeroDir('Torbjörn');
const ASHE = path.join(findHeroDir('Ashe'), 'MatchTalk');
const CASS = path.join(findHeroDir('Cassidy'), 'MatchTalk');

const voice = {
    order: copyLoudnorm(
        findExtract(SYM, '000000036D07'),
        'Symmetra_-_Order_and_discipline._That_is_the_only_way_to_live.ogg',
    ),
    skyscrapers: copyLoudnorm(
        findExtract(SYM, '000000043E96'),
        'Symmetra_-_Should_I_be_worried__I_heard_you_leveled_skyscrapers.ogg',
    ),
    embodiment: copyLoudnorm(
        findExtract(SYM, '000000043E97'),
        'Symmetra_-_My_purpose_is_to_create_order._You_are_the_embodiment_of_chaos.ogg',
    ),
    dress: copyLoudnorm(
        findExtractRecursive(TORB, '00000000ADA0'),
        "Torbjörn_-_(chuckles)_There's_something_on_your_dress.ogg",
    ),
    bow: copyLoudnorm(
        findExtract(HANZO, '00000000B22C'),
        'Hanzo_-_I_would_take_my_bow_against_your_rifle_any_day.ogg',
    ),
    ambitious: copyLoudnorm(
        findExtract(CASS, '000000054FB3'),
        'Cassidy_-_You_always_were_the_ambitious_one,_Ashe.ogg',
    ),
    farm: copyLoudnorm(
        findExtract(ASHE, '000000055196'),
        "Ashe_-_You_make_that_sound_like_a_bad_thing._You'd_still_be_on_a_farm_if_it_wasn't_for_me.ogg",
    ),
    someDays: copyLoudnorm(
        findExtract(CASS, '000000054FB4'),
        "Cassidy_-_Some_days_that_doesn't_sound_so_bad.ogg",
    ),
    torbArm: copyLoudnorm(
        downloadOt(OT.torbArm, '037EE2-arm.ogg'),
        'Torbjörn_-_Cassidy,_what_happened_to_your_arm_.ogg',
    ),
    cassidyAdmire: copyLoudnorm(
        downloadOt(OT.cassidyAdmire, '02ECD5-admired.ogg'),
        "Cassidy_-_I_always_admired_yours._Figured_I'd_get_one_of_my_own.ogg",
    ),
    bygones: copyLoudnorm(
        downloadOt(OT.bygones, 'bygones.ogg'),
        'Cassidy_-_Ashe,_how_about_we_let_bygones_be_bygones_.ogg',
    ),
    wayWorks: copyLoudnorm(
        downloadOt(OT.wayWorks, 'way-works.ogg'),
        "Ashe_-_Aw,_you_know_that's_not_the_way_it_works,_Jesse.ogg",
    ),
    exception: copyLoudnorm(
        downloadOt(OT.exception, 'exception.ogg'),
        "Cassidy_-_I_was_hopin'_you'd_make_an_exception,_for_old_times'_sake.ogg",
    ),
    brave: copyLoudnorm(
        downloadOt(OT.brave, '055195-brave.ogg'),
        'Ashe_-_Brave_of_you_to_show_your_face_around_here,_Jesse.ogg',
    ),
    picture: copyLoudnorm(
        downloadOt(OT.picture, '054FC5-picture.ogg'),
        'Cassidy_-_Well,_I_know_how_much_you_missed_me._Still_have_a_picture_of_me_at_the_hide-out,_I_hear.ogg',
    ),
    dartboard: copyLoudnorm(
        downloadOt(OT.dartboard, '055194-dartboard.ogg'),
        'Ashe_-_On_the_dartboard.ogg',
    ),
    flattering: copyLoudnorm(
        downloadOt(OT.flattering, '054FC6-flattering.ogg'),
        'Cassidy_-_Bet_you_look_at_it_every_day._Flattering,_really.ogg',
    ),
};

// Remove superseded lowercase / mashed theater clips
const keep = new Set(Object.values(voice));
for (const old of fs.readdirSync(VOICELINES_DIR)) {
    const drop =
        (/^Cassidy_-_i_always_admired/i.test(old) && !keep.has(old)) ||
        (/^Cassidy_-_you_always_were_the_ambitious/i.test(old) && !keep.has(old)) ||
        (/^Cassidy_-_i_was_hopin/i.test(old) && !keep.has(old)) ||
        (/^Ashe_-_aw_you_know_thats_not_the_way/i.test(old) && !keep.has(old)) ||
        (/^Ashe_-_brave_of_you/i.test(old) && !keep.has(old)) ||
        (/^Cassidy_-_bet_you_look_at_it_every_day_flattering/i.test(old) && !keep.has(old));
    if (drop) {
        fs.unlinkSync(path.join(VOICELINES_DIR, old));
        console.log('removed', old);
    }
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = raw.conversations;
const byId = new Map(conversations.map((c) => [c.id, c]));

function patch(id, fn) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

patch(EMBODIMENT_ID, (c) => {
    c.name = 'Embodiment of Chaos';
    c.tags = Array.from(new Set([...(c.tags || []).filter((t) => t !== 'Multi Path'), 'Classic', 'Multi Path']));
    const doom = line(
        'Doomfist',
        'Symmetra, I am familiar with your work. I look forward to seeing it in person.',
        c.lines[0]?.voice ||
            'Doomfist_-_Symmetra..._I_am_familiar_with_your_work._I_look_forward_to_seeing_it_in_person.ogg',
        c.lines[0]?.id || createDialogueLineId(),
    );
    const embodiment = line(
        'Symmetra',
        'My purpose is to create order. You are the embodiment of chaos.',
        voice.embodiment,
        c.lines[1]?.id || createDialogueLineId(),
    );
    const skyscrapers = line(
        'Symmetra',
        'Should I be worried? I heard you leveled skyscrapers.',
        voice.skyscrapers,
        createDialogueLineId(),
    );
    c.lines = [doom, embodiment, skyscrapers];
    const pathChaos = createDialoguePathId();
    const pathSky = createDialoguePathId();
    c.paths = [
        { id: pathChaos, label: 'Embodiment of chaos', lineIds: [doom.id, embodiment.id] },
        { id: pathSky, label: 'Leveled skyscrapers', lineIds: [doom.id, skyscrapers.id] },
    ];
    c.selectedPathId = pathChaos;
});

patch(ORDER_ID, (c) => {
    c.name = 'Kindred Spirit';
    c.lines[0].hero = 'Symmetra';
    c.lines[0].voice = voice.order;
    c.lines[0].subtitles = 'Order and discipline. That is the only way to live.';
});

patch(BOW_ID, (c) => {
    c.name = 'Bow Against Rifle';
    c.lines[0].hero = 'Hanzo';
    c.lines[0].voice = voice.bow;
    c.lines[0].subtitles = 'I would take my bow against your rifle any day.';
});

patch(DRESS_ID, (c) => {
    c.name = 'Something on Your Dress';
    c.lines[0].hero = 'Torbjörn';
    c.lines[0].voice = voice.dress;
    c.lines[0].subtitles = "Hehe, there's something on your dress.";
});

patch(ARM_ID, (c) => {
    c.name = 'What Happened to Your Arm';
    c.lines[0].hero = 'Torbjörn';
    c.lines[0].voice = voice.torbArm;
    c.lines[0].subtitles = 'Cassidy, what happened to your arm?';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.cassidyAdmire;
    c.lines[1].subtitles = "I always admired yours, figured I'd get one of my own.";
});

patch(BYGONES_ID, (c) => {
    c.name = 'Bygones';
    c.lines[0].hero = 'Cassidy';
    c.lines[0].voice = voice.bygones;
    c.lines[0].subtitles = 'Ashe, how about we let bygones be bygones?';
    c.lines[1].hero = 'Ashe';
    c.lines[1].voice = voice.wayWorks;
    c.lines[1].subtitles = "Aw, you know that's not the way it works, Jesse.";
    c.lines[2].hero = 'Cassidy';
    c.lines[2].voice = voice.exception;
    c.lines[2].subtitles = "I was hopin' you'd make an exception, for old times' sake.";
});

patch(AMBITIOUS_ID, (c) => {
    c.name = 'Ambitious One';
    c.lines[0].hero = 'Cassidy';
    c.lines[0].voice = voice.ambitious;
    c.lines[0].subtitles = 'You always were the ambitious one, Ashe.';
    c.lines[1].hero = 'Ashe';
    c.lines[1].voice = voice.farm;
    c.lines[1].subtitles =
        "You make that sound like a bad thing. You'd still be on a farm if it wasn't for me.";
    c.lines[2].hero = 'Cassidy';
    c.lines[2].voice = voice.someDays;
    c.lines[2].subtitles = "Some days that doesn't sound so bad.";
});

patch(DARTBOARD_ID, (c) => {
    c.name = 'Dartboard';
    c.lines[0].hero = 'Ashe';
    c.lines[0].voice = voice.brave;
    c.lines[0].subtitles = 'Brave of you to show your face around here, Jesse.';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.picture;
    c.lines[1].subtitles =
        'Well, I know how much you missed me. Still have a picture of me at the hide-out, I hear.';
    c.lines[2].hero = 'Ashe';
    c.lines[2].voice = voice.dartboard;
    c.lines[2].subtitles = 'On the dartboard.';
    c.lines[3].hero = 'Cassidy';
    c.lines[3].voice = voice.flattering;
    c.lines[3].subtitles = 'Bet you look at it every day. Flattering, really.';
});

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
console.log('wrote conversations.json');

const manifest = scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('wrote theater-assets-manifest.json');
