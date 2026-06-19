/**
 * Dialogue Theater info panel — view + edit UI inside #eventSlideScrollable.
 */

import { playCharacterAudio } from '../../universal-features/atlas-character-audio/CharacterVolumeService.js';
import {
    resetDialogueTheaterStageToIdle,
    updateDialogueTheaterStageActiveLine,
} from '../dialogue-theater-stage/dialogueTheaterStageOverlay.js';
import { DOCK_ERA_MENU_OPTIONS } from '../../system-interface/interface-bottom-dock/dockEraTimelineFilter.js';
import { applyEraNameToEvent } from '../../system-interface/interface-left-panel/event-system/edit/timelineFormParsing.js';
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
import {
    buildBlankDialogueLine,
    normalizeDialogueLine,
} from '../data/dialogueTheaterConversationSchema.js';
import { setupSingleValueAutocomplete } from './dialogueTheaterSingleAutocomplete.js';
import { setupVoicelineAutocomplete } from './dialogueTheaterVoicelineAutocomplete.js';
import {
    findVoicelineForHeroAndSubtitles,
    resolveLineVoiceFile,
    voicelineBelongsToHero,
    voicelineFilenameToSubtitles,
} from '../data/theaterVoicelineParsing.js';

const HOST_ID = 'dialogueTheaterEditHost';
const ERA_OPTIONS = DOCK_ERA_MENU_OPTIONS.filter((o) => o.id !== 'complete');

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

