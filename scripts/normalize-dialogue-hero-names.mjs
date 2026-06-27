#!/usr/bin/env node
/**
 * Rewrite dialogue line `hero` fields to manifest roster ids (52 heroes).
 * Maps Emperor/Infinite skin names → base hero, then resolves display spellings
 * (e.g. Soldier: 76 → Soldier 76, D.Va → D.va).
 *
 * Usage:
 *   node scripts/normalize-dialogue-hero-names.mjs
 *   node scripts/normalize-dialogue-hero-names.mjs --dry-run
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');

/**
 * @param {string} hero
 * @param {string[]} manifestHeroes
 * @returns {string}
 */
export function canonicalizeDialogueLineHero(hero, manifestHeroes) {
    const text = String(hero || '').trim();
    if (!text || text === 'Unknown') return text;
    return resolveManifestHeroId(text, manifestHeroes) || text;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const manifestHeroes = await loadManifestHeroIds();
    const convRaw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));

    /** @type {Array<{ conversation: string, from: string, to: string, subtitles: string }>} */
    const changes = [];

    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            const from = String(line?.hero || '').trim();
            if (!from || from === 'Unknown') continue;

            const to = canonicalizeDialogueLineHero(from, manifestHeroes);
            if (to === from) continue;

            changes.push({
                conversation: conversation.name || conversation.id,
                from,
                to,
                subtitles: String(line?.subtitles || '').slice(0, 80),
            });
            line.hero = to;
        }

        for (const pathRow of conversation.paths || []) {
            const label = String(pathRow?.label || '').trim();
            if (!label) continue;
            const to = canonicalizeDialogueLineHero(label, manifestHeroes);
            if (to !== label) {
                changes.push({
                    conversation: `${conversation.name || conversation.id} (path label)`,
                    from: label,
                    to,
                    subtitles: '',
                });
                pathRow.label = to;
            }
        }
    }

    console.log(`Hero renames: ${changes.length}`);
    for (const row of changes) {
        console.log(`  [${row.conversation}] ${row.from} → ${row.to}`);
        if (row.subtitles) console.log(`    ${row.subtitles}`);
    }

    if (dryRun) {
        console.log('\n(dry-run — conversations.json not written)');
        return;
    }

    if (changes.length === 0) {
        console.log('\nNo changes needed.');
        return;
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(convRaw, null, 2)}\n`, 'utf8');
    console.log('\nUpdated conversations.json');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
