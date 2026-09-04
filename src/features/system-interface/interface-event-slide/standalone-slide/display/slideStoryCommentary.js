/**
 * Paint the Story slide “Commentary” block (Dialogue Theater interactions).
 * Layout matches relevancy rows: all-caps title, gallery-size speaker chips, play control.
 */

import { getEventCommentaryNames } from '../../../interface-shared/storyEventCommentary.js';
import { openDialogueTheaterFromStoryCommentary } from '../../../interface-shared/openDialogueTheaterFromStoryCommentary.js';
import { dialogueTheaterDataService } from '../../../../dialogue-theater/data/DialogueTheaterDataService.js?v=105';
import { normalizeForPredictiveMatch } from '../../../interface-left-panel/event-system/form/autocomplete/tokenInputMatching.js';

const DIALOGUE_THEATER_ICON =
    'src/assets/images/Icons/Mode%20Icons/Dialogue%20Theater.png';

/**
 * @param {import('../../../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation | null | undefined} conversation
 * @returns {string[]}
 */
function collectConversationSpeakerNames(conversation) {
    if (!conversation) return [];
    /** @type {string[]} */
    const out = [];
    const seen = new Set();

    const pushHero = (raw) => {
        const name = String(raw ?? '').trim();
        if (!name) return;
        const key = name.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(name);
    };

    const walkLines = (lines) => {
        if (!Array.isArray(lines)) return;
        for (const line of lines) pushHero(line?.hero);
    };

    walkLines(conversation.lines);
    if (Array.isArray(conversation.paths)) {
        for (const path of conversation.paths) walkLines(path?.lines);
    }
    return out;
}

/**
 * @param {string} interactionName
 * @returns {import('../../../../dialogue-theater/data/DialogueTheaterDataService.js').DialogueConversation | null}
 */
function findConversationByName(interactionName) {
    const needle = normalizeForPredictiveMatch(interactionName);
    if (!needle) return null;
    const matches = (dialogueTheaterDataService.conversations || []).filter(
        (row) => normalizeForPredictiveMatch(row?.name) === needle,
    );
    if (!matches.length) return null;
    const active = matches.find((row) => String(row.status || 'active') !== 'removed');
    return active || matches[0];
}

/**
 * Prefer Heroes archive for theater speakers (incl. Sierra, Shion, Vendetta, …).
 * Only use NPC chips when the name is an actual NPC filter entry and not a hero.
 * @param {string} token
 * @returns {'heroes'|'npcs'}
 */
function speakerChipKind(token) {
    const B = window.__SlideBioConnections;
    const R = window.__FlagFileResolver;
    const t = String(token || '').trim();
    if (!t) return 'heroes';

    const nk = R?.normalizeKey?.(t) || t.toLowerCase();
    const heroes = window.eventManager?.heroes || window.globeController?.dataModel?.heroes || [];
    const isManifestHero = heroes.some(
        (h) => (R?.normalizeKey?.(h) || String(h).toLowerCase()) === nk,
    );
    if (isManifestHero) return 'heroes';

    const npcs = window.eventManager?.npcs || [];
    const isManifestNpc = npcs.some(
        (n) => (R?.normalizeKey?.(n) || String(n).toLowerCase()) === nk,
    );
    if (isManifestNpc) return 'npcs';

    // Alias resolution only (e.g. "Soldier: 76" → "Soldier 76").
    const heroKey = B?.resolveHeroImageKey?.(t);
    if (heroKey && heroKey !== t) return 'heroes';
    const npcKey = B?.resolveNpcImageKey?.(t);
    if (npcKey && npcKey !== t) return 'npcs';

    return 'heroes';
}

/**
 * Same gallery chip markup as story relevancy heroes/NPCs.
 * @param {string} token
 * @returns {string}
 */
