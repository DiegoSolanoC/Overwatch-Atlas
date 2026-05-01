// Regenerate manifest.json from assets (heroes / factions PNGs, music audio).
// Run: node generate-manifest.js

const fs = require('fs');
const path = require('path');

const heroesFolder = './assets/images/heroes';
const factionsFolder = './assets/images/factions';
const npcsFolder = './assets/images/npcs';
const musicFolder = './assets/audio/music';

/** Locale-aware sort so "51" orders like a number among hero names */
function sortHeroBasenames(names) {
    return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

function getHeroesFromFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        return sortHeroBasenames(
            files
                .filter((file) => file.toLowerCase().endsWith('.png'))
                .map((file) => file.replace(/\.png$/i, ''))
        );
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
        return [];
    }
}

/** PNG basename keeps optional numeric prefix for file naming; labels use the rest (e.g. 01Blackwatch → Blackwatch). */
function factionDisplayNameFromBasename(base) {
    const m = String(base).match(/^(\d+)(.*)$/);
    if (m && m[2] != null) {
        const rest = m[2].trim();
        if (rest) return rest;
    }
    return base;
}

function getFactionsFromFolder(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        return files
            .filter((file) => file.toLowerCase().endsWith('.png'))
            .map((file) => {
                const filename = file.replace(/\.png$/i, '');
                return {
                    filename,
                    displayName: factionDisplayNameFromBasename(filename)
                };
            })
            .sort((a, b) =>
                a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base', numeric: true })
            );
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
        return [];
    }
}

function getMusicFiles(folderPath) {
    try {
        const files = fs.readdirSync(folderPath);
        const musicFiles = files
            .filter((file) => {
                const lower = file.toLowerCase();
                return lower.endsWith('.mp3') || lower.endsWith('.wav') || lower.endsWith('.ogg');
            })
            .map((file) => ({
                filename: file,
                name: file.replace(/\.(mp3|wav|ogg)$/i, '')
            }));

        return musicFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    } catch (error) {
        console.error(`Error reading folder ${folderPath}:`, error);
        return [];
    }
}

const heroes = getHeroesFromFolder(heroesFolder);
const factions = getFactionsFromFolder(factionsFolder);
const npcs = getHeroesFromFolder(npcsFolder);
const music = getMusicFiles(musicFolder);

const manifest = {
    heroes,
    factions: factions.map((f) => ({
        filename: f.filename,
        displayName: f.displayName
    })),
    npcs,
    music
};

fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
console.log('manifest.json written from disk assets.');
console.log(`  heroes: ${heroes.length}, factions: ${factions.length}, npcs: ${npcs.length}, music: ${music.length}`);
