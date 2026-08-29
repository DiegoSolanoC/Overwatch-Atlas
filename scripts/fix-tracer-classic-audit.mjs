#!/usr/bin/env node
/**
 * Classic Tracer audit: bombs/device wrong wires, flattered mash, missing lookin',
 * Mei inspire: Amazing path only (Mutual has no audio — do not re-add empty path),
 * mirror chronal multipath (OT removed clips).
 *
 * Usage:
 *   node scripts/fix-tracer-classic-audit.mjs
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
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const OT_CACHE = path.join(REPO, 'scripts/_cache/tracer-classic');
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

const BOMBS_ID = 'adb612bd-0b96-4c04-b9d7-adaceeabb447';
const INSPIRE_A_ID = '397bf8fb-d0aa-488e-8cd8-21602577ff45';
const INSPIRE_B_ID = '98cde97c-f70b-471f-8322-baf9493c5d26';
const FLATTERED_ID = 'b9c03d27-dfb8-4246-8ee5-d0159652345c';
const DEVICE_ID = '9ba348d5-b19b-4f37-b903-036fe0113991';
const LOOKIN_ID = '7707bef4-e9a3-4ccb-b255-dd4366c51599';

const OT_FILES = {
    whoaMe:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/08/00000000BD5B_removed-Whoa-its-me-Is-my-chronal-accelerator-malfunctioning-again-.ogg',
    spooky:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/08/000000021E73_removed-Wait-thats-what-I-was-just-thinking-Spooky.ogg',
    somethingElse:
        'https://theomnictalking.altervista.org/wp-content/uploads/2023/08/00000000BD5C_removed-Nope-I-know-how-that-feels.-This-is-something-else-entirely.ogg',
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

const TRACER = path.join(EXTRACT_ROOT, 'Tracer', 'MatchTalk');
const JUNKRAT = path.join(EXTRACT_ROOT, 'Junkrat', 'MatchTalk');
const MEI = path.join(EXTRACT_ROOT, 'Mei', 'MatchTalk');
const SOMBRA = path.join(EXTRACT_ROOT, 'Sombra', 'MatchTalk');

mustExist(TRACER);
mustExist(JUNKRAT);
mustExist(MEI);
mustExist(SOMBRA);

const whoaSrc = downloadOt(OT_FILES.whoaMe, '00000000BD5B-whoa-its-me.ogg');
const spookySrc = downloadOt(OT_FILES.spooky, '000000021E73-spooky.ogg');
const elseSrc = downloadOt(OT_FILES.somethingElse, '00000000BD5C-something-else.ogg');

const voice = {
    bombs: copyLoudnorm(
        findExtract(JUNKRAT, '00000000B7E0'),
        'Junkrat_-_Think_I_could_have_a_look_at_one_of_those_bombs_of_yours.ogg',
    ),
    deadBody: copyLoudnorm(
        findExtract(TRACER, '000000021E72'),
        'Tracer_-_Over_my_dead_body.ogg',
    ),
    amazing: copyLoudnorm(
        findExtract(MEI, '0000000211C6'),
        'Mei_-_Tracer!_You_are_so_amazing,_you_inspire_me.ogg',
    ),
    realHero: copyLoudnorm(
        findExtract(TRACER, '000000021E74'),
        "Tracer_-_Mei,_you're_the_real_hero.ogg",
    ),
    flattered: copyLoudnorm(
        findExtract(TRACER, '00000003712F'),
        "Tracer_-_Aw,_I'm_flattered,_really,_but_I_have_some_other_things_occupying_my_time_now.ogg",
    ),
    lookin: copyLoudnorm(
        findExtract(TRACER, '00000000AFD4'),
        "Tracer_-_Whacha_lookin'_at.ogg",
    ),
    device: copyLoudnorm(
        findExtract(TRACER, '00000002CDE9'),
        "Tracer_-_Don't_think_I_don't_recognize_that_device_of_yours._I_know_you_stole_it.ogg",
    ),
    latestTech: copyLoudnorm(
        findExtract(SOMBRA, '000000030562'),
        'Sombra_-_What_can_I_say._A_girl_just_has_to_have_the_latest_tech.ogg',
    ),
    whoaMe: copyLoudnorm(
        whoaSrc,
        "Tracer_-_Whoa,_it's_me!_Is_my_chronal_accelerator_malfunctioning_again.ogg",
    ),
    spooky: copyLoudnorm(
        spookySrc,
        "Tracer_-_Wait._That's_what_I_was_just_thinking._Spooky.ogg",
    ),
    somethingElse: copyLoudnorm(
        elseSrc,
        "Tracer_-_Nope,_I_know_how_that_feels._This_is_something_else_entirely.ogg",
    ),
};

for (const old of [
    'Tracer_-_aw_flattered_really_but_ive_got_some_other_things_occupying_my_time.ogg',
    "Tracer_-_Mei,_you're_the_real_hero!.ogg",
]) {
    const p = path.join(VOICELINES_DIR, old);
    if (fs.existsSync(p) && !Object.values(voice).includes(old)) {
        fs.unlinkSync(p);
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

patch(BOMBS_ID, (c) => {
    c.name = 'Bombs of Yours';
    c.lines[0].hero = 'Junkrat';
    c.lines[0].voice = voice.bombs;
    c.lines[0].subtitles = 'Think I could have a look at one of those bombs of yours?';
    c.lines[1].hero = 'Tracer';
    c.lines[1].voice = voice.deadBody;
    c.lines[1].subtitles = 'Over my dead body!';
});

patch(INSPIRE_A_ID, (c) => {
    // Keep only the sourced Amazing path — do not re-add empty Mutual (no audio anywhere).
    c.name = 'Inspiration';
    c.tags = Array.from(new Set([...(c.tags || []).filter((t) => t !== 'Multi Path'), 'Classic']));
    const meiAmazing = line(
        'Mei',
        "Tracer, you're so amazing! You inspire me.",
        voice.amazing,
        c.lines.find((l) => /so amazing/i.test(l.subtitles || ''))?.id ||
            c.lines[0]?.id ||
            createDialogueLineId(),
    );
    const tracerHero = line(
        'Tracer',
        "Mei, you're the real hero!",
        voice.realHero,
        c.lines.find((l) => /real hero/i.test(l.subtitles || ''))?.id ||
            c.lines[1]?.id ||
            createDialogueLineId(),
    );
    c.lines = [meiAmazing, tracerHero];
    delete c.paths;
    delete c.selectedPathId;
});

{
    const idx = conversations.findIndex((c) => c.id === INSPIRE_B_ID);
    if (idx >= 0) {
        conversations.splice(idx, 1);
        console.log('removed solo Inspiration B shell');
    }
}

patch(FLATTERED_ID, (c) => {
    c.name = 'Joining Helix';
    c.lines[1].hero = 'Tracer';
    c.lines[1].voice = voice.flattered;
    c.lines[1].subtitles =
        "Aw, I'm flattered, really, but I have some other things occupying my time now.";
});

patch(DEVICE_ID, (c) => {
    c.name = 'Stole That Device';
    c.lines[0].hero = 'Tracer';
    c.lines[0].voice = voice.device;
    c.lines[0].subtitles =
        "Don't think I don't recognize that device of yours. I know you stole it!";
    c.lines[1].hero = 'Sombra';
    c.lines[1].voice = voice.latestTech;
    c.lines[1].subtitles = 'What can I say? A girl just has to have the latest tech.';
});

patch(LOOKIN_ID, (c) => {
    c.name = "Whacha Lookin' At";
    c.lines[0].hero = 'Tracer';
    c.lines[0].voice = voice.lookin;
    c.lines[0].subtitles = "Whacha lookin' at?";
});

{
    const existing = conversations.find(
        (c) =>
            c.tags?.includes('Classic') &&
            (c.lines || []).some((l) => /chronal accelerator malfunctioning/i.test(l.subtitles || '')),
    );
    const id = existing?.id || createConversationId();
    const openId = existing?.lines?.[0]?.id || createDialogueLineId();
    const spookyId = existing?.lines?.[1]?.id || createDialogueLineId();
    const elseId = existing?.lines?.[2]?.id || createDialogueLineId();
    const open = line(
        'Tracer',
        "Whoa, it's me! Is my chronal accelerator malfunctioning again?",
        voice.whoaMe,
        openId,
    );
    const spooky = line(
        'Tracer',
        "Wait. That's what I was just thinking. Spooky.",
        voice.spooky,
        spookyId,
    );
    const somethingElse = line(
        'Tracer',
        'Nope, I know how that feels. This is something else entirely.',
        voice.somethingElse,
        elseId,
    );
    const pathSpooky = createDialoguePathId();
    const pathElse = createDialoguePathId();
    const entry = {
        id,
        entryType: 'dialogue',
        name: 'Chronal Mirror',
        status: 'removed',
        eraName: '',
        tags: ['Classic', 'Multi Path'],
        scene: DEFAULT_DIALOGUE_SCENE || 'Default.png',
        lines: [open, spooky, somethingElse],
        paths: [
            { id: pathSpooky, label: 'Spooky', lineIds: [open.id, spooky.id] },
            { id: pathElse, label: 'Something else', lineIds: [open.id, somethingElse.id] },
        ],
        selectedPathId: pathSpooky,
    };
    if (existing) {
        Object.assign(existing, entry);
        console.log('updated Chronal Mirror');
    } else {
        conversations.push(entry);
        console.log('added Chronal Mirror');
    }
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('Tracer Classic audit done');
