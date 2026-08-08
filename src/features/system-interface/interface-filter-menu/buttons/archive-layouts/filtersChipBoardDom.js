/**
 * Shared Gallery-style board DOM helpers for the filters panel.
 */

/**
 * @param {string} labelText
 * @returns {HTMLElement}
 */
export function buildFiltersChipSubgroupLabel(labelText) {
    const label = document.createElement('div');
    label.className = 'filters-chip-board__subrole-label';
    const hasText = Boolean(String(labelText || '').trim());
    if (!hasText) {
        label.classList.add('filters-chip-board__subrole-label--empty');
        label.setAttribute('aria-hidden', 'true');
    }

    const left = document.createElement('span');
    left.className = 'filters-chip-board__subrole-label-line';
    left.setAttribute('aria-hidden', 'true');

    const text = document.createElement('span');
    text.className = 'filters-chip-board__subrole-label-text';
    text.textContent = hasText ? labelText : '';

    const right = document.createElement('span');
    right.className = 'filters-chip-board__subrole-label-line';
    right.setAttribute('aria-hidden', 'true');

    label.appendChild(left);
    label.appendChild(text);
    label.appendChild(right);
    return label;
}

/**
 * @param {'columns'|'flat'} variant
 * @param {string} headingText
 * @returns {{ board: HTMLElement, body: HTMLElement }}
 */
export function buildFiltersChipBoard(variant, headingText) {
    const board = document.createElement('div');
    board.className =
        variant === 'columns'
            ? 'filters-chip-board filters-chip-board--columns'
            : 'filters-chip-board filters-chip-board--flat';
    board.setAttribute('aria-label', headingText || (variant === 'columns' ? 'Heroes' : 'Filters'));

    // No top board title — role / segment labels carry the hierarchy (saves scroll
    // height vs the old always-on category separators + large tiles).

    const body = document.createElement('div');
    body.className =
        variant === 'columns'
            ? 'filters-chip-board__roles'
            : 'filters-chip-board__rows';
    board.appendChild(body);
    return { board, body };
}

/**
 * @param {string} subgroupKey
 * @param {string} labelText
 * @param {HTMLElement[]} chipWraps
 * @returns {HTMLElement}
 */
export function buildFiltersChipSubgroup(subgroupKey, labelText, chipWraps) {
    const group = document.createElement('div');
    group.className = 'filters-chip-board__subrole-group';
    group.dataset.subgroupKey = subgroupKey;
    group.style.setProperty('--hero-count', String(chipWraps.length));

    const chipsRow = document.createElement('div');
    chipsRow.className = 'filters-chip-board__chips-row';
    chipsRow.style.setProperty('--chip-count', String(chipWraps.length));
    chipsRow.setAttribute('role', 'list');
    for (const wrap of chipWraps) {
        chipsRow.appendChild(wrap);
    }

    group.appendChild(chipsRow);
    group.appendChild(buildFiltersChipSubgroupLabel(labelText));
    return group;
}

/**
 * @param {'top'|'bottom'} rowKey
 * @returns {HTMLElement}
 */
export function createFiltersChipSubrow(rowKey) {
    const row = document.createElement('div');
    row.className = `filters-chip-board__subrow filters-chip-board__subrow--${rowKey}`;
    return row;
}
