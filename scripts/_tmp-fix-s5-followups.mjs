#!/usr/bin/env node
/**
 * Follow-ups: Roadhog Ugh on Some quiet, purge leftovers 10/46/47,
 * strip Baptiste from #2, import WB hamster SFX variants, refresh manifest.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createDialogueLineId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');
const VOICELINES = path.join('src/assets/audio/Theater/Voicelines');
const MANIFEST = path.join('src/data/dialogue-theater/theater-assets-manifest.json');
const CONV = absFromPublic(FILES.dialogueTheater.conversations);

function atlas(hero, label) {
    const body = String(label).replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_');
    return `${String(hero).replace(/ /g, '_')}_-_${body}.ogg`;
}

async function copyFile(src, dest) {
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(src, dest);
}

/**
 * Import every .03F take in an emotion folder as base / _(2) / _(3) …
 */
async function importHamsterVariants(emotionDirName, spokenLabel) {
    const dir = path.join(EXTRACT, 'Wrecking Ball', 'MatchTalk', emotionDirName);
    const files = fs
        .readdirSync(dir)
        .filter((n) => /\.ogg$/i.test(n))
        .sort((a, b) => a.localeCompare(b));
    if (files.length === 0) throw new Error(`No oggs in ${dir}`);
    const prefixLabel = `(hamster noises) ${spokenLabel}`;
    const written = [];
    for (let i = 0; i < files.length; i++) {
        const suffix = i === 0 ? '' : `_(${i + 1})`;
        const voice = atlas('Wrecking Ball', `${prefixLabel}${suffix}`);
        await copyFile(path.join(dir, files[i]), path.join(VOICELINES, voice));
        written.push(voice);
    }
    return written;
}

const notes = [];
const raw = JSON.parse(fs.readFileSync(CONV, 'utf8'));
const conversations = raw.conversations;
if (!raw._meta || typeof raw._meta !== 'object') raw._meta = {};

// --- 1) Roadhog Ugh on Some quiet ---
{
    const ughSrc = path.join(EXTRACT, 'Roadhog', 'MatchTalk', '00000006CAD4.0B2-Ugh.ogg');
    const ughVoice = 'Roadhog_-_Ugh.ogg';
    await copyFile(ughSrc, path.join(VOICELINES, ughVoice));

    const row = conversations.find(
        (c) =>
            String(c.name) === 'Some quiet' ||
            ((c.lines || []).some((l) => /Finally\.\.\. some quiet/i.test(l.subtitles || '')) &&
                (c.tags || []).includes('Multi Path')),
    );
    if (!row) throw new Error('Some quiet missing');

    let ughLine = (row.lines || []).find((l) => l.hero === 'Roadhog' && /^Ugh\.?$/i.test(String(l.subtitles || '').trim()));
    if (!ughLine) {
        ughLine = {
            id: createDialogueLineId(),
            hero: 'Roadhog',
            voice: ughVoice,
            voicePrefix: '',
            subtitles: 'Ugh.',
            render: 'Heroic.png',
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
        row.lines.push(ughLine);
    }

    const quietId = (row.lines || []).find((l) => /Finally\.\.\. some quiet/i.test(l.subtitles || ''))?.id;
    const bastionId = (row.lines || []).find((l) => l.hero === 'Bastion')?.id;
    const jetId = (row.lines || []).find((l) => l.hero === 'Jetpack Cat')?.id;
    if (!quietId || !bastionId || !jetId) throw new Error('Some quiet path heroes missing');

    row.paths = [
        {
            id: row.paths?.[0]?.id || createDialogueLineId(),
            label: 'Bastion',
            lineIds: [quietId, bastionId, ughLine.id],
        },
        {
            id: row.paths?.[1]?.id || createDialogueLineId(),
            label: 'Jetpack Cat',
            lineIds: [quietId, jetId, ughLine.id],
        },
    ];
    row.selectedPathId = row.paths[0].id;
    row.tags = ['Overwatch', 'Multi Path'];
    notes.push(`Some quiet: Roadhog Ugh on both paths`);
}

// --- 2) Strip Baptiste from #2 ---
{
    const row = conversations.find((c) => String(c.name) === '2' || c.id === '79628f32-21f1-4f6b-8921-ef91fe791b08');
    if (!row) throw new Error('#2 missing');
    const before = row.lines.length;
    row.lines = (row.lines || []).filter((l) => l.hero !== 'Baptiste');
    notes.push(`#2: removed Baptiste (${before}→${row.lines.length})`);
}

// --- 3) Purge leftovers 10, 46, 47 ---
{
    const purgeNames = new Set(['10', '46', '47']);
    const removed = [];
    for (let i = conversations.length - 1; i >= 0; i--) {
        const c = conversations[i];
        if (purgeNames.has(String(c.name || '').trim())) {
            removed.push({ id: c.id, name: c.name });
            conversations.splice(i, 1);
        }
    }
    const purgedIds = new Set([
        ...(Array.isArray(raw._meta.purgedConversationIds) ? raw._meta.purgedConversationIds : []),
        ...removed.map((r) => r.id),
    ]);
    const purgedNames = new Set([
        ...(Array.isArray(raw._meta.purgedConversationNames) ? raw._meta.purgedConversationNames : []),
        ...removed.map((r) => String(r.name)),
    ]);
    raw._meta.purgedConversationIds = [...purgedIds];
    raw._meta.purgedConversationNames = [...purgedNames];
    notes.push(`Purged leftovers: ${removed.map((r) => r.name).join(', ') || '(already gone)'}`);
}

// --- 4) Hamster SFX variants ---
{
    const packs = [
        ['(hamster noises) Do not push your luck', 'Do not push your luck'],
        ['(hamster noises) He says_ likewise, old friend', 'He says likewise, old friend'],
        ['(hamster noises) The hamster is grateful. And he has a word of caution', 'The hamster is grateful. And he has a word of caution'],
        ['(hamster noises) He says_ do not forget where you came from', 'He says do not forget where you came from'],
    ];
    for (const [dir, spoken] of packs) {
        const written = await importHamsterVariants(dir, spoken);
        notes.push(`Hamster variants ${spoken}: ${written.length} takes`);
    }
}

raw._meta.s5FollowupsAt = new Date().toISOString();
raw.conversations = conversations;

let wrote = false;
for (let attempt = 1; attempt <= 5; attempt++) {
    try {
        await fsp.writeFile(CONV, `${JSON.stringify(raw, null, 2)}\n`);
        wrote = true;
        break;
    } catch (err) {
        console.warn(`write attempt ${attempt}:`, err?.code || err?.message);
        await new Promise((r) => setTimeout(r, 400 * attempt));
    }
}
if (!wrote) throw new Error('Failed to write conversations.json');

const assets = await scanTheaterAssets();
await fsp.writeFile(MANIFEST, `${JSON.stringify(assets, null, 2)}\n`);
notes.push(`Manifest refreshed (${assets.voicelines.length} voicelines)`);

console.log(notes.map((n) => `✓ ${n}`).join('\n'));
