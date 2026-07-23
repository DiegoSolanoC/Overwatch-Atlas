#!/usr/bin/env node
/**
 * Midseason 3 pass:
 * - Insert Bastion beep / Jetpack Cat meow lines the YouTube ASR missed
 * - Split merged spoken lines that sandwich those SFX
 * - Rebuild Zarya/Ana "Crazy story" as a 4-path multipath
 * - Split Sojourn/Vendetta stand-down from Sierra/Hanzo grieving
 * - Copy MatchTalk SFX oggs into Theater/Voicelines
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import {
    createConversationId,
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
const VOICELINES_DIR = path.join(REPO, 'src/assets/audio/Theater/Voicelines');
const EXTRACT_ROOT = path.join(
    process.env.USERPROFILE || '',
    'OneDrive',
    'Escritorio',
    'ow models',
    'HeroVoice',
);

const ERA = 'Midseason 3 (YouTube placeholder)';

/**
 * @param {string} hero
 * @param {string} subtitles
 * @param {string} [voice]
 * @param {string} [render]
 */
function makeLine(hero, subtitles, voice = '', render = 'Heroic.png') {
    return {
        id: createDialogueLineId(),
        hero,
        voice,
        voicePrefix: '',
        subtitles,
        render,
    };
}

/**
 * @param {object[]} conversations
 * @param {(c: object) => boolean} pred
 */
function findConv(conversations, pred) {
    return conversations.find((c) => String(c?.eraName || '') === ERA && pred(c)) || null;
}

/**
 * Prefer keeping existing line ids/voices when subtitles/hero match.
 * @param {object[]} existing
 * @param {object[]} next
 */
function reuseLines(existing, next) {
    const pool = [...(existing || [])];
    return next.map((line) => {
        const idx = pool.findIndex(
            (old) =>
                String(old?.hero || '') === line.hero &&
                String(old?.subtitles || '').trim() === String(line.subtitles || '').trim(),
        );
        if (idx >= 0) {
            const old = pool.splice(idx, 1)[0];
            return {
                ...line,
                id: old.id || line.id,
                voice: line.voice || old.voice || '',
                voicePrefix: old.voicePrefix || '',
                render: line.render || old.render || 'Heroic.png',
            };
        }
        const soft = pool.findIndex(
            (old) =>
                String(old?.hero || '') === line.hero &&
                String(old?.voice || '') &&
                line.voice &&
                String(old.voice) === line.voice,
        );
        if (soft >= 0) {
            const old = pool.splice(soft, 1)[0];
            return {
                ...line,
                id: old.id || line.id,
                voicePrefix: old.voicePrefix || '',
                render: line.render || old.render || 'Heroic.png',
            };
        }
        return line;
    });
}

/**
 * @param {string} heroFolder
 * @param {string} labelContains  normalized fragment of MatchTalk label
 */
function findMatchTalkOgg(heroFolder, labelContains) {
    const dir = path.join(EXTRACT_ROOT, heroFolder, 'MatchTalk');
    if (!fs.existsSync(dir)) return null;
    const needle = String(labelContains || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
    const files = fs.readdirSync(dir).filter((name) => /\.ogg$/i.test(name) && /\.0B2-/i.test(name));
    const hit = files.find((name) => {
        const label = name.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
        const norm = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        return norm === needle || norm.includes(needle);
    });
    return hit ? path.join(dir, hit) : null;
}

/**
 * @param {string} hero
 * @param {string} label  e.g. "(swooning beeps)"
 */
function atlasNameForSfx(hero, label) {
    const prefix = String(hero || '').replace(/ /g, '_');
    const body = String(label || '')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/ /g, '_');
    return `${prefix}_-_${body}.ogg`;
}

/** @type {Map<string, string>} atlasName -> source path */
const toCopy = new Map();

/**
 * @param {string} hero
 * @param {string} label
 * @param {string} [heroFolder]
 */
function sfxVoice(hero, label, heroFolder = hero) {
    const atlas = atlasNameForSfx(hero, label);
    const source = findMatchTalkOgg(heroFolder, label);
    if (source) toCopy.set(atlas, source);
    return atlas;
}

/**
 * @param {string} hero
 * @param {string} labelContains
 * @param {string} [heroFolder]
 */
