#!/usr/bin/env node
/**
 * Build modern (name-stripped) variants of Classic Jesse/McCree lines
 * and wire modernVoice / modernSubtitles on conversations.
 *
 * Usage:
 *   node scripts/build-legacy-name-modern-clips.mjs
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
const WORK = path.join(REPO, 'scripts/_cache/legacy-name-cuts');
const FFMPEG =
    process.env.FFMPEG ||
    path.join(
        process.env.LOCALAPPDATA || '',
        'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin/ffmpeg.exe',
    );

const CUTS = [
    {
        lineId: '761f0ad3-5d96-48c9-a503-d00ac970b470',
        source: "Ashe_-_Aw,_you_know_that's_not_the_way_it_works,_Jesse.ogg",
        modernVoice: "Ashe_-_Aw,_you_know_that's_not_the_way_it_works.ogg",
        modernSubtitles: "Aw, you know that's not the way it works.",
        mode: 'keep',
        start: 0,
        end: 1.98,
        skip: true,
    },
    {
        lineId: '40ea7aa9-fd70-4221-a9a7-d275161f3e79',
        source: 'Ashe_-_Brave_of_you_to_show_your_face_around_here,_Jesse.ogg',
        modernVoice: 'Ashe_-_Brave_of_you_to_show_your_face_around_here.ogg',
        modernSubtitles: 'Brave of you to show your face around here.',
        mode: 'keep',
        start: 0,
        end: 2.22,
        fadeOut: 0.07,
        skip: true, // fixed
    },
    {
        lineId: 'ced9d509-0456-40d9-b47c-6c6b3a69d5bf',
        source: "Ashe_-_What'd_you_do_with_it,_Jesse!.ogg",
        modernVoice: "Ashe_-_What'd_you_do_with_it.ogg",
        modernSubtitles: "What'd you do with it?!",
        mode: 'keep',
        start: 0,
        end: 0.95,
        skip: true,
    },
    {
        matchSubtitles: /winning side would pay much better/i,
        hero: 'Doomfist',
        source: 'Doomfist_-_You_know,_McCree,_the_winning_side_would_pay_much_better._Maybe,_buy_yourself_some_real_clothes.ogg',
        modernVoice:
            'Doomfist_-_You_know,_the_winning_side_would_pay_much_better._Maybe,_buy_yourself_some_real_clothes.ogg',
        modernSubtitles:
            'You know, the winning side would pay much better. Maybe, buy yourself some real clothes?',
        mode: 'drop',
        dropStart: 0.55,
        dropEnd: 1.15,
        skip: true,
    },
    {
        matchSubtitles: /come back to this place/i,
        hero: 'Genji',
        source: 'Genji_-_Why_have_you_come_back_to_this_place,_McCree.ogg',
        modernVoice: 'Genji_-_Why_have_you_come_back_to_this_place.ogg',
        modernSubtitles: 'Why have you come back to this place?',
        mode: 'keep',
        start: 0,
        end: 1.7,
        skip: true,
    },
    {
        matchSubtitles: /courageous cowboy/i,
        hero: 'Moira',
        source: 'Moira_-_Our_courageous_cowboy._The_years_havent_changed_you_much,_have_they,_Jesse.ogg',
        modernVoice:
            "Moira_-_Our_courageous_cowboy._The_years_haven't_changed_you_much,_have_they.ogg",
        modernSubtitles:
            "Our courageous cowboy. The years haven't changed you much, have they?",
        mode: 'keep',
        start: 0,
        end: 4.8,
        fadeOut: 0.06,
        skip: true, // fixed
    },
    {
        matchSubtitles: /outlaw.*Reward|Jesse McCree/i,
        hero: 'Orisa',
        source: "Orisa_-_Jesse_McCree;_outlaw._Reward__60_million_dollars._The_reward_could_make_up_for_Efi's_grant_money.ogg",
        modernVoice:
            "Orisa_-_Outlaw._Reward__60_million_dollars._The_reward_could_make_up_for_Efi's_grant_money.ogg",
        modernSubtitles:
            "Outlaw. Reward: 60 million dollars. The reward could make up for Efi's grant money.",
        mode: 'keep',
        start: 0.95,
        end: 7.7,
        skip: true,
    },
    {
        lineId: '3f430204-b8ce-4cfc-9fe4-7f6d8d6da421',
        source: 'Pharah_-_McCree,_where_did_you_learn_to_shoot_like_that__Was_it_Jack,_Gabriel.ogg',
        modernVoice:
            'Pharah_-_Where_did_you_learn_to_shoot_like_that__Was_it_Jack,_Gabriel.ogg',
        modernSubtitles: 'Where did you learn to shoot like that? Was it Jack, Gabriel?',
        mode: 'keep',
        // Past McCree "re"; fade-in softens the clipped onset of Where
        start: 0.58,
        end: 4.9,
        fadeIn: 0.08,
    },
    {
        matchSubtitles: /if that is your real name/i,
        hero: 'Sombra',
        source: 'Sombra_-_Pleasure_working_with_you,_McCree..._if_that_is_your_real_name.ogg',
        clearModern: true,
    },
    {
        matchSubtitles: /know what time it is/i,
        hero: 'Mei',
        source: 'Mei_-_Hey,_McCree,_do_you_know_what_time_it_is.ogg',
        modernVoice: 'Mei_-_Hey,_do_you_know_what_time_it_is.ogg',
        modernSubtitles: 'Hey, do you know what time it is?',
        mode: 'meiHeySplice',
        heyDonor: 'Mei_-_Hey,_McCree,_do_you_know_what_time_it_is.ogg',
        heyStart: 0.06,
        heyEnd: 0.4,
        pauseSec: 0.3,
        tailStart: 1.28,
        heyFadeOut: 0.06,
    },
    {
        matchSubtitles: /grew up in a place like this/i,
        hero: 'Moira',
        source: 'Moira_-_Why_am_I_not_surprised_to_learn_that_you_grew_up_in_a_place_like_this,_McCree.ogg',
        modernVoice:
            'Moira_-_Why_am_I_not_surprised_to_learn_that_you_grew_up_in_a_place_like_this.ogg',
        modernSubtitles:
            'Why am I not surprised to learn that you grew up in a place like this?',
        mode: 'keep',
        start: 0,
        end: 4.02,
        skip: true,
    },
];

function mustExist(p) {
    if (!fs.existsSync(p)) throw new Error(`Missing: ${p}`);
    return p;
}

function runFfmpeg(args) {
    const r = spawnSync(FFMPEG, args, { encoding: 'utf8' });
    if (r.status !== 0) {
        console.error(r.stderr?.slice(-800));
        throw new Error(`ffmpeg failed: ${args.join(' ')}`);
    }
}

function loudnormCopy(source, destName) {
    const dest = path.join(VOICELINES_DIR, destName);
    const tmp = path.join(
        VOICELINES_DIR,
        `_tmp_${Date.now()}_${Math.random().toString(16).slice(2)}.ogg`,
    );
    runFfmpeg([
        '-y',
        '-i',
        source,
        '-af',
        'loudnorm=I=-16:TP=-1.5:LRA=11',
        '-c:a',
        'libvorbis',
        '-q:a',
        '6',
        tmp,
    ]);
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    fs.renameSync(tmp, dest);
    console.log('wrote', destName);
    return destName;
}

function cutKeep(src, start, end, workName, opts = {}) {
    fs.mkdirSync(WORK, { recursive: true });
    const out = path.join(WORK, workName);
    const dur = Math.max(0.05, end - start);
    const fadeIn = Number(opts.fadeIn || 0);
    const fadeOut = Number(opts.fadeOut || 0);
    const filters = [`atrim=${start}:${end}`, 'asetpts=PTS-STARTPTS'];
    if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`);
    if (fadeOut > 0) {
        const foStart = Math.max(0, dur - fadeOut);
        filters.push(`afade=t=out:st=${foStart}:d=${fadeOut}`);
    }
    runFfmpeg([
        '-y',
        '-i',
        src,
        '-af',
        filters.join(','),
        '-c:a',
        'libvorbis',
        '-q:a',
        '6',
        out,
    ]);
    return out;
}

function cutDrop(src, dropStart, dropEnd, workName) {
    fs.mkdirSync(WORK, { recursive: true });
    const out = path.join(WORK, workName);
    const filter = `[0:a]atrim=0:${dropStart},asetpts=PTS-STARTPTS[a];[0:a]atrim=${dropEnd},asetpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=0:a=1[out]`;
    runFfmpeg([
        '-y',
        '-i',
        src,
        '-filter_complex',
        filter,
        '-map',
        '[out]',
        '-c:a',
        'libvorbis',
        '-q:a',
        '6',
        out,
    ]);
    return out;
}

function cutMeiHeySplice(cut, workName) {
    fs.mkdirSync(WORK, { recursive: true });
    const donor = path.join(VOICELINES_DIR, cut.heyDonor);
    const src = path.join(VOICELINES_DIR, cut.source);
    mustExist(donor);
    mustExist(src);
    const heyStart = cut.heyStart ?? 0.16;
    const heyEnd = cut.heyEnd ?? 0.48;
    const heyDur = Math.max(0.05, heyEnd - heyStart);
    const pause = cut.pauseSec ?? 0.28;
    const tailStart = cut.tailStart ?? 1.28;
    const heyFadeOut = cut.heyFadeOut ?? 0;
    const out = path.join(WORK, workName);
    const heyFade =
        heyFadeOut > 0
            ? `,afade=t=out:st=${Math.max(0, heyDur - heyFadeOut)}:d=${heyFadeOut}`
            : '';
    const filter = `[0:a]atrim=${heyStart}:${heyEnd},asetpts=PTS-STARTPTS${heyFade}[hey];aevalsrc=0:d=${pause}[gap];[1:a]atrim=${tailStart},asetpts=PTS-STARTPTS[tail];[hey][gap][tail]concat=n=3:v=0:a=1[out]`;
    runFfmpeg([
        '-y',
        '-i',
        donor,
        '-i',
        src,
        '-filter_complex',
        filter,
        '-map',
        '[out]',
        '-c:a',
        'libvorbis',
        '-q:a',
        '6',
        out,
    ]);
    console.log(`mei splice hey=${heyDur.toFixed(2)}s pause=${pause}s tail@${tailStart}`);
    return out;
}

mustExist(FFMPEG);
mustExist(VOICELINES_DIR);

const raw = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const lineById = new Map();
for (const c of raw.conversations) {
    for (const l of c.lines || []) lineById.set(l.id, l);
}

for (const cut of CUTS) {
    let line = cut.lineId ? lineById.get(cut.lineId) : null;
    if (!line && cut.matchSubtitles) {
        for (const l of lineById.values()) {
            if (cut.hero && l.hero !== cut.hero) continue;
            if (cut.matchSubtitles.test(l.subtitles || '')) {
                line = l;
                break;
            }
        }
    }
    if (!line) throw new Error(`No line for ${cut.modernVoice || cut.source}`);

    if (cut.clearModern) {
        delete line.modernVoice;
        delete line.modernSubtitles;
        const orphan = path.join(
            VOICELINES_DIR,
            'Sombra_-_Pleasure_working_with_you..._if_that_is_your_real_name.ogg',
        );
        if (fs.existsSync(orphan)) {
            fs.unlinkSync(orphan);
            console.log('removed', path.basename(orphan));
        }
        console.log(`cleared modern for ${line.id} (${line.hero}) — legacy-only`);
        continue;
    }

    if (cut.skip) {
        console.log(`skip (keep existing modern) ${cut.modernVoice}`);
        continue;
    }

    const src = path.join(VOICELINES_DIR, cut.source);
    mustExist(src);

    const workName = `cut_${cut.modernVoice}`;
    let cutPath;
    if (cut.mode === 'meiHeySplice') {
        cutPath = cutMeiHeySplice(cut, workName);
    } else if (cut.mode === 'keep') {
        cutPath = cutKeep(src, cut.start ?? 0, cut.end ?? 0, workName, {
            fadeIn: cut.fadeIn,
            fadeOut: cut.fadeOut,
        });
    } else {
        cutPath = cutDrop(src, cut.dropStart ?? 0, cut.dropEnd ?? 0, workName);
    }

    loudnormCopy(cutPath, cut.modernVoice);
    line.modernVoice = cut.modernVoice;
    line.modernSubtitles = cut.modernSubtitles;
    console.log(`patched line ${line.id} (${line.hero})`);
}

fs.writeFileSync(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`);
console.log('wrote conversations.json');

const manifest = scanTheaterAssets();
fs.writeFileSync(THEATER_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('wrote theater-assets-manifest.json');
