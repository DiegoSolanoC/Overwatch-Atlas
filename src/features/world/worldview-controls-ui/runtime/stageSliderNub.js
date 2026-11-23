/**
 * White circle + black icon overlay for stage range sliders.
 * Native ::-webkit-slider-thumb background-image is unreliable; keep the
 * invisible native thumb for hit-testing and paint a real <img> nub on top.
 */

/**
 * @param {HTMLElement | null} shell
 * @param {HTMLInputElement | null} input
 * @param {string} iconSrc
 */
export function installStageSliderNub(shell, input, iconSrc) {
    if (!shell || !input || !iconSrc) return null;
    if (shell.dataset.stageNubReady === '1') {
        return shell.querySelector('.stage-slider-nub');
    }
    shell.dataset.stageNubReady = '1';
    shell.classList.add('stage-slider-shell--has-nub');

    const nub = document.createElement('div');
    nub.className = 'stage-slider-nub';
    nub.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.src = iconSrc;
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    nub.appendChild(img);
    shell.appendChild(nub);

    const sync = () => {
        const min = Number(input.min);
        const max = Number(input.max);
        const val = Number(input.value);
        const lo = Number.isFinite(min) ? min : 0;
        const hi = Number.isFinite(max) ? max : 100;
        const span = hi - lo || 1;
        const pct = Math.min(1, Math.max(0, ((Number.isFinite(val) ? val : lo) - lo) / span));
        const trackW = input.clientWidth || shell.clientWidth || 0;
        const thumbRaw = getComputedStyle(shell).getPropertyValue('--zoom-slider-thumb').trim();
        const thumb = Number.parseFloat(thumbRaw) || 52;
        const travel = Math.max(0, trackW - thumb);
        nub.style.width = `${thumb}px`;
        nub.style.height = `${thumb}px`;
        nub.style.transform = `translate3d(${pct * travel}px, -50%, 0)`;
    };

    input.addEventListener('input', sync);
    input.addEventListener('change', sync);
    window.addEventListener('resize', sync, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => sync());
        ro.observe(shell);
        ro.observe(input);
    }
    input.__stageNubSync = sync;
    requestAnimationFrame(sync);
    return nub;
}
