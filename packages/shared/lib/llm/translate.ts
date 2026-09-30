/* eslint-disable */
// @ts-nocheck
// Manual translation of a captured line.
//
// Separate from reply generation on purpose: this is not "what should I say",
// it is "what did they just say". Different prompt, plain-text output, much
// smaller token budget.

export const TRANSLATE_SYSTEM = `You translate one line of English meeting speech into Vietnamese for a Vietnamese software engineer.

Rules:
- Translate the meaning, not the words.
- Everyday spoken Vietnamese, the way a developer talks to a colleague. Use "mình" for the speaker.
- Keep technical terms in English: UI, UAT, Figma, component, API, PR, ticket, staging, deploy, merge, build, endpoint, props, state.
- Speech recognition output has no punctuation and contains mistakes. Translate what the person clearly meant. Do not correct them or comment on it.
- Output the Vietnamese only. No quotes, no notes, no romanisation, no English.`;

export function buildTranslateMessage(text) {
  return `Translate this line:\n\n${text}`;
}

// Models sometimes wrap the answer in quotes or prefix it with a label, even
// when told not to. Strip the common shapes rather than showing them.
export function cleanTranslation(raw) {
  let out = String(raw || '').trim();
  out = out
    .replace(/^```[a-z]*\s*/i, '')
    .replace(/```$/, '')
    .trim();
  out = out.replace(/^(?:vietnamese|tiếng việt|translation|bản dịch)\s*[:\-–]\s*/i, '');
  // Only unwrap when the whole string is quoted, so an internal quote survives.
  const quoted = out.match(/^"([\s\S]*)"$/) || out.match(/^'([\s\S]*)'$/);
  if (quoted) out = quoted[1];
  return out.trim();
}
