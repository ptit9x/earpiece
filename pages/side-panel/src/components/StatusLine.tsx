import { t } from '@extension/i18n';

type Props = {
  error: string;
  status: string;
  warning: string;
  debugMode: boolean;
};

const StatusLine = ({ error, status, warning, debugMode }: Props) => {
  if (!error && !status && !warning && !debugMode) return null;

  return (
    <div className="animate-fade-in space-y-1.5 px-4 pb-1 pt-1 text-[12px]">
      {error && (
        <p className="border-[var(--ep-danger)]/25 bg-[var(--ep-danger)]/10 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[var(--ep-danger)]">
          <span>⚠</span>
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}
      {!error && status && <p className="text-ep-muted pl-1">{status}</p>}
      {warning && (
        <p className="border-[var(--ep-warning)]/25 bg-[var(--ep-warning)]/10 flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-[var(--ep-warning)]">
          <span>○</span>
          <span className="min-w-0 break-words">{warning}</span>
        </p>
      )}
      {debugMode && (
        <p className="border-[var(--ep-warning)]/40 rounded-lg border border-dashed px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-[var(--ep-warning)]">
          {t('panelDebugBanner')}
        </p>
      )}
    </div>
  );
};

export default StatusLine;
