/* eslint-disable */
// @ts-nocheck
// What kind of conversation this is.
//
// The same sentence needs a different answer depending on the room. "Can you
// walk me through that?" in an interview wants a worked example; in a design
// discussion it wants a short explanation; in a standup it wants one line and
// a promise to follow up. Without this the model defaults to the same
// register everywhere, which reads as evasive in an interview and as
// over-explaining in a standup.

export const BUILT_IN = [
  {
    id: 'discussion',
    name: 'Team discussion',
    detail: 'Design debates, planning, anything where opinions are being traded.',
    instructions: `This is a working discussion between peers. The user is expected to have and give opinions.
- Offer a clear position, a cautious or alternative position, and a way to defer or gather more information.
- It is fine to disagree directly; engineers do.
- Short is better than complete. The conversation continues.`,
  },
  {
    id: 'interview-candidate',
    name: 'Interview — I am the candidate',
    detail: 'You are being interviewed. Answers should show reasoning and experience.',
    instructions: `The user is the CANDIDATE being interviewed. Everything they say is being assessed.
- Answer the question directly first, then offer to go deeper. Never dodge.
- Prefer a concrete answer grounded in real work over an abstract one.
- Do not invent projects, numbers, employers, or results the user has not mentioned. If a specific example is needed and none is in the transcript, phrase the option so the user can fill in their own.
- Asking a short clarifying question is fine once, but never as the first option unless the question was genuinely ambiguous.
- Slightly longer answers are acceptable here: up to 30 words.
- Never sound uncertain about the user's own experience.`,
  },
  {
    id: 'interview-interviewer',
    name: 'Interview — I am the interviewer',
    detail: 'You are running the interview. Suggestions are probes and follow-ups.',
    instructions: `The user is the INTERVIEWER. They are assessing the other person.
- Offer follow-up probes, not answers: dig into what the candidate just claimed.
- One option should push for a concrete example, one should test the edge case or trade-off, one should move the interview on.
- Neutral and friendly. Never reveal an opinion about the answer.`,
  },
  {
    id: 'standup',
    name: 'Daily standup',
    detail: 'Short status round. Brevity matters more than anywhere else.',
    instructions: `This is a standup. Everyone is waiting.
- One sentence. Ten words where possible.
- Status, blocker, or a commitment to follow up after the call. Nothing else.
- Never open a discussion; offer to take it offline instead.`,
  },
  {
    id: 'client',
    name: 'Client or stakeholder call',
    detail: 'Non-engineers in the room. Careful with commitments.',
    instructions: `The other side is a client or stakeholder, not an engineer.
- Plain language. No internal jargon, no component names, no ticket IDs.
- Never commit to a date, a scope, or a cost. Offer to confirm internally instead.
- Warm and steady. Acknowledge the concern before answering it.`,
  },
  {
    id: 'one-on-one',
    name: '1:1 with my manager',
    detail: 'Private conversation about work, progress, or problems.',
    instructions: `This is a private 1:1 with the user's manager.
- Honest and direct. Understating a problem helps nobody.
- One option should name the real issue, one should propose what the user needs, one should ask for their view.
- Never defensive.`,
  },
  {
    id: 'code-review',
    name: 'Code review / PR walkthrough',
    detail: 'Discussing a specific change, line by line.',
    instructions: `The conversation is about a specific code change.
- Answer about the code, not about the process.
- One option should explain the reasoning behind the current approach, one should concede and offer to change it, one should ask what they would prefer.
- Accepting a review comment is normal. Do not be defensive about the code.`,
  },
];

export const DEFAULT_SCENARIO = 'discussion';

/**
 * User-defined scenarios from a textarea. Blocks separated by a line of
 * three or more dashes; the first line of each block is the name and the
 * rest is the instruction text.
 */
export function parseScenarios(raw) {
  return String(raw || '')
    .split(/^\s*-{3,}\s*$/m)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const [first, ...rest] = block.split('\n');
      const name = first
        .replace(/^#+\s*/, '')
        .replace(/:$/, '')
        .trim();
      const instructions = rest.join('\n').trim();
      return { name, instructions };
    })
    .filter(s => s.name && s.instructions)
    .map(s => ({ ...s, id: `custom:${slug(s.name)}`, custom: true }))
    .slice(0, 20);
}

function slug(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled'
  );
}

export function allScenarios(custom = []) {
  return [...BUILT_IN, ...custom];
}

export function findScenario(id, custom = []) {
  const list = allScenarios(custom);
  return list.find(s => s.id === id) || list.find(s => s.id === DEFAULT_SCENARIO) || list[0];
}

// Rendered into the prompt. Empty for a scenario with nothing to say, so the
// prompt does not carry a dangling header.
export function scenarioBlock(scenario) {
  if (!scenario?.instructions) return '';
  return `\nTHIS CONVERSATION\n${scenario.name}.\n${scenario.instructions}`;
}
