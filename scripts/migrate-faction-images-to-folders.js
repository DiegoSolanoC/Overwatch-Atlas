/**
 * Move flat Factions/*.png into Factions/<name>/Default.png (one folder per faction).
 * Run from repo root: node scripts/migrate-faction-images-to-folders.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FACTIONS_DIR = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'Factions');
const DEFAULT_LOOK = 'Default';

function main() {
    const entries = fs.readdirSync(FACTIONS_DIR, { withFileTypes: true });
    let moved = 0;

    for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) continue;

        const factionName = entry.name.replace(/\.png$/i, '');
        const factionDir = path.join(FACTIONS_DIR, factionName);
        const dest = path.join(factionDir, `${DEFAULT_LOOK}.png`);

        if (!fs.existsSync(factionDir)) {
            fs.mkdirSync(factionDir, { recursive: true });
        }

        if (fs.existsSync(dest)) {
            console.warn(`  skip (already exists): ${factionName}/${DEFAULT_LOOK}.png`);
            continue;
        }

        fs.renameSync(path.join(FACTIONS_DIR, entry.name), dest);
        console.log(`  ${entry.name} → ${factionName}/${DEFAULT_LOOK}.png`);
        moved += 1;
    }

    console.log(moved ? `Moved ${moved} faction image(s).` : 'No flat faction PNGs to migrate.');
}

main();
