#!/usr/bin/env node
/**
 * Promote NPC D.mon → Hero 53 (Tank/Bruiser).
 *
 * - Moves filter chip NPC → Heroes
 * - Creates blank placeholder PNGs for Bios / Archive / Theater Renders
 * - Migrates story archives + M.E.K.A / D.va connections
 * - Retargets timeline npcFilterPlaces → own heroFilterPlaces rows
 * - Remaps Codex node + connection kinds
 * - Regenerates platform manifest + theater assets manifest
 *
 * Usage: node scripts/promote-dmon-to-hero.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const NAME = 'D.mon';

const PATHS = {
    filterNpc: path.join(REPO, 'src/assets/images/Filters/NPCs', `${NAME}.png`),
    filterHero: path.join(REPO, 'src/assets/images/Filters/Heroes', `${NAME}.png`),
    biosDir: path.join(REPO, 'src/assets/images/Bios', NAME),
    biosHeroic: path.join(REPO, 'src/assets/images/Bios', NAME, 'Heroic.png'),
    archiveHero: path.join(REPO, 'src/assets/images/Archive/Heroes', `${NAME}.png`),
    theaterDir: path.join(REPO, 'src/assets/images/Theater/Renders', NAME),
    theaterHeroic: path.join(REPO, 'src/assets/images/Theater/Renders', NAME, 'Heroic.png'),
    heroesJson: absFromPublic(FILES.storyArchive.heroes),
    npcsJson: absFromPublic(FILES.storyArchive.npcs),
    factionsJson: absFromPublic(FILES.storyArchive.factions),
    timeline: absFromPublic(FILES.eventSystem.timelineEvents),
    codex: path.join(REPO, 'src/data/codex/codex-labels.json'),
    theaterManifest: path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json'),
    npcOrdering: path.join(
        REPO,
        'src/features/data-workshop/archive-category-npcs/ArchiveNpcOrdering.js',
    ),
    legacyNpcs: path.join(REPO, 'src/data/story-archive-npcs.json'),
};

/** Minimal solid gray PNG (RGBA) via pure zlib — blank hero template. */
function makeBlankPng(width = 256, height = 256, rgba = [48, 48, 52, 255]) {
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y += 1) {
        const row = y * (width * 4 + 1);
        raw[row] = 0;
        for (let x = 0; x < width; x += 1) {
            const i = row + 1 + x * 4;
            raw[i] = rgba[0];
            raw[i + 1] = rgba[1];
            raw[i + 2] = rgba[2];
            raw[i + 3] = rgba[3];
        }
    }
    const compressed = zlib.deflateSync(raw);

    function chunk(type, data) {
        const typeBuf = Buffer.from(type);
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
        return Buffer.concat([len, typeBuf, data, crc]);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ihdr),
        chunk('IDAT', compressed),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

