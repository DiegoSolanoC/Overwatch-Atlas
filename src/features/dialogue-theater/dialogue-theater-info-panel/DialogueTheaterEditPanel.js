/**
 * Dialogue Theater info panel — view + edit UI inside #eventSlideScrollable.
 */

import { playCharacterAudio } from '../../universal-features/atlas-character-audio/CharacterVolumeService.js';
import {
    refreshDialogueTheaterStage,
    resetDialogueTheaterStageToIdle,
    updateDialogueTheaterStageActiveLine,
    PANEL_DIALOGUE_BOX_HTML,
} from '../dialogue-theater-stage/dialogueTheaterStageOverlay.js';
import {
    DIALOGUE_THEATER_ERA_CLASSIC,
    DIALOGUE_THEATER_ERA_OVERWATCH,
    DIALOGUE_THEATER_MAP_SPECIFIC_TAG,
    DIALOGUE_THEATER_SKIN_SPECIFIC_TAG,
    DIALOGUE_THEATER_EVENT_SPECIFIC_TAG,
    DIALOGUE_THEATER_STACKABLE_TAGS,
    getConversationEraTag,
    getConversationMapChoices,
    getConversationSkinChoices,
    getConversationEventChoices,
    getConversationTags,
    labelForDialogueTheaterStatus,
    normalizeDialogueTheaterChoiceList,
    normalizeDialogueTheaterStatus,
    normalizeDialogueLineEra,
    normalizeDialogueLineStatus,
    getDialogueLineEra,
    getDialogueLineStatus,
} from '../dialogue-theater-list/dialogueTheaterEraFilter.js';
import {
    clearDialogueTheaterAssetsCache,
    heroFilterIconUrl,
    listRenderFilesForHero,
    loadDialogueTheaterAssets,
    loadDialogueTheaterHeroes,
    renderImageUrl,
    resolveRenderHeroFolder,
    sceneImageUrl,
    voicelineAudioUrl,
} from '../data/loadDialogueTheaterAssets.js';
import { paintBioChipPortraitBackgrounds } from '../../gallery/gallery-mode/bioChipPortraitBackground.js';
import {
    buildBlankDialogueLine,
    buildBlankDialoguePath,
    normalizeDialogueLine,
} from '../data/dialogueTheaterConversationSchema.js';
import {
    CHATTER_PARTNER_MODE_AND,
    CHATTER_PARTNER_MODE_HYBRID,
    CHATTER_PARTNER_MODE_OR,
    CHATTER_PARTNER_MODE_VAGUE,
    normalizeChatterPartnerList,
    normalizeChatterPartnerMode,
} from '../data/dialogueTheaterChatterPartners.js';
import {
    hasConversationVariationPaths,
    labelForDialogueLineOption,
    resolveActiveConversationLines,
    resolveSelectedPathId,
    summarizeDialogueLine,
    withResolvedConversationLines,
} from '../data/dialogueTheaterPathHelpers.js';
import { formatDialogueSubtitleHtml } from '../data/dialogueSubtitleFormatting.js';
import {
    buildBeforeTheCrisisMasterPlayQueue,
    pickRandomBeforeTheCrisisPathId,
} from './beforeTheCrisisMasterPlay.js';
import { isBeforeTheCrisisConversation } from './beforeTheCrisisPathConfig.js';
import {
    buildFavoriteAnimalMasterPlayQueue,
    getConversationLineById,
} from './favoriteAnimalMasterPlay.js';
import { buildPeriodicTableMasterPlayQueue } from './periodicTableMasterPlay.js';
import {
    highlightPeriodicTablePathSelection,
    renderPeriodicTablePathSwitcherHtml,
    shouldUsePeriodicTablePathPicker,
    wirePeriodicTablePathSelector,
    pickRandomPeriodicTablePathId,
} from './dialogueTheaterPeriodicTablePicker.js';
import { isPeriodicTableConversation } from './periodicTablePathConfig.js';
import {
    highlightGroupedPathSelection,
    isFavoriteAnimalConversation,
    renderGroupedPathSwitcherHtml,
    shouldUseGroupedPathPicker,
    wireGroupedPathSelector,
} from './dialogueTheaterGroupedPathPicker.js';
import { conversationUsesHeroPathLabels } from './dialogueTheaterHeroPathLabels.js';
import {
    pickRandomConversationPathId,
    renderStandardRandomRouteControlsHtml,
    usesStandardRandomRoutePlay,
} from './dialogueTheaterRandomRoutePlay.js';
import {
    highlightTieredPathSelection,
    renderTieredPathSwitcherHtml,
    shouldUseTieredPathPicker,
    wireTieredPathSelector,
} from './dialogueTheaterTieredPathPicker.js';
import { setupSingleValueAutocomplete } from './dialogueTheaterSingleAutocomplete.js';
import { setupVoicelineAutocomplete } from './dialogueTheaterVoicelineAutocomplete.js';
import {
    findVoicelineForHeroAndSubtitles,
    resolveLineVoiceFile,
    resolveLineVoicePlaybackFiles,
    voicelineBelongsToHero,
    voicelineFilenameToSubtitles,
} from '../data/theaterVoicelineParsing.js';

const HOST_ID = 'dialogueTheaterEditHost';
/** @type {string[]} */
let heroOptions = [];

/** @type {import('../data/loadDialogueTheaterAssets.js').DialogueTheaterAssets|null} */
let theaterAssets = null;

let cachedAssetsLoadedOnce = false;

/**
 * @param {HTMLElement} scrollable
 * @returns {HTMLElement}
 */
function ensureHost(scrollable) {
    let host = document.getElementById(HOST_ID);
    if (!host) {
        host = document.createElement('div');
        host.id = HOST_ID;
        host.className = 'dialogue-theater-edit-host';
        scrollable.prepend(host);
    }
    return host;
}

/**
 * @param {HTMLElement} grid
 * @param {{ id: string, label: string, src: string }[]} items
 * @param {string} selectedId
 * @param {(id: string) => void} onSelect
 */
function renderPreviewPicker(grid, items, selectedId, onSelect) {
    grid.innerHTML = '';
    if (items.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'dialogue-theater-edit__picker-empty';
        empty.textContent = 'No assets found in folder yet.';
        grid.appendChild(empty);
        return;
    }
    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dialogue-theater-edit__picker-item';
        if (item.id === selectedId) btn.classList.add('dialogue-theater-edit__picker-item--selected');
        btn.title = item.label;
        btn.innerHTML = `
            <img class="dialogue-theater-edit__picker-img" src="${item.src}" alt="" loading="lazy" decoding="async" />
            <span class="dialogue-theater-edit__picker-label">${item.label}</span>
        `;
        btn.addEventListener('click', () => {
            onSelect(item.id);
            renderPreviewPicker(grid, items, item.id, onSelect);
        });
        grid.appendChild(btn);
    }
}

/** @type {HTMLAudioElement|null} */
let activeViewVoicelineAudio = null;

/** @type {symbol|null} */
let activeViewPlayAllToken = null;

const VIEW_PLAY_ALL_GAP_MS = 500;
const VIEW_AUTO_PLAY_DELAY_MS = 650;
const MASTER_PLAY_PATH_GAP_MS = 700;

/** @type {[string, string][]} */
const PLAYBACK_TRANSPORT_BUTTON_RESETS = [
    ['#dialogueTheaterMasterPlayBtn', '▶ Master play'],
    ['#dialogueTheaterRandomPlayBtn', '▶ Random play'],
    ['#dialogueTheaterPlayAllBtn', '▶ Play all'],
];

function resetPlaybackTransportButtons() {
    const host = document.getElementById(HOST_ID);
    if (!host) return;

    for (const [selector, label] of PLAYBACK_TRANSPORT_BUTTON_RESETS) {
        const btn = host.querySelector(selector);
        if (!(btn instanceof HTMLButtonElement)) continue;
        if (!/Playing/i.test(btn.textContent)) continue;
        btn.textContent = label;
        btn.disabled = false;
    }
}

/**
 * @param {number} ms
 * @param {symbol} token
 */
function waitForPlaybackDelay(ms, token) {
    return new Promise((resolve) => {
        if (activeViewPlayAllToken !== token) {
            resolve();
            return;
        }

        let settled = false;
        /** @type {ReturnType<typeof setTimeout>|undefined} */
        let timeout;
        /** @type {ReturnType<typeof setInterval>|undefined} */
        let poll;

        const finish = () => {
            if (settled) return;
            settled = true;
            if (timeout) clearTimeout(timeout);
            if (poll) clearInterval(poll);
            resolve();
        };

        timeout = setTimeout(finish, ms);
        poll = setInterval(() => {
            if (activeViewPlayAllToken !== token) {
                finish();
            }
        }, 32);
    });
}

/**
 * @param {HTMLAudioElement} audio
 * @param {symbol} token
 */
function waitForPlaybackAudio(audio, token) {
    return new Promise((resolve) => {
        if (activeViewPlayAllToken !== token) {
            resolve();
            return;
        }

        let settled = false;
        /** @type {ReturnType<typeof setInterval>|undefined} */
        let poll;

        const finish = () => {
            if (settled) return;
            settled = true;
            if (poll) clearInterval(poll);
            resolve();
        };

        audio.addEventListener('ended', finish, { once: true });
        audio.addEventListener('error', finish, { once: true });
        poll = setInterval(() => {
            if (activeViewPlayAllToken !== token) {
                finish();
            }
        }, 32);
    });
}

function stopViewVoicelinePlayback(conversation = null) {
    activeViewPlayAllToken = null;
    resetPlaybackTransportButtons();
    if (activeViewVoicelineAudio) {
        activeViewVoicelineAudio.pause();
        activeViewVoicelineAudio.currentTime = 0;
        activeViewVoicelineAudio = null;
    }
    if (conversation) {
        resetDialogueTheaterStageToIdle(conversation);
    }
}

function getPlaybackConversation(conversation) {
    return withResolvedConversationLines(conversation);
}

/**
 * @param {HTMLElement} host
 * @returns {{ id: string, hero: string, subtitles: string, label: string }[]}
 */
function listLineOptionsFromEditHost(host) {
    /** @type {{ id: string, hero: string, subtitles: string, label: string }[]} */
    const options = [];
    host.querySelectorAll('.dialogue-theater-line').forEach((block) => {
        const lineId = block instanceof HTMLElement ? block.dataset.lineId : '';
        if (!lineId) return;
        const hero = block.querySelector('.dialogue-theater-line__hero-input')?.value?.trim() || '';
        const subtitles = block.querySelector('.dialogue-theater-line__subtitles-input')?.value ?? '';
        options.push({
            id: lineId,
            hero,
            subtitles,
            label: labelForDialogueLineOption({ hero, subtitles }),
        });
    });
    return options;
}

/**
 * @param {HTMLElement} pathsHost
 * @param {{ enabled: boolean, paths: import('../data/DialogueTheaterDataService.js').DialoguePath[] }} state
 * @param {{ id: string, label: string }[]} lineOptions
 */
