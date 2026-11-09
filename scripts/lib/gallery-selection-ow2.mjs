/**
 * Prefer Overwatch 2 Hero Selected lines for gallery Selection.ogg.
 *
 * Wiki Quotes main page Chatter → '''Hero Selected''' is the live OW2 default.
 * OW1 lines live on /Quotes/Overwatch_1 (and often as the oldest HeroSelect GUID
 * in the datamine). Skin / event Hero Selected lines sit outside Chatter.
 */

/**
 * @param {string} text
 * @returns {string}
 */
export function selectionPhraseKey(text) {
    let s = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\*+/g, ' ');

    // Bastion / Jetpack Cat style: whole phrase is parenthetical.
    const wholeParen = s.trim().match(/^\((.+)\)$/);
    if (wholeParen) {
        s = wholeParen[1];
    } else {
        s = s.replace(/\([^)]*\)/g, ' ');
    }

    return s
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/[^a-z0-9]+/g, '');
}

/**
 * First Chatter → Hero Selected line from a Quotes wikitext page (OW2 default).
 * @param {string} wikitext
 * @returns {{ spoken: string, wikiAudio: string }}
 */
export function extractOw2HeroSelected(wikitext) {
    const sectionMatch = String(wikitext || '').match(
        /(?:^|\n)(={2,3})\s*Chatter\s*\1\s*\n([\s\S]*?)(?=\n={2,3}\s*[^=\n]+\s*={2,3}\s*(?:\n|$)|$)/i,
    );
    if (!sectionMatch) return { spoken: '', wikiAudio: '' };
    const body = sectionMatch[2];
    const rows = body.split(/\n\|-/);
    let heroSelectedActive = false;

    for (const row of rows) {
        const triggerHits = [...row.matchAll(/'''([^']{2,100})'''/g)].map((m) =>
            m[1].replace(/<[^>]+>/g, '').trim(),
        );
        for (const hit of triggerHits) {
            if (/^hero selected$/i.test(hit)) {
                heroSelectedActive = true;
            } else if (
                /during set[- ]?up|set[- ]?up chatter|match start|respawn|health|healed|on fire|nano|perk|voted|reinforcement|negative|discord|hacked|resurrect|ultimate|damage boost|booster/i.test(
                    hit,
                )
            ) {
                heroSelectedActive = false;
            } else if (
                hit.length > 2 &&
                hit.length < 48 &&
                /[A-Za-z]/.test(hit) &&
                !/^(general|won previous|lost previous|final round|minor|major|unused)$/i.test(hit)
            ) {
                if (!/^hero selected$/i.test(hit)) heroSelectedActive = false;
            }
        }

        if (!heroSelectedActive) continue;

        const wikiAudio = row.match(/\{\{Audio\|([^}]+)\}\}/i)?.[1]?.trim() || '';

        for (const line of row.split(/\n/).map((l) => l.trim())) {
            if (!line.startsWith('|')) continue;
            if (/^\|\s*\{\{Audio\|/i.test(line)) continue;
            if (/^\|\s*!/.test(line)) continue;
            const cell = line.replace(/^\|\s*/, '').trim();
            if (!cell) continue;
            if (/rowspan|colspan|<center|<big|'''/i.test(cell)) continue;
            if (cell.startsWith('{') && !/\{\{QuoteTranslation/i.test(cell)) continue;

            let spoken = cell
                .replace(/\{\{QuoteTranslation\|[\s\S]*?\}\}/gi, (m) => {
                    const translation =
                        m.match(/\|\s*translation\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
                    const quote = m.match(/\|\s*quote\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
                    const script = m.match(/\|\s*script\s*=\s*([^|}]+)/i)?.[1]?.trim() || '';
                    if (translation && script) return `(${script}) ${translation}`;
                    return translation || quote || '';
                })
                .replace(/<small>[\s\S]*?<\/small>/gi, ' ')
                .replace(/\{\{[^}]+\}\}/g, ' ')
                .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
                .replace(/\[\[([^\]]+)\]\]/g, '$1')
                .replace(/'{2,}/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            spoken = spoken.replace(/\s*\((with|during|while|if|when|only)[\s\S]*\)\s*$/i, '').trim();
            if (spoken.length < 3) continue;
            if (/^(trigger|quote|hero selected)$/i.test(spoken)) continue;
            return { spoken, wikiAudio };
        }

        // QuoteTranslation-only / audio-only rows: recover label from File: title.
        if (wikiAudio) {
            const fromAudio = wikiAudio
                .replace(/^File:/i, '')
                .replace(/^[^-\n]+-\s*/i, '')
                .replace(/\.ogg$/i, '')
                .trim();
            if (fromAudio.length >= 3) return { spoken: fromAudio, wikiAudio };
        }
    }
    return { spoken: '', wikiAudio: '' };
}

/**
 * @param {string} wikitext
 * @returns {string}
 */
export function extractOw2HeroSelectedSpoken(wikitext) {
    return extractOw2HeroSelected(wikitext).spoken;
}

/**
 * Pick the best Selection.ogg source among phrase paths already on disk.
 * Prefers an exact phrase-key match to the OW2 wiki line; otherwise leaves null
 * so the caller can keep the existing Selection.
 *
 * @param {string[]} candidatePaths — absolute .ogg paths (quote-named files)
 * @param {string} preferredSpoken — OW2 Hero Selected text from wiki
 * @returns {string | null} absolute path to copy from
 */
/**
 * @param {string[]} candidatePaths
 * @param {string} preferredSpoken
 * @param {string} [wikiAudio]
 * @returns {string | null}
 */
export function pickOw2SelectionSource(candidatePaths, preferredSpoken, wikiAudio = '') {
    if (!Array.isArray(candidatePaths) || !candidatePaths.length) return null;

    /** @type {Array<{ path: string, key: string, base: string }>} */
    const rows = [];
    for (const abs of candidatePaths) {
        const base = String(abs || '')
            .replace(/\\/g, '/')
            .split('/')
            .pop() || '';
        if (!base || /^selection(\.|_|\()/i.test(base)) continue;
        const leaf = base.replace(/\.[^.]+$/i, '');
        rows.push({ path: abs, key: selectionPhraseKey(leaf), base: leaf });
    }
    if (!rows.length) return null;

    const audioLeaf = String(wikiAudio || '')
        .replace(/^File:/i, '')
        .replace(/^[^-\n]+-\s*/i, '')
        .replace(/\.ogg$/i, '')
        .trim();
    const wantKeys = [selectionPhraseKey(preferredSpoken), selectionPhraseKey(audioLeaf)].filter(
        Boolean,
    );

    for (const want of wantKeys) {
        const exact = rows.find((r) => r.key === want);
        if (exact) return exact.path;
    }

    // Allow wiki punctuation / that|who drift on long lines.
    for (const want of wantKeys) {
        const soft = rows.find((r) => {
            if (r.key.startsWith(want) || want.startsWith(r.key)) return true;
            if (Math.min(r.key.length, want.length) < 18) return false;
            if (r.key.includes(want) || want.includes(r.key)) return true;
            // Token overlap ≥ 85% for near-matches (Genji that/who, etc.)
            const a = new Set(want.match(/[a-z0-9]{3,}/g) || []);
            const b = new Set(r.key.match(/[a-z0-9]{3,}/g) || []);
            if (!a.size || !b.size) return false;
            let hit = 0;
            for (const t of a) if (b.has(t)) hit += 1;
            return hit / Math.max(a.size, b.size) >= 0.85;
        });
        if (soft) return soft.path;
    }
    return null;
}
