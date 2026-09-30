/* eslint-disable */
// @ts-nocheck
// Deciding whether a recognised segment is speech worth keeping.
//
// With a microphone as the input device, the recogniser hears the room: a
// fan, a keyboard, a door, someone talking outside. It does not return
// silence for those - it returns confident-looking sentences. Two cheap
// signals separate them from real speech.

export const DEFAULTS = {
  minConfidence: 0.55,
  minWords: 2,
};

// Filler the recogniser emits constantly when it is listening to noise.
const NOISE_ONLY =
  /^(?:uh|um|er|erm|ah|oh|hm+|mm+|mhm|huh|eh|yeah|okay|ok|hey|the|a|so|and)(?:\s+(?:uh|um|er|erm|ah|oh|hm+|mm+|mhm|huh|eh))*[.!?]?$/i;

/**
 * @returns {{keep: boolean, reason: string, words: number}}
 */
export function gate(text, confidence = 0, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const clean = String(text || '').trim();
  const words = clean ? clean.split(/\s+/).length : 0;

  if (!clean) return { keep: false, reason: 'empty', words: 0 };

  if (NOISE_ONLY.test(clean)) {
    return { keep: false, reason: 'filler only', words };
  }

  if (o.minWords > 0 && words < o.minWords) {
    return { keep: false, reason: `${words} word${words === 1 ? '' : 's'}`, words };
  }

  // Chrome reports 0 when it has no confidence figure at all. Treating that
  // as "certainly wrong" would drop every result on builds that never
  // populate it, so unknown passes.
  if (o.minConfidence > 0 && confidence > 0 && confidence < o.minConfidence) {
    return { keep: false, reason: `confidence ${confidence.toFixed(2)}`, words };
  }

  return { keep: true, reason: 'kept', words };
}
