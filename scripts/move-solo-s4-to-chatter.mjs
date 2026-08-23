#!/usr/bin/env node
/**
 * Fix Season 4 leftovers mis-filed as solo dialogue entries:
 *   - Move single-hero #514–#548 (except multi-hero) into Hero Chatter hubs
 *   - Wire Wrecking Ball "champion will claim this city" with hamster .03F prefixes
 *   - Delete the emptied numbered dialogue shells
 *
 * Usage:
 *   node scripts/move-solo-s4-to-chatter.mjs --dry-run
 *   node scripts/move-solo-s4-to-chatter.mjs
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialogueLineId } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
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

const dryRun = process.argv.includes('--dry-run');
const ERA = 'Overwatch';

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function heroesOf(conv) {
    return [...new Set((conv.lines || []).map((l) => l.hero).filter(Boolean))];
}

async function copyFile(src, destName) {
    const dest = path.join(VOICELINES_DIR, destName);
    if (!dryRun) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        if (!fs.existsSync(dest)) await fsp.copyFile(src, dest);
    }
    return destName;
}

/**
 * Wire WB champion: .03F hamster variants as voicePrefix pool + translator voice.
 */
async function wireWreckingBallChampion() {
    const mt = path.join(EXTRACT_ROOT, 'Wrecking Ball', 'MatchTalk');
    const hamsterDir = path.join(
        mt,
        '(hamster noises) The champion will claim this city as his prize',
    );
    const translatorSrc = path.join(
        mt,
        '00000006B8E2.0B2-(hamster noises) The champion will claim this city as his prize.ogg',
    );
    if (!fs.existsSync(translatorSrc)) throw new Error('Missing WB champion 0B2');
    if (!fs.existsSync(hamsterDir)) throw new Error('Missing WB champion hamster folder');

    const translatorVoice = 'Wrecking_Ball_-_The_champion_will_claim_this_city_as_his_prize.ogg';
    await copyFile(translatorSrc, translatorVoice);

    const takes = fs
        .readdirSync(hamsterDir)
        .filter((f) => /\.03F\.ogg$/i.test(f))
        .sort();
    if (!takes.length) throw new Error('No .03F hamster takes');

    /** @type {string[]} */
    const prefixes = [];
    for (let i = 0; i < takes.length; i += 1) {
        const suffix = i === 0 ? '' : `_(${i + 1})`;
        const name = `Wrecking_Ball_-_(hamster_noises)_The_champion_will_claim_this_city_as_his_prize${suffix}.ogg`;
        await copyFile(path.join(hamsterDir, takes[i]), name);
        prefixes.push(name);
    }

    return {
        voice: translatorVoice,
        voicePrefix: prefixes[0],
        subtitles: '*(hamster noises)* The champion will claim this city as his prize.',
        prefixCount: prefixes.length,
    };
}

function ensureChatter(conversations, hero) {
    const id = chatterIdForHero(hero);
    let chatter = conversations.find((c) => c.id === id || (c.entryType === 'chatter' && c.name === hero));
    if (!chatter) {
        chatter = {
            id,
            entryType: 'chatter',
            name: hero,
            status: 'active',
            eraName: '',
            tags: [],
            scene: 'Default.png',
            lines: [],
        };
        conversations.push(chatter);
    }
    if (!Array.isArray(chatter.lines)) chatter.lines = [];
    return chatter;
}

function chatterHasLine(chatter, subtitles, voice) {
    const ck = coreKey(subtitles);
    const vk = coreKey(String(voice || '').replace(/\.ogg$/i, '').replace(/_/g, ' '));
    return (chatter.lines || []).some((l) => {
        const lck = coreKey(l.subtitles || '');
        if (ck && lck && lck === ck) return true;
        if (voice && l.voice === voice) return true;
        if (vk && coreKey(String(l.voice || '').replace(/\.ogg$/i, '').replace(/_/g, ' ')) === vk) return true;
        return false;
    });
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : [];

    const wbWire = await wireWreckingBallChampion();
    console.log(`WB champion: translator + ${wbWire.prefixCount} hamster prefix takes`);

    /** @type {string[]} */
    const removedNames = [];
    let movedLines = 0;

    const numbered = conversations.filter((c) => {
        const n = String(c.name || '');
        if (!/^\d+$/.test(n)) return false;
        const num = +n;
        return num >= 514 && num <= 548;
    });

    for (const conv of numbered) {
        const heroes = heroesOf(conv);
        if (heroes.length !== 1) {
            console.log(`keep dialogue #${conv.name} (multi: ${heroes.join('+')})`);
            continue;
        }
        const hero = heroes[0];
        const chatter = ensureChatter(conversations, hero);

        for (const line of conv.lines || []) {
            let voice = line.voice || '';
            let voicePrefix = line.voicePrefix || '';
            let subtitles = line.subtitles || '';

            if (/champion will claim/i.test(subtitles) || /champion_will_claim/i.test(voice)) {
                voice = wbWire.voice;
                voicePrefix = wbWire.voicePrefix;
                subtitles = wbWire.subtitles;
            }

            if (chatterHasLine(chatter, subtitles, voice)) {
                console.log(`  skip dup in ${hero} chatter: ${subtitles.slice(0, 50)}`);
                continue;
            }

            chatter.lines.push({
                id: createDialogueLineId(),
                hero,
                voice,
                voicePrefix,
                subtitles,
                render: line.render || 'Heroic.png',
                era: line.era || ERA,
                status: 'active',
                ...(line.disclaimer ? { disclaimer: line.disclaimer } : {}),
            });
            movedLines += 1;
            console.log(`  → ${hero} chatter: ${subtitles.slice(0, 60)}`);
        }

        removedNames.push(String(conv.name));
    }

    // Drop moved numbered shells
    raw.conversations = conversations.filter((c) => !removedNames.includes(String(c.name)));

    // Favorite Animals empty stubs — report only (no extract audio found for Emre/WB answers)
    const fav = raw.conversations.find((c) => c.name === 'Favorite Animals');
    if (fav) {
        for (const l of fav.lines || []) {
            if ((l.hero === 'Emre' || l.hero === 'Wrecking Ball') && !l.voice && !l.subtitles) {
                console.log(
                    `Favorite Animals: ${l.hero} path exists but still has no subtitle/audio in extract (left as stub).`,
                );
            }
        }
    }

    console.log(`\nMoved ${movedLines} lines; removed numbered: ${removedNames.join(', ')}`);

    if (dryRun) {
        console.log('Dry run — no writes.');
        return;
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Wrote conversations + theater manifest (${assets.voicelines?.length ?? 0} voicelines).`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
