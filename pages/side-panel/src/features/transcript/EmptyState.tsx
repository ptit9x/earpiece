import { t } from '@extension/i18n';

const BARS = [0.55, 0.85, 1, 0.7, 0.45, 0.8, 0.5, 0.65, 0.9, 0.4, 0.75, 0.6];

const EmptyState = () => (
  <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-8 text-center">
    <div className="flex h-16 items-center gap-1.5" aria-hidden>
      {BARS.map((h, i) => (
        <span
          key={i}
          className="w-1.5 origin-center rounded-full bg-gradient-to-t from-[var(--ep-accent)] to-[var(--ep-accent-2)] opacity-70"
          style={{
            height: `${h * 56}px`,
            animation: `wave-bar 1.15s ease-in-out ${(i * 0.09).toFixed(2)}s infinite`,
          }}
        />
      ))}
    </div>
    <div>
      <p className="text-ep-muted text-[13px] font-medium">{t('panelWaiting')}</p>
      <p className="text-ep-faint mt-1.5 text-[11px]">{t('panelTranscriptHint')}</p>
    </div>
  </div>
);

export default EmptyState;
