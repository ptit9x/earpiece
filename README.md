# Earpiece AI 🎧

> Your AI copilot in the call — live meeting transcription + AI answer suggestions for video call interviews on Google Meet, Zoom, and Microsoft Teams.

Earpiece AI is a Chrome extension (Manifest V3) that listens to your call, transcribes the other side in near-real time, and drafts short, spoken-style answer suggestions so you can respond faster and calmer in interviews and high-stakes meetings.

> ⚠️ **Status:** early development (`v0.1.0`). Core capture/speech pipeline is being implemented — see the [roadmap](#roadmap).

## How it works

1. On a meeting page (Meet / Zoom / Teams), a floating panel is injected.
2. Click **Start** — the extension captures the tab's audio (`chrome.tabCapture`), so it hears the *other side* only (your own mic is not duplicated).
3. Speech is transcribed in an offscreen document via the Web Speech API (free, no API key needed; supports `vi-VN`, `en-US`, `ja-JP`).
4. When the interviewer asks something, click the transcript line (or enable auto-suggest) — an OpenAI-compatible API drafts a short answer you can copy or adapt.

## Features (planned → ✅ done)

- ✅ MV3 scaffold on [Jonghakseo's boilerplate](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite) (React + Vite + Turborepo + Tailwind)
- ✅ Bilingual UI: English + Vietnamese
- ✅ Manifest locked to meeting platforms only (no `<all_urls>`)
- 🔜 Live transcription (Web Speech API in offscreen document)
- 🔜 AI answer suggestions (bring your own OpenAI-compatible API key)
- 🔜 Session history + recap
- 🔜 Draggable panel, Alt+I toggle, per-site position memory

## Privacy

- Audio is processed by Chrome's built-in speech engine (Web Speech API sends audio to Google's speech servers — see [Chrome docs](https://developer.chrome.com/docs/web-platform/speech-api)).
- Transcripts and questions are sent **only** to the API endpoint you configure (default `api.openai.com`). No telemetry, no third-party analytics.
- Session transcripts live in `chrome.storage.session` and are cleared when the browser closes. Settings (including your API key) stay in `chrome.storage.local` on your machine.

## Ethics

Earpiece AI is built as a **meeting and interview assistance tool** — drafting help, recaps, and clarifying questions, like a coach in your corner. Using live AI assistance in graded, proctored, or explicitly AI-banned interviews may violate the other party's expectations and terms. You are responsible for how you use it.

## Permissions rationale

| Permission | Why |
|---|---|
| `storage` | Save settings, API key, panel position, session transcripts |
| `tabCapture` | Capture meeting tab audio (the interviewer's side) |
| `offscreen` | Run the Web Speech API — it needs a DOM, which the MV3 service worker lacks |
| `sidePanel` | Optional Chrome side panel UI |

Content scripts are injected **only** into `meet.google.com`, `zoom.us`, and `teams.microsoft.com`.

## Development

```bash
pnpm install
pnpm build        # production build → dist/
pnpm dev          # watch mode (reload the extension in chrome://extensions after changes)
pnpm zip          # pack dist/ → dist-zip/extension-*.zip
pnpm type-check   # tsc -b across all packages
```

**Load unpacked:** `chrome://extensions` → Developer mode → *Load unpacked* → select `dist/`.

### Project structure

```
chrome-extension/        # manifest.ts + service worker (background)
pages/                   # extension pages (popup, options, content-ui, side-panel, ...)
packages/                # shared libs (storage, i18n, ui, vite-config, ...)
```

See `AGENTS.md` for the full development guide and architecture conventions.

## Firefox

Not supported. `tabCapture` and offscreen documents are Chromium-only APIs; the Firefox build is cosmetic.

## License

MIT
