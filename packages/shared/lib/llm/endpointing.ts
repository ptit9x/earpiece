/* eslint-disable */
// @ts-nocheck
// Deciding when a speaker has actually finished.
//
// A fixed pause timer is the wrong instrument: people pause mid-sentence to
// think ("so the thing is... uh... we probably need to") and run straight on
// after finishing one. Two better signals are available for free:
//
//   1. Syntax. A clause ending in "and", "the", "because" or "to" is not
//      finished no matter how long the silence runs. One ending in a complete
//      question almost certainly is.
//   2. Interim results. Chrome emits them continuously while speech is in
//      progress, so an interim arriving after a final means the speaker
//      picked back up - stronger evidence than any timer.
//
// This module owns signal 1. The service worker owns signal 2.

// Ending on any of these means a clause is still open.
const DANGLING = new Set([
  // coordinating and subordinating conjunctions
  'and',
  'but',
  'or',
  'nor',
  'so',
  'because',
  'since',
  'although',
  'though',
  'while',
  'whereas',
  'plus',
  'then',
  // subordinators / relativisers
  'that',
  'which',
  'who',
  'whom',
  'whose',
  'if',
  'unless',
  'until',
  'when',
  'where',
  'before',
  'after',
  'whether',
  // prepositions
  'of',
  'to',
  'for',
  'with',
  'in',
  'on',
  'at',
  'from',
  'by',
  'about',
  'into',
  'onto',
  'over',
  'under',
  'between',
  'through',
  'without',
  'against',
  'per',
  // determiners and possessives
  'the',
  'a',
  'an',
  'this',
  'these',
  'those',
  'my',
  'our',
  'your',
  'their',
  'its',
  'his',
  'her',
  'some',
  'any',
  'every',
  'each',
  'another',
  // auxiliaries and copulas left hanging
  'is',
  'are',
  'was',
  'were',
  'am',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'can',
  'could',
  'will',
  'would',
  'shall',
  'should',
  'may',
  'might',
  'must',
  'have',
  'has',
  'had',
  "don't",
  "didn't",
  "can't",
  "won't",
  // hesitation
  'um',
  'uh',
  'er',
  'erm',
  'like',
  'well',
  'actually',
  'basically',
  // comparatives and fragments
  'than',
  'as',
  'very',
  'really',
  'quite',
  'more',
  'most',
  'kind',
  'sort',
]);

const QUESTION_WORDS = new Set(['what', 'why', 'how', 'when', 'where', 'which', 'who', 'whose', 'whom']);

const AUX = new Set([
  'is',
  'are',
  'was',
  'were',
  'do',
  'does',
  'did',
  'can',
  'could',
  'will',
  'would',
  'should',
  'shall',
  'have',
  'has',
  'had',
  'may',
  'might',
]);

const TAG_ENDINGS = /\b(right|correct|okay|ok|yeah|yes|no|isn't it|does it|doesn't it|can you|will you)$/;

const LEAD_SKIP = new Set(['hey', 'hi', 'ok', 'okay', 'so', 'and', 'but', 'um', 'uh', 'well', 'alright']);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s'?.!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/**
 * @param {string} text  the utterance so far
 * @param {number} baseMs  the configured end-of-sentence wait
 * @returns {{complete: boolean, waitMs: number, reason: string}}
 */
export function analyzeUtterance(text, baseMs = 550, { minMs = 220, maxMs = 1600 } = {}) {
  const raw = String(text || '').trim();
  const tokens = tokenize(raw);
  const clamp = n => Math.round(Math.max(minMs, Math.min(maxMs, n)));

  if (!tokens.length) {
    return { complete: false, waitMs: clamp(baseMs), reason: 'empty' };
  }

  const last = tokens[tokens.length - 1].replace(/[.!?]+$/, '');
  const stripped = tokens.map(t => t.replace(/[.!?]+$/, ''));

  // An open clause outranks everything else: no amount of silence ends a
  // sentence that stops on "because".
  if (DANGLING.has(last)) {
    return { complete: false, waitMs: clamp(baseMs * 2.2), reason: `dangling "${last}"` };
  }

  // Explicit terminal punctuation from the recogniser.
  if (/[.!?]$/.test(raw)) {
    return { complete: true, waitMs: clamp(baseMs * 0.4), reason: 'terminal punctuation' };
  }

  // Tag question: "...we're keeping the old one, right"
  if (tokens.length >= 4 && TAG_ENDINGS.test(stripped.join(' '))) {
    return { complete: true, waitMs: clamp(baseMs * 0.4), reason: 'tag question' };
  }

  // A complete interrogative is the case worth answering fast.
  let i = 0;
  while (i < stripped.length && LEAD_SKIP.has(stripped[i])) i++;
  const head = stripped[i];
  const isQuestionForm = QUESTION_WORDS.has(head) || AUX.has(head);
  if (isQuestionForm && stripped.length - i >= 4) {
    return { complete: true, waitMs: clamp(baseMs * 0.5), reason: 'complete question' };
  }

  // Too short to be a whole thought; likely the front of a longer sentence.
  if (tokens.length < 4) {
    return { complete: false, waitMs: clamp(baseMs * 1.6), reason: 'too short' };
  }

  return { complete: true, waitMs: clamp(baseMs), reason: 'clause looks closed' };
}

// Deferral budget. Two independent ceilings, because either alone fails:
//
//   - A retry count alone is per-turn, and a merge keeps one turn alive
//     indefinitely, so a speaker who never pauses resets it forever and no
//     suggestion is ever produced.
//   - A deadline alone would cut off a genuinely short pause.
//
// Whichever runs out first wins and the turn is answered as it stands. An
// answer to something said four seconds ago is still usable; silence is not.
export const MAX_EVALUATE_DEFERRALS = 6;
export const MAX_PENDING_MS = 4500;

export function shouldDefer({ stillTalking, complete, heldMs, attempts }) {
  const wantsMore = Boolean(stillTalking) || !complete;
  if (!wantsMore) return { defer: false, reason: 'sentence finished' };
  if (heldMs >= MAX_PENDING_MS) {
    return { defer: false, reason: `held ${Math.round(heldMs / 100) / 10}s — answering anyway` };
  }
  if (attempts >= MAX_EVALUATE_DEFERRALS) {
    return { defer: false, reason: 'out of retries — answering anyway' };
  }
  return { defer: true, reason: stillTalking ? 'still speaking' : 'clause still open' };
}
