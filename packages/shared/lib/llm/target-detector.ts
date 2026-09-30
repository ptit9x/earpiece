/* eslint-disable */
// @ts-nocheck
// Local, zero-latency, zero-cost gate in front of the LLM.
//
// Its only job is to answer "is this plausibly aimed at me?" fast enough to
// be free. It is deliberately biased toward false positives: a missed
// question costs the user a stalled meeting, a spurious suggestion costs a
// glance at the overlay.

const QUESTION_WORDS = ['what', 'why', 'how', 'when', 'where', 'which', 'who', 'whose', 'whom'];

const AUX_VERBS = [
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
];

const REQUEST_PATTERNS = [
  /\bcan you\b/,
  /\bcould you\b/,
  /\bwould you\b/,
  /\bwill you\b/,
  /\bdo you mind\b/,
  /\bwould you mind\b/,
  /\bare you able\b/,
  /\bplease (?:can|could)?\s?you\b/,
  /\bi need you to\b/,
  /\bwe need you to\b/,
];

const HANDOFF_PATTERNS = [
  /\bwhat do you think\b/,
  /\byour thoughts?\b/,
  /\bover to you\b/,
  /\bany (?:updates?|thoughts?|comments?) (?:from|on) (?:you|your)\b/,
  /\bhow about you\b/,
  /\bwhat about you\b/,
  /\bdo you have\b/,
  /\bany blockers?\b/,
  /\bwhere are we on\b/,
  /\bcan we get\b/,
];

// Thinking out loud in front of someone IS asking them. None of these carry
// a question mark, a name, or the word "you", so every other signal in this
// file misses them - and they are how a senior engineer actually opens a
// design discussion.
const DELIBERATION_PATTERNS = [
  /\b(?:i'?m|im) not sure (?:whether|if|which|what|how)\b/,
  /\bnot sure (?:whether|if|which|what)\b/,
  /\bi wonder (?:if|whether|what|how)\b/,
  /\bi (?:don'?t|dont) know (?:if|whether|which|what)\b/,
  /\bit'?s (?:not clear|unclear)\b/,
  /\bwe (?:need to|have to|should) (?:decide|figure out|pick|choose)\b/,
  /\bwhich (?:one |way |approach )?(?:is|makes|would be|sounds) (?:better|best|more sense)\b/,
  /\bwhat'?s the best (?:way|approach|option)\b/,
  /\bmakes more sense\b/,
  /\bany (?:idea|ideas|thoughts|opinions|preference|reason|chance)\b/,
  /\bopen to (?:suggestions|ideas|anything)\b/,
  /\bi'?m torn\b/,
  /\bcould go (?:either way|both ways)\b/,
];

// Laying out two named alternatives is an invitation to pick one. An
// explicit "either X or Y" is the whole point of the sentence; a trailing
// "or just ..." only colours a choice that some other signal already found.
const STRONG_ALTERNATIVES = [
  /\beither\b[\s\S]{0,80}\bor\b/,
  /\bthe other option (?:is|would be)\b/,
  /\bdo we (?:go with|pick|choose)\b/,
];

const WEAK_ALTERNATIVES = [/\bor (?:just|maybe|we could|instead)\b/, /\bversus\b/, /\bvs\b/];

const GROUP_PATTERNS = [
  /\banyone\b/,
  /\banybody\b/,
  /\beveryone\b/,
  /\beverybody\b/,
  /\bguys\b/,
  /\bteam\b/,
  /\bfolks\b/,
  /\ball right everyone\b/,
];

// Short acknowledgements nobody needs help answering.
const FILLER_ONLY =
  /^(?:yeah|yep|yes|no|nope|ok|okay|mhm|uh huh|right|sure|cool|thanks|thank you|got it|sounds good|exactly|perfect)[.!?]?$/i;

function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s'?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Levenshtein distance, capped. STT mangles names constantly, so an exact
// match is too strict; "Viet" comes back as "V it", "Vet", "Viette".
function editDistance(a, b, cap = 2) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
    if (Math.min(...cur) > cap) return cap + 1;
  }
  return prev[b.length];
}

function matchesName(tokens, variants) {
  for (const variant of variants) {
    const parts = variant.split(' ');
    if (parts.length > 1) {
      const joined = tokens.join(' ');
      if (joined.includes(variant)) return { hit: true, exact: true, variant };
      continue;
    }
    for (const tok of tokens) {
      if (tok === variant) return { hit: true, exact: true, variant };
      if (variant.length < 4) continue;
      // STT commonly adds or drops a trailing syllable: "Viet" comes back as
      // "Viette" or "Vie". A shared prefix is stronger evidence than raw
      // edit distance, which a 4-letter name blows through on any vowel swap.
      if (tok.length >= 4 && (tok.startsWith(variant) || variant.startsWith(tok))) {
        return { hit: true, exact: false, variant };
      }
      if (editDistance(tok, variant, 1) <= 1) {
        return { hit: true, exact: false, variant };
      }
    }
  }
  return { hit: false };
}