function renderVariationPathsEditor(pathsHost, state, lineOptions) {
    pathsHost.innerHTML = '';

    if (!state.enabled) {
        pathsHost.hidden = true;
        return;
    }

    pathsHost.hidden = false;

    if (state.paths.length === 0) {
        state.paths.push(buildBlankDialoguePath());
    }

    for (let pathIndex = 0; pathIndex < state.paths.length; pathIndex += 1) {
        const path = state.paths[pathIndex];
        const card = document.createElement('article');
        card.className = 'dialogue-theater-path';
        card.dataset.pathId = path.id;

        const lineChecks = lineOptions.length
            ? lineOptions
                  .map((option) => {
                      const checked = path.lineIds.includes(option.id) ? 'checked' : '';
                      const heroLabel = escapeHtml(option.hero || 'Unknown');
                      const textLabel = escapeHtml(
                          summarizeDialogueLine(option.subtitles || option.label, 140),
                      );
                      return `
                        <label class="dialogue-theater-path__line-option">
                            <input type="checkbox" class="dialogue-theater-path__line-checkbox" value="${escapeHtml(option.id)}" ${checked} />
                            <span class="dialogue-theater-path__line-copy">
                                <strong class="dialogue-theater-path__line-hero">${heroLabel}</strong>
                                <span class="dialogue-theater-path__line-text">${textLabel}</span>
                            </span>
                        </label>
                    `;
                  })
                  .join('')
            : '<p class="dialogue-theater-edit__muted">Add dialogue lines above, then pick which ones belong in this path.</p>';

        card.innerHTML = `
            <div class="dialogue-theater-path__head">
                <label class="dialogue-theater-edit__label" for="dialogueTheaterPathLabel-${pathIndex}">Path label</label>
                <div class="dialogue-theater-path__head-row">
                    <input
                        type="text"
                        id="dialogueTheaterPathLabel-${pathIndex}"
                        class="dialogue-theater-path__label-input event-slide-inline-editor__input"
                        value="${escapeHtml(path.label)}"
                        placeholder="Route name…"
                        autocomplete="off"
                    />
                    <button type="button" class="dialogue-theater-path__remove-btn event-slide-inline-editor__small-btn">Remove path</button>
                </div>
            </div>
            <div class="dialogue-theater-path__lines">${lineChecks}</div>
        `;

        card.querySelector('.dialogue-theater-path__remove-btn')?.addEventListener('click', () => {
            state.paths.splice(pathIndex, 1);
            renderVariationPathsEditor(pathsHost, state, listLineOptionsFromEditHost(pathsHost.closest('#dialogueTheaterEditHost') || pathsHost));
        });

        card.querySelector('.dialogue-theater-path__label-input')?.addEventListener('input', (e) => {
            if (e.target instanceof HTMLInputElement) {
                path.label = e.target.value;
            }
        });

        card.querySelectorAll('.dialogue-theater-path__line-checkbox').forEach((input) => {
            input.addEventListener('change', () => {
                /** @type {string[]} */
                const nextIds = [];
                card.querySelectorAll('.dialogue-theater-path__line-checkbox').forEach((box) => {
                    if (box instanceof HTMLInputElement && box.checked) {
                        nextIds.push(box.value);
                    }
                });
                path.lineIds = nextIds;
            });
        });

        pathsHost.appendChild(card);
    }

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'event-slide-inline-editor__small-btn dialogue-theater-path__add-btn';
    addBtn.textContent = '+ Add path';
    addBtn.addEventListener('click', () => {
        const next = buildBlankDialoguePath();
        next.label = `Path ${state.paths.length + 1}`;
        state.paths.push(next);
        renderVariationPathsEditor(
            pathsHost,
            state,
            listLineOptionsFromEditHost(pathsHost.closest('#dialogueTheaterEditHost') || pathsHost),
        );
    });
    pathsHost.appendChild(addBtn);
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
function wireVariationPathsSection(host, conversation) {
    const toggle = host.querySelector('#dialogueTheaterPathsEnabled');
    const pathsHost = host.querySelector('#dialogueTheaterPathsHost');
    const refreshBtn = host.querySelector('#dialogueTheaterPathsRefreshBtn');
    if (!(toggle instanceof HTMLInputElement) || !(pathsHost instanceof HTMLElement)) return;

    /** @type {{ enabled: boolean, pathsDisabledExplicitly: boolean, paths: import('../data/DialogueTheaterDataService.js').DialoguePath[] }} */
    const state = {
        enabled: hasConversationVariationPaths(conversation),
        pathsDisabledExplicitly: false,
        paths: Array.isArray(conversation.paths)
            ? conversation.paths.map((path) => ({
                  id: path.id,
                  label: path.label,
                  lineIds: [...path.lineIds],
              }))
            : [],
    };

    host._dialogueTheaterPathsState = state;
    toggle.checked = state.enabled;

    const syncMultiPathTag = () => {
        const multiPathEl = host.querySelector('#dialogueTheaterEditMultiPathTag');
        if (multiPathEl instanceof HTMLInputElement) {
            multiPathEl.checked = state.enabled;
        }
    };

    const refreshEditor = () => {
        renderVariationPathsEditor(pathsHost, state, listLineOptionsFromEditHost(host));
        syncMultiPathTag();
    };

    toggle.addEventListener('change', () => {
        state.enabled = toggle.checked;
        state.pathsDisabledExplicitly = !toggle.checked;
        if (state.enabled && state.paths.length === 0) {
            state.paths.push(buildBlankDialoguePath());
        }
        refreshEditor();
    });

    refreshBtn?.addEventListener('click', refreshEditor);
    refreshEditor();
}

/**
 * @param {HTMLElement} host
 * @returns {{ paths?: import('../data/DialogueTheaterDataService.js').DialoguePath[], selectedPathId?: string }}
 */
function collectVariationPathsFromHost(host) {
    const state = host._dialogueTheaterPathsState;
    if (!state) return {};

    if (!state.enabled) {
        if (state.pathsDisabledExplicitly) {
            return { paths: [], selectedPathId: '' };
        }
        return {};
    }

    const lineOrder = listLineOptionsFromEditHost(host).map((option) => option.id);
    const lineOrderIndex = new Map(lineOrder.map((id, index) => [id, index]));

    /** @type {import('../data/DialogueTheaterDataService.js').DialoguePath[]} */
    const paths = state.paths
        .map((path) => {
            const label = String(path.label || '').trim() || 'Path';
            const lineIds = [...path.lineIds]
                .filter((lineId) => lineOrderIndex.has(lineId))
                .sort((a, b) => (lineOrderIndex.get(a) ?? 0) - (lineOrderIndex.get(b) ?? 0));
            return { id: path.id, label, lineIds };
        })
        .filter((path) => path.lineIds.length > 0);

    if (paths.length === 0) return {};

    const existingSelected = host.dataset.selectedPathId || '';
    const selectedPathId = paths.some((path) => path.id === existingSelected)
        ? existingSelected
        : paths[0].id;

    return { paths, selectedPathId };
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {number[]}
 */
function listPlayableLineIndices(conversation) {
    const playbackConversation = getPlaybackConversation(conversation);
    const voicelines = theaterAssets?.voicelines || [];
    const indices = [];
    for (let i = 0; i < playbackConversation.lines.length; i += 1) {
        if (resolveLineVoiceFile(playbackConversation.lines[i], voicelines)) indices.push(i);
    }
    return indices;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
export async function playDialogueTheaterViewConversation(conversation) {
    await ensureDialogueTheaterAssetsLoaded();
    await playAllViewVoicelines(conversation);
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
async function playAllViewVoicelines(conversation) {
    stopViewVoicelinePlayback();
    const playbackConversation = getPlaybackConversation(conversation);
    const token = Symbol('playAll');
    activeViewPlayAllToken = token;
    const voicelines = theaterAssets?.voicelines || [];
    const lineIndices = listPlayableLineIndices(conversation);

    for (let i = 0; i < lineIndices.length; i += 1) {
        if (activeViewPlayAllToken !== token) return;

        const lineIndex = lineIndices[i];
        const line = playbackConversation.lines[lineIndex];
        if (!line) continue;

        const ok = await playMasterPlayLine(token, line, playbackConversation, lineIndex, voicelines);
        if (!ok || activeViewPlayAllToken !== token) return;

        if (i < lineIndices.length - 1) {
            await waitForPlaybackDelay(VIEW_PLAY_ALL_GAP_MS, token);
        }
    }

    if (activeViewPlayAllToken === token) {
        activeViewPlayAllToken = null;
        resetDialogueTheaterStageToIdle(playbackConversation);
    }
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string[]}
 */
function listPlayableVoicesForConversation(conversation) {
    const playbackConversation = getPlaybackConversation(conversation);
    const voicelines = theaterAssets?.voicelines || [];
    const voices = [];
    for (let i = 0; i < playbackConversation.lines.length; i += 1) {
        const voice = resolveLineVoiceFile(playbackConversation.lines[i], voicelines);
        if (voice) voices.push(voice);
    }
    return voices;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} pathId
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueLine[]}
 */
function resolveLinesForPath(conversation, pathId) {
    return resolveActiveConversationLines({ ...conversation, selectedPathId: pathId });
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine[]} lines
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} targetLine
 * @returns {number}
 */
function indexOfLineInList(lines, targetLine) {
    const idx = lines.findIndex((line) => line.id === targetLine.id);
    return idx >= 0 ? idx : 0;
}

/**
 * @param {symbol} token
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} stageConversation
 * @param {number} lineIndex
 * @param {string[]} voicelines
 * @returns {Promise<boolean>}
 */
async function playMasterPlayLine(token, line, stageConversation, lineIndex, voicelines) {
    const voices = resolveLineVoicePlaybackFiles(line, voicelines);
    if (voices.length === 0) return true;

    updateDialogueTheaterStageActiveLine(stageConversation, lineIndex);

    for (let i = 0; i < voices.length; i += 1) {
        if (activeViewPlayAllToken !== token) return false;

        const audio = await playCharacterAudio(voicelineAudioUrl(voices[i]));
        if (!audio || activeViewPlayAllToken !== token) return false;

        activeViewVoicelineAudio = audio;
        await waitForPlaybackAudio(audio, token);

        if (activeViewPlayAllToken !== token) return false;
        activeViewVoicelineAudio = null;
    }

    return true;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {HTMLElement} host
 * @param {string} pathId
 * @param {HTMLButtonElement} [btn]
 */
async function playSinglePathPlayback(conversation, host, pathId, btn) {
    await ensureDialogueTheaterAssetsLoaded();
    stopViewVoicelinePlayback();

    const token = Symbol('singlePathPlay');
    activeViewPlayAllToken = token;
    const voicelines = theaterAssets?.voicelines || [];
    const label = btn?.textContent || '▶ Random play';

    if (btn) {
        btn.disabled = true;
        btn.textContent = '▶ Playing route…';
    }

    try {
        if (shouldUseTieredPathPicker(conversation)) {
            highlightTieredPathSelection(host, conversation, pathId);
        } else if (shouldUsePeriodicTablePathPicker(conversation)) {
            highlightPeriodicTablePathSelection(host, conversation, pathId);
        } else if (shouldUseGroupedPathPicker(conversation)) {
            highlightGroupedPathSelection(host, conversation, pathId);
        }

        const lines = resolveLinesForPath(conversation, pathId);
        const pathConversation = withResolvedConversationLines({
            ...conversation,
            selectedPathId: pathId,
        });

        for (let i = 0; i < lines.length; i += 1) {
            if (activeViewPlayAllToken !== token) return;

            const ok = await playMasterPlayLine(token, lines[i], pathConversation, i, voicelines);
            if (!ok) return;

            if (i < lines.length - 1) {
                await waitForPlaybackDelay(VIEW_PLAY_ALL_GAP_MS, token);
            }
        }

        if (activeViewPlayAllToken === token) {
            resetDialogueTheaterStageToIdle(pathConversation);
        }
    } finally {
        if (activeViewPlayAllToken === token) {
            activeViewPlayAllToken = null;
        }
        if (btn) {
            btn.disabled = false;
            btn.textContent = label;
        }
    }
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {HTMLElement} host
 * @param {HTMLButtonElement} btn
 */
async function playAllPathsMasterPlay(conversation, host, btn) {
    await ensureDialogueTheaterAssetsLoaded();
    stopViewVoicelinePlayback();

    const token = Symbol('masterPlay');
    activeViewPlayAllToken = token;
    const voicelines = theaterAssets?.voicelines || [];
    const label = btn.textContent || '▶ Master play';
    const queue = isBeforeTheCrisisConversation(conversation)
        ? buildBeforeTheCrisisMasterPlayQueue(conversation)
        : isPeriodicTableConversation(conversation)
          ? buildPeriodicTableMasterPlayQueue(conversation, host.dataset.selectedPathId || resolveSelectedPathId(conversation))
          : buildFavoriteAnimalMasterPlayQueue(conversation);

    btn.disabled = true;
    btn.textContent = '▶ Playing all routes…';

    try {
        for (let q = 0; q < queue.length; q += 1) {
            if (activeViewPlayAllToken !== token) return;

            const step = queue[q];

            if (step.kind === 'line') {
                const line = getConversationLineById(conversation, step.lineId);
                if (!line) continue;

                if (step.pathId) {
                    if (shouldUseTieredPathPicker(conversation)) {
                        highlightTieredPathSelection(host, conversation, step.pathId);
                    } else if (shouldUsePeriodicTablePathPicker(conversation)) {
                        highlightPeriodicTablePathSelection(host, conversation, step.pathId);
                    } else {
                        highlightGroupedPathSelection(host, conversation, step.pathId);
                    }
                }

                const stageConversation = step.pathId
                    ? withResolvedConversationLines({ ...conversation, selectedPathId: step.pathId })
                    : withResolvedConversationLines({
                        ...conversation,
                        selectedPathId: resolveSelectedPathId(conversation),
                    });
                const lineIndex = indexOfLineInList(stageConversation.lines, line);

                const ok = await playMasterPlayLine(token, line, stageConversation, lineIndex, voicelines);
                if (!ok) return;
            } else {
                if (shouldUseTieredPathPicker(conversation)) {
                    highlightTieredPathSelection(host, conversation, step.pathId);
                } else if (shouldUsePeriodicTablePathPicker(conversation)) {
                    highlightPeriodicTablePathSelection(host, conversation, step.pathId);
                } else {
                    highlightGroupedPathSelection(host, conversation, step.pathId);
                }

                const lines = resolveLinesForPath(conversation, step.pathId);
                const pathConversation = withResolvedConversationLines({
                    ...conversation,
                    selectedPathId: step.pathId,
                });

                for (let i = 0; i < lines.length; i += 1) {
                    if (activeViewPlayAllToken !== token) return;

                    const ok = await playMasterPlayLine(token, lines[i], pathConversation, i, voicelines);
                    if (!ok) return;

                    if (i < lines.length - 1) {
                        await waitForPlaybackDelay(VIEW_PLAY_ALL_GAP_MS, token);
                    }
                }
            }

            if (q < queue.length - 1) {
                await waitForPlaybackDelay(MASTER_PLAY_PATH_GAP_MS, token);
            }
        }

        if (activeViewPlayAllToken === token) {
            resetDialogueTheaterStageToIdle(getPlaybackConversation(conversation));
        }
    } finally {
        if (activeViewPlayAllToken === token) {
            activeViewPlayAllToken = null;
        }
        btn.disabled = false;
        btn.textContent = label;
    }
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {(pathId: string, options?: { autoPlay?: boolean }) => void} [onPathChange]
 */
function wireFavoriteAnimalPlayControls(host, conversation, onPathChange) {
    const isFavoriteOrPeriodic =
        isFavoriteAnimalConversation(conversation) || isPeriodicTableConversation(conversation);
    const isHeroChipRoutes = conversationUsesHeroPathLabels(conversation);

    if (!isFavoriteOrPeriodic && !isHeroChipRoutes) {
        return;
    }

    const paths = conversation.paths || [];
    const voicelines = theaterAssets?.voicelines || [];
    const hasPlayable = paths.some((path) =>
        resolveLinesForPath(conversation, path.id).some((line) =>
            Boolean(resolveLineVoiceFile(line, voicelines)),
        ),
    );

    const masterBtn = host.querySelector('#dialogueTheaterMasterPlayBtn');
    if (masterBtn instanceof HTMLButtonElement) {
        if (!isFavoriteOrPeriodic) {
            masterBtn.remove();
        } else {
            masterBtn.disabled = !hasPlayable;
            masterBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                void playAllPathsMasterPlay(conversation, host, masterBtn);
            });
        }
    }

    const randomBtn = host.querySelector('#dialogueTheaterRandomPlayBtn');
    if (randomBtn instanceof HTMLButtonElement) {
        randomBtn.disabled = !hasPlayable;
        randomBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            const pathId = isPeriodicTableConversation(conversation)
                ? pickRandomPeriodicTablePathId(conversation)
                : pickRandomConversationPathId(conversation);
            if (!pathId) return;

            onPathChange?.(pathId, { autoPlay: true });
        });
    }
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
function wireMasterPlayButton(host, conversation) {
    if (!isBeforeTheCrisisConversation(conversation)) return;

    const btn = host.querySelector('#dialogueTheaterMasterPlayBtn');
    if (!(btn instanceof HTMLButtonElement)) return;

    const paths = conversation.paths || [];
    const voicelines = theaterAssets?.voicelines || [];
    const hasPlayable = paths.some((path) =>
        resolveLinesForPath(conversation, path.id).some((line) =>
            Boolean(resolveLineVoiceFile(line, voicelines)),
        ),
    );
    btn.disabled = !hasPlayable;

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        void playAllPathsMasterPlay(conversation, host, btn);
    });
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {(pathId: string, options?: { autoPlay?: boolean }) => void} [onPathChange]
 */
function wireFavoriteAnimalMasterPlay(host, conversation, onPathChange) {
    wireFavoriteAnimalPlayControls(host, conversation, onPathChange);
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
function wireDialogueTheaterViewPlayback(host, conversation) {
    const playbackConversation = getPlaybackConversation(conversation);
    const lines = playbackConversation.lines || [];
    const voicelines = theaterAssets?.voicelines || [];
    const playableVoices = listPlayableVoicesForConversation(conversation);

    const playAllBtn = host.querySelector('#dialogueTheaterPlayAllBtn');
    if (playAllBtn instanceof HTMLButtonElement) {
        playAllBtn.disabled = playableVoices.length === 0;
        playAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            void playAllViewVoicelines(conversation);
        });
    }

    host.querySelectorAll('.dialogue-theater-edit__view-line').forEach((row, idx) => {
        const btn = row.querySelector('.dialogue-theater-edit__view-line-play');
        if (!(btn instanceof HTMLButtonElement)) return;

        const line = lines[idx];
        const voices = line ? resolveLineVoicePlaybackFiles(line, voicelines) : [];
        if (voices.length === 0) {
            btn.disabled = true;
            return;
        }

        btn.disabled = false;
        btn.removeAttribute('aria-disabled');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            stopViewVoicelinePlayback(playbackConversation);
            const token = Symbol('linePlay');
            activeViewPlayAllToken = token;

            void (async () => {
                const ok = await playMasterPlayLine(token, line, playbackConversation, idx, voicelines);
                if (activeViewPlayAllToken !== token) return;
                activeViewPlayAllToken = null;
                if (ok) resetDialogueTheaterStageToIdle(playbackConversation);
            })();
        });
    });
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {(pathId: string, options?: { autoPlay?: boolean }) => void} [onPathChange]
 */
