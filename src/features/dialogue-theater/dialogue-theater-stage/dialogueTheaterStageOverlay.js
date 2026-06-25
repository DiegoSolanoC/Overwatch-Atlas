/**
 * Dialogue Theater stage — uses #eventImageOverlay like story entries.
 * Scene fills the frame; dialogue renders alternate bottom-left / bottom-right.
 */

import {
    loadDialogueTheaterAssets,
    heroFilterIconUrl,
    sceneImageUrl,
} from '../data/loadDialogueTheaterAssets.js';
import {
    getLineRenderSrc,
    getSoloPreviewLine,
    sideForLineIndex,
    buildSpeakerSideMap,
    usesSoloSpeakerPreview,
} from './dialogueTheaterRenderHelpers.js';
import { resolveActiveConversationLines } from '../data/dialogueTheaterPathHelpers.js';
import { formatDialogueSubtitleHtml } from '../data/dialogueSubtitleFormatting.js';
import {
    resolveLineVoiceFile,
    voicelineFilenameToSubtitles,
} from '../data/theaterVoicelineParsing.js';

/** @type {import('../data/loadDialogueTheaterAssets.js').DialogueTheaterAssets|null} */
let stageAssets = null;

const STAGE_DIALOGUE_BOX_HTML = `
    <div class="dialogue-theater-stage__dialogue" hidden>
        <div class="dialogue-theater-stage__dialogue-head">
            <div class="dialogue-theater-stage__dialogue-icon-wrap">
                <img class="dialogue-theater-stage__dialogue-icon" alt="" />
            </div>
            <span class="dialogue-theater-stage__dialogue-name"></span>
        </div>
        <p class="dialogue-theater-stage__dialogue-text"></p>
    </div>
`;

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 * @returns {string}
 */
function getLineDialogueText(line) {
    const voicelines = stageAssets?.voicelines || [];
    const resolvedVoice = resolveLineVoiceFile(line, voicelines);
    return (
        String(line?.subtitles || '').trim() ||
        (resolvedVoice ? voicelineFilenameToSubtitles(resolvedVoice) : '')
    );
}

/**
 * @param {HTMLElement} stage
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine|null} line
 */
function setStageDialogue(stage, line) {
    const box = stage.querySelector('.dialogue-theater-stage__dialogue');
    if (!(box instanceof HTMLElement)) return;

    if (!line) {
        box.hidden = true;
        return;
    }

    const hero = String(line.hero || '').trim();
    const text = getLineDialogueText(line);
    const icon = box.querySelector('.dialogue-theater-stage__dialogue-icon');
    const iconWrap = box.querySelector('.dialogue-theater-stage__dialogue-icon-wrap');
    const nameEl = box.querySelector('.dialogue-theater-stage__dialogue-name');
    const textEl = box.querySelector('.dialogue-theater-stage__dialogue-text');

    box.hidden = false;
    if (nameEl instanceof HTMLElement) {
        nameEl.textContent = hero || 'Unknown';
    }
    if (textEl instanceof HTMLElement) {
        if (text) {
            textEl.innerHTML = formatDialogueSubtitleHtml(text);
        } else {
            textEl.textContent = '…';
        }
    }
    if (icon instanceof HTMLImageElement) {
        if (hero) {
            icon.src = heroFilterIconUrl(hero);
            icon.alt = hero;
            icon.hidden = false;
            iconWrap?.classList.remove('dialogue-theater-stage__dialogue-icon-wrap--empty');
        } else {
            icon.hidden = true;
            icon.removeAttribute('src');
            iconWrap?.classList.add('dialogue-theater-stage__dialogue-icon-wrap--empty');
        }
    }
}

function ensureStageDom() {
    const container = document.getElementById('eventImageContainer');
    const defaultImg = document.getElementById('eventImage');
    if (defaultImg) {
        defaultImg.style.display = 'none';
        defaultImg.removeAttribute('src');
    }
    if (!container) return null;

    let stage = document.getElementById('dialogueTheaterStage');
    if (!stage) {
        stage = document.createElement('div');
        stage.id = 'dialogueTheaterStage';
        stage.className = 'dialogue-theater-stage';
        stage.innerHTML = `
            <img class="dialogue-theater-stage__scene" alt="" />
            <div class="dialogue-theater-stage__scene-gradient" aria-hidden="true"></div>
            <img class="dialogue-theater-stage__render dialogue-theater-stage__render--left" alt="" hidden />
            <img class="dialogue-theater-stage__render dialogue-theater-stage__render--right" alt="" hidden />
            ${STAGE_DIALOGUE_BOX_HTML}
        `;
        container.appendChild(stage);
    } else {
        if (!stage.querySelector('.dialogue-theater-stage__scene-gradient')) {
            const sceneEl = stage.querySelector('.dialogue-theater-stage__scene');
            const gradient = document.createElement('div');
            gradient.className = 'dialogue-theater-stage__scene-gradient';
            gradient.setAttribute('aria-hidden', 'true');
            if (sceneEl instanceof HTMLElement) {
                sceneEl.insertAdjacentElement('afterend', gradient);
            } else {
                stage.prepend(gradient);
            }
        }
        if (!stage.querySelector('.dialogue-theater-stage__dialogue')) {
            stage.insertAdjacentHTML('beforeend', STAGE_DIALOGUE_BOX_HTML);
        }
    }
    return stage;
}

