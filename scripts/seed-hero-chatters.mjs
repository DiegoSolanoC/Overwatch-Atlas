/**
 * Seed one empty Hero Chatter entry per manifest hero into conversations.json.
 * Usage: node scripts/seed-hero-chatters.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'src/data/platform/manifest.json');
const conversationsPath = path.join(root, 'src/data/dialogue-theater/conversations.json');

const DEFAULT_SCENE = 'Default.png';

/**
 * @param {string} heroName
 * @returns {string}
 */
function chatterIdForHero(heroName) {
    const slug = String(heroName || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug ? `chatter-${slug}` : `chatter-${Date.now()}`;
}

/**
 * @param {string} heroName
 */
function buildBlankChatter(heroName) {
    const hero = String(heroName || '').trim();
    return {
        id: chatterIdForHero(hero),
        entryType: 'chatter',
        name: hero,
        status: 'active',
        eraName: '',
        tags: [],
        scene: DEFAULT_SCENE,
        lines: [
            {
                id: randomUUID(),
                hero,
                voice: '',
                voicePrefix: '',
                subtitles: '',
                render: 'Heroic.png',
            },
        ],
    };
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const heroes = Array.isArray(manifest.heroes) ? manifest.heroes : [];
if (heroes.length === 0) {
    console.error('No heroes in manifest.json');
    process.exit(1);
}

const data = JSON.parse(fs.readFileSync(conversationsPath, 'utf8'));
if (!Array.isArray(data.conversations)) {
    console.error('conversations.json missing conversations array');
    process.exit(1);
}

const existingIds = new Set(data.conversations.map((row) => String(row?.id || '')));
const existingChatterHeroes = new Set(
    data.conversations
        .filter((row) => String(row?.entryType || '').toLowerCase() === 'chatter')
        .map((row) => String(row?.name || '').trim().toLowerCase()),
);

/** @type {object[]} */
const added = [];
for (const hero of heroes) {
    const name = String(hero || '').trim();
    if (!name) continue;
    if (existingChatterHeroes.has(name.toLowerCase())) continue;
    const row = buildBlankChatter(name);
    if (existingIds.has(row.id)) continue;
    data.conversations.push(row);
    existingIds.add(row.id);
    existingChatterHeroes.add(name.toLowerCase());
    added.push(name);
}

const chatterCount = data.conversations.filter(
    (row) => String(row?.entryType || '').toLowerCase() === 'chatter',
).length;

data._meta = data._meta && typeof data._meta === 'object' ? data._meta : {};
data._meta.chattersSeededAt = new Date().toISOString();
data._meta.chatterCount = chatterCount;

fs.writeFileSync(conversationsPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(`Heroes in roster: ${heroes.length}`);
console.log(`Chatters added: ${added.length}`);
console.log(`Total chatter entries: ${chatterCount}`);
if (added.length) {
    console.log(`Added: ${added.join(', ')}`);
}
