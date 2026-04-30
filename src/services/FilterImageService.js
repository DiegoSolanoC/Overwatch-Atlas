/**
 * FilterImageService - Handles image loading, preloading, and path construction for filters
 * Extracted from FilterService to follow Single Responsibility Principle
 */

// Constants for image loading behavior
const IMAGE_LOADING = {
    BATCH_SIZE: 5,
    DELAY_BETWEEN_BATCHES_MS: 100,
    RETRY_DELAY_MS: 500,
    RETRY_DELAY_SHORT_MS: 300
};

// Image folder paths
const IMAGE_PATHS = {
    HEROES: 'assets/images/heroes',
    FACTIONS: 'assets/images/factions',
    MUSIC: 'assets/images/music'
};

class FilterImageService {
    /**
     * Generate cache buster string
     */
    generateCacheBuster() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Construct image path based on filter type
     */
    buildImagePath(item, type, folder) {
        if (type === 'factions') {
            const encodedFilename = encodeURIComponent(item.filename);
            return `${folder}/${encodedFilename}.png`;
        } else if (type === 'countries') {
            const fn = (item && item.flagFile != null) ? String(item.flagFile).trim() : '';
            if (!fn) return `${folder}/`;
            const segs = fn.split('/').map((s) => encodeURIComponent(s));
            return `${folder}/${segs.join('/')}`;
        } else if (type === 'music') {
            const iconName = item.filename.replace(/\.(mp3|wav|ogg)$/i, '');
            const encodedIconName = encodeURIComponent(iconName);
            return `${IMAGE_PATHS.MUSIC}/${encodedIconName}.png`;
        } else {
            // heroes
            const encodedHeroName = encodeURIComponent(item);
            return `${folder}/${encodedHeroName}.png`;
        }
    }
    
    /**
     * Create image element with error handling and retry logic
     */
    createImageElement(imagePath, type, filterKey, folder) {
        const img = new Image();
        const cacheBuster = this.generateCacheBuster();
        img.src = `${imagePath}?v=${cacheBuster}`;
        img.alt = filterKey;
        
        img.onerror = this.createErrorHandler(img, imagePath, type, filterKey, folder, cacheBuster);
        
        return img;
    }
    
    /**
     * Create error handler for image loading with retry logic
     */
    createErrorHandler(img, imagePath, type, filterKey, folder, originalCacheBuster) {
        return () => {
            // First retry with new cache buster
            const retryDelay = IMAGE_LOADING.RETRY_DELAY_SHORT_MS;
            const retryCacheBuster = this.generateCacheBuster();
            
            setTimeout(() => {
                if (type === 'music') {
                    const iconName = filterKey.replace(/\.(mp3|wav|ogg)$/i, '');
                    const encodedIconName = encodeURIComponent(iconName);
                    img.src = `${IMAGE_PATHS.MUSIC}/${encodedIconName}.png?v=${retryCacheBuster}`;
                } else if (type === 'countries') {
                    const raw = String(filterKey || '').startsWith('country:')
                        ? String(filterKey).slice('country:'.length).trim()
                        : String(filterKey || '').trim();
                    const segs = raw.split('/').map((s) => encodeURIComponent(s));
                    img.src = `${folder}/${segs.join('/')}?v=${retryCacheBuster}`;
                } else if (type === 'factions') {
                    const encodedFilename = encodeURIComponent(filterKey);
                    img.src = `${folder}/${encodedFilename}.png?v=${retryCacheBuster}`;
                } else {
                    // heroes
                    const encodedHeroName = encodeURIComponent(filterKey);
                    img.src = `${folder}/${encodedHeroName}.png?v=${retryCacheBuster}`;
                }
            }, retryDelay);
            
            // If still fails, try alternative encoding
            img.addEventListener('error', () => {
                this.handleImageLoadFailure(img, imagePath, type, filterKey, folder);
            }, { once: true });
        };
    }
    
    /**
     * Handle final image load failure - try alternative encoding or show placeholder
     */
    handleImageLoadFailure(img, imagePath, type, filterKey, folder) {
        console.warn(`[DEBUG] Filter image failed to load: ${img.src} (type: ${type}, filterKey: ${filterKey})`);
        
        // Try alternative encoding (space replacement)
        const altEncoded = filterKey.replace(/\s+/g, '%20');
        const altCacheBuster = this.generateCacheBuster();
        
        let altPath;
        if (type === 'music') {
            const iconName = filterKey.replace(/\.(mp3|wav|ogg)$/i, '');
            altPath = `${IMAGE_PATHS.MUSIC}/${iconName.replace(/\s+/g, '%20')}.png?v=${altCacheBuster}`;
        } else if (type === 'countries') {
            const raw = String(filterKey || '').startsWith('country:')
                ? String(filterKey).slice('country:'.length).trim()
                : String(filterKey || '').trim();
            const segs = raw.split('/').map((s) => encodeURIComponent(s.replace(/\s+/g, '%20')));
            altPath = `${folder}/${segs.join('/')}?v=${altCacheBuster}`;
        } else {
            altPath = `${folder}/${altEncoded}.png?v=${altCacheBuster}`;
        }
        
        if (img.src !== altPath) {
            img.src = altPath;
            return;
        }
        
        // Final fallback: hide image but show placeholder
        console.error(`[DEBUG] Filter image failed to load after retries: ${img.src}`);
        img.style.display = 'none';
        if (img.parentElement) {
            img.parentElement.style.background = 'rgba(255, 0, 0, 0.3)'; // Red tint for missing image
        }
    }
    
    /**
     * Preload images in batches to avoid overwhelming the server
     */
    preloadImages(items, type, folder) {
        const batchSize = IMAGE_LOADING.BATCH_SIZE;
        const delayBetweenBatches = IMAGE_LOADING.DELAY_BETWEEN_BATCHES_MS;
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            setTimeout(() => {
                batch.forEach(item => {
                    const imagePath = this.buildImagePath(item, type, folder);
                    const img = new Image();
                    const cacheBuster = this.generateCacheBuster();
                    img.src = `${imagePath}?v=${cacheBuster}`;
                    
                    // Simple retry on error
                    img.onerror = function() {
                        setTimeout(() => {
                            const retryCacheBuster = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                            this.src = `${imagePath}?v=${retryCacheBuster}`;
                        }, IMAGE_LOADING.RETRY_DELAY_MS);
                    };
                });
            }, (i / batchSize) * delayBetweenBatches);
        }
    }
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FilterImageService;
}

// Make globally accessible for non-module usage
if (typeof window !== 'undefined') {
    window.FilterImageService = FilterImageService;
}
