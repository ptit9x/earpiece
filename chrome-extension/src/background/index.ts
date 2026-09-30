/* eslint-disable */
// @ts-nocheck
import 'webextension-polyfill';
import {
  getConfig,
  setConfig,
  nameVariants,
  ConversationBuffer,
  detectTarget,
  analyzeUtterance,
  shouldDefer,
  MAX_EVALUATE_DEFERRALS,
  repairTranscript,
  gate,
  captionDelta,
  normalizeSpeaker,
  findScenario,
  allScenarios,
  suggestReply,
  translate,
  ApiError,
} from '@extension/shared';

// Open the side panel when the toolbar action is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

const OFFSCREEN_PATH = 'offscreen/offscreen.html';

const state = {
  listening: false,
  tabId: null,
  buffer: new ConversationBuffer(),
  // Rolling samples of remote (tab) audio activity, used to label who spoke.
  activity: [],
  settleTimer: null,
  pendingTurn: null,
  inflight: null,
  lastSuggestion: null,
  lastError: null,
  ports: new Set(),
  // Mirrored from config so the synchronous transcript path can read it.
  debugAllRemote: false,
  // Interim results arrive only while speech is in progress, so the last one
  // is the best available "still talking" signal.
  lastInterimTs: 0,
  evaluateAttempts: 0,
  // Which turn the deferral counter belongs to, and when that turn first
  // became pending. Without both, a speaker who never stops talking resets
  // the counter forever and nothing is ever answered.
  pendingTurnId: null,
  pendingSince: 0,
  // Mirrored from config so the synchronous transcript path can read them.
  glossary: [],
  noise: { minConfidence: 0.55, minWords: 2 },
  mergePolicy: 'sentence',
  droppedCount: 0,
  // Which transcript source is actually feeding the pipeline. Captions carry
  // speaker names, which Web Speech cannot produce at all, so they win
  // whenever the meeting has them switched on.
  source: 'speech',
  lastCaptionTs: 0,
  captionWatchdog: null,
  // turnId -> Vietnamese, so re-opening a line never pays for it twice.
  translations: new Map(),
};

// ---------------------------------------------------------------- ports

chrome.runtime.onConnect.addListener(port => {
  // Open ports keep the service worker from being torn down mid-meeting.
  state.ports.add(port);
  port.onDisconnect.addListener(() => state.ports.delete(port));
});

// ---------------------------------------------------------------- messages

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(err => sendResponse({ ok: false, error: String(err?.message || err) }));
  return true; // async response
});

async function handleMessage(msg, sender) {
  switch (msg?.type) {
    case 'get-state':
      return {
        listening: state.listening,
        tabId: state.tabId,
        turns: state.buffer.recent(6),
        lastSuggestion: state.lastSuggestion,
        lastError: state.lastError,
        config: await getConfig(),
      };

    case 'set-config': {
      const cfg = await setConfig(msg.patch || {});
      state.debugAllRemote = Boolean(cfg.debugAllRemote);
      mirrorConfig(cfg);
      broadcast({ type: 'debug-mode', on: state.debugAllRemote });
      broadcast({ type: 'config-changed', config: cfg });
      return { config: cfg };
    }

    case 'start':
      return startListening(msg.tabId ?? sender?.tab?.id);

    case 'stop':
      return stopListening();

    case 'transcript-final':
      onTranscript({
        text: msg.text,
        confidence: msg.confidence || 0,
        ts: msg.ts || Date.now(),
        durationMs: msg.durationMs || 0,
      });
      return {};

    case 'transcript-interim':
      state.lastInterimTs = Date.now();
      broadcast({ type: 'interim', text: msg.text });
      return {};

    case 'remote-activity':
      recordActivity(msg.samples || []);
      return {};

    case 'device':
      sendToPanel({ type: 'device', label: msg.label });
      return {};

    case 'stt-warning':
      sendToPanel({ type: 'warning', warning: msg.warning });
      return {};

    case 'caption':
      onCaption(msg);
      return {};

    case 'caption-status':
      onCaptionStatus(Boolean(msg.available));
      return {};

    case 'stt-error':
      state.lastError = msg.error;
      broadcast({ type: 'status', status: 'error', detail: msg.error });
      return {};

    case 'test-connection':
      return testConnection();

    case 'panel-ready':
      // The side panel can be opened mid-meeting; replay the current state so
      // it is not blank until the next utterance.
      if (state.lastSuggestion) sendToPanel({ type: 'suggestion', suggestion: state.lastSuggestion });
      sendToPanel({ type: 'status', status: state.listening ? 'listening' : 'idle' });
      return {};

    case 'force-suggest':
      // The user pointed at a line and said "this one was for me". Skip
      // detection entirely - their judgement beats the heuristic.
      forceSuggest(msg);
      return {};

    case 'translate-turn':
      translateTurn(msg.turnId);
      return {};

    case 'list-scenarios': {
      const cfg = await getConfig();
      return {
        scenarios: allScenarios(cfg.customScenarios).map(({ id, name, detail }) => ({ id, name, detail })),
        active: findScenario(cfg.activeScenario, cfg.customScenarios).id,
      };
    }

    case 'clear-context':
      state.buffer.clear();
      return {};

    default:
      return {};
  }
}

