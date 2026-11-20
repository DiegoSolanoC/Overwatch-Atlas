/**
 * Atlas News red trapezoid + logo must sit above the footer and dock as its
 * own layer (not clipped to the footer flex band).
 *
 * While `footer.timeline-loaded` is set:
 *   - reparent `.footer-atlas-news` onto `document.body`
 *   - force fixed geometry via inline !important styles (beats cascade fights)
 * When the class is removed, restore the node into the footer.
 *
 * Width / height / icon size come from UI Tweaks CSS vars
 * (`--atlas-news-width`, `--atlas-news-height`, `--atlas-news-icon-pct`).
 */

const BADGE_SELECTOR = '.footer-atlas-news';

const DEFAULT_WIDTH = '90px';
const DEFAULT_HEIGHT = '56px';
const DEFAULT_ICON_PCT = '86%';

function readAtlasNewsMetrics() {
    const root = document.documentElement;
    const fromInline = (prop) => root?.style?.getPropertyValue(prop)?.trim() || '';
    const fromComputed = (prop) => {
        try {
            return getComputedStyle(root).getPropertyValue(prop).trim();
        } catch {
            return '';
        }
    };
    return {
        width: fromInline('--atlas-news-width') || fromComputed('--atlas-news-width') || DEFAULT_WIDTH,
        height:
            fromInline('--atlas-news-height') || fromComputed('--atlas-news-height') || DEFAULT_HEIGHT,
        iconPct:
            fromInline('--atlas-news-icon-pct') ||
            fromComputed('--atlas-news-icon-pct') ||
            DEFAULT_ICON_PCT,
    };
}

function getBadge() {
    return document.querySelector(BADGE_SELECTOR);
}

function getFooter() {
    return document.querySelector('footer');
}

function applyFloatInline(badge) {
    const { width, height, iconPct } = readAtlasNewsMetrics();

    badge.classList.add('footer-atlas-news--floating');
    badge.style.cssText = [
        'display:flex',
        'position:fixed',
        'left:0',
        'right:auto',
        'bottom:0',
        'top:auto',
        `width:${width}`,
        `height:${height}`,
        'margin:0',
        'padding:4px 14px 4px 6px',
        'z-index:2500',
        'background:#C93439',
        'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
        'transform:none',
        'overflow:visible',
        'pointer-events:auto',
        'clip-path:polygon(0% 0%, 100% 0%, 88% 100%, 0% 100%)',
        'border-top-right-radius:6px',
        'border-bottom-right-radius:6px',
        'border-top-left-radius:0',
        'border-bottom-left-radius:0',
        'align-items:center',
        'justify-content:center',
        'box-sizing:border-box',
    ].join(';');

    // Reinforce critical props that themes may fight with !important.
    // z-index stays in CSS: 2500 idle, 1500 under .loading-overlay.active.
    badge.style.setProperty('position', 'fixed', 'important');
    badge.style.removeProperty('z-index');
    badge.style.setProperty('width', width, 'important');
    badge.style.setProperty('height', height, 'important');
    badge.style.setProperty('bottom', '0', 'important');
    badge.style.setProperty('left', '0', 'important');
    badge.style.setProperty('overflow', 'visible', 'important');
    badge.style.setProperty(
        'clip-path',
        'polygon(0% 0%, 100% 0%, 88% 100%, 0% 100%)',
        'important',
    );
    badge.style.setProperty('background', '#C93439', 'important');
    badge.style.setProperty('padding', '4px 14px 4px 6px', 'important');

    const img = badge.querySelector('img');
    if (img) {
        img.style.setProperty('width', iconPct, 'important');
        img.style.setProperty('height', iconPct, 'important');
        img.style.setProperty('max-width', '100%', 'important');
        img.style.setProperty('max-height', '100%', 'important');
        img.style.setProperty('object-fit', 'contain', 'important');
        img.style.setProperty('display', 'block', 'important');
    }
}

function clearFloatInline(badge) {
    badge.classList.remove('footer-atlas-news--floating');
    badge.removeAttribute('style');
    const img = badge.querySelector('img');
    if (img) img.removeAttribute('style');
}

export function mountAtlasNewsAboveChrome() {
    const footer = getFooter();
    const badge = getBadge();
    if (!footer || !badge) return;

    const shouldFloat = footer.classList.contains('timeline-loaded');
    if (shouldFloat) {
        if (badge.parentElement !== document.body) {
            document.body.appendChild(badge);
        }
        applyFloatInline(badge);
        footer.style.setProperty('overflow', 'visible', 'important');
        footer.style.setProperty('z-index', '800', 'important');
        return;
    }

    clearFloatInline(badge);
    if (badge.parentElement !== footer) {
        footer.insertBefore(badge, footer.firstChild);
    }
}

let observer = null;

export function installAtlasNewsChrome() {
    mountAtlasNewsAboveChrome();
    if (observer || typeof MutationObserver !== 'function') {
        return;
    }

    const footer = getFooter();
    if (!footer) return;

    observer = new MutationObserver(() => {
        mountAtlasNewsAboveChrome();
    });
    observer.observe(footer, { attributes: true, attributeFilter: ['class'] });
}
