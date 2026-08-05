/**
 * Fill deferred chatter partner conditions using Atlas curated rosters.
 * Skips absence / event / rare / map-bug / already-removed lines.
 *
 * Usage: node scripts/apply-chatter-roster-partners.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    ROSTER_FEMALE,
    ROSTER_FORMER_OVERWATCH,
    ROSTER_GENDER_SUBSTITUTE_FEMALE,
    ROSTER_OLD,
    ROSTER_OVERWATCH_GROUP,
    ROSTER_TALON,
    ROSTER_YOUNG,
    rosterExcludingSpeaker,
} from '../src/features/dialogue-theater/data/dialogueTheaterChatterRosters.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const convPath = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');

const data = JSON.parse(fs.readFileSync(convPath, 'utf8'));

/**
 * @param {string[]} partners
 * @param {string} mode
 * @param {object} [extra]
 */
function assignPartners(line, partners, mode, extra = {}) {
    const list = [...partners];
    if (list.length === 0) return false;
    line.partnerMode = mode;
    line.partners = list;
    line.partnerFocus = list[0];
    line.partnerStackOrder = [...list];
    if (extra.partnerFixed) line.partnerFixed = extra.partnerFixed;
    else delete line.partnerFixed;
    if (extra.partnerOrPools) line.partnerOrPools = extra.partnerOrPools;
    else delete line.partnerOrPools;
    return true;
}

/** @type {Record<string, number>} */
const counts = {
    overwatchOr: 0,
    formerVague: 0,
    talonExclusive: 0,
    oldExclusive: 0,
    youngExclusive: 0,
    gender: 0,
    hybrid: 0,
    skipped: 0,
};

for (const conv of data.conversations) {
    if (conv.entryType !== 'chatter') continue;
    const speaker = conv.name || '';
    for (const line of conv.lines || []) {
        if (Array.isArray(line.partners) && line.partners.length > 0) continue;
        const d = String(line.disclaimer || '').trim();
        if (!d) continue;

        const lower = d.toLowerCase();

        // Removed / absence / event / rare / map — leave alone
        if (/\bremoved\b/.test(lower)) {
            counts.skipped += 1;
            continue;
        }
        if (/not on the team/.test(lower)) {
            counts.skipped += 1;
            continue;
        }
        if (/winter wonderland|while in .+ event/.test(lower)) {
            counts.skipped += 1;
            continue;
        }
        if (/^rare$/i.test(d.trim()) || /restricted to suravasa|mistakenly restricted/.test(lower)) {
            counts.skipped += 1;
            continue;
        }

        // Hybrids
        if (/bastion or zenyatta,\s*mercy,\s*and junkrat/i.test(d)) {
            const partners = ['Bastion', 'Zenyatta', 'Mercy', 'Junkrat'];
            assignPartners(line, partners, 'hybrid', {
                partnerFixed: ['Mercy', 'Junkrat'],
                partnerOrPools: [['Bastion', 'Zenyatta']],
            });
            counts.hybrid += 1;
            continue;
        }
        if (/wrecking ball and either junkrat or venture/i.test(d)) {
            const orPool = ['Junkrat', 'Venture', 'Jetpack Cat', 'Roadhog'];
            const partners = ['Wrecking Ball', ...orPool];
            assignPartners(line, partners, 'hybrid', {
                partnerFixed: ['Wrecking Ball'],
                partnerOrPools: [orPool],
            });
            counts.hybrid += 1;
            continue;
        }

        // Gender count (JQ ladies + LW substitute)
        if (/four female heroes/i.test(d)) {
            const pool = [
                ...rosterExcludingSpeaker(ROSTER_FEMALE, speaker),
                ...ROSTER_GENDER_SUBSTITUTE_FEMALE,
            ];
            assignPartners(line, pool, 'vague');
            line.partnerCountMin = 4;
            line.partnerCountMax = 4;
            counts.gender += 1;
            continue;
        }

        // Exclusive / category pools
        if (/only young heroes/i.test(d)) {
            assignPartners(line, rosterExcludingSpeaker(ROSTER_YOUNG, speaker), 'vague');
            counts.youngExclusive += 1;
            continue;
        }
        if (/only veteran\/old|only veteran|old heroes on the team/i.test(d) && !/following old heroes/i.test(d)) {
            assignPartners(line, rosterExcludingSpeaker(ROSTER_OLD, speaker), 'vague');
            counts.oldExclusive += 1;
            continue;
        }
        if (/only talon/i.test(d)) {
            assignPartners(line, rosterExcludingSpeaker(ROSTER_TALON, speaker), 'vague');
            counts.talonExclusive += 1;
            continue;
        }
        if (/multiple talon/i.test(d)) {
            assignPartners(line, rosterExcludingSpeaker(ROSTER_TALON, speaker), 'vague');
            counts.talonExclusive += 1;
            continue;
        }
        if (/multiple former overwatch/i.test(d)) {
            assignPartners(line, rosterExcludingSpeaker(ROSTER_FORMER_OVERWATCH, speaker), 'vague');
            counts.formerVague += 1;
            continue;
        }
        if (/former overwatch \(group\) members/i.test(d) || /former overwatch agents/i.test(d)) {
            // at least N former → OR pool (show one stand-in) or vague for "multiple"
            if (/multiple/.test(lower)) {
                assignPartners(line, rosterExcludingSpeaker(ROSTER_FORMER_OVERWATCH, speaker), 'vague');
                counts.formerVague += 1;
            } else {
                assignPartners(line, rosterExcludingSpeaker(ROSTER_FORMER_OVERWATCH, speaker), 'or');
                counts.overwatchOr += 1;
            }
            continue;
        }
        if (
            /only overwatch members or former overwatch/i.test(d) ||
            /only overwatch \(group\) members/i.test(d) ||
            /only overwatch members/i.test(d)
        ) {
            const union = [
                ...ROSTER_OVERWATCH_GROUP,
                ...ROSTER_FORMER_OVERWATCH.filter(
                    (h) => !ROSTER_OVERWATCH_GROUP.some((o) => o.toLowerCase() === h.toLowerCase()),
                ),
            ];
            assignPartners(line, rosterExcludingSpeaker(union, speaker), 'vague');
            counts.overwatchOr += 1;
            continue;
        }
        if (
            /at least \d+ overwatch \(group\) members/i.test(d) ||
            /at least \d+ overwatch agents/i.test(d)
        ) {
            assignPartners(line, rosterExcludingSpeaker(ROSTER_OVERWATCH_GROUP, speaker), 'or');
            counts.overwatchOr += 1;
            continue;
        }

        counts.skipped += 1;
    }
}

fs.writeFileSync(convPath, `${JSON.stringify(data, null, 2)}\n`);
console.log(counts);
