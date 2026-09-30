// Feature: live session state relayed from the background service worker.
// Single place that owns chrome.runtime messaging for the panel.

import { useEffect, useRef, useState } from 'react';
import type { ScenarioInfo, Suggestion, Translation, Turn } from '../types';

type SessionState = {
  listening: boolean;
  status: string;
  error: string;
  warning: string;
  debugMode: boolean;
  scenarios: ScenarioInfo[];
  activeScenario: string;
  suggestion: Suggestion | null;
  thinking: boolean;
  turns: Turn[];
  translations: Record<string, Translation>;
  notice: string;
};

const INITIAL: SessionState = {
  listening: false,
  status: 'idle',
  error: '',
  warning: '',
  debugMode: false,
  scenarios: [],
  activeScenario: '',
  suggestion: null,
  thinking: false,
  turns: [],
  translations: {},
  notice: '',
};

export const useSession = () => {
  const [state, setState] = useState<SessionState>(INITIAL);
  const patch = (p: Partial<SessionState>) => setState(s => ({ ...s, ...p }));

  useEffect(() => {
    const handleMessage = (msg: Record<string, unknown> | null) => {
      if (msg?.panel !== true) return;
      switch (msg.type) {
        case 'status':
          if (msg.status === 'error' && msg.detail) patch({ error: msg.detail as string });
          else if (msg.status === 'listening') patch({ status: 'Listening.', error: '' });
          break;
        case 'thinking':
          patch({ thinking: true, suggestion: null });
          break;
        case 'suggestion':
          patch({ thinking: false, suggestion: msg.suggestion as Suggestion, notice: '' });
          break;
        case 'not-for-me':
          patch({ thinking: false, suggestion: null, notice: 'Not for you. Still listening…' });
          break;
        case 'turn': {
          const turnMsg = msg.turn as Turn;
          setState(s => {
            const idx = s.turns.findIndex(t => t.id === turnMsg.id);
            const turns =
              idx >= 0 ? s.turns.map((t, i) => (i === idx ? turnMsg : t)) : [...s.turns.slice(-11), turnMsg];
            return { ...s, turns };
          });
          break;
        }
        case 'translation':
          setState(s => ({
            ...s,
            translations: {
              ...s.translations,
              [msg.turnId as string]: {
                vi: msg.vi as string,
                origin: msg.origin as string,
                pending: msg.pending as boolean,
                error: msg.error as string,
              },
            },
          }));
          break;
        case 'warning':
          patch({ warning: msg.warning as string });
          break;
        case 'debug-mode':
          patch({ debugMode: msg.on as boolean });
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    chrome.runtime.sendMessage({ type: 'panel-ready', panel: true }).catch(() => {});
    chrome.runtime
      .sendMessage({ type: 'get-state' })
      .then((res: Record<string, unknown> | undefined) => {
        if (res?.ok && res.config) {
          setState(s => ({
            ...s,
            listening: Boolean(res.listening),
            error: (res.lastError as string) || '',
            status: res.listening ? 'Listening.' : s.status,
            debugMode: Boolean((res.config as Record<string, unknown>)?.debugAllRemote),
            turns: (res.turns as Turn[]) ?? s.turns,
          }));
        }
      })
      .catch(() => {});

    chrome.runtime
      .sendMessage({ type: 'list-scenarios' })
      .then((res: Record<string, unknown> | undefined) => {
        if (res?.ok && Array.isArray(res.scenarios)) {
          patch({ scenarios: res.scenarios as ScenarioInfo[], activeScenario: res.active as string });
        }
      })
      .catch(() => {});

    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const toggleListening = async () => {
    if (state.listening) {
      await chrome.runtime.sendMessage({ type: 'stop' });
      patch({ listening: false, status: '' });
    } else {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      if (!tab) {
        patch({ error: 'No tab open.' });
        return;
      }
      const res = await chrome.runtime.sendMessage({ type: 'start', tabId: tab.id });
      if (!res?.ok) {
        patch({ error: res?.error || 'Could not start.' });
        return;
      }
      patch({ listening: true, status: 'Listening.', error: '' });
    }
  };

  const answerLast = () => {
    patch({ thinking: true, suggestion: null });
    chrome.runtime.sendMessage({ type: 'force-suggest' }).catch(() => {});
  };

  const suggestTurn = (id: string) => {
    patch({ thinking: true, suggestion: null });
    chrome.runtime.sendMessage({ type: 'force-suggest', turnId: id }).catch(() => {});
  };

  const translateTurn = (id: string) => {
    chrome.runtime.sendMessage({ type: 'translate-turn', turnId: id }).catch(() => {});
  };

  const changeScenario = (id: string) => {
    patch({ activeScenario: id });
    chrome.runtime.sendMessage({ type: 'set-config', patch: { activeScenario: id } }).catch(() => {});
  };

  return { ...state, toggleListening, answerLast, suggestTurn, translateTurn, changeScenario };
};

/** Keeps a scroll pane pinned to the bottom while the user is already there. */
export const useAutoScroll = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const onContentGrows = () => {
    const pane = ref.current;
    if (!pane) return;
    const atBottom = pane.scrollHeight - pane.scrollTop - pane.clientHeight < 60;
    if (atBottom) pane.scrollTop = pane.scrollHeight;
  };
  return { ref, onContentGrows };
};

export type { SessionState };
