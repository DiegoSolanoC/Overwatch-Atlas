/**
 * ButtonStateService - Manages button state (loading, loaded, default, error)
 */
class ButtonStateService {
    setState(buttonId, state) {
        const btn = document.getElementById(buttonId);
        if (!btn) return;
        
        btn.classList.remove('loading', 'loaded');
        if (state === 'loading') {
            btn.classList.add('loading');
            btn.disabled = true;
        } else if (state === 'loaded') {
            btn.classList.add('loaded');
            btn.disabled = false;
        } else {
            btn.disabled = false;
        }
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ButtonStateService = ButtonStateService;
}
