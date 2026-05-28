/**
 * Hero birthday parsing + age formatting for hero archive UIs.
 * Age is measured against a fixed universe date until canon advances.
 */

const MONTH_INDEX = {
    january: 0,
    jan: 0,
    february: 1,
    feb: 1,
    march: 2,
    mar: 2,
    april: 3,
    apr: 3,
    may: 4,
    june: 5,
    jun: 5,
    july: 6,
    jul: 6,
    august: 7,
    aug: 7,
    september: 8,
    sep: 8,
    sept: 8,
    october: 9,
    oct: 9,
    november: 10,
    nov: 10,
    december: 11,
    dec: 11
};

export const HERO_BIRTHDAY_MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

/** April 1st, 2080 (UTC). */
export const HERO_AGE_REFERENCE_DATE_UTC = new Date(Date.UTC(2080, 3, 1));

/**
 * @param {unknown} raw
 * @returns {{ day: number, monthIdx: number, year: number } | null}
 */
export function parseHeroBirthdayDayMonthYear(raw) {
    const text = String(raw ?? '').trim().replace(/\s+/g, ' ');
    if (!text) return null;
    const m = text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (!m) return null;
    const day = Number(m[1]);
    const monthIdx = MONTH_INDEX[String(m[2]).toLowerCase()];
    const year = Number(m[3]);
    if (!Number.isInteger(day) || day < 1 || day > 31) return null;
    if (!Number.isInteger(year) || year < 1) return null;
    if (!Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx > 11) return null;
    const dt = new Date(Date.UTC(year, monthIdx, day));
    if (
        dt.getUTCFullYear() !== year
        || dt.getUTCMonth() !== monthIdx
        || dt.getUTCDate() !== day
    ) {
        return null;
    }
    return { day, monthIdx, year };
}

/**
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeHeroBirthdayDayMonthYear(raw) {
    const parsed = parseHeroBirthdayDayMonthYear(raw);
    if (!parsed) return '';
    return `${parsed.day} ${HERO_BIRTHDAY_MONTH_NAMES[parsed.monthIdx]} ${parsed.year}`;
}

/**
 * @param {unknown} raw
 * @returns {{ day: string, month: string, year: string }}
 */
export function splitHeroBirthdayParts(raw) {
    const parsed = parseHeroBirthdayDayMonthYear(raw);
    if (!parsed) {
        return { day: '', month: '', year: '' };
    }
    return {
        day: String(parsed.day),
        month: HERO_BIRTHDAY_MONTH_NAMES[parsed.monthIdx],
        year: String(parsed.year)
    };
}

/**
 * @param {unknown} day
 * @param {unknown} month
 * @param {unknown} year
 * @returns {string}
 */
export function buildHeroBirthdayFromParts(day, month, year) {
    const d = String(day ?? '').trim();
    const m = String(month ?? '').trim();
    const y = String(year ?? '').trim();
    if (!d && !m && !y) return '';
    return normalizeHeroBirthdayDayMonthYear(`${d} ${m} ${y}`);
}

/**
 * @param {{ day: number, monthIdx: number, year: number }} birth
 * @param {Date} refDateUtc
 */
export function computeHeroAgeOnReferenceDate(birth, refDateUtc) {
    let age = refDateUtc.getUTCFullYear() - birth.year;
    const refMonth = refDateUtc.getUTCMonth();
    const refDay = refDateUtc.getUTCDate();
    if (refMonth < birth.monthIdx || (refMonth === birth.monthIdx && refDay < birth.day)) {
        age -= 1;
    }
    return Math.max(0, age);
}

/**
 * @param {unknown} birthdayRaw
 * @param {Date} [referenceDateUtc]
 * @returns {{ birthdayText: string, age: number } | null}
 */
export function getHeroBirthdayAgeDisplay(birthdayRaw, referenceDateUtc = HERO_AGE_REFERENCE_DATE_UTC) {
    const parsed = parseHeroBirthdayDayMonthYear(birthdayRaw);
    if (!parsed) return null;
    return {
        birthdayText: normalizeHeroBirthdayDayMonthYear(birthdayRaw),
        age: computeHeroAgeOnReferenceDate(parsed, referenceDateUtc)
    };
}

/**
 * @param {unknown} birthdayRaw
 * @param {Date} [referenceDateUtc]
 * @returns {string}
 */
export function formatHeroBirthdayAgeLine(birthdayRaw, referenceDateUtc = HERO_AGE_REFERENCE_DATE_UTC) {
    const display = getHeroBirthdayAgeDisplay(birthdayRaw, referenceDateUtc);
    if (!display) return '';
    return `Birthday: ${display.birthdayText}\nAge: ${display.age}`;
}

/**
 * @param {any} entry
 * @returns {string}
 */
export function getHeroBirthdayRawFromEntry(entry) {
    if (!entry || typeof entry !== 'object') return '';
    const variants = entry.variants;
    if (Array.isArray(variants) && variants.length > 0) {
        const v0 = variants[0];
        const fromVariant = String(
            v0?.birthday ?? v0?.birthDate ?? v0?.dateOfBirth ?? ''
        ).trim();
        if (fromVariant) return fromVariant;
    }
    return String(
        entry.birthday ?? entry.birthDate ?? entry.dateOfBirth ?? ''
    ).trim();
}

/**
 * @param {string} prefix
 * @param {number} [limit]
 * @returns {string[]}
 */
export function listHeroBirthdayMonthSuggestions(prefix, limit = 8) {
    const p = String(prefix ?? '').trim().toLowerCase();
    if (!p) return [...HERO_BIRTHDAY_MONTH_NAMES];
    return HERO_BIRTHDAY_MONTH_NAMES.filter((name) => name.toLowerCase().startsWith(p)).slice(0, limit);
}
