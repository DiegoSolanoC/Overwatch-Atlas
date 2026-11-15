#!/usr/bin/env node
/**
 * Fix Midseason 5 gaps after manual audit:
 *  - Jetpack Cat & Juno → evasive meows + cat line
 *  - WB hamster voicePrefix on Juno/WB + D.Mon/WB
 *  - Ana/Doctrine final line + truncated subtitles
 *  - Ana/Lúcio Really? + No
 *  - Busan was Nice Roadhog Sorry
 *  - Loving the Bleach look path order (Hazard closer last)
 *  - restore truncated MatchTalk subtitle text
 *
 * Usage:
 *   node scripts/_cache/fix-midseason5-user-gaps.mjs --dry-run
 *   node scripts/_cache/fix-midseason5-user-gaps.mjs --write
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createDialogueLineId } from '../../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from '../import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');

const dryRun = !process.argv.includes('--write');

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[^a-z0-9]+/g, '');
}

function pickHeroic(hero, rendersMap) {
    const list = rendersMap?.[hero] || [];
    return list.find((n) => /heroic/i.test(n)) || list[0] || 'Heroic.png';
}

function makeLine(hero, subtitles, voice, render, voicePrefix = '') {
    return {
        id: createDialogueLineId(),
        hero,
        voice: voice || '',
        voicePrefix: voicePrefix || '',
        subtitles,
        render: render || 'Heroic.png',
        era: 'Overwatch',
        status: 'active',
    };
}

async function copyOgg(src, atlasName) {
    const dest = path.join(VOICELINES_DIR, atlasName);
    if (!dryRun) {
        await fsp.mkdir(VOICELINES_DIR, { recursive: true });
        if (!fs.existsSync(dest)) await fsp.copyFile(src, dest);
    }
    return atlasName;
}

function findExtract(...parts) {
    return path.join(EXTRACT, ...parts);
}

/** Full subtitle restorations keyed by coreKey prefix of current/truncated text or voice stem. */
const FULL_TEXT = [
    {
        match: /good healt/i,
        text: "My brother's reaction was hyperbolically rash... but he must know I have only acted in the name of his good health.",
    },
    {
        match: /learn th$/i,
        text: "I'd say you'll realize you can't decide for others someday, but you've had more time than even I have to learn that lesson.",
    },
    {
        match: /But is th/i,
        text: 'Dr. Chao said she would have made a different decision about Project Red Promise if only she had known. But is that really true?',
    },
    {
        match: /waned over time I imagine/i,
        text: 'Has your proficiency waned over time? I imagine it must have, given your inevitable decrepitude',
    },
    {
        match: /performing I bet/i,
        text: "You ever try performing? I bet you'd rock a stage!",
    },
    {
        match: /average elder!?$/i,
        text: 'My clarity of mind greatly surpasses that of the average elder!',
    },
    {
        match: /Akande Reclaiming/i,
        text: 'Are you satisfied, Akande? Reclaiming Talon just to hide away and atrophy once more?',
    },
    {
        match: /stand down Let the world/i,
        text: "Guessing I can't convince you to stand down? Let the world recover from Vendetta's war in peace?",
    },
    {
        match: /Doesn't that concern you$/i,
        text: "They don't, yet she still shows all the signs. Doesn't that concern you?",
    },
    {
        match: /let them all out$/i,
        text: "We spent years throwing Doctrine and his like into Grímsvötn. And now you've just let them all out?",
    },
];

