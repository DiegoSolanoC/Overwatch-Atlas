/**
 * SoundEffectsManager - Manages all sound effects for the application
 * Handles loading, playing, and volume control for sound effects
 *
 * Debug: In DevTools console set window.DEBUG_SOUND_EFFECTS = true then try playing a sound.
 * You'll see [SFX] logs for each play() and any rejections (e.g. NotAllowedError on desktop after WebGL).
 */

class SoundEffectsManager {
    constructor() {
        this.sounds = {};
        this.volume = 0.5; // Default 50%
        this._audioUnlocked = false;
        // Use original Audio element (no clone) by default so sound works on desktop Chrome after WebGL.
        // Clone can resolve but produce no sound; original element is reliable. Overlapping is disabled.
        this._cloneBlocked = true;
        // Set window.DEBUG_SOUND_EFFECTS = true in console to log every play() and result
        this._debug = () => !!(typeof window !== 'undefined' && window.DEBUG_SOUND_EFFECTS);
    }

    _clearFadeTimers(audioEl) {
        if (!audioEl) return;
        if (audioEl._fadeInterval) {
            clearInterval(audioEl._fadeInterval);
            audioEl._fadeInterval = null;
        }
        if (audioEl._fadeTimeout) {
            clearTimeout(audioEl._fadeTimeout);
            audioEl._fadeTimeout = null;
        }
    }

    _scheduleFadeOut(audioEl, { fadeOutAfterMs = 0, fadeOutDurationMs = 0 } = {}) {
        if (!audioEl) return;
        const after = Math.max(0, fadeOutAfterMs || 0);
        const dur = Math.max(0, fadeOutDurationMs || 0);
        if (!after || !dur) return;

        this._clearFadeTimers(audioEl);

        audioEl._fadeTimeout = setTimeout(() => {
            const steps = 30;
            const stepMs = Math.max(10, Math.floor(dur / steps));
            const startVol = audioEl.volume;
            let i = 0;
            audioEl._fadeInterval = setInterval(() => {
                i++;
                const t = Math.min(1, i / steps);
                audioEl.volume = startVol * (1 - t);
                if (t >= 1) {
                    clearInterval(audioEl._fadeInterval);
                    audioEl._fadeInterval = null;
                    audioEl.volume = 0;
                }
            }, stepMs);
        }, after);
    }
    
    // Load saved volume from localStorage
    loadVolume() {
        const savedVolume = localStorage.getItem('soundEffectsVolume');
        if (savedVolume !== null) {
            const volume = parseFloat(savedVolume);
            if (!isNaN(volume) && volume >= 0 && volume <= 1) {
                this.volume = volume;
            }
        }
        return this.volume;
    }
    
    // Save volume to localStorage
    saveVolume() {
        localStorage.setItem('soundEffectsVolume', this.volume.toString());
    }
    
    // Load a sound effect
    loadSound(name, path) {
        try {
            const audio = new Audio(path);
            audio.preload = 'auto'; // Preload the audio
            audio.volume = this.volume;
            // Add error handler
            audio.addEventListener('error', (e) => {
                console.error(`Error loading sound "${name}" from "${path}":`, e);
            });
            // Add load handler for debugging
            audio.addEventListener('canplaythrough', () => {
                console.log(`Sound "${name}" loaded successfully`);
            });
            this.sounds[name] = audio;
            return audio;
        } catch (error) {
            console.error(`Failed to create audio for "${name}":`, error);
            return null;
        }
    }
    
    /**
     * Unlock audio for this document (browser autoplay policy).
     * Call once in a user gesture so subsequent play() works (e.g. after WebGL/timeline load).
     */
    unlock() {
        if (this._audioUnlocked) return;
        this._audioUnlocked = true;
        const key = Object.keys(this.sounds)[0];
        if (!key || !this.sounds[key]) return;
        const el = this.sounds[key];
        const prevVolume = el.volume;
        el.volume = 0;
        const p = el.play();
        if (p && typeof p.then === 'function') {
            p.then(() => {
                el.pause();
                el.currentTime = 0;
                el.volume = prevVolume;
            }).catch(() => { el.volume = prevVolume; });
        } else {
            el.volume = prevVolume;
        }
    }

    /**
     * Play using the original Audio element (no clone). Use when clone fails (e.g. desktop Chrome after WebGL).
     * No overlapping playback; restarts if already playing.
     */
    _playOriginal(name, vol, options = {}) {
        const orig = this.sounds[name];
        if (!orig) return null;
        this._clearFadeTimers(orig);
        orig.currentTime = 0;
        if (options.playbackRate) orig.playbackRate = options.playbackRate;
        orig.volume = vol;
        const p = orig.play();
        if (p && typeof p.then === 'function') {
            p.catch(err => {
                if (this._debug()) console.warn('[SFX] _playOriginal failed:', name, err?.name || err);
            });
        }
        this._scheduleFadeOut(orig, options);
        return orig;
    }