function stopViewVoicelinePlayback(conversation = null) {
    activeViewPlayAllToken = null;
    if (activeViewVoicelineAudio) {
        activeViewVoicelineAudio.pause();
        activeViewVoicelineAudio.currentTime = 0;
        activeViewVoicelineAudio = null;
    }
    if (conversation) {
        resetDialogueTheaterStageToIdle(conversation);
    }
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {number[]}
 */
function listPlayableLineIndices(conversation) {
    const voicelines = theaterAssets?.voicelines || [];
    const indices = [];
    for (let i = 0; i < conversation.lines.length; i += 1) {
        if (resolveLineVoiceFile(conversation.lines[i], voicelines)) indices.push(i);
    }
    return indices;
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {string[]} voices
 */
async function playAllViewVoicelines(conversation, voices) {
    stopViewVoicelinePlayback();
    const token = Symbol('playAll');
    activeViewPlayAllToken = token;
    const lineIndices = listPlayableLineIndices(conversation);

    for (let i = 0; i < voices.length; i += 1) {
        if (activeViewPlayAllToken !== token) return;

        const lineIndex = lineIndices[i];
        if (lineIndex >= 0) {
            updateDialogueTheaterStageActiveLine(conversation, lineIndex);
        }

        const audio = await playCharacterAudio(voicelineAudioUrl(voices[i]));
        if (!audio || activeViewPlayAllToken !== token) return;

        activeViewVoicelineAudio = audio;
        await new Promise((resolve) => {
            const finish = () => resolve();
            audio.addEventListener('ended', finish, { once: true });
            audio.addEventListener('error', finish, { once: true });
        });

        if (activeViewPlayAllToken !== token) return;
        activeViewVoicelineAudio = null;

        if (i < voices.length - 1) {
            await new Promise((resolve) => {
                setTimeout(resolve, VIEW_PLAY_ALL_GAP_MS);
            });
        }
    }

    if (activeViewPlayAllToken === token) {
        activeViewPlayAllToken = null;
        resetDialogueTheaterStageToIdle(conversation);
    }
}

/**
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @returns {string[]}
 */
function listPlayableVoicesForConversation(conversation) {
    const voicelines = theaterAssets?.voicelines || [];
    const voices = [];
    for (let i = 0; i < conversation.lines.length; i += 1) {
        const voice = resolveLineVoiceFile(conversation.lines[i], voicelines);
        if (voice) voices.push(voice);
    }
    return voices;
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
function wireDialogueTheaterViewPlayback(host, conversation) {
    const lines = conversation.lines || [];
    const voicelines = theaterAssets?.voicelines || [];
    const playableVoices = listPlayableVoicesForConversation(conversation);

    const playAllBtn = host.querySelector('#dialogueTheaterPlayAllBtn');
    if (playAllBtn instanceof HTMLButtonElement) {
        playAllBtn.disabled = playableVoices.length === 0;
        playAllBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            void playAllViewVoicelines(conversation, playableVoices);
        });
    }

    host.querySelectorAll('.dialogue-theater-edit__view-line').forEach((row, idx) => {
        const btn = row.querySelector('.dialogue-theater-edit__view-line-play');
        if (!(btn instanceof HTMLButtonElement)) return;

        const line = lines[idx];
        const voice = line ? resolveLineVoiceFile(line, voicelines) : '';
        if (!voice) {
            btn.disabled = true;
            return;
        }

        btn.disabled = false;
        btn.removeAttribute('aria-disabled');

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();

            stopViewVoicelinePlayback();
            updateDialogueTheaterStageActiveLine(conversation, idx);

            void playCharacterAudio(voicelineAudioUrl(voice)).then((audio) => {
                if (!audio) {
                    resetDialogueTheaterStageToIdle(conversation);
                    return;
                }
                activeViewVoicelineAudio = audio;
                audio.addEventListener(
                    'ended',
                    () => {
                        if (activeViewVoicelineAudio === audio) {
                            activeViewVoicelineAudio = null;
                            resetDialogueTheaterStageToIdle(conversation);
                        }
                    },
                    { once: true },
                );
            });
        });
    });
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
export function renderDialogueTheaterViewPanel(host, conversation) {
    host.className = 'dialogue-theater-edit-host dialogue-theater-edit-host--view';
    const statusLabel = conversation.status === 'outdated' ? 'Outdated' : 'Active';
    const era = conversation.eraName || '—';

    const linesHtml = conversation.lines.length
        ? conversation.lines.map((line) => {
            const voicelines = theaterAssets?.voicelines || [];
            const resolvedVoice = resolveLineVoiceFile(line, voicelines);
            const dialogueText =
                line.subtitles ||
                (resolvedVoice ? voicelineFilenameToSubtitles(resolvedVoice) : '');
            const hasVoice = Boolean(resolvedVoice);
            const iconBlock = line.hero
                ? `<div class="dialogue-theater-edit__view-line-icon-wrap">
                        <img class="dialogue-theater-edit__view-line-icon" src="${heroFilterIconUrl(line.hero)}" alt="" />
                   </div>`
                : `<div class="dialogue-theater-edit__view-line-icon-wrap dialogue-theater-edit__view-line-icon-wrap--empty" aria-hidden="true"></div>`;
            const playBtn = hasVoice
                ? `<button type="button" class="dialogue-theater-edit__view-line-play" aria-label="Play voiceline">▶</button>`
                : `<button type="button" class="dialogue-theater-edit__view-line-play" disabled aria-label="No audio">▶</button>`;
            return `
                <article class="dialogue-theater-edit__view-line">
                    ${iconBlock}
                    <p class="dialogue-theater-edit__view-line-text">${dialogueText ? escapeHtml(dialogueText) : '<span class="dialogue-theater-edit__muted">No dialogue text</span>'}</p>
                    ${playBtn}
                </article>
            `;
        }).join('')
        : '<p class="dialogue-theater-edit__muted">No dialogue lines yet.</p>';

    const hasPlayableVoices = conversation.lines.some((line) =>
        Boolean(resolveLineVoiceFile(line, theaterAssets?.voicelines || [])),
    );

    host.innerHTML = `
        <div class="dialogue-theater-edit dialogue-theater-edit--view">
            <dl class="dialogue-theater-edit__meta dialogue-theater-edit__meta--view">
                <div><dt>Status</dt><dd>${statusLabel}</dd></div>
                <div><dt>Era</dt><dd>${escapeHtml(era)}</dd></div>
            </dl>
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

    wireDialogueTheaterViewPlayback(host, conversation);
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
 * @param {HTMLElement} blockEl
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 */
function wireDialogueLineBlock(blockEl, line) {
    const heroInput = blockEl.querySelector('.dialogue-theater-line__hero-input');
    const heroIcon = blockEl.querySelector('.dialogue-theater-line__hero-icon');
    const voiceInput = blockEl.querySelector('.dialogue-theater-line__voice-input');
    const subtitlesInput = blockEl.querySelector('.dialogue-theater-line__subtitles-input');
    const renderGrid = blockEl.querySelector('.dialogue-theater-line__render-grid');
    const removeBtn = blockEl.querySelector('.dialogue-theater-line__remove-btn');

    function syncHeroAndRenders() {
        if (!(heroInput instanceof HTMLInputElement)) return;
        updateHeroIcon(heroIcon, heroInput.value);
        line.render = '';
        blockEl.dataset.selectedRender = '';
        refreshRenderPicker(renderGrid, heroInput.value, '', (next) => {
            line.render = next;
            blockEl.dataset.selectedRender = next;
        });
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
        setupSingleValueAutocomplete(heroInput, heroOptions, 'heroes');
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
    });

    removeBtn?.addEventListener('click', () => {
        blockEl.remove();
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

/**
 * @param {HTMLElement} linesHost
 * @param {import('../data/DialogueTheaterDataService.js').DialogueLine} line
 */
function appendDialogueLineBlock(linesHost, line) {
    const block = document.createElement('article');
    block.className = 'dialogue-theater-line';
    block.dataset.lineId = line.id;
    if (line.render) block.dataset.selectedRender = line.render;
    block.innerHTML = `
        <div class="dialogue-theater-line__row dialogue-theater-line__row--hero">
            <label class="dialogue-theater-edit__label">Hero</label>
            <div class="dialogue-theater-line__hero-field">
                <img class="dialogue-theater-line__hero-icon dialogue-theater-line__hero-icon--empty" alt="" />
                <input type="text" class="dialogue-theater-line__hero-input event-slide-inline-editor__input" placeholder="Pick a hero…" autocomplete="off" />
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
        <div class="dialogue-theater-line__row">
            <label class="dialogue-theater-edit__label">Render</label>
            <div class="dialogue-theater-line__render-grid dialogue-theater-edit__picker-grid"></div>
        </div>
        <button type="button" class="dialogue-theater-line__remove-btn event-slide-inline-editor__small-btn">Remove line</button>
    `;
    const heroInput = block.querySelector('.dialogue-theater-line__hero-input');
    const voiceInput = block.querySelector('.dialogue-theater-line__voice-input');
    const subtitlesInput = block.querySelector('.dialogue-theater-line__subtitles-input');
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
    linesHost.appendChild(block);
    wireDialogueLineBlock(block, line);
}

/**
 * @param {HTMLElement} host
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 */
export function renderDialogueTheaterEditPanel(host, conversation) {
    host.className = 'dialogue-theater-edit-host dialogue-theater-edit-host--edit';
    host.innerHTML = `
        <div class="dialogue-theater-edit dialogue-theater-edit--edit">
            <div class="dialogue-theater-edit__row">
                <label class="dialogue-theater-edit__label" for="dialogueTheaterEditStatus">Status</label>
                <select id="dialogueTheaterEditStatus" class="dialogue-theater-edit__select">
                    <option value="active">Active</option>
                    <option value="outdated">Outdated</option>
                </select>
            </div>
            <div class="dialogue-theater-edit__row">
                <label class="dialogue-theater-edit__label" for="dialogueTheaterEditEra">Era</label>
                <select id="dialogueTheaterEditEra" class="dialogue-theater-edit__select">
                    <option value="">— None —</option>
                    ${ERA_OPTIONS.map((o) => `<option value="${escapeHtml(o.label)}">${escapeHtml(o.label)}</option>`).join('')}
                </select>
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
            <div class="dialogue-theater-edit__row dialogue-theater-edit__row--delete">
                <button type="button" id="dialogueTheaterDeleteEntryBtn" class="event-slide-inline-editor__delete-btn">Delete conversation</button>
            </div>
        </div>
    `;

    const statusEl = host.querySelector('#dialogueTheaterEditStatus');
    const eraEl = host.querySelector('#dialogueTheaterEditEra');
    if (statusEl instanceof HTMLSelectElement) {
        statusEl.value = conversation.status === 'outdated' ? 'outdated' : 'active';
    }
    if (eraEl instanceof HTMLSelectElement) {
        eraEl.value = conversation.eraName || '';
    }

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
        };
        selectScene(conversation.scene || '');
    }

    const linesHost = host.querySelector('#dialogueTheaterLinesHost');
    if (linesHost instanceof HTMLElement) {
        const lines = conversation.lines.length ? conversation.lines : [];
        for (let i = 0; i < lines.length; i += 1) {
            appendDialogueLineBlock(linesHost, { ...lines[i] });
        }
        host.querySelector('#dialogueTheaterAddLineBtn')?.addEventListener('click', () => {
            appendDialogueLineBlock(linesHost, buildBlankDialogueLine());
        });
    }
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
    const eraEl = host.querySelector('#dialogueTheaterEditEra');
    const status =
        statusEl instanceof HTMLSelectElement && statusEl.value === 'outdated'
            ? 'outdated'
            : 'active';
    let eraName = eraEl instanceof HTMLSelectElement ? eraEl.value.trim() : '';
    const eraHolder = {};
    applyEraNameToEvent(eraHolder, eraName);
    eraName = eraHolder.eraName || '';

    const scene = host.dataset.selectedScene || '';
    /** @type {import('../data/DialogueTheaterDataService.js').DialogueLine[]} */
    const lines = [];
    host.querySelectorAll('.dialogue-theater-line').forEach((block) => {
        const hero = block.querySelector('.dialogue-theater-line__hero-input')?.value?.trim() || '';
        const voice = resolveVoiceFilenameFromBlock(block);
        const subtitles = block.querySelector('.dialogue-theater-line__subtitles-input')?.value ?? '';
        const lineId = block.dataset.lineId || '';
        const render = block.dataset.selectedRender || '';
        const normalized = normalizeDialogueLine({
            id: lineId,
            hero,
            voice,
            subtitles,
            render,
        });
        if (normalized) lines.push(normalized);
    });

    return { status, eraName, scene, lines };
}

/**
 * @param {HTMLElement} scrollable
 * @param {import('../data/DialogueTheaterDataService.js').DialogueConversation} conversation
 * @param {'view'|'edit'} mode
 */
export async function mountDialogueTheaterPanel(scrollable, conversation, mode) {
    await ensureDialogueTheaterAssetsLoaded();
    const host = ensureHost(scrollable);
    if (mode === 'edit') {
        renderDialogueTheaterEditPanel(host, conversation);
    } else {
        renderDialogueTheaterViewPanel(host, conversation);
    }
    return host;
}

export function unmountDialogueTheaterPanel() {
    stopViewVoicelinePlayback();
    document.getElementById(HOST_ID)?.remove();
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
