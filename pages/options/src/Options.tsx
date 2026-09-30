import '@src/index.css';
import ProviderSection from './features/provider/ProviderSection';
import RecognitionSection from './features/recognition/RecognitionSection';
import {
  useConfigQuery,
  useModelsQuery,
  useTestConnectionMutation,
  withErrorBoundary,
  withSuspense,
} from '@extension/shared';
import { Button, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useState } from 'react';
import type { EarpieceConfig } from '@extension/shared';

const Options = () => {
  // Config query: cached, revalidated after each save via setQueryData
  const { data: config, isLoading, saveMutation } = useConfigQuery();
  const [draft, setDraft] = useState<EarpieceConfig | null>(null);

  // Keep the local draft in sync whenever fresh config arrives (first load / revalidate)
  useEffect(() => {
    if (config) setDraft(d => d ?? config);
  }, [config]);

  // Test connection: mutation (never cached)
  const test = useTestConnectionMutation();

  // Models: cached per baseUrl for 6h — switching providers or URLs refetches automatically
  const {
    data: models,
    isFetching: modelsLoading,
    error: modelsError,
    refetch: refetchModels,
  } = useModelsQuery(draft?.baseUrl ?? '', draft?.apiKey ?? '', draft?.provider === 'openai-compatible');

  // Test connection: mutation (never cached)
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (savedAt === 0) return;
    const t = window.setTimeout(() => setSavedAt(0), 2500);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  if (isLoading || !draft) {
    return (
      <div className="bg-ep-bg dark flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const patch = (p: Partial<EarpieceConfig>) => setDraft(d => (d ? { ...d, ...p } : d));

  const onSave = async () => {
    await saveMutation.mutateAsync(draft);
    setSavedAt(Date.now());
  };

  return (
    <div className="bg-ep-bg text-ep-text dark min-h-screen font-sans">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-8 pb-24">
        <header className="flex items-center gap-3">
          <div className="shadow-ep-glow flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--ep-accent)] to-[var(--ep-accent-2)] text-base">
            🎧
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Earpiece AI — Settings</h1>
            <p className="text-ep-muted text-[12px]">Provider, model and recognition options</p>
          </div>
        </header>

        <ProviderSection
          config={draft}
          patch={patch}
          models={models ?? []}
          modelsLoading={modelsLoading}
          modelsError={modelsError instanceof Error ? modelsError.message : ''}
          onLoadModels={() => refetchModels()}
        />

        <RecognitionSection config={draft} patch={patch} />
      </div>

      {/* Sticky action bar */}
      <div className="border-ep-border bg-ep-bg/95 fixed inset-x-0 bottom-0 border-t backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <Button variant="primary" loading={saveMutation.isPending} onClick={onSave}>
            {saveMutation.isPending ? 'Saving…' : 'Save settings'}
          </Button>
          <Button onClick={() => test.mutate()} loading={test.isPending}>
            Test connection
          </Button>
          {savedAt > 0 && <span className="animate-fade-in text-[12px] text-[var(--ep-success)]">Saved ✓</span>}
          {test.data && !test.isPending && (
            <span
              className={
                test.data.ok
                  ? 'animate-fade-in truncate text-[12px] text-[var(--ep-success)]'
                  : 'animate-fade-in truncate text-[12px] text-[var(--ep-danger)]'
              }
              title={test.data.error}>
              {test.data.ok
                ? `✓ ${((test.data.latencyMs ?? 0) / 1000).toFixed(1)}s — model replied`
                : `✗ ${test.data.error}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
