/** Inner HTML for the passive now-playing badge (mounted under #musicToggle). */
export const NOW_PLAYING_BADGE_INNER_HTML = `
                <div class="music-now-playing-label">Now playing:</div>
                <div class="music-now-playing-spacer-top" aria-hidden="true"></div>
                <div class="music-now-playing-badge-title-row">
                    <img class="music-playing-disc music-playing-disc--badge" src="src/assets/images/Icons/Music%20Icons/Playing%20Icon.png" alt="" width="36" height="36" decoding="async" />
                    <div class="music-now-playing-song"></div>
                </div>
                <div class="music-now-playing-spacer-bottom" aria-hidden="true"></div>
                <img class="music-now-playing-underline" src="src/assets/images/Misc/UI/Badge%20Underline.png" alt="" aria-hidden="true" />
            `;
