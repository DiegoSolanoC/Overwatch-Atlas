/**
 * MusicNowPlayingBadge — passive "Now playing: <title>" badge under the right
 * header hub (mirrors SummaryInfoBadge under the left hub).
 *
 * DOM mount, overlay sync, and title cross-fade live here. Position math is in
 * `musicNowPlayingBadgePosition.js`; resize/scroll/layout observers in
 * `musicNowPlayingBadgeLayoutWatch.js`.
 */

import {
    BADGE_VISIBLE_CLASS,
    SWAP_OUT_CLASS,
    SWAP_IN_CLASS
} from './musicNowPlayingBadgeCssClasses.js';
import { positionNowPlayingBadge } from './musicNowPlayingBadgePosition.js';
import { startNowPlayingBadgeLayoutWatch } from './musicNowPlayingBadgeLayoutWatch.js';
import { NOW_PLAYING_BADGE_INNER_HTML } from './musicNowPlayingBadgeMarkup.js';

export class MusicNowPlayingBadge {
    constructor() {
        this.badge = null;
        this.textEl = null;
        this._lastText = null;
        this._swapTimeout = null;
        this._swapTimeout2 = null;
        this._followCleanup = null;
        this._eventImageOverlayMo = null;
        this._eventImageOverlaySyncTimer = null;
    }

    _ensureBadgeMounted() {
        if (this.badge && this.textEl) return;
        let badge = document.getElementById('musicNowPlayingBadge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'musicNowPlayingBadge';
            badge.className = 'music-now-playing-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.innerHTML = NOW_PLAYING_BADGE_INNER_HTML;
            document.body.appendChild(badge);
        }
        this.badge = badge;
        this.textEl = badge.querySelector('.music-now-playing-song');
    }

    _isEventImageOverlayOpen() {
        const overlay = document.getElementById('eventImageOverlay');
        return !!(overlay && overlay.classList.contains('open'));
    }

    installEventImageOverlaySync(onRefresh) {
        if (this._eventImageOverlayMo) return;
        const overlay = document.getElementById('eventImageOverlay');
        if (!overlay || typeof MutationObserver === 'undefined') return;
        const scheduleRefresh = () => {
            if (this._eventImageOverlaySyncTimer) clearTimeout(this._eventImageOverlaySyncTimer);
            this._eventImageOverlaySyncTimer = setTimeout(() => {
                this._eventImageOverlaySyncTimer = null;
                if (this._isEventImageOverlayOpen()) return;
                try { onRefresh(); } catch (_) { /* ignore */ }
            }, 0);
        };
        this._eventImageOverlayMo = new MutationObserver(scheduleRefresh);
        this._eventImageOverlayMo.observe(overlay, { attributes: true, attributeFilter: ['class'] });
    }

    _positionBadge() {
        this._ensureBadgeMounted();
        if (!this.badge) return;
        positionNowPlayingBadge(this.badge);
    }

    _stopFollow() {
        try {
            if (this._followCleanup) {
                this._followCleanup();
                this._followCleanup = null;
            }
        } catch (_) { /* ignore */ }
    }

    _startFollow() {
        this._stopFollow();
        this._positionBadge();

        this._followCleanup = startNowPlayingBadgeLayoutWatch({
            getBadge: () => this.badge,
            isEventImageOverlayOpen: () => this._isEventImageOverlayOpen(),
            reposition: () => this._positionBadge(),
            onOverlayBlocksBadge: () => {
                if (this.badge) this.badge.classList.remove(BADGE_VISIBLE_CLASS);
                this._stopFollow();
            }
        });
    }

    ensureMounted() {
        this._ensureBadgeMounted();
    }

    setVisible(visible) {
        this._ensureBadgeMounted();
        if (!this.badge) return;
        if (this._isEventImageOverlayOpen()) {
            this.badge.classList.remove(BADGE_VISIBLE_CLASS);
            this._stopFollow();
            return;
        }
        try {
            if (typeof window !== 'undefined' && window.matchMedia
                && window.matchMedia('(max-width: 768px)').matches) {
                this.badge.classList.remove(BADGE_VISIBLE_CLASS);
                this._stopFollow();
                return;
            }
        } catch (_) { /* ignore */ }
        this.badge.classList.toggle(BADGE_VISIBLE_CLASS, !!visible);
        if (visible) this._startFollow();
        else this._stopFollow();
    }

    setText(nextText) {
        this._ensureBadgeMounted();
        if (!this.badge || !this.textEl) return;
        const textEl = this.textEl;

        try {
            if (this._swapTimeout) clearTimeout(this._swapTimeout);
            if (this._swapTimeout2) clearTimeout(this._swapTimeout2);
        } catch (_) { /* ignore */ }
        this._swapTimeout = null;
        this._swapTimeout2 = null;

        if (!this._lastText) {
            textEl.textContent = nextText;
            textEl.classList.remove(SWAP_OUT_CLASS, SWAP_IN_CLASS);
            this._lastText = nextText;
            return;
        }

        if (nextText === this._lastText) return;

        textEl.classList.remove(SWAP_IN_CLASS);
        textEl.classList.add(SWAP_OUT_CLASS);

        this._swapTimeout = setTimeout(() => {
            textEl.textContent = nextText;
            this._lastText = nextText;
            textEl.classList.remove(SWAP_OUT_CLASS);
            textEl.classList.add(SWAP_IN_CLASS);

            this._swapTimeout2 = setTimeout(() => {
                textEl.classList.remove(SWAP_IN_CLASS);
            }, 220);
        }, 140);
    }
}
