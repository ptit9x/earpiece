/* eslint-disable */
// @ts-nocheck
import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { normalizeSuggestion, emptySuggestion } from './suggestion.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export class ApiError extends Error {
  constructor(message, { status, retriable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.retriable = retriable;
  }
}

/**
 * One suggestion round trip. Caller is expected to abort the previous call
 * when a newer utterance arrives: an answer to a question the room has
 * already moved past is worse than no answer.
 */
export async function suggestReply({
  apiKey,
  model,
  maxTokens,
  transcript,
  incoming,
  userName,
  detection,
  glossary = [],
  scenario = null,
  forced = false,
  signal,
}) {
  if (!apiKey) throw new ApiError('No API key set. Open the extension popup.', { status: 0 });

  const body = {
    model,
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    // Low temperature: we want the same boring natural sentence every time,
    // not creative variety the user has to evaluate under time pressure.
    temperature: 0.3,
    messages: [
      {
        role: 'user',
        content: buildUserMessage({ transcript, incoming, userName, detection, glossary, scenario, forced }),
      },
      // Prefilling the opening brace forces raw JSON and removes the
      // "Here's the JSON:" preamble that costs latency and a parse failure.
      { role: 'assistant', content: '{' },
    ],
  };

  const res = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      // Required for browser-originated calls to the Messages API.
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    const retriable = res.status === 429 || res.status >= 500;
    throw new ApiError(detail || `Claude API ${res.status}`, { status: res.status, retriable });
  }

  const json = await res.json();
  const text = (json?.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');

  if (json?.stop_reason === 'max_tokens') {
    throw new ApiError(`Answer was cut off at the ${maxTokens}-token cap. Raise "Max reply tokens" in settings.`, {
      status: 0,
    });
  }

  return {
    ...parseSuggestion(`{${text}`),
    usage: json?.usage || null,
  };
}

function parseSuggestion(raw) {
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return emptySuggestion();
    return normalizeSuggestion(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    return emptySuggestion();
  }
}

/**
 * A plain text round trip, for jobs that are not suggestion generation
 * (translation, today). No JSON, no prefill, small budget.
 */
export async function completeText({ apiKey, model, maxTokens, system, user, signal }) {
  if (!apiKey) throw new ApiError('No API key set. Open the extension popup.', { status: 0 });

  const res = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0.2,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) {
    let detail = '';
    try {
      detail = (await res.json())?.error?.message || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new ApiError(detail || `Claude API ${res.status}`, {
      status: res.status,
      retriable: res.status === 429 || res.status >= 500,
    });
  }

  const json = await res.json();
  return (json?.content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}
