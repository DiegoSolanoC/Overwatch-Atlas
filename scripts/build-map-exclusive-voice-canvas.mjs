#!/usr/bin/env node
import { auditPath, ensureAuditWorkspace, WIKI_QUOTES_CACHE_DIR } from './lib/auditWorkspace.mjs';
ensureAuditWorkspace();
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONVERSATIONS = path.join(__dirname, '../src/data/dialogue-theater/conversations.json');
const MAP_AUDIT = auditPath('_audit-map-exclusive.json');
const OUT = path.join(
    process.env.USERPROFILE || '',
    '.cursor',
    'projects',
    'c-Users-diego-OneDrive-Escritorio-Projects-Overwatch-Atlas',
    'canvases',
    'map-exclusive-and-voice-buckets.canvas.tsx',
);

const data = JSON.parse(fs.readFileSync(CONVERSATIONS, 'utf8'));
const mapAudit = JSON.parse(fs.readFileSync(MAP_AUDIT, 'utf8'));
const buckets = data._meta?.voiceAuditBuckets || {};

const mapExclusive = data.conversations
    .filter((c) => (c.tags || []).includes('Map Exclusive'))
    .map((c) => ({
        name: c.name,
        tags: (c.tags || []).filter((t) => t !== 'Overwatch'),
        maps: (mapAudit.matched || []).find((m) => m.conversationId === c.id)?.maps
            || (mapAudit.tagged || []).find((m) => m.id === c.id)?.maps
            || [],
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

// Enrich maps from matched list
const mapsByName = new Map();
for (const row of mapAudit.matched || []) {
    mapsByName.set(row.conversationName, row.maps || []);
}
mapsByName.set('Hating the Beach', ['Esperança', 'Ilios', 'Samoa']);
for (const row of mapExclusive) {
    if (!row.maps?.length) row.maps = mapsByName.get(row.name) || [];
}

const theaterOnly = (buckets.theaterOnlyNoExtract || []).map((r) => ({
    name: r.name,
    theater: `${r.theaterHits}/${r.lineCount}`,
}));
const foundOutside = (buckets.foundOutsideMatchTalk || []).map((r) => ({
    name: r.name,
    buckets: (r.buckets || []).join(', '),
}));
const falseNeg = (buckets.falseNegativeMatchTalk || []).map((r) => r.name);
const partial = (buckets.partialExtract || []).map((r) => r.name);

function embed(v) {
    return JSON.stringify(v, null, 2);
}

const src = `import {
  Callout,
  Divider,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  TextInput,
  useCanvasState,
} from 'cursor/canvas';

const MAP_EXCLUSIVE = ${embed(mapExclusive)};
const THEATER_ONLY = ${embed(theaterOnly)};
const FOUND_OUTSIDE = ${embed(foundOutside)};
const FALSE_NEG = ${embed(falseNeg)};
const PARTIAL = ${embed(partial)};
const MAP_SUMMARY = ${embed(mapAudit.summary)};
const VOICE_SUMMARY = ${embed(buckets.summary || {})};

function filterByQ(rows, q, pick) {
  const needle = String(q || '').trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => pick(r).toLowerCase().includes(needle));
}

export default function MapExclusiveAndVoiceBuckets() {
  const [tab, setTab] = useCanvasState('tab', 'map');
  const [q, setQ] = useCanvasState('q', '');

  const mapRows = filterByQ(MAP_EXCLUSIVE, q, (r) => [r.name, (r.maps || []).join(' '), (r.tags || []).join(' ')].join(' '));
  const theaterRows = filterByQ(THEATER_ONLY, q, (r) => r.name);
  const outsideRows = filterByQ(FOUND_OUTSIDE, q, (r) => [r.name, r.buckets].join(' '));

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>Map Exclusive + voice audit buckets</H1>
        <Text tone="secondary">
          Wiki Interactions marked On [[Map]]… tagged Map Exclusive. Theater-only extract gaps
          kept as a sorting bucket (not Removed yet).
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value={String(MAP_EXCLUSIVE.length)} label="Map Exclusive tagged" tone="success" />
        <Stat value={String(THEATER_ONLY.length)} label="Theater-only (confirm later)" tone="warning" />
        <Stat value={String(FOUND_OUTSIDE.length)} label="Found outside MatchTalk" />
        <Stat value={String(FALSE_NEG.length)} label="False MatchTalk misses" />
      </Grid>

      <Callout tone="info" title="Removed tags restored">
        The 20 wiki-REMOVED conversations keep the Removed tag. Awful Quiet is both Removed and
        Map Exclusive (Gibraltar). Theater-only ({THEATER_ONLY.length}) is only in
        _meta.voiceAuditBuckets — not tagged Removed.
      </Callout>

      <Divider />

      <Row gap={12} align="center">
        <Select
          value={tab}
          onChange={setTab}
          options={[
            { value: 'map', label: \`Map Exclusive (\${MAP_EXCLUSIVE.length})\` },
            { value: 'theater', label: \`Theater-only bucket (\${THEATER_ONLY.length})\` },
            { value: 'outside', label: \`Found outside MatchTalk (\${FOUND_OUTSIDE.length})\` },
            { value: 'other', label: 'Other voice buckets' },
          ]}
        />
        <TextInput value={q} onChange={setQ} placeholder="Filter…" />
        <Pill tone="neutral">
          {tab === 'map' ? mapRows.length : tab === 'theater' ? theaterRows.length : tab === 'outside' ? outsideRows.length : '—'}
        </Pill>
      </Row>

      {tab === 'map' ? (
        <Table
          headers={['Conversation', 'Maps', 'Other tags']}
          rows={mapRows.map((r) => [r.name, (r.maps || []).join(', ') || '—', (r.tags || []).join(', ') || '—'])}
        />
      ) : null}

      {tab === 'theater' ? (
        <Stack gap={10}>
          <Text tone="secondary">
            Wired in Theater Voicelines but not found in any HeroVoice extract folder. Confirm
            before tagging Removed / Classic.
          </Text>
          <Table
            headers={['Conversation', 'Theater files']}
            rows={theaterRows.map((r) => [r.name, r.theater])}
          />
        </Stack>
      ) : null}

      {tab === 'outside' ? (
        <Table
          headers={['Conversation', 'Extract buckets']}
          rows={outsideRows.map((r) => [r.name, r.buckets || '—'])}
        />
      ) : null}

      {tab === 'other' ? (
        <Stack gap={12}>
          <H2>False negatives (actually in MatchTalk)</H2>
          <Text>{FALSE_NEG.join(' · ') || '—'}</Text>
          <H2>Partial extract hits</H2>
          <Text>{PARTIAL.join(' · ') || '—'}</Text>
          <Text tone="secondary">
            Voice summary: {JSON.stringify(VOICE_SUMMARY)} · Map summary: wiki unique{' '}
            {MAP_SUMMARY.wikiMapExclusiveUnique}, matched {MAP_SUMMARY.matchedToAtlas}
          </Text>
        </Stack>
      ) : null}

      <Text tone="secondary">
        _meta.voiceAuditBuckets · scripts/_audit-map-exclusive.json · tagsResetAt bumped — hard-refresh + Save
      </Text>
    </Stack>
  );
}
`;

fs.writeFileSync(OUT, src);
console.log('Wrote', OUT);
console.log('Map Exclusive', mapExclusive.length, 'Theater-only', theaterOnly.length);
