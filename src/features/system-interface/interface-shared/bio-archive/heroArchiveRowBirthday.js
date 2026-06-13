/**
 * Read/write `birthday` on hero archive rows (supports legacy variants[]).
 */

import { getHeroBirthdayRawFromEntry } from './HeroBirthdayAge.js';

/**
 * @param {unknown} row
 * @param {string} birthday
 * @returns {object}
 */
export function writeBirthdayToArchiveRow(row, birthday) {
    if (!row || typeof row !== 'object') return row;
    const nextBirthday = String(birthday ?? '').trim();
    if (Array.isArray(row.variants) && row.variants.length > 0) {
        const variants = row.variants.map((v, idx) =>
            idx === 0 ? { ...v, birthday: nextBirthday } : v,
        );
        return { ...row, birthday: nextBirthday, variants };
    }
    return { ...row, birthday: nextBirthday };
}

export { getHeroBirthdayRawFromEntry };
