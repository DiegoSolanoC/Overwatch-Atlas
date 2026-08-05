#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
/**
 * Recheck conversations with no MatchTalk (and not yet tagged Removed)
 * against wiki REMOVED markers on ANY involved hero page.
 *
 * Fixes hyperlink display-text stripping so [[Bastet|masked vigilante]] matches.
 *
 * Usage: node scripts/audit-196-wiki-removed-recheck.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripDialogueSubtitleMarkup } from '../src/features/dialogue-theater/data/dialogueSubtitleFormatting.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = WIKI_QUOTES_CACHE_DIR;
const CONVERSATIONS_PATH = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');
const AUDIT_PATH = auditPath('_audit-removed-vs-matchtalk.json');
const OUT_JSON = auditPath('_audit-196-wiki-removed-recheck.json');

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

function coreKey(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[\u2018\u2019\u201C\u201D`']/g, '')
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

function splitInteractionsBody(wikitext) {
    const sections = String(wikitext || '').split(/\n(?=={2}\s*[^=].*?={2}\s*$)/m);
    const bodies = [];
    for (const part of sections) {
        const match = part.match(/^={2}\s*([^=]+?)\s*={2}\s*\n?([\s\S]*)$/);
        if (!match) continue;
        const title = match[1].trim();
        if (/^interactions/i.test(title) && !/multi/i.test(title)) {
            bodies.push({
                title,
                body: match[2] || '',
                forceRemoved: /removed/i.test(title),
            });
        }
    }
    return bodies;
}

function parseExchanges(body, pageHero, forceRemoved = false) {
    const exchanges = [];
    let current = [];
    let removedSlotsRemaining = 0;
    let currentIsRemoved = forceRemoved;

    const flush = () => {
        if (current.length < 2) {
            current = [];
            return;
        }
        const speakers = [...new Set(current.map((l) => l.hero))];
        if (speakers.length < 2 || current.length > 10 || speakers.length > 4) {
            current = [];
            return;
        }
        const texts = current.map((l) => l.text.toLowerCase()).join(' ');
        if (texts.includes('favorite animal')) {
            current = [];
            return;
        }
        const keys = current.map((l) => coreKey(l.text)).filter((k) => k.length >= 8);
        exchanges.push({
            pageHero,
            removed: forceRemoved || currentIsRemoved,
            speakers,
            lines: current,
            keys,
            preview: current.map((l) => `${l.hero}: ${l.text}`).join(' / '),
        });
        if (!forceRemoved && currentIsRemoved) {
            if (removedSlotsRemaining > 0) {
                removedSlotsRemaining -= 1;
                if (removedSlotsRemaining <= 0) currentIsRemoved = false;
            } else {
                currentIsRemoved = false;
            }
        }
        current = [];
    };

    for (const rawLine of String(body || '').split(/\n/)) {
        const trimmed = rawLine.trim();
        if (trimmed === '|-' || trimmed === '|}') {
            flush();
            continue;
        }

        if (
            /removed/i.test(trimmed) &&
            !/removed set-up chatter/i.test(trimmed) &&
            !/armor pack/i.test(trimmed) &&
            !/seismic slam/i.test(trimmed)
        ) {
            const isHeaderCell =
                trimmed.startsWith('|') ||
                /<center>/i.test(trimmed) ||
                /'{3,}REMOVED'{3,}/i.test(trimmed) ||
                /'{3,}Removed'{3,}/i.test(trimmed);
            const isDialogue = /^\*+\s*'''/.test(trimmed);
            if (isHeaderCell && !isDialogue) {
                const rowspan = trimmed.match(/rowspan\s*=\s*"?(\d+)"?/i);
                removedSlotsRemaining = rowspan ? Number(rowspan[1]) : Math.max(removedSlotsRemaining, 1);
                currentIsRemoved = true;
                continue;
            }
        }

        const m = rawLine.match(/^\*+\s*'''([^']+?)'''\s*:?\s*(.+)$/);
        if (!m) continue;
        const text = cleanWikiText(m[2]);
        if (!text || text.length < 3) continue;
        const hero = normalizeHero(m[1].trim().replace(/:$/, ''));
        current.push({ hero, text });
    }
    flush();
    return exchanges;
}

function conversationLineKeys(conversation) {
    const rows = [];
    for (const line of conversation.lines || []) {
        const hero = normalizeHero(line.hero);
        const sub = stripDialogueSubtitleMarkup(String(line.subtitles || '')).trim();
        let key = coreKey(sub);
        if (!key || key.length < 6) {
            const voice = String(line.voice || '');
            const idx = voice.indexOf('_-_');
            if (idx >= 0) key = coreKey(voice.slice(idx + 3).replace(/_/g, ' '));
        }
        if (!key || key.length < 6) continue;
        if (key.length < 8 && /^(beep|sigh|laugh|chuckle|nod)/i.test(sub)) continue;
        rows.push({ hero, key, subtitles: sub });
    }
    return rows;
}

function scoreExchangeVsConv(exchange, conversation) {
    const lines = conversationLineKeys(conversation);
    if (lines.length < 2) return 0;
    const convKeys = [...new Set(lines.map((l) => l.key))];
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

const CONVERSATIONS = JSON.parse(fs.readFileSync(CONVERSATIONS_PATH, 'utf8'));
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));

const allExchanges = [];
for (const [pageHero, cacheFile] of Object.entries(WIKI_CACHE_FILES)) {
    const full = path.join(CACHE, cacheFile);
    if (!fs.existsSync(full)) continue;
    const wikitext = fs.readFileSync(full, 'utf8');
    for (const sec of splitInteractionsBody(wikitext)) {
        allExchanges.push(...parseExchanges(sec.body, pageHero, sec.forceRemoved));
    }
}
const removedExchanges = allExchanges.filter((e) => e.removed);

const remFp = new Map();
for (const e of removedExchanges) {
    const fp = e.keys.slice(0, 4).join('|');
    if (!remFp.has(fp)) remFp.set(fp, []);
    remFp.get(fp).push(e);
}

const byId = new Map(CONVERSATIONS.conversations.map((c) => [c.id, c]));
const candidates = audit.noMatchTalkNotWikiRemoved
    .map((r) => byId.get(r.conversationId))
    .filter(Boolean)
    .filter((c) => !(c.tags || []).includes('Removed'));

const hits = [];
for (const conv of candidates) {
    const pagesRemoved = [];
    const pagesLive = [];
    for (const ex of allExchanges) {
        const ratio = scoreExchangeVsConv(ex, conv);
        if (ratio < 0.6) continue;
        if (ex.removed) {
            pagesRemoved.push({ page: ex.pageHero, ratio, preview: ex.preview.slice(0, 160) });
        } else {
            pagesLive.push({ page: ex.pageHero, ratio });
        }
    }
    if (pagesRemoved.length) {
        hits.push({
            id: conv.id,
            name: conv.name,
            tags: conv.tags,
            speakers: [...new Set((conv.lines || []).map((l) => l.hero))],
            removedOn: [...new Set(pagesRemoved.map((p) => p.page))],
            liveOn: [...new Set(pagesLive.filter((p) => p.ratio >= 0.6).map((p) => p.page))],
            bestRatio: Math.max(...pagesRemoved.map((p) => p.ratio)),
            preview: pagesRemoved.sort((a, b) => b.ratio - a.ratio)[0].preview,
        });
    }
}
hits.sort((a, b) => a.name.localeCompare(b.name));

const allConvs = CONVERSATIONS.conversations;
const wikiToAtlas = [];
for (const [, group] of remFp) {
    const ex = group[0];
    const pages = [...new Set(group.map((g) => g.pageHero))];
    let best = null;
    for (const conv of allConvs) {
        const ratio = scoreExchangeVsConv(ex, conv);
        if (ratio >= 0.6 && (!best || ratio > best.ratio)) best = { conv, ratio };
    }
    wikiToAtlas.push({
        pages,
        speakers: ex.speakers,
        preview: ex.preview.slice(0, 180),
        atlasName: best?.conv.name || null,
        atlasId: best?.conv.id || null,
        atlasTags: best?.conv.tags || [],
        ratio: best?.ratio || 0,
        alreadyTaggedRemoved: best ? (best.conv.tags || []).includes('Removed') : false,
    });
}
wikiToAtlas.sort((a, b) => (a.atlasName || 'zzz').localeCompare(b.atlasName || 'zzz'));

const unmatchedWikiRemoved = wikiToAtlas.filter((r) => !r.atlasName);
const matchedButNotTagged = wikiToAtlas.filter((r) => r.atlasName && !r.alreadyTaggedRemoved);
const conflicted = hits.filter((h) => h.liveOn.length > 0);

const report = {
    generatedAt: new Date().toISOString(),
    summary: {
        wikiRemovedRaw: removedExchanges.length,
        wikiRemovedUnique: remFp.size,
        candidatesNoMtNotTagged: candidates.length,
        hitsAmongCandidates: hits.length,
        conflictsRemovedOnOneLiveOnAnother: conflicted.length,
        wikiRemovedMatchedButNotTagged: matchedButNotTagged.length,
        wikiRemovedUnmatchedToAtlas: unmatchedWikiRemoved.length,
    },
    hitsAmong196: hits,
    conflicted,
    matchedButNotTagged,
    unmatchedWikiRemoved,
    allWikiRemovedToAtlas: wikiToAtlas,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2) + '\n');

console.log('summary', report.summary);
console.log('\n=== Among remaining no-MatchTalk: wiki REMOVED on ≥1 page ===');
if (!hits.length) console.log('(none)');
for (const h of hits) {
    console.log(`\n- ${h.name}`);
    console.log(`  speakers: ${h.speakers.join(' + ')}`);
    console.log(`  REMOVED on: ${h.removedOn.join(', ')}`);
    console.log(`  also LIVE on: ${h.liveOn.length ? h.liveOn.join(', ') : '(none)'}`);
    console.log(`  ratio=${h.bestRatio.toFixed(2)} | ${h.preview}`);
}

console.log('\n=== Wiki REMOVED matched to Atlas but NOT yet tagged Removed ===');
if (!matchedButNotTagged.length) console.log('(none)');
for (const r of matchedButNotTagged) {
    console.log(`\n- Atlas: ${r.atlasName} [${r.atlasTags.join(', ')}] @${r.ratio.toFixed(2)}`);
    console.log(`  wiki pages: ${r.pages.join(', ')}`);
    console.log(`  ${r.preview}`);
}

console.log('\n=== Wiki REMOVED with no Atlas match ===');
if (!unmatchedWikiRemoved.length) console.log('(none)');
for (const r of unmatchedWikiRemoved) {
    console.log(`\n- pages: ${r.pages.join(', ')} | speakers: ${r.speakers.join(' + ')}`);
    console.log(`  ${r.preview}`);
}

console.log(`\nWrote ${OUT_JSON}`);
