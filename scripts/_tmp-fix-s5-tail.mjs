#!/usr/bin/env node
/**
 * Season 5 tail repairs: Junker Planet moon, Sojourn/Vendetta, Winston/Sojourn,
 * IJC Brigitte, Sojourn/Junkers, Doctrine/Sombra birds, Sombra/Mizuki/Widow,
 * Roadhog multipath, Sigma/Vendetta, Winston×WB×2, Doomfist/Widow.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');
const VOICELINES = path.join('src/assets/audio/Theater/Voicelines');
const CONV = absFromPublic(FILES.dialogueTheater.conversations);
const TAGS = ['Overwatch'];

function atlas(hero, label) {
    const body = String(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${String(hero).replace(/ /g, '_')}_-_${body}.ogg`;
}

function cleanSubs(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+\?/g, '?')
        .replace(/\s+!/g, '!')
        .replace(/\s+\./g, '.')
        .trim();
}

function labelFrom0B2(basename) {
    return basename.replace(/^.*?\.0B2-/, '').replace(/\.ogg$/i, '');
}

async function copyFile(src, dest) {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(src, dest);
}

async function copy0B2(heroFolder, file, atlasHero, forcedLabel) {
    const src = path.join(EXTRACT, heroFolder, 'MatchTalk', file);
    if (!fs.existsSync(src)) throw new Error(`Missing ${src}`);
    const label = forcedLabel || labelFrom0B2(file);
    const voice = atlas(atlasHero || heroFolder, label);
    const dest = path.join(VOICELINES, voice);
    await copyFile(src, dest);
    return { voice, subtitles: cleanSubs(label) };
}

async function copyEmotion(heroFolder, emotionDir, atlasHero, forcedLabel) {
    const dir = path.join(EXTRACT, heroFolder, 'MatchTalk', emotionDir);
    if (!fs.existsSync(dir)) throw new Error(`Missing emotion dir ${dir}`);
    const ogg = fs.readdirSync(dir).find((n) => /\.ogg$/i.test(n));
    if (!ogg) throw new Error(`No ogg in ${dir}`);
    const label = forcedLabel || emotionDir.replace(/^\(|\)$/g, '').trim();
    const voice = atlas(atlasHero || heroFolder, `(${label})`);
    await copyFile(path.join(dir, ogg), path.join(VOICELINES, voice));
    return { voice, subtitles: `**${label}**` };
}

/**
 * Wrecking Ball: .03F hamster SFX as voicePrefix + .0B2 translator as voice.
 */
async function copyWbLine(emotionDirName, translator0B2) {
    const emotionDir = path.join(EXTRACT, 'Wrecking Ball', 'MatchTalk', emotionDirName);
    const ogg = fs.readdirSync(emotionDir).find((n) => /\.ogg$/i.test(n));
    if (!ogg) throw new Error(`No 03F in ${emotionDir}`);
    const spoken = emotionDirName
        .replace(/^\(hamster noises\)\s*/i, '')
        .replace(/_/g, ':')
        .trim();
    const prefixLabel = `(hamster noises) ${spoken}`;
    const voicePrefix = atlas('Wrecking Ball', prefixLabel);
    const voice = atlas('Wrecking Ball', spoken);
    await copyFile(path.join(emotionDir, ogg), path.join(VOICELINES, voicePrefix));
    const b2 = path.join(EXTRACT, 'Wrecking Ball', 'MatchTalk', translator0B2);
    if (!fs.existsSync(b2)) throw new Error(`Missing ${b2}`);
    await copyFile(b2, path.join(VOICELINES, voice));
    return {
        voice,
        voicePrefix,
        subtitles: `**hamster noises** ${cleanSubs(spoken)}`,
    };
}

function makeLine(hero, voice, subtitles, render, extras = {}) {
    return {
        id: createDialogueLineId(),
        hero,
        voice,
        voicePrefix: extras.voicePrefix || '',
        subtitles,
        render,
        era: 'Overwatch',
        status: 'active',
        mirror: false,
        disclaimer: '',
        partnerMode: 'or',
        partners: [],
        partnerFocus: '',
        partnerStackOrder: [],
        partnerFixed: [],
        partnerOrPools: [],
    };
}

