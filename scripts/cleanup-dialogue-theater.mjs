#!/usr/bin/env node
/**
 * Dialogue Theater cleanup:
 * - remove duplicate conversations (keep earliest in file order)
 * - copy missing voicelines from scraped interactions into theater assets
 * - backfill empty line.voice fields when a matching file exists
 * - backfill empty or Classic line.render fields with Heroic.png when available
 * - refresh theater-assets-manifest.json
 *
 * Usage:
 *   node scripts/cleanup-dialogue-theater.mjs
 *   node scripts/cleanup-dialogue-theater.mjs --dry-run
 *   node scripts/cleanup-dialogue-theater.mjs --interactions "C:/path/to/interactions"
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { conversationVoiceFingerprint } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import {
    pickHeroicRenderForHero,
    shouldUpgradeDialogueLineRender,
} from '../src/features/dialogue-theater/data/loadDialogueTheaterAssets.js';
import {
    findVoicelineForHeroAndSubtitles,
    resolveLineVoiceFile,
} from '../src/features/dialogue-theater/data/theaterVoicelineParsing.js';
import { resolveManifestHeroId } from '../src/features/system-interface/interface-filter-menu/buttons/filterKeyMapping.js';
import { loadManifestHeroIds } from './lib/wiki-quotes-heroes.mjs';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO_ROOT, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO_ROOT, 'src/assets/audio/Theater/Voicelines');
const DEFAULT_INTERACTIONS_DIR = path.join(
    process.env.USERPROFILE || process.env.HOME || '',
    'OneDrive',
    'Escritorio',
    'interactions',
);

const AUDIO_EXT = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.webm']);

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ dryRun: boolean, interactionsDir: string }} */
    const opts = {
        dryRun: false,
        interactionsDir: DEFAULT_INTERACTIONS_DIR,
    };

    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--dry-run') {
            opts.dryRun = true;
        } else if (argv[i] === '--interactions' && argv[i + 1]) {
            opts.interactionsDir = path.resolve(argv[i + 1]);
            i += 1;
        }
    }

    return opts;
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 */
function removeDuplicateConversations(conversations) {
    /** @type {Set<string>} */
    const seen = new Set();
    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} */
    const kept = [];
    /** @type {Array<{ id: string, name: string }>} */
    const removed = [];

    for (const row of conversations) {
        const fingerprint = conversationVoiceFingerprint(row?.lines || []);
        if (fingerprint && seen.has(fingerprint)) {
            removed.push({
                id: String(row.id || ''),
                name: String(row.name || 'Untitled conversation'),
            });
            continue;
        }
        if (fingerprint) seen.add(fingerprint);
        kept.push(row);
    }

    return { kept, removed };
}

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function walkInteractionVoicelines(dir) {
    /** @type {Array<{ filename: string, fullPath: string }>} */
    const files = [];

    async function walk(currentDir) {
        let entries = [];
        try {
            entries = await fs.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile() && AUDIO_EXT.has(path.extname(entry.name).toLowerCase())) {
                files.push({ filename: entry.name, fullPath });
            }
        }
    }

    await walk(dir);
    return files;
}

/**
 * @param {string} interactionsDir
 * @param {boolean} dryRun
 */
async function copyMissingVoicelines(interactionsDir, dryRun) {
    const scraped = await walkInteractionVoicelines(interactionsDir);
    let copied = 0;
    let alreadyPresent = 0;

    for (const file of scraped) {
        const dest = path.join(VOICELINES_DIR, file.filename);
        try {
            await fs.access(dest);
            alreadyPresent += 1;
            continue;
        } catch {
            /* copy */
        }

        if (dryRun) {
            copied += 1;
            continue;
        }

        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(file.fullPath, dest);
        copied += 1;
    }

    return { copied, alreadyPresent, scanned: scraped.length };
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {string[]} voicelines
 */
function backfillConversationVoices(conversations, voicelines) {
    let updatedLines = 0;

    for (const conversation of conversations) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        for (const line of lines) {
            const resolved = resolveLineVoiceFile(line, voicelines);
            if (!resolved) continue;
            if (line.voice === resolved) continue;
            line.voice = resolved;
            updatedLines += 1;
        }
    }

    return updatedLines;
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {string[]} manifestHeroes
 */
function normalizeConversationHeroNames(conversations, manifestHeroes) {
    let updatedLines = 0;

    for (const conversation of conversations) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        for (const line of lines) {
            const current = String(line?.hero || '').trim();
            if (!current) continue;
            const normalized = resolveManifestHeroId(current, manifestHeroes);
            if (!normalized || normalized === current) continue;
            line.hero = normalized;
            updatedLines += 1;
        }
    }

    return updatedLines;
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {Record<string, string[]>} rendersMap
 */
function backfillHeroicRenders(conversations, rendersMap) {
    let updatedLines = 0;

    for (const conversation of conversations) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        for (const line of lines) {
            const heroic = pickHeroicRenderForHero(String(line?.hero || '').trim(), rendersMap);
            if (!shouldUpgradeDialogueLineRender(line?.render, heroic)) continue;
            line.render = heroic;
            updatedLines += 1;
        }
    }

    return updatedLines;
}

