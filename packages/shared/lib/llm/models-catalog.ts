/* eslint-disable */
// @ts-nocheck
// Fetches the model list from an OpenAI-dialect endpoint (GET {baseUrl}/models)
// and normalises it, so the popup never has to hardcode model ids that go
// stale. OpenRouter serves this endpoint unauthenticated and includes
// per-token pricing, which is what lets us flag the free routes.

const CACHE_KEY = 'modelsCache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export async function fetchModels({ baseUrl, apiKey, force = false }) {
  const root = (baseUrl || '').replace(/\/+$/, '');
  if (!root) throw new Error('No base URL set.');
  const url = `${root}/models`;

  if (!force) {
    const cached = await readCache(url);
    if (cached) return { ...cached, cached: true };
  }

  const headers = {};
  // OpenRouter does not require auth here; other servers do.
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${new URL(url).host} ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`);
  }

  const json = await res.json();
  const raw = json?.data || json?.models || [];
  if (!Array.isArray(raw)) throw new Error('Unexpected /models response shape.');

  const models = raw.map(normalizeModel).filter(m => m.id);
  sortModels(models);

  const payload = { url, ts: Date.now(), models };
  await chrome.storage.local.set({ [CACHE_KEY]: payload });
  return { ...payload, cached: false };
}

export function normalizeModel(m) {
  const id = String(m?.id || m?.name || '').trim();
  const pricing = m?.pricing || {};

  // Prices arrive as decimal strings per token ("0", "0.0000005"). Anything
  // unparseable stays null so "unknown" is not silently reported as free.
  const prompt = toPrice(pricing.prompt);
  const completion = toPrice(pricing.completion);

  // Two independent signals. OpenRouter marks free routes with a ":free"
  // suffix and zero pricing; a self-hosted server has neither, and correctly
  // reports free = false rather than pretending to know.
  const free = (prompt === 0 && completion === 0) || /:free$/i.test(id);

  return {
    id,
    name: String(m?.name || id),
    free,
    promptPerM: prompt === null ? null : prompt * 1_000_000,
    completionPerM: completion === null ? null : completion * 1_000_000,
    contextLength: m?.context_length ?? m?.top_provider?.context_length ?? null,
  };
}

function toPrice(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Free first, then cheapest, then alphabetical. Unknown pricing sorts last
// inside its group rather than jumping to the top.
export function sortModels(models) {
  models.sort((a, b) => {
    if (a.free !== b.free) return a.free ? -1 : 1;
    const ap = a.promptPerM ?? Number.POSITIVE_INFINITY;
    const bp = b.promptPerM ?? Number.POSITIVE_INFINITY;
    if (ap !== bp) return ap - bp;
    return a.id.localeCompare(b.id);
  });
  return models;
}

export function describeModel(m) {
  const bits = [];
  if (m.free) bits.push('free');
  else if (m.promptPerM !== null) bits.push(`$${m.promptPerM.toFixed(2)}/M in`);
  if (m.contextLength) bits.push(`${Math.round(m.contextLength / 1000)}K ctx`);
  return bits.join(' · ');
}

async function readCache(url) {
  const { [CACHE_KEY]: cache } = await chrome.storage.local.get(CACHE_KEY);
  if (!cache || cache.url !== url) return null;
  if (Date.now() - cache.ts > CACHE_TTL_MS) return null;
  return cache;
}