function findByIdOr(conversations, id, pred) {
    return conversations.find((c) => c.id === id) || conversations.find(pred);
}

function upsertNew(conversations, name, lines, tags = TAGS) {
    const row = buildBlankConversationRecord();
    row.name = name || String(nextConversationNumber(conversations));
    row.eraName = '';
    row.scene = DEFAULT_DIALOGUE_SCENE;
    row.tags = tags;
    row.status = 'active';
    row.lines = lines;
    conversations.push(row);
    return row;
}

function setLines(row, lines, tags) {
    row.lines = lines;
    row.eraName = '';
    if (tags) row.tags = tags;
    delete row.paths;
    delete row.selectedPathId;
}

const notes = [];
const assets = await scanTheaterAssets();
const pick = (h) => (assets.renders?.[h] || []).find((n) => /heroic/i.test(n)) || 'Heroic.png';

const raw = JSON.parse(fs.readFileSync(CONV, 'utf8'));
const conversations = raw.conversations;

// --- audio ---
const moon = await copy0B2('Roadhog', '00000006CACF.0B2-Hmm. Moon.ogg', 'Roadhog');
const quiet = await copy0B2('Roadhog', '00000006CAD5.0B2-Finally... some quiet.ogg', 'Roadhog');
const bastionExcited = await copy0B2(
    'Bastion',
    '00000006CABA.0B2-(excited beeps).ogg',
    'Bastion',
    '(excited beeps)',
);
const jetpackChaotic = await copyEmotion('Jetpack Cat', '(chaotic yowls)', 'Jetpack Cat', 'chaotic yowls');
const sojWar = await copy0B2(
    'Sojourn',
    "00000006B1AA.0B2-I don't care what it takes. This war of yours ends now.ogg",
    'Sojourn',
);
const vendHistory = await copy0B2(
    'Vendetta',
    '00000006B38E.0B2-History will remember which of us claims victory, and my name will never be forgotten.ogg',
    'Vendetta',
);
const sojShutdown = await copy0B2(
    'Sojourn',
    "00000006B183.0B2-Winston... I'm sorry. About the shutdown order, I... I should've told you.ogg",
    'Sojourn',
);
const sojHeists = await copy0B2(
    'Sojourn',
    "00000006C188.0B2-Wait... I know you two. You weren't just at Busan, you're wanted for heists around the world.ogg",
    'Sojourn',
);
const junkWhat = await copy0B2(
    'Junkrat',
    "00000006CBCB.0B2-I mean, er... What he said!.ogg",
    'Junkrat',
);
const sombraDemand = await copy0B2(
    'Sombra',
    '00000006D3DF.0B2-More like demanding. Every day. Several times an hour.ogg',
    'Sombra',
);
const widowAkande = await copy0B2(
    'Widowmaker',
    '00000006CDD0.0B2-Akande keeps us as allies... I can only trust that his judgement is sound.ogg',
    'Widowmaker',
);
const sombraBetween = await copy0B2(
    'Sombra',
    '00000006D3E7.0B2-Right, right, but... between us_.ogg',
    'Sombra',
);
const vendEmp = await copy0B2(
    'Vendetta',
    '00000006B39C.0B2-The EMP is in place, Subject Sigma. Its detonation falls to you.ogg',
    'Vendetta',
);
const sigmaHold = await copy0B2(
    'Sigma',
    '00000006B16F.0B2-No, no, no... No, there is no use. It cannot hold together. It will not hold together!.ogg',
    'Sigma',
);
const vendTolerate = await copy0B2(
    'Vendetta',
    '00000006B39D.0B2-I will not tolerate excuses. Pull your weight, or be cut down like the rest!.ogg',
    'Vendetta',
);
const winOh = await copy0B2('Winston', '00000006AD05.0B2-Oh_ What is it_.ogg', 'Winston');
const widowPartner = await copy0B2(
    'Widowmaker',
    '00000006AB49.0B2-If we are to work together again, I desire a more equal partnership.ogg',
    'Widowmaker',
);
const doomTerms = await copy0B2(
    'Doomfist',
    '00000006C648.0B2-You have certainly proven your loyalty. Speak your terms.ogg',
    'Doomfist',
);
const widowTargets = await copy0B2(
    'Widowmaker',
    '00000006AB4A.0B2-The freedom to choose my own targets... and perhaps a tighter leash on the financier.ogg',
    'Widowmaker',
);
const doomDone = await copy0B2(
    'Doomfist',
    '00000006C644.0B2-(chuckle) Consider it done.ogg',
    'Doomfist',
);

