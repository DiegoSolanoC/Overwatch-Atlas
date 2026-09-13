/**
 * Event-slide chip name bands must escape rounded section frames and the
 * scrollport's overflow clipping. On hover, move the label to document.body
 * with position:fixed so long names (e.g. Wrecking Ball / Junker Queen)
 * paint above everything — including chips that use transform: scale().
 */

import { fitHeroChipLabelText } from './fitHeroChipLabelText.js';

const FLOATING_CLASS = 'event-slide-filter-label--floating';

/** @type {WeakMap<HTMLElement, { parent: Node, next: ChildNode | null }>} */
const labelHomes = new WeakMap();

/**
 * @param {string} id
 * @returns {HTMLElement | null}
 */
function findPortaledLabel(id) {
    if (!id) return null;
    const el = document.querySelector(`.${FLOATING_CLASS}[data-float-for="${CSS.escape(id)}"]`);
    return el instanceof HTMLElement ? el : null;
}

/**
 * @param {HTMLElement} wrap
 * @returns {HTMLElement | null}
 */
function resolveLabelForWrap(wrap) {
    const portaled = findPortaledLabel(wrap.dataset.floatLabelId || '');
    if (portaled) return portaled;
    const local = wrap.querySelector('.filter-label');
    return local instanceof HTMLElement ? local : null;
}

/**
 * @param {HTMLElement} label
 */
function restoreLabelHome(label) {
    const home = labelHomes.get(label);
    if (home?.parent) {
        home.parent.insertBefore(label, home.next);
    }
    labelHomes.delete(label);
}

/**
 * @param {HTMLElement} label
 */
function clearFloatingLabel(label) {
    restoreLabelHome(label);
    label.classList.remove(FLOATING_CLASS);
    delete label.dataset.floatFor;
    label.style.position = '';
    label.style.left = '';
    label.style.top = '';
    label.style.width = '';
    label.style.minWidth = '';
    label.style.maxWidth = '';
    label.style.transform = '';
    label.style.zIndex = '';
    label.style.opacity = '';
    label.style.visibility = '';
    label.style.pointerEvents = '';
    label.style.margin = '';
    label.style.height = '';
    label.style.minHeight = '';
    label.style.padding = '';
    label.style.borderTop = '';
    label.style.borderBottom = '';
    label.style.borderRadius = '';
    label.style.background = '';
    label.style.display = '';
    label.style.alignItems = '';
    label.style.justifyContent = '';
    label.style.boxSizing = '';
}

/**
 * @param {HTMLElement} wrap
 */
function floatLabelForWrap(wrap) {
    const chip = wrap.querySelector('.gallery-hero-filters__chip, .filter-btn');
    if (!(chip instanceof HTMLElement)) return;

    if (!wrap.dataset.floatLabelId) {
        wrap.dataset.floatLabelId = `chip-float-${Math.random().toString(36).slice(2, 10)}`;
    }

    const labelEl = resolveLabelForWrap(wrap);
    if (!labelEl) return;

    const labelText = labelEl.querySelector('.filter-label-text');
    if (!(labelText instanceof HTMLElement)) return;

    labelEl.dataset.floatFor = wrap.dataset.floatLabelId;

    // Fit while still under the chip so chipWidth is correct.
    if (labelEl.parentElement === chip) {
        fitHeroChipLabelText(labelText);
    }

    const chipRect = chip.getBoundingClientRect();
    const bandWidth = Math.max(
        Number.parseFloat(labelEl.style.width) || 0,
        labelEl.offsetWidth || 0,
        labelText.scrollWidth + 8,
        chipRect.width,
    );

    if (!labelHomes.has(labelEl) && labelEl.parentElement === chip) {
        labelHomes.set(labelEl, {
            parent: chip,
            next: labelEl.nextSibling,
        });
        document.body.appendChild(labelEl);
    }

    const left = chipRect.left + chipRect.width / 2 - bandWidth / 2;
    const top = chipRect.bottom;

    labelEl.classList.add(FLOATING_CLASS);
    labelEl.style.position = 'fixed';
    labelEl.style.left = `${Math.max(4, Math.min(left, window.innerWidth - bandWidth - 4))}px`;
    labelEl.style.top = `${Math.min(top, window.innerHeight - 28)}px`;
    labelEl.style.width = `${bandWidth}px`;
    labelEl.style.minWidth = `${bandWidth}px`;
    labelEl.style.maxWidth = 'none';
    labelEl.style.transform = 'none';
    labelEl.style.zIndex = '10050';
    labelEl.style.opacity = '1';
    labelEl.style.visibility = 'visible';
    labelEl.style.pointerEvents = 'none';
    labelEl.style.margin = '0';
    labelEl.style.height = 'auto';
    labelEl.style.minHeight = '14px';
    labelEl.style.padding = '2px 4px 5px';
    labelEl.style.borderTop = '3px solid rgba(255, 255, 255, 0.93)';
    labelEl.style.borderBottom = '3px solid rgba(255, 255, 255, 0.93)';
    labelEl.style.borderRadius = '0 0 10px 10px';
    labelEl.style.background = '#fff';
    labelEl.style.display = 'flex';
    labelEl.style.alignItems = 'center';
    labelEl.style.justifyContent = 'center';
    labelEl.style.boxSizing = 'border-box';
}

/**
 * @param {ParentNode | null | undefined} root
 */
export function wireSlideChipFloatingLabels(root) {
    if (!(root instanceof HTMLElement)) return;

    root.querySelectorAll('.event-slide-filter-token-chip-wrap').forEach((wrap) => {
        if (!(wrap instanceof HTMLElement)) return;
        if (wrap.dataset.floatLabelWired === '1') return;
        wrap.dataset.floatLabelWired = '1';

        const onEnter = () => floatLabelForWrap(wrap);
        const onLeave = () => {
            const label = resolveLabelForWrap(wrap);
            if (label) clearFloatingLabel(label);
        };
        const onScrollOrResize = () => {
            if (!wrap.matches(':hover') && !wrap.contains(document.activeElement)) return;
            floatLabelForWrap(wrap);
        };

        wrap.addEventListener('mouseenter', onEnter);
        wrap.addEventListener('focusin', onEnter);
        wrap.addEventListener('mouseleave', onLeave);
        wrap.addEventListener('focusout', (e) => {
            if (e.relatedTarget instanceof Node && wrap.contains(e.relatedTarget)) return;
            onLeave();
        });
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize);
    });
}

if (typeof window !== 'undefined') {
    window.__wireSlideChipFloatingLabels = wireSlideChipFloatingLabels;
}
