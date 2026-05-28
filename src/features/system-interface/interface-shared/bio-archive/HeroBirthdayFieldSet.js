/**
 * Reusable Day / Month / Year birthday field group (month autocomplete).
 */

import {
    buildHeroBirthdayFromParts,
    splitHeroBirthdayParts
} from './HeroBirthdayAge.js';
import { wireHeroBirthdayMonthAutocomplete } from './HeroBirthdayMonthAutocomplete.js';

/**
 * @param {HTMLElement} container
 * @param {string} idPrefix — e.g. "heroBioArchive" → heroBioArchiveBirthdayDay
 * @returns {{
 *   root: HTMLElement,
 *   dayInput: HTMLInputElement,
 *   monthInput: HTMLInputElement,
 *   yearInput: HTMLInputElement,
 *   populate: (unknown) => void,
 *   clear: () => void,
 *   readNormalized: () => string,
 *   isIncomplete: () => boolean
 * }}
 */
export function createHeroBirthdayFieldSet(container, idPrefix) {
    const prefix = String(idPrefix || 'heroBirthday').trim() || 'heroBirthday';
    const dayId = `${prefix}BirthdayDay`;
    const monthId = `${prefix}BirthdayMonth`;
    const yearId = `${prefix}BirthdayYear`;
    const listId = `${prefix}BirthdayMonthList`;

    const root = document.createElement('div');
    root.className = 'hero-birthday-field-set';

    const fields = document.createElement('div');
    fields.className = 'event-slide-hero-birthday-fields';

    const dayField = document.createElement('div');
    dayField.className = 'event-slide-hero-birthday-field';
    const dayLabel = document.createElement('label');
    dayLabel.className = 'event-slide-hero-birthday-field__label';
    dayLabel.htmlFor = dayId;
    dayLabel.textContent = 'Day';
    const dayInput = document.createElement('input');
    dayInput.className = 'event-slide-inline-editor__input event-slide-hero-birthday-field__input';
    dayInput.id = dayId;
    dayInput.type = 'number';
    dayInput.min = '1';
    dayInput.max = '31';
    dayInput.inputMode = 'numeric';
    dayInput.autocomplete = 'off';
    dayInput.placeholder = '12';
    dayField.append(dayLabel, dayInput);

    const monthField = document.createElement('div');
    monthField.className = 'event-slide-hero-birthday-field event-slide-hero-birthday-field--month';
    const monthLabel = document.createElement('label');
    monthLabel.className = 'event-slide-hero-birthday-field__label';
    monthLabel.htmlFor = monthId;
    monthLabel.textContent = 'Month';
    const monthWrap = document.createElement('div');
    monthWrap.className = 'event-slide-hero-birthday-month-wrap';
    const monthInput = document.createElement('input');
    monthInput.className = 'event-slide-inline-editor__input event-slide-hero-birthday-field__input';
    monthInput.id = monthId;
    monthInput.type = 'text';
    monthInput.spellcheck = false;
    monthInput.autocomplete = 'off';
    monthInput.placeholder = 'May';
    const monthList = document.createElement('div');
    monthList.id = listId;
    monthList.className = 'filter-autocomplete-list event-slide-hero-birthday-month-list';
    monthList.hidden = true;
    monthList.setAttribute('role', 'listbox');
    monthList.setAttribute('aria-label', 'Month suggestions');
    monthWrap.append(monthInput, monthList);
    monthField.append(monthLabel, monthWrap);

    const yearField = document.createElement('div');
    yearField.className = 'event-slide-hero-birthday-field';
    const yearLabel = document.createElement('label');
    yearLabel.className = 'event-slide-hero-birthday-field__label';
    yearLabel.htmlFor = yearId;
    yearLabel.textContent = 'Year';
    const yearInput = document.createElement('input');
    yearInput.className = 'event-slide-inline-editor__input event-slide-hero-birthday-field__input';
    yearInput.id = yearId;
    yearInput.type = 'number';
    yearInput.min = '1';
    yearInput.max = '9999';
    yearInput.inputMode = 'numeric';
    yearInput.autocomplete = 'off';
    yearInput.placeholder = '2048';
    yearField.append(yearLabel, yearInput);

    fields.append(dayField, monthField, yearField);
    root.append(fields);
    container.append(root);

    wireHeroBirthdayMonthAutocomplete(monthInput, monthList, monthWrap);

    return {
        root,
        dayInput,
        monthInput,
        yearInput,
        populate(raw) {
            const parts = splitHeroBirthdayParts(raw);
            dayInput.value = parts.day;
            monthInput.value = parts.month;
            yearInput.value = parts.year;
        },
        clear() {
            dayInput.value = '';
            monthInput.value = '';
            yearInput.value = '';
        },
        readNormalized() {
            return buildHeroBirthdayFromParts(dayInput.value, monthInput.value, yearInput.value);
        },
        isIncomplete() {
            const hasAny = !!(
                String(dayInput.value).trim()
                || String(monthInput.value).trim()
                || String(yearInput.value).trim()
            );
            if (!hasAny) return false;
            return !buildHeroBirthdayFromParts(dayInput.value, monthInput.value, yearInput.value);
        },
    };
}