function wireStandardRandomRouteControls(host, conversation, onPathChange) {
    if (!usesStandardRandomRoutePlay(conversation)) return;

    const playBtn = host.querySelector('#dialogueTheaterRandomPlayBtn');
    if (!(playBtn instanceof HTMLButtonElement)) return;

    const paths = conversation.paths || [];
    const voicelines = theaterAssets?.voicelines || [];
    const hasPlayable = paths.some((path) =>
        resolveLinesForPath(conversation, path.id).some((line) =>
            Boolean(resolveLineVoiceFile(line, voicelines)),
        ),
    );
    playBtn.disabled = !hasPlayable;

    playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const pathId = pickRandomConversationPathId(conversation);
        if (!pathId) return;

        onPathChange?.(pathId, { autoPlay: true });
    });
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {(pathId: string, options?: { autoPlay?: boolean }) => void} [onPathChange]
 */
function wireDialogueTheaterPathSelector(host, conversation, onPathChange) {
    const paths = conversation.paths || [];
    if (paths.length === 0) return;

    host.dataset.selectedPathId = conversation.selectedPathId || paths[0]?.id || '';

    host.querySelectorAll('.dialogue-theater-path-switch__option').forEach((btn) => {
        if (!(btn instanceof HTMLButtonElement)) return;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const pathId = btn.dataset.pathId || '';
            if (!pathId) return;
            host.dataset.selectedPathId = pathId;
            onPathChange?.(pathId, { autoPlay: true });
        });
    });
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string}
 */
