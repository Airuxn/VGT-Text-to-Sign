import path from 'node:path';
import fs from 'node:fs';
import { withRetry, writeJson, sha1, ensureDir } from './utils.js';
import { buildQuerySet } from './queryStrategy.js';

const BASE_URL = 'https://woordenboek.vlaamsegebarentaal.be';
const SEARCH_URL = `${BASE_URL}/search`;
const API_SIGNS_URL = `${BASE_URL}/api/signs`;

function encodeParams(params) {
  return new URLSearchParams(params).toString();
}

function buildSearchParams(query, from, size) {
  return {
    q: JSON.stringify([query]),
    mode: 'ANDExact',
    from: String(from),
    size: String(size),
    c: '[]',
    g: '[]',
    h: '[]',
    l: '[]',
    lb: '[]',
    r: '[]',
    e: '[]'
  };
}

function mapOverviewToEntries(item) {
  const translations = item.translations || [];
  const terms = translations.length ? translations : [item.glossName];
  const video = item.video || null;

  return terms
    .map((token) => String(token || '').trim().toLowerCase())
    .filter((token) => token.length >= 1 && token.length <= 80)
    .map((token) => ({
      token,
      sourceUrl: `${SEARCH_URL}?q=${encodeURIComponent(token)}`,
      sourceId: sha1(`${token}|${item.signId}`),
      signRef: item.glossName || String(item.signId),
      signNumericId: item.signId,
      translations,
      regions: item.regions || [],
      labels: item.labels || [],
      hasEtymology: Boolean(item.hasEtymology),
      media: video ? [{ url: video, from: 'api.signs.video' }] : []
    }));
}

async function fetchApiSearchPage(query, from, size) {
  const qs = encodeParams(buildSearchParams(query, from, size));
  const url = `${API_SIGNS_URL}?${qs}`;
  return withRetry(async () => {
    const res = await fetch(url, { headers: { 'User-Agent': 'vgt-sign-converter-ingest/1.3' } });
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    return await res.json();
  }, 3, 700);
}

async function fetchEntriesForQuery(query, size = 24, maxPages = 8) {
  const all = [];
  let from = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const data = await fetchApiSearchPage(query, from, size);
    const overviews = data.signOverviews || [];
    const mapped = overviews.flatMap(mapOverviewToEntries);
    all.push(...mapped);

    const total = Number(data.totalNumberSignOverviews || 0);
    from += size;
    if (from >= total || overviews.length === 0) break;
  }

  return all;
}

function dedupeEntries(entries) {
  const byId = new Map();
  for (const item of entries) {
    if (!byId.has(item.sourceId)) byId.set(item.sourceId, item);
  }
  return [...byId.values()];
}

async function fetchViaApi({ query, pages }) {
  const maxQueries = Math.max(1, Number(process.env.INGEST_MAX_QUERIES || pages || 30));
  const queryMode = process.env.INGEST_QUERY_MODE || 'expanded';
  const overrideSet = process.env.INGEST_QUERY_SET || '';

  const selectedQueries = query === '*'
    ? buildQuerySet({ mode: queryMode, maxQueries, overrideSet })
    : [query];

  const out = [];
  for (const q of selectedQueries) {
    const entries = await fetchEntriesForQuery(q, 24, 10);
    out.push(...entries);
  }
  return dedupeEntries(out);
}

async function fetchViaHtml({ query, page }) {
  const target = `${SEARCH_URL}?query=${encodeURIComponent(query)}&page=${page}`;
  const html = await withRetry(async () => {
    const res = await fetch(target, { headers: { 'User-Agent': 'vgt-sign-converter-ingest/1.3' } });
    if (!res.ok) throw new Error(`fetch failed ${res.status}`);
    return await res.text();
  }, 2, 800);

  const tokens = [...new Set(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .toLowerCase()
      .split(/[^a-zà-ÿ0-9]+/i)
      .filter((w) => w.length >= 2 && w.length <= 24)
  )].slice(0, 200);

  return tokens.map((token) => ({
    token,
    sourceUrl: target,
    sourceId: sha1(`${token}|${target}`),
    signRef: null,
    signNumericId: null,
    translations: [token],
    regions: [],
    labels: [],
    hasEtymology: false,
    media: []
  }));
}

export async function fetchDictionarySnapshots({ pages = 1, query = 'a', outDir }) {
  ensureDir(outDir);
  const snapshots = [];

  try {
    const apiEntries = await fetchViaApi({ query, pages });
    const snapshot = {
      source: API_SIGNS_URL,
      sourceType: 'api',
      query,
      extractedAt: new Date().toISOString(),
      count: apiEntries.length,
      entries: apiEntries
    };
    const snapshotFile = path.join(outDir, `snapshot_${query}_api.json`);
    writeJson(snapshotFile, snapshot);
    snapshots.push(snapshotFile);
    return snapshots;
  } catch (err) {
    const fallbackEntries = [];
    for (let page = 1; page <= pages; page += 1) {
      const entries = await fetchViaHtml({ query, page });
      fallbackEntries.push(...entries);
    }

    const snapshot = {
      source: SEARCH_URL,
      sourceType: 'html-fallback',
      query,
      extractedAt: new Date().toISOString(),
      count: fallbackEntries.length,
      entries: dedupeEntries(fallbackEntries)
    };
    const snapshotFile = path.join(outDir, `snapshot_${query}_html.json`);
    fs.writeFileSync(path.join(outDir, `snapshot_${query}_error.log`), String(err), 'utf8');
    writeJson(snapshotFile, snapshot);
    snapshots.push(snapshotFile);
    return snapshots;
  }
}
