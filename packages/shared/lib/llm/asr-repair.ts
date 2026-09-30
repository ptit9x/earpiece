/* eslint-disable */
// @ts-nocheck
// Repairing recognised speech before anything reads it.
//
// Two different problems arrive in the same string:
//
//   1. Vocabulary. Speech recognition spells acronyms out, splits compounds,
//      and substitutes near-homophones: "you ate" for UAT, "guarding" for
//      regarding, "type script" for TypeScript. These are deterministic and
//      worth fixing here, for free, BEFORE target detection runs - detection
//      matches on names and phrases, so a mangled word does not just read
//      badly, it loses the whole utterance silently.
//
//   2. Grammar. Non-native speakers drop articles, mismatch tenses, reorder
//      clauses. Guessing at that locally means inventing meaning. The model
//      handles it from context, and the prompt tells it to.
//
// So: vocabulary here, grammar in the prompt. Nothing in this file changes
// what a sentence means - it only restores the word that was said.

// Ordered: earlier entries win, so longer phrases come first.
const COMMON_FIXES = [
  // Acronyms the recogniser spells out letter by letter.
  [/\byou (?:ate|eight|eighty)\b/gi, 'UAT'],
  [/\bu\.? ?a\.? ?t\b/gi, 'UAT'],
  [/\byou\.? ?eye\b/gi, 'UI'],
  [/\bu\.? ?i\b/gi, 'UI'],
  [/\bu\.? ?x\b/gi, 'UX'],
  [/\ba\.? ?p\.? ?i\b/gi, 'API'],
  [/\bc\.? ?s\.? ?s\b/gi, 'CSS'],
  [/\bh\.? ?t\.? ?m\.? ?l\b/gi, 'HTML'],
  [/\bs\.? ?q\.? ?l\b/gi, 'SQL'],
  [/\bq\.? ?a\b/gi, 'QA'],
  [/\bp\.? ?r\b/gi, 'PR'],
  [/\bp\.? ?m\b/gi, 'PM'],
  [/\bp\.? ?o\b/gi, 'PO'],
  [/\bi\.? ?d\.? ?e\b/gi, 'IDE'],

  // Compounds the recogniser splits.
  [/\btype ?script\b/gi, 'TypeScript'],
  [/\bjava ?script\b/gi, 'JavaScript'],
  [/\bfront ?end\b/gi, 'frontend'],
  [/\bback ?end\b/gi, 'backend'],
  [/\bcode ?base\b/gi, 'codebase'],
  [/\bgit ?hub\b/gi, 'GitHub'],
  [/\bdrop ?down\b/gi, 'dropdown'],
  [/\bcheck ?box\b/gi, 'checkbox'],
  [/\bplace ?holder\b/gi, 'placeholder'],
  [/\bend ?point\b/gi, 'endpoint'],
  [/\bweb ?hook\b/gi, 'webhook'],

  // Near-homophones seen repeatedly in real transcripts.
  [/\bguarding\b/gi, 'regarding'],
  [/\bfig ?ma\b/gi, 'Figma'],
  [/\bdocker ?file\b/gi, 'Dockerfile'],
  [/\bre ?factor\b/gi, 'refactor'],
  [/\bre ?deploy\b/gi, 'redeploy'],
];

// Distance capped low: this substitutes a word the speaker did not say, so it
// must be nearly certain.
function editDistance(a, b, cap) {
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

// A glossary term is worth substituting only when the heard word is close AND
// long enough that closeness means something. "cart" and "card" are one edit
// apart and are different words; "componnet" and "component" are not.
function allowedDistance(term) {
  if (term.length <= 4) return 0;
  if (term.length <= 7) return 1;
  return 2;
}

/**
 * @param {string} text  raw recogniser output
 * @param {string[]} glossary  project vocabulary: component names, product
 *   names, teammates, repo names - the words a general model has never seen
 *   and the recogniser therefore always gets wrong
 * @returns {{text: string, fixes: Array<{from: string, to: string}>}}
 */
export function repairTranscript(text, glossary = []) {
  const original = String(text || '');
  if (!original.trim()) return { text: original, fixes: [] };

  const fixes = [];
  let out = original;

  for (const [pattern, replacement] of COMMON_FIXES) {
    out = out.replace(pattern, match => {
      if (match.toLowerCase() !== replacement.toLowerCase()) {
        fixes.push({ from: match, to: replacement });
      }
      return replacement;
    });
  }

  const terms = glossary.map(t => String(t || '').trim()).filter(Boolean);
  if (terms.length) {
    out = out.replace(/[A-Za-z][A-Za-z'-]*/g, word => {
      const lower = word.toLowerCase();
      for (const term of terms) {
        const t = term.toLowerCase();
        if (lower === t) return term; // fix the casing at least
        if (Math.abs(lower.length - t.length) > 2) continue;
        const cap = allowedDistance(t);
        if (cap > 0 && editDistance(lower, t, cap) <= cap) {
          fixes.push({ from: word, to: term });
          return term;
        }
      }
      return word;
    });
  }

  return { text: out, fixes };
}

// Parsed from a textarea: one term per line, or comma separated.
export function parseGlossary(raw) {
  return String(raw || '')
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 200);
}
