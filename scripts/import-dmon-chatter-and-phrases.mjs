#!/usr/bin/env node
/**
 * Seed D.mon Hero Chatter + gallery Phrases from HeroVoice extract + wiki Quotes.
 *
 * Chatter sources:
 *   - Wiki Set-Up Chatter (when filled)
 *   - MatchStartTalk extract (Match Start lines — wiki cells still empty)
 *
 * Phrases (same categories as import-gallery-hero-phrases.mjs):
 *   - HeroSelect → Selection.ogg
 *   - Voicelines
 *   - Hello / Thanks
 *   - Ultimate (Limit Break)
 *
 * Usage:
 *   node scripts/import-dmon-chatter-and-phrases.mjs
 *   node scripts/import-dmon-chatter-and-phrases.mjs --dry-run
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

const HERO_ID = 'D.mon';
const VOICE_PREFIX = 'D.Mon';
const EXTRACT_FOLDER = 'D.Mon';
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    EXTRACT_FOLDER,
);

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const PHRASES_DIR = path.join(REPO, 'src/assets/audio/Phrases', HERO_ID);
const WIKI_CACHE = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'interactions',
    'overwatch-atlas-audits',
    '_wiki-quotes-cache',
    'D.Mon.wikitext',
);

const dryRun = process.argv.includes('--dry-run');

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ')
        .replace(/\((korean)\)/gi, ' korean ')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * @param {string} label
 */
function cleanLabel(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([?.!,])/g, '$1')
        .trim();
}

/**
 * Extract folder labels → readable subtitles (Korean marker, underscores).
 * @param {string} label
 */
function labelToSubtitles(label) {
    let s = cleanLabel(label);
    s = s.replace(/^\(Korean\)\s*/i, '(Korean) ');
    s = s.replace(/\s+_([^_]+)_\s*/g, ' "$1" ');
    s = s.replace(/^_([^_]+)_\s*/g, '"$1" ');
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} label
 */
