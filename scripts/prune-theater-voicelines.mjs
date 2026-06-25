#!/usr/bin/env node
/**
 * Remove theater voiceline files not referenced by conversations.json.
 *
 * Usage:
 *   node scripts/prune-theater-voicelines.mjs --dry-run
 *   node scripts/prune-theater-voicelines.mjs
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = path.join(REPO, 'src/data/dialogue-theater/conversations.json');
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');

const dryRun = process.argv.includes('--dry-run');

const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
/** @type {Set<string>} */
const referenced = new Set();
for (const conversation of raw.conversations || []) {
    for (const line of conversation.lines || []) {
        const voice = String(line?.voice || '').trim();
        if (voice) referenced.add(voice);
        const prefix = String(line?.voicePrefix || '').trim();
        if (prefix) referenced.add(prefix);
    }
}

const onDisk = await fs.readdir(VOICELINES_DIR);
/** @type {string[]} */
const orphans = onDisk.filter((name) => /\.ogg$/i.test(name) && !referenced.has(name));

console.log(`Referenced voicelines: ${referenced.size}`);
console.log(`Files on disk: ${onDisk.length}`);
console.log(`Orphans to remove: ${orphans.length}`);

if (!dryRun) {
    for (const name of orphans) {
        await fs.unlink(path.join(VOICELINES_DIR, name));
    }
    const assets = await scanTheaterAssets();
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Removed ${orphans.length} file(s); refreshed manifest (${assets.voicelines?.length || 0} entries)`);
} else {
    console.log('\n(dry-run — sample orphans)');
    orphans.slice(0, 20).forEach((name) => console.log(`  ${name}`));
    if (orphans.length > 20) console.log(`  ... and ${orphans.length - 20} more`);
}
