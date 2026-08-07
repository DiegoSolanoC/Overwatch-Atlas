/**
 * Keep chip label text at a fixed size; widen the white name band when the
 * name is longer than the chip (centered under the portrait).
 */

export const CHIP_LABEL_FONT_PX = 13;

/**
 * @param {HTMLElement} labelTextEl
 */
export function fitHeroChipLabelText(labelTextEl) {
    const band = labelTextEl.closest('.filter-label');
    if (!band) return;

    const chip = band.closest('.gallery-hero-filters__chip, .filter-btn');
    const chipWidth = chip?.clientWidth || band.parentElement?.clientWidth || 0;

    labelTextEl.style.display = 'block';
    labelTextEl.style.whiteSpace = 'nowrap';
    labelTextEl.style.overflow = 'visible';
    labelTextEl.style.textOverflow = 'clip';
    labelTextEl.style.webkitLineClamp = 'unset';
    labelTextEl.style.wordBreak = 'normal';
    labelTextEl.style.width = 'auto';
    labelTextEl.style.maxWidth = 'none';
    labelTextEl.style.fontSize = `${CHIP_LABEL_FONT_PX}px`;

    band.style.width = '';
    band.style.minWidth = '';
    band.style.left = '';
    band.style.right = '';
    band.style.transform = '';

    /* Force layout with chip-width band so scrollWidth reflects natural text. */
    if (chipWidth > 0) {
        band.style.width = `${chipWidth}px`;
    }

    const padX = 8;
    const textWidth = labelTextEl.scrollWidth;
    const needed = Math.max(chipWidth, textWidth + padX);

    band.style.width = `${needed}px`;
    band.style.minWidth = `${needed}px`;
    if (chipWidth > 0 && needed > chipWidth) {
        const overflow = needed - chipWidth;
        band.style.left = `${-overflow / 2}px`;
        band.style.right = 'auto';
        band.style.transform = 'none';
    } else {
        band.style.left = '0';
        band.style.right = 'auto';
        band.style.transform = 'none';
    }
}

/**
 * @param {HTMLElement} chipEl
 */
export function fitHeroChipLabelTextInChip(chipEl) {
    const labelText = chipEl.querySelector('.filter-label-text');
    if (labelText) fitHeroChipLabelText(labelText);
}
