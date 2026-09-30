// Feature: config access from extension pages (options / side panel).
// Wraps the runtime message protocol in a typed React hook.

import { useCallback, useEffect, useState } from 'react';

export type EarpieceConfig = {
  userName: string;
  userAliases: string[];
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  disableThinking: boolean;
  requestTimeoutMs: number;
  debugAllRemote: boolean;
  glossary: string[];
  minConfidence: number;
  minWords: number;
  activeScenario: string;
  customScenarios: unknown[];
  sttLang: string;
  sttEngine: string;
  oneOnOne: boolean;
  targetThreshold: number;
  utteranceSettleMs: number;
  showVietnamese: boolean;
};

export type TestResult = { ok: boolean; latencyMs?: number; error?: string };

/** Load config once, expose patch/save. Used by the options page. */
export const useConfig = () => {
  const [config, setConfig] = useState<EarpieceConfig | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.runtime
      .sendMessage({ type: 'get-state' })
      .then((res: { ok?: boolean; config?: EarpieceConfig } | undefined) => {
        if (res?.ok && res.config) setConfig(res.config);
        else setError('Could not load config.');
      })
      .catch(e => setError(String(e)));
  }, []);

  const patchLocal = useCallback((p: Partial<EarpieceConfig>) => setConfig(c => (c ? { ...c, ...p } : c)), []);

  const save = useCallback(
    async (p?: Partial<EarpieceConfig>) => {
      const body = p ?? config ?? {};
      const res = await chrome.runtime.sendMessage({ type: 'set-config', patch: body });
      if (res?.config) setConfig(res.config as EarpieceConfig);
      return res?.config as EarpieceConfig | undefined;
    },
    [config],
  );

  return { config, error, patchLocal, save };
};

/** Fire a backend self-test against the saved config. */
export const useTestConnection = () => {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = useCallback(async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'test-connection' })) as TestResult;
      setResult(res ?? { ok: false, error: 'No response' });
    } catch (e) {
      setResult({ ok: false, error: String(e) });
    } finally {
      setTesting(false);
    }
  }, []);

  return { testing, result, run };
};

/** Fetch the model catalog from an OpenAI-compatible base URL. */
export type ModelInfo = {
  id: string;
  contextLength?: number;
  promptPrice?: number;
  free?: boolean;
};

export const useModels = (baseUrl: string, apiKey: string) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const root = (baseUrl || '').replace(/\/+$/, '');
    if (!root) {
      setError('No base URL set.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers.authorization = `Bearer ${apiKey}`;
      const res = await fetch(`${root}/models`, { headers });
      if (!res.ok) throw new Error(`${new URL(root).host} ${res.status}`);
      const json = await res.json();
      const raw = (json?.data || json?.models || []) as Record<string, unknown>[];
      const list: ModelInfo[] = raw
        .map(m => {
          const pricing = (m.pricing ?? {}) as { prompt?: string };
          const promptPrice = Number(pricing.prompt ?? 0) || undefined;
          const id = String(m.id || '');
          return {
            id,
            contextLength: Number(m.context_length ?? m.contextLength ?? 0) || undefined,
            promptPrice,
            free: id.includes(':free') || promptPrice === 0,
          };
        })
        .filter(m => m.id)
        .sort((a, b) => a.id.localeCompare(b.id));
      setModels(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, apiKey]);

  return { models, loading, error, load };
};
