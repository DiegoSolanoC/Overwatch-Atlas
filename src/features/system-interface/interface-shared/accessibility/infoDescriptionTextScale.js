/** Persisted step index for info-panel / gallery intel description text size. */
export const INFO_DESCRIPTION_TEXT_SCALE_STORAGE_KEY = 'infoDescriptionTextScaleStep';

/** Multipliers applied to each panel's base description font size. */
export const INFO_DESCRIPTION_TEXT_SCALE_STEPS = [0.85, 0.925, 1, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9];

/** Former max (1.45) is the new default; reset returns here. */
export const INFO_DESCRIPTION_TEXT_SCALE_DEFAULT_INDEX = 5;

export const INFO_DESCRIPTION_TEXT_SCALE_CHANGE_EVENT = 'info-description-text-scale-change';

function clampStepIndex(step) {
    const max = INFO_DESCRIPTION_TEXT_SCALE_STEPS.length - 1;
    return Math.max(0, Math.min(max, step));
}

function readStoredStepIndex() {
    try {
        const raw = localStorage.getItem(INFO_DESCRIPTION_TEXT_SCALE_STORAGE_KEY);
        if (raw == null || raw === '') return INFO_DESCRIPTION_TEXT_SCALE_DEFAULT_INDEX;
        const parsed = Number.parseInt(raw, 10);
        if (!Number.isFinite(parsed)) return INFO_DESCRIPTION_TEXT_SCALE_DEFAULT_INDEX;
        return clampStepIndex(parsed);
    } catch {
        return INFO_DESCRIPTION_TEXT_SCALE_DEFAULT_INDEX;
    }
}

export function getInfoDescriptionTextScaleStep() {
    return readStoredStepIndex();
}

export function getInfoDescriptionTextScaleMultiplier(step = getInfoDescriptionTextScaleStep()) {
    return INFO_DESCRIPTION_TEXT_SCALE_STEPS[clampStepIndex(step)] ?? 1;
}

export function setInfoDescriptionTextScaleStep(step) {
    const clamped = clampStepIndex(step);
    try {
        localStorage.setItem(INFO_DESCRIPTION_TEXT_SCALE_STORAGE_KEY, String(clamped));
    } catch {
        /* ignore quota / private mode */
    }
    applyInfoDescriptionTextScale(clamped);
    return clamped;
}

export function changeInfoDescriptionTextScaleStep(delta) {
    return setInfoDescriptionTextScaleStep(getInfoDescriptionTextScaleStep() + delta);
}

export function applyInfoDescriptionTextScale(step = getInfoDescriptionTextScaleStep()) {
    const clamped = clampStepIndex(step);
    const multiplier = getInfoDescriptionTextScaleMultiplier(clamped);
    document.documentElement.style.setProperty('--info-description-text-scale', String(multiplier));
    document.documentElement.dataset.infoDescriptionTextScale = String(clamped);
    window.dispatchEvent(new CustomEvent(INFO_DESCRIPTION_TEXT_SCALE_CHANGE_EVENT, {
        detail: { step: clamped, multiplier },
    }));
    return clamped;
}

function syncControlGroup(group) {
    if (!group) return;
    const step = getInfoDescriptionTextScaleStep();
    const min = 0;
    const max = INFO_DESCRIPTION_TEXT_SCALE_STEPS.length - 1;
    const decreaseBtn = group.querySelector('[data-info-description-text-scale-action="decrease"]');
    const resetBtn = group.querySelector('[data-info-description-text-scale-action="reset"]');
    const increaseBtn = group.querySelector('[data-info-description-text-scale-action="increase"]');
    if (decreaseBtn) decreaseBtn.disabled = step <= min;
    if (increaseBtn) increaseBtn.disabled = step >= max;
    if (resetBtn) {
        resetBtn.disabled = step === INFO_DESCRIPTION_TEXT_SCALE_DEFAULT_INDEX;
        resetBtn.setAttribute(
            'aria-pressed',
            step === INFO_DESCRIPTION_TEXT_SCALE_DEFAULT_INDEX ? 'true' : 'false',
        );
    }
}

/**
 * @param {{ compact?: boolean, leading?: boolean }} [options]
 * @returns {HTMLElement}
 */
export function createInfoDescriptionTextScaleControls(options = {}) {
    const { compact = false, leading = false } = options;

    const group = document.createElement('div');
    group.className = 'info-description-text-scale';
    if (compact) group.classList.add('info-description-text-scale--compact');
    if (leading) group.classList.add('info-description-text-scale--leading');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Description text size');

    const label = document.createElement('span');
    label.className = 'info-description-text-scale__label';
    label.textContent = 'Text size';

    const decreaseBtn = document.createElement('button');
    decreaseBtn.type = 'button';
    decreaseBtn.className = 'info-description-text-scale__btn';
    decreaseBtn.dataset.infoDescriptionTextScaleAction = 'decrease';
    decreaseBtn.setAttribute('aria-label', 'Decrease description text size');
    decreaseBtn.textContent = 'A−';

    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'info-description-text-scale__btn info-description-text-scale__btn--reset';
    resetBtn.dataset.infoDescriptionTextScaleAction = 'reset';
    resetBtn.setAttribute('aria-label', 'Reset description text size to default');
    resetBtn.textContent = 'A';

    const increaseBtn = document.createElement('button');
    increaseBtn.type = 'button';
    increaseBtn.className = 'info-description-text-scale__btn';
    increaseBtn.dataset.infoDescriptionTextScaleAction = 'increase';
    increaseBtn.setAttribute('aria-label', 'Increase description text size');
    increaseBtn.textContent = 'A+';

    decreaseBtn.addEventListener('click', () => changeInfoDescriptionTextScaleStep(-1));
    resetBtn.addEventListener('click', () => {
        setInfoDescriptionTextScaleStep(INFO_DESCRIPTION_TEXT_SCALE_DEFAULT_INDEX);
    });
    increaseBtn.addEventListener('click', () => changeInfoDescriptionTextScaleStep(1));

    group.append(label, decreaseBtn, resetBtn, increaseBtn);

    const onScaleChange = () => syncControlGroup(group);
    window.addEventListener(INFO_DESCRIPTION_TEXT_SCALE_CHANGE_EVENT, onScaleChange);
    syncControlGroup(group);

    return group;
}

export function mountEventSlideInfoDescriptionTextScaleControls() {
    const host = document.querySelector('#eventSlideMidControls .event-control-buttons');
    if (!host || host.querySelector('.info-description-text-scale')) return;
    host.append(createInfoDescriptionTextScaleControls());
}

applyInfoDescriptionTextScale();
