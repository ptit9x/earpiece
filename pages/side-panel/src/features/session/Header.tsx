import { t } from '@extension/i18n';
import { Header as CommonHeader } from '@extension/ui';

type Props = {
  listening: boolean;
  error: string;
  onOpenSettings: () => void;
  onOpenFullView: () => void;
};

const Header = ({ listening, error, onOpenSettings, onOpenFullView }: Props) => {
  const orbClass = listening
    ? 'bg-[var(--ep-success)] animate-pulse-dot'
    : error
      ? 'bg-[var(--ep-danger)]'
      : 'bg-[var(--ep-text-faint)]';

  const statusText = listening ? t('panelStatusListening') : t('panelStatusIdle');

  return (
    <CommonHeader
      className="border-ep-border border-b px-4 py-3"
      title={
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${orbClass}`} />
          <span className="truncate text-base">{statusText}</span>
        </div>
      }
      actionContent={
        <>
          <button
            type="button"
            onClick={onOpenFullView}
            title={t('panelOpenFull')}
            aria-label={t('panelOpenFull')}
            className="border-ep-border bg-ep-surface-2 text-ep-muted hover:border-ep-border-strong hover:text-ep-text flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            title={t('panelSettings')}
            aria-label={t('panelSettings')}
            className="border-ep-border bg-ep-surface-2 text-ep-muted hover:border-ep-border-strong hover:text-ep-text flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </>
      }
    />
  );
};

export default Header;
