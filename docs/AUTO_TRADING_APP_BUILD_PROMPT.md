# Master Build Prompt — TradeDesk (WeBuilt-grade Auto Trading Desk)

> **How to use:** Copy everything from `## ROLE` to the end into a coding agent as the sole product brief. This is a contract-engineer + principal UI/UX designer handoff. Build exactly to this. Do not invent a different product. Do not skip Train, Analytics, or the approval/receipt model.

---

## ROLE

You are simultaneously:

1. **Staff contract engineer** shipping a production paper-first trading desk (Next.js, Postgres, Alpaca, TradingView webhooks, LLM context assembly).
2. **Principal UI/UX designer** responsible for a WeBuilt/Studly-class experience: calm, approval-first, receipt-driven, brand-forward marketing, sparse operational app chrome.

You will design and implement end-to-end. Prefer opinionated defaults over configuration sprawl. Every screen has one job. Every money action waits for a yes unless Armed Auto + risk gates pass.

---

## PRODUCT ONE-LINER

**TradeDesk** — Your trading desk, handled. Signals arrive. The desk proposes. You approve. Alpaca executes. Everything is logged, trainable, and measurable.

Analog: getwebuilt.com’s Studly, but for **options calls/puts, equity longs, and shorts** — not contractors.

---

## NORTH-STAR UX PRINCIPLES (NON-NEGOTIABLE)

1. **Approval-first capital.** Nothing that opens, adds, or closes risk runs without explicit Approve — unless the strategy is `Armed Auto` and every hard risk gate passes.
2. **Receipts over dashboards.** Every meaningful action yields an on-the-record receipt (who / what / when / why / source / result). Undo only when truly reversible (disarm, cancel unfilled, restore context version). Never fake-undo a broker fill.
3. **Paper by default.** Environment badge is always visible. Live requires typed confirm phrase: `ENABLE LIVE`.
4. **Teachable AI.** The model trades *your* system via Context Packs + Correct/Wrong/Almost feedback — not vibes, not generic “AI picks.”
5. **One composition per viewport.** Landing hero is brand + one headline + one sentence + one CTA group + one full-bleed atmosphere. App home is “Needs attention,” not a widget collage.
6. **Cards only for interaction.** Approval cards, kill-switch confirm, connection forms. Do not wrap static stats in card chrome.
7. **Analytics from truth.** KPIs come only from journal fills + Alpaca reconciliation. Paper and live never mix unless the user toggles Combine.
8. **Risk gates beat context.** Training context never bypasses max loss, size, hours, or naked-short blocks.
9. **Sparse motion with purpose.** 2–3 intentional motions: approval card entrance, receipt stamp, equity-curve draw. No glow spam, no confetti, no infinite shimmer.
10. **Honest empty states.** Fictional Sample data is labeled `Sample` + “Fictional sample data” exactly like WeBuilt. Never imply sample P&L is the user’s money.

---

## ANTI-PATTERNS (HARD BAN)

### Visual / brand
- Purple-on-white or purple→indigo gradients
- Warm cream `#F4F1EA` + terracotta + high-contrast serif broadsheet
- Dark-mode-by-default “crypto terminal”
- Neon glow, glassmorphism stacks, multi-layer shadows
- Rounded-full pill clusters, emoji as UI, icon rows as decoration
- Inter, Roboto, Arial, system-ui as primary brand fonts
- Inset hero image in a rounded media card; tiled collage heroes; floating badge stickers on hero media
- Dashboard-first landing page

### Product
- “AI stock picks” or advice framing
- Silent order submission
- Mixing paper + live numbers without an explicit toggle
- Silently truncating the System Bible from context
- Multi-leg option spreads in v1
- Multi-broker in v1
- Social copy-trading
- Native mobile apps in v1

---

## DESIGN SYSTEM

### Brand
- **Name:** TradeDesk (placeholder; keep renameable via `NEXT_PUBLIC_APP_NAME`)
- **Assistant name:** Desk (Studly analogue). Speaks in short operational sentences. Never hype.
- **Voice:** plain, precise, receipt-minded. “Needs your approval.” “Logged.” “Disarmed.” Not “Let’s crush it 🚀.”

