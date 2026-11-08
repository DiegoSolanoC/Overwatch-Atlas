import { wireLoadingAssetImage } from '../atlas-ui/loadingAssetSlot.js';
import { menuHoverImagePath } from './wireMenuHoverIcon.js';

/**
 * Portrait / narrow mobile main menu: full-bleed mode slides + Select CTA.
 * Desktop keeps the modes-only tile layout; this deck is CSS-hidden outside portrait.
 */


const HOVER_PREVIEW_MS = 300;

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
function probeImageUrl(url) {
    return new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => resolve(true);
        probe.onerror = () => resolve(false);
        probe.src = url;
    });
}

/** Same asset as dock prev/next event buttons. */
const PAGE_ARROW_SRC = 'src/assets/images/Icons/Utility%20Icons/Arrow%20Icon.png';

/** @typedef {{ id: string, label: string, title: string, description: string, imagePath: string, handlerKey: string }} MobileModeSlide */

/** @type {MobileModeSlide[]} */
export const MAIN_MENU_MOBILE_MODES = [
    {
        id: 'world',
        label: 'World',
        title: 'World',
        description: 'Visualize the story on a globe or map',
        imagePath: 'src/assets/images/Menu/World.png',
        handlerKey: 'setupGlobeHandler',
    },
    {
        id: 'codex',
        label: 'Codex',
        title: 'Codex',
        description: 'Study how every detail connects',
        imagePath: 'src/assets/images/Menu/Codex.png',
        handlerKey: 'setupGlossaryHandler',
    },
    {
        id: 'story',
        label: 'Story',
        title: 'Story',
        description: 'Experience the Narrative in Order',
        imagePath: 'src/assets/images/Menu/Story.png',
        handlerKey: 'setupStoryTimelineHandler',
    },
    {
        id: 'intel',
        label: 'Intel',
        title: 'Intel',
        description: 'Browse heroes, factions, NPCs, and places',
        imagePath: 'src/assets/images/Menu/Intel.png',
        handlerKey: 'setupHeroBiographyHandler',
    },
    {
        id: 'theater',
        label: 'Theater',
        title: 'Theater',
        description: 'Listen to Character Interactions',
        imagePath: 'src/assets/images/Menu/Theater.png',
        handlerKey: 'setupDialogueTheaterHandler',
    },
    {
        id: 'archive',
        label: 'Archive',
        title: 'Archive',
        description: 'Release schedule and Documentation',
        imagePath: 'src/assets/images/Menu/Archive.png',
        handlerKey: 'setupOfficialResourcesHandler',
    },
    {
        id: 'gallery',
        label: 'Gallery',
        title: 'Gallery',
        description: 'Browse all sorts of Official media',
        imagePath: 'src/assets/images/Menu/Gallery.png',
        handlerKey: 'setupGalleryHubHandler',
    },
];

/**
 * Lightweight left/right edge glow (same visual language as WorldviewMapEdgeGlow).
 * @param {HTMLElement} host
 */
