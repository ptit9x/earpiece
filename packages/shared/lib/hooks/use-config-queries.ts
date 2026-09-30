// Feature: config + model catalog queries (TanStack Query).
// Replaces the ad-hoc useState/useEffect data flows in options/side panel:
// - config loads once, cached, invalidated after save
// - models cached per baseUrl (staleTime 6h — matches backend cache)
// - test-connection is a mutation (never cached, always fresh)

import { queryKeys } from '../query/client.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EarpieceConfig, ModelInfo, TestResult } from './use-config.js';

/** Raw fetchers — plain functions, easy to test. */
export const fetchConfig = async (): Promise<EarpieceConfig> => {
  const res = await chrome.runtime.sendMessage({ type: 'get-state' });
  if (!res?.ok) throw new Error(res?.error || 'Could not load config.');
  return res.config as EarpieceConfig;
};

export const saveConfig = async (patch: Partial<EarpieceConfig>): Promise<EarpieceConfig> => {
  const res = await chrome.runtime.sendMessage({ type: 'set-config', patch });
  return res?.config as EarpieceConfig;
};

export const testConnection = async (): Promise<TestResult> => {
  const res = await chrome.runtime.sendMessage({ type: 'test-connection' });
  return (res ?? { ok: false, error: 'No response' }) as TestResult;
};

export const fetchModels = async (baseUrl: string, apiKey: string): Promise<ModelInfo[]> => {
  const root = (baseUrl || '').replace(/\/+$/, '');
  if (!root) throw new Error('No base URL set.');
  const headers: Record<string, string> = {};
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const res = await fetch(`${root}/models`, { headers });
  if (!res.ok) throw new Error(`${new URL(root).host} ${res.status}`);
  const json = await res.json();
  const raw = (json?.data || json?.models || []) as Record<string, unknown>[];
  return raw
    .map(m => {
      const pricing = (m.pricing ?? {}) as { prompt?: string };
      const promptPrice = Number(pricing.prompt ?? 0) || undefined;
      const id = String(m.id || '');
      return {
        id,
        contextLength: Number(m.context_length ?? m.contextLength ?? 0) || undefined,
        promptPrice,
        free: id.includes(':free') || promptPrice === 0,
      } satisfies ModelInfo;
    })
    .filter(m => m.id)
    .sort((a, b) => a.id.localeCompare(b.id));
};

/* ---------------- Hooks ---------------- */

export const useConfigQuery = () => {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.config,
    queryFn: fetchConfig,
    staleTime: 60 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<EarpieceConfig>) => saveConfig(patch),
    onSuccess: saved => qc.setQueryData(queryKeys.config, saved),
  });

  return { ...query, saveMutation };
};

export const useModelsQuery = (baseUrl: string, apiKey: string, enabled = true) =>
  useQuery({
    queryKey: queryKeys.models(baseUrl),
    queryFn: () => fetchModels(baseUrl, apiKey),
    enabled: enabled && Boolean(baseUrl),
    staleTime: 6 * 60 * 60 * 1000, // mirror the backend 6h catalog cache
    gcTime: 24 * 60 * 60 * 1000,
  });

export const useTestConnectionMutation = () => useMutation({ mutationFn: testConnection });

export const useScenariosQuery = () =>
  useQuery({
    queryKey: queryKeys.scenarios,
    queryFn: async () => {
      const res = await chrome.runtime.sendMessage({ type: 'list-scenarios' });
      if (!res?.ok) throw new Error('Could not load scenarios.');
      return { scenarios: res.scenarios, active: res.active as string };
    },
    staleTime: 10 * 60 * 1000,
  });