// Values the synchronous transcript path reads. It runs on every recognised
// segment and cannot await storage, so they are mirrored onto state whenever
// the config changes.
function mirrorConfig(cfg) {
  state.glossary = cfg.glossary || [];
  state.mergePolicy = cfg.mergePolicy || 'sentence';
  state.noise = { minConfidence: cfg.minConfidence, minWords: cfg.minWords };
}

// ---------------------------------------------------------------- lifecycle

async function startListening(tabId) {
  const cfg = await getConfig();
  if (!tabId) throw new Error('No meeting tab to listen to.');

  state.tabId = tabId;
  state.buffer = new ConversationBuffer({
    maxTurns: 40,
    maxAgeMs: cfg.contextMaxAgeMs,
  });
  state.lastError = null;
  state.droppedCount = 0;
  state.debugAllRemote = Boolean(cfg.debugAllRemote);
  mirrorConfig(cfg);

  // Tab audio: used as a remote-voice gate so we can tell "someone else
  // spoke" from "the user spoke". Failure here is not fatal; without it
  // every segment is treated as remote.
  try {
    await ensureOffscreen();
    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-capture', streamId });
  } catch (err) {
    // state.lastError = `Tab audio unavailable: ${err.message}`;
  }

  // Both sources start. Captions take over as soon as any arrive; until then
  // Web Speech is the only thing producing a transcript at all.
  state.source = 'speech';
  state.lastCaptionTs = 0;
  await chrome.tabs.sendMessage(tabId, { type: 'start-captions' }).catch(() => {});
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-stt', config: cfg }).catch(() => {});
  broadcast({ type: 'debug-mode', on: state.debugAllRemote });
  state.listening = true;
  await setConfig({ listening: true });
  broadcast({ type: 'status', status: 'listening' });
  return { listening: true };
}

async function stopListening() {
  state.listening = false;
  clearTimeout(state.settleTimer);
  state.inflight?.abort();
  state.inflight = null;

  if (state.tabId != null) {
    try {
      await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-stt' });
      await chrome.tabs.sendMessage(state.tabId, { type: 'stop-captions' });
    } catch {
      /* tab may be gone */
    }
  }
  try {
    await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-capture' });
    await chrome.offscreen.closeDocument();
  } catch {
    /* no offscreen doc */
  }

  await setConfig({ listening: false });
  broadcast({ type: 'status', status: 'idle' });
  return { listening: false };
}

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
  });
  if (existing.length) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ['USER_MEDIA'],
    justification: 'Measure remote participant voice activity from the meeting tab.',
  });
}

chrome.tabs.onRemoved.addListener(tabId => {
  if (tabId === state.tabId && state.listening) stopListening();
});

chrome.commands.onCommand.addListener(async command => {
  if (command === 'toggle-listening') {
    if (state.listening) await stopListening();
    else {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await startListening(tab.id);
    }
  }
  if (command === 'dismiss-suggestion') {
    state.lastSuggestion = null;
    broadcast({ type: 'dismiss' });
  }
});

// ---------------------------------------------------------------- captions

// Captions are rewritten in place as someone keeps talking, so only what is
// genuinely new since the last update reaches the transcript.
const captionState = new Map(); // speaker -> last full text seen

async function onCaption({ name, text, ts }) {
  if (!state.listening) return;

  const speaker = normalizeSpeaker(name);
  const prev = captionState.get(speaker) || '';
  const { delta, revised } = captionDelta(prev, text);
  captionState.set(speaker, text);
  if (!delta) return;

  noteCaptionActivity();

  // A revision means the recogniser changed its mind about words already in
  // the buffer. Appending both would put a sentence and its contradiction in
  // the model's context, so the turn is rewritten instead.
  if (revised) {
    const last = state.buffer.lastTurn();
    if (last && last.speaker === speaker) {
      last.text = `${last.text} ${delta}`.replace(/\s+/g, ' ');
      last.parts[last.parts.length - 1] = delta;
      broadcast({ type: 'turn', turn: last });
      return;
    }
  }

  onTranscript({ text: delta, confidence: 1, ts: ts || Date.now(), durationMs: 0, speaker });
}

