#!/usr/bin/env node
/**
 * Classic Pharah audit: OT shoot/mother cut, Soldier proud, Torb suit reply,
 * Halloween costume/Cold: no extract/OT; Hammeh YT has music bed —
 * demucs htdemucs_ft vocals (energy-trimmed; ASR cold stamp was ~0.8s early).
 *
 * Usage:
 *   node scripts/fix-pharah-classic-audit.mjs
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
const OT_CACHE = path.join(REPO, 'scripts/_cache/pharah-classic');
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
const YT_DLP = path.join(REPO, 'scripts/_cache/yt-dlp.exe');

const SHOOT_ID = 'f8ee5885-5196-42b4-924e-7c840f10058c';
const HALLOWEEN_ID = '7f7a085b-7dc5-4705-ab19-e62071bdf981';
const PROUD_ID = 'f6eb34a7-cb02-4281-b19d-9a8e40e61423';
const SUIT_ID = '8c80c599-875e-4b52-8935-6c5e8c45396d';

const OT_FILES = {
    shoot:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/04/00000002A8D3-McCree-whered-you-learn-to-shoot-like-that.-Was-it-Jack_-Gabriel_.ogg',
    mother:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/04/00000002A87C-Always-was-a-good-shot-but-I-got-a-few-pointers-from-the-best.-Thatd-be-your-mother..ogg',
};

const HALLOWEEN_YT = 'w3iiyN6ot1A';
// Combo window on Hammeh w3iiyN6ot1A; vocal peaks: ask ~0.95-3.40, cold ~4.45-4.70
const HALLOWEEN_COMBO_START = 279.55;
const HALLOWEEN_COMBO_DUR = 5.0;
const HALLOWEEN_ASK_REL = [0.92, 2.5];
const HALLOWEEN_COLD_REL = [4.4, 0.55];
const PYTHON311 =
    process.env.PYTHON311 ||
    path.join(process.env.LOCALAPPDATA || '', 'Programs/Python/Python311/python.exe');

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
            // Windows/mojibake folder names for Torbjörn
            .replace(/torbj.rn/i, 'torbjorn');
        const wantFlat = want.replace(/torbjorn/, 'torbjorn');
        if (n === wantFlat || n.includes(wantFlat) || (wantFlat === 'torbjorn' && /torbj/i.test(ent.name))) {
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

function findYtMedia(videoId) {
    const mediaExt = new Set(['.webm', '.m4a', '.mp3', '.opus', '.ogg', '.mp4', '.mkv']);
    return fs
        .readdirSync(YT_CACHE)
        .filter((n) => n.startsWith(`${videoId}.`) && mediaExt.has(path.extname(n).toLowerCase()))
        .map((n) => path.join(YT_CACHE, n))
        .find((p) => fs.statSync(p).size > 100000);
}

function ensureYtVideo(videoId) {
    fs.mkdirSync(YT_CACHE, { recursive: true });
    const existing = findYtMedia(videoId);
    if (existing) return existing;
    mustExist(YT_DLP);
    const r = spawnSync(
        YT_DLP,
        [
            '-f',
            'bestaudio/best',
            '--no-playlist',
            '-o',
            path.join(YT_CACHE, `${videoId}.%(ext)s`),
            `https://www.youtube.com/watch?v=${videoId}`,
        ],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-800));
        throw new Error(`yt-dlp failed for ${videoId}`);
    }
    const found = findYtMedia(videoId);
    if (!found) throw new Error(`yt download missing for ${videoId}`);
    return found;
}

function cutYt(source, start, dur, atlas, afExtra = '') {
    const dest = path.join(VOICELINES_DIR, atlas);
    fs.mkdirSync(VOICELINES_DIR, { recursive: true });
    const tmp = path.join(
        VOICELINES_DIR,
        `_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}.ogg`,
    );
    const af = [afExtra, 'loudnorm=I=-16:TP=-1.5:LRA=11'].filter(Boolean).join(',');
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
            af,
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
    console.log(`cut ${atlas} (${start.toFixed(2)}+${dur.toFixed(2)}s)`);
    return atlas;
}

function demucsVocals(wavPath) {
    const outRoot = path.join(OT_CACHE, 'demucs');
    const r = spawnSync(
        PYTHON311,
        ['-m', 'demucs', '--two-stems=vocals', '-n', 'htdemucs_ft', '-o', outRoot, wavPath],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-800));
        throw new Error('demucs failed');
    }
    const stem = path.join(outRoot, 'htdemucs_ft', path.basename(wavPath, path.extname(wavPath)), 'vocals.wav');
    mustExist(stem);
    return stem;
}

function halloweenCleanClips(ytSource) {
    fs.mkdirSync(OT_CACHE, { recursive: true });
    const comboWav = path.join(OT_CACHE, 'halloween-combo-raw.wav');
    const cut = spawnSync(
        FFMPEG,
        [
            '-y',
            '-ss',
            String(HALLOWEEN_COMBO_START),
            '-i',
            ytSource,
            '-t',
            String(HALLOWEEN_COMBO_DUR),
            '-ac',
            '2',
            '-ar',
            '44100',
            comboWav,
        ],
        { encoding: 'utf8' },
    );
    if (cut.status !== 0) throw new Error('halloween combo cut failed');
    const vocals = demucsVocals(comboWav);
    return {
        ask: cutYt(
            vocals,
            HALLOWEEN_ASK_REL[0],
            HALLOWEEN_ASK_REL[1],
            "Cassidy_-_What's_your_Halloween_costume_gonna_be_this_year,_Pharah.ogg",
            'afade=t=in:st=0:d=0.015,afade=t=out:st=2.45:d=0.05',
        ),
        cold: cutYt(
            vocals,
            HALLOWEEN_COLD_REL[0],
            HALLOWEEN_COLD_REL[1],
            'Pharah_-_Cold.ogg',
            'afade=t=in:st=0:d=0.01,afade=t=out:st=0.42:d=0.12',
        ),
    };
}

const SOLDIER = path.join(EXTRACT_ROOT, 'Soldier_ 76', 'MatchTalk');
const PHARAH = findHeroDir('Pharah');
const TORB = findHeroDir('Torbjörn');

const shootSrc = downloadOt(OT_FILES.shoot, '00000002A8D3-learn-to-shoot.ogg');
const motherSrc = downloadOt(OT_FILES.mother, '00000002A87C-pointers-mother.ogg');
const halloween = halloweenCleanClips(ensureYtVideo(HALLOWEEN_YT));

const voice = {
    shoot: copyLoudnorm(
        shootSrc,
        'Pharah_-_McCree,_where_did_you_learn_to_shoot_like_that__Was_it_Jack,_Gabriel.ogg',
    ),
    mother: copyLoudnorm(
        motherSrc,
        "Cassidy_-_Always_was_a_good_shot,_but_I_got_a_few_pointers_from_the_best._That'd_be_your_mother.ogg",
    ),
    halloweenAsk: halloween.ask,
    halloweenCold: halloween.cold,
    proud: copyLoudnorm(
        findExtract(SOLDIER, '00000002006F'),
        'Soldier_76_-_Your_mother_would_have_been_proud_of_you.ogg',
    ),
    markVi: copyLoudnorm(
        findExtractRecursive(PHARAH, '00000002A8D2'),
        'Pharah_-_Hey_Torbjörn,_check_out_my_new_suit._Mark_VI._State_of_the_art.ogg',
    ),
    jumpJets: copyLoudnorm(
        findExtractRecursive(TORB, '00000002A8FD'),
        "Torbjörn_-_(clears_throat)_Jump_jets..._concussion_rockets..._(grumbles)_Well,_yes,_it's_looking_pretty_good.ogg",
    ),
};

for (const old of fs.readdirSync(VOICELINES_DIR)) {
    const drop =
        /^Pharah_-_mccree_where_did_you_learn_to_shoot/i.test(old) ||
        /^Cassidy_-_always_was_a_good_shot_but_i_got_a_few_pointers/i.test(old) ||
        /^Pharah_-_Hey_Torbj.*_check_out_my_new_suit/i.test(old);
    if (!drop) continue;
    if (Object.values(voice).includes(old)) continue;
    fs.unlinkSync(path.join(VOICELINES_DIR, old));
    console.log('removed', old);
}

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

function patch(id, fn) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name}`);
}

patch(SHOOT_ID, (c) => {
    c.name = 'Learn to Shoot';
    c.lines[0].hero = 'Pharah';
    c.lines[0].voice = voice.shoot;
    c.lines[0].subtitles =
        'McCree, where did you learn to shoot like that? Was it Jack, Gabriel?';
    c.lines[1].hero = 'Cassidy';
    c.lines[1].voice = voice.mother;
    c.lines[1].subtitles =
        "Always was a good shot, but I got a few pointers from the best. That'd be your mother.";
});

patch(HALLOWEEN_ID, (c) => {
    c.name = 'Halloween Costume';
    c.tags = Array.from(new Set([...(c.tags || []).filter((t) => t !== 'Halloween'), 'Classic']));
    c.lines[0].hero = 'Cassidy';
    c.lines[0].voice = voice.halloweenAsk;
    c.lines[0].subtitles = "What's your Halloween costume gonna be this year, Pharah?";
    c.lines[1].hero = 'Pharah';
    c.lines[1].voice = voice.halloweenCold;
    c.lines[1].subtitles = 'Cold.';
});

patch(PROUD_ID, (c) => {
    c.name = 'Mother Would Be Proud';
    c.lines[0].hero = 'Soldier 76';
    c.lines[0].voice = voice.proud;
    c.lines[0].subtitles = "Your mother would've been proud of you.";
});

patch(SUIT_ID, (c) => {
    c.name = 'Mark VI Suit';
    c.lines[0].hero = 'Pharah';
    c.lines[0].voice = voice.markVi;
    c.lines[0].subtitles = 'Hey, Torbjörn, check out my new suit. Mark VI. State of the art.';
    c.lines[1].hero = 'Torbjörn';
    c.lines[1].voice = voice.jumpJets;
    c.lines[1].subtitles =
        "**clears throat** Jump jets... concussion rockets... **grumbles** Well, yes, it's looking pretty good.";
});

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('Pharah Classic audit done');
