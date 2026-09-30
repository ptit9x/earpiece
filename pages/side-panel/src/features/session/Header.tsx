import { t } from '@extension/i18n';
import type { ScenarioInfo } from '../types';

type Props = {
  listening: boolean;
  error: string;
  scenarios: ScenarioInfo[];
  activeScenario: string;
  onScenarioChange: (id: string) => void;
  onOpenSettings: () => void;
};

const Header = ({ listening, error, scenarios, activeScenario, onScenarioChange, onOpenSettings }: Props) => {
  const orbClass = listening
    ? 'bg-[var(--ep-success)] animate-pulse-dot'
    : error
      ? 'bg-[var(--ep-danger)]'
      : 'bg-[var(--ep-text-faint)]';

  const statusText = listening ? t('panelStatusListening') : t('panelStatusIdle');

  return (
    <header className="border-ep-border flex items-center justify-between border-b px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className="shadow-ep-glow flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--ep-accent)] to-[var(--ep-accent-2)] text-sm">
          🎧
        </div>
        <div className="leading-tight">
          <h1 className="text-[15px] font-semibold tracking-tight">Earpiece AI</h1>
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${orbClass}`} />
            <span className="text-ep-muted text-[11px]">{statusText}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {scenarios.length > 0 && (
          <div className="relative">
            <select
              value={activeScenario}
              onChange={e => onScenarioChange(e.target.value)}
              title={t('panelScenario')}
              className="border-ep-border bg-ep-surface-2 text-ep-muted hover:border-ep-border-strong hover:text-ep-text cursor-pointer appearance-none rounded-full border py-1 pl-3 pr-7 text-[11px] font-medium">
              {scenarios.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="text-ep-faint pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px]">
              ▾
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          title={t('panelSettings')}
          aria-label={t('panelSettings')}
          className="border-ep-border bg-ep-surface-2 text-ep-muted hover:border-ep-border-strong hover:text-ep-text flex h-7 w-7 items-center justify-center rounded-lg border">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </header>
  );
};

export default Header;