    // Play a sound effect
    play(name, options = {}) {
        const debug = this._debug();
        if (!this.sounds[name]) {
            if (debug) console.warn('[SFX] play: sound not loaded:', name, 'loaded:', Object.keys(this.sounds));
            console.warn(`Sound effect "${name}" not loaded`);
            return null;
        }

        // Unlock on first play in a user gesture (helps after timeline/WebGL load)
        if (!this._audioUnlocked) this.unlock();

        let volumeMultiplier = 1;
        if (name === 'filterConfirm') volumeMultiplier = 0.5;
        else if (name === 'hackOn' || name === 'hackOff') volumeMultiplier = 0.85;
        else if (name === 'page') volumeMultiplier = 0.4;
        else if (name === 'spacePanelOn' || name === 'spacePanelOff') volumeMultiplier = 0.10;
        const vol = Math.max(0, Math.min(1, this.volume)) * volumeMultiplier;

        // Desktop Chrome often blocks clone.play() after WebGL; use original element so sound still works (no overlap)
        if (this._cloneBlocked) {
            return this._playOriginal(name, vol, options);
        }

        // Clone for overlapping playback
        const audio = this.sounds[name].cloneNode();
        audio.currentTime = 0;
        if (options.playbackRate) audio.playbackRate = options.playbackRate;
        audio.volume = vol;

        const playAudio = (source, label) => {
            const p = source.play();
            if (p && typeof p.then === 'function') {
                p.then(() => {
                    if (debug) console.log('[SFX]', name, label, '→ played');
                }).catch(err => {
                    if (debug) console.warn('[SFX]', name, label, '→', err?.name || 'rejected', err?.message || '');
                    if (err && err.name === 'NotAllowedError') {
                        this._cloneBlocked = true; // Use original-only from now on (desktop Chrome after WebGL)
                        console.info('Sound effects: switched to compatible mode for this browser. Try the same button again — it should play.');
                        if (debug) console.log('[SFX] clone blocked; using original-only for future plays.');
                    }
                    // Fallback: play original element (no clone) — often works on desktop when clone fails
                    if (source !== this.sounds[name]) {
                        if (debug) console.log('[SFX] fallback: playing original for', name);
                        this._playOriginal(name, vol, options);
                    }
                });
            }
        };

        if (audio.readyState >= 2) {
            playAudio(audio, 'clone');
        } else {
            const readyHandler = () => {
                playAudio(audio, 'clone');
                audio.removeEventListener('canplay', readyHandler);
            };
            audio.addEventListener('canplay', readyHandler);
            setTimeout(() => {
                if (audio.readyState >= 2) playAudio(audio, 'clone');
                audio.removeEventListener('canplay', readyHandler);
            }, 50);
        }

        // Fade-out support for any sound (e.g. Space Panel On)
        this._scheduleFadeOut(audio, options);

        if (name === 'hackOn' && options.fadeOut) {
            const fadeDuration = options.fadeOutDuration || 500;
            const fadeSteps = 20;
            const fadeStepTime = fadeDuration / fadeSteps;
            const startVolume = audio.volume;
            let currentStep = 0;
            const fadeInterval = setInterval(() => {
                currentStep++;
                audio.volume = startVolume * (1 - currentStep / fadeSteps);
                if (currentStep >= fadeSteps) {
                    clearInterval(fadeInterval);
                    audio.volume = 0;
                    setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 100);
                }
            }, fadeStepTime);
        }
        return audio;
    }
    
    // Set volume for all sound effects
    setVolume(volume) {
        this.volume = volume;
        this.saveVolume(); // Save to localStorage
        Object.keys(this.sounds).forEach(name => {
            // Filter confirm is always at 50% of the set volume
            if (name === 'filterConfirm') {
                this.sounds[name].volume = volume * 0.5;
            } else {
                this.sounds[name].volume = volume;
            }
        });
        // Panel edge drags + page-slider scrub use a separate Audio pool (tick.mp3)
        if (typeof window !== 'undefined' && window.PanelResizeGearTick &&
            typeof window.PanelResizeGearTick.syncFromSoundEffectsVolume === 'function') {
            window.PanelResizeGearTick.syncFromSoundEffectsVolume();
        }
    }
    
    // Initialize sound effects
    init() {
        // Load all sound effects
        // Use window.logAssetLoad if available (defined in script.js)
        const logAssetLoad = (typeof window !== 'undefined' && typeof window.logAssetLoad === 'function') 
            ? window.logAssetLoad 
            : (() => {});
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Filter Pick.mp3');
        this.loadSound('filterPick', 'src/assets/audio/sfx/Filter Pick.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Filter Off.mp3');
        this.loadSound('filterOff', 'src/assets/audio/sfx/Filter Off.mp3');
        // Filter confirm at reduced volume (50% of normal)
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Filter Confirm.mp3');
        const filterConfirmAudio = new Audio('src/assets/audio/sfx/Filter Confirm.mp3');
        filterConfirmAudio.volume = this.volume * 0.5; // 50% of sound effects volume
        this.sounds['filterConfirm'] = filterConfirmAudio;
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Filter Clear.mp3');
        this.loadSound('filterClear', 'src/assets/audio/sfx/Filter Clear.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Radiate.mp3');
        this.loadSound('radiate', 'src/assets/audio/sfx/Radiate.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Page.mp3');
        this.loadSound('page', 'src/assets/audio/sfx/Page.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Event Click.mp3');
        this.loadSound('eventClick', 'src/assets/audio/sfx/Event Click.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Music.mp3');
        this.loadSound('music', 'src/assets/audio/sfx/Music.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Hack On.mp3');
        this.loadSound('hackOn', 'src/assets/audio/sfx/Hack On.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Hack Off.mp3');
        this.loadSound('hackOff', 'src/assets/audio/sfx/Hack Off.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Transport Toggle.mp3');
        this.loadSound('transportToggle', 'src/assets/audio/sfx/Transport Toggle.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Weather.mp3');
        this.loadSound('weather', 'src/assets/audio/sfx/Weather.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Rotation Toggle.mp3');
        this.loadSound('rotationToggle', 'src/assets/audio/sfx/Rotation Toggle.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Event Manager.mp3');
        this.loadSound('eventManager', 'src/assets/audio/sfx/Event Manager.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Switch Event.mp3');
        this.loadSound('switchEvent', 'src/assets/audio/sfx/Switch Event.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Filter Button.mp3');
        this.loadSound('filterButton', 'src/assets/audio/sfx/Filter Button.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Color Change.mp3');
        this.loadSound('colorChange', 'src/assets/audio/sfx/Color Change.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Mode Switch.mp3');
        this.loadSound('modeSwitch', 'src/assets/audio/sfx/Mode Switch.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Switch Map.mp3');
        this.loadSound('switchMap', 'src/assets/audio/sfx/Switch Map.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Image Display.mp3');
        this.loadSound('imageDisplay', 'src/assets/audio/sfx/Image Display.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Space Panel On.mp3');
        this.loadSound('spacePanelOn', 'src/assets/audio/sfx/Space Panel On.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Space Panel Off.mp3');
        this.loadSound('spacePanelOff', 'src/assets/audio/sfx/Space Panel Off.mp3');
        if (typeof logAssetLoad === 'function') logAssetLoad('SOUND_EFFECT', 'Node Select.mp3');
        // Node select: faster playback (1.7x) and lower volume (10% of normal)
        const nodeSelectAudio = new Audio('src/assets/audio/sfx/Node Select.mp3');
        nodeSelectAudio.volume = this.volume * 0.1;
        nodeSelectAudio.playbackRate = 1.7;
        this.sounds['nodeSelect'] = nodeSelectAudio;
        
        // Load saved volume and apply it
        const savedVolume = this.loadVolume();
        this.setVolume(savedVolume); // This will apply to all sounds
        
        // Setup sound effects volume slider (may not exist yet - music panel is created when timeline loads)
        this.setupSoundEffectsSlider();

        // Unlock audio on first user interaction (helps after timeline/WebGL load on desktop)
        const unlockOnInteraction = () => {
            this.unlock();
            document.removeEventListener('click', unlockOnInteraction, true);
            document.removeEventListener('touchstart', unlockOnInteraction, true);
            document.removeEventListener('keydown', unlockOnInteraction, true);
        };
        document.addEventListener('click', unlockOnInteraction, true);
        document.addEventListener('touchstart', unlockOnInteraction, true);
        document.addEventListener('keydown', unlockOnInteraction, true);
    }
    
    /**
     * Setup or sync the sound effects volume slider UI.
     * Call this when the music panel is created (e.g. from MusicManager.init()) so the slider
     * reflects the actual volume and responds to input.
     */
    setupSoundEffectsSlider() {
        const soundEffectsSlider = document.getElementById('soundEffectsSlider');
        const soundEffectsVolumeValue = document.getElementById('soundEffectsVolumeValue');
        
        if (!soundEffectsSlider || !soundEffectsVolumeValue) return;
        
        const currentVolume = this.volume;
        const valuePct = Math.round(currentVolume * 100);
        soundEffectsSlider.value = valuePct;
        soundEffectsVolumeValue.textContent = valuePct + '%';
        
        // Only attach listener once (use a data attribute to avoid duplicates)
        if (soundEffectsSlider.dataset.soundEffectsBound === 'true') return;
        soundEffectsSlider.dataset.soundEffectsBound = 'true';
        
        soundEffectsSlider.addEventListener('input', () => {
            const volume = soundEffectsSlider.value / 100;
            this.setVolume(volume);
            soundEffectsVolumeValue.textContent = soundEffectsSlider.value + '%';
        });
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SoundEffectsManager;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.SoundEffectsManager = new SoundEffectsManager();
}
