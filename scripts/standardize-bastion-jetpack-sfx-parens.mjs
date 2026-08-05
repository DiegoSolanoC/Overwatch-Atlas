#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Standardize Bastion + Jetpack Cat SFX-only subtitles to language-style parentheses:
 *   **proud beeps** / *(sheepish beeps)* / *reverent beeping*  →  (proud beeps)
 *
 * Leaves literal onomatopoeia like "Meow meow!" unchanged.
 *
 * Usage:
 *   node scripts/standardize-bastion-jetpack-sfx-parens.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS_PATH = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');
const OUT_REPORT = auditPath('_audit-bastion-jetpack-sfx-parens.json');

const TARGET_HEROES = new Set(['Bastion', 'Jetpack Cat']);

/**
 * @param {string} sub
 * @returns {string|null} standardized or null if unchanged / not applicable
 */
function standardizeSfxOnlySubtitle(sub) {
    const raw = String(sub || '').trim();
    if (!raw) return null;

    // Already language-style parens only
    if (/^\([^)]+\)$/.test(raw)) return null;

    // **description**
    let m = raw.match(/^\*\*\s*([^*]+?)\s*\*\*$/);
    if (m) return `(${m[1].trim()})`;

    // *(description)*
    m = raw.match(/^\*\s*\(\s*([^)]+?)\s*\)\s*\*$/);
    if (m) return `(${m[1].trim()})`;

    // *description*  (no inner parens)
    m = raw.match(/^\*\s*([^*]+?)\s*\*$/);
    if (m) return `(${m[1].trim()})`;

    // (description) with leftover italic/bold crumbs
    m = raw.match(/^\*+\s*\(\s*([^)]+?)\s*\)\s*\*+$/);
    if (m) return `(${m[1].trim()})`;

    return null;
}

const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const changes = [];

for (const conv of data.conversations || []) {
    for (const line of conv.lines || []) {
        const hero = String(line.hero || '').trim();
        if (!TARGET_HEROES.has(hero)) continue;
        const before = String(line.subtitles || '');
        const next = standardizeSfxOnlySubtitle(before);
        if (!next || next === before) continue;
        line.subtitles = next;
        changes.push({
            conversation: conv.name,
            hero,
            before,
            after: next,
            voice: String(line.voice || ''),
        });
    }
}

if (!data._meta) data._meta = {};
data._meta.tagsResetAt = new Date().toISOString();

fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(data, null, 2) + '\n');
fs.writeFileSync(
    OUT_REPORT,
    JSON.stringify(
        {
            generatedAt: new Date().toISOString(),
            changeCount: changes.length,
            changes,
        },
        null,
        2,
    ) + '\n',
);

console.log(`Updated ${changes.length} Bastion/Jetpack Cat subtitles`);
for (const row of changes.slice(0, 25)) {
    console.log(`- ${row.hero} / ${row.conversation}`);
    console.log(`  ${JSON.stringify(row.before)} → ${JSON.stringify(row.after)}`);
}
if (changes.length > 25) console.log(`… +${changes.length - 25} more`);
console.log(`Wrote ${OUT_REPORT}`);
