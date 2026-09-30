import '@src/index.css';
import ProviderSection from './features/provider/ProviderSection';
import RecognitionSection from './features/recognition/RecognitionSection';
import { useConfig, useModels, useTestConnection, withErrorBoundary, withSuspense } from '@extension/shared';
import { Button, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useState } from 'react';

const Options = () => {
  const { config, patchLocal, save } = useConfig();
  const {
    models,
    loading: modelsLoading,
    error: modelsError,
    load: loadModels,
  } = useModels(config?.baseUrl ?? '', config?.apiKey ?? '');
  const { testing, result, run: runTest } = useTestConnection();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (savedAt === 0) return;
    const t = window.setTimeout(() => setSavedAt(0), 2500);
    return () => window.clearTimeout(t);
  }, [savedAt]);

  const onSave = async () => {
    setSaving(true);
    try {
      await save();
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="bg-ep-bg flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

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
          config={config}
          patch={patchLocal}
          models={models}
          modelsLoading={modelsLoading}
          modelsError={modelsError}
          onLoadModels={loadModels}
        />

        <RecognitionSection config={config} patch={patchLocal} />
      </div>

      {/* Sticky action bar */}
      <div className="border-ep-border bg-ep-bg/95 fixed inset-x-0 bottom-0 border-t backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-6 py-4">
          <Button variant="primary" loading={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
          <Button onClick={runTest} loading={testing}>
            Test connection
          </Button>
          {savedAt > 0 && <span className="animate-fade-in text-[12px] text-[var(--ep-success)]">Saved ✓</span>}
          {result && !testing && (
            <span
              className={
                result.ok
                  ? 'animate-fade-in truncate text-[12px] text-[var(--ep-success)]'
                  : 'animate-fade-in truncate text-[12px] text-[var(--ep-danger)]'
              }
              title={result.error}>
              {result.ok ? `✓ ${((result.latencyMs ?? 0) / 1000).toFixed(1)}s — model replied` : `✗ ${result.error}`}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(Options, <LoadingSpinner />), ErrorDisplay);
