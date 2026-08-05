#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Find wiki skin-specific interactions, tag Atlas conversations "Skin Specific",
 * and fill skinChoices (mirrors Map Exclusive / mapChoices).
 *
 * Sources:
 *  - Interactions headers: "With X Wearing [[Skin]]..."
 *  - Skin-Specific section multi-hero dialogues (Starwatch / aliased speakers)
 *    with current {{rl|m|Name}} / {{rl|l|Name}} skin column context
 *
 * Usage:
 *   node scripts/tag-skin-specific-interactions.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');
const OUT_JSON = auditPath('_audit-skin-specific.json');
const OUT_CSV = auditPath('_audit-skin-specific.csv');

const SKIN_TAG = 'Skin Specific';

const WIKI_CACHE_FILES = {
    Ana: 'Ana.wikitext',
    Anran: 'Anran.wikitext',
    Ashe: 'Ashe.wikitext',
    Baptiste: 'Baptiste.wikitext',
    Bastion: 'Bastion.wikitext',
    Brigitte: 'Brigitte.wikitext',
    Cassidy: 'Cassidy.wikitext',
    'D.Va': 'D.Va.wikitext',
    Domina: 'Domina.wikitext',
    Doomfist: 'Doomfist.wikitext',
    Echo: 'Echo.wikitext',
    Emre: 'Emre.wikitext',
    Freja: 'Freja.wikitext',
    Genji: 'Genji.wikitext',
    Hanzo: 'Hanzo.wikitext',
    Hazard: 'Hazard.wikitext',
    Illari: 'Illari.wikitext',
    'Junker Queen': 'Junker_Queen.wikitext',
    Junkrat: 'Junkrat.wikitext',
    Juno: 'Juno.wikitext',
    Kiriko: 'Kiriko.wikitext',
    Lifeweaver: 'Lifeweaver.wikitext',
    Lúcio: 'Lúcio.wikitext',
    Mauga: 'Mauga.wikitext',
    Mei: 'Mei.wikitext',
    Mercy: 'Mercy.wikitext',
    Mizuki: 'Mizuki.wikitext',
    Moira: 'Moira.wikitext',
    Orisa: 'Orisa.wikitext',
    Pharah: 'Pharah.wikitext',
    Ramattra: 'Ramattra.wikitext',
    Reaper: 'Reaper.wikitext',
    Reinhardt: 'Reinhardt.wikitext',
    Roadhog: 'Roadhog.wikitext',
    Shion: 'Shion.wikitext',
    Sierra: 'Sierra.wikitext',
    Sigma: 'Sigma.wikitext',
    Sojourn: 'Sojourn.wikitext',
    'Soldier 76': 'Soldier__76.wikitext',
    Sombra: 'Sombra.wikitext',
    Symmetra: 'Symmetra.wikitext',
    Torbjörn: 'Torbjörn.wikitext',
    Tracer: 'Tracer.wikitext',
    Vendetta: 'Vendetta.wikitext',
    Venture: 'Venture.wikitext',
    Widowmaker: 'Widowmaker.wikitext',
    Winston: 'Winston.wikitext',
    'Wrecking Ball': 'Wrecking_Ball.wikitext',
    Wuyang: 'Wuyang.wikitext',
    Zarya: 'Zarya.wikitext',
    Zenyatta: 'Zenyatta.wikitext',
};

const HERO_NAMES = Object.keys(WIKI_CACHE_FILES);

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
        .replace(/\bcap['']?n\b/g, 'captain')
        .replace(/[^a-z0-9]+/g, '');
}

function normalizeHero(name) {
    return String(name || '')
        .trim()
        .replace(/^Soldier:\s*/i, 'Soldier ')
        .replace(/^Soldier_+\s*/i, 'Soldier ')
        .replace(/\s+/g, ' ');
}

