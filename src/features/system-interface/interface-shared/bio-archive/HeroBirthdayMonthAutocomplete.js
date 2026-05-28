/**
 * Predictive month-name autocomplete for hero birthday fields.
 */

import { listHeroBirthdayMonthSuggestions } from './HeroBirthdayAge.js';

/** @type {WeakSet<HTMLInputElement>} */
const wiredMonths = new WeakSet();

/**
 * @param {HTMLInputElement} monthInput
 * @param {HTMLElement} monthList
 * @param {HTMLElement} monthWrap
 */
export function wireHeroBirthdayMonthAutocomplete(monthInput, monthList, monthWrap) {
    if (!monthInput || !monthList || !monthWrap || wiredMonths.has(monthInput)) return;
    wiredMonths.add(monthInput);

    const hide = () => {
        monthList.hidden = true;
        monthList.replaceChildren();
    };

    const sync = () => {
        const matches = listHeroBirthdayMonthSuggestions(monthInput.value);
        monthList.replaceChildren();
        if (!matches.length) {
            monthList.hidden = true;
            return;
        }
        matches.forEach((name) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'filter-autocomplete-item hero-birthday-month-suggest';
            btn.textContent = name;
            btn.addEventListener('mousedown', (ev) => ev.preventDefault());
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                monthInput.value = name;
                hide();
                monthInput.focus();
            });
            monthList.appendChild(btn);
        });
        monthList.hidden = false;
    };

    monthInput.addEventListener('input', sync);
    monthInput.addEventListener('focus', sync);
    monthInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (document.activeElement === monthInput) return;
            if (monthList.contains(document.activeElement)) return;
            hide();
        }, 160);
    });
    monthInput.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') hide();
    });

    document.addEventListener('pointerdown', (ev) => {
        const t = ev.target;
        if (!(t instanceof Node)) return;
        if (monthWrap.contains(t)) return;
        hide();
    });
}
