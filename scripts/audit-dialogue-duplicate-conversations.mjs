#!/usr/bin/env node
/**
 * Report Dialogue Theater conversations that share the same voiceline fingerprint.
 *
 * Usage:
 *   node scripts/audit-dialogue-duplicate-conversations.mjs
 *   node scripts/audit-dialogue-duplicate-conversations.mjs --json path/to/conversations.json
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { conversationVoiceFingerprint } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_JSON = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    let jsonPath = DEFAULT_JSON;
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--json' && argv[i + 1]) {
            jsonPath = path.resolve(argv[i + 1]);
            i += 1;
        }
    }
    return { jsonPath };
}

async function main() {
    const { jsonPath } = parseArgs(process.argv.slice(2));
    const raw = JSON.parse(await fs.readFile(jsonPath, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];

    /** @type {Map<string, Array<{ id: string, name: string }>>} */
    const groups = new Map();

    for (const row of conversations) {
        const fingerprint = conversationVoiceFingerprint(row?.lines || []);
        if (!fingerprint) continue;

        const bucket = groups.get(fingerprint) || [];
        bucket.push({
            id: String(row?.id || ''),
            name: String(row?.name || 'Untitled conversation'),
        });
        groups.set(fingerprint, bucket);
    }

    const duplicateGroups = [...groups.values()].filter((group) => group.length > 1);
    const duplicateEntries = duplicateGroups.reduce((sum, group) => sum + group.length, 0);

    console.log(`Scanned ${conversations.length} conversations in ${jsonPath}`);
    console.log(`Duplicate groups: ${duplicateGroups.length}`);
    console.log(`Duplicate entries: ${duplicateEntries}`);

    if (duplicateGroups.length === 0) {
        console.log('No duplicate voiceline sets found.');
        return;
    }

    console.log('');
    for (let i = 0; i < duplicateGroups.length; i += 1) {
        const group = duplicateGroups[i];
        console.log(`Group ${i + 1} (${group.length} entries):`);
        for (const entry of group) {
            console.log(`  - ${entry.name} (${entry.id})`);
        }
        console.log('');
    }

    process.exitCode = 1;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
