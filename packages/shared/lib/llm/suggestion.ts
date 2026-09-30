/* eslint-disable */
// @ts-nocheck
// Shape of one model answer, shared by both backends.
//
// A suggestion is a small set of stances, not a single sentence. Real
// meetings ask closed questions ("can you finish by Friday?") where the
// useful help is "here is yes, here is no, here is buy-time" - picking the
// stance is the user's call, not the model's.

export const MAX_OPTIONS = 3;

export function emptySuggestion() {
  return { for_me: false, intent: '', options: [], degraded: false };
}

export function normalizeSuggestion(parsed) {
  if (!parsed || typeof parsed !== 'object') return emptySuggestion();

  const options = [];
  const seen = new Set();

  for (const raw of toArray(parsed.options)) {
    const en = str(raw?.en ?? raw?.reply ?? raw?.text);
    if (!en) continue;
    const key = en.toLowerCase();
    if (seen.has(key)) continue; // models repeat themselves under pressure
    seen.add(key);
    options.push({
      label: str(raw?.label) || inferLabel(en),
      en,
      vi: str(raw?.vi ?? raw?.vietnamese),
    });
    if (options.length >= MAX_OPTIONS) break;
  }

  // The model saying "this is for you" and then handing back nothing usable
  // is a failure, not a decision to stay quiet. Truncated output is the usual
  // cause. Keeping them distinct is what makes the overlay able to say so.
  const claimed = Boolean(parsed.for_me);
  return {
    for_me: claimed && options.length > 0,
    intent: str(parsed.intent),
    options,
    degraded: claimed && options.length === 0,
  };
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  // Tolerate a model that ignored the schema and returned one flat reply.
  if (value && typeof value === 'object') return [value];
  return [];
}

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

// Fallback only - the model is asked for a label, but a missing one should
// not leave a blank chip in the UI.
function inferLabel(en) {
  const t = en.toLowerCase();
  if (/^(yeah|yes|sure|ok|okay|absolutely|of course)\b/.test(t)) return 'Yes';
  if (/^(no|nope|not really|i don't think)\b/.test(t)) return 'No';
  if (/\?$/.test(en)) return 'Ask';
  if (/\b(let me|i'll check|get back to you|take a look)\b/.test(t)) return 'Buy time';
  if (/\b(not sure|i'm not certain|no idea)\b/.test(t)) return 'Unsure';
  return 'Reply';
}
