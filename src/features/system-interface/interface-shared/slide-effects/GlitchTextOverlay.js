/**
 * GlitchTextOverlay — HTML overlay + interval animation for “hacked” name/description display.
 * Legacy global: `window.GlitchTextService` (many classic-script callers).
 */

class GlitchTextOverlay {
    constructor() {
        this.glitchEnabled = true;
        this.glitchInterval = null;
    }

    getRandomGlitchChar() {
        const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789';
        return chars[Math.floor(Math.random() * chars.length)];
    }

    getDisplayText(text) {
        if (!text) return text;

        let processedText = text;
        processedText = processedText.replace(/\n\n+/g, '\n\n');

        if (!this.glitchEnabled) {
            const placeholdersOff = [];
            let offIdx = 0;
            const wrapToggle = (match) =>
                `<span class="glitchy-text-toggle-target" role="button" tabindex="0" title="Toggle glitch effect">${match}</span>`;
            processedText = processedText.replace(/\bOlivia\s+Colomar\b/gi, (match) => {
                const ph = `__GLITCH_FULL_${offIdx}__`;
                placeholdersOff[offIdx] = wrapToggle(match);
                offIdx++;
                return ph;
            });
            processedText = processedText.replace(/\bOlivia\b/gi, (match) => wrapToggle(match));
            processedText = processedText.replace(/\bColomar\b/gi, (match) => wrapToggle(match));
            placeholdersOff.forEach((replacement, index) => {
                processedText = processedText.replace(`__GLITCH_FULL_${index}__`, replacement);
            });
            processedText = processedText.replace(/\n/g, '<br>');
            return processedText;
        }

        const placeholders = [];
        let placeholderIndex = 0;

        processedText = processedText.replace(/\bOlivia\s+Colomar\b/gi, (match) => {
            const placeholder = `__GLITCH_FULL_${placeholderIndex}__`;
            const glitchOverlay = match.split('').map(() => this.getRandomGlitchChar()).join('');
            placeholders[placeholderIndex] =
                `<span class="glitchy-text-container" role="button" tabindex="0" title="Toggle glitch effect"><span class="glitchy-text-base">${match}</span><span class="glitchy-text-overlay">${glitchOverlay}</span></span>`;
            placeholderIndex++;
            return placeholder;
        });

        processedText = processedText.replace(/\bOlivia\b/gi, (match) => {
            const glitchOverlay = match.split('').map(() => this.getRandomGlitchChar()).join('');
            return `<span class="glitchy-text-container" role="button" tabindex="0" title="Toggle glitch effect"><span class="glitchy-text-base">${match}</span><span class="glitchy-text-overlay">${glitchOverlay}</span></span>`;
        });

        processedText = processedText.replace(/\bColomar\b/gi, (match) => {
            const glitchOverlay = match.split('').map(() => this.getRandomGlitchChar()).join('');
            return `<span class="glitchy-text-container" role="button" tabindex="0" title="Toggle glitch effect"><span class="glitchy-text-base">${match}</span><span class="glitchy-text-overlay">${glitchOverlay}</span></span>`;
        });

        placeholders.forEach((replacement, index) => {
            processedText = processedText.replace(`__GLITCH_FULL_${index}__`, replacement);
        });

        processedText = processedText.replace(/\n/g, '<br>');
        return processedText;
    }

    getDisplayEventName(eventName) {
        return this.getDisplayText(eventName);
    }

    isEnabled() {
        return this.glitchEnabled;
    }

    setEnabled(enabled) {
        this.glitchEnabled = enabled;
    }

    toggle() {
        this.glitchEnabled = !this.glitchEnabled;
        return this.glitchEnabled;
    }

    startAnimation() {
        if (this.glitchInterval) {
            clearInterval(this.glitchInterval);
        }
        this.glitchInterval = setInterval(() => {
            const overlays = document.querySelectorAll('.glitchy-text-overlay');
            overlays.forEach((overlay) => {
                const container = overlay.parentElement;
                if (container && container.querySelector('.glitchy-text-base')) {
                    const baseText = container.querySelector('.glitchy-text-base').textContent;
                    const newGlitch = baseText.split('').map(() => this.getRandomGlitchChar()).join('');
                    overlay.textContent = newGlitch;
                    overlay.style.maxWidth = '100%';
                }
            });
        }, 100);
    }

    stopAnimation() {
        if (this.glitchInterval) {
            clearInterval(this.glitchInterval);
            this.glitchInterval = null;
        }
    }

    toggleEffect(options = {}) {
        const wasEnabled = this.glitchEnabled;
        this.glitchEnabled = !this.glitchEnabled;

        const { titleElement, textElement, titleText, textText, toggleButton, onToggle } = options;

        if (window.SoundEffectsManager && window.SoundEffectsManager.play) {
            try {
                if (this.glitchEnabled) {
                    window.SoundEffectsManager.play('hackOn', {
                        playbackRate: 1.2,
                        fadeOut: true,
                        fadeOutDuration: 500
                    });
                } else {
                    window.SoundEffectsManager.play('hackOff', { playbackRate: 1.2 });
                }
            } catch (e) {
                console.error('Error playing hack sound:', e);
            }
        }

        if (titleElement) {
            const originalText = titleText || titleElement.textContent || '';
            titleElement.innerHTML = this.getDisplayEventName(originalText);
        }

        if (textElement) {
            const originalText = textText || textElement.textContent || '';
            textElement.innerHTML = this.getDisplayText(originalText);
        }

        if (toggleButton) {
            toggleButton.textContent = this.glitchEnabled ? 'Disable Glitch' : 'Enable Glitch';
        }

        if (this.glitchEnabled) {
            this.startAnimation();
        } else {
            this.stopAnimation();
        }

        if (onToggle && typeof onToggle === 'function') {
            onToggle(this.glitchEnabled, wasEnabled);
        }

        return this.glitchEnabled;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlitchTextOverlay;
}

if (typeof window !== 'undefined') {
    window.GlitchTextService = new GlitchTextOverlay();
}
