#!/usr/bin/env node
/**
 * Classic Lúcio audit: wire missing/wrong voices from HeroVoice, replace bad cuts,
 * delete Classic twin of Overwatch "The Classics", rename numbered shells.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
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

function atlasName(hero, label) {
    const prefix = String(hero === 'Lucio' ? 'Lúcio' : hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function findLucioDir() {
    for (const name of fs.readdirSync(EXTRACT_ROOT)) {
        if (/^l[uú]cio$/i.test(name.normalize('NFC'))) return path.join(EXTRACT_ROOT, name);
    }
    // fallback walk
    for (const name of fs.readdirSync(EXTRACT_ROOT)) {
        if (name.toLowerCase().includes('cio') && name.toLowerCase().startsWith('l')) {
            return path.join(EXTRACT_ROOT, name);
        }
    }
    throw new Error('Lúcio extract folder not found');
}

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing extract: ${p}`);
    return p;
}

function copyRaw(source, atlas) {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    fs.copyFileSync(source, dest);
    console.log(`copy ${atlas}`);
    return atlas;
}

/** Re-encode with loudnorm; optional start trim (seconds). */
function copyLoudnorm(source, atlas, { trimStart = 0 } = {}) {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const args = ['-y'];
    if (trimStart > 0) args.push('-ss', String(trimStart));
    args.push(
        '-i',
        source,
        '-af',
        'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-c:a',
        'libvorbis',
        '-q:a',
        '6',
        dest,
    );
    const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-500));
        throw new Error(`ffmpeg failed for ${atlas}`);
    }
    console.log(`ffmpeg ${atlas}${trimStart ? ` (trim ${trimStart}s)` : ''}`);
    return atlas;
}

const LUCIO = findLucioDir();
const sources = {
    lucioBastion: mustExist(
        path.join(LUCIO, 'MatchTalk', '0000000216BF.0B2-Hey, Bastion. Check this out_ (imitates Bastion).ogg'),
    ),
    bastionImpressed: mustExist(
        path.join(EXTRACT_ROOT, 'Bastion', 'MatchTalk', '000000043A38.0B2-(impressed beeps).ogg'),
    ),
    lucioLights: mustExist(
        path.join(LUCIO, 'MatchTalk', '000000036CDD.0B2-Hey Genji, how about I hook up your lights to my music_.ogg'),
    ),
    lucioNewTunes: mustExist(
        path.join(LUCIO, 'MatchTalk', '00000000B510.0B2-Reinhardt, we need to find you some new tunes.ogg'),
    ),
    reinhardtNightRocker: mustExist(
        path.join(
            EXTRACT_ROOT,
            'Reinhardt',
            'MatchTalk',
            "000000021DEF.0B2-What's wrong with the classics_ I love Hasselhoff! Have you heard Night Rocker_.ogg",
        ),
    ),
    lucioCantKeepUp: mustExist(path.join(LUCIO, 'MatchTalk', "00000000B50F.0B2-Can't keep up_.ogg")),
    lucioYoureOn: mustExist(path.join(LUCIO, 'MatchTalk', "00000000B512.0B2-Oh, you're on!.ogg")),
    lucioSlopes: mustExist(
        path.join(LUCIO, 'MatchTalk', '000000036CE2.0B2-Hey Tracer, you and Emily want to hit the slopes sometime_.ogg'),
    ),
    lucioStole: mustExist(
        path.join(
            LUCIO,
            'MatchTalk',
            '0000000216BC.0B2-Stole_ (scoffs) You need to go ask your bosses where it all came from, then we can talk.ogg',
        ),
    ),
    symmetraRuffian: mustExist(
        path.join(
            EXTRACT_ROOT,
            'Symmetra',
            'MatchTalk',
            '00000001FD07.0B2-To think I should have to work with a street ruffian.ogg',
        ),
    ),
    lucioOrisaHelmet: mustExist(
        path.join(
            LUCIO,
            'MatchTalk',
            '000000036CDF.0B2-Orisa, you are amazing! Could you ask Efi if she can help me out with my helmet sometime_.ogg',
        ),
    ),
    winstonMission: mustExist(
        path.join(
            EXTRACT_ROOT,
            'Winston',
            'MatchTalk',
            '00000000BC69.0B2-Um, okay, I guess... got this big mission coming up. Oh. I get it.ogg',
        ),
    ),
    mercySonic: mustExist(
        path.join(
            EXTRACT_ROOT,
            'Mercy',
            'MatchTalk',
            "00000002A898.0B2-Lúcio, I never realized your father was the one who invented Vishkar's sonic technology.ogg",
        ),
    ),
};