async function ensureBlank(filePath, w, h) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    if (fs.existsSync(filePath)) {
        console.log(`  keep existing ${path.relative(REPO, filePath)}`);
        return;
    }
    await fsp.writeFile(filePath, makeBlankPng(w, h));
    console.log(`  wrote blank ${path.relative(REPO, filePath)}`);
}

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function writeJson(p, data) {
    await fsp.writeFile(p, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function tokenizeCountry(csv) {
    return String(csv || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function joinCountry(tokens) {
    if (!tokens.length) return '';
    return `${tokens.join(', ')},`;
}

function isDmon(token) {
    return String(token || '').trim().toLowerCase() === 'd.mon';
}

async function migrateAssets() {
    console.log('\n== Assets ==');
    if (!fs.existsSync(PATHS.filterNpc) && !fs.existsSync(PATHS.filterHero)) {
        throw new Error(`Missing filter chip for ${NAME}`);
    }
    if (fs.existsSync(PATHS.filterNpc)) {
        await fsp.mkdir(path.dirname(PATHS.filterHero), { recursive: true });
        if (fs.existsSync(PATHS.filterHero)) await fsp.unlink(PATHS.filterHero);
        await fsp.rename(PATHS.filterNpc, PATHS.filterHero);
        console.log('  moved Filters/NPCs → Filters/Heroes');
    } else {
        console.log('  filter already in Heroes');
    }

    // Bios / Theater: blank Heroic. Archive: blank portrait.
    await ensureBlank(PATHS.biosHeroic, 512, 512);
    await ensureBlank(PATHS.theaterHeroic, 512, 512);
    await ensureBlank(PATHS.archiveHero, 512, 512);
}

async function migrateArchives() {
    console.log('\n== Story archives ==');
    const heroes = readJson(PATHS.heroesJson);
    const npcs = readJson(PATHS.npcsJson);
    const factions = readJson(PATHS.factionsJson);

    const npcList = npcs.events || npcs;
    const heroList = heroes.events || heroes;
    const factionList = factions.events || factions;

    const npcIdx = npcList.findIndex((e) => e.name === NAME);
    const npcRow = npcIdx >= 0 ? npcList[npcIdx] : null;
    if (npcIdx >= 0) {
        npcList.splice(npcIdx, 1);
        console.log('  removed from npcs.json');
    }

    if (heroList.some((e) => e.name === NAME)) {
        console.log('  heroes.json already has D.mon — updating fields');
        const row = heroList.find((e) => e.name === NAME);
        row.heroRole = 'Tank';
        row.heroSubRole = 'Bruiser';
        row.description = row.description ?? '';
        row.relevantLocations = Array.isArray(row.relevantLocations) ? row.relevantLocations : [];
        if (!Array.isArray(row.connections)) row.connections = [];
    } else {
        // Insert after last Tank/Bruiser if possible, else append near Mauga block.
        const bruiserConn = {
            kind: 'faction',
            name: 'M.E.K.A Squad',
            reasoningSubjectToLinked: '',
            reasoningLinkedToSubject: '',
            thisEntryLane: 'B',
            showInCodex: true,
        };
        const dvaConn = {
            kind: 'hero',
            name: 'D.va',
            reasoningSubjectToLinked: '',
            reasoningLinkedToSubject: '',
            thisEntryLane: 'A',
            showInCodex: true,
        };
        const newRow = {
            name: NAME,
            description: '',
            relevantLocations: [],
            heroRole: 'Tank',
            heroSubRole: 'Bruiser',
            connections: [bruiserConn, dvaConn],
        };
        let insertAt = heroList.findIndex(
            (e, i) =>
                e.heroRole === 'Tank' &&
                e.heroSubRole === 'Bruiser' &&
                (heroList[i + 1]?.heroSubRole !== 'Bruiser' || heroList[i + 1]?.heroRole !== 'Tank'),
        );
        if (insertAt < 0) insertAt = heroList.findIndex((e) => e.name === 'Roadhog');
        if (insertAt < 0) heroList.push(newRow);
        else heroList.splice(insertAt + 1, 0, newRow);
        console.log('  added heroes.json Tank/Bruiser row');
    }

    // Ensure connections on hero row
    {
        const row = heroList.find((e) => e.name === NAME);
        row.connections = Array.isArray(row.connections) ? row.connections : [];
        if (!row.connections.some((c) => c.kind === 'faction' && c.name === 'M.E.K.A Squad')) {
            row.connections.push({
                kind: 'faction',
                name: 'M.E.K.A Squad',
                reasoningSubjectToLinked: '',
                reasoningLinkedToSubject: '',
                thisEntryLane: 'B',
                showInCodex: true,
            });
        }
        if (!row.connections.some((c) => c.kind === 'hero' && c.name === 'D.va')) {
            row.connections.push({
                kind: 'hero',
                name: 'D.va',
                reasoningSubjectToLinked: '',
                reasoningLinkedToSubject: '',
                thisEntryLane: 'A',
                showInCodex: true,
            });
        }
    }

    // D.va ↔ D.mon
    {
        const dva = heroList.find((e) => e.name === 'D.va');
        if (dva) {
            dva.connections = Array.isArray(dva.connections) ? dva.connections : [];
            if (!dva.connections.some((c) => c.kind === 'hero' && c.name === NAME)) {
                dva.connections.push({
                    kind: 'hero',
                    name: NAME,
                    reasoningSubjectToLinked: '',
                    reasoningLinkedToSubject: '',
                    thisEntryLane: 'A',
                    showInCodex: true,
                });
                console.log('  linked D.va → D.mon');
            }
        }
    }

    // M.E.K.A Squad: npc → hero
    {
        const meka = factionList.find((e) => e.name === 'M.E.K.A Squad');
        if (meka) {
            meka.connections = Array.isArray(meka.connections) ? meka.connections : [];
            const hit = meka.connections.find((c) => c.name === NAME);
            if (hit) {
                hit.kind = 'hero';
                console.log('  M.E.K.A Squad connection kind → hero');
            } else {
                meka.connections.push({
                    kind: 'hero',
                    name: NAME,
                    reasoningSubjectToLinked: '',
                    reasoningLinkedToSubject: '',
                    thisEntryLane: 'A',
                    showInCodex: true,
                });
                console.log('  added M.E.K.A Squad → D.mon hero connection');
            }
        }
    }

    await writeJson(PATHS.heroesJson, heroes.events ? heroes : { events: heroList });
    await writeJson(PATHS.npcsJson, npcs.events ? npcs : { events: npcList });
    await writeJson(PATHS.factionsJson, factions.events ? factions : { events: factionList });

    // Legacy flat npcs
    if (fs.existsSync(PATHS.legacyNpcs)) {
        const legacy = readJson(PATHS.legacyNpcs);
        const list = legacy.events || legacy;
        const before = list.length;
        const next = list.filter((e) => e.name !== NAME);
        if (next.length !== before) {
            if (legacy.events) legacy.events = next;
            await writeJson(PATHS.legacyNpcs, legacy.events ? legacy : next);
            console.log('  removed from legacy story-archive-npcs.json');
        }
    }

    // Cleanup hard-code
    let ordering = await fsp.readFile(PATHS.npcOrdering, 'utf8');
    if (ordering.includes(`'D.mon': 'MEKA'`)) {
        ordering = ordering.replace(/\s*'D\.mon':\s*'MEKA',?\r?\n/, '\n');
        await fsp.writeFile(PATHS.npcOrdering, ordering, 'utf8');
        console.log('  removed D.mon from ArchiveNpcOrdering');
    }

    return npcRow;
}

async function migrateTimeline() {
    console.log('\n== Timeline events ==');
    // Resolve timeline path
    let timelinePath = PATHS.timeline;
    if (!fs.existsSync(timelinePath)) {
        timelinePath = path.join(REPO, 'src/data/event-system/timeline-events.json');
    }
    const raw = readJson(timelinePath);
    const events = raw.events || raw;
    let touched = 0;

    for (const ev of events) {
        const npcPlaces = Array.isArray(ev.npcFilterPlaces) ? ev.npcFilterPlaces : [];
        let reasoning = '';
        let found = false;
        const nextNpc = [];

        for (const row of npcPlaces) {
            const tokens = tokenizeCountry(row.country);
            if (!tokens.some(isDmon)) {
                nextNpc.push(row);
                continue;
            }
            found = true;
            if (String(row.reasoning || '').trim()) reasoning = String(row.reasoning).trim();
            const rest = tokens.filter((t) => !isDmon(t));
            if (rest.length) {
                nextNpc.push({ ...row, country: joinCountry(rest) });
            }
        }

        if (!found) continue;

        ev.npcFilterPlaces = nextNpc.length ? nextNpc : undefined;
        if (!ev.npcFilterPlaces) delete ev.npcFilterPlaces;

        ev.heroFilterPlaces = Array.isArray(ev.heroFilterPlaces) ? ev.heroFilterPlaces : [];
        // Remove any existing D.mon hero tokens first
        const cleanedHero = [];
        for (const row of ev.heroFilterPlaces) {
            const tokens = tokenizeCountry(row.country).filter((t) => !isDmon(t));
            if (tokens.length) cleanedHero.push({ ...row, country: joinCountry(tokens) });
        }
        cleanedHero.push({
            locationName: '',
            country: `${NAME},`,
            reasoning,
        });
        ev.heroFilterPlaces = cleanedHero;
        touched += 1;
        console.log(`  ${ev.name}: hero row${reasoning ? ` (reasoning: ${reasoning})` : ''}`);
    }

    await writeJson(timelinePath, raw.events ? raw : { events });
    console.log(`  updated ${touched} event(s)`);
}

async function migrateCodex() {
    console.log('\n== Codex ==');
    const codex = readJson(PATHS.codex);
    let nodeFixes = 0;
    for (const node of codex.nodes || []) {
        if (node.kind === 'npc' && node.npcName === NAME) {
            node.kind = 'hero';
            node.heroName = NAME;
            delete node.npcName;
            nodeFixes += 1;
        }
    }
    console.log(`  remapped ${nodeFixes} node(s)`);

    let connFixes = 0;
    for (const c of codex.connections || []) {
        let changed = false;
        if (c.name === NAME && c.kind === 'npc') {
            c.kind = 'hero';
            changed = true;
        }
        if (c.linkedName === NAME && c.linkedKind === 'npc') {
            c.linkedKind = 'hero';
            changed = true;
        }
        if (c.subjectName === NAME && c.subjectKind === 'npc') {
            c.subjectKind = 'hero';
            changed = true;
        }
        if (changed) connFixes += 1;
    }
    console.log(`  remapped ${connFixes} connection row(s)`);
    await writeJson(PATHS.codex, codex);
}

async function regenerateManifests() {
    console.log('\n== Regenerate manifests ==');
    const gen = spawnSync(process.execPath, [path.join(REPO, 'scripts/generate-manifest.js')], {
        cwd: REPO,
        encoding: 'utf8',
    });
    if (gen.status !== 0) {
        console.error(gen.stdout, gen.stderr);
        throw new Error('generate-manifest.js failed');
    }
    console.log('  platform manifest regenerated');

    const assets = await scanTheaterAssets();
    await writeJson(PATHS.theaterManifest, assets);
    console.log('  theater-assets-manifest regenerated');

    const manifest = readJson(path.join(REPO, 'src/data/platform/manifest.json'));
    const inHeroes = (manifest.heroes || []).includes(NAME);
    const inNpcs = (manifest.npcs || []).includes(NAME);
    const bios = manifest.heroBios?.[NAME];
    console.log(`  verify: heroes=${inHeroes} npcs=${inNpcs} heroBios=${JSON.stringify(bios)}`);
    if (!inHeroes || inNpcs) throw new Error('Manifest still wrong for D.mon');
}

async function main() {
    console.log(`Promote ${NAME} → Hero 53 (Tank/Bruiser)`);
    await migrateAssets();
    await migrateArchives();
    await migrateTimeline();
    await migrateCodex();
    await regenerateManifests();
    console.log('\nDone. Hard-refresh and clear dialogue/timeline localStorage if chips look stale.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
