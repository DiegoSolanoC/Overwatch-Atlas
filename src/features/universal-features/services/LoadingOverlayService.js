/**
 * LoadingOverlayService - Manages loading overlay show/hide
 */
class LoadingOverlayService {
    constructor() {
        this.isRunOperation = false;
    }

    setRunOperation(value) {
        this.isRunOperation = value;
    }

    show() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '1';
            loadingOverlay.style.visibility = 'visible';
            loadingOverlay.classList.add('active');
            console.log('[Loading Overlay] Showing overlay');
        } else {
            console.warn('[Loading Overlay] Overlay element not found!');
        }
    }

    hide() {
        if (this.isRunOperation) {
            console.log('[Loading Overlay] Skipping hide - run operation in progress');
            return;
        }
        
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.classList.remove('active');
            loadingOverlay.style.opacity = '';
            loadingOverlay.style.visibility = '';
            console.log('[Loading Overlay] Hiding overlay');
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.LoadingOverlayService = LoadingOverlayService;
}
