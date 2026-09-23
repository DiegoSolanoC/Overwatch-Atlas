/**
 * Story / workshop slide chips — same hover label behavior as the filter menu:
 * keep the white name band attached under the portrait (in-DOM, top: 100%) and
 * only widen it with fitHeroChipLabelText. Do not portal to document.body;
 * fixed labels disconnect from the scaled chip (especially under browser zoom).
 */

import { fitHeroChipLabelText } from './fitHeroChipLabelText.js';

/**
 * @param {HTMLElement} wrap
 */
function fitLabelForWrap(wrap) {
    const labelText = wrap.querySelector('.filter-label-text');
    if (labelText instanceof HTMLElement) fitHeroChipLabelText(labelText);
}

/**
 * @param {ParentNode | null | undefined} root
 */
export function wireSlideChipFloatingLabels(root) {
    if (!(root instanceof HTMLElement)) return;

    // Clear any leftover portaled labels from older builds.
    document.querySelectorAll('.filter-label.event-slide-filter-label--floating').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        el.classList.remove('event-slide-filter-label--floating');
        el.removeAttribute('data-float-for');
        el.removeAttribute('style');
        el.remove();
    });

    root.querySelectorAll('.event-slide-filter-token-chip-wrap').forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        if (wrap.dataset.chipLabelFitWired === '1') return;
        wrap.dataset.chipLabelFitWired = '1';
        delete wrap.dataset.floatLabelWired;

        const onEnter = () => {
            requestAnimationFrame(() => fitLabelForWrap(wrap));
        };

        wrap.addEventListener('mouseenter', onEnter);
        wrap.addEventListener('focusin', onEnter);
    });

    // Fit once after layout so long names are ready before first hover.
    requestAnimationFrame(() => {
        root.querySelectorAll('.event-slide-filter-token-chip-wrap .filter-label-text').forEach((el) => {
            if (el instanceof HTMLElement) fitHeroChipLabelText(el);
        });
    });
}

if (typeof window !== 'undefined') {
    window.__wireSlideChipFloatingLabels = wireSlideChipFloatingLabels;
}
