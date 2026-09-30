import { t } from '@extension/i18n';

type Props = {
  listening: boolean;
  busy: boolean;
  onToggle: () => void;
  onAnswerLast: () => void;
};

const ControlBar = ({ listening, busy, onToggle, onAnswerLast }: Props) => (
  <div className="flex gap-2 p-4 pb-2">
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      className={
        listening
          ? 'rounded-ep shadow-ep bg-[var(--ep-danger)]/90 flex-1 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ep-danger)] active:scale-[0.98] disabled:opacity-60'
          : 'rounded-ep shadow-ep-glow flex-1 bg-gradient-to-r from-[var(--ep-accent)] to-[var(--ep-accent-2)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-60'
      }>
      {listening ? t('panelStopListening') : t('panelStartListening')}
    </button>
    <button
      type="button"
      onClick={onAnswerLast}
      disabled={busy}
      className="rounded-ep border-ep-border bg-ep-surface-2 text-ep-muted hover:border-ep-border-strong hover:text-ep-text border px-4 py-2.5 text-sm font-medium active:scale-[0.98] disabled:opacity-60">
      ✨ {t('panelAnswerThat')}
    </button>
  </div>
);

export default ControlBar;
