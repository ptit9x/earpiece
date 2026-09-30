# Earpiece AI — Monetization & Go-To-Market Plan

> Goal: first revenue within 8 weeks of starting Phase 1. Solo-founder friendly, no VC needed.
> Market data (Sep 2026): competitors charge $19–89/mo; Interview Coder hit $170K/mo;
> Leetcode Wizard 16K users at €49/mo. Our wedge: Vietnamese devs interviewing in English.

## Positioning (fixed first — everything else follows)

**Public face: "AI Meeting Copilot for Vietnamese professionals in English calls."**
- Sell: live VI translation, recap/action-items, talk-time — meeting framing is legal,
  Chrome-Web-Store-safe, defensible, and matches features we already shipped.
- Interview mode = power feature, marketed softly ("scenario: interview"), never the hero.
  The cheating-tool framing gets extensions delisted and offers rescinded — we don't go there.
- One-liner: "Nghe hiểu mọi cuộc họp tiếng Anh — Earpiece dịch, tóm tắt, gợi ý câu trả lời."

## Pricing (3 tiers, BYOK-first)

| Tier | Price | What |
|---|---|---|
| Free | $0 | Everything now + Recap; unlimited local use, BYOK only, watermark-free |
| Pro | **$7/mo** or $59/yr | + stealth overlay, auto-translate always-on, priority prompts, email support |
| Team | $5/seat/mo (min 5) | + shared glossary, admin billing, onboarding call |

Why $7: 90% cheaper than US rivals ($19–89), right for VN purchasing power, still 10x
materials cost of a native dev salary target. Annual $59 = 2 months free nudge.

**Payment rails (VN-friendly, in order):**
1. **Lemon Squeezy** (merchant-of-record, handles VAT, accepts VN payouts via Payoneer/wire)
2. Gumroad fallback (simpler, higher fees)
3. Domestic: direct bank transfer for VN customers via contact form (manual license issue)
   — surprising % of VN users prefer this; zero fees.

## License architecture (no backend server needed to start)

```
User buys on Lemon Squeezy → webhook → Cloudflare Worker (or Supabase Edge Fn)
  → issues license key (uuid) bound to purchase email → emailed instantly
Extension Options page: "Activate" tab → paste key → validate against Worker
  → chrome.storage.local.license = {key, email, tier, exp} (offline-grace 72h)
```
- Cloudflare Worker free tier (100K req/day) = $0/mo infra for first ~1000 customers.
- Validation check daily + on startup; grace mode if Worker unreachable.
- BYOK stays for everyone (privacy moat); Pro features gated client-side on license tier.
- Later (500+ customers): metered "managed LLM" add-on where we supply the API
  (that's when real infra begins).

## Go-to-market (VN-first, audience before ads)

**Phase 0 — Weeks 1–2: Make it sellable (build)**
1. Stealth overlay (transparent always-on-top panel, hidden from screenshare via
   content-protection / separate window — NOT detectable in tab-share)
2. Recap + action items view (Slice 1 #1) — the "legal hero feature"
3. License gate + Lemon Squeezy wiring + activation UI
4. Landing page: earpiece.vn or earpiece.ptit9x.dev — demo video (60s), pricing, buy buttons
5. Zip + Chrome Web Store submit ($5 one-time) under "Productivity" category

**Phase 1 — Weeks 3–6: First 100 users (audience)**
- Launch posts: r/nhapho? no — target: Facebook groups "Dev Việt Nam", "Người Việt tại
  Nhật/Hàn" (biggest English-meeting pain), VN subreddits, VoiceVN Discord, tavdiec
- Content engine: 3 TikToks/week — screen-recorded demo "vừa họp tiếng Anh vừa có
  phó đề"; the Interview Coder playbook minus the cheating framing
- Post-mortem bait: "Tôi đã dùng AI dịch realtime trong 30 cuộc họp" article
- Offer: first 100 buyers locked at $4/mo forever (founding-user pricing)
- Track: installs → activation → D7 retention → free→paid conversion (target 3–5%)

**Phase 2 — Months 2–3: Double down on what works**
- If TikTok/content drives installs: 3x content, add YouTube long-form (interview prep
  niche in VI is underserved)
- Team tier outreach: VN outsourcing companies (FPT, KMS, TMA… have 100s of devs in
  daily English meetings) — 1 pilot = 20–50 seats
- Localize UI ja/ko if VN-JP/KR community responds (they pay well)

**Kill criteria (honest):** if after 8 weeks of Phase 1 content effort:
- <300 installs or <1% paid conversion → stop paid tier, keep as free portfolio piece +
  pivot the same engine to a different wedge (e.g. English-meeting notes for VN
  managers, or sell white-label to outsourcing shops).

## Risk register

| Risk | Mitigation |
|---|---|
| Chrome Web Store rejects "realtime answer" framing | Submit as meeting copilot/translator; interview scenario named neutrally; no "undetectable" language anywhere in listing |
| Anthropic/OpenAI key bans for "assistance" use | BYOK = user's own key, we never touch LLM traffic; no exposure |
| Competitor clone undercuts | Moat = VI localization + VN distribution + price; move fast on content |
| Chargeback/fraud on Lemon Squeezy | MoR handles it; VN bank-transfer lane avoids cards entirely |
| User asks "is this cheating?" | Public FAQ: tool is for meetings + practice; user is responsible for employer/interview policies |

## Money math (sanity check)

- Break-even infra: $0 (Worker free tier + BYOK) + $5 CWS fee once
- 100 paid users × $7 = **$700/mo** — covers nothing much but proves demand
- 1,000 paid × $7 avg = **$7K/mo** (~170M VND) — meaningful side income; Leetcode Wizard
  scale (16K users) = $700K/mo ceiling reference
- Team pilot landing (50 seats × $5) = $250/mo per logo, low churn

## Build order (what I code next)

| # | Task | Why first |
|---|---|---|
| 1 | Recap + action items (Slice 1 #1) | Hero feature for landing page |
| 2 | Stealth overlay window | The #1 paid-tier differentiator |
| 3 | License Worker + activation UI | Unlocks charging |
| 4 | Landing page + demo video | Converts audience → installs |
| 5 | CWS submission | Distribution + trust |
| 6 | Content batch 1 (10 TikToks) | Traffic engine |

Tasks 1–3 are buildable now with current codebase; 4–6 need your face/voice or
screen recordings I can script for you.