function isQuestion(norm, rawText) {
  if (/\?/.test(rawText || '')) return true;
  const tokens = norm.split(' ').filter(Boolean);
  if (!tokens.length) return false;

  // A question is very often preceded by a vocative or a discourse marker:
  // "Viet, did you push that", "So, what do you think". Skip those before
  // looking at the first real word, otherwise the question is invisible.
  const SKIP = new Set(['hey', 'hi', 'ok', 'okay', 'so', 'and', 'but', 'um', 'uh', 'well', 'alright', 'right']);
  // A vocative is a name. Without this guard, "I was in meetings all morning"
  // reads as <vocative "I"> + <aux "was"> and is scored as a question - and
  // so is almost every declarative sentence in English.
  const NEVER_VOCATIVE = new Set([
    'i',
    'we',
    'you',
    'they',
    'he',
    'she',
    'it',
    'there',
    'that',
    'this',
    'these',
    'those',
    'everyone',
    'everybody',
    'someone',
    'somebody',
    'nobody',
    'nothing',
    'everything',
    'something',
    'who',
    'what',
  ]);
  let i = 0;
  const commaIndex = (rawText || '').indexOf(',');
  if (commaIndex > 0 && commaIndex < 30) {
    // Everything before an early comma is address, not content.
    i = normalize(rawText.slice(0, commaIndex)).split(' ').filter(Boolean).length;
  }
  while (i < tokens.length && SKIP.has(tokens[i])) i++;
  // A bare vocative with no comma: "Viet did you push that".
  if (
    i < tokens.length - 1 &&
    !NEVER_VOCATIVE.has(tokens[i]) &&
    !QUESTION_WORDS.includes(tokens[i]) &&
    !AUX_VERBS.includes(tokens[i]) &&
    (QUESTION_WORDS.includes(tokens[i + 1]) || AUX_VERBS.includes(tokens[i + 1]))
  ) {
    i++;
  }

  if (i < tokens.length) {
    if (QUESTION_WORDS.includes(tokens[i])) return true;
    if (AUX_VERBS.includes(tokens[i])) return true;
  }
  // Tag questions: "...we're keeping that one, right"
  if (/\b(?:right|correct|yeah|okay|no)$/.test(norm) && tokens.length > 4) return true;
  return false;
}

/**
 * @returns {{score:number, likely:boolean, reasons:string[], signals:object}}
 */
export function detectTarget({ text, speaker, buffer, variants, threshold = 0.45, oneOnOne = false }) {
  const reasons = [];
  const raw = (text || '').trim();
  const norm = normalize(raw);
  const tokens = norm.split(' ').filter(Boolean);

  // Never suggest a reply to the user's own speech. Every other speaker
  // value is someone else - with captions it is their actual name.
  if (speaker === 'me') {
    return { score: 0, likely: false, reasons: ['own speech'], signals: {} };
  }
  if (!tokens.length || FILLER_ONLY.test(raw)) {
    return { score: 0, likely: false, reasons: ['filler only'], signals: {} };
  }
  if (tokens.length < 3) {
    return { score: 0, likely: false, reasons: ['too short'], signals: {} };
  }

  let score = 0;
  const name = matchesName(tokens, variants);
  const question = isQuestion(norm, raw);
  const request = REQUEST_PATTERNS.some(re => re.test(norm));
  const handoff = HANDOFF_PATTERNS.some(re => re.test(norm));
  const group = GROUP_PATTERNS.some(re => re.test(norm));
  const deliberation = DELIBERATION_PATTERNS.some(re => re.test(norm));
  const strongAlt = STRONG_ALTERNATIVES.some(re => re.test(norm));
  const weakAlt = !strongAlt && WEAK_ALTERNATIVES.some(re => re.test(norm));
  const secondPerson = /\byou\b|\byour\b|\byou're\b|\byoure\b/.test(norm);

  // In a two-person call there is no one else the speaker could mean, so
  // being addressed is the default rather than something to prove. The bonus
  // is sized to carry a question over the line on its own while leaving plain
  // narration below it - "I pushed the fix last night" still needs no reply.
  if (oneOnOne) {
    score += 0.3;
    reasons.push('1:1 call');
  }

  if (name.hit) {
    score += name.exact ? 0.55 : 0.4;
    reasons.push(name.exact ? `name "${name.variant}"` : `name ~"${name.variant}"`);
  }
  if (request) {
    score += 0.3;
    reasons.push('direct request');
  }
  if (handoff) {
    score += 0.3;
    reasons.push('handoff phrase');
  }
  if (question) {
    score += 0.22;
    reasons.push('question form');
  }
  if (deliberation) {
    // As strong as an explicit request: the speaker has stopped and is
    // waiting for an opinion, they just did not phrase it as a question.
    score += 0.45;
    reasons.push('thinking out loud');
  }
  if (strongAlt) {
    score += 0.45;
    reasons.push('either/or decision');
  } else if (weakAlt) {
    score += 0.15;
    reasons.push('options on the table');
  }
  if (secondPerson && (question || request)) {
    score += 0.18;
    reasons.push('second person + ask');
  }
  if (group) {
    // Open questions to the room are sometimes the user's to answer, but
    // they are much weaker evidence than being named.
    score += 0.1;
    reasons.push('group question');
  }

  // Conversational momentum: if the user just spoke, the next question is
  // probably still aimed at them.
  if (buffer && buffer.userSpokeWithin(25000)) {
    score += 0.15;
    reasons.push('user spoke recently');
  }

  // Someone else was named up front. Strong signal it is not the user -
  // except in a 1:1, where there is no one else to name.
  const leadName = tokens.slice(0, 2).join(' ');
  if (
    !oneOnOne &&
    !name.hit &&
    /^(?:hey|hi|ok|okay|so|and)?\s?[a-z]+,/.test(raw.toLowerCase()) &&
    (question || request)
  ) {
    score -= 0.2;
    reasons.push(`addressed elsewhere (${leadName})`);
  }

  // Round BEFORE comparing. Summing float weights gives 0.44999999999999996
  // for what the UI prints as "0.45", so a score displayed as exactly the
  // threshold would silently fail to fire.
  score = Number(Math.max(0, Math.min(1, score)).toFixed(3));
  return {
    score,
    likely: score >= threshold,
    reasons,
    signals: { name: name.hit, question, request, handoff, group, secondPerson, deliberation, strongAlt, weakAlt },
  };
}
