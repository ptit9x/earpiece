import ControlBar from './features/session/ControlBar';
import Header from './features/session/Header';
import StatusLine from './features/session/StatusLine';
import { useAutoScroll, useSession } from './features/session/useSession';
import SuggestionCard from './features/suggestion/SuggestionCard';
import EmptyState from './features/transcript/EmptyState';
import Transcript from './features/transcript/Transcript';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect } from 'react';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);
  const session = useSession();
  const { ref: transcriptRef, onContentGrows } = useAutoScroll<HTMLDivElement>();

  useEffect(() => {
    onContentGrows();
  }, [session.turns, onContentGrows]);

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
        scenarios={session.scenarios}
        activeScenario={session.activeScenario}
        onScenarioChange={session.changeScenario}
        onOpenSettings={() => chrome.runtime.openOptionsPage()}
      />

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
            onSuggest={session.suggestTurn}
            onTranslate={session.translateTurn}
            onCopy={copyText}
          />
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
