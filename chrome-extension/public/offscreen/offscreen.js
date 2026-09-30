/* eslint-disable */

// Offscreen document: Handles BOTH tab audio energy measurement AND Web Speech API
// This fulfills Roadmap B: Offscreen page: Web Speech engine + tab stream playback

let audioCtx = null;
let stream = null;
let analyser = null;
let sampleTimer = null;
let flushTimer = null;
let noiseFloor = 0.005;
let pending = [];

const SAMPLE_MS = 150;
const FLUSH_MS = 750;

function send(msg) {
  try {
    const result = chrome.runtime.sendMessage(msg);
    if (result?.catch) result.catch(() => {});
  } catch (err) {
    // Ignore
  }
}

// ------------------------------------------------------------------ TAB AUDIO

async function startCapture(streamId) {
  stopCapture();

  stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: 'tab',
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  audioCtx = new AudioContext();
  const source = audioCtx.createMediaStreamSource(stream);

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.2;
  source.connect(analyser);

  // Critical: tabCapture swallows the tab's audio unless it is piped back
  // out. Without this line the user stops hearing the meeting.
  source.connect(audioCtx.destination);

  const buf = new Float32Array(analyser.fftSize);
  sampleTimer = setInterval(() => {
    analyser.getFloatTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);

    // Slow-tracking noise floor so a hissy line or background hum does not
    // read as constant speech.
    noiseFloor = rms < noiseFloor ? rms : noiseFloor * 0.995 + rms * 0.005;
    const threshold = Math.max(0.01, noiseFloor * 2.5);

    pending.push({ ts: Date.now(), active: rms > threshold, rms: Number(rms.toFixed(4)) });
  }, SAMPLE_MS);

  flushTimer = setInterval(flush, FLUSH_MS);
}

function flush() {
  if (!pending.length) return;
  const samples = pending;
  pending = [];
  send({ type: 'remote-activity', samples });
}

function stopCapture() {
  clearInterval(sampleTimer);
  clearInterval(flushTimer);
  sampleTimer = flushTimer = null;
  pending = [];
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
  audioCtx?.close().catch(() => {});
  audioCtx = null;
  analyser = null;
}

// ------------------------------------------------------------------ STT

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

class SpeechListener {
  constructor() {
    this.rec = null;
    this.running = false;
    this.lastFinalTs = Date.now();
    this.restartDelay = 300;
    this.resultCount = 0;
    this.watchdog = null;
  }

  start(cfg) {
    if (!SpeechRecognition) {
      send({ type: 'stt-error', error: 'This browser has no Web Speech API.' });
      return;
    }
    if (this.running) return;
    this.running = true;
    this.resultCount = 0;
    this.lastFinalTs = Date.now();
    this.spawn(cfg);
    this.startWatchdog();
    reportInputDevice();
  }

  startWatchdog() {
    clearInterval(this.watchdog);
    const startedAt = Date.now();
    this.watchdog = setInterval(() => {
      if (!this.running) return clearInterval(this.watchdog);
      const quietMs = Date.now() - Math.max(startedAt, this.lastFinalTs);
      if (this.resultCount === 0 && quietMs > 20000) {
        send({
          type: 'stt-warning',
          warning:
            `No speech recognised in ${Math.round(quietMs / 1000)}s. ` +
            'The recogniser is getting silence — check the input device.',
        });
      } else if (this.resultCount > 0) {
        send({ type: 'stt-warning', warning: '' });
      }
    }, 5000);
  }

  spawn(cfg) {
    const rec = new SpeechRecognition();
    this.rec = rec;
    rec.lang = cfg?.sttLang || 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = event => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          const now = Date.now();
          this.resultCount++;
          send({
            type: 'transcript-final',
            text,
            confidence: typeof result[0]?.confidence === 'number' ? result[0].confidence : 0,
            ts: now,
            durationMs: Math.min(now - this.lastFinalTs, 15000),
          });
          this.lastFinalTs = now;
        } else {
          interim += text;
        }
      }
      if (interim.trim()) send({ type: 'transcript-interim', text: interim.trim() });
    };

    rec.onerror = event => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.running = false;
        send({ type: 'stt-error', error: 'Microphone access denied.' });
        return;
      }
      send({ type: 'stt-error', error: `Speech recognition: ${event.error}` });
    };

    rec.onend = () => {
      if (!this.running) return;
      setTimeout(() => {
        if (this.running) this.spawn(cfg);
      }, this.restartDelay);
    };

    try {
      rec.start();
      this.restartDelay = 300;
    } catch {
      this.restartDelay = Math.min(this.restartDelay * 2, 5000);
    }
  }

  stop() {
    this.running = false;
    clearInterval(this.watchdog);
    this.watchdog = null;
    try {
      this.rec?.stop();
    } catch {}
    this.rec = null;
  }
}

const sttListener = new SpeechListener();

async function reportInputDevice() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter(d => d.kind === 'audioinput');
    const preferred = inputs.find(d => d.deviceId === 'default') || inputs[0];
    send({
      type: 'device',
      label: preferred
        ? preferred.label || `unnamed input (${inputs.length} available)`
        : 'no audio input device found',
    });
  } catch (err) {
    send({ type: 'device', label: `could not list devices: ${err.message}` });
  }
}

// ------------------------------------------------------------------ WIRING

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen') return;

  if (msg.type === 'start-capture') {
    startCapture(msg.streamId)
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err?.message || err) }));
    return true;
  }
  if (msg.type === 'stop-capture') {
    stopCapture();
    sendResponse({ ok: true });
  }

  if (msg.type === 'start-stt') {
    sttListener.start(msg.config);
    sendResponse({ ok: true });
  }
  if (msg.type === 'stop-stt') {
    sttListener.stop();
    sendResponse({ ok: true });
  }
});