function createDeckEdgeGlow(host) {
    const root = document.createElement('div');
    root.className = 'main-menu-mobile-edge-glow map-edge-glow';
    root.setAttribute('aria-hidden', 'true');

    const left = document.createElement('div');
    left.className = 'map-edge-glow__edge map-edge-glow__edge--left';
    const right = document.createElement('div');
    right.className = 'map-edge-glow__edge map-edge-glow__edge--right';
    root.appendChild(left);
    root.appendChild(right);
    host.appendChild(root);

    let intensity = { left: 0, right: 0 };
    let lastHitTs = 0;
    let activeUntil = 0;
    let active = { left: false, right: false };
    let raf = 0;

    function render() {
        left.style.opacity = String(intensity.left);
        right.style.opacity = String(intensity.right);
    }

    function startDecay() {
        if (raf) return;
        const tick = () => {
            const now = performance.now();
            const idleMs = now - lastHitTs;
            const isActive = now < activeUntil && (active.left || active.right);

            if (!isActive && idleMs > 80) {
                const k = Math.min(1, (idleMs - 80) / 320);
                const decay = 0.06 + 0.26 * k;
                intensity.left = Math.max(0, intensity.left - decay);
                intensity.right = Math.max(0, intensity.right - decay);
                render();
            } else if (isActive) {
                render();
            }

            if (intensity.left > 0.001 || intensity.right > 0.001) {
                raf = requestAnimationFrame(tick);
            } else {
                raf = 0;
            }
        };
        raf = requestAnimationFrame(tick);
    }

    /**
     * @param {{ left?: boolean, right?: boolean, overshoot?: number }} opts
     */
    function hit({ left: hitL = false, right: hitR = false, overshoot = 1 } = {}) {
        if (!hitL && !hitR) return;
        const now = performance.now();
        lastHitTs = now;
        activeUntil = now + 220;
        active = { left: !!hitL, right: !!hitR };

        const boost = Math.max(0.05, Math.min(1, overshoot));
        const target = 0.35 + 0.65 * boost;
        const rise = 0.28 * boost;
        if (hitL) intensity.left = Math.min(1, Math.max(intensity.left, target) + rise * 0.35);
        else intensity.left = Math.max(0, intensity.left - 0.06);
        if (hitR) intensity.right = Math.min(1, Math.max(intensity.right, target) + rise * 0.35);
        else intensity.right = Math.max(0, intensity.right - 0.06);

        render();
        startDecay();
    }

    return {
        hit,
        destroy() {
            if (raf) cancelAnimationFrame(raf);
            root.remove();
        },
    };
}

/**
 * @param {object} handlers - Same keys as `wireModeActivation` / `createMenuButtons`.
 * @returns {HTMLElement}
 */