function speakerChipHtml(token) {
    const R = window.__FlagFileResolver;
    const B = window.__SlideBioConnections;
    if (!R || !B) return '';

    const t = R.stripTrailingCommaSep(String(token || '')).trim();
    if (!t) return '';

    const kind = speakerChipKind(t);
    let src = '';
    let label = t;
    let openAttr = '';
    let clickClass = '';
    let title = '';
    const fb = B.filterFallbackIconSrc(kind).replace(/'/g, "\\'");

    if (kind === 'npcs') {
        const nk = B.resolveNpcImageKey(t);
        label = nk || t;
        src = `src/assets/images/Filters/NPCs/${encodeURIComponent(nk || t)}.png`;
        openAttr = `data-npc-open="${encodeURIComponent(nk || t)}"`;
        clickClass = 'event-slide-filter-token-chip--clickable-npc';
        title = `Open ${R.escapeHtmlAttr(nk || t)} in NPCs archive`;
    } else {
        const hk = B.resolveHeroImageKey(t);
        const canon = hk || t;
        label = canon;
        src = `src/assets/images/Filters/Heroes/${encodeURIComponent(canon)}.png`;
        openAttr = `data-hero-open="${encodeURIComponent(canon)}"`;
        clickClass = 'event-slide-filter-token-chip--clickable-hero';
        title = `Open ${R.escapeHtmlAttr(canon)} in Heroes archive`;
    }

    return (
        `<div class="gallery-hero-filters__chip-wrap event-slide-filter-token-chip-wrap">` +
        `<button type="button" class="filter-btn gallery-hero-filters__chip event-slide-filter-token-chip ${clickClass}" ${openAttr}` +
        ` title="${title}" aria-label="${title}">` +
        `<div class="filter-image-container">` +
        `<img src="${src}" alt="" loading="lazy" decoding="async" ` +
        `onerror="this.onerror=null;this.src='${fb}';" />` +
        `</div>` +
        `<div class="filter-label">` +
        `<span class="filter-label-text">${R.slideStoryDisplayHtml(label)}</span>` +
        `</div>` +
        `</button>` +
        `</div>`
    );
}

/**
 * @param {HTMLElement} section
 */
function wireCommentaryBioArchiveNav(section) {
    const B = window.__SlideBioConnections;
    if (B && typeof B.wireStoryFilterSectionBioArchiveNav === 'function') {
        B.wireStoryFilterSectionBioArchiveNav(section);
    }
}

/**
 * Hide / clear the commentary section.
 */
export function clearStoryCommentarySlideDom() {
    const section = document.getElementById('eventCommentarySection');
    const list = document.getElementById('eventSlideCommentary');
    if (list) list.innerHTML = '';
    if (section) {
        section.style.display = 'none';
        section.setAttribute('hidden', 'hidden');
    }
}

/**
 * @param {object | null | undefined} event
 */
export function updateStoryCommentarySlideFromEvent(event) {
    const section = document.getElementById('eventCommentarySection');
    const list = document.getElementById('eventSlideCommentary');
    if (!section || !list) return;

    const names = getEventCommentaryNames(event);
    list.innerHTML = '';

    if (!names.length) {
        section.style.display = 'none';
        section.setAttribute('hidden', 'hidden');
        return;
    }

    section.style.display = '';
    section.removeAttribute('hidden');

    const R = window.__FlagFileResolver;

    // Kick theater data load if empty so speaker chips can resolve on first paint / next refresh.
    if (!Array.isArray(dialogueTheaterDataService.conversations)
        || dialogueTheaterDataService.conversations.length === 0) {
        void dialogueTheaterDataService.load().then(() => {
            const still = document.getElementById('eventSlideCommentary');
            if (still && getEventCommentaryNames(event).length) {
                updateStoryCommentarySlideFromEvent(event);
            }
        });
    }

    names.forEach((name) => {
        const item = document.createElement('div');
        item.className = 'event-commentary-display-item';

        const label = document.createElement('span');
        label.className = 'event-commentary-display-item__title';
        if (R?.slideStoryDisplayHtml) {
            label.innerHTML = R.slideStoryDisplayHtml(name);
        } else {
            label.textContent = name;
        }
        item.appendChild(label);

        const trailing = document.createElement('div');
        trailing.className = 'event-commentary-display-item__trailing';

        const speakers = collectConversationSpeakerNames(findConversationByName(name));
        if (speakers.length) {
            const chipRow = document.createElement('span');
            chipRow.className =
                'event-slide-relevant-locations__flag-row event-slide-relevant-locations__flag-row--chips event-commentary-display-item__chips';
            chipRow.innerHTML = speakers.map((hero) => speakerChipHtml(hero)).join('');
            trailing.appendChild(chipRow);
        }

        const playBtn = document.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'event-source-media-play event-source-media-play--commentary';
        playBtn.dataset.commentaryPlay = name;
        playBtn.title = `Open “${name}” in Dialogue Theater`;
        playBtn.setAttribute('aria-label', `Open ${name} in Dialogue Theater`);

        const img = document.createElement('img');
        img.src = DIALOGUE_THEATER_ICON;
        img.alt = '';
        img.className = 'event-source-media-play__icon';
        img.decoding = 'async';
        img.draggable = false;
        playBtn.appendChild(img);

        playBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const open =
                window.StoryCommentaryTheaterNav?.openDialogueTheaterFromStoryCommentary
                || openDialogueTheaterFromStoryCommentary;
            void open(name);
        });

        trailing.appendChild(playBtn);
        item.appendChild(trailing);
        list.appendChild(item);
    });

    wireCommentaryBioArchiveNav(section);
}
