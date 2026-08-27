#!/usr/bin/env node
/**
 * Classic Moira audit:
 * - Remove Retribution (Archives) Moira↔Cassidy multiparty shells
 * - Wire missing/wrong MatchTalk from HeroVoice + Omnic Talking
 * - Replace bad YT cuts (Mei cry, Reaper "well")
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
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);
const OT_CACHE = path.join(REPO, 'scripts/_cache/moira-classic');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

/** Classic shells that are Retribution / Archives mission chat, not MatchTalk. */
const RETRIBUTION_IDS = [
    '427ae945-1a9a-4a09-90ef-b7a92ff9f3b8', // 110 breach
    '95fcc064-05a5-4a0c-84df-bf2a5dafd847', // 111 breach
    '948d45a7-d935-4c05-b3c7-922c81552c06', // 116 dress up / assassins
    '4bc22c6d-d0d5-4cf2-ab0c-e746aa03c0ec', // 117 door progress
    '5a73813f-24ed-4b82-815e-542379b4fb3c', // 122 Antonio
    'f3c035b6-d774-44e9-b94e-6d17394b6d9b', // 124 Talon
    'f115e6e8-1a80-421e-b515-c282b3bd932f', // 126 Carnevale
    '825c2d79-7f67-4da5-9671-da14fca5db6f', // 131 Blackwatch Pilot
    '3f3c56bf-2bfb-4e43-a8c6-30ec049de411', // 132 fancy place
    '0b0b1f59-ef05-4911-83f7-2eb88f7d1f01', // 133 culture / Cave of Mystery
    'cb9fadaf-f32a-4401-af40-dff3289a4d24', // 136 Carnevale
    '2b30827f-0007-4333-b5b6-cbde583a887a', // 138 Italian accent
    'b6a508cf-2e69-4f53-8318-b2bde7568ac2', // 139 ride
    '1909479e-d940-42ae-b270-da39695a4b81', // 140 landing
    // additional Retribution shells without Moira (still Archives, not MatchTalk)
    'e9073924-8419-4780-876f-0052dc5d353d', // 107 Antonio
    'aff5eab9-ff04-42bf-adff-673323020e05', // 108 snatch n grab
    'ac759c09-9f32-470b-8436-667ddfe240c1', // 114 Who was Antonio
    '08815e31-9890-4550-9f91-d63b587ad6cb', // 118 Viali
    '7cfa14e1-0d44-4e17-b0ff-0bccc1d18f1b', // 119 through the breach
    '2c93e346-dfd8-401d-a6f9-ec6fa7083164', // 120 kill Antonio
    '1ea1bf25-e927-4ccd-ac48-25a633d81bff', // 128 surveillance
    '93b02a6e-ccb5-48b6-b6c3-9ddf526af25e', // 135 Blackwatch Pilot
    '3df5594e-63e9-440e-bdff-5139600f0081', // 137
];

/** Duplicate empty McCree-named Texas shell; keep Cassidy-named #307. */
const DELETE_ALSO = ['6527e51f-bc01-4007-b988-b7db43714d7f'];

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

