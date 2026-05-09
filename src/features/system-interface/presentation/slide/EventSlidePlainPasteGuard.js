/**
 * Plain-text paste for event slide title/description contenteditable fields.
 *
 * EventSlideManager wires paste only from showEventSlide(); globe/marker flows use
 * UIView._showEventSlideSimple() and never hit that path, so rich HTML (e.g. GrammarCheck)
 * was still pasted into #eventSlideText. A single capture-phase document listener fixes all routes.
 */

function clipboardPlainFromDataTransfer(dt) {
    if (!dt) return '';
    let text = dt.getData('text/plain') ?? '';
    text = text.replace(/\r\n/g, '\n');
    if (text) return text;
    const html = dt.getData('text/html') ?? '';
    if (!html) return '';
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return (doc.body?.textContent ?? '').replace(/\r\n/g, '\n');
    } catch {
        return '';
    }
}

function insertPlainTextAtSelection(text) {
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

export function installEventSlidePlainPasteGuard() {
    if (typeof document === 'undefined') return;
    if (document.documentElement.dataset.eventSlidePlainPasteGuard === '1') return;
    document.documentElement.dataset.eventSlidePlainPasteGuard = '1';

    document.addEventListener(
        'paste',
        (e) => {
            const raw = e.target;
            if (!(raw instanceof Node)) return;
            const host = raw.nodeType === Node.TEXT_NODE ? raw.parentElement : raw;
            if (!host || typeof host.closest !== 'function') return;

            const root = host.closest('#eventSlideText, #eventSlideTitle');
            if (!root || !(root instanceof HTMLElement) || !root.isContentEditable) return;

            const sel = window.getSelection?.();
            if (!sel || sel.rangeCount === 0) return;
            const range = sel.getRangeAt(0);
            if (!root.contains(range.commonAncestorContainer)) return;

            const text = clipboardPlainFromDataTransfer(e.clipboardData);
            if (!text) return;

            e.preventDefault();
            e.stopPropagation();
            insertPlainTextAtSelection(text);
        },
        true
    );
}