const wbLikewise = await copyWbLine(
    '(hamster noises) He says_ likewise, old friend',
    '00000006B8DC.0B2-(hamster noises) He says_ likewise, old friend.ogg',
);
const wbPush = await copyWbLine(
    '(hamster noises) Do not push your luck',
    '00000006B8DD.0B2-(hamster noises) Do not push your luck.ogg',
);
const wbGrateful = await copyWbLine(
    '(hamster noises) The hamster is grateful. And he has a word of caution',
    '00000006B8DF.0B2-(hamster noises) The hamster is grateful. And he has a word of caution.ogg',
);
const wbCame = await copyWbLine(
    '(hamster noises) He says_ do not forget where you came from',
    '00000006B8E1.0B2-(hamster noises) He says_ do not forget where you came from.ogg',
);

// --- 1) Junker Planet: insert Roadhog moon ---
{
    const row = findByIdOr(
        conversations,
        '924c541c-0c38-4463-b14a-db9bb2bd36d8',
        (c) => String(c.name) === 'Junker Planet',
    );
    if (!row) throw new Error('Junker Planet missing');
    const vac = row.lines.find((l) => /need another vacation/i.test(l.subtitles || ''));
    const mars = row.lines.find((l) => /straight to Mars/i.test(l.subtitles || ''));
    const yeah = row.lines.find((l) => /Junker planet/i.test(l.subtitles || ''));
    if (!vac || !mars || !yeah) throw new Error('Junker Planet lines incomplete');
    const moonLine = makeLine('Roadhog', moon.voice, moon.subtitles, pick('Roadhog'));
    setLines(row, [vac, moonLine, mars, yeah]);
    row.name = 'Junker Planet';
    notes.push('Junker Planet: inserted Roadhog Hmm. Moon');
}

// --- 2) Sojourn × Vendetta ---
{
    const exists = conversations.some(
        (c) =>
            (c.lines || []).some((l) => /war of yours ends now/i.test(l.subtitles || '')) &&
            (c.lines || []).some((l) => /never be forgotten/i.test(l.subtitles || '')),
    );
    if (!exists) {
        const row = upsertNew(conversations, String(nextConversationNumber(conversations)), [
            makeLine('Sojourn', sojWar.voice, sojWar.subtitles, pick('Sojourn')),
            makeLine('Vendetta', vendHistory.voice, vendHistory.subtitles, pick('Vendetta')),
        ]);
        notes.push(`Sojourn×Vendetta: added #${row.name}`);
    } else notes.push('Sojourn×Vendetta: already present');
}

// --- 3) Winston × Sojourn (#36): prepend shutdown apology ---
{
    const row = findByIdOr(
        conversations,
        '6ea05417-2c0f-4423-831f-ee66713697c0',
        (c) =>
            String(c.name) === '36' ||
            ((c.lines || []).some((l) => /little darkness to help us see the light/i.test(l.subtitles || '')) &&
                (c.lines || []).some((l) => /leave you in the dark/i.test(l.subtitles || ''))),
    );
    if (!row) throw new Error('Winston×Sojourn missing');
    const hasShutdown = (row.lines || []).some((l) => /shutdown order/i.test(l.subtitles || ''));
    if (!hasShutdown) {
        const rest = [...(row.lines || [])];
        setLines(row, [
            makeLine('Sojourn', sojShutdown.voice, sojShutdown.subtitles, pick('Sojourn')),
            ...rest,
        ]);
        notes.push(`Winston×Sojourn (#${row.name}): prepended shutdown apology`);
    } else notes.push('Winston×Sojourn: already has shutdown');
}

// --- 4) IJC: remove misplaced Brigitte ---
{
    const row = findByIdOr(
        conversations,
        '0532130e-8937-44ba-b0ba-33cb0586bf6a',
        (c) => (c.lines || []).some((l) => /heard from the IJC/i.test(l.subtitles || '')),
    );
    if (!row) throw new Error('IJC conversation missing');
    const before = row.lines.length;
    row.lines = (row.lines || []).filter((l) => l.hero !== 'Brigitte');
    row.eraName = '';
    notes.push(`IJC (#${row.name}): removed Brigitte (${before}→${row.lines.length} lines)`);
}

