/**
 * Heroes archive: Day / Month / Year birthday inputs on the bio edit strip.
 * Month field uses predictive autocomplete only.
 */

import {
    buildHeroBirthdayFromParts,
    splitHeroBirthdayParts
} from './HeroBirthdayAge.js';
import { wireHeroBirthdayMonthAutocomplete } from './HeroBirthdayMonthAutocomplete.js';

/** @type {boolean} */
let monthAutocompleteBound = false;

function getBirthdayFieldEls() {
    return {
        day: document.getElementById('eventSlideEditHeroBirthdayDay'),
        month: document.getElementById('eventSlideEditHeroBirthdayMonth'),
        year: document.getElementById('eventSlideEditHeroBirthdayYear'),
        monthList: document.getElementById('eventSlideHeroBirthdayMonthList'),
        monthWrap: document.querySelector('.event-slide-hero-birthday-month-wrap'),
    };
}

function ensureHeroBirthdayMonthAutocomplete() {
    if (monthAutocompleteBound) return;
    const { month, monthList, monthWrap } = getBirthdayFieldEls();
    if (!month || !monthList || !monthWrap) return;
    monthAutocompleteBound = true;
    wireHeroBirthdayMonthAutocomplete(month, monthList, monthWrap);
}

/**
 * @param {string | null | undefined} archiveSource
 * @param {unknown} birthdayForPopulate
 */
export function syncHeroBirthdayBioPanelVisibility(archiveSource, birthdayForPopulate) {
    const panel = document.getElementById('eventSlideHeroBirthdayBioPanel');
    const { day, month, year } = getBirthdayFieldEls();
    if (!panel || !day || !month || !year) return;
    ensureHeroBirthdayMonthAutocomplete();

    const src = archiveSource != null ? String(archiveSource) : '';
    if (src === 'heroes') {
        panel.removeAttribute('hidden');
        panel.style.display = '';
        const parts = splitHeroBirthdayParts(birthdayForPopulate);
        day.value = parts.day;
        month.value = parts.month;
        year.value = parts.year;
    } else {
        panel.setAttribute('hidden', 'hidden');
        panel.style.display = 'none';
        day.value = '';
        month.value = '';
        year.value = '';
    }
}

export function readHeroBirthdayBioPanelTrimmed() {
    const { day, month, year } = getBirthdayFieldEls();
    if (!day || !month || !year) return '';
    return buildHeroBirthdayFromParts(day.value, month.value, year.value);
}

/**
 * @returns {boolean} true when any part filled but invalid
 */
export function heroBirthdayPartsIncomplete() {
    const { day, month, year } = getBirthdayFieldEls();
    if (!day || !month || !year) return false;
    const hasAny = !!(String(day.value).trim() || String(month.value).trim() || String(year.value).trim());
    if (!hasAny) return false;
    return !readHeroBirthdayBioPanelTrimmed();
}
