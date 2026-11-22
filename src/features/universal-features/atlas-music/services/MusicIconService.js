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
    }

    /**
     * Update pause/play icon. Active fill / white icon is CSS on the button.
     */
    updatePauseIcon(isPaused) {
        if (this.pauseBtnIcon) {
            this.pauseBtnIcon.src = isPaused
                ? 'src/assets/images/Icons/Music%20Icons/Play%20Icon.png'
                : 'src/assets/images/Icons/Music%20Icons/Pause%20Icon.png';
            this.pauseBtnIcon.alt = isPaused ? 'Play' : 'Pause';
            this.pauseBtnIcon.style.opacity = '';
        }
    }

    /**
     * Update mute/unmute icon
     */
    updateMuteIcon(isMuted) {
        if (this.muteBtnIcon) {
            this.muteBtnIcon.src = isMuted
                ? 'src/assets/images/Icons/Music%20Icons/Muted%20Icon.png'
                : 'src/assets/images/Icons/Music%20Icons/Unmuted%20Icon.png';
            this.muteBtnIcon.alt = isMuted ? 'Unmute' : 'Mute';
            this.muteBtnIcon.style.opacity = '';
        }
    }

    /**
     * Update shuffle icon
     */
    updateShuffleIcon(_isShuffling) {
        if (this.shuffleBtnIcon) {
            this.shuffleBtnIcon.src = 'src/assets/images/Icons/Music%20Icons/Shuffle%20Icon.png';
            this.shuffleBtnIcon.style.opacity = '';
        }
    }

    /**
     * Loop toggle — visual active state is the button fill / icon invert.
     */
    updateLoopIcon(_isLooping) {
        if (this.loopBtnIcon) this.loopBtnIcon.style.opacity = '';
    }
}