// --- 5) Sojourn × Junkrat × Roadhog (#37) ---
{
    const row = findByIdOr(
        conversations,
        'c6c43f05-ceba-45fb-ac4f-d2a77ac0043f',
        (c) =>
            String(c.name) === '37' ||
            ((c.lines || []).some((l) => /please have mercy/i.test(l.subtitles || '')) &&
                (c.lines || []).some((l) => /ain't taking us alive/i.test(l.subtitles || ''))),
    );
    if (!row) throw new Error('Sojourn/Junkers missing');
    const junkMercy = row.lines.find((l) => /please have mercy/i.test(l.subtitles || ''));
    const roadAlive = row.lines.find((l) => /ain't taking us alive/i.test(l.subtitles || ''));
    if (!junkMercy || !roadAlive) throw new Error('#37 core lines missing');
    setLines(row, [
        makeLine('Sojourn', sojHeists.voice, sojHeists.subtitles, pick('Sojourn')),
        junkMercy,
        roadAlive,
        makeLine('Junkrat', junkWhat.voice, junkWhat.subtitles, pick('Junkrat')),
    ]);
    notes.push(`Sojourn×Junkrat×Roadhog (#${row.name}): full 4-line exchange`);
}

// --- 6) Doctrine × Sombra birds (#11): drop Freja + brother path ---
{
    const row = findByIdOr(
        conversations,
        '92fd43e9-19d6-4a14-885f-b2a0e633c80c',
        (c) =>
            String(c.name) === '11' ||
            (c.lines || []).some((l) => /remind me of a crow/i.test(l.subtitles || '')),
    );
    if (!row) throw new Error('Doctrine/Sombra birds missing');
    const crow = row.lines.find((l) => /remind me of a crow/i.test(l.subtitles || ''));
    const jail = row.lines.find((l) => /broke you out of jail/i.test(l.subtitles || ''));
    const birds = row.lines.find((l) => /birds of a feather/i.test(l.subtitles || ''));
    if (!crow || !jail || !birds) throw new Error('#11 crow/jail/birds lines missing');
    setLines(row, [crow, jail, birds]);
    notes.push(`Doctrine×Sombra birds (#${row.name}): Freja+brother removed`);
}

// --- 7) Sombra × Mizuki (#39): add demanding ---
{
    const row = findByIdOr(
        conversations,
        'f172c15b-ad9d-40a2-8640-d2f461def162',
        (c) =>
            String(c.name) === '39' ||
            ((c.lines || []).some((l) => /Hashimoto boss really has it out/i.test(l.subtitles || '')) &&
                (c.lines || []).some((l) => /asking around about me/i.test(l.subtitles || ''))),
    );
    if (!row) throw new Error('Sombra×Mizuki missing');
    if (!(row.lines || []).some((l) => /More like demanding/i.test(l.subtitles || ''))) {
        setLines(row, [
            ...row.lines,
            makeLine('Sombra', sombraDemand.voice, sombraDemand.subtitles, pick('Sombra')),
        ]);
        notes.push(`Sombra×Mizuki (#${row.name}): added demanding line`);
    } else notes.push('Sombra×Mizuki: already has demanding');
}

// --- 8) Sombra × Widow (#40): insert Akande + fix between-us ---
{
    const row = findByIdOr(
        conversations,
        'd7e0b29c-0341-4c11-80d6-83271e7ce243',
        (c) =>
            String(c.name) === '40' ||
            (c.lines || []).some((l) => /what do you think of the new guy/i.test(l.subtitles || '')),
    );
    if (!row) throw new Error('Sombra×Widow missing');
    const intro = row.lines.find((l) => /new guy/i.test(l.subtitles || ''));
    const secret = row.lines.find((l) => /Nothing stays secret/i.test(l.subtitles || ''));
    if (!intro || !secret) throw new Error('#40 core lines missing');
    setLines(row, [
        intro,
        makeLine('Widowmaker', widowAkande.voice, widowAkande.subtitles, pick('Widowmaker')),
        makeLine('Sombra', sombraBetween.voice, sombraBetween.subtitles.replace(/\?$/, '?'), pick('Sombra')),
        secret,
    ]);
    notes.push(`Sombra×Widow (#${row.name}): inserted Akande allies line`);
}

// --- 9) Roadhog multipath: Finally some quiet → Bastion / Jetpack ---
{
    const exists = conversations.some(
        (c) =>
            (c.lines || []).some((l) => /Finally\.\.\. some quiet/i.test(l.subtitles || '')) &&
            (c.tags || []).includes('Multi Path'),
    );
    if (!exists) {
        const lineQuiet = makeLine('Roadhog', quiet.voice, quiet.subtitles, pick('Roadhog'));
        const lineBastion = makeLine(
            'Bastion',
            bastionExcited.voice,
            '**excited beeps**',
            pick('Bastion'),
        );
        const lineJet = makeLine(
            'Jetpack Cat',
            jetpackChaotic.voice,
            jetpackChaotic.subtitles,
            pick('Jetpack Cat'),
        );
        const pathBastion = {
            id: createDialogueLineId(),
            label: 'Bastion',
            lineIds: [lineQuiet.id, lineBastion.id],
        };
        const pathJet = {
            id: createDialogueLineId(),
            label: 'Jetpack Cat',
            lineIds: [lineQuiet.id, lineJet.id],
        };
        const row = upsertNew(
            conversations,
            String(nextConversationNumber(conversations)),
            [lineQuiet, lineBastion, lineJet],
            ['Overwatch', 'Multi Path'],
        );
        row.paths = [pathBastion, pathJet];
        row.selectedPathId = pathBastion.id;
        notes.push(`Roadhog multipath: added #${row.name}`);
    } else notes.push('Roadhog multipath: already present');
}

// --- 10) Sigma × Vendetta ---
{
    const exists = conversations.some(
        (c) =>
            (c.lines || []).some((l) => /EMP is in place, Subject Sigma/i.test(l.subtitles || '')) &&
            (c.lines || []).some((l) => /cannot hold together/i.test(l.subtitles || '')),
    );
    if (!exists) {
        const row = upsertNew(conversations, String(nextConversationNumber(conversations)), [
            makeLine('Vendetta', vendEmp.voice, vendEmp.subtitles, pick('Vendetta')),
            makeLine('Sigma', sigmaHold.voice, sigmaHold.subtitles, pick('Sigma')),
            makeLine('Vendetta', vendTolerate.voice, vendTolerate.subtitles, pick('Vendetta')),
        ]);
        notes.push(`Sigma×Vendetta: added #${row.name}`);
    } else notes.push('Sigma×Vendetta: already present');
}

// --- 11) Winston × Wrecking Ball ×2 (replace mashed #44) ---
{
    const mashed = findByIdOr(
        conversations,
        '2c69d7d8-a78b-4d32-909b-b5f4b3bba7db',
        (c) =>
            String(c.name) === '44' ||
            ((c.lines || []).some((l) => /good to see you again after so long, Hammond/i.test(l.subtitles || '')) &&
                (c.lines || []).some((l) => /tolerate excuses/i.test(l.subtitles || ''))),
    );
    const winGood =
        mashed?.lines?.find((l) => /good to see you again after so long, Hammond/i.test(l.subtitles || '')) ||
        makeLine(
            'Winston',
            'Winston_-_It_was_good_to_see_you_again_after_so_long,_Hammond.ogg',
            'It was good to see you again after so long, Hammond',
            pick('Winston'),
        );
    const winViolence =
        mashed?.lines?.find((l) => /violence to a minimum/i.test(l.subtitles || '')) ||
        makeLine(
            'Winston',
            'Winston_-_And,_if_you_ever_think_of_it…_maybe_you_could_ask_your_new_friends_to_keep_the_violence_to_a_minimum.ogg',
            'And, if you ever think of it… maybe you could ask your new friends to keep the violence to a minimum',
            pick('Winston'),
        );
    const winFamily =
        mashed?.lines?.find((l) => /new family now, Hammond/i.test(l.subtitles || '')) ||
        makeLine(
            'Winston',
            "Winston_-_I_know_you_have_a_new_family_now,_Hammond,_but_if_you_ever_need_help,_I'm_here_for_you.ogg",
            "I know you have a new family now, Hammond, but if you ever need help, I'm here for you",
            pick('Winston'),
        );

    const wb1 = makeLine('Wrecking Ball', wbLikewise.voice, wbLikewise.subtitles, pick('Wrecking Ball'), {
        voicePrefix: wbLikewise.voicePrefix,
    });
    const wb2 = makeLine('Wrecking Ball', wbPush.voice, wbPush.subtitles, pick('Wrecking Ball'), {
        voicePrefix: wbPush.voicePrefix,
    });
    const wb3 = makeLine('Wrecking Ball', wbGrateful.voice, wbGrateful.subtitles, pick('Wrecking Ball'), {
        voicePrefix: wbGrateful.voicePrefix,
    });
    const wb4 = makeLine('Wrecking Ball', wbCame.voice, wbCame.subtitles, pick('Wrecking Ball'), {
        voicePrefix: wbCame.voicePrefix,
    });
    const winOhLine = makeLine('Winston', winOh.voice, winOh.subtitles, pick('Winston'));

    if (mashed) {
        setLines(mashed, [winGood, wb1, winViolence, wb2]);
        notes.push(`Winston×WB #1 (#${mashed.name}): likewise / do not push luck`);
    } else {
        const row = upsertNew(conversations, String(nextConversationNumber(conversations)), [
            winGood,
            wb1,
            winViolence,
            wb2,
        ]);
        notes.push(`Winston×WB #1: added #${row.name}`);
    }

    const familyExists = conversations.some(
        (c) =>
            c !== mashed &&
            (c.lines || []).some((l) => /new family now, Hammond/i.test(l.subtitles || '')) &&
            (c.lines || []).some((l) => /do not forget where you came from/i.test(l.subtitles || '')),
    );
    if (!familyExists) {
        const familyLine = {
            ...winFamily,
            id: createDialogueLineId(),
            voice:
                winFamily.voice ||
                "Winston_-_I_know_you_have_a_new_family_now,_Hammond,_but_if_you_ever_need_help,_I'm_here_for_you.ogg",
            subtitles:
                winFamily.subtitles ||
                "I know you have a new family now, Hammond, but if you ever need help, I'm here for you",
        };
        const row = upsertNew(conversations, String(nextConversationNumber(conversations)), [
            familyLine,
            wb3,
            winOhLine,
            wb4,
        ]);
        notes.push(`Winston×WB #2: added #${row.name}`);
    } else notes.push('Winston×WB #2: already present');
}

// --- 12) Doomfist × Widowmaker ---
{
    const exists = conversations.some(
        (c) =>
            (c.lines || []).some((l) => /more equal partnership/i.test(l.subtitles || '')) &&
            (c.lines || []).some((l) => /Speak your terms/i.test(l.subtitles || '')),
    );
    if (!exists) {
        const row = upsertNew(conversations, String(nextConversationNumber(conversations)), [
            makeLine('Widowmaker', widowPartner.voice, widowPartner.subtitles, pick('Widowmaker')),
            makeLine('Doomfist', doomTerms.voice, doomTerms.subtitles, pick('Doomfist')),
            makeLine('Widowmaker', widowTargets.voice, widowTargets.subtitles, pick('Widowmaker')),
            makeLine('Doomfist', doomDone.voice, doomDone.subtitles, pick('Doomfist')),
        ]);
        notes.push(`Doomfist×Widow: added #${row.name}`);
    } else notes.push('Doomfist×Widow: already present');
}

raw.conversations = conversations;
let wrote = false;
for (let attempt = 1; attempt <= 5; attempt++) {
    try {
        await fsp.writeFile(CONV, `${JSON.stringify(raw, null, 2)}\n`);
        wrote = true;
        break;
    } catch (err) {
        console.warn(`write attempt ${attempt} failed:`, err?.code || err?.message || err);
        await new Promise((r) => setTimeout(r, 400 * attempt));
    }
}
if (!wrote) throw new Error('Failed to write conversations.json');

console.log(notes.map((n) => `✓ ${n}`).join('\n'));
console.log(`Total conversations: ${conversations.length}`);
