/**
 * Wiki-style subtitle markup:
 *  - **stage SFX / direction** → small muted (always when hero is not SFX-only)
 *  - *spoken emphasis* → italic
 *  - (sfx) parenthetical → small muted when it matches known stage cues
 *  - (Chinese) / (Hamster Noises) language-style tags stay full size
 */

/**
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Decode wiki/HTML entities that leaked into stored subtitle strings
 * (e.g. Classic imports with leading `&#160;`).
 * @param {string} text
 * @returns {string}
 */
export function decodeDialogueSubtitleEntities(text) {
    return String(text || '')
        .replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
            const codePoint = Number.parseInt(hex, 16);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        })
        .replace(/&#(\d+);/g, (match, dec) => {
            const codePoint = Number.parseInt(dec, 10);
            return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
        })
        .replace(/&nbsp;/gi, ' ')
        .replace(/&mdash;/gi, '—')
        .replace(/&ndash;/gi, '–')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&apos;/gi, "'");
}

/**
 * Wiki interaction outcome markers — not spoken dialogue.
 * Also normalizes HTML entities / NBSP that should not appear in spoken text.
 * @param {string} text
 * @returns {string}
 */
export function stripWikiOutcomeMarkers(text) {
    return decodeDialogueSubtitleEntities(String(text || ''))
        .replace(/\u00A0/g, ' ')
        .replace(/\*?\(\s*(?:fails|succeeds)\s*\)\*?/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Heroes whose lines are SFX-only — keep their text at full size/contrast.
 * @param {string} hero
 * @returns {boolean}
 */
export function isDialogueSfxOnlyHero(hero) {
    const key = String(hero || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '');
    return key === 'bastion' || key === 'jetpack cat' || key === 'jetpackcat';
}

/**
 * Sound-effect / stage-direction tokens for legacy *…* and (…).
 * Double-star **…** is always treated as SFX (see formatDialogueSubtitleHtml).
 * Language tags like (Chinese) are not SFX.
 */
const DIALOGUE_SFX_INNER =
    '(?:' +
    [
        'sighs?',
        'chuckles?',
        'chuckling',
        'laughs?',
        'laughter',
        'scoffs?',
        'gasps?',
        'groans?',
        'grunts?',
        'giggles?',
        'whispers?',
        'sniffs?',
        'sniffles?',
        'coughs?',
        'wheezes?',
        'heh',
        'snorts?',
        'huffs?',
        'hiss(?:es)?',
        'snickers?',
        'grumbles?',
        'grumbling',
        'humming',
        'whistles?',
        'breathes?',
        'pauses?',
        'ahem',
        'tsk',
        'clears\\s+throat',
        'beeps?',
        'beep-boxes',
        'beep\\s+boxing',
        'western\\s+whistle',
        'meows?',
        'meowing',
        'purrs?',
        'contented\\s+(?:meows?|meowing|purrs?)',
        'innocent\\s+meows?',
        'questioning\\s+meows?',
        'provoking\\s+meows?',
        'confused\\s+meows?',
        'unamused\\s+meows?',
        'self-referential\\s+meow',
        'cat\\s+sounds?',
        'proud\\s+beeps?',
        'worried\\s+beeps?',
        'hesitant\\s+beeps?',
        'reverent\\s+beeps?',
        'giggly\\s+beeps?',
        'refuting\\s+beeps?',
        'affirmative\\s+beeps?',
        'sad,?\\s+affirmative\\s+beeps?',
        'sad\\s+beeps?',
        'bashful\\s+beeps?',
        'impressed\\s+beeps?',
        'various\\s+beeps?',
        'elephant\\s+beeping',
        'aggressive\\s+sneeze',
        'hushed,?\\s+excited\\s+cry',
        'nervous\\s+laugh(?:ter)?',
        'nervous\\s+chuckle',
        'soft\\s+chuckle',
        'soft\\s+cry(?:ing)?',
        'quiet\\s+chuckle',
        'heavy\\s+sigh',
        'tired\\s+sigh',
        'mock\\s+sigh',
        'sniffs\\s+and\\s+chuckles',
        'bursts?\\s+into\\s+tears',
        'hamster\\s+(?:noises?|squeaks?)',
        'angry\\s+squeaks?',
        'surprised\\s+denial',
        'imitates\\s+bastion',
        'mimics\\s+radio\\s+static',
        'vicu[nñ]a\\s+noises?',
    ].join('|') +
    ')';

/** Legacy single-star SFX: *sigh* (spoken emphasis uses *word* and does not match this). */
const DIALOGUE_SFX_ITALIC_RE = new RegExp(`\\*(${DIALOGUE_SFX_INNER})\\*`, 'gi');
/**
 * Parenthetical SFX for muted styling.
 * Language-style tags stay full size: (Chinese), (Japanese), (Hamster Noises), …
 */
const DIALOGUE_SFX_PAREN_RE = new RegExp(`\\((${DIALOGUE_SFX_INNER})\\)`, 'gi');
const LANGUAGE_STYLE_PAREN_RE =
    /^\((?:Chinese|Japanese|French|Spanish|Korean|Russian|German|Portuguese|Hamster Noises)\)$/i;

/**
 * Plain text for summaries, matching, and compact labels.
 * @param {string} text
 * @returns {string}
 */
export function stripDialogueSubtitleMarkup(text) {
    return stripWikiOutcomeMarkers(String(text || ''))
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/\*+/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Display HTML for view panel and stage overlay.
 * @param {string} text
 * @param {{ hero?: string }} [options]
 * @returns {string}
 */
export function formatDialogueSubtitleHtml(text, options = {}) {
    const raw = stripWikiOutcomeMarkers(String(text || '').trim());
    if (!raw) return '';

    const muteSfx = !isDialogueSfxOnlyHero(options.hero);
    let html = escapeHtml(raw);

    if (muteSfx) {
        // Canonical stage tags: **nervous laugh**, **impressed beeps**, …
        html = html.replace(
            /\*\*([^*]+)\*\*/g,
            '<span class="dialogue-theater-subtitle__sfx">$1</span>',
        );
        // Legacy *sigh* / *chuckle* — only when the token is a known SFX cue
        html = html.replace(
            DIALOGUE_SFX_ITALIC_RE,
            '<span class="dialogue-theater-subtitle__sfx">$1</span>',
        );
    } else {
        // Bastion / Jetpack Cat: keep full size; just unwrap markup
        html = html.replace(/\*\*([^*]+)\*\*/g, '$1');
        html = html.replace(/\*([^*]+)\*/g, '$1');
    }

    // Remaining single-star = spoken emphasis (*professionals*, *not*, …)
    html = html.replace(/\*([^*]+)\*/g, '<em class="dialogue-theater-subtitle__em">$1</em>');

    if (muteSfx) {
        html = html.replace(DIALOGUE_SFX_PAREN_RE, (full, inner) => {
            if (LANGUAGE_STYLE_PAREN_RE.test(full)) return full;
            return `<span class="dialogue-theater-subtitle__sfx">(${inner})</span>`;
        });
    }

    return html;
}
