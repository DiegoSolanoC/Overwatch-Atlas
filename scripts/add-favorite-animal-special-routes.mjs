#!/usr/bin/env node
/**
 * Add Domina + Kiriko (tree frog) alternate routes and rename multi-variant path labels.
 */

import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { absFromPublic, FILES } = require('../src/data/registry.cjs');

const CONVERSATIONS_PATH = absFromPublic(FILES.dialogueTheater.conversations);
const CONVERSATION_ID = '8974246a-ee27-4a5b-a5ec-132a459895a3';

/** @type {Record<string, string>} */
const PATH_LABEL_UPDATES = {
    'e73ff9b4-5156-41fa-ad4e-03de6441d5bf': 'Cassidy — Tapir (dangly nose)',
    '93144da9-9379-453d-8c2f-d172c856d082': 'Cassidy — Fancy jungle pig',
    '47fd011e-e021-42bb-8a34-422b066d7a2f': 'Cassidy — Funky snout',
    'f19cd5a7-6f9a-4157-8302-84db2b5a021a': 'Echo — Triceratops',
    'e2aeafef-8004-4811-90d7-68ef9643c890': 'Echo — Kangal',
    'e31f1bd9-84dd-4ccf-9c2a-9f796c606fe5': 'Echo — Rhinoceros',
    '9d0aa560-9e4f-4e23-bc14-09bf73cfcbad': 'Echo — Tiger shark',
    'e51d65f9-608f-4f0e-8cf2-ef0369ece987': 'Echo — Dragonfly',
    '993c7327-6c7e-4c8c-916d-e3708dfe8b6e': 'Echo — Penguin',
    'af597e2d-4e29-4b53-a354-b18dccde5a4a': 'Echo — Jack Russell Terrier',
    '58932ad6-6e51-47ba-8d3e-882c1847708a': 'Echo — Unicorn',
    '16641a79-28d1-445d-9ca1-1688a85a96a5': 'Kiriko — Fox (take a guess)',
};

/** Lines copied from existing Lúcio interaction conversations. */
const LINES_TO_ADD = [
    {
        id: '18fce77a-81ac-45e6-bfc8-e957b144433b',
        hero: 'Domina',
        voice: 'Domina_-_Aren\'t_you_going_to_ask_about_my_favorite_little_creature.ogg',
        subtitles: 'Aren\'t you going to ask about *my* favorite little creature?',
        render: 'Heroic.png',
    },
    {
        id: '0962d75b-864d-409b-bc2b-a60424ec7c78',
        hero: 'Lúcio',
        voice: 'Lúcio_-_Alright,_fine._What\'s_your_favorite_animal.ogg',
        subtitles: 'Alright, fine. What\'s your favorite animal?',
        render: '',
    },
    {
        id: '6451c4df-d9a5-40f4-a8a8-ff2eb8c8a96f',
        hero: 'Domina',
        voice: 'Domina_-_Oh,_well_I_find_chinchillas_absolutely_adorable!_And_they_make_the_softest_coats.ogg',
        subtitles: 'Oh, well, I find chinchillas absolutely adorable! And they make the softest coats...',
        render: 'Heroic.png',
    },
    {
        id: '1fc2ac54-ceba-4518-9fd5-cf62c3ae8def',
        hero: 'Lúcio',
        voice: 'Lúcio_-_Yeah,_I_can_see_it.ogg',
        subtitles: '**sigh** Yeah. I can see it...',
        render: '',
    },
    {
        id: '09361376-e993-4543-bd4a-44d9f65c5cf5',
        hero: 'Kiriko',
        voice: 'Kiriko_-_So_DJ..._what\'s_your_favorite_animal.ogg',
        subtitles: 'So, DJ... what\'s your favorite animal?',
        render: 'Heroic.png',
    },
    {
        id: '32ab0444-9850-43de-bd7e-4553e3cab304',
        hero: 'Lúcio',
        voice: 'Lúcio_-_Oh!_Uh,_well..._I_really_like_treefrogs!_Heh,_I_didn\'t_expect_anyone_to_ask.ogg',
        subtitles: 'Oh! Uh, well... I really like tree frogs! Heh, I didn\'t expect anyone to ask.',
        render: '',
    },
    {
        id: '98bf6e03-ce7a-460b-a2e2-765fbe853aad',
        hero: 'Kiriko',
        voice: 'Kiriko_-_Treefrogs._Yeah,_I_can_see_it.ogg',
        subtitles: 'Tree frogs? Yeah, I can see it! **chuckle**',
        render: 'Heroic.png',
    },
];

const NEW_PATHS = [
    {
        id: randomUUID(),
        label: 'Domina — Chinchillas',
        lineIds: [
            '18fce77a-81ac-45e6-bfc8-e957b144433b',
            '0962d75b-864d-409b-bc2b-a60424ec7c78',
            '6451c4df-d9a5-40f4-a8a8-ff2eb8c8a96f',
            '1fc2ac54-ceba-4518-9fd5-cf62c3ae8def',
        ],
    },
    {
        id: randomUUID(),
        label: 'Lúcio — Tree frogs',
        lineIds: [
            '09361376-e993-4543-bd4a-44d9f65c5cf5',
            '32ab0444-9850-43de-bd7e-4553e3cab304',
            '98bf6e03-ce7a-460b-a2e2-765fbe853aad',
        ],
    },
];

const raw = await fs.readFile(CONVERSATIONS_PATH, 'utf8');
/** @type {{ conversations: object[] }} */
const data = JSON.parse(raw);
const conversation = data.conversations.find((row) => row.id === CONVERSATION_ID);
if (!conversation) {
    throw new Error(`Conversation not found: ${CONVERSATION_ID}`);
}

const lineIds = new Set((conversation.lines || []).map((line) => line.id));
for (const line of LINES_TO_ADD) {
    if (!lineIds.has(line.id)) {
        conversation.lines.push(line);
        lineIds.add(line.id);
    }
}

for (const path of conversation.paths || []) {
    if (PATH_LABEL_UPDATES[path.id]) {
        path.label = PATH_LABEL_UPDATES[path.id];
    }
}

const existingPathKeys = new Set(
    (conversation.paths || []).map((path) => path.lineIds.join('|')),
);
for (const path of NEW_PATHS) {
    const key = path.lineIds.join('|');
    if (!existingPathKeys.has(key)) {
        conversation.paths.push(path);
        existingPathKeys.add(key);
    }
}

conversation.paths.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

await fs.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
console.log(`Favorite Animal: ${conversation.lines.length} lines, ${conversation.paths.length} paths`);
