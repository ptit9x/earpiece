import ControlBar from './components/ControlBar';
import EmptyState from './components/EmptyState';
import Header from './components/Header';
import StatusLine from './components/StatusLine';
import SuggestionCard from './components/SuggestionCard';
import Transcript from './components/Transcript';
import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useRef, useState } from 'react';
import type { ScenarioInfo, Suggestion, Translation, Turn } from './components/types';

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);

  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [activeScenario, setActiveScenario] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [thinking, setThinking] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [message, setMessage] = useState('');

  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (msg: Record<string, unknown> | null) => {
      if (msg?.panel !== true) return;

      switch (msg.type) {
        case 'status':
          if (msg.status === 'error' && msg.detail) {
            setError(msg.detail as string);
          } else if (msg.status === 'listening') {
            setStatus('Listening.');
            setError('');
          }
          break;
        case 'thinking':
          setThinking(true);
          setSuggestion(null);
          break;
        case 'suggestion':
          setThinking(false);
          setSuggestion(msg.suggestion as Suggestion);
          setMessage('');
          break;
        case 'not-for-me':
          setThinking(false);
          setSuggestion(null);
          setMessage('Not for you. Still listening…');
          break;
        case 'turn': {
          const turnMsg = msg.turn as Turn;
          setTurns(prev => {
            const idx = prev.findIndex(t => t.id === turnMsg.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = turnMsg;
              return next;
            }
            return [...prev.slice(-11), turnMsg];
          });
          break;
        }
        case 'translation':
          setTranslations(prev => ({
            ...prev,
            [msg.turnId as string]: {
              vi: msg.vi as string,
              origin: msg.origin as string,
              pending: msg.pending as boolean,
              error: msg.error as string,
            },
          }));
          break;
        case 'warning':
          setWarning(msg.warning as string);
          break;
        case 'debug-mode':
          setDebugMode(msg.on as boolean);
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    chrome.runtime.sendMessage({ type: 'panel-ready', panel: true }).catch(() => {});
    chrome.runtime
      .sendMessage({ type: 'get-state' })
      .then((state: Record<string, unknown> | undefined) => {
        if (state?.ok && state.config) {
          setListening(state.listening as boolean);
          if (state.lastError) setError(state.lastError as string);
          else if (state.listening) setStatus('Listening.');
          setDebugMode(Boolean((state.config as Record<string, unknown>)?.debugAllRemote));
          if (state.turns) setTurns(state.turns as Turn[]);
        }
      })
      .catch(() => {});

    chrome.runtime
      .sendMessage({ type: 'list-scenarios' })
      .then((res: Record<string, unknown> | undefined) => {
        if (res?.ok && Array.isArray(res.scenarios)) {
          setScenarios(res.scenarios as ScenarioInfo[]);
          setActiveScenario(res.active as string);
        }
      })
      .catch(() => {});

    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    const pane = transcriptRef.current;
    if (pane) {
      const atBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 60;
      if (atBottom) pane.scrollTop = pane.scrollHeight;
    }
  }, [turns]);

  const toggleListening = async () => {
    if (listening) {
      await chrome.runtime.sendMessage({ type: 'stop' });
      setListening(false);
      setStatus('');
    } else {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab) {
        setError('No tab open.');
        return;
      }
      const res = await chrome.runtime.sendMessage({ type: 'start', tabId: tab.id });
      if (!res?.ok) {
        setError(res?.error || 'Could not start.');
        return;
      }
      setListening(true);
      setStatus('Listening.');
    }
  };

  const answerLast = () => {
    setThinking(true);
    setSuggestion(null);
    chrome.runtime.sendMessage({ type: 'force-suggest' }).catch(() => {});
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  const translateTurn = (id: string) => {
    chrome.runtime.sendMessage({ type: 'translate-turn', turnId: id }).catch(() => {});
  };

  const forceSuggestTurn = (id: string) => {
    setThinking(true);
    setSuggestion(null);
    chrome.runtime.sendMessage({ type: 'force-suggest', turnId: id }).catch(() => {});
  };

  const changeScenario = (id: string) => {
    setActiveScenario(id);
    chrome.runtime.sendMessage({ type: 'set-config', patch: { activeScenario: id } }).catch(() => {});
  };

  const openSettings = () => chrome.runtime.openOptionsPage();

  return (
    <div className={`${isLight ? '' : 'dark'} bg-ep-bg text-ep-text flex h-screen w-full flex-col font-sans`}>
      <Header
        listening={listening}
        error={error}
        scenarios={scenarios}
        activeScenario={activeScenario}
        onScenarioChange={changeScenario}
        onOpenSettings={openSettings}
      />

      <ControlBar listening={listening} busy={false} onToggle={toggleListening} onAnswerLast={answerLast} />

      <StatusLine error={error} status={status} warning={warning} debugMode={debugMode} />

      <SuggestionCard suggestion={suggestion} thinking={thinking} message={message} onCopy={copyText} />

      {turns.length === 0 ? (
        <EmptyState />
      ) : (
        <div ref={transcriptRef} className="flex flex-1 flex-col overflow-y-auto">
          <Transcript
            turns={turns}
            translations={translations}
            onSuggest={forceSuggestTurn}
            onTranslate={translateTurn}
            onCopy={copyText}
          />
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
