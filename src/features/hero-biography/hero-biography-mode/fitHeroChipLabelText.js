/**
 * Scale chip label text to one line that fills the white name band width.
 */

const MAX_FONT_PX = 14;
const MIN_FONT_PX = 7;

/**
 * @param {HTMLElement} labelTextEl
 */
export function fitHeroChipLabelText(labelTextEl) {
    const band = labelTextEl.closest('.filter-label');
    if (!band) return;

    const maxWidth = band.clientWidth - 4;
    if (maxWidth <= 0) return;

    labelTextEl.style.display = 'block';
    labelTextEl.style.whiteSpace = 'nowrap';
    labelTextEl.style.overflow = 'visible';
    labelTextEl.style.textOverflow = 'clip';
    labelTextEl.style.webkitLineClamp = 'unset';
    labelTextEl.style.wordBreak = 'normal';

    let size = MAX_FONT_PX;
    labelTextEl.style.fontSize = `${size}px`;

    while (labelTextEl.scrollWidth > maxWidth && size > MIN_FONT_PX) {
        size -= 0.5;
        labelTextEl.style.fontSize = `${size}px`;
    }
}

/**
 * @param {HTMLElement} chipEl
 */
export function fitHeroChipLabelTextInChip(chipEl) {
    const labelText = chipEl.querySelector('.filter-label-text');
    if (labelText) fitHeroChipLabelText(labelText);
}
