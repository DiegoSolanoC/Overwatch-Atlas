/**
 * MusicIconService - Handles icon updates for music controls
 */

export class MusicIconService {
    constructor() {
        this.pauseBtnIcon = null;
        this.muteBtnIcon = null;
        this.skipBtnIcon = null;
        this.shuffleBtnIcon = null;
        this.loopBtnIcon = null;
    }

    /**
     * Initialize icon element references
     */
    init() {
        this.pauseBtnIcon = document.getElementById('pauseBtnIcon');
        this.muteBtnIcon = document.getElementById('muteBtnIcon');
        this.skipBtnIcon = document.getElementById('skipBtnIcon');
        this.loopBtnIcon = document.getElementById('loopBtnIcon');
        this.shuffleBtnIcon = document.getElementById('shuffleBtnIcon');
        // No on/off state — same baseline tone as “inactive” toggles; hover/full via CSS restores emphasis.
        this._setIconTone(this.skipBtnIcon, false);
    }

    /**
     * Full strength vs dimmed — same language as {@link updateLoopIcon} (active / inactive).
     * @param {HTMLImageElement|null} img
     * @param {boolean} fullTone
     */
    _setIconTone(img, fullTone) {
        if (img) img.style.opacity = fullTone ? '1' : '0.5';
    }

    /**
     * Update pause/play icon
     */
    updatePauseIcon(isPaused) {
        if (this.pauseBtnIcon) {
            this.pauseBtnIcon.src = isPaused ? 'src/assets/images/Icons/Music%20Icons/Play%20Icon.png' : 'src/assets/images/Icons/Music%20Icons/Pause%20Icon.png';
            this.pauseBtnIcon.alt = isPaused ? 'Play' : 'Pause';
            // Match loop/shuffle/mute: dim when "off" (playing), full when "on" (paused — .active on button).
            this._setIconTone(this.pauseBtnIcon, !!isPaused);
        }
    }

    /**
     * Update mute/unmute icon
     */
    updateMuteIcon(isMuted) {
        if (this.muteBtnIcon) {
            this.muteBtnIcon.src = isMuted ? 'src/assets/images/Icons/Music%20Icons/Muted%20Icon.png' : 'src/assets/images/Icons/Music%20Icons/Unmuted%20Icon.png';
            this.muteBtnIcon.alt = isMuted ? 'Unmute' : 'Mute';
            this._setIconTone(this.muteBtnIcon, !!isMuted);
        }
    }

    /**
     * Update shuffle icon
     */
    updateShuffleIcon(isShuffling) {
        if (this.shuffleBtnIcon) {
            this.shuffleBtnIcon.src = 'src/assets/images/Icons/Music%20Icons/Shuffle%20Icon.png';
            this._setIconTone(this.shuffleBtnIcon, !!isShuffling);
        }
    }

    /**
     * Loop toggle: stronger when looping, dimmed when off (same for shuffle/mute above).
     */
    updateLoopIcon(isLooping) {
        this._setIconTone(this.loopBtnIcon, !!isLooping);
    }
}

