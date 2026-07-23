#!/usr/bin/env node
/**
 * Import Midseason 3 interaction placeholders from Hammeh YouTube caption scrape.
 *
 * NOTE: This batch is finalized (working tag retired). Prefer not re-running unless
 * re-seeding; new batches should follow:
 *   1) import with a temporary working tag
 *   2) wire wiki / MatchTalk audio
 *   3) manually rename + fix inconsistencies
 *   4) clear the tag and move it to DIALOGUE_THEATER_RETIRED_WORKING_TAGS
 *
 * Usage:
 *   node scripts/import-midseason3-youtube-placeholders.mjs
 *   node scripts/import-midseason3-youtube-placeholders.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { resolveLineVoiceFile } from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';
import { MIDSEASON3_INTERACTIONS } from './data/midseason3-hammeh-interactions.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);

/**
 * @param {string} value
 */
function norm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/\[music\]/gi, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * @param {Array<{ hero?: string, subtitles?: string }>} lines
 */
function fingerprint(lines) {
    return (lines || [])
        .map((l) => `${norm(l.hero)}|${norm(l.subtitles)}`)
        .filter((part) => !part.endsWith('|'))
        .join('||');
}

/**
 * Looser match: shared opening line text.
 * @param {object} conversation
 * @param {{ lines: Array<{ subtitles: string }> }} entry
 */
function overlapsOpening(conversation, entry) {
    const opening = norm(entry.lines?.[0]?.subtitles || '');
    if (opening.length < 24) return false;
    const needle = opening.slice(0, 56);
    return (conversation.lines || []).some((l) => {
        const text = norm(l.subtitles);
        if (text.length < 24) return false;
        return text.includes(needle) || (needle.length >= 24 && needle.includes(text.slice(0, 56)));
    });
}

/**
 * @param {string} heroName
 * @param {Record<string, string[]>} rendersMap
 */
function pickHeroicRenderForHero(heroName, rendersMap) {
    const list = rendersMap?.[heroName] || [];
    const heroic = list.find((name) => /heroic/i.test(name));
    return heroic || list[0] || 'Heroic.png';
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;
    const manifestHeroes = await loadManifestHeroIds();
    const assets = await scanTheaterAssets();

    /** @type {string[]} */
    const added = [];
    /** @type {string[]} */
    const skipped = [];
    /** @type {string[]} */
    const unknownHeroes = [];

    for (const entry of MIDSEASON3_INTERACTIONS) {
        const fp = fingerprint(entry.lines);
        const exists = conversations.some((c) => {
            if (fingerprint(c.lines || []) === fp) return true;
            return overlapsOpening(c, entry);
        });
        if (exists) {
            skipped.push(entry.name);
            continue;
        }

        const conversation = buildBlankConversationRecord();
        conversation.name = String(nextConversationNumber(conversations));
        conversation.status = 'active';
        conversation.eraName = 'Midseason 3 (YouTube placeholder)';
        conversation.scene = DEFAULT_DIALOGUE_SCENE;

        conversation.lines = entry.lines.map((line) => {
            let hero = resolveManifestHeroId(line.hero, manifestHeroes) || line.hero;
            if (!manifestHeroes.includes(hero) && !unknownHeroes.includes(line.hero)) {
                unknownHeroes.push(line.hero);
            }
            const subtitles = String(line.subtitles || '').trim();
            const voice = resolveLineVoiceFile({ hero, subtitles }, assets.voicelines) || '';
            return {
                id: createDialogueLineId(),
                hero,
                voice,
                voicePrefix: '',
                subtitles,
                render: pickHeroicRenderForHero(hero, assets.rendersMap || {}),
            };
        });

        conversations.push(conversation);
        added.push(`${conversation.name} (${entry.name})`);
    }

    console.log(`Catalog entries: ${MIDSEASON3_INTERACTIONS.length}`);
    console.log(`Already present: ${skipped.length}`);
    console.log(`To add: ${added.length}`);
    if (unknownHeroes.length) {
        console.log(`Hero names not in manifest (kept as-is): ${unknownHeroes.join(', ')}`);
    }
    if (added.length) {
        console.log('\n--- Adding ---');
        added.forEach((name) => console.log(`  + ${name}`));
    }
    if (skipped.length && skipped.length <= 20) {
        console.log('\n--- Skipped (already in theater) ---');
        skipped.forEach((name) => console.log(`  = ${name}`));
    } else if (skipped.length) {
        console.log(`\n--- Skipped ${skipped.length} already present ---`);
    }

    if (dryRun) {
        console.log('\n(dry-run — no write)');
        return;
    }

    const payload = Array.isArray(raw.conversations) ? { ...raw, conversations } : conversations;
    await fs.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`\nUpdated ${CONVERSATIONS_PATH}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
