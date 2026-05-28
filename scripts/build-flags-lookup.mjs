/**
 * Builds src/features/world/data/flagFileByCommonName.js from src/assets/images/Filters/Flags/flags-index.json
 * Run from repo root: node scripts/build-flags-lookup.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'src', 'assets', 'images', 'Filters', 'flags', 'flags-index.json');
const OUT = path.join(ROOT, 'src', 'features', 'worldview', 'data', 'flagFileByCommonName.js');

const idx = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const o = {};
for (const row of idx) {
    if (row.common && row.file) o[row.common] = row.file;
}

const banner = `/**
 * AUTO-GENERATED — do not edit. Run: node scripts/build-flags-lookup.mjs
 * Maps REST Countries name.common → flag filename in src/assets/images/Filters/Flags/
 */
`;
const body = `(function () {
    'use strict';
    window.FLAG_FILE_BY_COMMON = ${JSON.stringify(o, null, 4)};
})();\n`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, banner + body, 'utf8');
console.log('Wrote', OUT, '(' + Object.keys(o).length + ' countries)');
