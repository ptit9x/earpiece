/* eslint-disable */
// @ts-nocheck
// Adapter for any endpoint that speaks the OpenAI /chat/completions dialect:
// OpenRouter, Groq, Together, a local llama.cpp server, and most of the
// "router" services. The base URL is configurable so this is not tied to one
// vendor.
//
// Differences from the Anthropic path that matter here:
//   - No assistant prefill, so the "{" trick is unavailable. We ask for JSON
//     mode instead, and fall back to instruction-only if the server rejects it.
//   - Many free-tier models wrap JSON in markdown fences or emit a preamble,
//     so the parser is deliberately forgiving.

import { SYSTEM_PROMPT, buildUserMessage } from './prompt.js';
import { ApiError } from './claude-client.js';
import { normalizeSuggestion, emptySuggestion } from './suggestion.js';

export const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';

export async function suggestReplyOpenAICompatible({
  apiKey,
  baseUrl,
  model,
  maxTokens,
  transcript,
  incoming,
  userName,
  detection,
  glossary = [],
  scenario = null,
  forced = false,
  jsonMode = true,
  disableThinking = true,
  signal,
}) {
  if (!apiKey) throw new ApiError('No API key set. Open the extension popup.', { status: 0 });
  if (!model) throw new ApiError('No model set. Open the extension popup.', { status: 0 });

  const root = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const url = `${root}/chat/completions`;

  const headers = {
    'content-type': 'application/json',
    authorization: `Bearer ${apiKey}`,
  };
  // OpenRouter attributes traffic with these; harmless elsewhere.
  if (root.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://github.com/local/call-copilot';
    headers['X-Title'] = 'Call Copilot';
  }

  const payload = {
    model,
    max_tokens: maxTokens,
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: buildUserMessage({ transcript, incoming, userName, detection, glossary, scenario, forced }),
      },
    ],
  };
  if (jsonMode) payload.response_format = { type: 'json_object' };
  // DeepSeek V4's switch. Harmless on backends that ignore unknown fields;
  // the 400 path below covers the ones that do not.
  if (disableThinking) payload.thinking = { type: 'disabled' };

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || err?.message || '';
    } catch {
      detail = await res.text().catch(() => '');
    }

    // Some backends reject fields they do not know. Drop the offending one
    // and retry once each, rather than failing the whole suggestion.
    if (res.status === 400 && disableThinking && /thinking/i.test(detail)) {
      return suggestReplyOpenAICompatible({
        apiKey,
        baseUrl,
        model,
        maxTokens,
        transcript,
        incoming,
        userName,
        detection,
        glossary,
        scenario,
        forced,
        jsonMode,
        disableThinking: false,
        signal,
      });
    }

    // Plenty of models on routers do not implement JSON mode and reject the
    // whole request over it. One retry without it, then give up.
    if (jsonMode && res.status === 400 && /response_format|json/i.test(detail)) {
      return suggestReplyOpenAICompatible({
        apiKey,
        baseUrl,
        model,
        maxTokens,
        transcript,
        incoming,
        userName,
        detection,
        glossary,
        scenario,
        forced,
        jsonMode: false,
        disableThinking,
        signal,
      });
    }

    const retriable = res.status === 429 || res.status >= 500;
    throw new ApiError(detail || `${new URL(url).host} ${res.status}`, { status: res.status, retriable });
  }

  const json = await res.json();
  const choice = json?.choices?.[0];
  const text = choice?.message?.content ?? '';

  if (!text && choice?.finish_reason === 'length') {
    // Reasoning models spend the budget before writing any content, and put
    // that spend in a separate field. Raising max_tokens barely helps; the
    // fix is a non-reasoning model.
    const reasoning = choice?.message?.reasoning_content ?? choice?.message?.reasoning ?? '';
    const reasoningTokens =
      json?.usage?.completion_tokens_details?.reasoning_tokens ?? json?.usage?.reasoning_tokens ?? 0;

    if (reasoning || reasoningTokens > 0) {
      throw new ApiError(
        `"${model}" spent the whole ${maxTokens}-token budget on reasoning` +
          `${reasoningTokens ? ` (${reasoningTokens} tokens)` : ''} and wrote no answer. ` +
          'Turn on "Disable model thinking" in settings, or pick a non-reasoning model.',
        { status: 0 },
      );
    }
    throw new ApiError(`Answer was cut off at the ${maxTokens}-token cap. Raise "Max reply tokens" in settings.`, {
      status: 0,
    });
  }

  return {
    ...parseLooseJson(text),
    usage: json?.usage || null,
  };
}

// Free-tier models are messy. Strip fences, ignore preamble, take the first
// balanced object we can find.
export function parseLooseJson(raw) {
  const fallback = emptySuggestion();
  if (!raw) return fallback;

  let text = String(raw).trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const start = text.indexOf('{');
  if (start === -1) return fallback;

  // Walk to the matching brace rather than using lastIndexOf, which breaks
  // when the model appends commentary containing a brace.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return fallback;

  try {
    return normalizeSuggestion(JSON.parse(text.slice(start, end + 1)));
  } catch {
    return fallback;
  }
}

export async function completeTextOpenAICompatible({
  apiKey,
  baseUrl,
  model,
  maxTokens,
  system,
  user,
  disableThinking = true,
  signal,
}) {
  if (!apiKey) throw new ApiError('No API key set. Open the extension popup.', { status: 0 });
  if (!model) throw new ApiError('No model set. Open the extension popup.', { status: 0 });

  const root = (baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` };
  if (root.includes('openrouter.ai')) {
    headers['HTTP-Referer'] = 'https://github.com/local/call-copilot';
    headers['X-Title'] = 'Call Copilot';
  }

  const payload = {
    model,
    max_tokens: maxTokens,
    temperature: 0.2,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
  if (disableThinking) payload.thinking = { type: 'disabled' };

  const res = await fetch(`${root}/chat/completions`, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const err = await res.json();
      detail = err?.error?.message || err?.message || '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    if (res.status === 400 && disableThinking && /thinking/i.test(detail)) {
      return completeTextOpenAICompatible({
        apiKey,
        baseUrl,
        model,
        maxTokens,
        system,
        user,
        disableThinking: false,
        signal,
      });
    }
    throw new ApiError(detail || `${new URL(root).host} ${res.status}`, {
      status: res.status,
      retriable: res.status === 429 || res.status >= 500,
    });
  }

  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? '';
}