### Color tokens (CSS variables — lock these)
```css
:root {
  --ink: #0E1218;           /* primary text */
  --ink-muted: #5C6570;     /* secondary */
  --paper: #F7F6F2;         /* app canvas — cool off-white, NOT cream #F4F1EA */
  --paper-elevated: #FFFFFF;
  --line: #D8DCE2;          /* hairlines sparingly; prefer spacing over rules */
  --atmosphere-1: #E8EEF2;  /* cool mist */
  --atmosphere-2: #D3E0D8;  /* quiet sage depth */
  --brand: #1F3D36;         /* deep pine — brand mark */
  --accent: #2F6F5E;        /* approve / positive action */
  --accent-soft: #D7E8E1;
  --caution: #A15C12;       /* draft / waiting */
  --danger: #9B2C2C;        /* kill / live / reject */
  --danger-soft: #F3DADA;
  --paper-badge: #2B4C7E;   /* PAPER env */
  --live-badge: #9B2C2C;    /* LIVE env */
  --sample: #6B7280;        /* sample watermark */
}
```
Light mode is primary. Optional later dark theme is out of v1 scope.

### Typography
- **Display / brand:** `Syne` (Google Fonts) — weight 700–800 for wordmark and hero only
- **UI / body:** `Source Sans 3` — 400/600
- **Numerics / blotter:** `IBM Plex Mono` — tabular figures for prices, P&L, sizes
- Scale: 12 / 14 / 16 / 20 / 28 / 40 / 64 (rem-based). Hero brand ~64 desktop / ~40 mobile. Never let a marketing headline overpower the wordmark.

### Layout
- Max content width app shell: `1200px`
- Marketing sections: full-bleed atmosphere, content `min(1120px, 92vw)`
- App nav: left rail desktop (≥1024), bottom tab mobile
- Density: trading blotters can be dense; marketing and Train editors stay breathable
- Radius: `6px` controls, `10px` approval panels — never `9999px` pills for primary actions
- Shadow: one soft ambient max (`0 8px 24px rgba(14,18,24,0.06)`); prefer border + spacing

### Motion
1. Approval card: fade+lift 180ms ease-out
2. Receipt “stamped”: opacity + slight scale 160ms
3. Equity curve: path draw 600ms on first paint only
Respect `prefers-reduced-motion: reduce` → instant states, no path draw.

### Iconography
Use Lucide or Phosphor, 1.5–1.75 stroke, monochrome. No multicolor icon soups.

### Accessibility
- WCAG AA contrast on text and primary buttons
- Focus rings visible (`2px` brand outline offset 2)
- Approval actions reachable by keyboard; `Approve` is not mouse-only
- Live regions for new pending approvals (`aria-live="polite"`)
- Do not rely on color alone for win/loss (use + / − and labels)

---

## INFORMATION ARCHITECTURE

### Marketing site (`/`)
1. Landing
2. Platform / how it works (`/platform`)
3. Straight answers / FAQ (anchor or `/faq`)
4. Risk disclosure (`/risk`)
5. Sign in / Start paper desk

### App (`/app/*` — auth required)
| Route | Job |
|---|---|
| `/app` | Home — Needs attention + today’s pulse |
| `/app/approvals` | Pending / history of approval cards |
| `/app/positions` | Open risk |
| `/app/blotter` | Fills + orders |
| `/app/strategies` | Strategy list + create/edit |
| `/app/strategies/[id]` | Strategy detail, webhook URL, mode, context binding |
| `/app/train` | Context Packs library |
| `/app/train/[packId]` | Editor + budget meter + simulate |
| `/app/analytics` | Full analytics |
| `/app/journal` | Audit ledger |
| `/app/connections` | Alpaca + webhook secrets |
| `/app/settings` | Profile, env paper/live, risk defaults, kill switch |
| `/app/desk` | Full-height assistant thread (also global command bar) |

Global chrome: env badge, kill switch, Desk command bar (`⌘K` / `Ctrl+K`).

---

## LANDING PAGE — SCREEN SPEC (WeBuilt structure, trading domain)

### First viewport (hero) — ONE composition
Contains ONLY:
1. Wordmark **TradeDesk** (hero-level brand signal)
2. One headline: `Your trading desk, handled.`
3. One supporting sentence: `Desk proposes from your system and TradingView. You approve. Alpaca executes. Every fill is logged.`
4. CTA group: primary `Start paper desk` → `/app` onboarding; secondary `See how approvals work` → scroll
5. Full-bleed atmospheric background: cool mist→sage depth gradient + subtle desk/chart texture (photographic or abstract market grain). Edge-to-edge. **No** inset image card, **no** floating badges on the media, **no** stats in the hero.