function atlasVoiceName(label) {
    const body = cleanLabel(label)
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${VOICE_PREFIX}_-_${body}.ogg`;
}

/**
 * @param {string} category
 * @returns {Array<{ label: string, source: string }>}
 */
function listExtract0B2(category) {
    const dir = path.join(EXTRACT_ROOT, category);
    if (!fs.existsSync(dir)) return [];
    /** @type {Array<{ label: string, source: string }>} */
    const out = [];
    const seen = new Set();
    for (const name of fs.readdirSync(dir)) {
        if (!/\.ogg$/i.test(name) || !/\.0B2-/i.test(name)) continue;
        const m = name.match(/^[^-]+-(.+)\.ogg$/i);
        const label = m ? m[1] : name.replace(/\.ogg$/i, '');
        const key = coreKey(label);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({ label, source: path.join(dir, name) });
    }
    out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
    return out;
}

/**
 * Wiki Set-Up Chatter quotes (filled cells only).
 * @param {string} wikitext
 */
function parseWikiSetupQuotes(wikitext) {
    const sectionMatch = String(wikitext || '').match(
        /==\s*Chatter\s*==([\s\S]*?)(?=\n==\s*[^=]|$)/i,
    );
    if (!sectionMatch) return [];
    const body = sectionMatch[1];
    const rows = body.split(/\n\|-/);
    /** @type {Array<{ spoken: string, key: string }>} */
    const out = [];
    let setupActive = false;

    for (const row of rows) {
        const triggerHits = [...row.matchAll(/'''([^']{2,80})'''/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').trim(),
        );
        for (const hit of triggerHits) {
            if (/set[-\s]?up/i.test(hit) && !/set\s*up\s*here/i.test(hit)) {
                setupActive = true;
            } else if (
                /hero selected|match start|respawn|health|healed|on fire|nano|perk|voted|reinforcement/i.test(
                    hit,
                )
            ) {
                setupActive = false;
            }
        }
        if (!setupActive) continue;

        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/rowspan|colspan|<center|<big|'''/i.test(line) && !/\{\{QuoteTranslation/i.test(line)) {
                continue;
            }
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell || cell.startsWith('{')) continue;
            const spoken = cell
                .replace(/<small>[\s\S]*?<\/small>/gi, ' ')
                .replace(/\{\{[^}]+\}\}/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            if (spoken.length < 3) continue;
            const key = coreKey(spoken);
            if (!key || out.some((q) => q.key === key)) continue;
            out.push({ spoken, key });
        }
    }
    return out;
}

/**
 * @param {string} destRel under Phrases/D.mon
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

/**
 * @param {string} atlasName
 * @param {string} sourceAbs
 */
async function copyTheater(atlasName, sourceAbs) {
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (dryRun) {
        console.log(`  DRY theater ${atlasName}`);
        return atlasName;
    }
    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    if (!fs.existsSync(dest)) {
        await fsp.copyFile(sourceAbs, dest);
    }
    return atlasName;
}

/**
 * Find extract file whose label matches spoken text.
 * @param {Array<{ label: string, source: string }>} pool
 * @param {string} spoken
 */
function findInPool(pool, spoken) {
    const want = coreKey(spoken);
    if (!want) return null;
    let hit = pool.find((r) => coreKey(r.label) === want);
    if (hit) return hit;
    hit = pool.find((r) => {
        const k = coreKey(r.label);
        return k && (k.startsWith(want) || want.startsWith(k)) && Math.min(k.length, want.length) >= 12;
    });
    return hit || null;
}

async function main() {
    if (!fs.existsSync(EXTRACT_ROOT)) {
        console.error(`Extract missing: ${EXTRACT_ROOT}`);
        process.exit(1);
    }

    const wikitext = fs.existsSync(WIKI_CACHE) ? fs.readFileSync(WIKI_CACHE, 'utf8') : '';
    const wikiSetup = parseWikiSetupQuotes(wikitext);
    const matchStart = listExtract0B2('MatchStartTalk');
    const matchTalk = listExtract0B2('MatchTalk');

    console.log(`Wiki Set-Up quotes: ${wikiSetup.length}`);
    console.log(`MatchStartTalk files: ${matchStart.length}`);

    /** @type {object[]} */
    const chatterLines = [];
    /** @type {Set<string>} */
    const usedKeys = new Set();

    async function pushChatter(spoken, sourceHint) {
        const key = coreKey(spoken);
        if (!key || usedKeys.has(key)) return;
        usedKeys.add(key);

        const hit =
            (sourceHint && findInPool([sourceHint], spoken)) ||
            findInPool(matchStart, spoken) ||
            findInPool(matchTalk, spoken);

        let voice = '';
        if (hit) {
            voice = atlasVoiceName(hit.label);
            await copyTheater(voice, hit.source);
        } else {
            voice = atlasVoiceName(spoken);
            console.warn(`  No extract audio for chatter: ${spoken}`);
        }

        chatterLines.push({
            id: randomUUID(),
            hero: HERO_ID,
            voice,
            voicePrefix: '',
            subtitles: labelToSubtitles(spoken),
            render: 'Heroic.png',
            era: 'Overwatch',
            status: 'active',
        });
    }

    // Match Start first (pre-match banter), then Set-Up
    for (const row of matchStart) {
        await pushChatter(row.label, row);
    }
    for (const q of wikiSetup) {
        await pushChatter(q.spoken, null);
    }
    // Ensure Stretch line is present even if wiki punctuation differs
    const stretch = matchTalk.find((r) => /stretch.*hydrate.*dominate/i.test(r.label));
    if (stretch) await pushChatter(stretch.label, stretch);

    console.log(`Chatter lines: ${chatterLines.length}`);

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
    let selectionSource = heroSelect[0]?.source || '';
    if (heroSelect.length) {
        for (const row of heroSelect) {
            const baseName = `${cleanLabel(row.label).replace(/[\\/:*?"<>|]/g, '')}.ogg`;
            await copyPhrase(baseName, row.source);
            phraseFiles.push(baseName);
            // Also keep theater copy for selected
            await copyTheater(atlasVoiceName(row.label), row.source);
        }
        if (selectionSource) {
            await copyPhrase('Selection.ogg', selectionSource);
            // Selection is also listed in manifest via generate-manifest folder scan
        }
    }

    const nVoice = await addPhraseCategory('Voicelines');
    const nHello = await addPhraseCategory('Hello');
    const nThanks = await addPhraseCategory('Thanks');
    const nUlt = await addPhraseCategory('Ultimate', 'Ultimate');

    console.log(
        `Phrases: select=${heroSelect.length} voice=${nVoice} hello=${nHello} thanks=${nThanks} ult=${nUlt}`,
    );

    if (dryRun) {
        console.log('\nDry run — conversations/manifest not written.');
        console.log('Chatter preview:');
        chatterLines.forEach((l) => console.log(' -', l.subtitles));
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
    row.lines = chatterLines;
    delete row.paths;
    delete row.selectedPathId;

    conversationsData._meta = conversationsData._meta || {};
    conversationsData._meta.dmonChatterPhrasesAt = new Date().toISOString();

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(conversationsData, null, 2)}\n`, 'utf8');
    await scanTheaterAssets();

    console.log(`\nWrote chatter ${chatterId} (${chatterLines.length} lines)`);
    console.log(`Phrases dir: ${PHRASES_DIR}`);
    console.log('Next: node scripts/generate-manifest.js');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
