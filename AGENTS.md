# AGENTS.md — Earpiece AI Development Guide

Instructions and conventions for AI coding agents (and humans) working on this repo.

## Project

Earpiece AI is a Chrome MV3 extension: live meeting transcription + AI answer suggestions for video call interviews. Forked from [Jonghakseo/chrome-extension-boilerplate-react-vite](https://github.com/Jonghakseo/chrome-extension-boilerplate-react-vite) (React 18 + Vite + Turborepo + Tailwind).

- **Repo:** `github.com/ptit9x/earpiece`
- **Language rule:** all developer-facing docs/comments/commits in **English**. UI strings bilingual **vi/en** via `packages/i18n/locales/`.

## Architecture

```
chrome-extension/
  manifest.ts              # MV3 manifest source of truth → dist/manifest.json
  src/background/          # service worker: capture orchestration + message relay
pages/
  content-ui/              # React panel injected into meeting pages (shadow DOM)
    src/matches/all/       # mount via initAppWithShadow({ id: 'IC-extension-all', ... })
  offscreen/               # PLANNED: offscreen doc running Web Speech API
  options/                 # settings page (API key, model, langs, context)
  side-panel/              # MAIN UI — opens on toolbar click (openPanelOnActionClick)
  popup/                   # legacy, unused (no default_popup in manifest)
packages/
  shared/lib/              # message contract (IcMessage), AI client, prompt builder
  storage/lib/impl/        # createStorage pattern: settings-storage, transcript storage
  i18n/locales/{en,vi}/    # typed message catalogs (keep BOTH in sync)
```

**Runtime data flow**

```
side panel (MAIN UI, opens on action click)  ←→  content-ui panel (in-page, planned)
  └─ IC_START_CAPTURE ─▶ service worker ── chrome.tabCapture.getMediaStreamId
                              └─ IC_CAPTURE_READY{streamId} ─▶ offscreen doc
                                      └─ Web Speech API (continuous, auto-restart)
                              ◀─ IC_TRANSCRIPT / IC_STATUS ──┘
  ◀─ relay ─────────────────┘
  └─ IC_ASK{question} ─▶ AI client (OpenAI-compatible) ─▶ IC_SUGGESTION ▶ panel card
```

Message types live in `packages/shared/lib/messages.ts` as a discriminated union `IcMessage`. Do not add ad-hoc message shapes — extend the union.

## Hard rules (learned the hard way)

1. **`pnpm build` is the only reliable type check.** It runs `tsc -b` + vite for all 20 tasks. Do not trust `tsc --noEmit` alone.
2. **Manifest version comes from `chrome-extension/package.json`**, not the root one. Keep both in sync when bumping versions.
3. **i18n keys are typed.** Every key you use must exist in BOTH `locales/en/messages.json` and `locales/vi/messages.json`, or `@extension/ui` / `@extension/i18n` builds fail. Deleting keys (e.g. `displayError*`) breaks consumers — grep before removing.
4. **tabCapture gesture timing:** `getMediaStreamId` must run in the same user-gesture round-trip as the panel click. Never `await` storage reads before it — send settings *inside* the click message.
5. **SpeechRecognition needs a DOM** → it lives in the offscreen document, never the service worker. It dies every ~60s: wrap with auto-restart on `end`.
6. **Firefox is not a target.** tabCapture/offscreen are Chromium-only. Don't add Firefox workarounds.
7. **Content scripts match meeting sites only** (`meet.google.com`, `zoom.us`, `teams.microsoft.com`). Never widen matches to `<all_urls>`.
8. Commit messages: conventional commits (`feat:`, `fix:`, `chore:` …) in English. A lint-staged hook (prettier + eslint --fix) runs on commit — let it.

## Commands

```bash
pnpm install
pnpm build          # full build → dist/ (REQUIRED check before every commit)
pnpm dev            # watch rebuild; reload extension in chrome://extensions
pnpm zip            # dist/ → dist-zip/extension-<ts>.zip
pnpm type-check     # turbo tsc across packages
pnpm -F @extension/shared test    # per-package vitest (where wired)
```

## Testing strategy

- Pure logic (prompt builder, message reducers, restart state machine) → **vitest** inside the owning package.
- Chrome API glue (capture, offscreen, panel) → manual E2E checklist; Chrome APIs are not unit-testable without heavy mocks (not worth it).

## Roadmap (plan: Task A→G)

- **A** Message contract (`IcMessage`) + settings storage — TDD
- **B** Offscreen page: Web Speech engine + tab stream playback — TDD restart machine
- **C** Background capture orchestration (gesture-safe)
- **D** React panel (transcript list, suggest button, drag, Alt+I)
- **E** AI suggestion engine (prompt builder + client, TDD)
- **F** Options + popup pages
- **G** Prune unused modules (`pnpm module-manager`: disable new-tab, devtools, content-runtime), README polish, zip

## Repo etiquette

- Work on `main` for now (solo project); branch per feature if it touches >3 packages.
- Never commit secrets. The API key is user-provided at runtime via the Options page, stored in `chrome.storage.local`.
- After renaming anything, run the remnant grep (see `project-rebranding` conventions): all 5 casing variants.