Eyebrow allowed only if it does not overpower brand: `Paper-first · Alpaca · TradingView`

### Section — Sample approval (Studly pattern)
Labeled `Desk · Needs your approval` + `Sample`
Approval card copy example:

```
Submit this paper order?

Strategy: ORB Calls
Signal: TV webhook · AAPL
Intent: BUY CALL · AAPL 230C 2026-11-21 · 2 contracts · LIMIT 1.85
Est. debit: $370 · Max loss if worthless: $370
Context: ORB Calls v12 · System Bible v3

[ Approve order ]  [ Not now ]
```

Caption: `Sample. Desk prepares it; you approve before Alpaca receives an order.`
Footer: `Fictional sample data`

### Section — Needs your attention (sample list)
Three lines like WeBuilt’s attention list:
- Approve ORB call · AAPL · 2 contracts · waiting 4m
- Broker reject · SPY put · insufficient option BP
- Daily loss 72% of limit · ORB Calls still Armed

### Section — What Desk does
Four plain bullets (no icon row carnival):
- Turns TradingView alerts into proposed orders from your Context Pack
- Waits for your yes (or executes only when Armed Auto + limits clear)
- Logs every signal, approval, fill, and reject
- Shows analytics from your journal — not from marketing claims

### Section — You stay in charge
Two sample receipts side by side (stack on mobile):
1. Money waits for your yes (approval)
2. Everything on the record (receipt with `Undo` only for disarm)

### Section — Train your system
Short copy + sample budget meter UI (not a card collage): System Bible pinned, pack tokens used, Simulate signal CTA.

### Section — Straight answers
FAQ: What is Desk? Who is in control? Paper vs live? Is this advice? (Answer: No. Execution + journaling software.) How are trades logged?

### Motion on landing
- Hero atmosphere slow drift (very subtle, ≤2% translate, 12s loop) — disabled if reduced motion
- Approval sample stamps in once on scroll into view
- CTA hover: 120ms background deepen only

---

## APP SHELL — UI SPEC

### Top bar (mobile) / Left rail (desktop)
- Wordmark small
- Nav: Home, Approvals (badge count), Positions, Blotter, Strategies, Train, Analytics, Journal, Connections
- Footer of rail: Settings, env badge `PAPER`/`LIVE`, Kill switch (danger text button)

### Kill switch
One tap opens confirm panel (card — interaction):
- `Disarm all strategies`
- `Cancel open orders`
- `Flatten all positions` (separate, typed confirm `FLATTEN`)
Never combine flatten into a single accidental click.

### Command bar / Desk
- `⌘K` opens Desk
- Placeholder: `Ask Desk about P&L, risk, or propose a trade…`
- Answers cite records; money intents spawn approval cards inline
- Show `Context used: …` chips under proposals

### Home `/app` — one job: triage
Layout top→bottom:
1. Env badge + account buying power (mono numbers)
2. **Needs attention** list (approvals, rejects, limit warnings) — primary
3. Today pulse: realized P&L, open uPnL, fills count (NOT in cards; simple definition list)
4. Open risk summary (top 3 positions) → link Positions
5. Latest receipts (5) → Journal
6. Analytics snapshot strip (today P&L · week win rate · drawdown) → Analytics
No strategy editor on home. No chart wall on home.

---

## APPROVAL CARD — COMPONENT CONTRACT

Visual: elevated paper panel, 10px radius, left accent bar `caution` when pending, `accent` when approved, `danger` when rejected.

Required fields:
- Title verb (`Submit this paper order?` / `Arm strategy ORB Calls?` / `Enable LIVE trading?`)
- Strategy name + mode
- Signal source (TradingView | Simulate | Manual | Desk)
- Normalized intent (human readable + raw JSON expand)
- Est. cost / credit, max loss if known
- Risk gate checklist (pass/fail icons + labels)
- Context packs + version hashes cited
- Primary / secondary actions
- Timestamp + id for receipt linkage

States: `pending` | `approved` | `rejected` | `expired` | `superseded`
Expiry: default 15 minutes for marketable signals (configurable); expired moves to history with reason.

Keyboard: `A` approve, `N` not now when card focused (document in UI hint).

---

## RECEIPT — COMPONENT CONTRACT