function cleanWikiText(raw) {
    return String(raw || '')
        .replace(/\{\{[^}]+\}\}/g, ' ')
        .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
        .replace(/\[\[([^\]]+)\]\]/g, '$1')
        .replace(/'''?/g, '')
        .replace(/''/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Resolve wiki speaker label to a roster hero (strip aliases / titles). */
function resolveSpeakerHero(rawLabel) {
    let label = String(rawLabel || '').trim().replace(/:$/, '');
    // "Space Prince" Lúcio / "Intergalactic Smuggler" Ashe
    const quoted = label.match(/^["“][^"”]+["”]\s+(.+)$/);
    if (quoted) label = quoted[1].trim();
    // Emperor Sigma / Infinite Captain Brigitte / Infinite Guard Soldier
    label = label
        .replace(/^Emperor\s+/i, '')
        .replace(/^Infinite\s+(Annihilator|Captain|Seer|Admiral|Guard)\s+/i, '')
        .replace(/^Infinite\s+/i, '');
    // Infinite Annihilator Bastion
    label = label.replace(/^(Annihilator|Captain|Seer|Admiral|Guard|Bonebreaker|Starship Engineer|Asteroid|Intergalactic Smuggler)\s+/i, '');
    label = normalizeHero(label);
    // Fuzzy against roster
    const key = label.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');
    for (const hero of HERO_NAMES) {
        const hk = hero.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');
        if (hk === key || key.endsWith(hk) || hk.endsWith(key)) return hero;
    }
    if (/^soldier/i.test(label)) return 'Soldier 76';
    if (/^wrecking/i.test(label)) return 'Wrecking Ball';
    if (/^junker/i.test(label)) return 'Junker Queen';
    return label;
}

function extractSkinsFromWearingHeader(trimmed) {
    if (!/wearing/i.test(trimmed) && !(/\bskin\b/i.test(trimmed) && /with\b/i.test(trimmed))) {
        return null;
    }
    if (/^\*+\s*'''/.test(trimmed)) return null;
    const skins = [];
    // [[Page|Display]] prefer display; [[Page]] use page leaf
    for (const m of trimmed.matchAll(/\[\[([^|\]]+)\|([^\]]+)\]\]/g)) {
        skins.push(m[2].trim());
    }
    for (const m of trimmed.matchAll(/\[\[([^|\]]+)\]\]/g)) {
        const title = m[1].trim();
        // skip if already captured as pipe target context — crude: if plain link
        if (/cosmetics/i.test(title)) {
            const leaf = title.split(/[/|]/).pop();
            if (leaf) skins.push(leaf);
        } else if (!/challenge/i.test(title) || /bastet/i.test(title)) {
            // Bastet challenge link often display Bastet
            const leaf = title.split(/[/|]/).pop();
            if (leaf && !skins.includes(leaf)) skins.push(leaf);
        }
    }
    // Plain "or Spiritwarder Skin"
    const plain = cleanWikiText(trimmed);
    const spirit = plain.match(/\bor\s+([A-Za-z][A-Za-z0-9 .'-]+?)\s+[Ss]kin\b/);
    if (spirit) {
        const name = spirit[1].replace(/\s+or$/i, '').trim();
        if (name && !/wearing|with/i.test(name)) skins.push(name);
    }
    // "Spiritwarder Skin" without or
    for (const m of plain.matchAll(/\b([A-Z][A-Za-z0-9 .'-]+?)\s+[Ss]kin\b/g)) {
        const name = m[1].replace(/^(or|and|with|wearing)\s+/i, '').trim();
        if (name.length > 1 && !/ana|hero|this|that|enemy|divine/i.test(name)) {
            if (!skins.some((s) => s.toLowerCase() === name.toLowerCase())) skins.push(name);
        }
    }
    const filtered = [...new Set(skins.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean))];
    // Drop noise
    return filtered.filter((s) => !/^(overwatch|talon|skin)$/i.test(s));
}

function extractRlSkins(cellText) {
    const skins = [];
    for (const m of String(cellText || '').matchAll(/\{\{rl\|[ml]\|([^}]+)\}\}/gi)) {
        skins.push(m[1].trim());
    }
    // File:Hero Skin Name.png fallback
    for (const m of String(cellText || '').matchAll(/\[\[File:[^\]]*?Skin\s+([^|\]]+?)\.(?:png|jpg)/gi)) {
        const name = m[1].trim();
        if (name && !skins.includes(name)) skins.push(name);
    }
    return skins;
}

function splitSections(wikitext) {
    const sections = String(wikitext || '').split(/\n(?=={2}\s*[^=].*?={2}\s*$)/m);
    const out = [];
    for (const part of sections) {
        const match = part.match(/^={2}\s*([^=]+?)\s*={2}\s*\n?([\s\S]*)$/);
        if (!match) continue;
        out.push({ title: match[1].trim(), body: match[2] || '' });
    }
    return out;
}

/**
 * Parse Interactions body for wearing/skin headers + dialogue exchanges.
 */
function parseInteractionsSkinExchanges(body, pageHero) {
    const exchanges = [];
    let current = [];
    /** @type {string[]} */
    let currentSkins = [];
    let skinSlots = 0;

    const flush = () => {
        if (current.length < 2) {
            current = [];
            return;
        }
        const speakers = [...new Set(current.map((l) => l.hero))];
        if (speakers.length < 2 || current.length > 12) {
            current = [];
            return;
        }
        const keys = current.map((l) => coreKey(l.text)).filter((k) => k.length >= 8);
        if (currentSkins.length) {
            exchanges.push({
                pageHero,
                source: 'interactions-wearing',
                skins: [...currentSkins],
                speakers,
                lines: current,
                keys,
                preview: current.map((l) => `${l.hero}: ${l.text}`).join(' / '),
            });
        }
        if (skinSlots > 0) {
            skinSlots -= 1;
            if (skinSlots <= 0) currentSkins = [];
        } else {
            currentSkins = [];
        }
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
        }
        if (trimmed.startsWith('|') || /<center>/i.test(trimmed) || /\(only with/i.test(trimmed)) {
            const skins = extractSkinsFromWearingHeader(trimmed);
            if (skins && skins.length) {
                const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                skinSlots = rowspan ? Number(rowspan[1]) : 1;
                currentSkins = skins;
            }
            if (!/^\*+\s*'''/.test(trimmed) && !trimmed.startsWith('*')) continue;
        }
        // Dialogue: *'''Hero''': text   or *'''Hero:''' text
        const m =
            rawLine.match(/^\*+\s*'''([^']+?)'''\s*:?\s*(.+)$/) ||
            rawLine.match(/^\*+\s*'''([^']+?):'''\s*(.+)$/);
        if (!m) continue;
        const text = cleanWikiText(m[2]);
        if (!text || text.length < 3) continue;
        const hero = resolveSpeakerHero(m[1]);
        current.push({ hero, text, rawSpeaker: m[1].trim() });
    }
    flush();
    return exchanges;
}

/**
 * Parse Skin-Specific section: track active skins from rl templates; capture multi-hero dialogues.
 */
function parseSkinSpecificExchanges(body, pageHero) {
    const exchanges = [];
    let current = [];
    /** @type {string[]} */
    let activeSkins = [];
    let skinSlotsRemaining = 0;

    const flush = () => {
        if (current.length < 2) {
            current = [];
            return;
        }
        const speakers = [...new Set(current.map((l) => l.hero))];
        if (speakers.length < 2 || current.length > 12) {
            current = [];
            return;
        }
        const keys = current.map((l) => coreKey(l.text)).filter((k) => k.length >= 8);
        const skins = activeSkins.length ? [...activeSkins] : [];
        exchanges.push({
            pageHero,
            source: 'skin-specific-section',
            skins,
            speakers,
            lines: current,
            keys,
            preview: current.map((l) => `${l.rawSpeaker || l.hero}: ${l.text}`).join(' / '),
        });
        if (skinSlotsRemaining > 0) {
            skinSlotsRemaining -= 1;
            // don't clear skins mid-rowspan group — skins stay until new skin cell
        }
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
        }

        // New skin column cell
        const rlSkins = extractRlSkins(trimmed);
        if (rlSkins.length && (trimmed.startsWith('|') || /\[\[File:/i.test(trimmed) || /\{\{rl\|/i.test(trimmed))) {
            // Only treat as skin switch if it's a table cell-ish line (not dialogue)
            if (!/^\*+\s*'''/.test(trimmed)) {
                const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                skinSlotsRemaining = rowspan ? Number(rowspan[1]) : Math.max(skinSlotsRemaining, 1);
                activeSkins = rlSkins;
            }
        }

        // Note lines like (only with Ana wearing...)
        if (/\(only with/i.test(trimmed) && /wearing|skin/i.test(trimmed)) {
            const skins = extractSkinsFromWearingHeader(trimmed);
            if (skins?.length) activeSkins = skins;
        }

        const m =
            rawLine.match(/^\*+\s*'''([^']+?)'''\s*:?\s*(.+)$/) ||
            rawLine.match(/^\*+\s*'''([^']+?):'''\s*(.+)$/);
        if (!m) continue;
        const text = cleanWikiText(m[2]);
        if (!text || text.length < 3) continue;
        // Skip if this looks like a single-line quote table without real multi dialogue — still collect
        const hero = resolveSpeakerHero(m[1]);
        current.push({ hero, text, rawSpeaker: m[1].trim().replace(/:$/, '') });
    }
    flush();
    return exchanges;
}

function conversationLineKeys(conversation) {
    const rows = [];
    for (const line of conversation.lines || []) {
        const sub = stripDialogueSubtitleMarkup(String(line.subtitles || '')).trim();
        let key = coreKey(sub);
        if (!key || key.length < 6) {
            const voice = String(line.voice || '');
            const idx = voice.indexOf('_-_');
            if (idx >= 0) key = coreKey(voice.slice(idx + 3).replace(/_/g, ' '));
        }
        if (!key || key.length < 6) continue;
        rows.push(key);
    }
    return rows;
}

function scoreExchangeVsConv(exchange, conversation) {
    const convKeys = conversationLineKeys(conversation);
    if (convKeys.length < 2) return 0;
    const exKeys = exchange.keys.filter((k) => k.length >= 10);
    if (exKeys.length < 2) return 0;
    let hits = 0;
    for (const key of exKeys) {
        if (convKeys.includes(key)) {
            hits += 1;
            continue;
        }
        const near = convKeys.some((ck) => {
            const shorter = Math.min(ck.length, key.length);
            if (shorter < 14) return false;
            return (
                ck.startsWith(key) ||
                key.startsWith(ck) ||
                ck.includes(key.slice(0, 18)) ||
                key.includes(ck.slice(0, 18))
            );
        });
        if (near) hits += 1;
    }
    return hits / exKeys.length;
}

function csvEscape(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

// ---- main ----
const data = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const conversations = data.conversations || [];

/** @type {object[]} */
const allExchanges = [];

for (const [pageHero, cacheFile] of Object.entries(WIKI_CACHE_FILES)) {
    const full = path.join(CACHE, cacheFile);
    if (!fs.existsSync(full)) continue;
    const wikitext = fs.readFileSync(full, 'utf8');
    for (const sec of splitSections(wikitext)) {
        if (/^interactions/i.test(sec.title) && !/multi/i.test(sec.title)) {
            allExchanges.push(...parseInteractionsSkinExchanges(sec.body, pageHero));
        }
        if (/^skin-?specific/i.test(sec.title)) {
            allExchanges.push(...parseSkinSpecificExchanges(sec.body, pageHero));
        }
        // Starwatch / aliased skin casts live under Event-Specific on many pages
        if (/^event-?specific/i.test(sec.title)) {
            allExchanges.push(
                ...parseSkinSpecificExchanges(sec.body, pageHero).map((ex) => ({
                    ...ex,
                    source: 'event-specific-section',
                })),
            );
        }
    }
}

/** Map aliased / role speakers onto cosmetic skin names. */
const ALIAS_SKIN_HINTS = [
    { re: /\bemperor\b/i, skins: ['Galactic Emperor'] },
    { re: /\binfinite\s+(annihilator|captain|seer|admiral|guard)\b/i, skins: ['Galactic Emperor'] },
    { re: /space\s*prince/i, skins: ['Space Prince', 'Royal Prince'] },
    { re: /intergalactic\s*smuggler/i, skins: ['Intergalactic Smuggler'] },
    { re: /\bbonebreaker\b/i, skins: ['Bonebreaker'] },
    { re: /starship\s*engineer/i, skins: ['Starship Engineer'] },
    { re: /\basteroid\b/i, skins: ['Asteroid'] },
    { re: /\bbastet\b/i, skins: ['Bastet'] },
    { re: /spiritwarder/i, skins: ['Spiritwarder'] },
];

function skinsFromAliasedSpeakers(exchange) {
    /** @type {Set<string>} */
    const out = new Set(exchange.skins || []);
    for (const line of exchange.lines || []) {
        const raw = String(line.rawSpeaker || '');
        for (const hint of ALIAS_SKIN_HINTS) {
            if (hint.re.test(raw)) {
                for (const s of hint.skins) out.add(s);
            }
        }
    }
    const preview = String(exchange.preview || '');
    if (/starwatch|galactic rescue|infinite empire|space prince/i.test(preview)) {
        if ([...out].some((s) => /emperor|infinite/i.test(s)) === false) {
            // page hero context
            if (/sigma/i.test(exchange.pageHero)) out.add('Galactic Emperor');
            if (/l[uú]cio/i.test(exchange.pageHero)) {
                out.add('Space Prince');
                out.add('Royal Prince');
            }
        }
    }
    return [...out];
}

// Enrich skins from aliases, then keep exchanges that look skin-gated
const enriched = allExchanges.map((ex) => ({
    ...ex,
    skins: skinsFromAliasedSpeakers(ex),
}));

const skinExchanges = enriched.filter((ex) => {
    if (ex.skins?.length) return true;
    return (ex.lines || []).some((l) => {
        const raw = String(l.rawSpeaker || '').replace(/:$/, '');
        return raw && resolveSpeakerHero(raw) !== raw && /["“]|Emperor|Infinite|Prince|Smuggler|Bonebreaker|Asteroid|Starship/i.test(raw);
    });
});

// Drop Junkenstein / generic event chatter that has no skin aliases and no wearing skins
const filteredSkinExchanges = skinExchanges.filter((ex) => {
    if (ex.source === 'interactions-wearing') return true;
    if (ex.skins?.length) return true;
    if (ex.source === 'event-specific-section') {
        // require aliased cast or Starwatch marker
        const blob = `${ex.preview} ${(ex.lines || []).map((l) => l.rawSpeaker).join(' ')}`;
        return /starwatch|emperor|space prince|infinite |bonebreaker|smuggler|asteroid|starship/i.test(blob);
    }
    return ex.skins?.length > 0;
});

// Dedupe
const byFp = new Map();
for (const ex of filteredSkinExchanges) {
    const fp = ex.keys.slice(0, 5).join('|');
    if (!byFp.has(fp)) {
        byFp.set(fp, { ...ex, pages: [ex.pageHero], skins: [...(ex.skins || [])] });
    } else {
        const row = byFp.get(fp);
        if (!row.pages.includes(ex.pageHero)) row.pages.push(ex.pageHero);
        for (const s of ex.skins || []) {
            if (!row.skins.includes(s)) row.skins.push(s);
        }
    }
}
const unique = [...byFp.values()];

const matched = [];
const unmatched = [];
for (const ex of unique) {
    let best = null;
    for (const conv of conversations) {
        const ratio = scoreExchangeVsConv(ex, conv);
        if (ratio >= 0.6 && (!best || ratio > best.ratio)) best = { conv, ratio };
    }
    if (best) {
        matched.push({
            conversationId: best.conv.id,
            conversationName: best.conv.name,
            tags: best.conv.tags || [],
            skins: ex.skins,
            pages: ex.pages,
            source: ex.source,
            ratio: best.ratio,
            preview: ex.preview.slice(0, 220),
        });
    } else {
        unmatched.push({
            skins: ex.skins,
            pages: ex.pages,
            source: ex.source,
            speakers: ex.speakers,
            preview: ex.preview.slice(0, 220),
        });
    }
}

// Tag + fill skinChoices
const byId = new Map(conversations.map((c) => [c.id, c]));
const toTag = new Map();
for (const row of matched) {
    if (!toTag.has(row.conversationId)) {
        toTag.set(row.conversationId, { skins: new Set(row.skins || []), pages: new Set(row.pages) });
    } else {
        const t = toTag.get(row.conversationId);
        for (const s of row.skins || []) t.skins.add(s);
        for (const p of row.pages) t.pages.add(p);
    }
}

// Heuristic: if skins empty but name/preview suggests Starwatch Emperor / Space Prince, fill defaults
function inferSkins(name, skins, preview) {
    if (skins.length) return skins;
    const blob = `${name} ${preview}`.toLowerCase();
    if (/emperor|infinite empire|nebula|defy me|grace of the infinite|might of my empire|gaining ground/.test(blob)) {
        return ['Galactic Emperor'];
    }
    if (/space prince|space rave|automaton was taken|vip pass|front row tickets/.test(blob)) {
        return ['Space Prince', 'Royal Prince'];
    }
    if (/bastet|spiritwarder|jealous/.test(blob)) {
        return ['Bastet', 'Spiritwarder'];
    }
    return skins;
}

let taggedNow = 0;
const tagged = [];
for (const [id, info] of toTag) {
    const c = byId.get(id);
    if (!c) continue;
    if (!Array.isArray(c.tags)) c.tags = ['Overwatch'];
    if (!c.tags.includes(SKIN_TAG)) {
        c.tags.push(SKIN_TAG);
        taggedNow += 1;
    }
    let skins = [...info.skins];
    skins = inferSkins(c.name, skins, matched.find((m) => m.conversationId === id)?.preview || '');
    if (skins.length) c.skinChoices = skins;
    tagged.push({ name: c.name, id: c.id, skins, tags: [...c.tags] });
}

if (!data._meta) data._meta = {};
data._meta.tagsResetAt = new Date().toISOString();

fs.writeFileSync(CONVERSATIONS_PATH, JSON.stringify(data, null, 2) + '\n');

const report = {
    generatedAt: new Date().toISOString(),
    summary: {
        wikiSkinExchangesRaw: filteredSkinExchanges.length,
        wikiSkinExchangesUnique: unique.length,
        matchedToAtlas: matched.length,
        unmatched: unmatched.length,
        conversationsTaggedNow: taggedNow,
        conversationsWithSkinSpecific: tagged.length,
    },
    tagged: tagged.sort((a, b) => a.name.localeCompare(b.name)),
    matched,
    unmatched,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(
    OUT_CSV,
    [
        ['name', 'skins', 'pages', 'source', 'ratio', 'preview'].join(','),
        ...matched.map((r) =>
            [
                csvEscape(r.conversationName),
                csvEscape((r.skins || []).join(' | ')),
                csvEscape((r.pages || []).join(' | ')),
                r.source,
                r.ratio.toFixed(2),
                csvEscape(r.preview),
            ].join(','),
        ),
    ].join('\n') + '\n',
);

console.log('summary', report.summary);
console.log('\nTagged:');
for (const t of tagged) {
    console.log(` - ${t.name} | skins: ${(t.skins || []).join(', ') || '(none)'}`);
}
console.log('\nUnmatched:');
for (const u of unmatched) {
    console.log(` - skins=${(u.skins || []).join(',') || '?'} pages=${u.pages.join(',')} [${u.source}]`);
    console.log(`   ${u.preview}`);
}
console.log(`\nWrote ${OUT_JSON}`);
