/**
 * Wire Story / Details jump buttons under the event-slide close cluster.
 *
 * Story mode panes:
 *   `#eventSlideStorySection` — description
 *   `#eventSlideDetails` — commentary, locations, sources, …
 *
 * Theatre mode remaps the same buttons to Info / Dialogue|Chatter anchors
 * inside `#dialogueTheaterEditHost`.
 *
 * An end spacer (one viewport tall) lets mid-pane sections pin flush to the top.
 */

const SECTION_JUMP_IDS = ['eventSlideJumpStory', 'eventSlideJumpDetails'];
const PIN_SPACER_ID = 'eventSlideScrollPinSpacer';

/** @type {ResizeObserver | null} */
let pinSpacerObserver = null;

/**
 * @param {HTMLElement} host
 */
function ensurePinSpacer(host) {
  let spacer = document.getElementById(PIN_SPACER_ID);
  const theaterMode = document.getElementById('eventSlide')?.classList.contains(
    'event-slide--dialogue-theater',
  );

  // Theater content is short (esp. chatter) — a full-viewport spacer makes leftover
  // scrollTop look like an empty panel. Keep spacer for story Details pinning only.
  if (theaterMode) {
    if (spacer) {
      spacer.style.height = '0px';
      spacer.hidden = true;
    }
    return;
  }

  if (!spacer) {
    spacer = document.createElement('div');
    spacer.id = PIN_SPACER_ID;
    spacer.className = 'event-slide-scroll-pin-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    host.appendChild(spacer);
  } else if (spacer.parentElement !== host) {
    host.appendChild(spacer);
  }
  spacer.hidden = false;

  const next = Math.max(0, Math.round(host.clientHeight));
  if (Math.abs(spacer.offsetHeight - next) > 1) {
    spacer.style.height = `${next}px`;
  }
}

/**
 * @param {HTMLElement} host
 */
function ensurePinSpacerObserver(host) {
  ensurePinSpacer(host);
  if (pinSpacerObserver || typeof ResizeObserver === 'undefined') return;
  pinSpacerObserver = new ResizeObserver(() => {
    const scrollable = document.getElementById('eventSlideScrollable');
    if (scrollable) ensurePinSpacer(scrollable);
  });
  pinSpacerObserver.observe(host);
}

/**
 * @param {'story' | 'details' | 'theater-info' | 'theater-lines'} section
 * @returns {HTMLElement | null}
 */
function resolveSectionPane(section) {
  if (section === 'story') {
    return (
      document.getElementById('eventSlideStorySection') ||
      document.getElementById('eventSlideText')
    );
  }
  if (section === 'details') {
    return document.getElementById('eventSlideDetails');
  }
  if (section === 'theater-info') {
    return document.getElementById('dialogueTheaterInfoSection');
  }
  if (section === 'theater-lines') {
    return document.getElementById('dialogueTheaterLinesSection');
  }
  return null;
}

/**
 * Offset of `el`’s border-top relative to `host`’s padding box.
 * @param {HTMLElement} el
 * @param {HTMLElement} host
 * @returns {number}
 */
function offsetTopInHost(el, host) {
  if (el === host) return 0;
  if (el.parentElement === host) return el.offsetTop;

  let top = 0;
  let node = el;
  while (node && node !== host) {
    top += node.offsetTop;
    const next = node.offsetParent;
    if (!next || next === host) {
      if (next === host) return top;
      break;
    }
    if (!host.contains(next)) break;
    node = next;
  }

  return host.scrollTop + (el.getBoundingClientRect().top - host.getBoundingClientRect().top);
}

/**
 * Remap jump button labels/targets for story vs Dialogue Theater.
 * @param {'story' | 'theater'} mode
 * @param {{ isChatter?: boolean }} [opts]
 */
export function syncEventSlideSectionJumpsMode(mode, opts = {}) {
  const storyBtn = document.getElementById('eventSlideJumpStory');
  const detailsBtn = document.getElementById('eventSlideJumpDetails');
  if (!storyBtn || !detailsBtn) return;

  if (mode === 'theater') {
    if (opts.isChatter) {
      storyBtn.hidden = true;
      storyBtn.setAttribute('aria-hidden', 'true');
      detailsBtn.hidden = false;
      detailsBtn.removeAttribute('aria-hidden');
      detailsBtn.textContent = 'Chatter';
      detailsBtn.setAttribute('data-event-section', 'theater-lines');
    } else {
      storyBtn.hidden = false;
      storyBtn.removeAttribute('aria-hidden');
      detailsBtn.hidden = false;
      detailsBtn.removeAttribute('aria-hidden');
      storyBtn.textContent = 'Info';
      storyBtn.setAttribute('data-event-section', 'theater-info');
      detailsBtn.textContent = 'Dialogue';
      detailsBtn.setAttribute('data-event-section', 'theater-lines');
    }
  } else {
    storyBtn.hidden = false;
    detailsBtn.hidden = false;
    storyBtn.removeAttribute('aria-hidden');
    detailsBtn.removeAttribute('aria-hidden');
    storyBtn.textContent = 'Story';
    storyBtn.setAttribute('data-event-section', 'story');
    detailsBtn.textContent = 'Details';
    detailsBtn.setAttribute('data-event-section', 'details');
  }

  for (const id of SECTION_JUMP_IDS) {
    document.getElementById(id)?.classList.remove('is-active');
    document.getElementById(id)?.removeAttribute('aria-current');
  }
}

/**
 * @param {string} section
 */
export function scrollEventSlideSectionIntoView(section) {
  const host = document.getElementById('eventSlideScrollable');
  const pane = resolveSectionPane(section);
  if (!host || !pane || !host.contains(pane)) return;

  ensurePinSpacerObserver(host);
  ensurePinSpacer(host);

  const top =
    (section === 'story' || section === 'theater-info') &&
    (pane.id === 'eventSlideStorySection' ||
      pane.id === 'eventSlideText' ||
      pane.id === 'dialogueTheaterInfoSection')
      ? Math.max(0, Math.round(offsetTopInHost(pane, host)))
      : Math.max(0, Math.round(offsetTopInHost(pane, host)));

  if (section === 'story' && pane.id === 'eventSlideStorySection') {
    host.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }

  host.scrollTo({ top, behavior: 'auto' });
}

/**
 * @param {string} activeBtnId
 */
function setActiveJumpButton(activeBtnId) {
  for (const id of SECTION_JUMP_IDS) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    const isActive = id === activeBtnId;
    btn.classList.toggle('is-active', isActive);
    if (isActive) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  }
}

/**
 * Bind click handlers once. Safe to call multiple times.
 */
export function wireEventSlideSectionJumps() {
  const host = document.getElementById('eventSlideScrollable');
  if (host) ensurePinSpacerObserver(host);

  for (const id of SECTION_JUMP_IDS) {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.sectionJumpBound === '1') continue;
    btn.dataset.sectionJumpBound = '1';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const section = btn.getAttribute('data-event-section');
      if (
        section !== 'story' &&
        section !== 'details' &&
        section !== 'theater-info' &&
        section !== 'theater-lines'
      ) {
        return;
      }
      setActiveJumpButton(id);
      scrollEventSlideSectionIntoView(section);
    });
  }
}
