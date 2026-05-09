/**
 * ProgressService - Manages progress tracking for component loading
 */
class ProgressService {
    constructor() {
        this.globeComponentsProgress = {
            total: 4, // Globe Base, Transport, Controls, Events
            completed: 0
        };
    }

    updateGlobeComponentsProgress(completed) {
        this.globeComponentsProgress.completed = completed;
        const percentage = (completed / this.globeComponentsProgress.total) * 100;
        const mainBar = document.getElementById('loadingProgressBar');
        if (mainBar) mainBar.style.width = `${percentage}%`;
    }

    resetGlobeComponentsProgress() {
        this.globeComponentsProgress.completed = 0;
        const mainBar = document.getElementById('loadingProgressBar');
        if (mainBar) mainBar.style.width = '0%';
    }
}

// Make available globally
if (typeof window !== 'undefined') {
    window.ProgressService = ProgressService;
}