export function createMenuMobileSlides(handlers = {}) {
    const deck = document.createElement('div');
    deck.className = 'main-menu-mobile-deck';
    deck.setAttribute('aria-label', 'Atlas modes');

    const viewport = document.createElement('div');
    viewport.className = 'main-menu-mobile-viewport';
    viewport.setAttribute('tabindex', '0');
    viewport.setAttribute('role', 'region');
    viewport.setAttribute('aria-roledescription', 'carousel');
    viewport.setAttribute('aria-label', 'Mode slides');

    const track = document.createElement('div');
    track.className = 'main-menu-mobile-track';

    /** @type {HTMLElement[]} */
    const slides = [];

    for (const mode of MAIN_MENU_MOBILE_MODES) {
        const slide = document.createElement('article');
        slide.className = 'main-menu-mobile-slide';
        slide.dataset.modeId = mode.id;
        slide.dataset.handlerKey = mode.handlerKey;
        slide.setAttribute('aria-label', mode.label);

        const media = document.createElement('div');
        media.className = 'main-menu-mobile-slide__media';

        const img = document.createElement('img');
        img.src = mode.imagePath;
        img.alt = mode.title;
        img.draggable = false;
        wireLoadingAssetImage(img, { wrap: media });
        media.appendChild(img);

        const shade = document.createElement('div');
        shade.className = 'main-menu-mobile-slide__shade';
        shade.setAttribute('aria-hidden', 'true');

        const copy = document.createElement('div');
        copy.className = 'main-menu-mobile-slide__copy';
        copy.innerHTML = `
            <div class="main-menu-mobile-slide__label">${mode.label}</div>
            <div class="main-menu-mobile-slide__desc">${mode.description}</div>
        `;

        slide.appendChild(media);
        slide.appendChild(shade);
        slide.appendChild(copy);
        track.appendChild(slide);
        slides.push(slide);
    }

    viewport.appendChild(track);

    const edgeGlow = createDeckEdgeGlow(deck);

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'main-menu-mobile-nav main-menu-mobile-nav--prev';
    prevBtn.title = 'Previous mode';
    prevBtn.setAttribute('aria-label', 'Previous mode');
    prevBtn.innerHTML = `<img class="main-menu-mobile-nav__icon" src="${PAGE_ARROW_SRC}" alt="" decoding="async" draggable="false" />`;

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'main-menu-mobile-nav main-menu-mobile-nav--next';
    nextBtn.title = 'Next mode';
    nextBtn.setAttribute('aria-label', 'Next mode');
    nextBtn.innerHTML = `<img class="main-menu-mobile-nav__icon main-menu-mobile-nav__icon--flip" src="${PAGE_ARROW_SRC}" alt="" decoding="async" draggable="false" />`;

    const selectWrap = document.createElement('div');
    selectWrap.className = 'main-menu-mobile-select-wrap';

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.id = 'mainMenuMobileSelectBtn';
    selectBtn.className = 'main-menu-mobile-select';
    selectBtn.textContent = 'Select';
    selectBtn.setAttribute('aria-label', 'Select World');
    selectWrap.appendChild(selectBtn);

    deck.appendChild(viewport);
    deck.appendChild(prevBtn);
    deck.appendChild(nextBtn);
    deck.appendChild(selectWrap);

    let index = 0;
    let scrollRaf = 0;
    const lastIndex = MAIN_MENU_MOBILE_MODES.length - 1;

    function slideWidth() {
        return viewport.clientWidth || 1;
    }

    function syncChrome() {
        const mode = MAIN_MENU_MOBILE_MODES[index];
        selectBtn.setAttribute('aria-label', `Select ${mode.label}`);
        deck.dataset.activeMode = mode.id;
        deck.dataset.atStart = index <= 0 ? '1' : '0';
        deck.dataset.atEnd = index >= lastIndex ? '1' : '0';
        prevBtn.disabled = false;
        nextBtn.disabled = false;
        slides.forEach((el, i) => {
            el.classList.toggle('is-active', i === index);
        });
    }

    function syncFromScroll() {
        const next = Math.round(viewport.scrollLeft / slideWidth());
        const clamped = Math.max(0, Math.min(lastIndex, next));
        if (clamped === index) return;
        index = clamped;
        syncChrome();
    }

    function goTo(i, { smooth = true } = {}) {
        const clamped = Math.max(0, Math.min(lastIndex, i));
        index = clamped;
        viewport.scrollTo({
            left: clamped * slideWidth(),
            behavior: smooth ? 'smooth' : 'auto',
        });
        syncChrome();
    }

    /**
     * Step one mode, or flash edge glow when already at that end.
     * @param {-1|1} dir
     */
    function step(dir) {
        const next = index + dir;
        if (next < 0) {
            edgeGlow.hit({ left: true, overshoot: 1 });
            return;
        }
        if (next > lastIndex) {
            edgeGlow.hit({ right: true, overshoot: 1 });
            return;
        }
        goTo(next);
    }

    viewport.addEventListener(
        'scroll',
        () => {
            if (scrollRaf) cancelAnimationFrame(scrollRaf);
            scrollRaf = requestAnimationFrame(syncFromScroll);
        },
        { passive: true },
    );

    viewport.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
            e.preventDefault();
            step(1);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            step(-1);
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selectBtn.click();
        }
    });

    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        step(-1);
    });
    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        step(1);
    });

    let dragPointerId = null;
    let dragStartX = 0;
    let dragStartScroll = 0;
    let dragMoved = false;

    viewport.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        if (e.button !== 0) return;
        if (e.target.closest('.main-menu-mobile-nav, .main-menu-mobile-select')) return;
        dragPointerId = e.pointerId;
        dragStartX = e.clientX;
        dragStartScroll = viewport.scrollLeft;
        dragMoved = false;
        viewport.setPointerCapture(e.pointerId);
        viewport.classList.add('is-dragging');
    });

    viewport.addEventListener('pointermove', (e) => {
        if (dragPointerId !== e.pointerId) return;
        const dx = e.clientX - dragStartX;
        if (Math.abs(dx) > 4) dragMoved = true;

        const maxScroll = lastIndex * slideWidth();
        const attempted = dragStartScroll - dx;
        if (attempted < -2) {
            edgeGlow.hit({ left: true, overshoot: Math.min(1, Math.abs(attempted) / 48) });
        } else if (attempted > maxScroll + 2) {
            edgeGlow.hit({
                right: true,
                overshoot: Math.min(1, Math.abs(attempted - maxScroll) / 48),
            });
        }

        viewport.scrollLeft = Math.max(0, Math.min(maxScroll, attempted));
    });

    function endDrag(e) {
        if (dragPointerId !== e.pointerId) return;
        dragPointerId = null;
        viewport.classList.remove('is-dragging');
        try {
            viewport.releasePointerCapture(e.pointerId);
        } catch (_) {
            /* already released */
        }
        if (!dragMoved) return;
        const w = slideWidth();
        const target = Math.round(viewport.scrollLeft / w);
        goTo(target);
    }

    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    let touchStartX = 0;
    let touchStartScroll = 0;
    viewport.addEventListener(
        'touchstart',
        (e) => {
            if (!e.touches[0]) return;
            touchStartX = e.touches[0].clientX;
            touchStartScroll = viewport.scrollLeft;
        },
        { passive: true },
    );
    viewport.addEventListener(
        'touchmove',
        (e) => {
            if (!e.touches[0]) return;
            const dx = e.touches[0].clientX - touchStartX;
            const maxScroll = lastIndex * slideWidth();
            const attempted = touchStartScroll - dx;
            if (index <= 0 && attempted < -8) {
                edgeGlow.hit({ left: true, overshoot: Math.min(1, Math.abs(attempted) / 56) });
            } else if (index >= lastIndex && attempted > maxScroll + 8) {
                edgeGlow.hit({
                    right: true,
                    overshoot: Math.min(1, Math.abs(attempted - maxScroll) / 56),
                });
            }
        },
        { passive: true },
    );

    let selectBusy = false;

    /**
     * Show Menu Hover art briefly, then run the mode handler.
     * @param {Function} [launchOverride]
     */
    async function selectWithHoverPreview(launchOverride) {
        if (selectBusy) return;
        selectBusy = true;
        selectBtn.disabled = true;
        try {
            const mode = MAIN_MENU_MOBILE_MODES[index];
            const slide = slides[index];
            const img = slide?.querySelector?.('.main-menu-mobile-slide__media img');
            const hoverSrc = menuHoverImagePath(mode.imagePath);
            if (img && hoverSrc && (await probeImageUrl(hoverSrc))) {
                img.src = hoverSrc;
                await delay(HOVER_PREVIEW_MS);
            }
            const handler = typeof launchOverride === 'function'
                ? launchOverride
                : handlers?.[mode.handlerKey];
            if (typeof handler === 'function') {
                handler();
            }
        } finally {
            selectBusy = false;
            selectBtn.disabled = false;
        }
    }

    selectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void selectWithHoverPreview();
    });

    queueMicrotask(() => {
        goTo(0, { smooth: false });
    });

    syncChrome();

    const onResize = () => {
        goTo(index, { smooth: false });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    function goToModeId(modeId, opts) {
        const i = MAIN_MENU_MOBILE_MODES.findIndex((m) => m.id === modeId);
        if (i < 0) return false;
        goTo(i, opts);
        return true;
    }

    deck.mobileSlidesApi = {
        goTo,
        goToModeId,
        step,
        getIndex: () => index,
        getMode: () => MAIN_MENU_MOBILE_MODES[index],
        selectWithHoverPreview,
        destroy() {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
            edgeGlow.destroy();
        },
    };

    return deck;
}