const voice = {
    cowboyMoira: copyLoudnorm(
        mustExist(
            path.join(
                OT_CACHE,
                '00000004687E.0B2-Our-courageous-cowboy.-The-years-havent-changed-you-much-have-they-Jesse_.ogg',
            ),
        ),
        'Moira_-_Our_courageous_cowboy._The_years_havent_changed_you_much,_have_they,_Jesse.ogg',
    ),
    feelingsCassidy: copyLoudnorm(
        mustExist(
            path.join(
                OT_CACHE,
                '00000004A54D-Well-they-certainly-havent-changed-my-feelings-about-working-with-you.ogg',
            ),
        ),
        'Cassidy_-_They_certainly_havent_changed_my_feelings_about_working_with_you.ogg',
    ),
    grewUpMoira: copyLoudnorm(
        mustExist(
            path.join(
                OT_CACHE,
                '00000004C3B3-Why-am-I-not-surprised-to-learn-that-you-grew-up-in-a-place-like-this-McCree.ogg',
            ),
        ),
        'Moira_-_Why_am_I_not_surprised_to_learn_that_you_grew_up_in_a_place_like_this,_Cassidy.ogg',
    ),
    texasCassidy: copyLoudnorm(
        mustExist(path.join(OT_CACHE, '000000054FBF-Im-from-Texas.ogg')),
        "Cassidy_-_I'm_from_Texas.ogg",
    ),
    talkativeMoira: copyLoudnorm(
        mustExist(
            path.join(
                EXTRACT_ROOT,
                'Moira',
                'MatchTalk',
                "00000004687D.0B2-Much more talkative now, aren't you, Genji_.ogg",
            ),
        ),
        "Moira_-_Much_more_talkative_now,_aren't_you,_Genji.ogg",
    ),
    agreeableGenji: (() => {
        const atlas = 'Genji_-_I_find_the_company_more_agreeable_these_days.ogg';
        // keep existing if present; refresh only if extract exists
        const src = path.join(
            EXTRACT_ROOT,
            'Genji',
            'MatchTalk',
            '00000004BCFE.0B2-I find the company more agreeable these days.ogg',
        );
        if (fs.existsSync(src)) copyLoudnorm(src, atlas);
        return atlas;
    })(),
    zhouMoira: (() => {
        const atlas =
            "Moira_-_Dr._Zhou,_I'm_interested_in_your_colleagues'_research_into_the_long_term_effects_of_cryogenic_freezing.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    EXTRACT_ROOT,
                    'Moira',
                    'MatchTalk',
                    "00000004686E.0B2-Dr. Zhou, I'm interested in your colleagues' research into the long term effects of cryogenic freezing.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    meiTears: copyLoudnorm(
        mustExist(
            path.join(
                EXTRACT_ROOT,
                'Mei',
                'MatchTalk',
                "000000048C59.0B2-Oh, well, yes, I'm sure, maybe... (bursts into tears).ogg",
            ),
        ),
        'Mei_-_Oh,_well,_yes,_Im_sure,_maybe__(bursts_into_tears).ogg',
    ),
    adaptingMoira: (() => {
        const atlas = 'Moira_-_Your_body_seems_to_be_adapting_well_to_the_changes,_Gabriel.ogg';
        copyLoudnorm(
            mustExist(
                path.join(
                    EXTRACT_ROOT,
                    'Moira',
                    'MatchTalk',
                    '000000046880.0B2-Your body seems to be adapting well to the changes, Gabriel.ogg',
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    callWellReaper: copyLoudnorm(
        mustExist(
            path.join(
                EXTRACT_ROOT,
                'Reaper',
                'MatchTalk',
                "000000054FB0.0B2-This is what you'd call _well_.ogg",
            ),
        ),
        "Reaper_-_This_is_what_you'd_call_well.ogg",
    ),
    chronalMoira: (() => {
        const atlas =
            "Moira_-_Your_state_of_chronal_uncertainty_is_fascinating_to_me,_Tracer._I_do_wish_you'd_allow_me_to_study_you.ogg";
        copyLoudnorm(
            mustExist(
                path.join(
                    EXTRACT_ROOT,
                    'Moira',
                    'MatchTalk',
                    "000000046881.0B2-Your state of chronal uncertainty is fascinating to me, Tracer. I do wish you'd allow me to study you.ogg",
                ),
            ),
            atlas,
        );
        return atlas;
    })(),
    touchedTracer: copyLoudnorm(
        mustExist(
            path.join(
                EXTRACT_ROOT,
                'Tracer',
                'MatchTalk',
                "00000004B0EE.0B2-While I'm truly touched by your offer, (nervous laugh) I think I'll have to pass.ogg",
            ),
        ),
        "Tracer_-_While_I'm_truly_touched_by_your_offer__(nervous_laugh)_I_think_I'll_have_to_pass.ogg",
    ),
};

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const byId = new Map(raw.conversations.map((c) => [c.id, c]));

/** @type {[string, (c: any) => void][]} */
const patches = [
    [
        '32646616-32b4-480e-a532-8d1ad3d39331',
        (c) => {
            c.name = 'Courageous Cowboy';
            c.lines[0].voice = voice.cowboyMoira;
            c.lines[0].subtitles =
                "Our courageous cowboy. The years haven't changed you much, have they, Jesse?";
            c.lines[1].voice = voice.feelingsCassidy;
            c.lines[1].subtitles =
                "They certainly haven't changed my feelings about working with you.";
        },
    ],
    [
        'ecf99915-ee22-440c-ae3c-41420d9041e0',
        (c) => {
            c.name = "I'm from Texas";
            c.lines[0].voice = voice.grewUpMoira;
            c.lines[0].subtitles =
                "Why am I not surprised to learn that you grew up in a place like this, Cassidy?";
            c.lines[1].voice = voice.texasCassidy;
            c.lines[1].subtitles = "I'm from Texas.";
        },
    ],
    [
        'ed1594ec-4411-4e50-ae07-6f8cb108e8b7',
        (c) => {
            c.name = 'More Talkative';
            c.lines[0].hero = 'Moira';
            c.lines[0].voice = voice.talkativeMoira;
            c.lines[0].subtitles = "Much more talkative now, aren't you, Genji?";
            c.lines[1].hero = 'Genji';
            c.lines[1].voice = voice.agreeableGenji;
            c.lines[1].subtitles = 'I find the company more agreeable these days.';
        },
    ],
    [
        '7be3e66c-21c5-4b8d-91b5-060776e61d1c',
        (c) => {
            c.name = 'Cryogenic Freezing';
            c.lines[0].voice = voice.zhouMoira;
            c.lines[1].voice = voice.meiTears;
            c.lines[1].subtitles = "Oh, well, yes, I'm sure, maybe... **bursts into tears**";
        },
    ],
    [
        '4082accd-cd46-4222-adf0-9d719c0d283c',
        (c) => {
            c.name = 'Call This Well';
            c.lines[0].voice = voice.adaptingMoira;
            c.lines[1].voice = voice.callWellReaper;
            c.lines[1].subtitles = 'This is what you\'d call "well".';
        },
    ],
    [
        '4465d5bf-afc9-4aac-b479-5fc402e7299f',
        (c) => {
            c.name = 'Chronal Uncertainty';
            c.lines[0].voice = voice.chronalMoira;
            c.lines[1].voice = voice.touchedTracer;
            c.lines[1].subtitles =
                "While I'm truly touched by your offer - **nervous laughter** - I think I'll have to pass...";
        },
    ],
];

for (const [id, fn] of patches) {
    const c = byId.get(id);
    if (!c) throw new Error(`missing conversation ${id}`);
    fn(c);
    console.log(`patched ${c.name} (${id.slice(0, 8)})`);
}

const purge = new Set([...RETRIBUTION_IDS, ...DELETE_ALSO]);
const before = raw.conversations.length;
raw.conversations = raw.conversations.filter((c) => !purge.has(c.id));
const removed = before - raw.conversations.length;
if (removed !== purge.size) {
    throw new Error(`expected to delete ${purge.size}, deleted ${removed}`);
}
console.log(`deleted ${RETRIBUTION_IDS.length} Retribution Classic shells + McCree Texas duplicate`);

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
const assets = await scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
console.log('done');
