import ControlBar from './features/session/ControlBar';
import Header from './features/session/Header';
import StatusLine from './features/session/StatusLine';
import { useAutoScroll, useSession } from './features/session/useSession';
import SuggestionCard from './features/suggestion/SuggestionCard';
import EmptyState from './features/transcript/EmptyState';
import Transcript from './features/transcript/Transcript';
import { t } from '@extension/i18n';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useState } from 'react';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const session = useSession();
  const { ref: transcriptRef, onContentGrows } = useAutoScroll<HTMLDivElement>();
  const [autoTranslate, setAutoTranslate] = useState(false);

  useEffect(() => {
    onContentGrows();
  }, [session.turns, onContentGrows]);

  // Auto-translate: fire translation for remote turns that don't have one yet.
  useEffect(() => {
    if (!autoTranslate) return;
    const pending = session.turns.filter(turn => turn.speaker !== 'me' && !session.translations[turn.id]);
    pending.forEach(turn => session.translateTurn(turn.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTranslate, session.turns]);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className={`${isLight ? '' : 'dark'} bg-ep-bg text-ep-text flex h-screen w-full flex-col font-sans`}>
      <Header
        listening={session.listening}
        error={session.error}
        onOpenSettings={() => chrome.runtime.openOptionsPage()}
        onOpenFullView={() => chrome.tabs.create({ url: chrome.runtime.getURL('side-panel/index.html') })}
      />

      {session.scenarios.length > 0 && (
        <div className="px-4 pb-1 pt-4">
          <div className="relative">
            <select
              value={session.activeScenario}
              onChange={e => session.changeScenario(e.target.value)}
              title={t('panelScenario')}
              className="border-ep-border bg-ep-surface text-ep-text hover:border-ep-border-strong w-full cursor-pointer appearance-none rounded-xl border py-2.5 pl-4 pr-10 text-[13px] font-medium shadow-sm transition-colors focus:border-[var(--ep-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--ep-accent)]">
              {session.scenarios.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span className="text-ep-muted pointer-events-none absolute right-4 top-1/2 -translate-y-1/2">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </div>
        </div>
      )}

      <ControlBar
        listening={session.listening}
        busy={false}
        onToggle={session.toggleListening}
        onAnswerLast={session.answerLast}
      />

      <StatusLine
        error={session.error}
        status={session.status}
        warning={session.warning}
        debugMode={session.debugMode}
      />

      <SuggestionCard
        suggestion={session.suggestion}
        thinking={session.thinking}
        message={session.notice}
        onCopy={copyText}
      />

      {session.turns.length === 0 ? (
        <EmptyState />
      ) : (
        <div ref={transcriptRef} className="flex flex-1 flex-col overflow-y-auto">
          <Transcript
            turns={session.turns}
            translations={session.translations}
            autoTranslate={autoTranslate}
            onAutoTranslateChange={setAutoTranslate}
            onSuggest={session.suggestTurn}
            onTranslate={session.translateTurn}
            onCopy={copyText}
          />
        </div>
      )}

      {/* Promotional Footer */}
      <div className="border-ep-border bg-ep-surface text-ep-text-muted border-t py-2 text-center text-[11px] opacity-80 transition-opacity hover:opacity-100">
        Made with ❤️ by{' '}
        <a
          href="https://www.youtube.com/@laptrinhlacuocsong"
          target="_blank"
          rel="noopener noreferrer"
          className="decoration-ep-border hover:decoration-ep-text font-medium underline">
          Lập Trình Là Cuộc Sống
        </a>
      </div>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
