#!/usr/bin/env node
/**
 * Import every scraped hero batch folder into Dialogue Theater.
 *
 * Usage:
 *   node scripts/import-all-interaction-batches.mjs
 *   node scripts/import-all-interaction-batches.mjs --root "C:\Users\...\interactions"
 *   node scripts/import-all-interaction-batches.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import {
    createImportBatchContext,
    importInteractionBatch,
    persistImportedConversations,
} from './import-interaction-folder.mjs';

const DEFAULT_ROOT = 'C:\\Users\\diego\\OneDrive\\Escritorio\\interactions';

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
    /** @type {{ rootDir: string, dryRun: boolean, replaceNames: boolean }} */
    const opts = {
        rootDir: DEFAULT_ROOT,
        dryRun: false,
        replaceNames: false,
    };

    for (let i = 2; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--root' && argv[i + 1]) {
            opts.rootDir = argv[++i];
        } else if (arg === '--dry-run') {
            opts.dryRun = true;
        } else if (arg === '--replace-names') {
            opts.replaceNames = true;
        }
    }

    return opts;
}

/**
 * @param {string} rootDir
 * @returns {Promise<string[]>}
 */
async function listHeroBatchDirs(rootDir) {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    return entries
        .filter(
            (entry) =>
                entry.isDirectory() &&
                !entry.name.startsWith('_') &&
                !entry.name.startsWith('.'),
        )
        .map((entry) => path.join(rootDir, entry.name))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

async function main() {
    const opts = parseArgs(process.argv);
    const rootDir = path.resolve(opts.rootDir);

    try {
        const stat = await fs.stat(rootDir);
        if (!stat.isDirectory()) throw new Error('Not a directory');
    } catch {
        throw new Error(`Interactions root not found: ${rootDir}`);
    }

    const batchDirs = await listHeroBatchDirs(rootDir);
    if (batchDirs.length === 0) {
        throw new Error(`No hero batch folders found in ${rootDir}`);
    }

    const context = await createImportBatchContext();
    /** @type {import('../src/features/dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation[]} */
    const allImported = [];
    let totalCopied = 0;
    let totalSkippedVoices = 0;
    let totalSkippedFolders = 0;

    console.log(`Interactions root: ${rootDir}`);
    console.log(`Hero batches: ${batchDirs.length}`);
    console.log(`Dry run: ${opts.dryRun ? 'yes' : 'no'}\n`);

    for (let i = 0; i < batchDirs.length; i++) {
        const batchDir = batchDirs[i];
        console.log(`\n=== [${i + 1}/${batchDirs.length}] ${path.basename(batchDir)} ===`);

        let hasFolders = false;
        try {
            const entries = await fs.readdir(batchDir, { withFileTypes: true });
            hasFolders = entries.some(
                (entry) => entry.isDirectory() && !entry.name.startsWith('_'),
            );
        } catch {
            /* skip */
        }

        if (!hasFolders) {
            console.log('  (skip) no interaction folders');
            continue;
        }

        const result = await importInteractionBatch(batchDir, context, {
            dryRun: opts.dryRun,
            replaceNames: opts.replaceNames,
        });

        allImported.push(...result.imported);
        totalCopied += result.copiedVoicelines;
        totalSkippedVoices += result.skippedVoicelines;
        totalSkippedFolders += result.skippedFolders;
    }

    if (allImported.length === 0) {
        console.log('\nNothing imported.');
        return;
    }

    await persistImportedConversations(context, allImported, {
        dryRun: opts.dryRun,
        replaceNames: opts.replaceNames,
    });

    console.log('\n--- Import all summary ---');
    console.log(`Imported conversations: ${allImported.length}`);
    console.log(`Voicelines copied: ${totalCopied}`);
    console.log(`Voicelines already present: ${totalSkippedVoices}`);
    console.log(`Skipped folders: ${totalSkippedFolders}`);
    if (!opts.dryRun) {
        console.log('Updated conversations.json and theater-assets-manifest.json');
    }
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
