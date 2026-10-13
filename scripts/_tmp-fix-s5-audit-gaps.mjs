#!/usr/bin/env node
/**
 * Fix Season 5 audit gaps from YouTube / extract (Doctrine interactions).
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    buildBlankConversationRecord,
    createDialogueLineId,
    DEFAULT_DIALOGUE_SCENE,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { nextConversationNumber } from '../src/features/dialogue-theater/data/dialogueTheaterConversationValidation.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const EXTRACT = path.join(process.env.USERPROFILE || '', 'OneDrive', 'Escritorio', 'ow models', 'HeroVoice');
const VOICELINES = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const THEATER_MANIFEST = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');
const CONV_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const ERA = 'Season 5 (YouTube placeholder)';
const ERA_45 = 'Season 4.5 (YouTube placeholder)';

function atlasVoice(hero, label) {
    const prefix = String(hero).replace(/ /g, '_');
    const body = String(label)
        .replace(/\.ogg$/i, '')
        .replace(/^[^]*?\.0B2-/i, '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

function labelFromBasename(name) {
    const m = String(name).match(/\.0B2-(.+)\.ogg$/i);
    return m ? m[1] : String(name).replace(/\.ogg$/i, '');
}

function cleanSubs(label) {
    return String(label || '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+\?/g, '?')
        .replace(/\s+!/g, '!')
        .replace(/\s+\./g, '.')
        .trim();
}

async function copyVoice(heroFolder, relParts, atlasHero) {
    const src = path.join(EXTRACT, heroFolder, ...relParts);
    if (!fs.existsSync(src)) throw new Error(`Missing extract: ${src}`);
    const label = labelFromBasename(path.basename(src));
    const voice = atlasVoice(atlasHero || heroFolder, label);
    const dest = path.join(VOICELINES, voice);
    await fsp.mkdir(VOICELINES, { recursive: true });
    if (!fs.existsSync(dest)) await fsp.copyFile(src, dest);
    return { voice, subtitles: cleanSubs(label), label };
}

function pickRender(hero, renders) {
    const list = renders?.[hero] || [];
    return list.find((n) => /heroic/i.test(n)) || list[0] || 'Heroic.png';
}

function makeLine(hero, voice, subtitles, render) {
    return {
        id: createDialogueLineId(),
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render,
        era: 'Overwatch',
        status: 'active',
    };
}

function findByHeroes(conversations, heroes) {
    const want = new Set(heroes.map((h) => h.toLowerCase()));
    return conversations.filter((c) => {
        const hs = new Set((c.lines || []).map((l) => String(l.hero || '').toLowerCase()));
        for (const w of want) if (!hs.has(w)) return false;
        return true;
    });
}

function hasSubtitle(conversations, re) {
    return conversations.some((c) => (c.lines || []).some((l) => re.test(String(l.subtitles || ''))));
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONV_PATH, 'utf8'));
    const conversations = Array.isArray(raw.conversations) ? raw.conversations : raw;
    const assets = await scanTheaterAssets();
    const renders = assets.renders || {};

    // Restore eras wiped by earlier silent saves / edit panel.
    let eraFixed = 0;
    for (const c of conversations) {
        const n = String(c.name || '').trim();
        if (!/^\d+$/.test(n)) continue;
        if (c.eraName) continue;
        const num = parseInt(n, 10);
        c.eraName = num <= 3 || num === 48 ? ERA_45 : ERA;
        eraFixed += 1;
    }
    console.log(`Restored eraName on ${eraFixed} numbered rows`);

    /** @type {string[]} */
    const notes = [];

    // --- Bastion war devastation ---
    {
        const exists = hasSubtitle(conversations, /war brought more than just this devastation/i);
        if (!exists) {
            const d = await copyVoice('Doctrine', ['MatchTalk', '00000006CF62.0B2-Your war brought more than just this devastation... would that we could return to a time before.ogg'], 'Doctrine');
            // Prefer new extract take
            const bNew = path.join(EXTRACT, 'Bastion', 'MatchTalk', '00000006CF53.0B2-(regretful beeps).ogg');
            const bOld = path.join(EXTRACT, 'Bastion', 'MatchTalk', '000000062BFB.0B2-(regretful beeps).ogg');
            const bSrc = fs.existsSync(bNew) ? bNew : bOld;
            const bVoice = 'Bastion_-_(regretful_beeps).ogg';
            const bDest = path.join(VOICELINES, bVoice);
            if (!fs.existsSync(bDest)) await fsp.copyFile(bSrc, bDest);
            const row = buildBlankConversationRecord();
            row.name = String(nextConversationNumber(conversations));
            row.eraName = ERA;
            row.scene = DEFAULT_DIALOGUE_SCENE;
            row.tags = ['Overwatch'];
            row.status = 'active';
            row.lines = [
                makeLine('Doctrine', d.voice, d.subtitles, pickRender('Doctrine', renders)),
                makeLine('Bastion', bVoice, '**regretful beeps**', pickRender('Bastion', renders)),
            ];
            conversations.push(row);
            notes.push(`+#${row.name} Doctrine ↔ Bastion (war devastation)`);
        } else {
            // Ensure Bastion line present on matching rows
            for (const c of conversations) {
                const hasWar = (c.lines || []).some((l) => /war brought more than just this devastation/i.test(l.subtitles || ''));
                if (!hasWar) continue;
                if ((c.lines || []).some((l) => l.hero === 'Bastion')) continue;
                const bVoice = 'Bastion_-_(regretful_beeps).ogg';
                const bNew = path.join(EXTRACT, 'Bastion', 'MatchTalk', '00000006CF53.0B2-(regretful beeps).ogg');
                if (!fs.existsSync(path.join(VOICELINES, bVoice)) && fs.existsSync(bNew)) {
                    await fsp.copyFile(bNew, path.join(VOICELINES, bVoice));
                }
                c.lines.push(makeLine('Bastion', bVoice, '**regretful beeps**', pickRender('Bastion', renders)));
                notes.push(`patched Bastion beeps onto #${c.name}`);
            }
        }
    }

    // --- D.Mon skincare / moisturizer (full 3-line) ---
    {
        const dmon = await copyVoice(
            'D.Mon',
            ['MatchTalk', "00000006CA56.0B2-I think you’re wasting your potential. You’d crush a skincare line.ogg"],
            'D.mon',
        );
        const doc = await copyVoice(
            'Doctrine',
            ['MatchTalk', '00000006CE11.0B2-My technology is grander than vanity. It prolongs life!.ogg'],
            'Doctrine',
        );
        const moist = await copyVoice(
            'D.Mon',
            ['MatchTalk', "00000006CA59.0B2-Right. I'll stick to moisturizer.ogg"],
            'D.mon',
        );
        const fullExists = conversations.some(
            (c) =>
                (c.lines || []).some((l) => /skincare line/i.test(l.subtitles || '')) &&
                (c.lines || []).some((l) => /grander than vanity|prolongs life/i.test(l.subtitles || '')),
        );
        if (!fullExists) {
            // Fix garbled #4 if it's moisturizer + doomfist
            const bad = conversations.find(
                (c) =>
                    String(c.name) === '4' &&
                    (c.lines || []).some((l) => /moisturizer/i.test(l.subtitles || '')) &&
                    (c.lines || []).some((l) => l.hero === 'Doomfist'),
            );
            const lines = [
                makeLine('D.mon', dmon.voice, dmon.subtitles, pickRender('D.mon', renders)),
                makeLine('Doctrine', doc.voice, doc.subtitles, pickRender('Doctrine', renders)),
                makeLine('D.mon', moist.voice, moist.subtitles, pickRender('D.mon', renders)),
            ];
            if (bad) {
                bad.lines = lines;
                bad.eraName = ERA;
                notes.push('rewrote #4 as Doctrine ↔ D.mon skincare');
            } else {
                const row = buildBlankConversationRecord();
                row.name = String(nextConversationNumber(conversations));
                row.eraName = ERA;
                row.scene = DEFAULT_DIALOGUE_SCENE;
                row.tags = ['Overwatch'];
                row.status = 'active';
                row.lines = lines;
                conversations.push(row);
                notes.push(`+#${row.name} Doctrine ↔ D.mon skincare`);
            }
        } else {
            notes.push('skincare dialogue already present');
        }
    }

    // --- Genji: add closing hope line ---
    {
        const genjiHope = await copyVoice(
            'Genji',
            ['MatchTalk', '00000006D1F4.0B2-That hope is not yours to hold.ogg'],
            'Genji',
        );
        let patched = false;
        for (const c of conversations) {
            const hasHopeOpen = (c.lines || []).some((l) =>
                /hope one day,\s*my brother may too appreciate/i.test(l.subtitles || ''),
            );
            if (!hasHopeOpen) continue;
            if ((c.lines || []).some((l) => /hope is not yours to hold/i.test(l.subtitles || ''))) continue;
            c.lines.push(makeLine('Genji', genjiHope.voice, genjiHope.subtitles, pickRender('Genji', renders)));
            c.eraName = c.eraName || ERA;
            notes.push(`+#${c.name} Genji closing hope line`);
            patched = true;
        }
        if (!patched && !hasSubtitle(conversations, /hope is not yours to hold/i)) {
            notes.push('WARN: no Genji/Doctrine hope opener found to attach closing line');
        }
    }

    // --- Queen: prepend live forever ---
    {
        const queen = await copyVoice(
            'Junker Queen',
            ['MatchTalk', '00000006CB1F.0B2-Alright. Can you make me live forever_.ogg'],
            'Junker Queen',
        );
        let patched = false;
        for (const c of conversations) {
            const hasForever = (c.lines || []).some((l) => /Forever demands sacrifice/i.test(l.subtitles || ''));
            const hasQueen = (c.lines || []).some((l) => l.hero === 'Junker Queen');
            if (!hasForever || !hasQueen) continue;
            if ((c.lines || []).some((l) => /live forever/i.test(l.subtitles || ''))) continue;
            c.lines = [
                makeLine('Junker Queen', queen.voice, queen.subtitles, pickRender('Junker Queen', renders)),
                ...c.lines,
            ];
            c.eraName = c.eraName || ERA;
            notes.push(`+#${c.name} Queen live-forever opener`);
            patched = true;
        }
        if (!patched) notes.push('WARN: no Doctrine/Queen forever exchange to prepend');
    }

    // --- Moira ×2 ---
    {
        if (!hasSubtitle(conversations, /aesthetics of eternal life/i)) {
            const moira = await copyVoice(
                'Moira',
                ['MatchTalk', '00000006D204.0B2-The attention you place on the aesthetics of eternal life seems rather... inefficient.ogg'],
                'Moira',
            );
            const doc = await copyVoice(
                'Doctrine',
                ['MatchTalk', '00000006CF58.0B2-Living endlessly warrants more than the _efficient_ regeneration of cells.ogg'],
                'Doctrine',
            );
            const row = buildBlankConversationRecord();
            row.name = String(nextConversationNumber(conversations));
            row.eraName = ERA;
            row.scene = DEFAULT_DIALOGUE_SCENE;
            row.tags = ['Overwatch'];
            row.status = 'active';
            row.lines = [
                makeLine('Moira', moira.voice, moira.subtitles, pickRender('Moira', renders)),
                makeLine('Doctrine', doc.voice, doc.subtitles, pickRender('Doctrine', renders)),
            ];
            conversations.push(row);
            notes.push(`+#${row.name} Moira ↔ Doctrine (aesthetics)`);
        }
        if (!hasSubtitle(conversations, /arm is grotesque/i)) {
            const doc1 = await copyVoice(
                'Doctrine',
                ['MatchTalk', '00000006CF5A.0B2-Oh. That arm is grotesque, Doctor. Shall I do the honors of mending it for you_.ogg'],
                'Doctrine',
            );
            const moira = await copyVoice(
                'Moira',
                ['MatchTalk', '00000006D205.0B2-There is no part of me that needs correcting.ogg'],
                'Moira',
            );
            const doc2 = await copyVoice(
                'Doctrine',
                ['MatchTalk', '00000006CF59.0B2-I have heard as much from even those dearest to me... how such sentiment rives my heart.ogg'],
                'Doctrine',
            );
            const row = buildBlankConversationRecord();
            row.name = String(nextConversationNumber(conversations));
            row.eraName = ERA;
            row.scene = DEFAULT_DIALOGUE_SCENE;
            row.tags = ['Overwatch'];
            row.status = 'active';
            row.lines = [
                makeLine('Doctrine', doc1.voice, doc1.subtitles, pickRender('Doctrine', renders)),
                makeLine('Moira', moira.voice, moira.subtitles, pickRender('Moira', renders)),
                makeLine('Doctrine', doc2.voice, doc2.subtitles, pickRender('Doctrine', renders)),
            ];
            conversations.push(row);
            notes.push(`+#${row.name} Doctrine ↔ Moira (grotesque arm)`);
        }
    }

    // --- Orisa (middle line only exists under Lifeweaver extract — wire as Doctrine speech) ---
    {
        const hasOrisaDoc = conversations.some((c) => {
            const hs = new Set((c.lines || []).map((l) => l.hero));
            return hs.has('Orisa') && hs.has('Doctrine');
        });
        if (!hasOrisaDoc) {
            const o1 = await copyVoice(
                'Orisa',
                ['MatchTalk', '00000006C91E.0B2-You know the devastation Doomfist causes, yet you still rebuilt his gauntlet_.ogg'],
                'Orisa',
            );
            // Extract only has this take under Lifeweaver; attribute to Doctrine for this interaction.
            const midSrc = path.join(
                EXTRACT,
                'Lifeweaver',
                'MatchTalk',
                '00000006CF5E.0B2-Were you not once drawn from ruin into new life_ Creation demands its dues.ogg',
            );
            const midLabel = labelFromBasename(path.basename(midSrc));
            const midVoice = atlasVoice('Doctrine', midLabel);
            const midDest = path.join(VOICELINES, midVoice);
            if (!fs.existsSync(midDest)) await fsp.copyFile(midSrc, midDest);
            const o2 = await copyVoice(
                'Orisa',
                ['MatchTalk', '00000006C925.0B2-Efi created me to protect our home. What you have made will only bring harm to this world.ogg'],
                'Orisa',
            );
            // Prefer rewriting garbled #7 (Orisa+Lifeweaver)
            const bad = conversations.find(
                (c) =>
                    String(c.name) === '7' &&
                    (c.lines || []).some((l) => l.hero === 'Orisa') &&
                    (c.lines || []).some((l) => l.hero === 'Lifeweaver'),
            );
            const lines = [
                makeLine('Orisa', o1.voice, o1.subtitles, pickRender('Orisa', renders)),
                makeLine('Doctrine', midVoice, cleanSubs(midLabel), pickRender('Doctrine', renders)),
                makeLine('Orisa', o2.voice, o2.subtitles, pickRender('Orisa', renders)),
            ];
            if (bad) {
                bad.lines = lines;
                bad.eraName = ERA;
                notes.push('rewrote #7 as Orisa ↔ Doctrine');
            } else {
                const row = buildBlankConversationRecord();
                row.name = String(nextConversationNumber(conversations));
                row.eraName = ERA;
                row.scene = DEFAULT_DIALOGUE_SCENE;
                row.tags = ['Overwatch'];
                row.status = 'active';
                row.lines = lines;
                conversations.push(row);
                notes.push(`+#${row.name} Orisa ↔ Doctrine`);
            }
        }
    }

    // --- Aquatic leech → Favorite Animals ---
    {
        const fav = conversations.find((c) => /favorite animals?/i.test(String(c.name || '')));
        if (!fav) {
            notes.push('WARN: Favorite Animals entry missing');
        } else if (!(fav.lines || []).some((l) => l.hero === 'Doctrine' && /aquatic leech/i.test(l.subtitles || ''))) {
            const leech = await copyVoice('Doctrine', ['MatchTalk', '00000006D3D2.0B2-The aquatic leech.ogg'], 'Doctrine');
            const lucioSee = (fav.lines || []).find((l) => l.hero === 'Lúcio' && /i can see it/i.test(l.subtitles || ''));
            const insertAt = lucioSee
                ? fav.lines.indexOf(lucioSee)
                : fav.lines.findIndex((l) => l.hero === 'Lúcio' && /favorite animal/i.test(l.subtitles || '')) + 1;
            const line = makeLine('Doctrine', leech.voice, leech.subtitles, pickRender('Doctrine', renders));
            const idx = insertAt > 0 ? insertAt : fav.lines.length;
            // Place after Lucio's question if possible
            const askIdx = (fav.lines || []).findIndex(
                (l) => l.hero === 'Lúcio' && /favorite animal/i.test(l.subtitles || ''),
            );
            if (askIdx >= 0) {
                fav.lines.splice(askIdx + 1, 0, line);
                // Keep a "I can see it" after if not already right after — Favorite Animals already has shared closer lines
            } else {
                fav.lines.splice(idx, 0, line);
            }
            notes.push('added Doctrine aquatic leech to Favorite Animals');
        } else {
            notes.push('aquatic leech already in Favorite Animals');
        }
    }

    // --- Re-add brave kitty if missing ---
    {
        if (!hasSubtitle(conversations, /brave kitty,\s*Fika/i)) {
            const dvaSrc = path.join(
                EXTRACT,
                'D.Va',
                'MatchTalk',
                "00000006C881.0B2-You're such a brave kitty, Fika! You're the only cat I know who likes flying as much as I do! (sigh).ogg",
            );
            const catSrc = path.join(EXTRACT, 'Jetpack Cat', 'MatchTalk', '(Pleased purr)', '00000033F3B4.03F.ogg');
            const dvaVoice =
                "D.Va_-_You're_such_a_brave_kitty,_Fika!_You're_the_only_cat_I_know_who_likes_flying_as_much_as_I_do!_(sigh).ogg";
            const catVoice = 'Jetpack_Cat_-_(Pleased_purr).ogg';
            if (fs.existsSync(dvaSrc) && !fs.existsSync(path.join(VOICELINES, dvaVoice))) {
                await fsp.copyFile(dvaSrc, path.join(VOICELINES, dvaVoice));
            }
            if (fs.existsSync(catSrc) && !fs.existsSync(path.join(VOICELINES, catVoice))) {
                await fsp.copyFile(catSrc, path.join(VOICELINES, catVoice));
            }
            const row = buildBlankConversationRecord();
            row.name = String(nextConversationNumber(conversations));
            row.eraName = ERA_45;
            row.scene = DEFAULT_DIALOGUE_SCENE;
            row.tags = ['Overwatch'];
            row.status = 'active';
            row.lines = [
                makeLine(
                    'D.va',
                    dvaVoice,
                    "You're such a brave kitty, Fika! You're the only cat I know who likes flying as much as I do! *sigh*",
                    pickRender('D.va', renders),
                ),
                makeLine('Jetpack Cat', catVoice, '**pleased purr**', pickRender('Jetpack Cat', renders)),
            ];
            conversations.push(row);
            notes.push(`+#${row.name} D.Va ↔ Jetpack Cat brave kitty`);
        }
    }

    raw.conversations = conversations;
    raw._meta = raw._meta || {};
    raw._meta.s5AuditGapsFixedAt = new Date().toISOString();
    await fsp.writeFile(CONV_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const theaterAssets = await scanTheaterAssets();
    await fsp.writeFile(THEATER_MANIFEST, `${JSON.stringify(theaterAssets, null, 2)}\n`, 'utf8');
    console.log(notes.join('\n'));
    console.log('Done.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
