// Feature: AI provider configuration (provider type, endpoint, key, model).
import { Button, Card, Field, Input } from '@extension/ui';
import type { ModelInfo } from '@extension/shared';
import type { EarpieceConfig } from '@extension/shared/lib/hooks/use-config';

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', hint: 'api.anthropic.com' },
  { id: 'openai-compatible', label: 'OpenAI-compatible', hint: 'OpenRouter, Groq, local…' },
] as const;

type Props = {
  config: EarpieceConfig;
  patch: (p: Partial<EarpieceConfig>) => void;
  models: ModelInfo[];
  modelsLoading: boolean;
  modelsError: string;
  onLoadModels: () => void;
};

const ProviderSection = ({ config, patch, models, modelsLoading, modelsError, onLoadModels }: Props) => {
  const isCompat = config.provider === 'openai-compatible';

  return (
    <Card title="AI Provider">
      <div className="mb-4 grid grid-cols-2 gap-2">
        {PROVIDERS.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => patch({ provider: p.id })}
            className={
              config.provider === p.id
                ? 'rounded-ep bg-[var(--ep-accent)]/10 border border-[var(--ep-accent)] px-3 py-2.5 text-left'
                : 'rounded-ep border-ep-border bg-ep-bg hover:border-ep-border-strong border px-3 py-2.5 text-left'
            }>
            <div className="text-[13px] font-medium">{p.label}</div>
            <div className="text-ep-faint text-[11px]">{p.hint}</div>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {isCompat && (
          <Field label="Base URL">
            <Input
              value={config.baseUrl}
              onChange={e => patch({ baseUrl: e.target.value })}
              placeholder="https://openrouter.ai/api/v1"
              spellCheck={false}
            />
          </Field>
        )}

        <Field label="API Key" hint="Stored in chrome.storage.local on this machine only.">
          <Input
            type="password"
            value={config.apiKey}
            onChange={e => patch({ apiKey: e.target.value })}
            placeholder="sk-…"
            spellCheck={false}
          />
        </Field>

        <Field label="Model">
          <div className="flex gap-2">
            <Input
              value={config.model}
              onChange={e => patch({ model: e.target.value })}
              placeholder={isCompat ? 'meta-llama/llama-4-scout:free' : 'claude-haiku-4-5'}
              spellCheck={false}
            />
            {isCompat && (
              <Button onClick={onLoadModels} loading={modelsLoading} className="shrink-0" size="sm">
                Fetch
              </Button>
            )}
          </div>
          {modelsError && <p className="mt-1 text-[11px] text-[var(--ep-danger)]">{modelsError}</p>}
          {models.length > 0 && (
            <div className="rounded-ep border-ep-border mt-2 max-h-44 overflow-y-auto border">
              {models.slice(0, 100).map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => patch({ model: m.id })}
                  className={
                    config.model === m.id
                      ? 'bg-[var(--ep-accent)]/10 flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px]'
                      : 'hover:bg-ep-surface-2 flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px]'
                  }>
                  <span className="truncate">{m.id}</span>
                  {m.free && <span className="ml-2 shrink-0 text-[10px] font-bold text-[var(--ep-success)]">FREE</span>}
                </button>
              ))}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Max tokens">
            <Input
              type="number"
              value={config.maxTokens}
              onChange={e => patch({ maxTokens: Number(e.target.value) })}
            />
          </Field>
          <Field label="Timeout (ms)">
            <Input
              type="number"
              value={config.requestTimeoutMs}
              onChange={e => patch({ requestTimeoutMs: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>
    </Card>
  );
};

export default ProviderSection;
