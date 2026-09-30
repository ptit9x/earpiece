import { useStorage, withErrorBoundary, withSuspense } from '@extension/shared';
import { exampleThemeStorage } from '@extension/storage';
import { cn, ErrorDisplay, LoadingSpinner } from '@extension/ui';
import { useEffect, useState, useRef } from 'react';

// Type definitions based on LLM code
type Turn = {
  id: string;
  speaker: string;
  text: string;
  parts: string[];
};

type SuggestionOpt = {
  label: string;
  en: string;
  vi: string;
};

type Suggestion = {
  options: SuggestionOpt[];
  heard: string;
  intent: string;
  latencyMs: number;
};

const SidePanel = () => {
  const { isLight } = useStorage(exampleThemeStorage);

  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [scenarios, setScenarios] = useState<Record<string, unknown>[]>([]);
  const [activeScenario, setActiveScenario] = useState<string>('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [translations, setTranslations] = useState<
    Record<string, { vi?: string; origin?: string; pending?: boolean; error?: string }>
  >({});
  const [message, setMessage] = useState('Waiting for someone to ask you something…');

  const transcriptRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Ported from sidepanel.js logic
    const handleMessage = (msg: Record<string, unknown> | null) => {
      if (msg?.panel !== true) return;

      switch (msg.type) {
        case 'status':
          if (msg.status === 'error' && msg.detail) {
            setError(msg.detail);
          } else if (msg.status === 'listening') {
            setStatus('Listening.');
            setError('');
          }
          break;
        case 'thinking':
          setMessage('Thinking…');
          setSuggestion(null);
          break;
        case 'suggestion':
          setSuggestion(msg.suggestion as Suggestion);
          setMessage('');
          break;
        case 'not-for-me':
          setSuggestion(null);
          setMessage('Not for you. Still listening…');
          break;
        case 'turn':
          setTurns(prev => {
            const turnMsg = msg.turn as Turn;
            const idx = prev.findIndex(t => t.id === turnMsg.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = turnMsg;
              return next;
            }
            return [...prev.slice(-11), turnMsg]; // Keep last 12
          });
          break;
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
        // Skipping some meta logs (interim, device, source, dropped, repairs, endpoint, detection) for simplicity
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    // Initial fetch
    chrome.runtime.sendMessage({ type: 'panel-ready', panel: true }).catch(() => {});
    chrome.runtime
      .sendMessage({ type: 'get-state' })
      .then((state: Record<string, unknown>) => {
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
      .then((res: Record<string, unknown>) => {
        if (res?.ok && Array.isArray(res.scenarios)) {
          setScenarios(res.scenarios);
          setActiveScenario(res.active as string);
        }
      })
      .catch(() => {});

    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  useEffect(() => {
    // Auto-scroll transcript
    if (transcriptRef.current) {
      const pane = transcriptRef.current;
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
      const tab = tabs[0]; // Simplified matching
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
    setMessage('Thinking…');
    setSuggestion(null);
    chrome.runtime.sendMessage({ type: 'force-suggest' }).catch(() => {});
  };

  const copyOpt = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Ignore clipboard error
    }
  };

  const translateTurn = (id: string) => {
    chrome.runtime.sendMessage({ type: 'translate-turn', turnId: id }).catch(() => {});
  };

  const forceSuggestTurn = (id: string) => {
    setMessage('Thinking…');
    setSuggestion(null);
    chrome.runtime.sendMessage({ type: 'force-suggest', turnId: id }).catch(() => {});
  };

  const activeScenName = scenarios.find(s => s.id === activeScenario)?.name || 'Loading…';

  return (
    <div
      className={cn(
        'flex h-screen w-full flex-col font-sans',
        isLight ? 'bg-white text-gray-900' : 'bg-gray-900 text-gray-100',
      )}>
      <header
        className={cn(
          'flex items-center justify-between border-b px-4 py-3',
          isLight ? 'border-gray-200' : 'border-gray-700',
        )}>
        <div className="flex items-center gap-2">
          <span
            className={cn('h-3 w-3 rounded-full', listening ? 'bg-green-500' : error ? 'bg-red-500' : 'bg-gray-400')}
          />
          <h1 className="text-base font-semibold">Call Copilot</h1>
        </div>
        {suggestion?.latencyMs && <span className="text-xs text-gray-400">{suggestion.latencyMs} ms</span>}
      </header>

      <div className="flex gap-2 p-4 pb-0">
        <button
          onClick={toggleListening}
          className={cn(
            'flex-1 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors',
            listening ? 'bg-red-600 hover:bg-red-500' : 'bg-indigo-600 hover:bg-indigo-500',
          )}>
          {listening ? 'Stop listening' : 'Start listening'}
        </button>
        <button
          onClick={answerLast}
          className={cn(
            'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
            isLight ? 'border-gray-300 hover:bg-gray-50' : 'border-gray-600 hover:bg-gray-800',
          )}>
          Answer that
        </button>
      </div>

      <div className="flex items-center justify-between px-4 py-2 text-sm">
        <span className="font-medium text-gray-500">Conversation</span>
        <button className="flex items-center gap-1 font-medium">{activeScenName} ▾</button>
      </div>

      {(error || status || warning || debugMode) && (
        <div className="px-4 text-sm">
          {error && <p className="text-red-500">{error}</p>}
          {!error && status && <p className="text-gray-500">{status}</p>}
          {warning && <p className="mt-1 text-yellow-600">{warning}</p>}
          {debugMode && <p className="mt-1 text-yellow-600">DEBUG — every voice counts as someone else</p>}
        </div>
      )}

      <section
        className={cn(
          'm-4 flex-none rounded-xl border p-4 shadow-sm',
          isLight ? 'border-gray-200 bg-gray-50' : 'border-gray-700 bg-gray-800',
        )}>
        {suggestion?.heard && <div className="mb-2 italic text-gray-500">"{suggestion.heard}"</div>}
        {suggestion?.intent && <div className="mb-3 font-medium text-indigo-500">{suggestion.intent}</div>}

        <div className="flex flex-col gap-2">
          {suggestion?.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => copyOpt(opt.en)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-indigo-400',
                isLight ? 'border-gray-200 bg-white' : 'border-gray-700 bg-gray-900',
              )}>
              <div className="mb-1 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">{opt.label}</span>
              </div>
              <div className="mb-1 text-base font-medium">{opt.en}</div>
              {opt.vi && <div className="text-sm text-gray-500">{opt.vi}</div>}
            </button>
          ))}
        </div>

        {!suggestion && <p className="my-4 text-center text-sm text-gray-500">{message}</p>}
      </section>

      <section className="flex flex-1 flex-col overflow-hidden px-4 pb-4">
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
          Transcript <span className="font-normal lowercase opacity-75">click a line to answer · VI to translate</span>
        </h2>

        <div ref={transcriptRef as React.LegacyRef<HTMLDivElement>} className="flex-1 space-y-3 overflow-y-auto pr-2">
          {turns.map(turn => {
            const isMe = turn.speaker === 'me';
            const trans = translations[turn.id];

            return (
              <div key={turn.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                <div className="group flex max-w-[85%] items-start gap-2">
                  {!isMe && (
                    <button
                      onClick={() => translateTurn(turn.id)}
                      className="mt-1 rounded bg-gray-200 px-1 text-[10px] font-bold text-gray-600 opacity-0 transition-opacity group-hover:opacity-100">
                      VI
                    </button>
                  )}
                  <button
                    onClick={() => forceSuggestTurn(turn.id)}
                    className={cn(
                      'rounded-2xl px-4 py-2 text-left text-sm',
                      isMe
                        ? isLight
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-600 text-white'
                        : isLight
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-gray-800 text-gray-200',
                    )}>
                    {!isMe && (
                      <div className="mb-0.5 text-[10px] font-bold uppercase opacity-60">
                        {turn.speaker === 'remote' ? 'THEM' : turn.speaker}
                      </div>
                    )}
                    <span>{turn.parts?.length ? turn.parts.join(' ') : turn.text}</span>
                  </button>
                  {isMe && (
                    <button
                      onClick={() => translateTurn(turn.id)}
                      className="mt-1 rounded bg-gray-200 px-1 text-[10px] font-bold text-gray-600 opacity-0 transition-opacity group-hover:opacity-100">
                      VI
                    </button>
                  )}
                </div>

                {trans && !trans.pending && !trans.error && (
                  <div className={cn('mt-1 text-xs text-gray-500', isMe ? 'text-right' : 'text-left')}>
                    <div>{trans.vi}</div>
                  </div>
                )}
                {trans?.pending && <div className="mt-1 text-[10px] text-gray-400">Đang dịch…</div>}
                {trans?.error && <div className="mt-1 text-[10px] text-red-500">{trans.error}</div>}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default withErrorBoundary(withSuspense(SidePanel, <LoadingSpinner />), ErrorDisplay);