function restoreSubtitles(sub) {
    const s = String(sub || '');
    for (const row of FULL_TEXT) {
        if (row.match.test(s)) return row.text;
    }
    return null;
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(raw) ? raw : raw.conversations || [];
    const assets = await scanTheaterAssets();
    const rendersMap = assets.rendersByHero || {};
    /** @type {string[]} */
    const log = [];

    const findConv = (pred) => conversations.find(pred);

    // --- Jetpack Cat & Juno (13) → evasive meows ---
    {
        const conv =
            findConv((c) => c.name === '13')
            || findConv((c) => (c.lines || []).some((l) => /cannot help thinking I have seen you/i.test(l.subtitles || '')));
        if (!conv) {
            log.push('! missing Jetpack/Juno dialogue');
        } else {
            const evasiveSrc = findExtract('Jetpack Cat', 'MatchTalk', '(evasive meows)', '00000033DFF4.03F.ogg');
            const atlas = 'Jetpack_Cat_-_(evasive_meows).ogg';
            if (!fs.existsSync(evasiveSrc)) throw new Error(`Missing evasive meows source: ${evasiveSrc}`);
            await copyOgg(evasiveSrc, atlas);

            const juno1 = (conv.lines || []).find((l) => /cannot help thinking/i.test(l.subtitles || ''));
            const juno2 = (conv.lines || []).find((l) => /definitely not on Mars/i.test(l.subtitles || ''));
            let cat = (conv.lines || []).find((l) => /jetpack/i.test(l.hero));
            if (!cat) {
                cat = makeLine('Jetpack Cat', '**evasive meows**', atlas, pickHeroic('Jetpack Cat', rendersMap));
            } else {
                cat.subtitles = '**evasive meows**';
                cat.voice = atlas;
                cat.hero = 'Jetpack Cat';
            }
            conv.name = 'evasive meows';
            conv.lines = [juno1, cat, juno2].filter(Boolean);
            log.push(`✓ ${conv.name}: Juno → evasive meows → Juno (${conv.lines.length} lines)`);
        }
    }

    // --- WB hamster prefixes ---
    async function wireWbHamster(convNameOrPred, folderLabel, translatorNeedle) {
        const conv = typeof convNameOrPred === 'string'
            ? findConv((c) => c.name === convNameOrPred)
            : findConv(convNameOrPred);
        if (!conv) {
            log.push(`! missing WB dialogue for ${folderLabel}`);
            return;
        }
        const folder = findExtract('Wrecking Ball', 'MatchTalk', folderLabel);
        const takes = fs.existsSync(folder)
            ? fs.readdirSync(folder).filter((n) => /\.03F\.ogg$/i.test(n)).sort()
            : [];
        if (!takes.length) {
            log.push(`! no .03F takes for ${folderLabel}`);
            return;
        }
        const prefixAtlas = `Wrecking_Ball_-_${folderLabel.replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_')}.ogg`;
        await copyOgg(path.join(folder, takes[0]), prefixAtlas);

        // Also copy variant takes for random playback
        for (let i = 1; i < Math.min(takes.length, 6); i += 1) {
            const variant = prefixAtlas.replace(/\.ogg$/i, `_(${i + 1}).ogg`);
            await copyOgg(path.join(folder, takes[i]), variant);
        }

        const line = (conv.lines || []).find((l) => /wrecking/i.test(l.hero) && coreKey(l.subtitles).includes(coreKey(translatorNeedle).slice(0, 18)));
        if (!line) {
            log.push(`! WB line not found in ${conv.name}`);
            return;
        }

        const dialogueBody = folderLabel.replace(/^\(hamster noises\)\s*/i, '').trim();
        const translatorAtlas = `Wrecking_Ball_-_${dialogueBody.replace(/[\\/:*?"<>|]/g, '').replace(/ /g, '_')}.ogg`;

        // Prefer existing translator voice if present; else copy .0B2
        const zeroB2 = fs.readdirSync(findExtract('Wrecking Ball', 'MatchTalk')).find((n) =>
            /\.0B2-/i.test(n) && coreKey(n).includes(coreKey(translatorNeedle).slice(0, 20)),
        );
        if (zeroB2) {
            await copyOgg(findExtract('Wrecking Ball', 'MatchTalk', zeroB2), translatorAtlas);
            line.voice = translatorAtlas;
        } else if (line.voice && /hamster_noises/i.test(line.voice)) {
            // rename conceptually: keep file but set proper split names if file exists
            const oldPath = path.join(VOICELINES_DIR, line.voice);
            if (fs.existsSync(oldPath) && !fs.existsSync(path.join(VOICELINES_DIR, translatorAtlas))) {
                if (!dryRun) await fsp.copyFile(oldPath, path.join(VOICELINES_DIR, translatorAtlas));
            }
            line.voice = translatorAtlas;
        }

        line.voicePrefix = prefixAtlas;
        line.subtitles = `**hamster noises** ${dialogueBody}`;
        log.push(`✓ ${conv.name}: wired hamster prefix for WB line`);
    }

    await wireWbHamster(
        (c) => c.name === '17' || (c.lines || []).some((l) => /habit of abandoning projects/i.test(l.subtitles || '')),
        '(hamster noises) He says, they do have a habit of abandoning projects',
        'habit of abandoning projects',
    );
    await wireWbHamster(
        (c) => c.name === '36' || (c.lines || []).some((l) => /robot squids/i.test(l.subtitles || '')),
        '(hamster noises) He will take you seriously once you defeat your robot squids',
        'robot squids',
    );

    // --- Ana / Doctrine: Waned over time final line ---
    {
        const conv = findConv((c) => c.name === 'Waned over time');
        if (!conv) log.push('! missing Waned over time');
        else {
            const src = findExtract('Ana', 'MatchTalk', "00000006DB74.0B2-(sighs) You are not as special as you think.ogg");
            const atlas = 'Ana_-_(sighs)_You_are_not_as_special_as_you_think.ogg';
            await copyOgg(src, atlas);
            const empty = (conv.lines || []).find((l) => /ana/i.test(l.hero) && !String(l.subtitles || '').trim());
            if (empty) {
                empty.subtitles = '(sighs) You are not as special as you think';
                empty.voice = atlas;
                empty.render = empty.render || pickHeroic('Ana', rendersMap);
            } else if (!(conv.lines || []).some((l) => /not as special as you think/i.test(l.subtitles || ''))) {
                conv.lines.push(makeLine('Ana', '(sighs) You are not as special as you think', atlas, pickHeroic('Ana', rendersMap)));
            }
            log.push('✓ Waned over time: Ana final line filled');
        }
    }

    // --- Ana / Lúcio: Really? + No ---
    {
        const conv = findConv((c) => c.name === '22' || (c.lines || []).some((l) => /pose as a lounge singer/i.test(l.subtitles || '')));
        if (!conv) log.push('! missing Ana/Lúcio');
        else {
            const reallySrc = findExtract('Lúcio', 'MatchTalk', '00000006B11A.0B2-Really_.ogg');
            const noSrc = findExtract('Ana', 'MatchTalk', '00000006BEB8.0B2-No.ogg');
            const reallyAtlas = 'Lúcio_-_Really_.ogg';
            const noAtlas = 'Ana_-_No.ogg';
            await copyOgg(reallySrc, reallyAtlas);
            await copyOgg(noSrc, noAtlas);
            if (!(conv.lines || []).some((l) => /^really\??$/i.test(String(l.subtitles || '').trim()))) {
                conv.lines.push(makeLine('Lúcio', 'Really?', reallyAtlas, pickHeroic('Lúcio', rendersMap)));
            }
            if (!(conv.lines || []).some((l) => /^no\.?$/i.test(String(l.subtitles || '').trim()) && /ana/i.test(l.hero))) {
                conv.lines.push(makeLine('Ana', 'No.', noAtlas, pickHeroic('Ana', rendersMap)));
            }
            log.push(`✓ Ana/Lúcio: now ${conv.lines.length} lines (added Really?/No)`);
        }
    }

    // --- Busan was Nice: Roadhog Sorry ---
    {
        const conv = findConv((c) => c.name === 'Busan was Nice' || (c.lines || []).some((l) => /^Busan was nice\.?$/i.test(String(l.subtitles || '').trim())));
        if (!conv) log.push('! missing Busan was Nice');
        else {
            const src = findExtract('Roadhog', 'MatchTalk', '00000006DBDF.0B2-Sorry.ogg');
            const atlas = 'Roadhog_-_Sorry.ogg';
            await copyOgg(src, atlas);
            if (!(conv.lines || []).some((l) => /^sorry\.?$/i.test(String(l.subtitles || '').trim()) && /roadhog/i.test(l.hero))) {
                conv.lines.push(makeLine('Roadhog', 'Sorry.', atlas, pickHeroic('Roadhog', rendersMap)));
            }
            log.push(`✓ Busan was Nice: Roadhog Sorry added (${conv.lines.length} lines)`);
        }
    }

    // --- Loving the Bleach look path order ---
    {
        const conv = findConv((c) => c.name === 'Loving the Bleach look');
        if (!conv) log.push('! missing Loving the Bleach look');
        else {
            const opener = (conv.lines || []).find((l) => /bleached look/i.test(l.subtitles || ''));
            const closer = (conv.lines || []).find((l) => /looks class/i.test(l.subtitles || ''));
            if (!opener || !closer) log.push('! bleach opener/closer missing');
            else {
                let fixed = 0;
                for (const p of conv.paths || []) {
                    const ids = [...(p.lineIds || [])];
                    const hasOpener = ids.includes(opener.id);
                    const hasCloser = ids.includes(closer.id);
                    if (!hasOpener || !hasCloser) continue;
                    const mid = ids.filter((id) => id !== opener.id && id !== closer.id);
                    const next = [opener.id, ...mid, closer.id];
                    if (next.join('|') !== ids.join('|')) {
                        p.lineIds = next;
                        fixed += 1;
                    }
                }
                log.push(`✓ Loving the Bleach look: reordered ${fixed} paths so Hazard closer is last`);
            }
        }
    }

    // --- Truncated subtitle restore pass (all conversations) ---
    {
        let n = 0;
        for (const c of conversations) {
            for (const l of c.lines || []) {
                const next = restoreSubtitles(l.subtitles);
                if (next && next !== l.subtitles) {
                    l.subtitles = next;
                    n += 1;
                    log.push(`  text ← ${c.name} / ${l.hero}`);
                }
            }
        }
        log.push(`✓ restored ${n} truncated subtitles`);
    }

    if (!dryRun) {
        const payload = Array.isArray(raw) ? conversations : { ...raw, conversations };
        await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`);
        const assetsOut = await scanTheaterAssets();
        await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(assetsOut, null, 2)}\n`);
    }

    console.log(dryRun ? 'DRY RUN' : 'WRITE');
    for (const line of log) console.log(line);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
