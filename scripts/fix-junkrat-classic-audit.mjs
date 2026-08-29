#!/usr/bin/env node
/**
 * Classic Junkrat audit:
 * - Merge "work something out" into Nice Reward as Multi Path (vs Roadhog Try me)
 * - Wire Brrr cold / That's cold from extract
 * - Replace mashed Torb "compatible" cut
 * - Anubis rat: re-scouted; still no extract/OT/YT audio (left absent)
 *
 * Usage:
 *   node scripts/fix-junkrat-classic-audit.mjs
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
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const WORK_OUT_ID = 'ef65d7ff-92c5-42d8-9a20-4e6c16a72bdd'; // #91 solo shell
const NICE_REWARD_ID = 'cb5216d8-97fc-4bed-917d-5f800dc7b6b4';
const COLD_LOOK_ID = '8507257b-a6e1-4604-811c-768ad1ee0126';
const BULLY_ID = '67bd4df8-a5d6-42e5-a865-721eb0be00f4';
const COMPATIBLE_ID = '29b07ca6-3164-4303-808d-21cfff2feb3a';

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
            .replace(/[üû]/g, 'u');
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

const JUNK = path.join(EXTRACT_ROOT, 'Junkrat', 'MatchTalk');
const TORB = findHeroDir('Torbjörn');

const voice = {
    workOut: copyLoudnorm(
        findExtract(JUNK, '00000002EE8E'),
        "Junkrat_-_Maybe_we_could..._work_something_out,_mate.ogg",
    ),
    coldLook: copyLoudnorm(
        findExtract(JUNK, '00000001FF37'),
        'Junkrat_-_Brrr..._I_get_cold_just_looking_at_you.ogg',
    ),
    thatsCold: copyLoudnorm(
        findExtract(JUNK, '00000001FF3A'),
        "Junkrat_-_That's_cold!.ogg",
    ),
    compatible: copyLoudnorm(
        findExtractRecursive(TORB, '00000004C490'),
        "Torbjörn_-_I_don't_think_they're_compatible.ogg",
    ),
};

for (const old of fs.readdirSync(VOICELINES_DIR)) {
    if (/^Torbj.*_i_dont_think_theyre_compatible/i.test(old) && !Object.values(voice).includes(old)) {
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

patch(NICE_REWARD_ID, (c) => {
    c.name = 'Nice Reward';
    c.tags = Array.from(new Set([...(c.tags || []), 'Classic', 'Multi Path']));
    const solo = byId.get(WORK_OUT_ID);
    const cassidy = line(
        'Cassidy',
        "I heard there's a nice reward for bringing you fellas in.",
        c.lines[0]?.voice || "Cassidy_-_I_heard_there's_a_nice_reward_for_bringing_you_fellas_in.ogg",
        c.lines[0]?.id || createDialogueLineId(),
    );
    const roadhog = line(
        'Roadhog',
        'Try me.',
        c.lines[1]?.voice || 'Roadhog_-_Try_me.ogg',
        c.lines[1]?.id || createDialogueLineId(),
    );
    const junkrat = line(
        'Junkrat',
        'Maybe we could, erm, work something out, mate? *nervous laugh*',
        voice.workOut,
        solo?.lines?.[1]?.id || createDialogueLineId(),
    );
    c.lines = [cassidy, roadhog, junkrat];
    const pathHog = createDialoguePathId();
    const pathJunk = createDialoguePathId();
    c.paths = [
        { id: pathHog, label: 'Roadhog', lineIds: [cassidy.id, roadhog.id] },
        { id: pathJunk, label: 'Junkrat', lineIds: [cassidy.id, junkrat.id] },
    ];
    c.selectedPathId = pathHog;
});

{
    const idx = conversations.findIndex((x) => x.id === WORK_OUT_ID);
    if (idx >= 0) {
        conversations.splice(idx, 1);
        console.log('removed solo Nice Reward / work-out shell #91');
    }
}

patch(COLD_LOOK_ID, (c) => {
    c.name = 'Cold Looking';
    c.lines[0].hero = 'Junkrat';
    c.lines[0].voice = voice.coldLook;
    c.lines[0].subtitles = 'Brrr... I get cold just looking at you.';
});

patch(BULLY_ID, (c) => {
    c.name = 'No-Good Bully';
    c.tags = Array.from(new Set([...(c.tags || []), 'Classic', 'Multi Path']));
    const mei = line(
        'Mei',
        "You're just a no-good bully. How can you even look at yourself in the mirror?",
        c.lines[0]?.voice || '',
        c.lines[0]?.id || createDialogueLineId(),
    );
    const cold = line(
        'Junkrat',
        "That's cold!",
        voice.thatsCold,
        c.lines[1]?.id || createDialogueLineId(),
    );
    const freedom = line(
        'Junkrat',
        "I beg your pardon! I consider myself a freedom fighter, a... misunderstood one.",
        c.lines[2]?.voice ||
            'Junkrat_-_I_beg_your_pardon!_I_consider_myself_a_freedom_fighter,_a..._misunderstood_one.ogg',
        c.lines[2]?.id || createDialogueLineId(),
    );
    c.lines = [mei, cold, freedom];
    const pathCold = createDialoguePathId();
    const pathFree = createDialoguePathId();
    c.paths = [
        { id: pathCold, label: "That's cold", lineIds: [mei.id, cold.id] },
        { id: pathFree, label: 'Freedom fighter', lineIds: [mei.id, freedom.id] },
    ];
    c.selectedPathId = pathCold;
});

patch(COMPATIBLE_ID, (c) => {
    c.name = 'Trade Arms';
    c.lines[1].hero = 'Torbjörn';
    c.lines[1].voice = voice.compatible;
    c.lines[1].subtitles = "I don't think they're compatible.";
});

console.warn(
    'WARN: Anubis rat (What did you find in there / No idea what ya sayin) — re-scouted extract/OT/cached YT; still no audio. Not re-adding empty shell.',
);

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('Junkrat Classic audit done');
