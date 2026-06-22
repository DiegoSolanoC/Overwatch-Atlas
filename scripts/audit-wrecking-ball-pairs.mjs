#!/usr/bin/env node
/**
 * Audit Wrecking Ball theater lines vs MatchTalk folder + 0B2 root pairs.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const DEFAULT_EXTRACT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
    'Wrecking Ball',
);

function norm(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\*+/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function stripSfxPrefix(name) {
    return String(name || '')
        .replace(/^\(angry squeaks\)\s*/i, '')
        .replace(/^\(hamster noises\)\s*/i, '')
        .replace(/^\(angry squeaks\) \(Chinese\)_\s*/i, '')
        .replace(/^\(apologetic squeaks\)\s*/i, '')
        .replace(/^\(excited hamster squeaks\)\s*/i, '')
        .replace(/^\(hamster squeaks\)\s*/i, '')
        .replace(/^\(scared hamster noise\)\s*/i, '')
        .replace(/^\(scared hamster noises\)\s*/i, '')
        .replace(/^\(bashful hamster noises\)\s*/i, '')
        .trim();
}

function stripSubtitleMarkup(subtitle) {
    return String(subtitle || '')
        .replace(/\*\*[^*]+\*\*\s*/g, '')
        .replace(/\*[^*]+\*\s*/g, '')
        .replace(/^Hanzi:\s*/i, '')
        .replace(/^English:\s*/i, '')
        .trim();
}

function dialogueFromManifestFile(filename) {
    const base = String(filename).replace(/\.ogg$/i, '');
    const sep = base.indexOf('_-_');
    if (sep < 0) return base.replace(/_/g, ' ');
    return base.slice(sep + 3).replace(/_/g, ' ');
}

function fuzzyMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.includes(b) || b.includes(a)) return true;
    const aw = a.split(' ').filter((w) => w.length > 3);
    const bw = b.split(' ').filter((w) => w.length > 3);
    if (!aw.length || !bw.length) return false;
    const overlap = aw.filter((w) => bw.includes(w)).length;
    return overlap >= Math.min(aw.length, bw.length) * 0.7;
}

function findMatch(normKey, map) {
    if (map.has(normKey)) return map.get(normKey);
    for (const [key, value] of map) {
        if (fuzzyMatch(key, normKey)) return value;
    }
    return null;
}

function scanMatchTalk(extractRoot) {
    const matchTalkDir = path.join(extractRoot, 'MatchTalk');
    /** @type {Map<string, { label: string, folder: string, folderOggs: string[] }>} */
    const folders = new Map();
    /** @type {Map<string, { label: string, file: string }>} */
    const root0B2 = new Map();

    for (const entry of fs.readdirSync(matchTalkDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            const label = entry.name;
            const dialogue = stripSfxPrefix(label);
            const key = norm(dialogue);
            const folderOggs = fs
                .readdirSync(path.join(matchTalkDir, entry.name))
                .filter((f) => /\.ogg$/i.test(f));
            folders.set(key, { label, folder: entry.name, folderOggs, dialogue });
            continue;
        }
        if (!/\.ogg$/i.test(entry.name)) continue;
        const m = entry.name.match(/^[^-]+-(.+)\.ogg$/i);
        if (!m) continue;
        const raw = m[1];
        const is0B2 = /\.0B2-/i.test(entry.name) || entry.name.includes('.0B2-');
        if (!is0B2) continue;
        const dialogue = stripSfxPrefix(raw);
        const key = norm(dialogue);
        root0B2.set(key, { label: raw, file: entry.name, dialogue });
    }

    return { folders, root0B2, matchTalkDir };
}