```
Desk · Done
Added fill for AAPL 230C · 2 @ 1.82
Changed by: Alpaca fill · strategy ORB Calls
[ Open trade ]  [ Add to Train examples ]
```

Receipt types: signal_received, proposal_created, approved, rejected, order_submitted, order_accepted, fill, partial_fill, canceled, broker_reject, strategy_armed, strategy_disarmed, context_saved, train_feedback, kill_switch, env_changed, analytics_export.

---

## STRATEGIES — UX + DATA

### List
Table/list: Name · Mode badge · Symbols · Context pack · Today P&L · Last signal · Actions
Mode badges: `Off` (muted) · `Draft` (caution) · `Armed Auto` (accent with pulse dot only if actively accepting signals)

### Create / Edit form (one column, progressive)
1. Name
2. Allowed sides: long equity, short equity, buy calls, buy puts, sell calls, sell puts (sell defaults OFF)
3. Universe: symbols list or `*` with denylist
4. Sizing: fixed qty | fixed `$` risk | `%` equity (pick one primary)
5. Caps: max notional/order, max contracts/shares, max open positions, max daily loss `$`
6. Schedule: RTH only (default ON), optional extended
7. TradingView webhook path (read-only URL after create) + rotate secret
8. Context Pack multi-select (order = priority after System Bible)
9. Mode control (Off/Draft/Armed) — Arming requires risk ack checkbox

### Armed Auto arming modal
Checklist must all be checked:
- Paper env OR live already enabled
- Context pack frozen version shown
- Max daily loss set
- User typed strategy name to confirm

---

## TRAIN / CONTEXT WINDOW — FULL SPEC

### Purpose
User trains the trading app by loading durable context the model must obey.

### Pack library `/app/train`
- List packs with token estimate, strategies using them, last edited
- CTA `New Context Pack`
- Import JSON/Markdown bundle

### Pack editor `/app/train/[id]`
**Layout (desktop):** left doc tree · center editor · right **Active Context Window** inspector  
**Mobile:** tabs `Docs` / `Window` / `Simulate`

#### Doc tree (required templates auto-created)
1. `00-system-bible.md` (pinned, never auto-truncated away)
2. `01-setup-entry.md`
3. `02-exits.md`
4. `03-sizing.md`
5. `04-hard-no-trades.md`
6. `05-tradingview-map.md`
7. `06-examples.md` (good trades)
8. `07-skips.md` (trades to avoid)
9. `08-lessons.md` (appended from Correct/Wrong/Almost)

Editor: markdown, monospace optional toggle, autosave drafts every 5s, explicit `Save version`.

#### Active Context Window inspector
- Ordered slices with token estimates
- Budget bar: used / soft cap (default 64k tokens equiv; configurable 32k–100k)
- Warnings when over budget; truncation policy:
  1. Never drop System Bible
  2. Drop oldest lessons first
  3. Then skips
  4. Then extra examples
  5. Strategy docs truncated last with `…[truncated]` markers visible to user
- Freeze banner when a strategy is Armed on this version

#### Simulate signal panel
JSON editor prefilled from TradingView map; `Run simulation`
Result: approval-style proposal + citations (doc path + excerpt)
Feedback buttons: `Correct` · `Almost` · `Wrong` + optional note → appends to `08-lessons.md` and creates `training_feedback` row

#### Versioning
- Each Save version → immutable `context_versions` row + content hash
- Diff view between versions
- Restore creates a new version (no history rewrite)
- Strategy.arm records `context_version_hash`; changing packs while Armed forces Draft or re-arm

#### Add from journal
From any closed trade receipt: `Add to Train` → choose pack + good/skip + note

---

## ANALYTICS — FULL SPEC

### Header controls
- Range: Today · WTD · MTD · 30D · Custom · All
- Environment: Paper | Live | Combine (explicit)
- Filters drawer: strategy, pack version, symbol, side, mode, session

### KPI row (definition list, not cards)
Net realized · Unrealized · Fees · Win rate · Profit factor · Expectancy · Max DD · Current DD · Trades · Avg hold · Avg R · Median approval latency

### Charts (one job each; stack vertically)
1. Equity curve (cumulative realized)
2. Daily P&L bars
3. Win/loss histogram
4. Optional rolling win rate (toggle)

### Breakdown tables
Strategy · Symbol · Side · Hour-of-day · Day-of-week · Mode · Context version  
Columns: trades, win%, net, PF, avg R

