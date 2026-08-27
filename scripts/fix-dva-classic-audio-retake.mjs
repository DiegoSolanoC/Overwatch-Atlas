#!/usr/bin/env node
/**
 * Retake BGM-tainted D.Va Classic cuts from clean map comps;
 * split Oasis "Seeing…" from Eichenwalde Rebuilding; fix So Serious voice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createConversationId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const YT_CACHE = path.join(REPO, 'scripts/_cache/classic-yt');
const EXTRACT = path.join(
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

function copyLoudnorm(source, atlas) {
    const dest = path.join(VOICELINES_DIR, atlas);
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

function cutYt(videoId, start, end, atlas) {
    const source = mustExist(path.join(YT_CACHE, `${videoId}.webm`));
    const dest = path.join(VOICELINES_DIR, atlas);
    const dur = Math.max(0.2, end - start);
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
            'loudnorm=I=-16:TP=-1.5:LRA=11',
            '-c:a',
            'libvorbis',
            '-q:a',
            '6',
            dest,
        ],
        { encoding: 'utf8' },
    );
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-600));
        throw new Error(`yt cut failed for ${atlas}`);
    }
    console.log(`yt-cut ${atlas} (${start.toFixed(2)}-${end.toFixed(2)} @ ${videoId})`);
    return atlas;
}

const voiceThings = cutYt(
    'M_xALVMKggc',
    12.55,
    19.2,
    'Reinhardt_-_Things_can_be_destroyed,_but_as_long_as_the_people_are_strong,_they_can_always_be_rebuilt.ogg',
);
const voiceHope = cutYt(
    'PM7_Sk3uQLM',
    7.75,
    14.35,
    'D.Va_-_Seeing_what_happened_after_the_war_here_gives_me_hope_for_the_rebuilding_of_my_country.ogg',
);
const voiceSerious = copyLoudnorm(
    mustExist(
        path.join(
            EXTRACT,
            'D.Va',
            'MatchTalk',
            "000000057C8A.0B2-You remind me of someone... you're so serious, though!.ogg",
        ),
    ),
    "D.Va_-_You_remind_me_of_someone..._You're_so_serious,_though!.ogg",
);
const voiceMistaken = copyLoudnorm(
    mustExist(
        path.join(EXTRACT, 'Hanzo', 'MatchTalk', '0000000441D5.0B2-I believe you are mistaken.ogg'),
    ),
    'Hanzo_-_I_believe_you_are_mistaken.ogg',
);

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = raw.conversations;
const byId = new Map(conversations.map((c) => [c.id, c]));

{
    const c = byId.get('c651d2d5-3387-4f65-ae1f-725101da4313');
    if (!c) throw new Error('Rebuilding missing');
    const home = c.lines.find((l) => /destruction caused/i.test(l.subtitles || ''));
    const hope = c.lines.find((l) => /Seeing what happened/i.test(l.subtitles || ''));
    const rein = c.lines.find((l) => /Things can be destroyed/i.test(l.subtitles || ''));
    if (!home || !hope || !rein) throw new Error('Rebuilding lines missing');

    rein.voice = voiceThings;
    hope.voice = voiceHope;

    c.name = 'Rebuilding';
    c.tags = ['Classic', 'Map Specific'];
    c.mapChoices = ['Eichenwalde', 'Volskaya Industries'];
    c.lines = [home, rein];
    delete c.paths;
    delete c.selectedPathId;
    console.log('Rebuilding -> Eichenwalde/Volskaya (no Hope multipath)');

    let oasis = conversations.find(
        (x) =>
            x.name === 'Hope for Rebuilding' ||
            (Array.isArray(x.lines) &&
                x.lines.some((l) => l.id === hope.id) &&
                x.id !== c.id),
    );
    if (!oasis) {
        oasis = {
            id: createConversationId(),
            entryType: 'dialogue',
            name: 'Hope for Rebuilding',
            status: 'removed',
            eraName: '',
            tags: ['Classic', 'Map Specific'],
            scene: 'Default.png',
            mapChoices: ['Oasis'],
            lines: [hope],
        };
        conversations.push(oasis);
        console.log('added Hope for Rebuilding', oasis.id);
    } else {
        oasis.name = 'Hope for Rebuilding';
        oasis.status = 'removed';
        oasis.tags = ['Classic', 'Map Specific'];
        oasis.mapChoices = ['Oasis'];
        oasis.lines = [hope];
        delete oasis.paths;
        delete oasis.selectedPathId;
        console.log('updated Hope for Rebuilding');
    }
}

{
    const c = byId.get('bcad1bbb-0ad6-4f7c-93f6-31fe08417227');
    if (!c) throw new Error('So Serious entry missing');
    c.name = 'So Serious';
    c.lines[0].hero = 'D.va';
    c.lines[0].voice = voiceSerious;
    c.lines[0].subtitles = "You remind me of someone... You're so serious, though!";
    c.lines[1].hero = 'Hanzo';
    c.lines[1].voice = voiceMistaken;
    c.lines[1].subtitles = 'I believe you are mistaken.';
    console.log('fixed So Serious');
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