function buildDialogueTheaterViewLinesHtml(conversation) {
    const playbackConversation = getPlaybackConversation(conversation);
    if (!playbackConversation.lines.length) {
        return '<p class="dialogue-theater-edit__muted">No dialogue lines yet.</p>';
    }

    const voicelines = theaterAssets?.voicelines || [];
    return playbackConversation.lines
        .map((line) => {
            const resolvedVoice = resolveLineVoiceFile(line, voicelines);
            const dialogueText =
                line.subtitles ||
                (resolvedVoice ? voicelineFilenameToSubtitles(resolvedVoice) : '');
            const hasVoice = Boolean(resolvedVoice);
            const lineEra = getDialogueLineEra(line);
            const lineStatus = getDialogueLineStatus(line);
            const lineMods = [
                lineStatus === 'removed' ? 'dialogue-theater-edit__view-line--removed' : '',
                lineEra === DIALOGUE_THEATER_ERA_CLASSIC
                    ? 'dialogue-theater-edit__view-line--classic'
                    : '',
            ]
                .filter(Boolean)
                .join(' ');
            const iconBlock = line.hero
                ? `<div class="dialogue-theater-edit__view-line-icon-wrap">
                        <img class="dialogue-theater-edit__view-line-icon" src="${heroFilterIconUrl(line.hero)}" alt="" />
                   </div>`
                : `<div class="dialogue-theater-edit__view-line-icon-wrap dialogue-theater-edit__view-line-icon-wrap--empty" aria-hidden="true"></div>`;
            const playBtn = hasVoice
                ? `<button type="button" class="dialogue-theater-edit__view-line-play" aria-label="Play voiceline">▶</button>`
                : `<button type="button" class="dialogue-theater-edit__view-line-play" disabled aria-label="No audio">▶</button>`;
            return `
                <article class="dialogue-theater-edit__view-line ${lineMods}">
                    ${iconBlock}
                    <div class="dialogue-theater-edit__view-line-body">
                        <p class="dialogue-theater-edit__view-line-text">${dialogueText ? formatDialogueSubtitleHtml(dialogueText, { hero: line.hero }) : '<span class="dialogue-theater-edit__muted">No dialogue text</span>'}</p>
                        ${line.disclaimer
                            ? `<p class="dialogue-theater-edit__view-line-disclaimer">${escapeHtml(line.disclaimer)}</p>`
                            : ''}
                        ${Array.isArray(line.partners) && line.partners.length
                            ? `<p class="dialogue-theater-edit__view-line-partners"><span class="dialogue-theater-edit__view-line-partners-label">${
                                  (() => {
                                      const mode = normalizeChatterPartnerMode(line.partnerMode);
                                      if (mode === CHATTER_PARTNER_MODE_AND) return 'Partners (all)';
                                      if (mode === CHATTER_PARTNER_MODE_VAGUE) return 'Partners (vague count)';
                                      if (mode === CHATTER_PARTNER_MODE_HYBRID) return 'Partners (hybrid)';
                                      return 'Partners (random one)';
                                  })()
                              }:</span> ${escapeHtml(line.partners.join(', '))}</p>`
                            : ''}
                    </div>
                    ${playBtn}
                </article>
            `;
        })
        .join('');
}

/**
 * Update the active route in view mode without remounting the whole panel.
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string} pathId
 */