function onCaptionStatus(available) {
  if (available && state.source !== 'captions') {
    switchSource('captions', 'meeting captions are on — using speaker names');
  } else if (!available && state.source === 'speech') {
    broadcast({ type: 'source', source: 'speech', detail: 'no captions found — using speech recognition' });
  }
}

function noteCaptionActivity() {
  state.lastCaptionTs = Date.now();
  if (state.source !== 'captions') switchSource('captions', 'meeting captions are on — using speaker names');

  // Captions stop arriving when the user turns them off mid-call, or when the
  // page markup changes under us. Either way the extension must not go
  // silently deaf: speech recognition comes back.
  clearTimeout(state.captionWatchdog);
  state.captionWatchdog = setTimeout(() => {
    if (state.source !== 'captions' || !state.listening) return;
    switchSource('speech', 'captions stopped — back to speech recognition');
  }, 25000);
}

async function switchSource(source, detail) {
  state.source = source;
  broadcast({ type: 'source', source, detail });
  if (state.tabId == null) return;
  try {
    const cfg = await getConfig();
    // Running both at once would double every line.
    if (source === 'captions') {
      await chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop-stt' }).catch(() => {});
    } else {
      await chrome.runtime.sendMessage({ target: 'offscreen', type: 'start-stt', config: cfg }).catch(() => {});
    }
  } catch {
    /* tab gone */
  }
}

// ---------------------------------------------------------------- tab audio

function recordActivity(samples) {
  const cutoff = Date.now() - 30000;
  state.activity.push(...samples);
  state.activity = state.activity.filter(s => s.ts >= cutoff);
}

// ---------------------------------------------------------------- speaker labelling

// Decide whether a transcript segment came from the meeting (remote) or from
// the user's own microphone. Web Speech gives us text with no speaker, so we
// cross-reference the window against tab audio energy.
function labelSpeaker(ts, durationMs) {
  // Debug mode: everything counts as someone else, so one person with a plain
  // microphone can exercise detection and reply generation.
  if (state.debugAllRemote) return 'remote';
  if (!state.activity.length) return 'remote';
  const start = ts - Math.max(durationMs, 1200);
  const window = state.activity.filter(s => s.ts >= start && s.ts <= ts + 200);
  if (!window.length) return 'remote';
  const activeRatio = window.filter(s => s.active).length / window.length;
  // If the meeting tab was mostly silent while words were recognised, the
  // words came from the user's own voice.
  return activeRatio >= 0.35 ? 'remote' : 'me';
}

// ---------------------------------------------------------------- pipeline

function onTranscript({ text, confidence, ts, durationMs, speaker: knownSpeaker }) {
  if (!state.listening) return;

  // Drop room noise before it becomes a turn. Left in, it pollutes the
  // context sent to the model and the transcript you read, and occasionally
  // scores high enough to trigger a suggestion for nothing.
  const verdict = gate(text, confidence, state.noise);
  if (!verdict.keep) {
    state.droppedCount++;
    broadcast({
      type: 'dropped',
      text: String(text || '').trim(),
      reason: verdict.reason,
      total: state.droppedCount,
    });
    return;
  }

  // Repair vocabulary BEFORE detection. Detection matches on names and
  // phrases, so a mangled word does not just read badly - it loses the whole
  // utterance silently.
  const repaired = repairTranscript(text, state.glossary);
  if (repaired.fixes.length) broadcast({ type: 'repairs', fixes: repaired.fixes });
  text = repaired.text;
  // Captions say who spoke. Nothing to infer, and nothing to get wrong.
  const speaker = knownSpeaker || labelSpeaker(ts, durationMs);
  const before = state.buffer.byId(state.buffer.lastTurn()?.id);
  const wasLength = before?.text?.length ?? -1;
  const turn = state.buffer.append({
    speaker,
    text,
    ts,
    durationMs,
    mergePolicy: state.mergePolicy,
  });
  if (!turn) return;
  // Merging rewrites the turn in place; a translation of the old half no
  // longer describes it.
  if (turn.text.length !== wasLength) invalidateTranslation(turn.id);

  broadcast({ type: 'turn', turn });

  // Wait for the speaker to actually finish. Another final result inside the
  // settle window means the sentence is still going.
  clearTimeout(state.settleTimer);
  state.pendingTurn = turn;
  // Reset the deferral budget only for a genuinely new turn. A merge keeps
  // the same id, and resetting there is exactly how continuous speech starved
  // the pipeline: every new fragment handed it a fresh budget.
  if (state.pendingTurnId !== turn.id) {
    state.pendingTurnId = turn.id;
    state.evaluateAttempts = 0;
    state.pendingSince = Date.now();
  }
  getConfig().then(cfg => scheduleEvaluate(cfg));
}

