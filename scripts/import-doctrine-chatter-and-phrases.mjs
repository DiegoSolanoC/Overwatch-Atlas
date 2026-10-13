#!/usr/bin/env node
/**
 * Seed Doctrine Hero Chatter + gallery Phrases from HeroVoice extract.
 *
 * Wiki Quotes page is still barren for Chatter / Eliminations, so categories are
 * filled from extract folders with the same disclaimer strings other heroes use
 * (so chatterCategoryFilter classifies correctly).
 *
 * Usage:
 *   node scripts/import-doctrine-chatter-and-phrases.mjs --dry-run
 *   node scripts/import-doctrine-chatter-and-phrases.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chatterIdForHero } from '../src/features/dialogue-theater/data/dialogueTheaterEntryType.js';
import { DEFAULT_DIALOGUE_SCENE } from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');

const HERO_ID = 'Doctrine';
const VOICE_PREFIX = 'Doctrine';
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    HERO_ID,
);

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const PHRASES_DIR = path.join(REPO, 'src/assets/audio/Phrases', HERO_ID);

const dryRun = process.argv.includes('--dry-run');

/** Extract relative folder → wiki-shaped disclaimer (or '' = Set Up). */
const CHATTER_SOURCES = [
    { folder: 'MatchStartTalk', disclaimer: 'Match Start' },
    { folder: 'SetupHere', disclaimer: '' },
    { folder: 'HeroSelect', disclaimer: 'Hero Selected' },
    { folder: 'Match/MatchStartRoundWin', disclaimer: 'Won Previous Round' },
    { folder: 'Match/MatchStartRoundLoss', disclaimer: 'Lost Previous Round' },
    { folder: 'Match/MatchStartFinalRound', disclaimer: 'Final Round' },
    { folder: 'Respawn', disclaimer: 'Respawn' },
    { folder: 'NanoBoosted', disclaimer: 'Nano Boosted' },
    { folder: 'OnFire', disclaimer: 'On Fire' },
    { folder: 'HealthPack', disclaimer: 'Health Pack' },
    { folder: 'DamageBoosted', disclaimer: 'Damage Boosted' },
    { folder: 'HealthRestoredFriendly', disclaimer: 'Fully Healed' },
    { folder: 'Resurrected', disclaimer: 'Resurrected' },
    { folder: 'EnemyResurrect', disclaimer: 'Enemy Resurrected' },
    { folder: 'VotedEpic', disclaimer: 'Voted Epic' },
    { folder: 'VotedLegendary', disclaimer: 'Voted Legendary' },
    { folder: 'Discorded', disclaimer: 'Negative Status' },
    { folder: 'Elimination', disclaimer: 'Elimination — Final Blow' },
    { folder: 'KillStreak', disclaimer: 'Elimination — Kill Streak' },
    { folder: 'Multikill', disclaimer: 'Elimination — Multi Kill' },
    { folder: 'TeamKill', disclaimer: 'Elimination — Team Kill' },
    { folder: 'Revenge', disclaimer: 'Elimination — Revenge' },
    { folder: 'MeleeEnemyKilledRemark', disclaimer: 'Elimination — Melee Final Blow' },
    { folder: 'Turret/EnemyTurretDestroyed', disclaimer: 'Elimination — Deployable Eliminated' },
    { folder: 'Teleporter/EnemyTeleporterDestroyed', disclaimer: 'Elimination — Deployable Eliminated' },
    { folder: 'ShieldGenerator/EnemyShieldGenDestroyed', disclaimer: 'Elimination — Deployable Eliminated' },
    { folder: 'Teammate/KillSeen', disclaimer: 'Elimination — Final Blow Compliment' },
    { folder: 'LookingAtEarth', disclaimer: 'Looking At Earth' },
];

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\((shona|korean|japanese|french|spanish|chinese|mandarin)\)/gi, ' $1 ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

function cleanLabel(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
}

