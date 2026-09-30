/* eslint-disable */
// @ts-nocheck
// Central defaults and storage access. Everything the user can tune lives here.

export const DEFAULTS = {
  // Identity: how the user is addressed in meetings. Nicknames and common
  // mishearings matter more than the legal name, because STT will mangle it.
  userName: '',
  userAliases: [],

  // Model backend.
  // 'anthropic'        -> api.anthropic.com, Messages API
  // 'openai-compatible'-> any /chat/completions endpoint (OpenRouter, Groq,
  //                       a local server, ...) set via baseUrl
  provider: 'anthropic',
  baseUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  model: 'claude-haiku-4-5',
  // Three options, each with a Vietnamese line, needs real headroom.
  maxTokens: 420,
  // DeepSeek V4 (flash and pro alike) runs thinking mode server-side by
  // default, which burns the whole budget before any answer is written and
  // adds seconds this product does not have. Off by default; the request
  // retries without the field for backends that reject it.
  disableThinking: true,
  // A hung request must not leave the overlay stuck on "Thinking…".
  requestTimeoutMs: 15000,

  // Debug: skip speaker labelling and treat every recognised segment as
  // coming from someone else. Lets the whole pipeline be exercised with just
  // a microphone, with no loopback/monitor source set up. In a real meeting
  // this makes the assistant answer your own sentences, so it is off by
  // default and announced on the overlay whenever it is on.
  debugAllRemote: false,

  // Project vocabulary: component names, product names, teammates, repo
  // names. The recogniser has never heard these words, so it substitutes
  // something that sounds close; this list puts them back, and the model gets
  // them as context too.
  glossary: [],

  // Noise gate on recognition results.
  //
  // Room noise, a fan, a keyboard, someone talking in the next room - the
  // recogniser turns all of it into confident-looking sentences. It also
  // reports how sure it was, and junk scores far lower than speech, so this
  // is the cheapest filter available.
  //
  // 0 disables it. Chrome does not always populate confidence; when it
  // reports 0 the result is kept rather than dropped, because dropping
  // everything is worse than dropping nothing.
  minConfidence: 0.55,
  // Below this many words a segment is noise or a stray syllable. It would
  // never trigger a suggestion, but it still pollutes the context sent to the
  // model and the transcript you read.
  minWords: 2,

  // Which kind of conversation this is. Changes the stances offered and the
  // register - an interview answer and a standup answer are not the same
  // shape. See lib/scenarios.js.
  activeScenario: 'discussion',
  customScenarios: [],

  // Speech recognition
  sttLang: 'en-US',
  sttEngine: 'web-speech', // 'web-speech' | 'chunked'

  // One-on-one call: nobody says your name because there is nobody else to
  // confuse you with, so every question from the other side is yours. Off by
  // default because getting this wrong in a group call is noisy.
  oneOnOne: false,

  // Target detection
  // Score at or above this fires a Claude call. Lower = more suggestions,
  // more noise and more cost. 0.45 is a deliberately permissive default:
  // a missed question costs the user more than a spurious suggestion.
  targetThreshold: 0.45,

  // How long to wait after a final transcript segment before deciding the
  // speaker actually stopped. Too low: we answer half a question. Too high:
  // we blow the 1-2s budget.
  utteranceSettleMs: 550,

  // How much one transcript turn may absorb.
  //   'sentence'   - close a turn once it reads as a finished clause, so the
  //                  transcript is one sentence per line
  //   'continuous' - keep absorbing whatever follows quickly
  // Which kind of conversation this is. Changes the stances offered and the
  // register - an interview answer and a standup answer are not the same
  // shape. See lib/scenarios.js.
  activeScenario: 'discussion',
  customScenarios: [],

  // Speech recognition emits no punctuation, so 'sentence' occasionally
  // splits one long thought in two. The model still sees the previous turns
  // as context, so meaning survives; a wall of text does not.
  mergePolicy: 'sentence',

  // Conversation memory
  contextTurns: 10,
  contextMaxAgeMs: 4 * 60 * 1000,

  // UI
  showVietnamese: true,

  // Master switch
  listening: false,
};

// The multi-option bilingual schema needs far more room than the original
// single-sentence one. A profile still carrying the old stored value would
// truncate every answer, so retire that exact value on read.
const STALE_MAX_TOKENS = [160];

export async function getConfig() {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULTS));
  if (STALE_MAX_TOKENS.includes(stored.maxTokens)) {
    delete stored.maxTokens;
    chrome.storage.local.remove('maxTokens').catch(() => {});
  }
  return { ...DEFAULTS, ...stored };
}

export async function setConfig(patch) {
  await chrome.storage.local.set(patch);
  return getConfig();
}

// Name variants we should accept as "that was my name".
// STT routinely drops the last consonant, splits syllables, or swaps a
// near-homophone, so we match generously and let the scorer weigh it.
export function nameVariants(cfg) {
  const raw = [cfg.userName, ...(cfg.userAliases || [])].map(s => (s || '').trim().toLowerCase()).filter(Boolean);

  const out = new Set();
  for (const name of raw) {
    out.add(name);
    for (const part of name.split(/\s+/)) {
      if (part.length >= 3) out.add(part);
    }
  }
  return [...out];
}