// How long to wait is a property of what was said, not a constant. An open
// clause buys more time; a finished question is answered almost immediately.
function scheduleEvaluate(cfg) {
  const turn = state.pendingTurn;
  if (!turn) return;

  const endpoint = analyzeUtterance(turn.text, cfg.utteranceSettleMs);
  broadcast({ type: 'endpoint', endpoint, text: turn.text });

  clearTimeout(state.settleTimer);
  state.settleTimer = setTimeout(() => evaluate(cfg), endpoint.waitMs);
}

async function evaluate(cfg) {
  const turn = state.pendingTurn;
  if (!turn || !state.listening) {
    state.pendingTurn = null;
    return;
  }

  // Interim results only arrive mid-speech. One landing after this turn was
  // finalised means the speaker carried on, and whatever we have is the front
  // half of a longer sentence.
  const stillTalking = state.lastInterimTs > turn.ts;
  const endpoint = analyzeUtterance(turn.text, cfg.utteranceSettleMs);
  const heldMs = Date.now() - (state.pendingSince || Date.now());
  const verdict = shouldDefer({
    stillTalking,
    complete: endpoint.complete,
    heldMs,
    attempts: state.evaluateAttempts,
  });

  if (verdict.defer) {
    state.evaluateAttempts++;
    broadcast({
      type: 'endpoint',
      endpoint: {
        ...endpoint,
        complete: false,
        reason:
          `${verdict.reason} — held ${Math.round(heldMs / 100) / 10}s, ` +
          `try ${state.evaluateAttempts}/${MAX_EVALUATE_DEFERRALS}`,
      },
      text: turn.text,
    });
    clearTimeout(state.settleTimer);
    state.settleTimer = setTimeout(() => evaluate(cfg), endpoint.waitMs);
    return;
  }

  if (verdict.reason !== 'sentence finished') {
    broadcast({
      type: 'endpoint',
      endpoint: { ...endpoint, complete: true, reason: verdict.reason },
      text: turn.text,
    });
  }

  state.pendingTurn = null;
  state.pendingTurnId = null;
  state.evaluateAttempts = 0;
  state.pendingSince = 0;

  const detection = detectTarget({
    text: turn.text,
    speaker: turn.speaker,
    buffer: state.buffer,
    variants: nameVariants(cfg),
    threshold: cfg.targetThreshold,
    oneOnOne: Boolean(cfg.oneOnOne),
  });

  broadcast({ type: 'detection', detection, text: turn.text });
  if (!detection.likely) return;

  await requestSuggestion({ cfg, text: turn.text, detection, forced: false });
}

// Resolve the text from the buffer, which holds the merged turn. Taking the
// overlay's rendered text instead would answer whichever fragment happened to
// be on screen.
async function forceSuggest({ turnId, text }) {
  const turn = turnId != null ? state.buffer.byId(turnId) : state.buffer.lastRemote();
  const clean = (turn?.text || text || '').trim();
  if (!clean) {
    broadcast({ type: 'status', status: 'error', detail: 'Nothing heard yet to answer.' });
    return;
  }
  const cfg = await getConfig();
  clearTimeout(state.settleTimer);
  state.pendingTurn = null;
  await requestSuggestion({
    cfg,
    text: clean,
    detection: { score: 1, likely: true, reasons: ['confirmed by you'], signals: {} },
    forced: true,
  });
}