### Drill-down
Row/point → trade drawer with receipt chain timeline

### Streaks & risk panel
Consecutive losses, largest loser, days hitting ≥80% of max daily loss, kill-switch count

### Export
CSV / JSON of filtered trades; Day sheet PDF-ish print stylesheet

### Empty state
Sample analytics clearly labeled; CTA `Run paper trades` / `Simulate in Train`

### Assistant analytics
Desk answers must name the active range + env filter in the answer.

---

## JOURNAL / BLOTTER / POSITIONS

### Journal
Filterable infinite list of audit events; expand raw JSON; export CSV; deep link `?id=`

### Blotter
Orders + fills; status chips; cancel button when cancelable; link to Alpaca id

### Positions
Underlying, instrument (incl. option OCC symbol), qty, avg, mark, uPnL, strategy tag if known, flatten action (approval)

---

## CONNECTIONS

### Alpaca
- API Key ID + Secret (write-only after save; show last4)
- Base URL paper/live tied to env
- Test connection → account status, BP, option level, shorting enabled
- Reconcile now

### TradingView
- Per-strategy webhook URL
- Shared secret rotate
- Last N payloads (redact secret)
- Signature/HMAC verification docs snippet for user

---

## ONBOARDING FLOW (FIRST RUN)

1. Create account
2. Risk disclosure ack
3. Connect Alpaca **paper** (skip allowed → read-only demo sample mode)
4. Create first Context Pack from template (paste your system)
5. Create first Strategy in Draft
6. Copy webhook URL
7. Simulate one signal OR wait for TV
8. Approve first paper order
Checklist progress in Settings until complete.

---

## DOMAIN MODEL (POSTGRES)

```text
users
  id, email, name, created_at

accounts
  id, user_id, env enum('paper','live'), alpaca_account_id, option_level, bp_snapshot jsonb, updated_at

api_credentials
  id, user_id, provider enum('alpaca','llm'), key_id, secret_ciphertext, last4, created_at

strategies
  id, user_id, name, mode enum('off','draft','armed'),
  allowed_sides jsonb, symbols jsonb, sizing jsonb, caps jsonb,
  schedule jsonb, webhook_secret_hash, context_pack_ids uuid[],
  frozen_context_hash text null, created_at, updated_at

signals
  id, strategy_id, source, raw_payload jsonb, fingerprint, received_at, status

order_intents
  id, signal_id null, strategy_id, normalized jsonb, risk_result jsonb,
  context_hash, status, created_at

approvals
  id, order_intent_id, status, decided_by, decided_at, expires_at

orders
  id, order_intent_id, client_order_id, broker_order_id, status, submitted_at

fills
  id, order_id, qty, price, ts, fees, raw jsonb

positions_snapshot
  id, user_id, env, snapshot jsonb, taken_at

context_packs
  id, user_id, name, soft_token_cap, created_at

context_documents
  id, pack_id, path, sort_order, body_md, updated_at

context_versions
  id, pack_id, hash, bundle jsonb, note, created_at

training_feedback
  id, pack_id, version_hash, signal_sim jsonb, proposal jsonb,
  label enum('correct','almost','wrong'), note, created_at

audit_events
  id, user_id, ts, actor, type, entity_ref, payload jsonb,
  strategy_id null, context_pack_ids uuid[], context_version_hash text

analytics_daily_rollups
  user_id, env, day, strategy_id null, metrics jsonb
  PRIMARY KEY (user_id, env, day, strategy_id)
```

Encryption: AES-GCM for secrets at rest; keys from env `CREDENTIALS_KEK`.

---

## API SURFACE (ROUTE HANDLERS)

```text
POST   /api/webhooks/tradingview/:strategyId
GET    /api/strategies
POST   /api/strategies
PATCH  /api/strategies/:id
POST   /api/strategies/:id/arm
POST   /api/strategies/:id/disarm
POST   /api/approvals/:id/approve
POST   /api/approvals/:id/reject
POST   /api/kill-switch
GET    /api/positions
GET    /api/blotter
GET    /api/journal
GET    /api/analytics?range&env&filters
POST   /api/connections/alpaca
POST   /api/connections/alpaca/test
GET    /api/train/packs
POST   /api/train/packs
PATCH  /api/train/packs/:id/docs
POST   /api/train/packs/:id/versions
POST   /api/train/packs/:id/simulate
POST   /api/train/feedback
POST   /api/desk/chat
POST   /api/env/enable-live   # body: { confirm: "ENABLE LIVE" }
```

