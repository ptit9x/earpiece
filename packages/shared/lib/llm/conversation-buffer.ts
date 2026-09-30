/* eslint-disable */
// @ts-nocheck
// Rolling short-term memory of the meeting.
//
// This is not a transcript store. It holds just enough recent conversation
// for target detection and reply generation, and forgets the rest. Nothing
// is persisted to disk.

// A segment opening with one of these continues the previous one, however
// long the gap. Speech recognition splits a single spoken thought across
// several finals whenever the speaker draws breath, and "or just create a
// separate component" is not a new turn - it is the second half of the
// sentence before it.
const CONTINUATION_START =
  /^(or|and|but|because|so that|which|plus|also|although|though|unless|instead|rather than|as well as|not just|either|neither)\b/i;

export function continuesPrevious(text) {
  return CONTINUATION_START.test(String(text || '').trim());
}

import { analyzeUtterance } from './endpointing.js';

export class ConversationBuffer {
  constructor({ maxTurns = 40, maxAgeMs = 4 * 60 * 1000 } = {}) {
    this.maxTurns = maxTurns;
    this.maxAgeMs = maxAgeMs;
    this.nextId = 1;
    /** @type {Array<{id:number,speaker:string,text:string,ts:number,final:boolean}>} */
    this.turns = [];
  }

  // Append a final segment. Consecutive segments from the same speaker inside
  // a short window are merged, because STT splits one spoken sentence into
  // two or three results far more often than two people alternate that fast.
  append({
    speaker,
    text,
    ts = Date.now(),
    durationMs = 0,
    mergeWindowMs = 1500,
    continuationWindowMs = 12000,
    // Ceilings on how much one turn may absorb. Without them a speaker who
    // never pauses produces a single run-on block: the recogniser emits no
    // punctuation, so the "clause still open" rule below never stops firing.
    maxWords = 70,
    maxSpanMs = 20000,
    // 'sentence'   - a turn closes as soon as it reads as a finished clause,
    //                so one turn is roughly one sentence.
    // 'continuous' - keep absorbing anything that follows quickly, which
    //                preserves long thoughts but produces walls of text.
    mergePolicy = 'sentence',
  }) {
    const clean = (text || '').trim();
    if (!clean) return null;

    const last = this.turns[this.turns.length - 1];
    const gap = last ? ts - last.ts : Infinity;

    // The gap that matters is the SILENCE between segments, not the distance
    // between the two timestamps. Each final covers several seconds of
    // speech, so continuous talking produces finals 4-8s apart with no pause
    // at all - measuring ts-to-ts made the merge window unreachable.
    const speechStart = durationMs > 0 ? ts - durationMs : ts;
    const silenceGap = last ? speechStart - last.ts : Infinity;

    const sameSpeaker = last && last.speaker === speaker;
    const heardImmediately = silenceGap < mergeWindowMs;
    const hangsOff = continuesPrevious(clean) && gap < continuationWindowMs;
    // A clause that stopped on "and", "the" or "because" was never finished,
    // so whatever comes next belongs to it.
    const previousUnfinished = Boolean(last) && !analyzeUtterance(last.text).complete && gap < continuationWindowMs;

    // Splitting on "the clause reads as finished" alone would cut every time
    // someone takes a breath mid-sentence, because recognition emits no
    // punctuation and most fragments look closed. The distinguishing signal
    // is how long the silence was: a breath inside a sentence is very short,
    // a gap between two sentences is not.
    const breathWindow = mergePolicy === 'sentence' ? 500 : mergeWindowMs;
    const sameBreath = silenceGap < breathWindow;

    // However good the case for merging, a turn that has grown this large is
    // no longer one thought and must not swallow more.
    const full = last
      ? last.text.split(/\s+/).length + clean.split(/\s+/).length > maxWords || ts - last.startedAt > maxSpanMs
      : false;

    // An open clause keeps pulling; a closed one only continues through an
    // explicit conjunction or an unbroken breath.
    const wantsMerge = previousUnfinished || hangsOff || (mergePolicy === 'sentence' ? sameBreath : heardImmediately);

    if (sameSpeaker && !full && wantsMerge) {
      last.text = `${last.text} ${clean}`.replace(/\s+/g, ' ');
      // Keep the recogniser's own boundaries. It emits a final at each pause,
      // which is the only sentence division available without punctuation -
      // merging the text and throwing the boundaries away is what produced
      // unreadable blocks.
      last.parts.push(clean);
      last.ts = ts;
      this.prune();
      return last;
    }

    const turn = {
      id: this.nextId++,
      speaker,
      text: clean,
      parts: [clean],
      ts,
      startedAt: ts,
      final: true,
    };
    this.turns.push(turn);
    this.prune();
    return turn;
  }

  byId(id) {
    return this.turns.find(t => t.id === id) || null;
  }

  // Anyone who is not the user. With captions the speaker is a real name, so
  // this cannot test for the literal string 'remote'.
  lastRemote() {
    for (let i = this.turns.length - 1; i >= 0; i--) {
      if (this.turns[i].speaker !== 'me') return this.turns[i];
    }
    return null;
  }

  prune() {
    const cutoff = Date.now() - this.maxAgeMs;
    while (this.turns.length && this.turns[0].ts < cutoff) this.turns.shift();
    while (this.turns.length > this.maxTurns) this.turns.shift();
  }

  recent(n = 10) {
    this.prune();
    return this.turns.slice(-n);
  }

  // Plain text rendering fed to Claude. Speaker labels are coarse on purpose:
  // we know "someone else" vs "the user", not individual names.
  transcriptText(n = 10) {
    return this.recent(n)
      .map(t => `${t.speaker === 'me' ? 'Me' : t.speaker === 'remote' ? 'Them' : t.speaker}: ${t.text}`)
      .join('\n');
  }

  lastTurn() {
    return this.turns[this.turns.length - 1] || null;
  }

  // True if the user spoke recently. Used by target detection: a question
  // landing right after the user talked is far more likely aimed at them.
  userSpokeWithin(ms) {
    const cutoff = Date.now() - ms;
    return this.turns.some(t => t.speaker === 'me' && t.ts >= cutoff);
  }

  clear() {
    this.turns = [];
  }
}