async function requestSuggestion({ cfg, text, detection, forced }) {
  // A newer utterance invalidates an in-flight suggestion.
  state.inflight?.abort();
  const controller = new AbortController();
  state.inflight = controller;

  // Without this a stalled backend leaves the overlay on "Thinking…" forever.
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, cfg.requestTimeoutMs);

  broadcast({ type: 'thinking' });
  const startedAt = performance.now();

  try {
    const result = await suggestReply(cfg, {
      transcript: state.buffer.transcriptText(cfg.contextTurns),
      incoming: text,
      userName: cfg.userName,
      detection,
      glossary: cfg.glossary,
      scenario: findScenario(cfg.activeScenario, cfg.customScenarios),
      forced,
      signal: controller.signal,
    });

    if (controller.signal.aborted) return;
    state.lastError = null;

    if (result.degraded) {
      // Reached the model, got an answer meant for the user, but could not
      // read options out of it. Almost always a truncated response.
      const detail = 'Model replied but returned no usable options. Raise max tokens or try another model.';
      state.lastError = detail;
      broadcast({ type: 'status', status: 'error', detail });
      return;
    }

    if (!result.for_me || !result.options.length) {
      broadcast({ type: 'not-for-me' });
      return;
    }

    const suggestion = {
      ...result,
      heard: text,
      latencyMs: Math.round(performance.now() - startedAt),
      ts: Date.now(),
    };
    state.lastSuggestion = suggestion;
    broadcast({ type: 'suggestion', suggestion });
  } catch (err) {
    // A newer utterance aborting this one is normal; a timeout is not.
    if (err?.name === 'AbortError' && !timedOut) return;
    const message = timedOut
      ? `No answer within ${Math.round(cfg.requestTimeoutMs / 1000)}s. Backend is slow or stalled.`
      : err instanceof ApiError
        ? err.message
        : String(err?.message || err);
    state.lastError = message;
    broadcast({ type: 'status', status: 'error', detail: message });
  } finally {
    clearTimeout(timeout);
    if (state.inflight === controller) state.inflight = null;
  }
}

// ---------------------------------------------------------------- self-test

// Exercises the real path — auth, model id, system prompt, JSON parsing —
// with a canned utterance, so the backend can be verified without joining a
// meeting.
const TEST_TIMEOUT_MS = 30000;

async function testConnection() {
  const cfg = await getConfig();
  const incoming = 'Viet, can you check whether the UAT screen matches the Figma?';
  const detection = {
    score: 1,
    likely: true,
    reasons: ['self-test'],
    signals: {},
  };

  // Resolve the host first: a malformed base URL should be reported as such,
  // not surface later as an opaque fetch failure.
  let host;
  if (cfg.provider === 'openai-compatible') {
    if (!cfg.baseUrl) throw new Error('No base URL set.');
    try {
      host = new URL(cfg.baseUrl).host;
    } catch {
      throw new Error(`Base URL is not a valid URL: ${cfg.baseUrl}`);
    }
  } else {
    host = 'api.anthropic.com';
  }

  // Without this a queued free-tier route hangs the popup indefinitely.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  const startedAt = performance.now();
  let result;
  try {
    result = await suggestReply(cfg, {
      transcript: 'Them: We found a mismatch on the settings page.',
      incoming,
      userName: cfg.userName || 'Viet',
      detection,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`No response from ${host} within ${TEST_TIMEOUT_MS / 1000}s. Route is queued or unreachable.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Math.round(performance.now() - startedAt);

  return {
    test: {
      host,
      model: cfg.model,
      latencyMs,
      for_me: result.for_me,
      reply: result.reply,
      usage: result.usage,
      // A parse failure returns the empty fallback: the HTTP call succeeded
      // but the model did not produce usable JSON. Worth distinguishing.
      parsed: Boolean(result.reply || result.intent),
    },
  };
}

// ---------------------------------------------------------------- output

// There is no in-page UI any more; everything the user sees is the side
// panel. The meeting tab only receives start-stt / stop-stt, sent directly.
function broadcast(payload) {
  sendToPanel(payload);
}

// Tagged so the content script ignores it. When the panel is closed the send
// simply has no receiver.
function sendToPanel(payload) {
  chrome.runtime.sendMessage({ ...payload, panel: true }).catch(() => {});
}

// ---------------------------------------------------------------- translation

async function translateTurn(turnId) {
  const turn = state.buffer.byId(turnId);
  if (!turn) return;

  const cached = state.translations.get(turnId);
  if (cached) {
    broadcast({ type: 'translation', turnId, vi: cached, origin: turn.text });
    return;
  }

  broadcast({ type: 'translation', turnId, pending: true, origin: turn.text });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const cfg = await getConfig();
    const vi = await translate(cfg, turn.text, controller.signal);
    if (!vi) throw new Error('Empty translation.');
    // Key on the id, not the text: a turn that merges later keeps its id and
    // will simply be retranslated on the next click.
    state.translations.set(turnId, vi);
    broadcast({ type: 'translation', turnId, vi, origin: turn.text });
  } catch (err) {
    const message = err?.name === 'AbortError' ? 'Translation timed out.' : String(err?.message || err);
    broadcast({ type: 'translation', turnId, error: message, origin: turn.text });
  } finally {
    clearTimeout(timer);
  }
}

// A merged turn's text changed, so any translation of it is stale.
function invalidateTranslation(turnId) {
  state.translations.delete(turnId);
}
