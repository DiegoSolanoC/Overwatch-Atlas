/**
 * MusicPanelDom — builds and mounts the Music panel DOM (#musicPanel).
 *
 * Pure DOM factory: appends the panel to <body> and returns it. The actual
 * playback / volume / progress wiring lives in the sibling `MusicPanelService.js`
 * and the rest of the `Music*Service.js` modules in this folder.
 */

/**
 * @returns {HTMLElement} The newly created #musicPanel element.
 */
export function createMusicPanel() {
    const panel = document.createElement('div');
    panel.id = 'musicPanel';
    panel.className = 'music-panel';
    panel.innerHTML = `
        <div class="music-panel-close" id="musicPanelClose">&times;</div>
        <div class="music-panel-content">
            <div class="music-actions">
                <h2 class="music-title">Music Options</h2>
                <div class="music-actions-buttons"></div>
            </div>
            <div class="music-controls-section music-controls-section--playback">
                <h3 class="music-controls-section-title">Now playing</h3>
                <div class="music-now-playing" id="musicNowPlaying">
                <div class="music-current-song-row">
                    <img class="music-playing-disc" src="src/assets/images/Icons/Music%20Icons/Playing%20Icon.png" alt="" width="32" height="32" decoding="async" />
                    <div class="music-current-song" id="musicCurrentSong">Loading...</div>
                </div>
                <div class="music-progress-container">
                    <input type="range" id="musicProgressBar" class="music-progress-bar" min="0" max="100" value="0">
                    <div class="music-time-display">
                        <span id="musicCurrentTime">0:00</span> <span id="musicTotalTime">0:00</span>
                    </div>
                    <div class="music-control-buttons">
                        <button id="pauseBtn" class="music-control-btn">
                            <img id="pauseBtnIcon" src="src/assets/images/Icons/Music%20Icons/Pause%20Icon.png" alt="Pause" class="control-icon">
                        </button>
                        <button id="skipBtn" class="music-control-btn">
                            <img id="skipBtnIcon" src="src/assets/images/Icons/Music%20Icons/Skip%20Icon.png" alt="Skip" class="control-icon">
                        </button>
                        <button id="muteBtn" class="music-control-btn">
                            <img id="muteBtnIcon" src="src/assets/images/Icons/Music%20Icons/Unmuted%20Icon.png" alt="Mute" class="control-icon">
                        </button>
                        <button id="loopBtn" type="button" class="music-control-btn" aria-label="Loop current track">
                            <img id="loopBtnIcon" src="src/assets/images/Icons/Music%20Icons/Loop%20Icon.png" alt="Loop" class="control-icon">
                        </button>
                        <button id="shuffleBtn" class="music-control-btn">
                            <img id="shuffleBtnIcon" src="src/assets/images/Icons/Music%20Icons/Shuffle%20Icon.png" alt="Shuffle" class="control-icon">
                        </button>
                    </div>
                </div>
                </div>
            </div>
            <div class="music-controls-section music-controls-section--volume">
                <h3 class="music-controls-section-title">Volume</h3>
                <div class="music-controls-section-inner">
                    <div class="music-control-row">
                        <label for="volumeSlider">Music Volume:</label>
                        <input type="range" id="volumeSlider" class="volume-slider" min="0" max="100" value="10">
                        <span id="volumeValue" class="volume-value">10%</span>
                    </div>
                    <div class="music-control-row">
                        <label for="soundEffectsSlider">Sound Effects Volume:</label>
                        <input type="range" id="soundEffectsSlider" class="volume-slider" min="0" max="100" value="50">
                        <span id="soundEffectsVolumeValue" class="volume-value">50%</span>
                    </div>
                </div>
            </div>
            <div class="music-grid" id="musicGrid"></div>
        </div>
    `;
    document.body.appendChild(panel);
    return panel;
}
