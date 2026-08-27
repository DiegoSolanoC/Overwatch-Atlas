#!/usr/bin/env node
/**
 * Restore Rebuilding multipath + retake Seeing with earlier start (was clipped).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialoguePathId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const YT_CACHE = path.join(REPO, 'scripts/_cache/classic-yt');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const REBUILDING_ID = 'c651d2d5-3387-4f65-ae1f-725101da4313';
const OASIS_SOLO_ID = 'c87e05cd-4f2c-48b5-8af9-a21e810160e9';
const HOPE_ATLAS =
    'D.Va_-_Seeing_what_happened_after_the_war_here_gives_me_hope_for_the_rebuilding_of_my_country.ogg';

function cutYt(videoId, start, end, atlas) {
    const source = path.join(YT_CACHE, `${videoId}.webm`);
    if (!fs.existsSync(source)) throw new Error(`Missing ${source}`);
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

// Start after prior "welcome to" (~6.63), before auto-sub "see" (~7.92) so "Seeing" isn't clipped.
cutYt('PM7_Sk3uQLM', 6.85, 14.5, HOPE_ATLAS);

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = raw.conversations;
const rebuilding = conversations.find((c) => c.id === REBUILDING_ID);
const oasisSolo = conversations.find((c) => c.id === OASIS_SOLO_ID);
if (!rebuilding) throw new Error('Rebuilding missing');

const home = rebuilding.lines.find((l) => /destruction caused/i.test(l.subtitles || ''));
const rein = rebuilding.lines.find((l) => /Things can be destroyed/i.test(l.subtitles || ''));
const hopeFromSolo = oasisSolo?.lines?.find((l) => /Seeing what happened/i.test(l.subtitles || ''));
if (!home || !rein) throw new Error('Rebuilding home/rein missing');

const hope = hopeFromSolo || {
    id: '8b57125c-8eb1-46cb-bd76-8084a1446522',
    hero: 'D.va',
    voice: HOPE_ATLAS,
    voicePrefix: '',
    subtitles:
        'Seeing what happened after the war here gives me hope for the rebuilding of my country.',
    render: 'Heroic.png',
    era: 'Overwatch',
    status: 'active',
};
hope.voice = HOPE_ATLAS;
hope.subtitles =
    'Seeing what happened after the war here gives me hope for the rebuilding of my country.';
hope.hero = 'D.va';
hope.render = hope.render || 'Heroic.png';
hope.era = hope.era || 'Overwatch';
hope.status = 'active';

const pathHome = createDialoguePathId();
const pathHope = createDialoguePathId();

rebuilding.name = 'Rebuilding';
rebuilding.tags = ['Classic', 'Multi Path', 'Map Specific'];
rebuilding.mapChoices = ['Eichenwalde', 'Volskaya Industries'];
rebuilding.lines = [home, hope, rein];
rebuilding.paths = [
    { id: pathHome, label: 'Home', lineIds: [home.id, rein.id] },
    { id: pathHope, label: 'Hope', lineIds: [hope.id, rein.id] },
];
rebuilding.selectedPathId = pathHome;
console.log('restored Rebuilding multipath');

raw.conversations = conversations.filter((c) => c.id !== OASIS_SOLO_ID);
console.log('removed Oasis solo Hope for Rebuilding');

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
