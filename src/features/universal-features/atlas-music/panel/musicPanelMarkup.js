/**
 * musicPanelMarkup — builds the `#musicPanel` HTML and appends it to `<body>`.
 *
 * Pure factory: no listeners are attached here. The panel is later re-mounted
 * inside `#filtersPanel` by `MusicPanelService.setupToggleButton`. All
 * interactive wiring lives in this folder's `wire*` and `*Buttons` siblings.
 */

/**
 * @returns {HTMLElement} The newly created #musicPanel element.
 */
export function createMusicPanel() {
    const panel = document.createElement('div');
    panel.id = 'musicPanel';
    panel.className = 'music-panel';
    panel.innerHTML = `
        <div class="music-panel-content">
            <div class="music-top-controls-row">
                <div class="music-controls-section music-controls-section--playback">
                    <div class="music-controls-section-title-row">
                        <img class="music-playing-disc" src="src/assets/images/Icons/Music%20Icons/Playing%20Icon.png" alt="" width="28" height="28" decoding="async" />
                        <h3 class="music-controls-section-title">Now playing</h3>
                    </div>
                    <div class="music-now-playing" id="musicNowPlaying">
                        <div class="music-current-song" id="musicCurrentSong">Loading...</div>
                        <div class="music-progress-container">
                            <input type="range" id="musicProgressBar" class="music-progress-bar" min="0" max="100" value="0">
                            <div class="music-time-display">
                                <span id="musicCurrentTime">0:00</span>
                                <span class="music-time-sep" aria-hidden="true">/</span>
                                <span id="musicTotalTime">0:00</span>
                            </div>
                            <div class="music-control-buttons">
                                <button id="pauseBtn" type="button" class="music-control-btn music-control-btn--slant-left" aria-label="Pause">
                                    <img id="pauseBtnIcon" src="src/assets/images/Icons/Music%20Icons/Pause%20Icon.png" alt="" class="control-icon">
                                </button>
                                <button id="skipBtn" type="button" class="music-control-btn music-control-btn--slant-left" aria-label="Skip">
                                    <img id="skipBtnIcon" src="src/assets/images/Icons/Music%20Icons/Skip%20Icon.png" alt="" class="control-icon">
                                </button>
                                <button id="muteBtn" type="button" class="music-control-btn music-control-btn--slant-center" aria-label="Mute">
                                    <img id="muteBtnIcon" src="src/assets/images/Icons/Music%20Icons/Unmuted%20Icon.png" alt="" class="control-icon">
                                </button>
                                <button id="loopBtn" type="button" class="music-control-btn music-control-btn--slant-right" aria-label="Loop current track">
                                    <img id="loopBtnIcon" src="src/assets/images/Icons/Music%20Icons/Loop%20Icon.png" alt="" class="control-icon">
                                </button>
                                <button id="shuffleBtn" type="button" class="music-control-btn music-control-btn--slant-right" aria-label="Shuffle">
                                    <img id="shuffleBtnIcon" src="src/assets/images/Icons/Music%20Icons/Shuffle%20Icon.png" alt="" class="control-icon">
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="music-controls-section music-controls-section--volume">
                    <h3 class="music-controls-section-title">Volume</h3>
                    <div class="music-controls-section-inner music-controls-section-inner--compact">
                        <div class="music-control-row">
                            <label for="volumeSlider">
                                <img class="music-volume-row-icon" src="src/assets/images/Icons/Music%20Icons/Playing%20Icon.png" alt="" width="34" height="34" decoding="async" aria-hidden="true" />
                                <span>Music</span>
                            </label>
                            <span id="volumeValue" class="volume-value">10%</span>
                            <input type="range" id="volumeSlider" class="volume-slider" min="0" max="100" value="10">
                        </div>
                        <div class="music-control-row">
                            <label for="soundEffectsSlider">
                                <img class="music-volume-row-icon" src="src/assets/images/Icons/Music%20Icons/Effects%20Icon.png" alt="" width="34" height="34" decoding="async" aria-hidden="true" />
                                <span>SFX</span>
                            </label>
                            <span id="soundEffectsVolumeValue" class="volume-value">50%</span>
                            <input type="range" id="soundEffectsSlider" class="volume-slider" min="0" max="100" value="50">
                        </div>
                        <div class="music-control-row">
                            <label for="characterVolumeSlider">
                                <img class="music-volume-row-icon" src="src/assets/images/Icons/Utility%20Icons/Voicline%20Icon.png" alt="" width="34" height="34" decoding="async" aria-hidden="true" />
                                <span>Voice</span>
                            </label>
                            <span id="characterVolumeValue" class="volume-value">70%</span>
                            <input type="range" id="characterVolumeSlider" class="volume-slider" min="0" max="100" value="70">
                        </div>
                    </div>
                </div>
            </div>
            <div class="music-controls-section music-controls-section--categories" id="musicCategoriesSection">
                <div class="music-controls-section-title-row music-controls-section-title-row--categories">
                    <h3 class="music-controls-section-title">Categories</h3>
                    <button type="button" id="musicCategoryGearBtn" class="music-category-gear-btn" aria-label="Edit categories" aria-pressed="false" title="Edit categories">
                        <img class="music-category-gear-icon" src="src/assets/images/Icons/Utility%20Icons/Config%20Icon.png" alt="" width="22" height="22" decoding="async" aria-hidden="true" />
                    </button>
                </div>
                <div class="music-category-tabs" id="musicCategoryTabs" role="tablist" aria-label="Music categories"></div>
                <div class="music-category-manage" id="musicCategoryManage" hidden>
                    <button type="button" id="musicCategoryDeleteBtn" class="music-category-delete-btn">Delete category</button>
                </div>
            </div>
            <h4 class="music-category-board-heading" id="musicCategoryInHeading" hidden>In this category — click to remove</h4>
            <div class="music-grid" id="musicGrid"></div>
            <div class="music-category-out-toolbar" id="musicCategoryOutToolbar" hidden>
                <h4 class="music-category-board-heading" id="musicCategoryOutHeading">Click to add</h4>
                <div class="music-category-out-mode" id="musicCategoryOutMode" role="group" aria-label="Songs to show">
                    <button type="button" class="music-category-out-mode-btn active" data-out-mode="not-in">Not in this category</button>
                    <button type="button" class="music-category-out-mode-btn" data-out-mode="uncategorized">Uncategorized only</button>
                </div>
            </div>
            <div class="music-grid music-grid--category-out" id="musicCategoryOutGrid" hidden></div>
        </div>
    `;
    document.body.appendChild(panel);
    return panel;
}
