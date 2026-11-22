/**
 * Persisted chip-size preference for the Filters menu (heroes / factions / NPCs / country).
 * Mirrors info-panel text-size controls: discrete steps + A− / A / A+ UI.
 */
import { fitHeroChipLabelTextInRoot } from '../../../gallery/gallery-mode/fitHeroChipLabelText.js';

export const FILTERS_CHIP_SIZE_SCALE_STORAGE_KEY = 'filtersChipSizeScaleStep';

/** Multipliers on authored chip height / rim / label band. */
export const FILTERS_CHIP_SIZE_SCALE_STEPS = [0.85, 1, 1.15, 1.3, 1.45, 1.6, 1.8, 2];

/** Index of 1.0 — reset returns here. */
export const FILTERS_CHIP_SIZE_SCALE_DEFAULT_INDEX = 1;

export const FILTERS_CHIP_SIZE_SCALE_CHANGE_EVENT = 'filters-chip-size-scale-change';

function clampStepIndex(step) {
    const max = FILTERS_CHIP_SIZE_SCALE_STEPS.length - 1;
    return Math.max(0, Math.min(max, step));
}

function readStoredStepIndex() {
    try {
        const raw = localStorage.getItem(FILTERS_CHIP_SIZE_SCALE_STORAGE_KEY);
        if (raw == null || raw === '') return FILTERS_CHIP_SIZE_SCALE_DEFAULT_INDEX;
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return FILTERS_CHIP_SIZE_SCALE_DEFAULT_INDEX;
        return clampStepIndex(parsed);
    } catch {
        return FILTERS_CHIP_SIZE_SCALE_DEFAULT_INDEX;
    }
}

export function getFiltersChipSizeScaleStep() {
    return readStoredStepIndex();
}

export function getFiltersChipSizeScaleMultiplier(step = getFiltersChipSizeScaleStep()) {
    return FILTERS_CHIP_SIZE_SCALE_STEPS[clampStepIndex(step)] ?? 1;
}

export function setFiltersChipSizeScaleStep(step) {
    const clamped = clampStepIndex(step);
    try {
        localStorage.setItem(FILTERS_CHIP_SIZE_SCALE_STORAGE_KEY, String(clamped));
    } catch {
        /* ignore quota / private mode */
    }
    applyFiltersChipSizeScale(clamped);
    return clamped;
}

export function changeFiltersChipSizeScaleStep(delta) {
    return setFiltersChipSizeScaleStep(getFiltersChipSizeScaleStep() + delta);
}

export function applyFiltersChipSizeScale(step = getFiltersChipSizeScaleStep()) {
    const clamped = clampStepIndex(step);
    const multiplier = getFiltersChipSizeScaleMultiplier(clamped);
    document.documentElement.style.setProperty('--filters-chip-size-scale', String(multiplier));
    document.documentElement.dataset.filtersChipSizeScale = String(clamped);
    window.dispatchEvent(
        new CustomEvent(FILTERS_CHIP_SIZE_SCALE_CHANGE_EVENT, {
            detail: { step: clamped, multiplier },
        }),
    );
    const grid = document.getElementById('filtersGrid');
    if (grid) {
        requestAnimationFrame(() => {
            fitHeroChipLabelTextInRoot(grid);
        });
    }
    return clamped;
}

function syncControlGroup(group) {
    if (!group) return;
    const step = getFiltersChipSizeScaleStep();
    const min = 0;
    const max = FILTERS_CHIP_SIZE_SCALE_STEPS.length - 1;
    const decreaseBtn = group.querySelector('[data-filters-chip-size-scale-action="decrease"]');
    const resetBtn = group.querySelector('[data-filters-chip-size-scale-action="reset"]');
    const increaseBtn = group.querySelector('[data-filters-chip-size-scale-action="increase"]');
    if (decreaseBtn) decreaseBtn.disabled = step <= min;
    if (increaseBtn) increaseBtn.disabled = step >= max;
    if (resetBtn) {
        resetBtn.disabled = step === FILTERS_CHIP_SIZE_SCALE_DEFAULT_INDEX;
        resetBtn.setAttribute(
            'aria-pressed',
            step === FILTERS_CHIP_SIZE_SCALE_DEFAULT_INDEX ? 'true' : 'false',
        );
    }
}

/**
 * @param {{ compact?: boolean }} [options]
 * @returns {HTMLElement}
 */
export function createFiltersChipSizeScaleControls(options = {}) {
    const { compact = false } = options;

    const group = document.createElement('div');
    group.className = 'info-description-text-scale filters-chip-size-scale';
    if (compact) group.classList.add('info-description-text-scale--compact');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Filter chip size');

    const label = document.createElement('span');
    label.className = 'info-description-text-scale__label';
    label.textContent = 'Chip size';

    const decreaseBtn = document.createElement('button');
    decreaseBtn.type = 'button';
    decreaseBtn.className = 'info-description-text-scale__btn';
    decreaseBtn.dataset.filtersChipSizeScaleAction = 'decrease';
    decreaseBtn.setAttribute('aria-label', 'Decrease filter chip size');
    decreaseBtn.textContent = 'A−';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'info-description-text-scale__btn info-description-text-scale__btn--reset';
    resetBtn.dataset.filtersChipSizeScaleAction = 'reset';
    resetBtn.setAttribute('aria-label', 'Reset filter chip size to default');
    resetBtn.textContent = 'A';

    const increaseBtn = document.createElement('button');
    increaseBtn.type = 'button';
    increaseBtn.className = 'info-description-text-scale__btn';
    increaseBtn.dataset.filtersChipSizeScaleAction = 'increase';
    increaseBtn.setAttribute('aria-label', 'Increase filter chip size');
    increaseBtn.textContent = 'A+';

    decreaseBtn.addEventListener('click', () => changeFiltersChipSizeScaleStep(-1));
    resetBtn.addEventListener('click', () => {
        setFiltersChipSizeScaleStep(FILTERS_CHIP_SIZE_SCALE_DEFAULT_INDEX);
    });
    increaseBtn.addEventListener('click', () => changeFiltersChipSizeScaleStep(1));

    group.append(label, decreaseBtn, resetBtn, increaseBtn);

    const onScaleChange = () => syncControlGroup(group);
    window.addEventListener(FILTERS_CHIP_SIZE_SCALE_CHANGE_EVENT, onScaleChange);
    syncControlGroup(group);

    return group;
}

export function mountFiltersChipSizeScaleControls() {
    const actions = document.querySelector('#filtersPanel .filters-actions');
    if (!actions || actions.querySelector('.filters-chip-size-scale')) return;

    /* Migrate off bottom bar / old toolbar slot — match info mid-controls (top). */
    document
        .querySelector('#filtersPanel .filters-actions-buttons .filters-chip-size-scale')
        ?.remove();
    document
        .querySelector('#filtersPanel .filters-panel-content > .filters-chip-size-bar')
        ?.remove();

    let bar = actions.querySelector('.filters-chip-size-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.className = 'filters-chip-size-bar';
        const title = actions.querySelector('.filters-title');
        if (title) {
            title.insertAdjacentElement('afterend', bar);
        } else {
            actions.prepend(bar);
        }
    }
    bar.append(createFiltersChipSizeScaleControls({ compact: false }));
}

applyFiltersChipSizeScale();
