/**
 * GlitchTextService - Manages glitch text rendering and animation
 * Handles text processing, state management, and animation for glitch effects
 */

class GlitchTextService {
    constructor() {
        this.glitchEnabled = true; // Default to enabled
        this.glitchInterval = null; // Animation interval
    }

    /**
     * Generate random glitch character (includes numbers)
     * @returns {string} Random glitch character
     */
    getRandomGlitchChar() {
        const chars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`0123456789';
        return chars[Math.floor(Math.random() * chars.length)];
    }

    /**
     * Apply display transformations to text
     * Maps normal text to glitchy text for display purposes
     * Works for both event names and descriptions
     * @param {string} text - Text to process
     * @returns {string} HTML with glitchy text overlay effect
     */
    getDisplayText(text) {
        if (!text) return text;
        
        // Convert newlines to <br> tags to preserve paragraph spacing
        // First preserve line breaks by normalizing multiple newlines
        let processedText = text;
        
        // Normalize multiple newlines to double newlines (paragraph breaks)
        processedText = processedText.replace(/\n\n+/g, '\n\n');
        
        // Only apply glitch if enabled — still wrap Olivia/Colomar so tap toggles glitch on
        if (!this.glitchEnabled) {
            const placeholdersOff = [];
            let offIdx = 0;
            const wrapToggle = (match) => (
                `<span class="glitchy-text-toggle-target" role="button" tabindex="0" title="Toggle glitch effect">${match}</span>`
            );
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
        
        // First, replace "Olivia Colomar" as a whole (full name together)
        // Use a unique placeholder to mark already processed text
        const placeholders = [];
        let placeholderIndex = 0;
        
        // Replace full "Olivia Colomar" first (case-insensitive, with word boundaries to avoid partial matches)
        processedText = processedText.replace(/\bOlivia\s+Colomar\b/gi, (match) => {
            const placeholder = `__GLITCH_FULL_${placeholderIndex}__`;
            const glitchOverlay = match.split('').map(() => this.getRandomGlitchChar()).join('');
            placeholders[placeholderIndex] = `<span class="glitchy-text-container" role="button" tabindex="0" title="Toggle glitch effect"><span class="glitchy-text-base">${match}</span><span class="glitchy-text-overlay">${glitchOverlay}</span></span>`;
            placeholderIndex++;
            return placeholder;
        });
        
        // Then replace "Olivia" individually (word boundary ensures it's not part of "Olivia Colomar" which is already replaced)
        processedText = processedText.replace(/\bOlivia\b/gi, (match) => {
            const glitchOverlay = match.split('').map(() => this.getRandomGlitchChar()).join('');
            return `<span class="glitchy-text-container" role="button" tabindex="0" title="Toggle glitch effect"><span class="glitchy-text-base">${match}</span><span class="glitchy-text-overlay">${glitchOverlay}</span></span>`;
        });
        
        // Then replace "Colomar" individually (word boundary ensures it's not part of "Olivia Colomar" which is already replaced)
        processedText = processedText.replace(/\bColomar\b/gi, (match) => {
            const glitchOverlay = match.split('').map(() => this.getRandomGlitchChar()).join('');
            return `<span class="glitchy-text-container" role="button" tabindex="0" title="Toggle glitch effect"><span class="glitchy-text-base">${match}</span><span class="glitchy-text-overlay">${glitchOverlay}</span></span>`;
        });
        
        // Restore placeholders (full "Olivia Colomar" replacements)
        placeholders.forEach((replacement, index) => {
            processedText = processedText.replace(`__GLITCH_FULL_${index}__`, replacement);
        });
        
        // Convert newlines to <br> tags after glitch processing
        processedText = processedText.replace(/\n/g, '<br>');
        
        return processedText;
    }

    /**
     * Helper function for backward compatibility (event names)
     * @param {string} eventName - Event name to process
     * @returns {string} HTML with glitchy text overlay effect
     */
    getDisplayEventName(eventName) {
        return this.getDisplayText(eventName);
    }

    /**
     * Check if glitch is enabled
     * @returns {boolean} True if glitch is enabled
     */
    isEnabled() {
        return this.glitchEnabled;
    }

    /**
     * Set glitch enabled state
     * @param {boolean} enabled - Whether glitch should be enabled
     */
    setEnabled(enabled) {
        this.glitchEnabled = enabled;
    }

    /**
     * Toggle glitch enabled state
     * @returns {boolean} New enabled state
     */
    toggle() {
        this.glitchEnabled = !this.glitchEnabled;
        return this.glitchEnabled;
    }

    /**
     * Start glitch animation
     * Updates glitch characters every 100ms
     */
    startAnimation() {
        // Clear any existing interval
        if (this.glitchInterval) {
            clearInterval(this.glitchInterval);
        }
        
        // Update glitch characters every 100ms
        this.glitchInterval = setInterval(() => {
            const overlays = document.querySelectorAll('.glitchy-text-overlay');
            overlays.forEach(overlay => {
                const container = overlay.parentElement;
                if (container && container.querySelector('.glitchy-text-base')) {
                    const baseText = container.querySelector('.glitchy-text-base').textContent;
                    // Generate new random characters - exactly matching the character count of base text
                    const newGlitch = baseText.split('').map(() => this.getRandomGlitchChar()).join('');
                    overlay.textContent = newGlitch;
                    // Ensure overlay doesn't exceed base text width
                    overlay.style.maxWidth = '100%';
                }
            });
        }, 100);
    }

    /**
     * Stop glitch animation
     */
    stopAnimation() {
        if (this.glitchInterval) {
            clearInterval(this.glitchInterval);
            this.glitchInterval = null;
        }
    }

    /**
     * Toggle glitch effect and update UI
     * This method handles the full toggle including UI updates and sound effects
     * @param {Object} options - Optional configuration
     * @param {string} options.titleText - Title text to process (if titleElement not provided)
     * @param {string} options.textText - Text content to process (if textElement not provided)
     * @param {HTMLElement} options.titleElement - Title element to update (will use textContent)
     * @param {HTMLElement} options.textElement - Text element to update (will use textContent)
     * @param {HTMLElement} options.toggleButton - Toggle button element
     * @param {Function} options.onToggle - Callback when toggled (receives newState, oldState)
     */
    toggleEffect(options = {}) {
        const wasEnabled = this.glitchEnabled;
        this.glitchEnabled = !this.glitchEnabled;
        
        const { titleElement, textElement, titleText, textText, toggleButton, onToggle } = options;
        
        // Play appropriate hack sound when toggling glitch effect
        if (window.SoundEffectsManager && window.SoundEffectsManager.play) {
            try {
                if (this.glitchEnabled) {
                    // Toggling ON
                    console.log('Playing hackOn sound (toggle)');
                    window.SoundEffectsManager.play('hackOn', {
                        playbackRate: 1.2, // Speed up by 20%
                        fadeOut: true,
                        fadeOutDuration: 500 // 500ms fade out
                    });
                } else {
                    // Toggling OFF
                    console.log('Playing hackOff sound (toggle)');
                    window.SoundEffectsManager.play('hackOff', {
                        playbackRate: 1.2 // Speed up by 20%
                    });
                }
            } catch (e) {
                console.error('Error playing hack sound:', e);
            }
        } else {
            console.warn('SoundEffectsManager not available for toggle');
        }
        
        // Update UI elements if provided
        if (titleElement) {
            const originalText = titleText || titleElement.textContent || '';
            titleElement.innerHTML = this.getDisplayEventName(originalText);
        }
        
        if (textElement) {
            const originalText = textText || textElement.textContent || '';
            textElement.innerHTML = this.getDisplayText(originalText);
        }
        
        if (toggleButton) {
            if (window.EventSlideGlitchHelpers && typeof window.EventSlideGlitchHelpers.applyGlitchToggleButtonState === 'function') {
                window.EventSlideGlitchHelpers.applyGlitchToggleButtonState(toggleButton, this.glitchEnabled);
            } else {
                toggleButton.textContent = this.glitchEnabled ? 'Disable Glitch' : 'Enable Glitch';
            }
        }
        
        // Start or stop animation
        if (this.glitchEnabled) {
            this.startAnimation();
        } else {
            this.stopAnimation();
        }
        
        // Call optional callback
        if (onToggle && typeof onToggle === 'function') {
            onToggle(this.glitchEnabled, wasEnabled);
        }
        
        return this.glitchEnabled;
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlitchTextService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.GlitchTextService = new GlitchTextService();
}