Webhook handler: verify secret → persist signal → `202`/`200` fast → queue process.

Idempotency: `client_order_id = hash(strategyId + signalFingerprint + attempt)` unique.

---

## ORDER / RISK STATE MACHINE

```text
signal_received
  → normalize
  → risk_check
      fail → rejected_receipt (Needs attention)
      pass → proposal
          → if draft: approval_pending
          → if armed: submit_alpaca
approval_pending
  → approved → submit_alpaca
  → rejected / expired → terminal
submit_alpaca
  → accepted → open/partial → filled
  → broker_reject → Needs attention
```

Risk gates (all must pass):
1. Env + strategy mode allow
2. Side allowed
3. Symbol allowed
4. Notional ≤ max
5. Qty ≤ max contracts/shares
6. Open risk ≤ max
7. Daily loss < max (else auto-disarm + alert)
8. Session/hours gate
9. Duplicate fingerprint suppression window (default 60s)
10. Naked short options blocked unless enabled + account approved
11. Option level sufficient
12. Buying power sufficient (estimate)

---

## TRADINGVIEW PAYLOAD CONTRACT

Recommended alert JSON:

```json
{
  "secret": "{{strategy_secret}}",
  "action": "open",
  "symbol": "AAPL",
  "side": "buy",
  "instrument": "option",
  "option": { "right": "call", "strike": 230, "expiry": "2026-11-21" },
  "qty": 2,
  "orderType": "limit",
  "limitPrice": 1.85,
  "strategyKey": "orb-calls",
  "tv_alert_id": "{{alert_id}}"
}
```

Normalization maps to Alpaca option symbol; failures create Needs attention with parse error.

---

## ALPACA INTEGRATION RULES

- Official API; paper host vs live host from env
- Never log secrets
- Reconcile positions/orders on boot + every 60s
- Poll order status if stream unavailable
- Surface rejects verbatim in UI
- Short equity: check shortable/easy-to-borrow when available; otherwise warn in approval
- Options: single-leg only in v1
- Live path feature-flagged until paper e2e tests green

---

## AI / DESK PROMPT ASSEMBLY

Order of prompt sections:
1. Hard system policy (product rules + not advice)
2. System Bible (pack)
3. Strategy docs (entry/exit/sizing/no-trades/map)
4. Lessons (newest first within budget)
5. Examples / skips (budgeted)
6. Live account snapshot (positions, BP, open orders, today’s P&L)
7. Hard risk caps (machine-readable)
8. User message or signal

Persist `context_hash` + pack ids on every proposal.
Model temperature low (≤0.3) for trading proposals.
If model uncertain → Draft proposal with questions, never silent submit.

---

## COPY DECK (LOCK TONE)

- `Needs your approval`
- `Not now`
- `Approve order`
- `On the record`
- `Paper trading`
- `Live trading — real money`
- `Disarm all`
- `Fictional sample data`
- `Sample. Desk prepares it; you approve before Alpaca receives an order.`
- `This is execution and journaling software, not financial advice.`

Forbidden copy: “guaranteed,” “alpha printer,” “to the moon,” emoji CTAs.

---

## RESPONSIVE BREAKPOINTS

- `≥1280` full rail + dual panes (Train, Analytics charts beside tables)
- `1024–1279` rail collapsed icons + labels on hover
- `768–1023` top bar + hamburger; Approvals full width
- `<768` bottom tabs: Home · Approvals · Desk · Train · More  
  Kill switch under More. Charts simplify to one at a time.

Touch targets ≥44px for Approve / Kill.

---

## PERFORMANCE BUDGETS

- Marketing LCP < 2.5s on broadband
- App TTI interactive shell < 3s
- Webhook ACK < 300ms p95 before queue
- Analytics query < 500ms for ≤10k fills (index + rollups)
- No layout shift on approval badge increments

---

## SECURITY

- Auth required for all `/app` and mutating APIs
- Webhook secret constant-time compare
- CSRF on cookie session mutations
- Rate limit webhooks per strategy
- Rate limit Desk chat
- Escape/CRM: no prompt injection from TV payload executing shell — treat payload as data
- Audit every secret rotate and live enable

---

## TESTING MATRIX (SHIP GATE)