// Prefer clean atlas filenames matching existing conventions where known.
const voice = {
    lucioBastion: copyLoudnorm(
        sources.lucioBastion,
        atlasName('Lúcio', 'Hey, Bastion. Check this out_ (imitates Bastion)'),
    ),
    bastionImpressed: copyLoudnorm(
        sources.bastionImpressed,
        atlasName('Bastion', '(impressed beeps)'),
    ),
    // overwrite bad YT cut with extract (same path conversations already point at)
    lucioLights: (() => {
        const existing = 'Lúcio_-_hey_genji_how_bout_i_hook_up_your_lights_to_my_music.ogg';
        copyLoudnorm(sources.lucioLights, existing);
        return existing;
    })(),
    lucioNewTunes: (() => {
        const existing = 'Lúcio_-_Reinhardt,_we_need_to_find_you_some_new_tunes.ogg';
        copyLoudnorm(sources.lucioNewTunes, existing);
        return existing;
    })(),
    // trim tiny leading pad in case of partner bleed perception; extract is mostly clean
    reinhardtNightRocker: (() => {
        const existing =
            "Reinhardt_-_What's_wrong_with_the_classics__I_love_Hasselhoff!_Have_you_heard_Night_Rocker_.ogg";
        copyLoudnorm(sources.reinhardtNightRocker, existing, { trimStart: 0.08 });
        return existing;
    })(),
    lucioCantKeepUp: copyLoudnorm(sources.lucioCantKeepUp, atlasName('Lúcio', "Can't keep up_")),
    lucioYoureOn: copyLoudnorm(sources.lucioYoureOn, atlasName('Lúcio', "Oh, you're on!")),
    lucioSlopes: copyLoudnorm(
        sources.lucioSlopes,
        atlasName('Lúcio', 'Hey Tracer, you and Emily want to hit the slopes sometime_'),
    ),
    lucioStole: copyLoudnorm(
        sources.lucioStole,
        atlasName(
            'Lúcio',
            'Stole_ (scoffs) You need to go ask your bosses where it all came from, then we can talk',
        ),
    ),
    symmetraRuffian: copyLoudnorm(
        sources.symmetraRuffian,
        atlasName('Symmetra', 'To think I should have to work with a street ruffian'),
    ),
    lucioOrisaHelmet: copyLoudnorm(
        sources.lucioOrisaHelmet,
        atlasName(
            'Lúcio',
            'Orisa, you are amazing! Could you ask Efi if she can help me out with my helmet sometime_',
        ),
    ),
    winstonMission: copyLoudnorm(
        sources.winstonMission,
        atlasName('Winston', 'Um, okay, I guess... got this big mission coming up. Oh. I get it'),
    ),
    // refresh Mercy sonic (already present; ensure clean extract)
    mercySonic: (() => {
        const existing =
            "Mercy_-_Lúcio,_I_never_realized_your_father_was_the_one_who_invented_Vishkar's_sonic_technology.ogg";
        copyLoudnorm(sources.mercySonic, existing);
        return existing;
    })(),
};

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

/** @type {[string, (c: any) => void][]} */
const patches = [
    [
        '7044e1fd-cc98-4a67-8b22-95c4dbd3adb0',
        (c) => {
            c.name = 'Check This Out';
            c.lines[0].voice = voice.lucioBastion;
            c.lines[1].voice = voice.bastionImpressed;
        },
    ],
    [
        'f8460eee-ead5-4fe6-aaba-5c24e41c924d',
        (c) => {
            c.name = 'Ask Efi';
            c.lines[0].voice = voice.lucioOrisaHelmet;
        },
    ],
    [
        '8e207647-a24c-45df-aaa1-d835bcf09ead',
        (c) => {
            c.name = 'Street Ruffian';
            c.lines[0].voice = voice.symmetraRuffian;
        },
    ],
    [
        'd014514b-3169-4ede-91fe-475970110165',
        (c) => {
            c.name = 'Ask Your Bosses';
            c.lines[1].voice = voice.lucioStole;
        },
    ],
    [
        'c9f5db76-407c-4ad7-8d9a-8ba0210f2e68',
        (c) => {
            c.name = "Can't Keep Up";
            c.lines[0].voice = voice.lucioCantKeepUp;
        },
    ],
    [
        '1da27d4d-3cd4-4f90-a92e-1fada50595d6',
        (c) => {
            c.name = "I'll Race Ya";
            c.lines[1].voice = voice.lucioYoureOn;
        },
    ],
    [
        '37cff327-ee3a-4112-b60c-bcffe73d1365',
        (c) => {
            c.name = 'Hit the Slopes';
            c.lines[0].voice = voice.lucioSlopes;
        },
    ],
    [
        'adf91cb8-14b6-4d93-8ee7-6f87623eef20',
        (c) => {
            c.name = "How's it Hangin'";
            c.lines[1].voice = voice.winstonMission;
        },
    ],
];

// Music lights + New Tunes by name lookup
for (const c of raw.conversations) {
    if ((c.tags || []).includes('Classic') && c.name === 'Music lights') {
        c.lines[0].voice = voice.lucioLights;
        console.log('refreshed Music lights Lucio cut');
    }
    if ((c.tags || []).includes('Classic') && c.name === 'New Tunes') {
        c.lines[0].voice = voice.lucioNewTunes;
        c.lines[1].voice = voice.reinhardtNightRocker;
        console.log('refreshed New Tunes cuts');
    }
    if ((c.tags || []).includes('Classic') && c.name === 'Sonic Inventor') {
        c.lines[0].voice = voice.mercySonic;
        console.log('refreshed Sonic Inventor Mercy');
    }
}

for (const [id, fn] of patches) {
    if (!fn) continue;
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

// Delete Classic #259 — duplicate of Overwatch "The Classics"
const before = raw.conversations.length;
raw.conversations = raw.conversations.filter((c) => c.id !== '2521230e-8f5e-4f29-99a6-782d8cd0c466');
if (raw.conversations.length !== before - 1) {
    throw new Error('failed to delete Classic #259 / The Classics twin');
}
console.log('deleted Classic #259 (use Overwatch "The Classics")');

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
