/**
 * Derive hero chip birthdays from story timeline lifecycle events
 * (Is Born / Is Made / Goes Online / Was Made) via heroFilterPlaces.
 */

import {
    getHeroBirthdayRawFromEntry,
    HERO_BIRTHDAY_DATE_UNKNOWN_VALUE,
} from './HeroBirthdayAge.js';
import { writeBirthdayToArchiveRow } from './heroArchiveRowBirthday.js';

const LIFECYCLE_SUFFIX_RE = / (is Born|is Made|Goes Online|was Made|Was Made)$/i;

/** @type {Readonly<Record<string, string>>} */
const MANUAL_CHIP_BIRTHDAYS = Object.freeze({
    Orisa: '9 May 2078',
    Bastion: '2046',
    Shion: HERO_BIRTHDAY_DATE_UNKNOWN_VALUE,
    'Jetpack Cat': HERO_BIRTHDAY_DATE_UNKNOWN_VALUE,
});

/** Timeline rows exist but canon date is not written yet — keep manual placeholder. */
const SKIP_TIMELINE_CHIP_BIRTHDAYS = new Set(['Shion', 'Jetpack Cat']);

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function normalizeHeroChipToken(raw, chipSet) {
    const token = String(raw ?? '').trim().replace(/[,\s]+$/g, '');
    if (!token) return null;
    return chipSet.has(token) ? token : null;
}

/**
 * @param {unknown} description
 * @param {unknown} yearStart
 * @returns {string | null}
 */
export function parseLifecycleEventBirthday(description, yearStart) {
    const text = String(description ?? '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text || /^no description available\.?$/i.test(text)) return null;

    if (/unknown day/i.test(text)) {
        const year = Number(yearStart);
        return Number.isInteger(year) && year >= 1 ? String(year) : null;
    }

    const match = text.match(
        /(?:^|\.\s*)(?:On|Born on)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December|Marsh)\s+\d{1,2}(?:st|nd|rd|th)?)(?:,|\s+of)?(?:\s+(?:the\s+year\s+)?(\d{4}))?/i,
    );
    if (!match) return null;

    const parts = match[1].replace(/Marsh/gi, 'March').match(/^(\w+)\s+(\d{1,2})/i);
    if (!parts) return null;

    const month = parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
    const day = Number(String(parts[2]).replace(/(st|nd|rd|th)$/i, ''));
    let year = match[2] ? Number(match[2]) : Number(yearStart);
    if (year === 204) year = 2046;
    if (!Number.isInteger(day) || day < 1 || !Number.isInteger(year) || year < 1) return null;
    return `${day} ${month} ${year}`;
}

/**
 * @param {unknown[]} timelineEvents
 * @param {string[]} manifestHeroes
 * @returns {Map<string, string>}
 */
export function buildHeroChipBirthdaysFromTimelineEvents(timelineEvents, manifestHeroes) {
    const chipSet = new Set(
        (Array.isArray(manifestHeroes) ? manifestHeroes : [])
            .map((name) => String(name ?? '').trim())
            .filter(Boolean),
    );
    /** @type {Map<string, string>} */
    const map = new Map(Object.entries(MANUAL_CHIP_BIRTHDAYS));

    if (!Array.isArray(timelineEvents)) return map;

    const seenEventNames = new Set();
    for (let i = 0; i < timelineEvents.length; i++) {
        const ev = timelineEvents[i];
        const eventName = String(ev?.name ?? '').trim();
        if (!LIFECYCLE_SUFFIX_RE.test(eventName)) continue;
        if (seenEventNames.has(eventName)) continue;
        seenEventNames.add(eventName);

        const baseName = eventName.replace(LIFECYCLE_SUFFIX_RE, '').trim();
        const filterChip = (Array.isArray(ev?.heroFilterPlaces) ? ev.heroFilterPlaces : [])
            .map((row) => normalizeHeroChipToken(row?.country, chipSet))
            .find(Boolean);
        const chip = chipSet.has(baseName) ? baseName : filterChip;
        if (!chip || SKIP_TIMELINE_CHIP_BIRTHDAYS.has(chip) || map.has(chip)) continue;

        const birthday = parseLifecycleEventBirthday(ev.description, ev.yearStart);
        if (birthday) map.set(chip, birthday);
    }

    return map;
}

/**
 * Fill empty hero archive birthdays from a chip → birthday map.
 * @param {unknown[]} heroEvents
 * @param {Map<string, string>} chipBirthdays
 * @returns {unknown[]}
 */
export function applyTimelineBirthdaysToHeroArchive(heroEvents, chipBirthdays) {
    if (!Array.isArray(heroEvents) || heroEvents.length === 0) return heroEvents || [];
    if (!(chipBirthdays instanceof Map) || chipBirthdays.size === 0) return heroEvents;

    return heroEvents.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const chip = String(row.name ?? '').trim();
        if (!chip) return row;
        if (getHeroBirthdayRawFromEntry(row)) return row;
        const birthday = chipBirthdays.get(chip);
        if (!birthday) return row;
        return writeBirthdayToArchiveRow(row, birthday);
    });
}
