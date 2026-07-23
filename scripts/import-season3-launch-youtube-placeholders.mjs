#!/usr/bin/env node
/**
 * Import Season 3 launch interaction placeholders from Hammeh YouTube captions.
 *
 * NOTE: This batch is finalized (working tag retired). Prefer not re-running unless
 * re-seeding; new batches should follow the working-tag protocol in
 * dialogueTheaterEraFilter.js.
 *
 * Usage:
 *   node scripts/import-season3-launch-youtube-placeholders.mjs
 *   node scripts/import-season3-launch-youtube-placeholders.mjs --dry-run
 */

import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
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
import { SEASON3_LAUNCH_INTERACTIONS } from './data/season3-launch-hammeh-interactions.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const ERA = 'Season 3 launch (YouTube placeholder)';

function norm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/\[music\]/gi, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function fingerprint(lines) {
    return (lines || [])
        .map((l) => `${norm(l.hero)}|${norm(l.subtitles)}`)
        .filter((part) => !part.endsWith('|'))
        .join('||');
}

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

function pickHeroicRenderForHero(heroName, rendersMap) {
    const list = rendersMap?.[heroName] || [];
    return list.find((name) => /heroic/i.test(name)) || list[0] || 'Heroic.png';
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;
    const manifestHeroes = await loadManifestHeroIds();
    const assets = await scanTheaterAssets();

    const added = [];
    const skipped = [];
    const unknownHeroes = [];

    for (const entry of SEASON3_LAUNCH_INTERACTIONS) {
        const exists = conversations.some((c) => {
            if (fingerprint(c.lines || []) === fingerprint(entry.lines)) return true;
            return overlapsOpening(c, entry);
        });
        if (exists) {
            skipped.push(entry.name);
            continue;
        }

        const conversation = buildBlankConversationRecord();
        conversation.name = String(nextConversationNumber(conversations));
        conversation.status = 'active';
        conversation.eraName = ERA;
        conversation.scene = DEFAULT_DIALOGUE_SCENE;
        conversation.lines = entry.lines.map((line) => {
            const hero = resolveManifestHeroId(line.hero, manifestHeroes) || line.hero;
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

    console.log(`Catalog entries: ${SEASON3_LAUNCH_INTERACTIONS.length}`);
    console.log(`Already present: ${skipped.length}`);
    console.log(`To add: ${added.length}`);
    if (unknownHeroes.length) console.log(`Unknown heroes: ${unknownHeroes.join(', ')}`);
    if (skipped.length) {
        console.log('\n--- Already present ---');
        skipped.forEach((name) => console.log(`  = ${name}`));
    }
    if (added.length) {
        console.log('\n--- Adding ---');
        added.forEach((name) => console.log(`  + ${name}`));
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
