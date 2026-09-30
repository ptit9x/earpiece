import { t } from '@extension/i18n';
import { useEffect, useState } from 'react';
import type { Suggestion } from '../types';

type Props = {
  suggestion: Suggestion | null;
  thinking: boolean;
  message: string;
  onCopy: (text: string) => void;
};

const SuggestionCard = ({ suggestion, thinking, message, onCopy }: Props) => {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    if (copiedIdx === null) return;
    const timer = window.setTimeout(() => setCopiedIdx(null), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedIdx]);

  if (thinking) {
    return (
      <section className="border-ep-border bg-ep-surface shadow-ep mx-4 mb-2 flex-none rounded-xl border p-4">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-[var(--ep-accent)] to-[var(--ep-accent-2)]"
                style={{ animation: `thinking-dot 1.2s ease-in-out ${i * 0.15}s infinite` }}
              />
            ))}
          </span>
          <span className="text-ep-muted text-[13px] font-medium">{t('panelThinking')}</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="ep-shimmer h-3 w-4/5 rounded" />
          <div className="ep-shimmer h-3 w-3/5 rounded" />
        </div>
      </section>
    );
  }

  if (!suggestion) {
    return (
      <section className="border-ep-border bg-ep-surface shadow-ep mx-4 mb-2 flex-none rounded-xl border p-4 text-center">
        <p className="text-ep-muted my-3 text-[13px]">{message}</p>
      </section>
    );
  }

  return (
    <section className="animate-slide-up border-ep-border-strong bg-ep-surface shadow-ep mx-4 mb-2 flex-none rounded-xl border p-4">
      {suggestion.heard && (
        <div className="mb-2.5">
          <div className="text-ep-faint mb-0.5 text-[9px] font-bold uppercase tracking-[0.14em]">{t('panelHeard')}</div>
          <div className="text-ep-muted text-[12px] italic leading-relaxed">“{suggestion.heard}”</div>
        </div>
      )}

      {suggestion.intent && (
        <div className="bg-[var(--ep-accent)]/12 mb-3 inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11px] font-semibold text-[var(--ep-accent)]">
          <span className="truncate">{suggestion.intent}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {suggestion.options.map((opt, i) => {
          const copied = copiedIdx === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                onCopy(opt.en);
                setCopiedIdx(i);
              }}
              title={t('panelCopyOpt')}
              className={
                copied
                  ? 'animate-bounce-in rounded-ep bg-[var(--ep-accent)]/12 border border-[var(--ep-accent)] p-3 text-left'
                  : 'rounded-ep border-ep-border bg-ep-bg hover:border-[var(--ep-accent)]/50 hover:shadow-ep-glow border p-3 text-left hover:-translate-y-px'
              }>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[var(--ep-accent)] to-[var(--ep-accent-2)] text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-ep-faint text-[10px] font-bold uppercase tracking-[0.12em]">
                  {copied ? t('panelCopied') : opt.label}
                </span>
              </div>
              <div className="text-ep-text text-[14px] font-medium leading-snug">{opt.en}</div>
              {opt.vi && <div className="text-ep-muted mt-1 text-[12px] leading-snug">{opt.vi}</div>}
            </button>
          );
        })}
      </div>

      {typeof suggestion.latencyMs === 'number' && suggestion.latencyMs > 0 && (
        <div className="text-ep-faint mt-2.5 text-right font-mono text-[10px]">
          ⚡ {(suggestion.latencyMs / 1000).toFixed(1)}s
        </div>
      )}
    </section>
  );
};

export default SuggestionCard;