/**
 * @param {HTMLElement} stage
 * @param {'left'|'right'} side
 * @param {string} src
 * @param {boolean} speaking
 */
function setStageRender(stage, side, src, speaking = false) {
    const img = stage.querySelector(`.dialogue-theater-stage__render--${side}`);
    if (!(img instanceof HTMLImageElement)) return;

    if (!src) {
        img.hidden = true;
        img.removeAttribute('src');
        img.classList.remove('dialogue-theater-stage__render--speaking');
        return;
    }

    img.hidden = false;
    if (img.getAttribute('src') !== src) {
        img.src = src;
    }
    img.style.opacity = '1';
    img.classList.add('fade-in');
    img.classList.toggle('dialogue-theater-stage__render--speaking', speaking);
}

/**
 * @param {HTMLElement} stage
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {number|null} activeLineIndex
 */
function paintStage(stage, conversation, activeLineIndex = null) {
    const rendersMap = stageAssets?.renders || {};
    const lines = resolveActiveConversationLines(conversation);
    const sceneEl = stage.querySelector('.dialogue-theater-stage__scene');
    const scene = String(conversation?.scene || '').trim();

    if (sceneEl instanceof HTMLImageElement) {
        if (scene) {
            sceneEl.hidden = false;
            sceneEl.src = sceneImageUrl(scene);
            sceneEl.alt = conversation.name || 'Scene';
            sceneEl.style.opacity = '1';
            sceneEl.classList.add('fade-in');
        } else {
            sceneEl.hidden = true;
            sceneEl.removeAttribute('src');
        }
    }

    const leftImg = stage.querySelector('.dialogue-theater-stage__render--left');
    const rightImg = stage.querySelector('.dialogue-theater-stage__render--right');
    if (leftImg instanceof HTMLImageElement) {
        leftImg.classList.remove('dialogue-theater-stage__render--speaking');
    }
    if (rightImg instanceof HTMLImageElement) {
        rightImg.classList.remove('dialogue-theater-stage__render--speaking');
    }

    if (activeLineIndex == null) {
        const soloSpeaker = usesSoloSpeakerPreview(conversation);
        const sideMap = buildSpeakerSideMap(lines);
        const speakers = [...sideMap.keys()];
        const leftLine = soloSpeaker
            ? getSoloPreviewLine(conversation)
            : speakers[0] != null
              ? lines.find((line) => String(line?.hero || '').trim() === speakers[0]) || lines[0]
              : lines[0] || null;
        const rightLine =
            !soloSpeaker && speakers[1] != null
                ? lines.find((line) => String(line?.hero || '').trim() === speakers[1]) || lines[1]
                : null;
        setStageRender(stage, 'left', leftLine ? getLineRenderSrc(leftLine, rendersMap) : '', false);
        setStageRender(stage, 'right', rightLine ? getLineRenderSrc(rightLine, rendersMap) : '', false);
        setStageDialogue(stage, null);
        return;
    }

    const line = lines[activeLineIndex];
    if (!line) return;

    const side = sideForLineIndex(activeLineIndex, lines);
    setStageRender(stage, side, getLineRenderSrc(line, rendersMap), true);
    setStageDialogue(stage, line);
}

async function ensureStageAssets() {
    stageAssets = await loadDialogueTheaterAssets();
}

function openDialogueTheaterStageOverlay() {
    const overlay = document.getElementById('eventImageOverlay');
    const eventSlide = document.getElementById('eventSlide');
    if (!overlay) return false;

    overlay.style.display = 'flex';
    overlay.style.opacity = '1';
    overlay.classList.add('open', 'dialogue-theater-stage-overlay');
    if (eventSlide?.classList.contains('open')) {
        overlay.classList.add('slide-open');
    }
    return true;
}

/** Keep overlay + stage DOM visible without repainting the current frame. */
export async function ensureDialogueTheaterStageOverlayVisible() {
    await ensureStageAssets();
    const stage = ensureStageDom();
    if (!stage) return false;
    return openDialogueTheaterStageOverlay();
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
export async function showDialogueTheaterStage(conversation) {
    await ensureStageAssets();
    const stage = ensureStageDom();
    if (!stage || !openDialogueTheaterStageOverlay()) return;

    paintStage(stage, conversation, null);
}

export function hideDialogueTheaterStage() {
    const overlay = document.getElementById('eventImageOverlay');
    overlay?.classList.remove('open', 'slide-open', 'dialogue-theater-stage-overlay');
    if (overlay) {
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
    }

    document.getElementById('dialogueTheaterStage')?.remove();

    const defaultImg = document.getElementById('eventImage');
    if (defaultImg) {
        defaultImg.style.display = 'none';
        defaultImg.removeAttribute('src');
    }
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
export function resetDialogueTheaterStageToIdle(conversation) {
    const stage = document.getElementById('dialogueTheaterStage');
    if (!stage) return;
    paintStage(stage, conversation, null);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {number} lineIndex
 */
export function updateDialogueTheaterStageActiveLine(conversation, lineIndex) {
    const stage = document.getElementById('dialogueTheaterStage');
    if (!stage) return;
    paintStage(stage, conversation, lineIndex);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
export async function refreshDialogueTheaterStage(conversation) {
    const stage = document.getElementById('dialogueTheaterStage');
    if (!stage) return;
    await ensureStageAssets();
    paintStage(stage, conversation, null);
}