function dialogueVoice(hero, labelContains, heroFolder = hero) {
    const source = findMatchTalkOgg(heroFolder, labelContains);
    if (!source) return '';
    const base = path.basename(source);
    const label = base.replace(/^[^-]+-(.+)\.ogg$/i, '$1');
    const atlas = atlasNameForSfx(hero, label);
    toCopy.set(atlas, source);
    return atlas;
}

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const convRaw = JSON.parse(await fsp.readFile(CONVERSATIONS_PATH, 'utf8'));
    const conversations = Array.isArray(convRaw.conversations) ? convRaw.conversations : convRaw;

    let touched = 0;

    // --- Bastion / Lifeweaver compliment ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1010' ||
                (c.lines || []).some((l) =>
                    String(l.subtitles || '').includes('compliment when I hear one'),
                ),
        );
        if (conv) {
            conv.name = 'Compliment when I hear one';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Bastion',
                    '*(swooning beeps)*',
                    sfxVoice('Bastion', '(swooning beeps)'),
                ),
                makeLine(
                    'Lifeweaver',
                    "I'm not quite sure what you said, but I know a compliment when I hear one.",
                    dialogueVoice('Lifeweaver', 'compliment when I hear one') ||
                        "Lifeweaver_-_I'm_not_quite_sure_what_you_said,_but_I_know_a_compliment_when_I_hear_one.ogg",
                ),
                makeLine(
                    'Bastion',
                    '*(bashful beeps)*',
                    sfxVoice('Bastion', '(bashful beeps)'),
                ),
            ]);
            delete conv.paths;
            delete conv.selectedPathId;
            touched += 1;
        }
    }

    // --- Bird in a cage ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1011' ||
                (c.lines || []).some((l) => String(l.subtitles || '').includes('bird in a cage')),
        );
        if (conv) {
            conv.name = 'Bird in a cage';
            conv.lines = reuseLines(conv.lines, [
                makeLine('Bastion', '*(melodic beeps)*', sfxVoice('Bastion', '(melodic beeps)')),
                makeLine(
                    'Shion',
                    "Enough. One more note, and I'm putting that bird in a cage.",
                    dialogueVoice('Shion', 'putting that bird in a cage') ||
                        "Shion_-_Enough!_One_more_note,_and_I'm_putting_that_bird_in_a_cage.ogg",
                ),
                makeLine(
                    'Bastion',
                    '*(horrified beeps)*',
                    sfxVoice('Bastion', '(horrified beeps)'),
                ),
                makeLine(
                    'Shion',
                    "What? You don't like that? Fine. Then I'll clip its wings instead.",
                    dialogueVoice('Shion', 'clip its wings') ||
                        "Shion_-_What,_you_don't_like_that__Fine._Then_I'll_clip_its_wings,_instead.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Freja / Bastion harboring ---
    {
        const conv = findConv(conversations, (c) =>
            (c.lines || []).some((l) => String(l.subtitles || '').includes('harboring')),
        );
        if (conv) {
            conv.name = 'Torbjörn harboring Efi';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Freja',
                    "Torbjörn Lindholm harboring an Efi Oladele. Never thought I'd see the day.",
                    dialogueVoice('Freja', 'harboring an E54') ||
                        "Freja_-_Torbjörn_Lindholm_harboring_an_E54..._never_thought_I'd_see_the_day.ogg",
                ),
                makeLine('Bastion', '*(refuting beeps)*', sfxVoice('Bastion', '(refuting beeps)')),
                makeLine(
                    'Freja',
                    "Ask him yourself, but it's not my story to tell.",
                    dialogueVoice('Freja', 'Ask him yourself') ||
                        "Freja_-_Ask_him_yourself,_bot._It's_not_my_story_to_tell.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Finals / fighting about to start ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1015' ||
                (c.lines || []).some((l) =>
                    /Finals about to start|Fighting's about to start|Time to do what they built you for/i.test(
                        String(l.subtitles || ''),
                    ),
                ),
        );
        if (conv) {
            conv.name = 'Finals about to start';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Freja',
                    'Finals about to start. Time to do what they built you for.',
                    dialogueVoice('Freja', "Fighting's about to start") ||
                        "Freja_-_Fighting's_about_to_start._Time_to_do_what_they_built_you_for.ogg",
                ),
                makeLine(
                    'Bastion',
                    '*(cautious, inquiring beeps)*',
                    sfxVoice('Bastion', '(cautious, inquiring beeps)'),
                ),
                makeLine(
                    'Freja',
                    "They think you're still a killing machine, even if you're wearing a hat.",
                    dialogueVoice('Freja', 'killing machine') ||
                        "Freja_-_You're_still_a_killing_machine,_even_if_you're_wearing_a_hat.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Hazard junkers ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1022' ||
                (c.lines || []).some((l) =>
                    String(l.subtitles || '').includes('junkers starts giving you trouble'),
                ),
        );
        if (conv) {
            conv.name = 'Junkers giving you trouble';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Hazard',
                    'Second one of those junkers starts giving you trouble, just let me know, will you?',
                    dialogueVoice('Hazard', 'giving you trouble') ||
                        'Hazard_-_Second_one_of_those_Junkers_starts_giving_you_trouble_just_let_me_know,_will_you_.ogg',
                ),
                makeLine(
                    'Bastion',
                    '*(appreciative beeps)*',
                    sfxVoice('Bastion', '(appreciative beeps)'),
                ),
            ]);
            touched += 1;
        }
    }

    // --- Hazard more than made for ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1023' ||
                (c.lines || []).some((l) =>
                    /wrong idea about you|more than we.?re made for|more than we were made for/i.test(
                        String(l.subtitles || ''),
                    ),
                ),
        );
        if (conv) {
            conv.name = 'More than we are made for';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Hazard',
                    'Folks get the wrong idea about you often, Bastion.',
                    dialogueVoice('Hazard', 'wrong idea about you') ||
                        'Hazard_-_Folk_get_the_wrong_idea_about_you_often,_Bastion_.ogg',
                ),
                makeLine(
                    'Bastion',
                    '*(sad, affirmative beep)*',
                    sfxVoice('Bastion', '(sad, affirmative beep)'),
                ),
                makeLine(
                    'Hazard',
                    "But you can't let it get you down. We're more than we're made for.",
                    dialogueVoice('Hazard', 'more than we were made for') ||
                        "Hazard_-_Well,_you_cannae_let_it_get_you_down._We're_more_than_we_were_made_for.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Illari vicuña ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1026' ||
                (c.lines || []).some((l) => String(l.subtitles || '').includes('vicuña')),
        );
        if (conv) {
            conv.name = 'Sound of a vicuña';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Illari',
                    'Can you make the sound of a vicuña?',
                    dialogueVoice('Illari', 'sound of a vicu') ||
                        'Illari_-_Can_you_make_the_sound_of_a_vicuña_.ogg',
                ),
                makeLine('Bastion', '*(vicuña noises)*', sfxVoice('Bastion', '(vicuña noises)')),
                makeLine(
                    'Illari',
                    "That was pretty close. I'm impressed.",
                    dialogueVoice('Illari', 'pretty close') ||
                        "Illari_-_That_was_pretty_close._I'm_impressed.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Mauga carnage ---
    {
        const conv = findConv(conversations, (c) =>
            (c.lines || []).some((l) => String(l.subtitles || '').includes('carnage you guys dish')),
        );
        if (conv) {
            conv.name = 'Big fan of the carnage';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Mauga',
                    'Woah, a Bastion unit. Big fan of the carnage you guys dish out.',
                    dialogueVoice('Mauga', 'carnage you guys dish') ||
                        'Mauga_-_Whoa,_a_Bastion_unit._Big_fan_of_the_carnage_you_guys_dish_out!.ogg',
                ),
                makeLine(
                    'Bastion',
                    '*(nervous protesting beeps)*',
                    sfxVoice('Bastion', '(nervous protesting beeps)'),
                ),
                makeLine(
                    'Mauga',
                    "Don't be shy. Take the credit where it's due.",
                    dialogueVoice('Mauga', "Don't be shy") ||
                        "Mauga_-_Don't_be_shy!_Take_the_credit_where_it's_due.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Mei asleep ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1036' ||
                (c.lines || []).some((l) =>
                    String(l.subtitles || '').includes('asleep for a long time'),
                ),
        );
        if (conv) {
            conv.name = 'Asleep for a long time';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Mei',
                    "You were asleep for a long time, too, weren't you?",
                    dialogueVoice('Mei', 'asleep for a long time') ||
                        "Mei_-_You_were_asleep_for_a_long_time_too,_weren't_you_.ogg",
                ),
                makeLine('Bastion', '*(nodding beeps)*', sfxVoice('Bastion', '(nodding beeps)')),
                makeLine(
                    'Mei',
                    "Well, we don't have to be lonely anymore. Not with all the friends we have in Overwatch.",
                    dialogueVoice('Mei', "don't have to be lonely") ||
                        "Mei_-_Well,_we_don't_have_to_be_lonely_anymore._Not_with_all_the_friends_we_have_in_Overwatch!.ogg",
                ),
                makeLine('Bastion', '*(excited beeps)*', sfxVoice('Bastion', '(excited beeps)')),
            ]);
            touched += 1;
        }
    }

    // --- Ramattra nap ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1037' ||
                (c.lines || []).some((l) =>
                    String(l.subtitles || '').includes('survive the years after the crisis'),
                ),
        );
        if (conv) {
            conv.name = 'Survive after the crisis';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Ramattra',
                    'How did you survive the years after the crisis?',
                    dialogueVoice('Ramattra', 'survive the years after the Crisis') ||
                        'Ramattra_-_How_did_you_survive_the_years_after_the_Crisis_.ogg',
                ),
                makeLine('Bastion', '*(snoring beeps)*', sfxVoice('Bastion', '(snoring beeps)')),
                makeLine(
                    'Ramattra',
                    "That's rather a long nap.",
                    dialogueVoice('Ramattra', 'rather a long nap') ||
                        "Ramattra_-_That's_rather_a_long_nap.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Reinhardt victory (keep ALL CAPS — shout lines) ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1042' ||
                (c.lines || []).some((l) =>
                    /ACHIEVE VICTORY AT ALL COSTS|achieve victory at all costs/i.test(
                        String(l.subtitles || ''),
                    ),
                ),
        );
        if (conv) {
            conv.name = 'Victory at all costs';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Reinhardt',
                    'ALL RIGHT, WARRIORS. ARE WE READY TO ACHIEVE VICTORY AT ALL COSTS?',
                    dialogueVoice('Reinhardt', 'achieve victory at all costs') ||
                        'Reinhardt_-_All_right,_warriors__are_we_ready_to_achieve_victory_at_all_costs_.ogg',
                ),
                makeLine('Bastion', '*(eager beeps)*', sfxVoice('Bastion', '(eager beeps)')),
                makeLine(
                    'Reinhardt',
                    'HUH. I WILL TAKE THAT AS A YES.',
                    dialogueVoice('Reinhardt', 'take that as a yes') ||
                        'Reinhardt_-_Ahem..._I_will_take_that_as_a_yes!.ogg',
                ),
            ]);
            touched += 1;
        }
    }

    // --- Shion rain bullets ---
    {
        const conv = findConv(conversations, (c) =>
            (c.lines || []).some((l) => String(l.subtitles || '').includes('rain bullets')),
        );
        if (conv) {
            conv.name = 'Rain bullets';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Shion',
                    "You still know how to rain bullets, don't you? I think our enemies might look better bullet-ridden.",
                    dialogueVoice('Shion', 'rain bullets') ||
                        "Shion_-_You_still_know_how_to_rain_bullets,_don't_you__I_think_our_enemies_might_look_better_bleeding.ogg",
                ),
                makeLine('Bastion', '*(refusing beeps)*', sfxVoice('Bastion', '(refusing beeps)')),
                makeLine(
                    'Shion',
                    "I don't like your tone, E54.",
                    dialogueVoice('Shion', "don't like your tone") ||
                        "Shion_-_I_don't_like_your_tone,_E54.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Zarya / Jetpack Cat ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === '1059' ||
                (c.lines || []).some((l) => String(l.subtitles || '').includes('ice fishing trips')),
        );
        if (conv) {
            conv.name = 'Cat like you';
            conv.lines = reuseLines(conv.lines, [
                makeLine(
                    'Zarya',
                    'I once had a cat like you. My sisters and I would bring her on ice fishing trips.',
                    dialogueVoice('Zarya', 'ice fishing trips') ||
                        'Zarya_-_I_once_had_a_cat_like_you._My_sisters_and_I_would_bring_her_on_ice_fishing_trips.ogg',
                ),
                makeLine('Jetpack Cat', '*(eager meowing)*', ''),
                makeLine(
                    'Zarya',
                    "That coat won't keep you warm enough. But all that blubber might do the trick.",
                    dialogueVoice('Zarya', 'all that blubber') ||
                        "Zarya_-_That_coat_won't_keep_you_warm_enough..._but_all_that_blubber_might_do_the_trick.ogg",
                ),
            ]);
            touched += 1;
        }
    }

    // --- Zarya / Ana multipath ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                c.name === 'Crazy story' ||
                (c.lines || []).some((l) =>
                    String(l.subtitles || '').includes('crazy story about you'),
                ),
        );
        if (conv) {
            const opener = makeLine(
                'Zarya',
                'In my country, they tell a crazy story about you. I must know if it is true.',
                dialogueVoice('Zarya', 'crazy story about you') ||
                    "Zarya_-_In_my_country,_they_tell_a_crazy_story_about_you._I_must_know_if_it's_true.ogg",
            );
            const surgery = makeLine(
                'Ana',
                "I don't see what's so remarkable about doing surgery on yourself in a blizzard.",
                dialogueVoice('Ana', 'surgery on yourself in a blizzard') ||
                    "Ana_-_I_don't_see_what's_so_remarkable_about_doing_surgery_on_yourself_in_a_blizzard.ogg",
            );
            const knitting = makeLine(
                'Ana',
                'The knitting needle and the bear? Unfortunately, yes.',
                dialogueVoice('Ana', 'knitting needle and the bear') ||
                    'Ana_-_The_knitting_needle_and_the_bear__Unfortunately,_yes.ogg',
            );
            const shot = makeLine(
                'Ana',
                "It was only an 8 kilometre shot. I've done better since.",
                dialogueVoice('Ana', '8 kilometer shot') ||
                    "Ana_-_It_was_only_an_8_kilometer_shot._I've_done_better_since.ogg",
            );
            const wolf = makeLine(
                'Ana',
                'To be fair, the wolf bit me first.',
                dialogueVoice('Ana', 'wolf bit me first') ||
                    'Ana_-_To_be_fair,_the_wolf_bit_me_first.ogg',
            );
            const closer = makeLine(
                'Zarya',
                'I knew it.',
                dialogueVoice('Zarya', 'I knew it') || 'Zarya_-_I_knew_it.ogg',
            );

            const lines = reuseLines(conv.lines, [
                opener,
                surgery,
                knitting,
                shot,
                wolf,
                closer,
            ]);
            const [o, a1, a2, a3, a4, z] = lines;
            conv.name = 'Crazy story';
            conv.lines = lines;
            conv.paths = [
                {
                    id: createDialoguePathId(),
                    label: 'Surgery in a blizzard',
                    lineIds: [o.id, a1.id, z.id],
                },
                {
                    id: createDialoguePathId(),
                    label: 'Knitting needle and the bear',
                    lineIds: [o.id, a2.id, z.id],
                },
                {
                    id: createDialoguePathId(),
                    label: '8 kilometre shot',
                    lineIds: [o.id, a3.id, z.id],
                },
                {
                    id: createDialoguePathId(),
                    label: 'Wolf bit me first',
                    lineIds: [o.id, a4.id, z.id],
                },
            ];
            conv.selectedPathId = conv.paths[0].id;
            touched += 1;
        }
    }

    // --- Sojourn / Vendetta: keep stand-down only ---
    {
        const conv = findConv(
            conversations,
            (c) =>
                (c.lines || []).some((l) =>
                    String(l.subtitles || '').includes("It's time to stand down, Vendetta"),
                ) ||
                ((c.lines || []).some((l) =>
                    String(l.subtitles || '').includes('first year without my mom'),
                ) &&
                    (c.lines || []).some((l) => String(l.hero || '') === 'Sojourn')),
        );
        if (conv) {
            const standDown = (conv.lines || []).filter(
                (l) =>
                    String(l.subtitles || '').includes("It's time to stand down, Vendetta") ||
                    String(l.subtitles || '').includes('misjudged my competence'),
            );
            conv.name = 'Stand down, Vendetta';
            conv.lines =
                standDown.length >= 2
                    ? standDown
                    : reuseLines(conv.lines, [
                          makeLine(
                              'Sojourn',
                              "It's time to stand down, Vendetta. Overwatch took out your allies in Tokyo and we won't stop there.",
                              dialogueVoice('Sojourn', 'stand down, Vendetta') ||
                                  "Sojourn_-_It's_time_to_stand_down,_Vendetta._Overwatch_took_out_your_allies_in_Tokyo,_and_we_won't_stop_there.ogg",
                          ),
                          makeLine(
                              'Vendetta',
                              'If you believe I cannot survive a single loss, then you have misjudged my competence to a fatal degree.',
                              dialogueVoice('Vendetta', 'misjudged my competence') ||
                                  'Vendetta_-_If_you_believe_I_cannot_survive_a_single_loss,_then_you_have_misjudged_my_competence_to_a_fatal_degree.ogg',
                          ),
                      ]);
            delete conv.paths;
            delete conv.selectedPathId;
            touched += 1;
        }
    }

    // --- Sierra / Hanzo grieving (add if missing) ---
    {
        const existing = findConv(conversations, (c) =>
            (c.lines || []).some(
                (l) =>
                    String(l.hero || '') === 'Sierra' &&
                    String(l.subtitles || '').includes('first year without my mom'),
            ),
        );
        if (!existing) {
            const lines = [
                makeLine(
                    'Sierra',
                    "You know, the first year without my mom... it was real hard. Didn't open up for a while.",
                    dialogueVoice('Sierra', 'first year without my mom') ||
                        "Sierra_-_You_know,_that_first_year_without_my_mom..._it_was_real_hard._Didn't_open_up_for_a_while.ogg",
                ),
                makeLine(
                    'Hanzo',
                    'I did not have the luxury of time to grieve. My family needed my strength.',
                    dialogueVoice('Hanzo', 'luxury of time to grieve') ||
                        'Hanzo_-_I_did_not_have_the_luxury_of_time_to_grieve._My_family_needed_my_strength.ogg',
                ),
                makeLine(
                    'Sierra',
                    "And now they're grown! When it comes to feeling your feelings, it's better late than never.",
                    dialogueVoice('Sierra', 'feeling your feelings') ||
                        "Sierra_-_And_now_they're_grown._When_it_comes_to_feeling_your_feelings,_it's_better_late_than_never.ogg",
                ),
                makeLine(
                    'Hanzo',
                    'I... I will keep that in mind.',
                    dialogueVoice('Hanzo', 'I will keep that in mind') ||
                        'Hanzo_-_I..._I_will_keep_that_in_mind.ogg',
                ),
            ];
            conversations.push({
                id: createConversationId(),
                name: 'First year without my mom',
                status: 'active',
                eraName: ERA,
                scene: 'Default.png',
                lines,
            });
            touched += 1;
        }
    }

    console.log(`Conversations updated: ${touched}`);
    console.log(`SFX/dialogue files to copy: ${toCopy.size}`);

    if (dryRun) {
        console.log('(dry-run — no write)');
        return;
    }

    await fsp.mkdir(VOICELINES_DIR, { recursive: true });
    let copied = 0;
    for (const [atlasName, source] of toCopy) {
        const dest = path.join(VOICELINES_DIR, atlasName);
        try {
            await fsp.access(dest);
        } catch {
            await fsp.copyFile(source, dest);
            copied += 1;
        }
    }

    const payload = Array.isArray(convRaw.conversations)
        ? { ...convRaw, conversations }
        : conversations;
    await fsp.writeFile(CONVERSATIONS_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const assets = await scanTheaterAssets();
    await fsp.writeFile(MANIFEST_PATH, `${JSON.stringify(assets, null, 2)}\n`, 'utf8');

    console.log(`Copied ${copied} new oggs`);
    console.log('Updated conversations + manifest');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