export function updateDialogueTheaterViewPathSelection(host, conversation, pathId) {
    stopViewVoicelinePlayback(getPlaybackConversation(conversation));

    const paths = conversation.paths || [];
    const selectedPathId = paths.some((path) => path.id === pathId)
        ? pathId
        : resolveSelectedPathId(conversation);
    const updatedConversation = { ...conversation, selectedPathId };
    const playbackConversation = getPlaybackConversation(updatedConversation);

    host.dataset.selectedPathId = selectedPathId;
    host.dataset.pendingHeroKey = '';

    if (shouldUseTieredPathPicker(conversation)) {
        highlightTieredPathSelection(host, conversation, selectedPathId);
    } else if (shouldUsePeriodicTablePathPicker(conversation)) {
        highlightPeriodicTablePathSelection(host, conversation, selectedPathId);
    } else if (shouldUseGroupedPathPicker(conversation)) {
        highlightGroupedPathSelection(host, conversation, selectedPathId);
    } else {
        host.querySelectorAll('.dialogue-theater-path-switch__option').forEach((btn) => {
            if (!(btn instanceof HTMLButtonElement)) return;
            const isActive = btn.dataset.pathId === selectedPathId;
            btn.classList.toggle('dialogue-theater-path-switch__option--active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    }

    const linesHost = host.querySelector('.dialogue-theater-edit__view-lines');
    if (linesHost instanceof HTMLElement) {
        linesHost.innerHTML = buildDialogueTheaterViewLinesHtml(updatedConversation);
    }

    const playAllBtn = host.querySelector('#dialogueTheaterPlayAllBtn');
    if (playAllBtn instanceof HTMLButtonElement) {
        const hasPlayableVoices = playbackConversation.lines.some((line) =>
            Boolean(resolveLineVoiceFile(line, theaterAssets?.voicelines || [])),
        );
        playAllBtn.disabled = !hasPlayableVoices;
    }

    wireDialogueTheaterViewPlayback(host, updatedConversation);
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {{ onPathChange?: (pathId: string) => void }} [options]
 */
export function renderDialogueTheaterViewPanel(host, conversation, options = {}) {
    host.className = 'dialogue-theater-edit-host dialogue-theater-edit-host--view';
    const statusLabel = labelForDialogueTheaterStatus(conversation.status);
    const tags = getConversationTags(conversation);
    const tagsLabel = tags.length ? tags.join(' · ') : '—';
    const mapChoices = getConversationMapChoices(conversation);
    const mapChoicesLabel = mapChoices.length ? mapChoices.join(', ') : '';
    const skinChoices = getConversationSkinChoices(conversation);
    const skinChoicesLabel = skinChoices.length ? skinChoices.join(', ') : '';
    const eventChoices = getConversationEventChoices(conversation);
    const eventChoicesLabel = eventChoices.length ? eventChoices.join(', ') : '';
    const playbackConversation = getPlaybackConversation(conversation);
    const paths = conversation.paths || [];
    const selectedPathId = resolveSelectedPathId(conversation);

    const pathSwitcherHtml =
        paths.length > 0
            ? shouldUseTieredPathPicker(conversation)
                ? renderTieredPathSwitcherHtml(conversation, selectedPathId)
                : shouldUsePeriodicTablePathPicker(conversation)
                  ? renderPeriodicTablePathSwitcherHtml(conversation, selectedPathId)
                  : shouldUseGroupedPathPicker(conversation)
                    ? renderGroupedPathSwitcherHtml(conversation, selectedPathId)
                    : `
                <div class="dialogue-theater-path-switch${usesStandardRandomRoutePlay(conversation) ? ' dialogue-theater-path-switch--standard-random' : ''}">
                    <div class="dialogue-theater-path-switch__head">
                        <span class="dialogue-theater-path-switch__label">Route</span>
                        ${usesStandardRandomRoutePlay(conversation) ? renderStandardRandomRouteControlsHtml() : ''}
                    </div>
                    <div class="dialogue-theater-path-switch__options" role="tablist" aria-label="Conversation route">
                        ${paths
                            .map(
                                (path) => `
                            <button
                                type="button"
                                class="dialogue-theater-path-switch__option${path.id === selectedPathId ? ' dialogue-theater-path-switch__option--active' : ''}"
                                data-path-id="${escapeHtml(path.id)}"
                                role="tab"
                                aria-selected="${path.id === selectedPathId ? 'true' : 'false'}"
                            >${escapeHtml(path.label || 'Path')}</button>
                        `,
                            )
                            .join('')}
                    </div>
                </div>
            `
            : '';

    const linesHtml = buildDialogueTheaterViewLinesHtml(conversation);

    const hasPlayableVoices = playbackConversation.lines.some((line) =>
        Boolean(resolveLineVoiceFile(line, theaterAssets?.voicelines || [])),
    );

    host.innerHTML = `
        <div class="dialogue-theater-edit dialogue-theater-edit--view">
            ${PANEL_DIALOGUE_BOX_HTML}
            <dl class="dialogue-theater-edit__meta dialogue-theater-edit__meta--view">
                <div><dt>Status</dt><dd>${statusLabel}</dd></div>
                <div><dt>Tags</dt><dd>${escapeHtml(tagsLabel)}</dd></div>
                ${
                    mapChoicesLabel
                        ? `<div><dt>Maps</dt><dd>${escapeHtml(mapChoicesLabel)}</dd></div>`
                        : ''
                }
                ${
                    skinChoicesLabel
                        ? `<div><dt>Skins</dt><dd>${escapeHtml(skinChoicesLabel)}</dd></div>`
                        : ''
                }
                ${
                    eventChoicesLabel
                        ? `<div><dt>Events</dt><dd>${escapeHtml(eventChoicesLabel)}</dd></div>`
                        : ''
                }
            </dl>
            ${pathSwitcherHtml}
            <section class="dialogue-theater-edit__section">
                <p class="dialogue-theater-edit__hint">Scene and character renders appear on the map overlay.</p>
                <div class="dialogue-theater-edit__section-head">
                    <h3 class="dialogue-theater-edit__section-title">Dialogue</h3>
                    <button
                        type="button"
                        id="dialogueTheaterPlayAllBtn"
                        class="dialogue-theater-edit__play-all-btn"
                        ${hasPlayableVoices ? '' : 'disabled'}
                        aria-label="Play all dialogue lines in order"
                    >▶ Play all</button>
                </div>
                <div class="dialogue-theater-edit__view-lines">${linesHtml}</div>
            </section>
        </div>
    `;

    if (shouldUseTieredPathPicker(conversation)) {
        wireTieredPathSelector(host, conversation, options.onPathChange);
        wireMasterPlayButton(host, conversation);
    } else if (shouldUsePeriodicTablePathPicker(conversation)) {
        wirePeriodicTablePathSelector(host, conversation, options.onPathChange);
        wireFavoriteAnimalPlayControls(host, conversation, options.onPathChange);
    } else if (shouldUseGroupedPathPicker(conversation)) {
        wireGroupedPathSelector(host, conversation, options.onPathChange);
        wireFavoriteAnimalMasterPlay(host, conversation, options.onPathChange);
    } else {
        wireDialogueTheaterPathSelector(host, conversation, options.onPathChange);
        wireStandardRandomRouteControls(host, conversation, options.onPathChange);
    }
    wireDialogueTheaterViewPlayback(host, conversation);
    void paintBioChipPortraitBackgrounds(host);
}

/**
 * Auto-start sequential playback when a conversation is opened in view mode.
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {{ delayMs?: number, masterPlay?: boolean, randomRoutePlay?: boolean, periodicTablePlay?: boolean }} [options]
 */
export async function autoStartDialogueTheaterViewPlayAll(conversation, options = {}) {
    await ensureDialogueTheaterAssetsLoaded();
    const delayMs = options.delayMs ?? VIEW_AUTO_PLAY_DELAY_MS;

    await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
    });

    if (!document.getElementById(HOST_ID)) return;

    if (options.masterPlay && (isFavoriteAnimalConversation(conversation) || isBeforeTheCrisisConversation(conversation))) {
        const host = document.getElementById(HOST_ID);
        const btn = host?.querySelector('#dialogueTheaterMasterPlayBtn');
        if (host instanceof HTMLElement && btn instanceof HTMLButtonElement) {
            if (isBeforeTheCrisisConversation(conversation)) {
                const pathId = pickRandomBeforeTheCrisisPathId(conversation);
                if (pathId) {
                    updateDialogueTheaterViewPathSelection(host, conversation, pathId);
                }
            }
            void playAllPathsMasterPlay(conversation, host, btn);
        }
        return;
    }

    if (options.periodicTablePlay && isPeriodicTableConversation(conversation)) {
        const host = document.getElementById(HOST_ID);
        const pathId = resolveSelectedPathId(conversation);
        if (host instanceof HTMLElement && pathId) {
            updateDialogueTheaterViewPathSelection(host, conversation, pathId);
            void playDialogueTheaterViewConversation(conversation);
        }
        return;
    }

    if (options.randomRoutePlay && usesStandardRandomRoutePlay(conversation)) {
        const playableVoices = listPlayableVoicesForConversation(conversation);
        if (playableVoices.length === 0) return;

        void playDialogueTheaterViewConversation(conversation);
        return;
    }

    const playableVoices = listPlayableVoicesForConversation(conversation);
    if (playableVoices.length === 0) return;

    void playDialogueTheaterViewConversation(conversation);
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} baseConversation
 * @returns {import('../data/DialogueTheaterDataService.js').DialogueConversation}
 */
export function buildDialogueTheaterEditStagePreview(host, baseConversation) {
    const patch = collectDialogueTheaterEditPanel(host);
    return {
        ...baseConversation,
        ...patch,
        paths: undefined,
        selectedPathId: '',
    };
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} baseConversation
 */
export async function refreshDialogueTheaterEditStageFromHost(host, baseConversation) {
    const preview = buildDialogueTheaterEditStagePreview(host, baseConversation);
    const lines = Array.isArray(preview.lines) ? preview.lines : [];
    const partnerLineIndex = lines.findIndex(
        (line) => Array.isArray(line.partners) && line.partners.length > 0,
    );
    if (partnerLineIndex >= 0) {
        await ensureDialogueTheaterAssetsLoaded();
        // Ensure overlay exists then paint the partner line so AND/OR preview is visible while editing.
        await refreshDialogueTheaterStage(preview);
        updateDialogueTheaterStageActiveLine(preview, partnerLineIndex);
        return;
    }
    await refreshDialogueTheaterStage(preview);
}

/**
 * @param {HTMLElement} blockEl
 * @param {() => void} [onEditChange]
 */
function refreshPartnerStackList(blockEl, onEditChange) {
    const stackWrap = blockEl.querySelector('.dialogue-theater-line__partners-stack');
    const listEl = blockEl.querySelector('.dialogue-theater-line__partners-stack-list');
    const modeInput = blockEl.querySelector(
        '.dialogue-theater-line__partner-mode:checked',
    );
    const partnersInput = blockEl.querySelector('.dialogue-theater-line__partners-input');
    if (!(listEl instanceof HTMLOListElement) || !(stackWrap instanceof HTMLElement)) return;

    const mode = normalizeChatterPartnerMode(
        modeInput instanceof HTMLInputElement ? modeInput.value : 'or',
    );
    const partners = normalizeChatterPartnerList(
        partnersInput instanceof HTMLTextAreaElement ? partnersInput.value : '',
    );
    stackWrap.hidden = mode !== CHATTER_PARTNER_MODE_AND || partners.length === 0;

    let order = String(blockEl.dataset.partnerStackOrder || '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean);
    const partnerSet = new Set(partners.map((h) => h.toLowerCase()));
    order = order.filter((h) => partnerSet.has(h.toLowerCase()));
    for (const hero of partners) {
        if (!order.some((h) => h.toLowerCase() === hero.toLowerCase())) order.push(hero);
    }
    blockEl.dataset.partnerStackOrder = order.join('|');

    let focus = String(blockEl.dataset.partnerFocus || '').trim();
    if (!order.some((h) => h.toLowerCase() === focus.toLowerCase())) {
        focus = order[order.length - 1] || order[0] || '';
        blockEl.dataset.partnerFocus = focus;
    }

    listEl.innerHTML = '';
    order.forEach((hero, index) => {
        const li = document.createElement('li');
        li.className = 'dialogue-theater-line__partners-stack-item';
        li.dataset.hero = hero;
        li.innerHTML = `
            <span class="dialogue-theater-line__partners-stack-name">${escapeHtml(hero)}</span>
            <div class="dialogue-theater-line__partners-stack-actions">
                <button type="button" class="event-slide-inline-editor__small-btn" data-partner-action="up" ${index === 0 ? 'disabled' : ''} title="Move back">↑</button>
                <button type="button" class="event-slide-inline-editor__small-btn" data-partner-action="down" ${index === order.length - 1 ? 'disabled' : ''} title="Move forward / toward top">↓</button>
                <label class="dialogue-theater-line__partners-focus">
                    <input type="radio" name="partner-focus-${escapeHtml(blockEl.dataset.lineId || '')}" data-partner-action="focus" value="${escapeHtml(hero)}" ${
                        hero.toLowerCase() === focus.toLowerCase() ? 'checked' : ''
                    } />
                    Focus
                </label>
            </div>
        `;
        listEl.appendChild(li);
    });

    listEl.querySelectorAll('[data-partner-action]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const action = btn.getAttribute('data-partner-action');
            const item = btn.closest('.dialogue-theater-line__partners-stack-item');
            const hero = item instanceof HTMLElement ? item.dataset.hero || '' : '';
            if (!hero) return;
            let next = String(blockEl.dataset.partnerStackOrder || '')
                .split('|')
                .map((s) => s.trim())
                .filter(Boolean);
            const idx = next.findIndex((h) => h.toLowerCase() === hero.toLowerCase());
            if (action === 'up' && idx > 0) {
                [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
            } else if (action === 'down' && idx >= 0 && idx < next.length - 1) {
                [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
            } else if (action === 'focus') {
                blockEl.dataset.partnerFocus = hero;
            }
            if (action === 'up' || action === 'down') {
                blockEl.dataset.partnerStackOrder = next.join('|');
            }
            refreshPartnerStackList(blockEl, onEditChange);
            onEditChange?.();
        });
        if (btn instanceof HTMLInputElement && btn.type === 'radio') {
            btn.addEventListener('change', () => {
                if (!btn.checked) return;
                blockEl.dataset.partnerFocus = btn.value;
                onEditChange?.();
            });
        }
    });
}

/**
 * @param {HTMLElement} blockEl
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 * @param {(() => void)|undefined} onEditChange
 */
function wireDialogueLineBlock(blockEl, line, onEditChange) {
    const heroInput = blockEl.querySelector('.dialogue-theater-line__hero-input');
    const heroIcon = blockEl.querySelector('.dialogue-theater-line__hero-icon');
    const voiceInput = blockEl.querySelector('.dialogue-theater-line__voice-input');
    const subtitlesInput = blockEl.querySelector('.dialogue-theater-line__subtitles-input');
    const renderGrid = blockEl.querySelector('.dialogue-theater-line__render-grid');
    const removeBtn = blockEl.querySelector('.dialogue-theater-line__remove-btn');
    const disclaimerInput = blockEl.querySelector('.dialogue-theater-line__disclaimer-input');
    const partnersRow = blockEl.querySelector('.dialogue-theater-line__row--partners');
    const partnersInput = blockEl.querySelector('.dialogue-theater-line__partners-input');

    function syncPartnersRowVisibility() {
        if (!(partnersRow instanceof HTMLElement)) return;
        const hasDisclaimer =
            disclaimerInput instanceof HTMLTextAreaElement && disclaimerInput.value.trim();
        const hasPartners =
            partnersInput instanceof HTMLTextAreaElement && partnersInput.value.trim();
        partnersRow.hidden = !(hasDisclaimer || hasPartners);
    }

    function syncHeroAndRenders() {
        if (!(heroInput instanceof HTMLInputElement)) return;
        updateHeroIcon(heroIcon, heroInput.value);
        line.render = '';
        blockEl.dataset.selectedRender = '';
        refreshRenderPicker(renderGrid, heroInput.value, '', (next) => {
            line.render = next;
            blockEl.dataset.selectedRender = next;
            onEditChange?.();
        });
        onEditChange?.();
        if (voiceInput instanceof HTMLInputElement && voiceInput.value.trim()) {
            const hero = heroInput.value.trim();
            if (!hero || !voicelineBelongsToHero(blockEl.dataset.voiceFile || voiceInput.value, hero)) {
                voiceInput.value = '';
                blockEl.dataset.voiceFile = '';
                line.voice = '';
            }
        }
    }

    if (heroInput instanceof HTMLInputElement) {
        setupSingleValueAutocomplete(heroInput, heroOptions, 'heroes', { placement: 'overlay' });
        heroInput.addEventListener('input', syncHeroAndRenders);
        heroInput.addEventListener('change', syncHeroAndRenders);
        updateHeroIcon(heroIcon, heroInput.value);
    }

    if (voiceInput instanceof HTMLInputElement) {
        setupVoicelineAutocomplete(voiceInput, {
            getHero: () => (heroInput instanceof HTMLInputElement ? heroInput.value : ''),
            getVoicelines: () => theaterAssets?.voicelines || [],
            onPick: (filename, subtitles) => {
                blockEl.dataset.voiceFile = filename;
                line.voice = filename;
                voiceInput.value = subtitles;
                if (subtitlesInput instanceof HTMLTextAreaElement) {
                    subtitlesInput.value = subtitles;
                    line.subtitles = subtitles;
                }
            },
        });
        voiceInput.addEventListener('focus', () => {
            void ensureDialogueTheaterAssetsLoaded({ force: true });
        });
        voiceInput.addEventListener('input', (e) => {
            if (!(e instanceof InputEvent) || !e.isTrusted) return;
            if (blockEl.dataset.voiceFile) {
                blockEl.dataset.voiceFile = '';
                line.voice = '';
            }
        });
    }

    refreshRenderPicker(renderGrid, heroInput?.value || '', line.render, (next) => {
        line.render = next;
        blockEl.dataset.selectedRender = next;
        onEditChange?.();
    });

    subtitlesInput?.addEventListener('input', () => {
        onEditChange?.();
    });

    disclaimerInput?.addEventListener('input', () => {
        syncPartnersRowVisibility();
        onEditChange?.();
    });

    partnersInput?.addEventListener('input', () => {
        syncPartnersRowVisibility();
        refreshPartnerStackList(blockEl, onEditChange);
        onEditChange?.();
    });

    blockEl.querySelectorAll('.dialogue-theater-line__partner-mode').forEach((input) => {
        input.addEventListener('change', () => {
            refreshPartnerStackList(blockEl, onEditChange);
            onEditChange?.();
        });
    });

    syncPartnersRowVisibility();
    refreshPartnerStackList(blockEl, onEditChange);

    removeBtn?.addEventListener('click', () => {
        blockEl.remove();
        onEditChange?.();
    });
}

/**
 * @param {HTMLElement|null} iconEl
 * @param {string} heroName
 */
function updateHeroIcon(iconEl, heroName) {
    if (!(iconEl instanceof HTMLImageElement)) return;
    const trimmed = String(heroName || '').trim();
    if (!trimmed) {
        iconEl.removeAttribute('src');
        iconEl.classList.add('dialogue-theater-line__hero-icon--empty');
        return;
    }
    iconEl.src = heroFilterIconUrl(trimmed);
    iconEl.alt = trimmed;
    iconEl.classList.remove('dialogue-theater-line__hero-icon--empty');
}

/**
 * @param {HTMLElement|null} grid
 * @param {string} heroName
 * @param {string} selectedRender
 * @param {(filename: string) => void} onSelect
 */
function refreshRenderPicker(grid, heroName, selectedRender, onSelect) {
    if (!grid) return;
    const trimmedHero = String(heroName || '').trim();
    const rendersMap = theaterAssets?.renders || {};
    const folder = resolveRenderHeroFolder(trimmedHero, rendersMap);
    const files = listRenderFilesForHero(trimmedHero, rendersMap);
    const items = files.map((file) => ({
        id: file,
        label: file.replace(/\.[^.]+$/, ''),
        src: renderImageUrl(folder, file),
    }));
    if (items.length === 0) {
        grid.innerHTML = '';
        const empty = document.createElement('p');
        empty.className = 'dialogue-theater-edit__picker-empty';
        empty.textContent = trimmedHero
            ? `No renders found for ${trimmedHero} yet.`
            : 'Pick a hero to see render previews.';
        return;
    }
    renderPreviewPicker(grid, items, selectedRender, onSelect);
}

function applyDialogueLineMetaClasses(blockEl, line) {
    if (!(blockEl instanceof HTMLElement)) return;
    const era = getDialogueLineEra(line);
    const status = getDialogueLineStatus(line);
    blockEl.classList.toggle('dialogue-theater-line--removed', status === 'removed');
    blockEl.classList.toggle(
        'dialogue-theater-line--classic',
        era === DIALOGUE_THEATER_ERA_CLASSIC,
    );
    blockEl.dataset.lineEra = era;
    blockEl.dataset.lineStatus = status;
}

/**
 * @param {HTMLElement} linesHost
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 * @param {(() => void)|undefined} onEditChange
 */
function appendDialogueLineBlock(linesHost, line, onEditChange) {
    const block = document.createElement('article');
    block.className = 'dialogue-theater-line';
    block.dataset.lineId = line.id;
    if (line.voicePrefix) block.dataset.voicePrefix = line.voicePrefix;
    if (line.render) block.dataset.selectedRender = line.render;
    applyDialogueLineMetaClasses(block, line);
    const lineEra = getDialogueLineEra(line);
    const lineStatus = getDialogueLineStatus(line);
    block.innerHTML = `
        <div class="dialogue-theater-line__row dialogue-theater-line__row--meta">
            <label class="dialogue-theater-edit__label">Line</label>
            <div class="dialogue-theater-line__meta">
                <label class="dialogue-theater-line__meta-field">
                    <span>Era</span>
                    <select class="dialogue-theater-line__era-select event-slide-inline-editor__input">
                        <option value="${DIALOGUE_THEATER_ERA_OVERWATCH}" ${
                            lineEra === DIALOGUE_THEATER_ERA_OVERWATCH ? 'selected' : ''
                        }>Overwatch</option>
                        <option value="${DIALOGUE_THEATER_ERA_CLASSIC}" ${
                            lineEra === DIALOGUE_THEATER_ERA_CLASSIC ? 'selected' : ''
                        }>Classic</option>
                    </select>
                </label>
                <label class="dialogue-theater-line__meta-field">
                    <span>Status</span>
                    <select class="dialogue-theater-line__status-select event-slide-inline-editor__input">
                        <option value="active" ${lineStatus === 'active' ? 'selected' : ''}>Active</option>
                        <option value="removed" ${lineStatus === 'removed' ? 'selected' : ''}>Removed</option>
                    </select>
                </label>
                <label class="dialogue-theater-line__meta-field dialogue-theater-line__meta-field--mirror">
                    <span>Mirror</span>
                    <input type="checkbox" class="dialogue-theater-line__mirror-check" ${
                        line.mirror === true ? 'checked' : ''
                    } title="Same hero, separate stage instance (left/right)" />
                </label>
            </div>
        </div>
        <div class="dialogue-theater-line__row dialogue-theater-line__row--hero">
            <label class="dialogue-theater-edit__label">Hero</label>
            <div class="dialogue-theater-line__hero-field">
                <img class="dialogue-theater-line__hero-icon dialogue-theater-line__hero-icon--empty" alt="" />
                <div class="dialogue-theater-line__hero-input-wrap">
                    <input type="text" class="dialogue-theater-line__hero-input event-slide-inline-editor__input" placeholder="Pick a hero…" autocomplete="off" />
                </div>
            </div>
        </div>
        <div class="dialogue-theater-line__row">
            <label class="dialogue-theater-edit__label">Voice</label>
            <div class="dialogue-theater-line__voice-field">
                <input type="text" class="dialogue-theater-line__voice-input event-slide-inline-editor__input" placeholder="Type dialogue — spaces match _ in filenames…" autocomplete="off" />
            </div>
        </div>
        <div class="dialogue-theater-line__row">
            <label class="dialogue-theater-edit__label">Subtitles</label>
            <textarea class="dialogue-theater-line__subtitles-input event-slide-inline-editor__textarea" rows="3" placeholder="Dialogue text…"></textarea>
        </div>
        <div class="dialogue-theater-line__row dialogue-theater-line__row--disclaimer">
            <label class="dialogue-theater-edit__label">Disclaimer</label>
            <textarea class="dialogue-theater-line__disclaimer-input event-slide-inline-editor__textarea" rows="2" placeholder="Wiki condition / note (optional)…"></textarea>
        </div>
        <div class="dialogue-theater-line__row dialogue-theater-line__row--partners" ${
            line.disclaimer || (Array.isArray(line.partners) && line.partners.length) ? '' : 'hidden'
        }>
            <label class="dialogue-theater-edit__label">Partners</label>
            <div class="dialogue-theater-line__partners">
                <div class="dialogue-theater-line__partners-mode" role="group" aria-label="Partner mode">
                    <label class="dialogue-theater-line__partners-mode-option">
                        <input type="radio" name="partner-mode-${escapeHtml(line.id)}" class="dialogue-theater-line__partner-mode" value="or" ${
                            !line.partnerMode || line.partnerMode === 'or' ? 'checked' : ''
                        } />
                        <span>OR — random one</span>
                    </label>
                    <label class="dialogue-theater-line__partners-mode-option">
                        <input type="radio" name="partner-mode-${escapeHtml(line.id)}" class="dialogue-theater-line__partner-mode" value="and" ${
                            line.partnerMode === 'and' ? 'checked' : ''
                        } />
                        <span>AND — show all stacked</span>
                    </label>
                    <label class="dialogue-theater-line__partners-mode-option">
                        <input type="radio" name="partner-mode-${escapeHtml(line.id)}" class="dialogue-theater-line__partner-mode" value="vague" ${
                            line.partnerMode === 'vague' ? 'checked' : ''
                        } />
                        <span>Vague — random who &amp; count (min 2)</span>
                    </label>
                    <label class="dialogue-theater-line__partners-mode-option">
                        <input type="radio" name="partner-mode-${escapeHtml(line.id)}" class="dialogue-theater-line__partner-mode" value="hybrid" ${
                            line.partnerMode === 'hybrid' ? 'checked' : ''
                        } />
                        <span>Hybrid — fixed + OR pools</span>
                    </label>
                </div>
                <textarea
                    class="dialogue-theater-line__partners-input event-slide-inline-editor__textarea"
                    rows="2"
                    placeholder="Other-side heroes, comma-separated (e.g. Hanzo, Widowmaker, Zenyatta)"
                ></textarea>
                <div class="dialogue-theater-line__partners-stack" ${line.partnerMode === 'and' ? '' : 'hidden'}>
                    <p class="dialogue-theater-edit__hint">Stack order (last = on top). Use ↑↓ and “Focus” for the chosen render.</p>
                    <ol class="dialogue-theater-line__partners-stack-list"></ol>
                </div>
            </div>
        </div>
        <div class="dialogue-theater-line__row">
            <label class="dialogue-theater-edit__label">Render</label>
            <div class="dialogue-theater-line__render-grid dialogue-theater-edit__picker-grid"></div>
        </div>
        <button type="button" class="dialogue-theater-line__remove-btn event-slide-inline-editor__small-btn">Remove line</button>
    `;
    const heroInput = block.querySelector('.dialogue-theater-line__hero-input');
    const voiceInput = block.querySelector('.dialogue-theater-line__voice-input');
    const subtitlesInput = block.querySelector('.dialogue-theater-line__subtitles-input');
    const disclaimerInput = block.querySelector('.dialogue-theater-line__disclaimer-input');
    const partnersInput = block.querySelector('.dialogue-theater-line__partners-input');
    const eraSelect = block.querySelector('.dialogue-theater-line__era-select');
    const statusSelect = block.querySelector('.dialogue-theater-line__status-select');
    if (heroInput instanceof HTMLInputElement) heroInput.value = line.hero || '';
    if (voiceInput instanceof HTMLInputElement) {
        if (line.voice) {
            block.dataset.voiceFile = line.voice;
            voiceInput.value = line.subtitles || voicelineFilenameToSubtitles(line.voice);
        } else {
            voiceInput.value = '';
        }
    }
    if (subtitlesInput instanceof HTMLTextAreaElement) {
        subtitlesInput.value =
            line.subtitles || (line.voice ? voicelineFilenameToSubtitles(line.voice) : '');
    }
    if (disclaimerInput instanceof HTMLTextAreaElement) {
        disclaimerInput.value = line.disclaimer || '';
    }
    if (partnersInput instanceof HTMLTextAreaElement) {
        partnersInput.value = Array.isArray(line.partners) ? line.partners.join(', ') : '';
    }
    if (line.partnerFocus) block.dataset.partnerFocus = line.partnerFocus;
    if (Array.isArray(line.partnerStackOrder) && line.partnerStackOrder.length) {
        block.dataset.partnerStackOrder = line.partnerStackOrder.join('|');
    }
    if (Array.isArray(line.partnerFixed) && line.partnerFixed.length) {
        block.dataset.partnerFixed = line.partnerFixed.join('|');
    }
    if (Array.isArray(line.partnerOrPools) && line.partnerOrPools.length) {
        block.dataset.partnerOrPools = line.partnerOrPools
            .map((pool) => (Array.isArray(pool) ? pool.join('|') : ''))
            .filter(Boolean)
            .join(';');
    }

    const syncMetaClasses = () => {
        applyDialogueLineMetaClasses(block, {
            era:
                eraSelect instanceof HTMLSelectElement
                    ? eraSelect.value
                    : DIALOGUE_THEATER_ERA_OVERWATCH,
            status:
                statusSelect instanceof HTMLSelectElement ? statusSelect.value : 'active',
        });
        onEditChange?.();
    };
    if (eraSelect instanceof HTMLSelectElement) {
        eraSelect.addEventListener('change', syncMetaClasses);
    }
    if (statusSelect instanceof HTMLSelectElement) {
        statusSelect.addEventListener('change', syncMetaClasses);
    }
    const mirrorCheck = block.querySelector('.dialogue-theater-line__mirror-check');
    if (mirrorCheck instanceof HTMLInputElement) {
        mirrorCheck.addEventListener('change', () => onEditChange?.());
    }
    if (line.partnerCountMin != null) block.dataset.partnerCountMin = String(line.partnerCountMin);
    if (line.partnerCountMax != null) block.dataset.partnerCountMax = String(line.partnerCountMax);
    linesHost.appendChild(block);
    wireDialogueLineBlock(block, line, onEditChange);
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
export function renderDialogueTheaterEditPanel(host, conversation) {
    const refreshStagePreview = () => {
        if (isDialogueTheaterViewPlaybackActive()) return;
        void refreshDialogueTheaterEditStageFromHost(host, conversation);
    };

    host.className = 'dialogue-theater-edit-host dialogue-theater-edit-host--edit';
    host.innerHTML = `
        <div class="dialogue-theater-edit dialogue-theater-edit--edit">
            <div class="dialogue-theater-edit__row">
                <label class="dialogue-theater-edit__label" for="dialogueTheaterEditStatus">Status</label>
                <select id="dialogueTheaterEditStatus" class="dialogue-theater-edit__select">
                    <option value="active">Active</option>
                    <option value="removed">Removed</option>
                </select>
            </div>
            <div class="dialogue-theater-edit__row">
                <span class="dialogue-theater-edit__label" id="dialogueTheaterEditEraLabel">Era</span>
                <div
                    class="dialogue-theater-edit__tags dialogue-theater-edit__tags--era"
                    role="radiogroup"
                    aria-labelledby="dialogueTheaterEditEraLabel"
                >
                    <label class="dialogue-theater-edit__tag-option">
                        <input type="radio" name="dialogueTheaterEditEra" value="${DIALOGUE_THEATER_ERA_OVERWATCH}" class="dialogue-theater-edit__era-radio" />
                        <span>${DIALOGUE_THEATER_ERA_OVERWATCH}</span>
                    </label>
                    <label class="dialogue-theater-edit__tag-option">
                        <input type="radio" name="dialogueTheaterEditEra" value="${DIALOGUE_THEATER_ERA_CLASSIC}" class="dialogue-theater-edit__era-radio" />
                        <span>${DIALOGUE_THEATER_ERA_CLASSIC}</span>
                    </label>
                </div>
                <p class="dialogue-theater-edit__hint">Pick one era. Classic is OW1-era voice; Overwatch is the default.</p>
            </div>
            <div class="dialogue-theater-edit__row">
                <span class="dialogue-theater-edit__label" id="dialogueTheaterEditTagsLabel">Tags</span>
                <div
                    class="dialogue-theater-edit__tags"
                    role="group"
                    aria-labelledby="dialogueTheaterEditTagsLabel"
                >
                    ${DIALOGUE_THEATER_STACKABLE_TAGS.map(
                        (tag) => `
                    <label class="dialogue-theater-edit__tag-option">
                        <input type="checkbox" class="dialogue-theater-edit__tag-check" value="${escapeHtml(tag)}" />
                        <span>${escapeHtml(tag)}</span>
                    </label>`,
                    ).join('')}
                    <label class="dialogue-theater-edit__tag-option dialogue-theater-edit__tag-option--locked">
                        <input type="checkbox" disabled data-theater-tag="Multi Path" id="dialogueTheaterEditMultiPathTag" />
                        <span>Multi Path</span>
                    </label>
                </div>
                <p class="dialogue-theater-edit__hint">Map, Skin, and Event Specific can stack. Multi Path follows variation routes.</p>
            </div>
            <div
                class="dialogue-theater-edit__row dialogue-theater-edit__map-choices-row"
                id="dialogueTheaterEditMapChoicesRow"
                hidden
            >
                <label class="dialogue-theater-edit__label" for="dialogueTheaterEditMapChoices">Map choices</label>
                <input
                    type="text"
                    id="dialogueTheaterEditMapChoices"
                    class="event-slide-inline-editor__input dialogue-theater-edit__map-choices-input"
                    placeholder="e.g. Esperança, Ilios, Samoa"
                    autocomplete="off"
                />
                <p class="dialogue-theater-edit__hint">Maps where this interaction can play. Separate names with commas.</p>
            </div>
            <div
                class="dialogue-theater-edit__row dialogue-theater-edit__skin-choices-row"
                id="dialogueTheaterEditSkinChoicesRow"
                hidden
            >
                <label class="dialogue-theater-edit__label" for="dialogueTheaterEditSkinChoices">Skin choices</label>
                <input
                    type="text"
                    id="dialogueTheaterEditSkinChoices"
                    class="event-slide-inline-editor__input dialogue-theater-edit__skin-choices-input"
                    placeholder="e.g. Galactic Emperor, Space Prince"
                    autocomplete="off"
                />
                <p class="dialogue-theater-edit__hint">Skins required for this interaction. Separate names with commas.</p>
            </div>
            <div
                class="dialogue-theater-edit__row dialogue-theater-edit__event-choices-row"
                id="dialogueTheaterEditEventChoicesRow"
                hidden
            >
                <label class="dialogue-theater-edit__label" for="dialogueTheaterEditEventChoices">Event choices</label>
                <input
                    type="text"
                    id="dialogueTheaterEditEventChoices"
                    class="event-slide-inline-editor__input dialogue-theater-edit__event-choices-input"
                    placeholder="e.g. Junkenstein's Revenge, Archives"
                    autocomplete="off"
                />
                <p class="dialogue-theater-edit__hint">Events where this interaction can play. Separate names with commas.</p>
            </div>
            <section class="dialogue-theater-edit__section">
                <h3 class="dialogue-theater-edit__section-title">Scene</h3>
                <p class="dialogue-theater-edit__hint">Preview picker — stored for later theater playback.</p>
                <div id="dialogueTheaterSceneGrid" class="dialogue-theater-edit__picker-grid dialogue-theater-edit__picker-grid--scene"></div>
            </section>
            <section class="dialogue-theater-edit__section">
                <div class="dialogue-theater-edit__section-head">
                    <h3 class="dialogue-theater-edit__section-title">Dialogue</h3>
                    <button type="button" id="dialogueTheaterAddLineBtn" class="event-slide-inline-editor__small-btn">+ Add dialogue</button>
                </div>
                <div id="dialogueTheaterLinesHost" class="dialogue-theater-edit__lines"></div>
            </section>
            <section class="dialogue-theater-edit__section">
                <div class="dialogue-theater-edit__section-head">
                    <h3 class="dialogue-theater-edit__section-title">Variation paths</h3>
                    <label class="dialogue-theater-paths__enable">
                        <input type="checkbox" id="dialogueTheaterPathsEnabled" />
                        <span>Enable alternate routes</span>
                    </label>
                </div>
                <p class="dialogue-theater-edit__hint">Pick which dialogue lines play for each route. Use this when a conversation has alternate responses.</p>
                <button type="button" id="dialogueTheaterPathsRefreshBtn" class="event-slide-inline-editor__small-btn dialogue-theater-paths__refresh-btn">Refresh line list</button>
                <div id="dialogueTheaterPathsHost" class="dialogue-theater-paths" hidden></div>
            </section>
            <div class="dialogue-theater-edit__row dialogue-theater-edit__row--delete">
                <button type="button" id="dialogueTheaterDeleteEntryBtn" class="event-slide-inline-editor__delete-btn">Delete conversation</button>
            </div>
        </div>
    `;

    const statusEl = host.querySelector('#dialogueTheaterEditStatus');
    if (statusEl instanceof HTMLSelectElement) {
        statusEl.value = normalizeDialogueTheaterStatus(conversation.status);
    }
    const eraTag = getConversationEraTag(conversation) || DIALOGUE_THEATER_ERA_OVERWATCH;
    host.querySelectorAll('.dialogue-theater-edit__era-radio').forEach((input) => {
        if (!(input instanceof HTMLInputElement)) return;
        input.checked = input.value === eraTag;
    });
    const currentTags = new Set(getConversationTags(conversation));
    host.querySelectorAll('.dialogue-theater-edit__tag-check').forEach((input) => {
        if (!(input instanceof HTMLInputElement)) return;
        input.checked = currentTags.has(input.value);
    });
    const multiPathEl = host.querySelector('#dialogueTheaterEditMultiPathTag');
    if (multiPathEl instanceof HTMLInputElement) {
        multiPathEl.checked = currentTags.has('Multi Path');
    }

    const mapChoicesRow = host.querySelector('#dialogueTheaterEditMapChoicesRow');
    const mapChoicesInput = host.querySelector('#dialogueTheaterEditMapChoices');
    const skinChoicesRow = host.querySelector('#dialogueTheaterEditSkinChoicesRow');
    const skinChoicesInput = host.querySelector('#dialogueTheaterEditSkinChoices');
    const eventChoicesRow = host.querySelector('#dialogueTheaterEditEventChoicesRow');
    const eventChoicesInput = host.querySelector('#dialogueTheaterEditEventChoices');
    const syncChoiceRowsVisibility = () => {
        const checks = [...host.querySelectorAll('.dialogue-theater-edit__tag-check')].filter(
            (input) => input instanceof HTMLInputElement,
        );
        const mapOn = checks.some(
            (input) => input.value === DIALOGUE_THEATER_MAP_SPECIFIC_TAG && input.checked,
        );
        const skinOn = checks.some(
            (input) => input.value === DIALOGUE_THEATER_SKIN_SPECIFIC_TAG && input.checked,
        );
        const eventOn = checks.some(
            (input) => input.value === DIALOGUE_THEATER_EVENT_SPECIFIC_TAG && input.checked,
        );
        if (mapChoicesRow instanceof HTMLElement) mapChoicesRow.hidden = !mapOn;
        if (skinChoicesRow instanceof HTMLElement) skinChoicesRow.hidden = !skinOn;
        if (eventChoicesRow instanceof HTMLElement) eventChoicesRow.hidden = !eventOn;
    };
    if (mapChoicesInput instanceof HTMLInputElement) {
        mapChoicesInput.value = getConversationMapChoices(conversation).join(', ');
    }
    if (skinChoicesInput instanceof HTMLInputElement) {
        skinChoicesInput.value = getConversationSkinChoices(conversation).join(', ');
    }
    if (eventChoicesInput instanceof HTMLInputElement) {
        eventChoicesInput.value = getConversationEventChoices(conversation).join(', ');
    }
    host.querySelectorAll('.dialogue-theater-edit__tag-check').forEach((input) => {
        input.addEventListener('change', syncChoiceRowsVisibility);
    });
    syncChoiceRowsVisibility();

    const sceneGrid = host.querySelector('#dialogueTheaterSceneGrid');
    const sceneItems = (theaterAssets?.scenes || []).map((file) => ({
        id: file,
        label: file.replace(/\.[^.]+$/, ''),
        src: sceneImageUrl(file),
    }));
    if (sceneGrid instanceof HTMLElement) {
        const selectScene = (id) => {
            host.dataset.selectedScene = id;
            renderPreviewPicker(sceneGrid, sceneItems, id, selectScene);
            refreshStagePreview();
        };
        selectScene(conversation.scene || '');
    }

    const linesHost = host.querySelector('#dialogueTheaterLinesHost');
    if (linesHost instanceof HTMLElement) {
        const lines = conversation.lines.length ? conversation.lines : [];
        for (let i = 0; i < lines.length; i += 1) {
            appendDialogueLineBlock(linesHost, { ...lines[i] }, refreshStagePreview);
        }
        host.querySelector('#dialogueTheaterAddLineBtn')?.addEventListener('click', () => {
            appendDialogueLineBlock(linesHost, buildBlankDialogueLine(), refreshStagePreview);
            refreshStagePreview();
        });
    }

    host.dataset.selectedPathId = conversation.selectedPathId || conversation.paths?.[0]?.id || '';
    wireVariationPathsSection(host, conversation);
}

/**
 * @param {Element} block
 * @returns {string}
 */
function resolveVoiceFilenameFromBlock(block) {
    const stored = block instanceof HTMLElement ? block.dataset.voiceFile?.trim() : '';
    if (stored) return stored;
    const typed = block.querySelector('.dialogue-theater-line__voice-input')?.value?.trim() || '';
    if (/\.(ogg|mp3|wav|m4a|webm)$/i.test(typed)) return typed;

    const hero = block.querySelector('.dialogue-theater-line__hero-input')?.value?.trim() || '';
    const subtitles = block.querySelector('.dialogue-theater-line__subtitles-input')?.value ?? '';
    return findVoicelineForHeroAndSubtitles(hero, subtitles, theaterAssets?.voicelines || []);
}

/**
 * @param {HTMLElement} host
 * @returns {Partial<import('../data/DialogueTheaterDataService.js').DialogueConversation>}
 */
export function collectDialogueTheaterEditPanel(host) {
    const statusEl = host.querySelector('#dialogueTheaterEditStatus');
    const status = normalizeDialogueTheaterStatus(
        statusEl instanceof HTMLSelectElement ? statusEl.value : 'active',
    );
    const eraRadio = host.querySelector('.dialogue-theater-edit__era-radio:checked');
    const eraTag =
        eraRadio instanceof HTMLInputElement && eraRadio.value === DIALOGUE_THEATER_ERA_CLASSIC
            ? DIALOGUE_THEATER_ERA_CLASSIC
            : DIALOGUE_THEATER_ERA_OVERWATCH;
    /** @type {string[]} */
    const tags = [eraTag];
    host.querySelectorAll('.dialogue-theater-edit__tag-check').forEach((input) => {
        if (input instanceof HTMLInputElement && input.checked && input.value) {
            tags.push(input.value);
        }
    });

    /** @type {string[]} */
    let mapChoices = [];
    if (tags.includes(DIALOGUE_THEATER_MAP_SPECIFIC_TAG)) {
        const mapChoicesEl = host.querySelector('#dialogueTheaterEditMapChoices');
        const raw =
            mapChoicesEl instanceof HTMLInputElement ? mapChoicesEl.value : '';
        mapChoices = normalizeDialogueTheaterChoiceList(raw);
    }
    /** @type {string[]} */
    let skinChoices = [];
    if (tags.includes(DIALOGUE_THEATER_SKIN_SPECIFIC_TAG)) {
        const skinChoicesEl = host.querySelector('#dialogueTheaterEditSkinChoices');
        const raw =
            skinChoicesEl instanceof HTMLInputElement ? skinChoicesEl.value : '';
        skinChoices = normalizeDialogueTheaterChoiceList(raw);
    }
    /** @type {string[]} */
    let eventChoices = [];
    if (tags.includes(DIALOGUE_THEATER_EVENT_SPECIFIC_TAG)) {
        const eventChoicesEl = host.querySelector('#dialogueTheaterEditEventChoices');
        const raw =
            eventChoicesEl instanceof HTMLInputElement ? eventChoicesEl.value : '';
        eventChoices = normalizeDialogueTheaterChoiceList(raw);
    }

    const scene = host.dataset.selectedScene || '';
    /** @type {import('../data/DialogueTheaterDataService.js').DialogueLine[]} */
    const lines = [];
    host.querySelectorAll('.dialogue-theater-line').forEach((block) => {
        const hero = block.querySelector('.dialogue-theater-line__hero-input')?.value?.trim() || '';
        const voice = resolveVoiceFilenameFromBlock(block);
        const subtitles = block.querySelector('.dialogue-theater-line__subtitles-input')?.value ?? '';
        const disclaimer =
            block.querySelector('.dialogue-theater-line__disclaimer-input')?.value ?? '';
        const partnersRaw =
            block.querySelector('.dialogue-theater-line__partners-input')?.value ?? '';
        const modeEl = block.querySelector('.dialogue-theater-line__partner-mode:checked');
        const partnerMode =
            modeEl instanceof HTMLInputElement ? modeEl.value : CHATTER_PARTNER_MODE_OR;
        const partnerFocus = block instanceof HTMLElement ? String(block.dataset.partnerFocus || '') : '';
        const partnerStackOrder =
            block instanceof HTMLElement
                ? String(block.dataset.partnerStackOrder || '')
                      .split('|')
                      .map((s) => s.trim())
                      .filter(Boolean)
                : [];
        const partnerFixed =
            block instanceof HTMLElement
                ? String(block.dataset.partnerFixed || '')
                      .split('|')
                      .map((s) => s.trim())
                      .filter(Boolean)
                : [];
        const partnerOrPools =
            block instanceof HTMLElement
                ? String(block.dataset.partnerOrPools || '')
                      .split(';')
                      .map((pool) =>
                          pool
                              .split('|')
                              .map((s) => s.trim())
                              .filter(Boolean),
                      )
                      .filter((pool) => pool.length > 0)
                : [];
        const partnerCountMin =
            block instanceof HTMLElement && block.dataset.partnerCountMin
                ? Number(block.dataset.partnerCountMin)
                : undefined;
        const partnerCountMax =
            block instanceof HTMLElement && block.dataset.partnerCountMax
                ? Number(block.dataset.partnerCountMax)
                : undefined;
        const lineId = block.dataset.lineId || '';
        const voicePrefix = block instanceof HTMLElement ? String(block.dataset.voicePrefix || '').trim() : '';
        const render = block.dataset.selectedRender || '';
        const eraEl = block.querySelector('.dialogue-theater-line__era-select');
        const statusElLine = block.querySelector('.dialogue-theater-line__status-select');
        const lineEra =
            eraEl instanceof HTMLSelectElement
                ? normalizeDialogueLineEra(eraEl.value)
                : DIALOGUE_THEATER_ERA_OVERWATCH;
        const lineStatus =
            statusElLine instanceof HTMLSelectElement
                ? normalizeDialogueLineStatus(statusElLine.value)
                : 'active';
        const mirrorEl = block.querySelector('.dialogue-theater-line__mirror-check');
        const mirror = mirrorEl instanceof HTMLInputElement && mirrorEl.checked;
        const normalized = normalizeDialogueLine({
            id: lineId,
            hero,
            voice,
            voicePrefix,
            subtitles,
            render,
            era: lineEra,
            status: lineStatus,
            mirror,
            disclaimer,
            partnerMode,
            partners: normalizeChatterPartnerList(partnersRaw),
            partnerFocus,
            partnerStackOrder,
            partnerFixed,
            partnerOrPools,
            partnerCountMin,
            partnerCountMax,
        });
        if (normalized) lines.push(normalized);
    });

    const pathPatch = collectVariationPathsFromHost(host);
    /** @type {Partial<import('../data/DialogueTheaterDataService.js').DialogueConversation>} */
    const patch = { status, eraName: '', tags, scene, lines, ...pathPatch };
    patch.mapChoices = mapChoices;
    patch.skinChoices = skinChoices;
    patch.eventChoices = eventChoices;
    return patch;
}

/**
 * @param {HTMLElement} scrollable
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {'view'|'edit'} mode
 * @param {{ onPathChange?: (pathId: string) => void }} [options]
 */
export async function mountDialogueTheaterPanel(scrollable, conversation, mode, options = {}) {
    // Edit mode always rescans so newly copied Voicelines appear in the picker.
    await ensureDialogueTheaterAssetsLoaded({ force: mode === 'edit' });
    const host = ensureHost(scrollable);
    if (mode === 'edit') {
        renderDialogueTheaterEditPanel(host, conversation);
    } else {
        renderDialogueTheaterViewPanel(host, conversation, options);
    }
    return host;
}

export function isDialogueTheaterViewPlaybackActive() {
    return activeViewPlayAllToken !== null || activeViewVoicelineAudio !== null;
}

/**
 * @param {{ preservePlayback?: boolean }} [options]
 */
export function unmountDialogueTheaterPanel({ preservePlayback = false } = {}) {
    if (!preservePlayback) {
        stopViewVoicelinePlayback();
    }
    document.getElementById(HOST_ID)?.remove();
}

export function stopDialogueTheaterViewPlayback() {
    stopViewVoicelinePlayback();
}

export async function ensureDialogueTheaterAssetsLoaded({ force = false } = {}) {
    const shouldForce = force || !cachedAssetsLoadedOnce;
    const [heroes, assets] = await Promise.all([
        loadDialogueTheaterHeroes(),
        loadDialogueTheaterAssets({ force: shouldForce }),
    ]);
    heroOptions = heroes;
    theaterAssets = assets;
    if (!Object.keys(theaterAssets.renders || {}).length) {
        clearDialogueTheaterAssetsCache();
        theaterAssets = await loadDialogueTheaterAssets({ force: true });
    }
    cachedAssetsLoadedOnce = true;
}

/**
 * @param {() => void} onDelete
 * @param {HTMLElement} [host]
 */
export function wireDialogueTheaterDeleteEntry(onDelete, host = document.getElementById('dialogueTheaterEditHost')) {
    const btn = host?.querySelector('#dialogueTheaterDeleteEntryBtn');
    if (!btn) return;
    btn.onclick = (e) => {
        e.preventDefault();
        onDelete();
    };
}
