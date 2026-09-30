/* eslint-disable */
// @ts-nocheck
// Turning live-caption DOM updates into discrete transcript lines.
//
// Meeting captions do not arrive as finished sentences. A block is created
// when someone starts talking and then REWRITTEN in place as they continue,
// and earlier words are revised as the recogniser changes its mind:
//
//   "so I think we should"
//   "so I think we should keep"
//   "so I think we shouldn't keep the old one"
//
// Emitting each state would triple the transcript; emitting only the final
// state would mean waiting for the speaker to stop. So each update is reduced
// to what is genuinely new since the last one.

export function normalizeCaption(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Meet shows the local user as "You"; everyone else by name.
export function normalizeSpeaker(name) {
  const clean = normalizeCaption(name);
  if (!clean) return 'unknown';
  if (/^(you|bạn)$/i.test(clean)) return 'me';
  return clean;
}

/**
 * What is new in `next` compared with `prev`.
 *
 * @returns {{delta: string, revised: boolean}}
 *   delta   - the newly spoken text, or '' when nothing was added
 *   revised - true when the recogniser rewrote earlier words rather than
 *             only appending, so the caller should replace rather than append
 */
export function captionDelta(prev, next) {
  const a = normalizeCaption(prev);
  const b = normalizeCaption(next);

  if (!b) return { delta: '', revised: false };
  if (!a) return { delta: b, revised: false };
  if (a === b) return { delta: '', revised: false };

  // The common case: the block grew.
  if (b.startsWith(a)) {
    return { delta: b.slice(a.length).trim(), revised: false };
  }

  // The recogniser rewrote what it had. Fall back to the longest shared
  // prefix at a word boundary, so only the rewritten tail is reported.
  const aw = a.split(' ');
  const bw = b.split(' ');
  let shared = 0;
  while (shared < aw.length && shared < bw.length && aw[shared] === bw[shared]) shared++;

  // Almost nothing in common means this is a different utterance in a reused
  // block, not a revision of the same one.
  if (shared === 0) return { delta: b, revised: false };

  return { delta: bw.slice(shared).join(' '), revised: true };
}

/**
 * Whether a caption block should close and start a new turn.
 * A different speaker always does. Otherwise a long enough gap does.
 */
export function startsNewTurn({ speaker, lastSpeaker, ts, lastTs, gapMs = 3500 }) {
  if (speaker !== lastSpeaker) return true;
  if (!lastTs) return true;
  return ts - lastTs > gapMs;
}
