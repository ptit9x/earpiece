# Earpiece AI — Feature Brainstorming

> Living document. Status: ideas → triaged → sliced. Update when priorities change.
> Baseline infrastructure: real-time turns, LLM client (Claude / OpenAI-compatible), scenarios,
> storage, React Query, side panel + full-tab view.

## Legend

- ★ = high value / low effort (build first)
- 🔥 = real-time (during meeting) · 📋 = post-meeting · 🧠 = interview-specific
- Effort: S (<半天) / M (1–2 days) / L (3+ days)

---

## Slice 1 — Quick wins (reuses everything) [APPROVED]

### 1. Recap + Action items ★ 🔥 📋
One "Recap" button → LLM distills all turns into:
- Decisions made
- Action items (owner + task + deadline)
- Open questions / unresolved threads
Output: copyable markdown. This is what Otter/Fireflies charge monthly for.
Effort: **S** (one prompt + one view).

### 8. Export transcript ★ 📋
Markdown / CSV / timestamped TXT from turns. Trivial, everyone needs it.
Effort: **S**.

### 4. Talk-time meter ★ 🔥
% speaking time per speaker from existing speaker labels (~5 lines of code).
Show in footer + full-tab view. Useful for interviews (ask more) and sales (talk less).
Effort: **S**.

## Slice 2 — Interaction depth

### 2. Ask the transcript 💬 🔥
Chat box in panel — "what did they say about pricing?" → LLM answers from last 30–50 turns
(no RAG needed, just context stuffing). Rescue when you missed a segment.
Effort: **M**.

### 3. Context pack (pre-meeting) 🔥
Paste agenda / job description / client brief into Options → prompt builder includes it
so suggestions target the actual meeting. Extends existing glossary + scenario infra.
Effort: **S/M**.

## Slice 3 — After the call

### 6. Meeting memory (cross-meeting) 📋
Persist recaps; next meeting opens with "last time: X, Y, Z still open".
The "cross-meeting memory" only Fellow/Fireflies have.
Effort: **M** (storage schema + surfacing logic).

### 7. Follow-up email draft 📋
From recap → thank-you / summary email draft for interviewer or client.
One more prompt template.
Effort: **S**.

---

## Idea backlog (not yet sliced)

### Interview-specific 🧠

| # | Idea | Notes | Effort |
|---|------|-------|--------|
| 9 | Question bank prep | JD → likely questions + STAR answer skeletons, generated BEFORE the call | M |
| 10 | STAR answer bank | Paste your past projects once; LLM maps them onto any incoming question | M |
| 11 | Answer coach | Flags rambling / too-long / unstructured answers in real time | M |
| 12 | Filler-word counter | "um", "like" frequency per speaker; post-call trend | S |
| 13 | Salary negotiation mode | When comp comes up → suggested ranges + phrasing from market data in context pack | S |
| 14 | Red-flag detector | Interviewer signals ("concerned", "not sure it's a fit") surfaced as warning chips | M |
| 15 | Post-interview scorecard | Self-review: answer quality, talk ratio, fillers, questions asked | S |
| 16 | "Any questions for us?" helper | Generates 3 smart questions from the transcript when asked | S |

### Real-time extras 🔥

| # | Idea | Notes | Effort |
|---|------|-------|--------|
| 17 | Auto-translate mode | Toggle to auto-translate every remote turn (translate-turn exists, just auto-fire) | S |
| 18 | Smart bookmarks | Hotkey marks a moment "important"; recap anchors to bookmarks | S |
| 19 | Speaker naming | Click a turn → rename that speaker once; name sticks for the session | S |
| 20 | Dead-air alert | If 10s silence after a question aimed at you → nudge chip | S |
| 21 | Objection handler (sales scenario) | Detect objection pattern → counter-argument skeleton | M |
| 22 | Mixed-language mode | vi/en meeting: STT auto-switch or dual pass | L |

### Audio / STT

| # | Idea | Notes | Effort |
|---|------|-------|--------|
| 23 | Local Whisper via native host | Better vi-VN accuracy + full privacy; pairs with yt-dlp host idea | L |
| 24 | Per-turn confidence display | Subtle opacity on low-confidence turns | S |
| 25 | Vocabulary boost | Glossary → speech context hints (already partial) | S |

### Post-meeting extras 📋

| # | Idea | Notes | Effort |
|---|------|-------|--------|
| 26 | Scenario-specific recap variants | Interview → improvement tips; sales → CRM field suggestions; standup → ticket updates | M |
| 27 | Telegram digest | Push recap to Telegram chat (user's primary channel) | S |
| 28 | Search across past meetings | Query all stored transcripts + recaps | M |
| 29 | "What did I promise" tracker | Extracts YOUR commitments across meetings into one list | S |
| 30 | Talk-time trend | Chart across meetings (am I improving?) | S |

### Privacy / ethics

| # | Idea | Notes | Effort |
|---|------|-------|--------|
| 31 | Local-only mode | Transcribe without any LLM calls (STT only) | S |
| 32 | Auto-purge | Delete transcripts after N days (configurable) | S |
| 33 | Redact-before-send | Strip numbers/keys/emails from turns before they hit the LLM | M |
| 34 | Consent banner | First-run reminder about recording laws in your region | S |

### Reach / integrations

| # | Idea | Notes | Effort |
|---|------|-------|--------|
| 35 | Notion / Obsidian export | Recap → note page | M |
| 36 | Calendar awareness | Meeting title + attendees as auto context pack | M |

---

## Explicitly NOT doing

- ❌ Recording / storing audio (privacy + legal minefield; transcript only)
- ❌ Joining calls as a visible bot (we're the invisible earpiece)
- ❌ Answering FOR the user in-call (suggestions only — user always speaks)
- ❌ Firefox support (tabCapture/offscreen are Chromium-only)

## Open questions

1. Transcript retention default: keep-forever vs 30-day default?
2. Should recap auto-generate when meeting ends (listening → stopped with N>10 turns)?
3. Telegram digest: bot per user or one shared bot with chat-id config?
