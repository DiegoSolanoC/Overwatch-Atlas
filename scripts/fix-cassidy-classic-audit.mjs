#!/usr/bin/env node
/**
 * Classic Cassidy audit (Ashe bike / B.O.B. / Halloween dwarf):
 * - Restore bike trio if missing; OT McCree bike + Parked + Ashe 055188
 * - And how's B.O.B.? → extract 054FC4; re-norm Ashe 055189
 * - Grumpy dwarf / cow lass → OT 05B9D1 + 05B855
 *
 * Usage:
 *   node scripts/fix-cassidy-classic-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialogueLineId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const OT_CACHE = path.join(REPO, 'scripts/_cache/cassidy-classic');
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

const BIKE_ID = '78bb106c-1b0b-43e9-8e02-a419a506c075';
const BOB_ID = 'b76dc897-fc07-4d86-a50b-cb8443075ed7';
const DWARF_ID = 'b9abf948-5689-4dd2-acec-35f6c87c02d1';

const OT = {
    niceBike:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/03/McCree_-_Real_nice_bike_youve_got_Ashe.ogg',
    whatd:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/03/000000055188.0B2-Whatd-you-do-with-it-Jesse_.ogg',
    parked:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/03/McCree_-_Parked_it_somewhere.ogg',
    dwarf:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/05/00000005B9D1.0B2-With-a-grumpy-dwarf-in-a-Halloween-costume-on-our-side-how-can-we-lose_.ogg',
    cowLass:
        'https://theomnictalking.altervista.org/wp-content/uploads/2024/05/00000005B855.0B2-Watch-it-cow-lass.ogg',
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

function findHeroDir(name) {
    const want = name.toLowerCase().normalize('NFC');
    for (const ent of fs.readdirSync(EXTRACT_ROOT, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        if (ent.name.toLowerCase().normalize('NFC') === want) {
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

const CASS = path.join(findHeroDir('Cassidy'), 'MatchTalk');
const ASHE = path.join(findHeroDir('Ashe'), 'MatchTalk');

const voice = {
    niceBike: copyLoudnorm(
        downloadOt(OT.niceBike, 'nice-bike.ogg'),
        "Cassidy_-_Real_nice_bike_you've_got,_Ashe.ogg",
    ),
    whatd: copyLoudnorm(
        downloadOt(OT.whatd, '055188-whatd.ogg'),
        "Ashe_-_What'd_you_do_with_it,_Jesse!.ogg",
    ),
    parked: copyLoudnorm(
        downloadOt(OT.parked, 'parked.ogg'),
        "Cassidy_-_Parked_it_somewhere..._I'm_damned_if_I_remember_where_I_left_the_keys,_though....ogg",
    ),
    howsBob: copyLoudnorm(
        findExtract(CASS, '000000054FC4'),
        "Cassidy_-_And_how's_B.O.B_.ogg",
    ),
    bobFine: copyLoudnorm(
        findExtract(ASHE, '000000055189'),
        "Ashe_-_He's_just_fine,_thank_you_for_your_concern.ogg",
    ),
    dwarf: copyLoudnorm(
        downloadOt(OT.dwarf, '05B9D1-dwarf.ogg'),
        'Ashe_-_With_a_grumpy_dwarf_in_a_Halloween_costume_on_our_side,_how_can_we_lose_.ogg',
    ),
    cowLass: copyLoudnorm(
        downloadOt(OT.cowLass, '05B855-cow-lass.ogg'),
        'Torbjörn_-_Watch_it,_cow_lass!.ogg',
    ),
};

const keep = new Set(Object.values(voice));
for (const old of fs.readdirSync(VOICELINES_DIR)) {
    const drop =
        (/^Ashe_-_whatd_you_do_with_it_jesse/i.test(old) && !keep.has(old)) ||
        (/^Cassidy_-_parked_it_somewhere/i.test(old) && !keep.has(old)) ||
        (/^Ashe_-_with_a_grumpy_dwarf/i.test(old) && !keep.has(old));
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

{
    let c = byId.get(BIKE_ID);
    if (!c) {
        c = {
            id: BIKE_ID,
            entryType: 'dialogue',
            name: 'Nice Bike',
            status: 'removed',
            eraName: '',
            tags: ['Classic'],
            scene: 'Default.png',
            lines: [],
        };
        // Insert after Dartboard (Classic Cassidy/Ashe block)
        const dartIdx = conversations.findIndex((x) => x.id === 'f19850ec-2119-4e77-818e-e8d666f06a3f');
        const insertAt = dartIdx >= 0 ? dartIdx + 1 : conversations.length;
        conversations.splice(insertAt, 0, c);
        byId.set(BIKE_ID, c);
        console.log('restored bike conversation shell');
    }
    c.name = 'Nice Bike';
    c.tags = Array.from(new Set([...(c.tags || []), 'Classic']));
    c.lines = [
        line(
            'Cassidy',
            "Real nice bike you've got, Ashe.",
            voice.niceBike,
            c.lines[0]?.id || '2f8ba55b-3ca3-4c38-997d-b648527d6d35',
        ),
        line(
            'Ashe',
            "What'd you do with it, Jesse?!",
            voice.whatd,
            c.lines[1]?.id || 'ced9d509-0456-40d9-b47c-6c6b3a69d5bf',
        ),
        line(
            'Cassidy',
            "Parked it somewhere... I'm damned if I remember where I left the keys, though...",
            voice.parked,
            c.lines[2]?.id || '8dcfed1a-f8a1-4451-a6e2-a25df42c0a3c',
        ),
    ];
    console.log('patched Nice Bike');
}

patch(BOB_ID, (c) => {
    c.name = "How's B.O.B.";
    c.lines[0].hero = 'Cassidy';
    c.lines[0].voice = voice.howsBob;
    c.lines[0].subtitles = "And how's B.O.B?";
    c.lines[1].hero = 'Ashe';
    c.lines[1].voice = voice.bobFine;
    c.lines[1].subtitles = "He's just fine. Thank you for your concern.";
});

patch(DWARF_ID, (c) => {
    c.name = 'Grumpy Dwarf';
    c.lines[0].hero = 'Ashe';
    c.lines[0].voice = voice.dwarf;
    c.lines[0].subtitles =
        'With a grumpy dwarf in a Halloween costume on our side, how can we lose?';
    c.lines[1].hero = 'Torbjörn';
    c.lines[1].voice = voice.cowLass;
    c.lines[1].subtitles = 'Watch it, cow lass!';
});

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
console.log('wrote conversations.json');

const manifest = scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('wrote theater-assets-manifest.json');
