/**
 * syncNowPlayingUi — keeps the panel "Now playing" row and the passive
 * header badge in sync with whatever's currently playing. Called by
 * `MusicService.updateNowPlaying()` on every song / mode change.
 */

import { isAmbientPath, isStartupThemePath } from '../musicPaletteThemes.js';
import { updatePlayingDiscSpinning } from './musicPlayingDiscSpinSync.js';

/** @param {import('../MusicService.js').MusicService} service */
export function getCatalogSongDisplayName(service) {
    if (!service.currentSong) return 'No song playing';
    const s = service.musicFiles.find((e) => service.currentSong && service.currentSong.endsWith('/' + e.filename));
    return s ? s.name : 'Unknown';
}

/** @param {import('../MusicService.js').MusicService} service */
export function syncNowPlayingUi(service) {
    const path = service.currentSong;
    const hideTrackTitle = !!(path && (isStartupThemePath(path) || isAmbientPath(path)));

    const el = document.getElementById('musicCurrentSong');
    const npRow = document.getElementById('musicNowPlaying');
    if (npRow) npRow.classList.toggle('music-now-playing--hide-track-title', hideTrackTitle);

    const name = hideTrackTitle ? '' : getCatalogSongDisplayName(service);
    if (el) el.textContent = name;

    const panelOpen = !!(service.musicPanel
        && service.musicPanel.classList.contains('open')
        && (service.musicPanel.dataset.panelMode === 'music' || service.musicPanel.id === 'musicPanel'));
    const shouldShow = !!(path && !panelOpen && !hideTrackTitle);
    service.nowPlayingBadge.setVisible(shouldShow);
    if (shouldShow) service.nowPlayingBadge.setText(name);
    updatePlayingDiscSpinning(service.backgroundMusic, service.currentSong);
}