1. Webhook auth fail → 401, no signal row side effects beyond optional security log
2. Normalize option intent → expected OCC/body
3. Risk gate each fail path unit-tested
4. Draft → approve → paper order mocked → fill → journal row
5. Armed Auto submit path
6. Kill switch disarms + cancel called
7. Context budget never drops bible
8. Arm freezes hash; edit pack doesn’t change frozen hash until re-arm
9. Feedback Wrong appends lesson; next simulate cites it
10. Analytics rollup matches sum(fills)
11. Paper/live combine toggle
12. Enable live rejects without exact confirm string
13. Playwright: approval keyboard path; mobile Approvals badge

---

## REPO STRUCTURE (SUGGESTED)

```text
apps/web/
  app/(marketing)/...
  app/(app)/app/...
  components/approval-card.tsx
  components/receipt.tsx
  components/context-window-meter.tsx
  components/analytics/...
  lib/risk/engine.ts
  lib/alpaca/client.ts
  lib/tradingview/normalize.ts
  lib/ai/assemble-context.ts
  lib/analytics/rollups.ts
  styles/tokens.css
prisma/schema.prisma  OR  drizzle/
tests/...
docs/AUTO_TRADING_APP_BUILD_PROMPT.md
.env.example
README.md
```

---

## IMPLEMENTATION PHASES (BUILD ORDER)

### Phase 0 — Foundation
Design tokens, fonts, shell, auth, env badge, marketing landing (hero + approval sample + FAQ)

### Phase 1 — Journal + Connections
Alpaca paper connect, encrypt secrets, reconcile, journal UI

### Phase 2 — Strategies + Webhook + Risk + Approvals
Draft mode path to mocked/paper order; approval card; receipts

### Phase 3 — Train
Packs, editor, budget meter, versions, simulate, feedback

### Phase 4 — Armed Auto + Kill switch
Frozen hash, auto submit, disarm, cancel, flatten typed confirm

### Phase 5 — Analytics
Rollups, charts, breakdowns, export, Desk analytics answers

### Phase 6 — Hardening
Tests green, live enable gate, README, seed Demo ORB pack + sample analytics

Do not start Phase 4 until Phase 2 paper approve→fill works. Do not enable live until Phase 6 tests pass.

---

## DELIVERABLES CHECKLIST

- [ ] README: env vars, migrate, run, TV alert setup, paper key instructions
- [ ] `.env.example` complete (Alpaca, DB, auth, LLM, `CREDENTIALS_KEK`, token cap)
- [ ] Landing matches hero rules + Sample labels
- [ ] Paper path: webhook → proposal → approve → Alpaca paper fill → journal
- [ ] Train loop with citations + Correct/Wrong/Almost
- [ ] Analytics KPIs + equity curve + export
- [ ] Kill switch + live typed confirm
- [ ] Seed Demo ORB context pack + fictional samples
- [ ] Test suite from Testing Matrix
- [ ] No banned visual patterns

---

## ACCEPTANCE CRITERIA (PRODUCT OWNER)

1. First viewport of `/` reads as TradeDesk even with nav removed; brand is hero-level.
2. I connect Alpaca paper, create strategy, paste TV webhook, fire alert, see pending approval, approve, see paper fill, see every step in Journal.
3. I paste my system into Train, bind it, simulate, see citations, mark Wrong with a note, re-simulate, see the lesson applied.
4. Context meter visible; over-budget warns; System Bible remains.
5. Arming freezes context hash; kill switch disarms and can cancel orders.
6. Analytics shows P&L, win rate, equity curve, strategy breakdown; paper≠live unless Combine.
7. Export CSV matches filtered rows; drill-down opens receipt chain.
8. Live cannot enable without typing `ENABLE LIVE`.
9. No trade exists without audit/journal row.
10. UI has no purple-glow crypto look, no cream-terracotta broadsheet, no Inter/Roboto primary, no inset hero card.

---

## CREDENTIALS

Human provides later: Alpaca paper (then live) keys, TradingView alert setup, LLM API key.  
**Never invent secrets. Read from env only.**

---

## FINAL INSTRUCTION TO THE BUILDER

Execute as a contract engineer and principal designer. Ship Phase 0→6 in small commits. Prefer deleting chrome over adding widgets. When unsure, copy WeBuilt’s approval/receipt posture and apply it to orders. Charts are subordinate to triage, approvals, trainability, and truth in the journal.
