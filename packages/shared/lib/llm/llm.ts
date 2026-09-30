/* eslint-disable */
// @ts-nocheck
// Provider dispatch. The rest of the pipeline does not care which backend
// answers, only that it gets {for_me, intent, reply, alt}.

import { suggestReply as suggestReplyAnthropic, completeText } from './claude-client.js';
import {
  suggestReplyOpenAICompatible,
  completeTextOpenAICompatible,
  DEFAULT_BASE_URL,
} from './openai-compatible-client.js';
import { TRANSLATE_SYSTEM, buildTranslateMessage, cleanTranslation } from './translate.js';

export { DEFAULT_BASE_URL };

export function suggestReply(cfg, call) {
  if (cfg.provider === 'openai-compatible') {
    return suggestReplyOpenAICompatible({
      apiKey: cfg.apiKey,
      baseUrl: cfg.baseUrl,
      model: cfg.model,
      maxTokens: cfg.maxTokens,
      disableThinking: cfg.disableThinking !== false,
      ...call,
    });
  }
  return suggestReplyAnthropic({
    apiKey: cfg.apiKey,
    model: cfg.model,
    maxTokens: cfg.maxTokens,
    ...call,
  });
}

// Translation is a fraction of the work a suggestion is, so it gets its own
// small budget rather than the suggestion one.
const TRANSLATE_MAX_TOKENS = 220;

export async function translate(cfg, text, signal) {
  const args = {
    model: cfg.model,
    maxTokens: TRANSLATE_MAX_TOKENS,
    system: TRANSLATE_SYSTEM,
    user: buildTranslateMessage(text),
    signal,
  };

  const raw =
    cfg.provider === 'openai-compatible'
      ? await completeTextOpenAICompatible({
          apiKey: cfg.apiKey,
          baseUrl: cfg.baseUrl,
          disableThinking: cfg.disableThinking !== false,
          ...args,
        })
      : await completeText({ apiKey: cfg.apiKey, ...args });

  return cleanTranslation(raw);
}
