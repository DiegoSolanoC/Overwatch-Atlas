#!/usr/bin/env node
/**
 * Freja pass repairs:
 * - Merge Ashe Grand Mesa into Don't need Saving (Emre / Freja multipath); purge #410 dupe
 * - Merge Naughton Vault + Let this one go into one Sierra/Freja conversation
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createDialogueLineId,
    createDialoguePathId,
} from '../src/features/dialogue-theater/data/dialogueTheaterConversationSchema.js';
import { scanTheaterAssets } from './import-interaction-folder.mjs';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '..');
const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const MANIFEST_PATH = path.join(REPO, 'src/data/dialogue-theater/theater-assets-manifest.json');

const PURGE_IDS = [
    '9844aacf-6de1-478a-8c5e-fea12ef9c970', // Freja-only Grand Mesa dupe (#410)
    '2ab9a0fe-2730-496a-99ac-6c7cc87f10f1', // Let this one go (merge into Naughton Vault)
];

function keepId(lines, pred) {
    return (lines || []).find(pred)?.id || createDialogueLineId();
}

function makeLine(id, hero, subtitles, voice) {
    return {
        id,
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render: 'Heroic.png',
    };
}

async function main() {
    const raw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const done = [];

    // Collect Freja closer from #410 before purge
    const frejaDupe = raw.conversations.find((c) => c.id === '9844aacf-6de1-478a-8c5e-fea12ef9c970');
    const letGo = raw.conversations.find((c) => c.id === '2ab9a0fe-2730-496a-99ac-6c7cc87f10f1');

    raw.conversations = raw.conversations.filter((c) => !PURGE_IDS.includes(c.id));
    raw._meta = {
        ...(raw._meta && typeof raw._meta === 'object' ? raw._meta : {}),
        purgedConversationIds: [
            ...new Set([
                ...((raw._meta && raw._meta.purgedConversationIds) || []),
                ...PURGE_IDS,
            ]),
        ],
    };

    // --- Don't need Saving multipath ---
    {
        const c =
            raw.conversations.find((x) => x.id === 'f426b03e-b20e-4b52-8273-dc911fed6e17') ||
            raw.conversations.find((x) =>
                (x.lines || []).some((l) => /won't need saving/i.test(String(l.subtitles || ''))),
            );
        if (!c) throw new Error("Don't need Saving not found");

        const opener = makeLine(
            keepId(c.lines, (l) => /Grand Mesa/i.test(l.subtitles || '')),
            'Ashe',
            "You'd better do quick work in Grand Mesa. Your boss paid for a distraction, not a rescue.",
            "Ashe_-_You'd_better_do_quick_work_in_Grand_Mesa._Your_boss_paid_for_a_distraction,_not_a_rescue.ogg",
        );
        const emre = makeLine(
            keepId(c.lines, (l) => /won't need saving/i.test(l.subtitles || '')),
            'Emre',
            "I won't need saving, but you're the last person I'd call for help if I did.",
            "Emre_-_I_won't_need_saving,_but_you're_the_last_person_I'd_call_for_help_if_I_did.ogg",
        );
        const frejaId =
            (frejaDupe?.lines || []).find((l) =>
                /worry about your people/i.test(String(l.subtitles || '')),
            )?.id ||
            (c.lines || []).find((l) =>
                /worry about your people/i.test(String(l.subtitles || '')),
            )?.id ||
            createDialogueLineId();
        const freja = makeLine(
            frejaId,
            'Freja',
            "You worry about your people. I'll worry about mine.",
            "Freja_-_You_worry_about_your_people._I'll_worry_about_mine.ogg",
        );

        c.name = "Don't need Saving";
        c.lines = [opener, emre, freja];
        c.paths = [
            {
                id: createDialoguePathId(),
                label: 'Emre',
                lineIds: [opener.id, emre.id],
            },
            {
                id: createDialoguePathId(),
                label: 'Freja',
                lineIds: [opener.id, freja.id],
            },
        ];
        c.selectedPathId = c.paths[0].id;
        done.push("Don't need Saving → Emre/Freja multipath");
    }

    // --- Naughton Vault merge ---
    {
        const c =
            raw.conversations.find((x) => x.id === 'dec7d21d-1616-4f71-9ded-b3aa03cf4f36') ||
            raw.conversations.find((x) =>
                (x.lines || []).some((l) => /Naughton Vault/i.test(String(l.subtitles || ''))),
            );
        if (!c) throw new Error('Naughton Vault not found');

        const vault = makeLine(
            keepId(c.lines, (l) => /Naughton Vault/i.test(l.subtitles || '')),
            'Sierra',
            "The Naughton Vault requires top security clearance. How'd you get your intel?",
            "Sierra_-_The_Naughton_Vault_requires_top_security_clearance._How'd_you_get_your_intel_.ogg",
        );
        const conf = makeLine(
            keepId(c.lines, (l) => /Confidentiality/i.test(l.subtitles || '')),
            'Freja',
            "Sorry, kid. Confidentiality's just as important in my line of work as it is in yours.",
            "Freja_-_Sorry,_kid._Confidentiality's_just_as_important_in_my_line_of_work_as_it_is_in_yours.ogg",
        );
        const answers = makeLine(
            keepId(letGo?.lines, (l) => /have to get answers/i.test(l.subtitles || '')),
            'Sierra',
            'Then as a professional, you know I have to get answers.',
            'Sierra_-_Then_as_a_professional,_you_know_I_have_to_get_answers.ogg',
        );
        const go = makeLine(
            keepId(letGo?.lines, (l) => /Let this one go/i.test(l.subtitles || '')),
            'Freja',
            'Let this one go. For your own good.',
            'Freja_-_Let_this_one_go._For_your_own_good.ogg',
        );

        c.name = 'Naughton Vault';
        c.lines = [vault, conf, answers, go];
        delete c.paths;
        delete c.selectedPathId;
        done.push('Naughton Vault — reunited 4-line exchange');
    }

    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');
    console.log(`Done:\n- ${done.join('\n- ')}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