function main() {
    const extractRoot = process.argv[2] || DEFAULT_EXTRACT;
    const { folders, root0B2 } = scanMatchTalk(extractRoot);
    const convRaw = JSON.parse(
        fs.readFileSync(path.join(REPO, 'src/data/dialogue-theater/conversations.json'), 'utf8'),
    );

    /** @type {Array<object>} */
    const rows = [];
    for (const conversation of convRaw.conversations || []) {
        for (const line of conversation.lines || []) {
            if (String(line?.hero || '').trim() !== 'Wrecking Ball') continue;
            const voice = String(line.voice || '').trim();
            const subtitles = String(line.subtitles || '').trim();
            const cleanSub = stripSubtitleMarkup(subtitles);
            const fromVoice = voice ? dialogueFromManifestFile(voice) : '';
            const lookupKeys = [norm(cleanSub), norm(fromVoice)].filter(Boolean);

            let folderMatch = null;
            let rootMatch = null;
            for (const key of lookupKeys) {
                folderMatch = folderMatch || findMatch(key, folders);
                rootMatch = rootMatch || findMatch(key, root0B2);
            }

            const hasFolder = Boolean(folderMatch);
            const has0B2 = Boolean(rootMatch);
            const pairStatus = hasFolder && has0B2 ? 'PAIR' : hasFolder || has0B2 ? 'PARTIAL' : 'NONE';

            rows.push({
                conversation: conversation.name || conversation.id,
                subtitles: subtitles || '(empty)',
                voice: voice || '(none)',
                pairStatus,
                hasFolder,
                has0B2,
                folderLabel: folderMatch?.label || '',
                folderOggCount: folderMatch?.folderOggs?.length ?? 0,
                root0B2File: rootMatch?.file || '',
            });
        }
    }

    const paired = rows.filter((r) => r.pairStatus === 'PAIR');
    const partial = rows.filter((r) => r.pairStatus === 'PARTIAL');
    const none = rows.filter((r) => r.pairStatus === 'NONE');
    const folderOnly = partial.filter((r) => r.hasFolder && !r.has0B2);
    const rootOnly = partial.filter((r) => r.has0B2 && !r.hasFolder);

    console.log('=== Wrecking Ball MatchTalk pair audit ===\n');
    console.log(`Extract: ${extractRoot}`);
    console.log(`MatchTalk folders: ${folders.size}`);
    console.log(`MatchTalk root 0B2 files: ${root0B2.size}`);
    console.log(`Theater Wrecking Ball lines: ${rows.length}`);
    console.log(`  Full pair (folder + 0B2): ${paired.length}`);
    console.log(`  Partial (one side only): ${partial.length}`);
    console.log(`  No MatchTalk match: ${none.length}`);

    if (partial.length) {
        console.log('\n--- PARTIAL matches (missing one side) ---');
        for (const row of partial) {
            const missing = row.hasFolder ? 'missing 0B2 root' : 'missing folder';
            console.log(`  [${row.conversation}] ${row.subtitles.slice(0, 70)}`);
            console.log(`    wired: ${row.voice}`);
            console.log(`    ${missing}${row.hasFolder ? ` | folder oggs: ${row.folderOggCount}` : ''}${row.has0B2 ? ` | 0B2: ${row.root0B2File}` : ''}`);
        }
    }

    if (none.length) {
        console.log('\n--- NO MatchTalk match ---');
        for (const row of none) {
            console.log(`  [${row.conversation}] ${row.subtitles.slice(0, 80)}`);
            console.log(`    wired: ${row.voice || '(none)'}`);
        }
    }

    if (folderOnly.length) {
        console.log(`\n--- Folder only (${folderOnly.length}) ---`);
        folderOnly.forEach((r) => console.log(`  • ${r.subtitles.slice(0, 60)} (${r.folderOggCount} oggs in folder)`));
    }

    if (rootOnly.length) {
        console.log(`\n--- 0B2 root only (${rootOnly.length}) ---`);
        rootOnly.forEach((r) => console.log(`  • ${r.subtitles.slice(0, 60)} → ${r.root0B2File}`));
    }

    // Reverse check: MatchTalk entries not represented in theater
    const theaterNorms = new Set();
    for (const row of rows) {
        theaterNorms.add(norm(stripSubtitleMarkup(row.subtitles)));
        if (row.voice) theaterNorms.add(norm(dialogueFromManifestFile(row.voice)));
    }

    const unmatchedFolders = [];
    for (const [key, entry] of folders) {
        let hit = false;
        for (const t of theaterNorms) {
            if (fuzzyMatch(key, t)) { hit = true; break; }
        }
        if (!hit) unmatchedFolders.push(entry);
    }

    const unmatched0B2 = [];
    for (const [key, entry] of root0B2) {
        let hit = false;
        for (const t of theaterNorms) {
            if (fuzzyMatch(key, t)) { hit = true; break; }
        }
        if (!hit) unmatched0B2.push(entry);
    }

    console.log('\n--- MatchTalk folders with no theater line ---');
    unmatchedFolders.sort((a, b) => a.dialogue.localeCompare(b.dialogue)).forEach((e) => {
        console.log(`  • ${e.label} (${e.folderOggs.length} oggs)`);
    });
    console.log(`Total: ${unmatchedFolders.length}`);

    console.log('\n--- MatchTalk 0B2 files with no theater line ---');
    unmatched0B2.sort((a, b) => a.dialogue.localeCompare(b.dialogue)).forEach((e) => {
        console.log(`  • ${e.file}`);
    });
    console.log(`Total: ${unmatched0B2.length}`);

    console.log('\n--- Summary ---');
    console.log(paired.length === rows.length - none.length - partial.length ? 'Counts consistent.' : 'Check counts.');
    if (partial.length === 0 && none.length === 0) {
        console.log('✓ Every theater WB line has a full MatchTalk pair (folder + 0B2).');
    } else {
        console.log(`✗ Not all lines have full pairs. ${paired.length}/${rows.length} complete.`);
    }
}

main();
