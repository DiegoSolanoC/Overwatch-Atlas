#!/usr/bin/env node
/**
 * Set Heroic.png on every dialogue line whose hero has a Heroic render on disk.
 *
 * Usage:
 *   node scripts/backfill-heroic-renders.mjs
 *   node scripts/backfill-heroic-renders.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    pickHeroicRenderForHero,
    shouldUpgradeDialogueLineRender,
} from '../src/features/dialogue-theater/data/loadDialogueTheaterAssets.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    return { dryRun: argv.includes('--dry-run') };
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {Record<string, string[]>} rendersMap
 */
function backfillHeroicRenders(conversations, rendersMap) {
    /** @type {Map<string, number>} */
    const updatedByHero = new Map();
    let updatedLines = 0;
    let alreadyHeroic = 0;
    let stillMissing = 0;

    for (const conversation of conversations) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        for (const line of lines) {
            const hero = String(line?.hero || '').trim();
            if (!hero) continue;

            const heroic = pickHeroicRenderForHero(hero, rendersMap);
            const current = String(line?.render || '').trim();

            if (current.toLowerCase() === 'heroic.png') {
                alreadyHeroic += 1;
                continue;
            }

            if (!heroic) {
                stillMissing += 1;
                continue;
            }

            if (!shouldUpgradeDialogueLineRender(current, heroic)) continue;

            line.render = heroic;
            updatedLines += 1;
            updatedByHero.set(hero, (updatedByHero.get(hero) || 0) + 1);
        }
    }

    return { updatedLines, alreadyHeroic, stillMissing, updatedByHero };
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const assets = await scanTheaterAssets();
    const rendersMap = assets.renders || {};

    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];

    const result = backfillHeroicRenders(conversations, rendersMap);

    console.log(`Render folders: ${Object.keys(rendersMap).length}`);
    console.log(`Already Heroic.png: ${result.alreadyHeroic}`);
    console.log(`Updated to Heroic.png: ${result.updatedLines}`);
    console.log(`Still missing (no render folder): ${result.stillMissing}`);

    const top = [...result.updatedByHero.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
    if (top.length > 0) {
        console.log('Top heroes updated:');
        for (const [hero, count] of top) {
            console.log(`  ${hero}: ${count}`);
        }
    }

    if (opts.dryRun) {
        console.log('Dry run — no files written.');
        return;
    }

    await fs.writeFile(
        CONVERSATIONS_PATH,
        `${JSON.stringify({ conversations }, null, 2)}\n`,
        'utf8',
    );
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Updated: ${CONVERSATIONS_PATH}`);
    console.log(`Updated: ${MANIFEST_PATH}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
