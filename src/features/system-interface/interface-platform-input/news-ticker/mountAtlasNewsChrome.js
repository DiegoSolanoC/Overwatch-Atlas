/**
 * Atlas News red trapezoid + logo must sit above the footer and dock as its
 * own layer (not clipped to the footer flex band).
 *
 * While `footer.timeline-loaded` is set:
 *   - reparent `.footer-atlas-news` onto `document.body`
 *   - force fixed geometry via inline !important styles (beats cascade fights)
 * When the class is removed, restore the node into the footer.
 */

const BADGE_SELECTOR = '.footer-atlas-news';

const FLOAT_CSS_TEXT = [
    'display:flex',
    'position:fixed',
    'left:0',
    'right:auto',
    'bottom:0',
    'top:auto',
    'width:128px',
    'height:112px',
    'margin:0',
    'padding:6px 8px 6px 6px',
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

function getBadge() {
    return document.querySelector(BADGE_SELECTOR);
}

function getFooter() {
    return document.querySelector('footer');
}

function applyFloatInline(badge) {
    badge.classList.add('footer-atlas-news--floating');
    badge.style.cssText = FLOAT_CSS_TEXT;
    // Reinforce critical props that themes may fight with !important.
    badge.style.setProperty('position', 'fixed', 'important');
    badge.style.setProperty('z-index', '2500', 'important');
    badge.style.setProperty('width', '128px', 'important');
    badge.style.setProperty('height', '112px', 'important');
    badge.style.setProperty('bottom', '0', 'important');
    badge.style.setProperty('left', '0', 'important');
    badge.style.setProperty('overflow', 'visible', 'important');
    badge.style.setProperty('clip-path', 'polygon(0% 0%, 100% 0%, 88% 100%, 0% 100%)', 'important');
    badge.style.setProperty('background', '#C93439', 'important');
    badge.style.setProperty('padding', '6px 8px 6px 6px', 'important');

    const img = badge.querySelector('img');
    if (img) {
        img.style.setProperty('width', '100%', 'important');
        img.style.setProperty('height', '100%', 'important');
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