/**
 * @param {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} conversations
 * @param {Record<string, string[]>} rendersMap
 */
function listLinesMissingHeroicRender(conversations, rendersMap) {
    /** @type {Map<string, number>} */
    const byHero = new Map();

    for (const conversation of conversations) {
        const lines = Array.isArray(conversation?.lines) ? conversation.lines : [];
        for (const line of lines) {
            const hero = String(line?.hero || '').trim();
            if (!hero) continue;
            const heroic = pickHeroicRenderForHero(hero, rendersMap);
            const current = String(line?.render || '').trim();
            if (heroic && current.toLowerCase() === 'heroic.png') continue;
            if (heroic) continue;
            byHero.set(hero, (byHero.get(hero) || 0) + 1);
        }
    }

    return [...byHero.entries()].sort((a, b) => b[1] - a[1]);
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));

    const raw = JSON.parse(await fs.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw?.conversations) ? raw.conversations : [];

    const { kept, removed } = removeDuplicateConversations(conversations);
    console.log(`Conversations: ${conversations.length} → ${kept.length} (removed ${removed.length} duplicate(s))`);
    for (const row of removed) {
        console.log(`  - removed "${row.name}" (${row.id})`);
    }

    let voiceCopy = { copied: 0, alreadyPresent: 0, scanned: 0 };
    try {
        await fs.access(opts.interactionsDir);
        voiceCopy = await copyMissingVoicelines(opts.interactionsDir, opts.dryRun);
        console.log(
            `Voicelines: scanned ${voiceCopy.scanned}, copied ${voiceCopy.copied}, already present ${voiceCopy.alreadyPresent}`,
        );
    } catch {
        console.warn(`Interactions folder not found (${opts.interactionsDir}) — skipping voiceline copy`);
    }

    const assets = await scanTheaterAssets();
    const voicelines = assets.voicelines || [];
    const manifestHeroes = await loadManifestHeroIds();
    const normalizedHeroLines = normalizeConversationHeroNames(kept, manifestHeroes);
    if (normalizedHeroLines > 0) {
        console.log(`Normalized ${normalizedHeroLines} hero name field(s) to manifest ids`);
    }
    const updatedLines = backfillConversationVoices(kept, voicelines);
    console.log(`Backfilled ${updatedLines} line voice field(s)`);

    const updatedRenders = backfillHeroicRenders(kept, assets.renders || {});
    console.log(`Backfilled ${updatedRenders} line render field(s) with Heroic.png`);

    const missingRenders = listLinesMissingHeroicRender(kept, assets.renders || {});
    if (missingRenders.length > 0) {
        console.log('Lines still without a heroic render folder:');
        for (const [hero, count] of missingRenders.slice(0, 20)) {
            console.log(`  - ${hero}: ${count} line(s)`);
        }
        if (missingRenders.length > 20) {
            console.log(`  … and ${missingRenders.length - 20} more hero name(s)`);
        }
    }

    const postBackfill = removeDuplicateConversations(kept);
    if (postBackfill.removed.length > 0) {
        console.log(
            `Post-backfill dedupe: ${kept.length} → ${postBackfill.kept.length} (removed ${postBackfill.removed.length} duplicate(s))`,
        );
        for (const row of postBackfill.removed) {
            console.log(`  - removed "${row.name}" (${row.id})`);
        }
    }

    const finalConversations = postBackfill.kept;
    const hazardLine = finalConversations
        .flatMap((row) => row.lines || [])
        .find((line) => String(line?.subtitles || '').includes('markin'));
    if (hazardLine) {
        const resolved = resolveLineVoiceFile(hazardLine, voicelines);
        console.log(`Hazard tattoo line voice: ${resolved || '(still unresolved)'}`);
    }

    if (opts.dryRun) {
        console.log('Dry run — no files written.');
        return;
    }

    await fs.writeFile(
        CONVERSATIONS_PATH,
        `${JSON.stringify({ conversations: finalConversations }, null, 2)}\n`,
        'utf8',
    );
    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log('Updated conversations.json and theater-assets-manifest.json');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