function labelToSubtitles(label) {
    let s = cleanLabel(label);
    s = s.replace(/^\(Shona\)\s*/i, '(Shona) ');
    s = s.replace(/\s+_([^_]+)_\s*/g, ' "$1" ');
    s = s.replace(/^_([^_]+)_\s*/g, '"$1" ');
    return s.replace(/\s+/g, ' ').trim();
}

function atlasVoiceName(label) {
    const body = cleanLabel(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${VOICE_PREFIX}_-_${body}.ogg`;
}

/**
 * List labeled .0B2 clips under a category folder (recursive).
 * @param {string} relFolder
 * @returns {Array<{ label: string, source: string }>}
 */
function listExtract0B2(relFolder) {
    const dir = path.join(EXTRACT_ROOT, ...relFolder.split('/'));
    if (!fs.existsSync(dir)) return [];

    /** @type {Array<{ label: string, source: string }>} */
    const out = [];
    /** @type {Set<string>} */
    const seen = new Set();

    /** @param {string} abs */
    function walk(abs) {
        for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
            const full = path.join(abs, ent.name);
            if (ent.isDirectory()) {
                walk(full);
                continue;
            }
            if (!/\.ogg$/i.test(ent.name) || !/\.0B2-/i.test(ent.name)) continue;
            const m = ent.name.match(/\.0B2-(.+)\.ogg$/i);
            const label = m ? m[1] : ent.name.replace(/\.ogg$/i, '');
            const key = coreKey(label);
            if (!key || seen.has(key)) continue;
            // Skip pure exertion / breath SFX for chatter (keep spoken lines).
            if (/^\((pained breathing|sighs in relief|gasps|exert|grunts?|shouts?)\)$/i.test(cleanLabel(label))) {
                continue;
            }
            seen.add(key);
            out.push({ label, source: full });
        }
    }

    walk(dir);
    out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return out;
}

/**
 * @param {string} atlasName
 * @param {string} sourceAbs
 */
async function copyTheater(atlasName, sourceAbs) {
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (dryRun) return atlasName;
    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    if (!fs.existsSync(dest)) {
        await fsp.copyFile(sourceAbs, dest);
    }
    return atlasName;
}

/**
 * @param {string} destRel
 * @param {string} sourceAbs
 */
async function copyPhrase(destRel, sourceAbs) {
    const dest = path.join(PHRASES_DIR, ...destRel.split('/'));
    if (dryRun) {
        console.log(`  DRY phrase ${destRel}`);
        return destRel;
    }
    await fsp.mkdir(path.dirname(dest), { recursive: true });
    await fsp.copyFile(sourceAbs, dest);
    return destRel;
}

async function main() {
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error(`Extract missing: ${EXTRACT_ROOT}`);
        process.exit(1);
    }

    /** @type {object[]} */
    const chatterLines = [];
    /** @type {Set<string>} */
    const usedKeys = new Set();
    /** @type {Map<string, number>} */
    const byDisclaimer = new Map();

    for (const src of CHATTER_SOURCES) {
        const clips = listExtract0B2(src.folder);
        let added = 0;
        for (const clip of clips) {
            const key = `${src.disclaimer}::${coreKey(clip.label)}`;
            if (!coreKey(clip.label) || usedKeys.has(key)) continue;
            usedKeys.add(key);

            const voice = atlasVoiceName(clip.label);
            await copyTheater(voice, clip.source);

            /** @type {Record<string, unknown>} */
            const line = {
                id: randomUUID(),
                hero: HERO_ID,
                voice,
                voicePrefix: '',
                subtitles: labelToSubtitles(clip.label),
                render: 'Heroic.png',
                era: 'Overwatch',
                status: 'active',
            };
            if (src.disclaimer) line.disclaimer = src.disclaimer;
            chatterLines.push(line);
            added += 1;
            const bucket = src.disclaimer || '(Set Up)';
            byDisclaimer.set(bucket, (byDisclaimer.get(bucket) || 0) + 1);
        }
        console.log(`${src.folder}: ${clips.length} clips → +${added} (${src.disclaimer || 'Set Up'})`);
    }

    console.log(`\nChatter lines total: ${chatterLines.length}`);
    for (const [k, v] of [...byDisclaimer.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${v}\t${k}`);
    }

    // --- Gallery phrases ---
    /** @type {string[]} */
    const phraseFiles = [];
    if (!dryRun) {
        await fsp.rm(PHRASES_DIR, { recursive: true, force: true });
        await fsp.mkdir(PHRASES_DIR, { recursive: true });
    }

    async function addPhraseCategory(category, destFolder = '') {
        const rows = listExtract0B2(category);
        for (const row of rows) {
            const baseName = `${cleanLabel(row.label).replace(/[\\/:*?"<>|]/g, '')}.ogg`;
            const rel = destFolder ? `${destFolder}/${baseName}` : baseName;
            await copyPhrase(rel, row.source);
            phraseFiles.push(rel.replace(/\\/g, '/'));
        }
        return rows.length;
    }

    const heroSelect = listExtract0B2('HeroSelect');
    for (const row of heroSelect) {
        const baseName = `${cleanLabel(row.label).replace(/[\\/:*?"<>|]/g, '')}.ogg`;
        await copyPhrase(baseName, row.source);
        phraseFiles.push(baseName);
        await copyTheater(atlasVoiceName(row.label), row.source);
        await copyPhrase('Selection.ogg', row.source);
    }

    const nVoice = await addPhraseCategory('Voicelines');
    const nHello = await addPhraseCategory('Hello');
    const nThanks = await addPhraseCategory('Thanks');
    const nUlt = await addPhraseCategory('Ultimate', 'Ultimate');

    console.log(
        `\nPhrases: select=${heroSelect.length} voice=${nVoice} hello=${nHello} thanks=${nThanks} ult=${nUlt}`,
    );

    if (dryRun) {
        console.log('\nDry run — conversations/manifest not written.');
        return;
    }

    const conversationsData = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
    const chatterId = chatterIdForHero(HERO_ID);
    let row = conversationsData.conversations.find((c) => c.id === chatterId);
    if (!row) {
        row = {
            id: chatterId,
            entryType: 'chatter',
            name: HERO_ID,
            status: 'active',
            eraName: '',
            tags: [],
            scene: DEFAULT_DIALOGUE_SCENE,
            lines: [],
        };
        conversationsData.conversations.push(row);
    }
    row.entryType = 'chatter';
    row.name = HERO_ID;
    row.status = 'active';
    row.scene = row.scene || DEFAULT_DIALOGUE_SCENE;
    row.tags = Array.isArray(row.tags) ? row.tags : [];
    // Keep map / non-extract disclaimers (e.g. Watchpoint: Grímsvötn) from prior imports.
    const importedDisclaimerSet = new Set(CHATTER_SOURCES.map((s) => s.disclaimer));
    const preserved = (Array.isArray(row.lines) ? row.lines : []).filter((line) => {
        const d = line && typeof line.disclaimer === 'string' ? line.disclaimer : '';
        if (!d) return false;
        if (importedDisclaimerSet.has(d)) return false;
        return true;
    });
    row.lines = [...chatterLines, ...preserved];
    delete row.paths;
    delete row.selectedPathId;

    conversationsData._meta = conversationsData._meta || {};
    conversationsData._meta.doctrineChatterPhrasesAt = new Date().toISOString();

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(conversationsData, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`\nWrote chatter ${chatterId} (${chatterLines.length} lines)`);
    console.log(`Phrases dir: ${PHRASES_DIR}`);
    console.log(`Theater voicelines: ${assets.voicelines.length}`);
    console.log('Next: node scripts/generate-manifest.js');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
