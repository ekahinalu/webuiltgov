# Master Build Prompt — TradeDesk (WeBuilt-grade Auto Trading Desk)

> **How to use:** Copy everything from `## ROLE` to the end into a coding agent as the sole product brief. This is a contract-engineer + principal UI/UX designer + **AI model-training master** handoff. Build exactly to this. Do not invent a different product. Do not skip Train, Analytics, Model Lab, or the approval/receipt model.

---

## ROLE

You are simultaneously:

1. **Staff contract engineer** shipping a production paper-first trading desk (Next.js, Postgres, Alpaca, TradingView webhooks, LLM context assembly).
2. **Principal UI/UX designer** responsible for a WeBuilt/Studly-class experience: calm, approval-first, receipt-driven, brand-forward marketing, sparse operational app chrome.
3. **AI model-training master** who knows how trading models are actually built: data flywheels, labels, baselines, eval harnesses, supervised fine-tunes, preference learning, distillation, and promotion gates — so the user can **learn trading** and eventually run **their own trading model**, not rent a black-box “AI picks” feed.

You will design and implement end-to-end. Prefer opinionated defaults over configuration sprawl. Every screen has one job. Every money action waits for a yes unless Armed Auto + risk gates pass. Every model candidate is scored against the user’s journal and held-out labels before it can propose live risk.

---

## PRODUCT ONE-LINER

**TradeDesk** — Your trading desk, handled. Signals arrive. The desk proposes. You approve. Alpaca executes. Everything is logged, trainable, and measurable — until you graduate to **your own trading model** in Model Lab.

Analog: getwebuilt.com’s Studly, but for **stocks (long/short), single-leg options (calls/puts), and crypto** — not contractors.

**Asset classes in scope (mandatory):** `stock` · `option` · `crypto` — all via Alpaca where supported. Strategies declare which classes they may trade; analytics, Train, and Model Lab slice by asset class.

---

## NORTH-STAR UX PRINCIPLES (NON-NEGOTIABLE)

1. **Approval-first capital.** Nothing that opens, adds, or closes risk runs without explicit Approve — unless the strategy is `Armed Auto` and every hard risk gate passes.
2. **Receipts over dashboards.** Every meaningful action yields an on-the-record receipt (who / what / when / why / source / result). Undo only when truly reversible (disarm, cancel unfilled, restore context version). Never fake-undo a broker fill.
3. **Paper by default.** Environment badge is always visible. Live requires typed confirm phrase: `ENABLE LIVE`.
4. **Teachable AI → owned policy.** Start with Context Packs + Correct/Wrong/Almost; capture episodes; train baseline then LoRA students in Model Lab; promote only through eval gates — not vibes, not generic “AI picks.”
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
- Dark-mode-by-default “crypto casino terminal” UI (crypto **trading** is in scope; neon terminal chrome is not)
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
| `/app/lab` | Model Lab — datasets, training runs, evals, promote |
| `/app/lab/[runId]` | Run detail: metrics, confusion, promotion checklist |
| `/app/learn` | Trader learning track (curriculum alongside model training) |
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

Eyebrow allowed only if it does not overpower brand: `Paper-first · Stocks · Options · Crypto · Alpaca · TradingView`

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
2. **Asset classes** (multi-select): `stock` · `option` · `crypto` (at least one required)
3. Allowed sides (shown per enabled class):
   - Stock: buy, sell, short, cover
   - Option: buy call, buy put, sell call, sell put (sell defaults OFF)
   - Crypto: buy, sell (no traditional hard-to-borrow short unless Alpaca product supports; label clearly)
4. Universe: symbols list or `*` with denylist — stocks `AAPL`, options via underlying+contract fields, crypto `BTC/USD` (normalize aliases `BTCUSD` → `BTC/USD`)
5. Sizing: fixed qty | fixed `$` risk | `%` equity (pick one primary); crypto may use notional `$` buy as first-class
6. Caps: max notional/order, max shares, max option contracts, max crypto qty/notional, max open positions **per class**, max daily loss `$` (global + optional per-class)
7. Schedule: stocks/options default RTH ON (optional extended); **crypto default 24/7** with optional quiet hours / weekend throttle
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
- Filters drawer: **asset class** (stock/option/crypto), strategy, pack version, symbol/pair, side, mode, session

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
Grouped or filterable by asset class. Columns: class, symbol/instrument (stock ticker · option OCC display · crypto pair), qty, avg, mark, uPnL, strategy tag if known, flatten/close action (approval). Crypto shows pair `BTC/USD` and fractional qty.

---

## CONNECTIONS

### Alpaca
- API Key ID + Secret (write-only after save; show last4)
- Base URL paper/live tied to env
- Test connection → account status, stock BP, option level, shorting enabled, **crypto status / crypto buying power** if available
- Capability badges: `Stocks` · `Options` · `Crypto` (grey out classes account cannot trade)
- Reconcile now (stocks + options + crypto positions/orders)

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
  asset_classes text[]  -- subset of stock|option|crypto
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
2. `assetClass` allowed on strategy (`stock` | `option` | `crypto`)
3. Side allowed for that class
4. Symbol / pair allowed
5. Notional ≤ max (class-specific cap if set)
6. Qty ≤ max shares / contracts / crypto qty
7. Open risk ≤ max (global + per-class open count)
8. Daily loss < max (else auto-disarm + alert); optional per-class daily loss
9. Session/hours gate — RTH for stock/option by default; crypto 24/7 unless quiet hours set
10. Duplicate fingerprint suppression window (default 60s)
11. Naked short options blocked unless enabled + account approved
12. Option level sufficient (options only)
13. Buying power / crypto BP sufficient (estimate)
14. Crypto pair on allowlist and Alpaca-tradable

---

## TRADINGVIEW PAYLOAD CONTRACT

All alerts MUST include `assetClass`: `stock` | `option` | `crypto`.

### Stock
```json
{
  "secret": "{{strategy_secret}}",
  "assetClass": "stock",
  "action": "open",
  "symbol": "AAPL",
  "side": "buy",
  "qty": 100,
  "orderType": "limit",
  "limitPrice": 190.5,
  "strategyKey": "orb-equity",
  "tv_alert_id": "{{alert_id}}"
}
```

### Option
```json
{
  "secret": "{{strategy_secret}}",
  "assetClass": "option",
  "action": "open",
  "symbol": "AAPL",
  "side": "buy",
  "option": { "right": "call", "strike": 230, "expiry": "2026-11-21" },
  "qty": 2,
  "orderType": "limit",
  "limitPrice": 1.85,
  "strategyKey": "orb-calls",
  "tv_alert_id": "{{alert_id}}"
}
```

### Crypto
```json
{
  "secret": "{{strategy_secret}}",
  "assetClass": "crypto",
  "action": "open",
  "symbol": "BTC/USD",
  "side": "buy",
  "notional": 500,
  "orderType": "market",
  "strategyKey": "btc-breakout",
  "tv_alert_id": "{{alert_id}}"
}
```

Crypto may use `qty` **or** `notional` (notional preferred for market buys). Normalize `BTCUSD`, `BTC-USD` → `BTC/USD`.  
Reject if `assetClass` missing or not enabled on the strategy. Parse failures → Needs attention.

---

## ALPACA INTEGRATION RULES

- Official API; paper host vs live host from env
- Never log secrets
- Reconcile **stock, option, and crypto** positions/orders on boot + every 60s
- Poll order status if stream unavailable
- Surface rejects verbatim in UI
- **Stocks:** long + short; check shortable/ETB when available; otherwise warn in approval
- **Options:** single-leg only in v1; map to Alpaca/OCC option symbol
- **Crypto:** Alpaca crypto orders; fractional qty; 24/7; notional buys supported; route with correct crypto order params
- Submitter branches on `assetClass`
- Live unlock is **per asset class** after that class’s paper e2e is green (crypto paper fill ≠ live options unlock)

---

## ASSET CLASS MATRIX (IMPLEMENT LITERALLY)

| | Stocks | Options | Crypto |
|---|---|---|---|
| Broker | Alpaca equities | Alpaca options | Alpaca crypto |
| Session default | RTH | RTH | 24/7 |
| Short / reduce | Short + cover | STO gated; BTC/STC | Sell reduces long; no locate-short unless Alpaca supports — capability badge |
| Sizing | shares | contracts | qty or notional `$` |
| Display | `AAPL` | `AAPL 230C 2026-11-21` | `BTC/USD` |
| Risk extras | PDT info caution | option level, naked block | max crypto notional, pair allowlist |
| Analytics / Lab | `assetClass=stock` | `assetClass=option` | `assetClass=crypto` — eval/promote **per class** |

**UI chips** on Positions, Blotter, Analytics, Journal: `All · Stocks · Options · Crypto`.  
**Home pulse:** stock P&L · option P&L · crypto P&L as a definition list (not cards).  
**Strategies** may be single-class or multi-class; multi-class must still pass per-class caps.  
**Train:** recommend separate Context Packs per class (vol regimes differ); binding may include multiple packs.  
**Model Lab:** `episode.assetClass` required; skip-F1 and promotion gates computed per class before that class may use `π_user` in Armed.
---

## AI / DESK PROMPT ASSEMBLY

Order of prompt sections:
1. Hard system policy (product rules + not advice)
2. System Bible (pack)
3. Strategy docs (entry/exit/sizing/no-trades/map)
4. Lessons (newest first within budget)
5. Examples / skips (budgeted)
6. Live account snapshot (positions by class, stock/option BP, crypto BP, open orders, today’s P&L by class)
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
2. Normalize intents for **stock, option, and crypto** (OCC body; `BTCUSD`→`BTC/USD`; notional crypto buy)
3. Risk gate each fail path unit-tested (including wrong assetClass on strategy, crypto outside allowlist, RTH block on stock, 24/7 allow on crypto)
4. Draft → approve → paper order mocked → fill → journal row — **once per asset class**
5. Armed Auto submit path per class
6. Kill switch disarms + cancel called (including open crypto orders)
7. Context budget never drops bible
8. Arm freezes hash; edit pack doesn’t change frozen hash until re-arm
9. Feedback Wrong appends lesson; next simulate cites it
10. Analytics rollup matches sum(fills) globally and per assetClass
11. Paper/live combine toggle
12. Enable live rejects without exact confirm string; per-class live unlock respected
13. Playwright: approval keyboard path; mobile Approvals badge; asset-class filter chips

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

### Phases 7–10 — Model Lab (see AI MODEL TRAINING MASTER)
Dataset flywheel → baseline student → LoRA SFT → DPO + promote/rollback + Learn curriculum

Do not start Phase 4 until Phase 2 paper approve→fill works. Do not enable live until Phase 6 tests pass. Do not start Phase 9 until Phase 8 beats teacher skip-F1 on held-out labels.

---

## DELIVERABLES CHECKLIST

- [ ] README: env vars, migrate, run, TV alert setup, paper key instructions
- [ ] `.env.example` complete (Alpaca, DB, auth, LLM, `CREDENTIALS_KEK`, token cap)
- [ ] Landing matches hero rules + Sample labels
- [ ] Paper path: webhook → proposal → approve → Alpaca paper fill → journal
- [ ] Train loop with citations + Correct/Wrong/Almost
- [ ] Analytics KPIs + equity curve + export
- [ ] Kill switch + live typed confirm
- [ ] Seed Demo ORB (options) + Demo Equity ORB (stocks) + Demo Crypto Breakout + fictional samples
- [ ] Paper e2e path proven for stock, option, and crypto separately
- [ ] Test suite from Testing Matrix
- [ ] No banned visual patterns

---

## ACCEPTANCE CRITERIA (PRODUCT OWNER)

1. First viewport of `/` reads as TradeDesk even with nav removed; brand is hero-level.
2. I connect Alpaca paper, create strategies for **stock, option, and crypto**, paste TV webhooks, fire alerts for each class, approve, see paper fills, see every step in Journal with correct `assetClass`.
3. I paste my system into Train, bind it, simulate, see citations, mark Wrong with a note, re-simulate, see the lesson applied.
4. Context meter visible; over-budget warns; System Bible remains.
5. Arming freezes context hash; kill switch disarms and can cancel orders.
6. Analytics shows P&L, win rate, equity curve, strategy breakdown; paper≠live unless Combine.
7. Export CSV matches filtered rows; drill-down opens receipt chain.
8. Live cannot enable without typing `ENABLE LIVE`.
9. No trade exists without audit/journal row.
10. UI has no purple-glow crypto look, no cream-terracotta broadsheet, no Inter/Roboto primary, no inset hero card.

---

## ASCII WIREFRAMES (IMPLEMENT LITERALLY)

### Marketing hero (desktop)
```text
┌──────────────────────────────────────────────────────────────┐
│ TradeDesk          Platform   Risk   Sign in   [Start paper] │
│████████████████ FULL-BLEED ATMOSPHERE ████████████████████████│
│                                                              │
│   TradeDesk                                                  │
│   Your trading desk, handled.                                │
│   Desk proposes from your system and TradingView.            │
│   You approve. Alpaca executes. Every fill is logged.        │
│                                                              │
│   [ Start paper desk ]    See how approvals work →           │
│                                                              │
│██████████████████████████████████████████████████████████████│
└──────────────────────────────────────────────────────────────┘
```
Forbidden in this frame: KPI tiles, schedule, “this week,” address, promo chips, inset image card.

### App home (desktop)
```text
┌─────┬────────────────────────────────────────────────────────┐
│ TD  │ PAPER · BP $98,420 · Option L2            [Kill] [⌘K] │
│Home │                                                        │
│Appr*│ Needs your attention                                   │
│Pos  │ • Approve ORB call AAPL 2ct — waiting 4m   [Open]      │
│Blot │ • Broker reject SPY put — option BP        [Open]      │
│Strat│ • Daily loss 72% of limit — ORB still Armed [Review]   │
│Train│                                                        │
│Anal │ Today                                                  │
│Jour │ Realized +$420   uPnL −$80   Fills 6                   │
│Conn │                                                        │
│Set  │ Open risk (3)                     Analytics snapshot   │
│     │ AAPL 230C  +$120                  Today +420 · WR 58%  │
│     │ …                                 Drawdown −3.2%  →    │
└─────┴────────────────────────────────────────────────────────┘
```

### Approval focus (modal or dedicated row expand)
```text
┌─────────────────────────────────────────────┐
│ Desk · Needs your approval                  │
│ Submit this paper order?                    │
│                                             │
│ Strategy   ORB Calls · Draft                │
│ Signal     TradingView · 11:04:02 MT        │
│ Intent     BUY CALL AAPL 230C 11/21 · 2     │
│            LIMIT 1.85 · debit ~$370         │
│ Max loss   $370 if expires worthless        │
│ Risk       ✓ size ✓ BP ✓ hours ✓ not naked  │
│ Context    System Bible v3 · ORB v12        │
│                                             │
│ [ Approve order ]     [ Not now ]           │
│ id appr_01H… · expires in 14:22             │
└─────────────────────────────────────────────┘
```

### Train editor (desktop)
```text
┌──────────────┬──────────────────────┬─────────────────────┐
│ Packs / Docs │ Markdown editor      │ Active window       │
│ 00 bible *   │ # ORB Calls          │ Budget 41.2 / 64k   │
│ 01 entry     │ ...                  │ ████████░░ 64%      │
│ 02 exits     │                      │ 1. Bible   4.2k     │
│ …            │                      │ 2. Entry   6.1k     │
│              │ [Save version]       │ 3. Lessons 12.0k    │
│              │                      │ 4. Snapshot 1.1k    │
│              │                      │ [Simulate signal]   │
└──────────────┴──────────────────────┴─────────────────────┘
```

### Analytics
```text
Range [30D ▾]  Env [Paper ▾]  [Filters]  [Export]
Net +4,820  WR 57%  PF 1.8  Exp +$62  MaxDD −6.1%
[ equity curve ========================= ]
[ daily bars ||| | ||||| ||| ]
Breakdown by strategy                    Trade table…
```

---

## COMPONENT ANATOMY (ENGINEERING NOTES)

### `<EnvBadge />`
- Props: `env: 'paper' | 'live'`
- PAPER → `--paper-badge` bg, white text, label `PAPER`
- LIVE → `--danger` bg, white text, label `LIVE · REAL MONEY`
- Always visible in app chrome; also on landing only after sign-in strip if logged in

### `<AttentionList />`
- Items sorted: pending approvals (oldest first), broker rejects (newest first), risk warnings
- Each row: title, meta, age, primary deep link
- Empty: `Nothing needs you right now.` + last journal event link

### `<ModeBadge />`
- off / draft / armed visual tokens per Design System
- Armed shows 6px accent dot with 1.2s opacity pulse (disabled under reduced motion)

### `<MonoMoney />`
- IBM Plex Mono tabular nums
- Sign-aware color: positive `--accent`, negative `--danger`, zero muted
- Always show sign for non-zero; currency format USD

### `<ContextBudgetMeter />`
- Linear bar + numeric `used / cap`
- Warning at ≥85%; error styling at ≥100% with truncation policy text
- Tooltip lists slices

### `<ReceiptStack />`
- Newest first; sticky date headers
- Expandable payload; copy id button

### `<KillSwitchButton />`
- Looks like text danger control, not giant red candy button (avoid panic misclicks AND avoid looking like a game)
- Opens `<ConfirmPanel />` with explicit checkboxes

---

## MICROCOPY LIBRARY (USE VERBATIM WHERE POSSIBLE)

### Buttons
- Start paper desk
- Approve order
- Not now
- Arm strategy
- Disarm
- Save version
- Run simulation
- Correct / Almost / Wrong
- Export CSV
- Enable live trading
- Rotate webhook secret
- Reconcile now
- Add to Train examples

### Status
- Waiting for your approval
- Approved — submitting to Alpaca
- Filled
- Partially filled
- Canceled
- Broker rejected
- Expired — signal stale
- Disarmed by kill switch
- Auto-disarmed — max daily loss

### Errors (human, specific)
- `TradingView secret did not match. Signal was not stored as tradable.`
- `Could not parse option expiry. Expected YYYY-MM-DD.`
- `Order size 12 exceeds strategy max 5 contracts.`
- `Buying power ~$210 is below estimated debit $370.`
- `Strategy is Off. Turn on Draft to propose, or Arm to auto-execute.`
- `Context window over budget. Lessons truncated; System Bible kept.`
- `Live trading is off. Type ENABLE LIVE in Settings to continue.`
- `Flatten requires typing FLATTEN. Positions not changed.`

### Empty states
- Approvals: `No pending approvals. Draft proposals and Armed Auto checks will land here.`
- Train: `Paste your system rules to teach Desk how you trade.`
- Analytics: `Analytics appear after fills. Run paper trades or open Sample.`
- Connections: `Connect Alpaca paper to place orders. Keys are encrypted at rest.`

---

## EDGE CASES & PRODUCT RULES

1. **Duplicate webhooks:** same fingerprint within 60s → audit `signal_suppressed`, no second order.
2. **Partial fills:** journal each fill; position avg updates; approval not re-requested.
3. **Replace intent:** new signal for same strategy+symbol while pending approval → supersede old approval (`superseded`), new card.
4. **Alpaca down:** order_submit fails → Needs attention + retry button (creates new client_order_id suffix `-r2`).
5. **Clock skew:** store UTC; display America/Denver for this product owner by default with timezone in Settings.
6. **Option expiration day:** if signal opens expiring-today contract, approval shows caution `Expires today`.
7. **Short locate unknown:** approval shows caution; user can still approve on paper; live may broker-reject.
8. **Context edit while Armed:** banner `Editing will not affect Armed strategies until you re-arm.`; save still versions pack.
9. **Delete pack in use:** blocked; must unbind strategies first.
10. **LLM timeout:** fallback proposal = deterministic normalize-only intent without narrative; still requires approval in Draft.
11. **User rejects:** store reason optional; signal terminal; no order.
12. **Multiple accounts:** v1 one paper + one live credential pair per user max.
13. **CSV upload examples:** map columns `symbol,side,right,strike,expiry,qty,entry,exit,notes,label`; bad rows skipped with count toast.
14. **Daylight session gate:** use `America/New_York` for RTH 09:30–16:00 regardless of display TZ.
15. **P&L accounting:** realized on closing fill; fees subtract; analytics mark-to-market unrealized from last snapshot.

---

## SEED / DEMO DATA (REQUIRED)

### Context Pack `Demo ORB` (options)
- Bible: trade opening range breakout on liquid names; no earnings day; max 2 contracts; RTH only; calls on upside break, puts on downside; stop = range width; target 1.5R.
- Three example wins, two skips (earnings, wide spread).
- TV map documenting option JSON fields.

### Context Pack `Demo Equity ORB` (stocks)
- Same ORB logic with share sizing; short only if ETB; RTH; TV `assetClass=stock` map.

### Context Pack `Demo Crypto Breakout` (crypto)
- Liquid pairs only (`BTC/USD`, `ETH/USD`); notional sizing; 24/7 with optional quiet hours; no earnings metaphor — use “major network event / extreme spread” skips; TV crypto JSON map.

### Sample journal (fictional)
- 12 audit events across signal→fill for AAPL call and a reject on low BP.
- Analytics sample rollups for last 10 weekdays.

All sample UI must show `Sample` + `Fictional sample data`.

---

## DETAILED USER FLOWS

### Flow A — First paper fill (happy path)
1. Sign up → ack risk → connect Alpaca paper (test OK)
2. Train: paste system → Save version v1
3. Strategies: create ORB · Draft · bind pack · copy webhook
4. TV alert fires → Attention badge +1 → approval card
5. User Approve → order submitted → fill receipt → blotter row
6. Analytics updates within 60s (or on demand recompute)
7. User Add to Train examples from receipt

### Flow B — Armed Auto
1. Strategy Draft proven with ≥1 successful paper fill (soft nudge, not hard block)
2. Arm modal checklist + type name
3. TV signal → risk pass → submit without approval
4. Receipt `order_submitted` actor=system; Attention only if reject/breach
5. Daily loss breach → auto-disarm + Attention

### Flow C — Train correction
1. Simulate signal that should be skipped (earnings)
2. Desk proposes buy → user Wrong + note “No earnings day trades”
3. Lesson appended
4. Same simulation → Desk returns `No trade` proposal with citation to lesson
5. No Alpaca call

### Flow D — Kill switch
1. User opens Kill
2. Checks Disarm all + Cancel open orders → confirm
3. All strategies Off/Draft; cancel API invoked; receipts written
4. Flatten remains unchecked unless typed `FLATTEN`

### Flow E — Enable live
1. Settings → Enable live
2. Must have Alpaca live credentials tested
3. Type `ENABLE LIVE` + ack “real money”
4. Env badge flips; all strategies forced to Off; user re-arms deliberately

---

## FORM VALIDATION RULES

| Field | Rule |
|---|---|
| Strategy name | 2–48 chars, unique per user |
| Symbols | Uppercase tickers `[A-Z]{1,6}` or `*` |
| Max daily loss | > 0 |
| Max contracts | integer 1–100 in v1 |
| Limit price | > 0 if orderType=limit |
| Webhook secret | ≥24 chars random; shown once on rotate |
| Confirm live | exact `ENABLE LIVE` |
| Confirm flatten | exact `FLATTEN` |
| Pack name | 2–64 chars |

Inline errors under fields; do not use only toasts for validation.

---

## DESK TOOLING (ASSISTANT CAPABILITIES)

Desk may call tools (server-side) limited to:
- `get_account_snapshot`
- `get_open_positions`
- `get_analytics_summary`
- `list_attention_items`
- `create_order_proposal` → always returns approval in Draft; Armed only if strategy armed and user said “execute under armed rules” AND gates pass
- `disarm_strategy` / `disarm_all` (receipt; kill-level flatten still separate)
- `search_journal`

Desk must refuse: tax advice, guaranteed profit claims, changing live env without Settings confirm UI.

---

## OPTION SYMBOL HANDLING

- User/TV may pass strike/expiry/right; system builds Alpaca option symbol
- Display format: `AAPL 230C 2026-11-21`
- Store both display and broker symbol
- Reject if expiry parse fails or strike not numeric
- v1: American equity options only; no index special cases beyond what Alpaca accepts (surface broker error if any)

---

## SHORT STOCK HANDLING

- Side `sell` / `short` when flat → short open; when long → sell to reduce (normalize carefully using position snapshot)
- Approval must say `SHORT` explicitly in title when opening short
- Cover = buy to close short; label `COVER`

---

## CRYPTO HANDLING

- `assetClass=crypto` only; never route BTC through equity order path
- Symbol canonical form `BASE/QUOTE` (USD quote first-class in v1; surface broker errors for others)
- Prefer `notional` for market buys; support fractional `qty`
- Session: trade 24/7 unless strategy quiet hours; approval shows `CRYPTO · 24/7` badge
- Selling only closes/reduces long crypto inventory in v1 unless Alpaca account explicitly supports crypto short — if unsupported, risk gate fails with clear copy
- Separate max daily loss optional for crypto (crypto overnight gaps ≠ equity RTH)
- Seed pack `Demo Crypto Breakout` alongside Demo ORB
- Learn curriculum adds a short lesson: “Crypto sessions & notional sizing”
- Desk snapshot includes `crypto_bp` and open crypto positions
- Analytics never blend crypto 24h sessions into “RTH only” slices without labeling

---

## NOTIFICATIONS (V1)

- In-app Attention only (no email/SMS required)
- Optional browser Notification API permission after first approval pending (soft prompt once)
- No marketing push

---

## LOGGING & OBSERVABILITY

- Structured logs: `request_id`, `user_id`, `strategy_id`, `signal_id`
- Never log secret, raw API keys, or full LLM prompts containing keys
- Metrics counters: webhook_received, approval_pending, orders_submitted, orders_rejected, kill_switch
- Error tracking optional (Sentry) behind env flag

---

## README OUTLINE (WRITE THIS FILE)

1. What TradeDesk is / is not
2. Architecture diagram (mermaid)
3. Prerequisites (Node 20+, Postgres 15+, Alpaca paper)
4. `.env` table
5. `pnpm i && pnpm db:migrate && pnpm dev`
6. TradingView alert setup steps with JSON
7. Paper checklist Flow A
8. Train loop
9. Test commands
10. Risk disclosure pointer

---

## .ENV.EXAMPLE KEYS

```bash
DATABASE_URL=
AUTH_SECRET=
APP_URL=http://localhost:3000
CREDENTIALS_KEK=
ALPACA_PAPER_KEY_ID=
ALPACA_PAPER_SECRET=
ALPACA_LIVE_KEY_ID=
ALPACA_LIVE_SECRET=
ALPACA_DATA_URL=
LLM_API_KEY=
LLM_MODEL=
CONTEXT_TOKEN_SOFT_CAP=64000
DEFAULT_APPROVAL_TTL_SECONDS=900
SIGNAL_DEDUP_SECONDS=60
ENABLE_LIVE_FEATURE=false
SENTRY_DSN=
```

---

## DEFINITION OF DONE (PER PR)

A PR is done only if:
- Types pass
- Targeted tests for touched risk/train/analytics pass
- No new banned visual pattern
- Journal event exists for any new mutating trade path
- README updated if env or flow changed
- Screenshots or short notes for UI PRs (landing, approval, train meter)

---

## DESIGN QA CHECKLIST (BEFORE CALLING UI DONE)

- [ ] Brand wordmark is the loudest text in hero
- [ ] Hero has no stats/schedules/chips/overlays
- [ ] Cards only around approvals/confirms/forms
- [ ] Fonts are Syne + Source Sans 3 + IBM Plex Mono
- [ ] Colors match tokens; no purple primary; no cream/terracotta kit
- [ ] Sample labels present on fictional data
- [ ] PAPER/LIVE badge visible in app
- [ ] Reduced motion respected
- [ ] Mobile bottom tabs work; Approve still thumb-reachable
- [ ] Mono numbers align in blotter columns
- [ ] Focus states visible
- [ ] Empty states use microcopy library

---

## ENGINEERING QA CHECKLIST

- [ ] Webhook ACK fast + async process
- [ ] Idempotent client_order_id uniqueness enforced in DB
- [ ] Secrets encrypted; last4 only in UI
- [ ] Risk gates unit-tested individually
- [ ] Context freeze hash on arm verified
- [ ] Analytics rollups recomputable from fills (no drift)
- [ ] Paper/live query paths isolated by default
- [ ] Kill switch audited
- [ ] Live enable exact-string gated
- [ ] Playwright smoke for Flow A

---

## NON-GOALS RESTATED

**Still out of v1 product surface:** multi-broker, multi-leg option spreads, crypto-perpetual futures / exotic derivatives, on-chain wallet custody (Alpaca crypto only), social feed, mobile native, PDF OCR, tax lot engine, dark theme, billing/paywall (unless later asked), SMS Desk, prop-firm rules engine, full historical backtester UI (Lab uses labeled journal + replay bundles first).

**Explicitly IN scope:** **stocks + options + crypto** on Alpaca; Model Lab flywheel — see AI MODEL TRAINING MASTER. Do **not** ship equities-only and call crypto “later” without the matrix, payloads, and filters above.

---

## HANDOFF NOTE TO FUTURE AGENTS

If the human pastes a trading system, convert it into `Demo`→user pack documents using the Train template headings; do not bury rules only in chat history. If the human provides Alpaca/TV credentials, put them in env/secret store — never commit them. Prefer extending this prompt over inventing a parallel product bible.

---



---

## PRISMA SCHEMA DRAFT (IMPLEMENT OR EQUIVALENT DRIZZLE)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql" url = env("DATABASE_URL") }

enum Env { paper live }
enum StrategyMode { off draft armed }
enum ApprovalStatus { pending approved rejected expired superseded }
enum FeedbackLabel { correct almost wrong }

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  timezone  String   @default("America/Denver")
  createdAt DateTime @default(now())
  strategies Strategy[]
  packs      ContextPack[]
  audits     AuditEvent[]
}

model ApiCredential {
  id               String   @id @default(cuid())
  userId           String
  provider         String
  keyId            String?
  secretCiphertext String
  last4            String
  env              Env?
  createdAt        DateTime @default(now())
  @@index([userId, provider])
}

model Strategy {
  id                 String       @id @default(cuid())
  userId             String
  name               String
  mode               StrategyMode @default(off)
  assetClasses       String[]     // stock | option | crypto
  allowedSides       Json
  symbols            Json
  sizing             Json
  caps               Json
  schedule           Json
  webhookSecretHash  String
  contextPackIds     String[]
  frozenContextHash  String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  user               User @relation(fields: [userId], references: [id])
  signals            Signal[]
  @@unique([userId, name])
}

model Signal {
  id          String   @id @default(cuid())
  strategyId  String
  source      String
  rawPayload  Json
  fingerprint String
  status      String
  receivedAt  DateTime @default(now())
  strategy    Strategy @relation(fields: [strategyId], references: [id])
  intents     OrderIntent[]
  @@index([strategyId, fingerprint, receivedAt])
}

model OrderIntent {
  id           String   @id @default(cuid())
  signalId     String?
  strategyId   String
  normalized   Json
  riskResult   Json
  contextHash  String
  status       String
  createdAt    DateTime @default(now())
  signal       Signal?  @relation(fields: [signalId], references: [id])
  approval     Approval?
  order        Order?
}

model Approval {
  id           String         @id @default(cuid())
  orderIntentId String        @unique
  status       ApprovalStatus @default(pending)
  decidedBy    String?
  decidedAt    DateTime?
  expiresAt    DateTime
  orderIntent  OrderIntent @relation(fields: [orderIntentId], references: [id])
}

model Order {
  id             String   @id @default(cuid())
  orderIntentId  String   @unique
  clientOrderId  String   @unique
  brokerOrderId  String?
  status         String
  submittedAt    DateTime @default(now())
  orderIntent    OrderIntent @relation(fields: [orderIntentId], references: [id])
  fills          Fill[]
}

model Fill {
  id      String   @id @default(cuid())
  orderId String
  qty     Decimal  @db.Decimal(18, 6)
  price   Decimal  @db.Decimal(18, 6)
  fees    Decimal  @default(0) @db.Decimal(18, 6)
  ts      DateTime
  raw     Json?
  order   Order @relation(fields: [orderId], references: [id])
  @@index([orderId, ts])
}

model ContextPack {
  id            String   @id @default(cuid())
  userId        String
  name          String
  softTokenCap  Int      @default(64000)
  createdAt     DateTime @default(now())
  user          User @relation(fields: [userId], references: [id])
  documents     ContextDocument[]
  versions      ContextVersion[]
  feedback      TrainingFeedback[]
}

model ContextDocument {
  id        String   @id @default(cuid())
  packId    String
  path      String
  sortOrder Int
  bodyMd    String
  updatedAt DateTime @updatedAt
  pack      ContextPack @relation(fields: [packId], references: [id])
  @@unique([packId, path])
}

model ContextVersion {
  id        String   @id @default(cuid())
  packId    String
  hash      String
  bundle    Json
  note      String?
  createdAt DateTime @default(now())
  pack      ContextPack @relation(fields: [packId], references: [id])
  @@index([packId, createdAt])
}

model TrainingFeedback {
  id          String        @id @default(cuid())
  packId      String
  versionHash String
  signalSim   Json
  proposal    Json
  label       FeedbackLabel
  note        String?
  createdAt   DateTime @default(now())
  pack        ContextPack @relation(fields: [packId], references: [id])
}

model AuditEvent {
  id                 String   @id @default(cuid())
  userId             String
  ts                 DateTime @default(now())
  actor              String
  type               String
  entityRef          String?
  payload            Json
  strategyId         String?
  contextPackIds     String[]
  contextVersionHash String?
  user               User @relation(fields: [userId], references: [id])
  @@index([userId, ts])
  @@index([type, ts])
}

model AnalyticsDailyRollup {
  userId     String
  env        Env
  day        DateTime @db.Date
  strategyId String   @default("")
  metrics    Json
  @@id([userId, env, day, strategyId])
}
```

---

## EXAMPLE API REQUEST / RESPONSE

### Approve
```http
POST /api/approvals/appr_01HXYZ/approve
Cookie: session=…

→ 200
{
  "approvalId": "appr_01HXYZ",
  "status": "approved",
  "order": {
    "clientOrderId": "td_orb_9f3c_0",
    "brokerOrderId": "alpaca_…",
    "status": "accepted"
  },
  "receiptId": "evt_…"
}
```

### Analytics
```http
GET /api/analytics?range=30d&env=paper&strategyId=strat_orb
→ 200
{
  "range": {"start": "2026-10-15", "end": "2026-11-14", "tz": "America/Denver"},
  "env": "paper",
  "kpis": {
    "netRealized": 4820.15,
    "unrealized": -120.5,
    "fees": 42.1,
    "winRate": 0.57,
    "profitFactor": 1.82,
    "expectancy": 62.4,
    "maxDrawdown": -0.061,
    "currentDrawdown": -0.012,
    "trades": 77,
    "avgHoldMinutes": 48,
    "avgR": 0.71,
    "medianApprovalLatencySec": 83
  },
  "equityCurve": [{"t": "2026-10-15", "v": 0}, {"t": "2026-11-14", "v": 4820.15}],
  "breakdowns": {"strategy": [{"id": "strat_orb", "trades": 77, "net": 4820.15, "winRate": 0.57}]}
}
```

### Simulate
```http
POST /api/train/packs/pack_orb/simulate
{
  "payload": {"action":"open","symbol":"AAPL","instrument":"option","option":{"right":"call","strike":230,"expiry":"2026-11-21"},"qty":2,"orderType":"limit","limitPrice":1.85}
}
→ 200
{
  "proposal": {
    "action": "submit_order",
    "summary": "BUY CALL AAPL 230C 2026-11-21 × 2 LIMIT 1.85",
    "citations": [
      {"path": "00-system-bible.md", "excerpt": "RTH only; max 2 contracts"},
      {"path": "01-setup-entry.md", "excerpt": "ORB long → calls"}
    ],
    "risk": {"pass": true, "checks": [{"id":"max_contracts","pass":true}]}
  },
  "contextHash": "sha256:…"
}
```

---

## TOKEN ESTIMATION HEURISTIC

- Estimate tokens ≈ `ceil(chars / 4)` for English markdown
- Show both chars and estimated tokens in the meter
- Cap enforcement uses estimated tokens; log actual LLM usage when provider returns it and calibrate later
- Hard ceiling = soft cap; never send over ceiling

---

## ACCESSIBILITY MATRIX

| Surface | Requirement |
|---|---|
| Approval Approve/Not now | Buttons focusable; `aria-keyshortcuts` documented; status in `aria-live` |
| Kill switch | Confirm dialog `role="dialog"` modal, focus trap, Esc closes without action |
| Charts | Provide data table alternative toggle `View as table` |
| Color P&L | Prefix `+`/`−` and `aria-label` |
| Train editor | Labelled textarea; Save version not icon-only |
| Env badge | Text not color-only (`PAPER`/`LIVE · REAL MONEY`) |
| Tabs mobile | `role="tablist"`; selected tab `aria-selected` |

---

## FAQ COPY (LANDING — STRAIGHT ANSWERS)

**What is Desk?**  
Desk is the assistant inside TradeDesk. You ask in plain words. It answers from your journal, Alpaca state, and the Context Packs you trained. It can propose **stock, option, and crypto** orders. It does not send them without your rules for Draft/Armed and your risk gates.

**Who is in control?**  
You are. Draft mode always waits for Approve. Armed Auto still obeys hard limits and can be killed in one control. Live mode stays off until you type `ENABLE LIVE`.

**Is this financial advice?**  
No. TradeDesk is execution, journaling, training context, and analytics software. You are responsible for your trading decisions.

**Paper vs live?**  
Paper is default. Paper and live analytics stay separate unless you choose Combine. Strategies disarm when you enable live so nothing silently carries over.

**How do I teach it my system?**  
Open Train. Paste rules into the Context Pack templates. Simulate signals. Mark Correct, Almost, or Wrong. Lessons stick to the pack and are cited on later proposals.

**What gets logged?**  
Signals, proposals, approvals, rejects, broker acks, fills, arm/disarm, context saves, training feedback, kill-switch uses. If it moved risk or tried to, it is on the record.

---

## VISUAL MOTION SPEC (EXPLICIT)

1. **Approval enter:** `opacity 0→1`, `translateY 8→0`, 180ms `cubic-bezier(0.2, 0.8, 0.2, 1)`
2. **Receipt stamp:** `scale 0.98→1`, opacity 160ms
3. **Equity path:** SVG `stroke-dashoffset` 600ms once per mount
4. **Armed dot pulse:** opacity 1→0.45→1 over 1200ms; stop under reduced motion
5. **No** parallax on app screens; landing atmosphere drift ≤2% only

---

## SAMPLE SYSTEM BIBLE STARTER (PRELOAD IN DEMO PACK)

```markdown
# System Bible — Demo ORB

## Identity
Intraday opening-range breakout on liquid US equities. Options for leverage; no naked shorts.

## Session
Regular Trading Hours only (09:30–16:00 America/New_York). No premarket entries.

## Setup
- Opening range = first 15 minutes high/low
- Long breakout: price holds above range high with rising volume
- Short breakdown: price holds below range low with rising volume

## Entries
- Long → BUY CALL near ATM, same-week or next-week expiry
- Short → BUY PUT near ATM (v1: prefer long puts over short stock unless pack says otherwise)
- Max 2 contracts per trade
- Limit orders preferred; avoid market during first 2 minutes after break

## Exits
- Stop: invalidation back inside opening range
- Target: 1.5R
- Time stop: flat by 15:45 ET if not at target

## Hard no-trades
- Earnings day for that symbol
- Spread wider than 10% of option mid
- Already 2 open ORB positions
- After max daily loss hit

## Sizing
Fixed 2 contracts until account rules change in strategy caps.
```

Builders must ship this as seed content.

---

## RISK ENGINE PSEUDOCODE

```ts
function riskCheck(intent, strategy, account, todayPnL): RiskResult {
  const checks = [];
  const pass = (id, ok, detail?) => checks.push({ id, pass: ok, detail });
  pass('mode_allows', strategy.mode !== 'off');
  pass('asset_class', strategy.assetClasses.includes(intent.assetClass));
  pass('side_allowed', strategy.allowedSides.includes(intent.sideKey));
  pass('symbol_allowed', symbolOk(strategy.symbols, intent.symbol, intent.assetClass));
  pass('max_notional', intent.estNotional <= capFor(strategy, intent.assetClass, 'maxNotional'));
  pass('max_qty', intent.qty <= capFor(strategy, intent.assetClass, 'maxQty'));
  pass('max_open', openCount(account, intent.assetClass) < capFor(strategy, intent.assetClass, 'maxOpen'));
  pass('daily_loss', todayPnL > -strategy.caps.maxDailyLoss);
  pass('session', inSession(strategy.schedule, intent.assetClass, nowNY()));
  pass('dedup', !recentDuplicate(intent.fingerprint));
  pass('naked_block', intent.assetClass !== 'option' || !isNakedShortOption(intent) || strategy.allowNaked);
  pass('option_level', intent.assetClass !== 'option' || optionLevelOk(account, intent));
  pass('buying_power', bpOk(account, intent)); // stock/option BP vs crypto BP
  pass('crypto_pair', intent.assetClass !== 'crypto' || cryptoPairAllowed(intent.symbol));
  return { pass: checks.every(c => c.pass), checks };
}
```

Implement real TypeScript matching this shape; do not leave as comments only.

---

## ANALYTICS METRIC DEFINITIONS

- **Win:** closed round-trip with net P&L > 0 after fees
- **Loss:** closed round-trip with net P&L ≤ 0 after fees
- **Win rate:** wins / closed trades
- **Profit factor:** sum(wins) / abs(sum(losses)); if no losses, `null` display `—`
- **Expectancy:** mean net P&L per closed trade
- **Equity curve:** cumulative sum of closed-trade net P&L by day end
- **Drawdown:** (peak − trough) / peak on equity curve in range; also show `$` absolute
- **R-multiple:** net / initial risk if stop distance known at entry; else exclude from avg R
- **Approval latency:** approve_ts − signal_received_ts for Draft trades only

---

## CONTENT DESIGN — APPROVAL TITLE VERBS

Use exact patterns:
- `Submit this paper order?`
- `Submit this LIVE order?`
- `Arm strategy {name}?`
- `Disarm strategy {name}?`
- `Cancel open orders?`
- `Flatten all positions?`
- `Enable LIVE trading?`
- `Rotate TradingView secret?`

Never `Are you sure?` alone without the verb object.

---

## STATE EMPTY / LOADING / ERROR PATTERNS

- **Loading:** skeleton lines matching final layout density; no spinners in hero
- **Error:** plain sentence + `Try again` + journal link if audit id exists
- **Empty:** microcopy library + one CTA
- **Stale data:** `Updated 12s ago` on Positions; Reconcile action

---

## FILE-LEVEL OWNERSHIP (WHO TOUCHES WHAT)

| Concern | Primary paths |
|---|---|
| Tokens / typography | `styles/tokens.css`, `app/layout.tsx` |
| Landing | `app/(marketing)/page.tsx` |
| Approval UX | `components/approval-card.tsx` |
| Risk | `lib/risk/engine.ts` |
| Alpaca | `lib/alpaca/*` |
| TV normalize | `lib/tradingview/normalize.ts` |
| Context assemble | `lib/ai/assemble-context.ts` |
| Train UI | `app/(app)/app/train/*` |
| Analytics | `lib/analytics/*`, `app/(app)/app/analytics/page.tsx` |
| Webhook | `app/api/webhooks/tradingview/[strategyId]/route.ts` |

Keep files focused; split when >400 lines.

---

## COMMIT MESSAGE CONVENTION

- `feat(train): …`
- `feat(approvals): …`
- `feat(analytics): …`
- `feat(alpaca): …`
- `fix(risk): …`
- `ui(marketing): …`
- `test: …`
- `docs: …`

Ship vertical slices; avoid mega-commits mixing landing CSS with risk engine.

---

## CONTRACT SIGN-OFF CRITERIA (HUMAN)

The human accepts the build when:
1. They can teach a system in Train and see it cited
2. They can run paper Flow A without reading code
3. Analytics matches their journal gut-check
4. The product feels like WeBuilt’s calm control — not a terminal skin
5. Live remains scary-but-clear, never sneaky

---


---

## UI KIT — BUTTON & FORM RECIPES

### Primary button
- Bg `--accent`, text white, h-44px, px-20, radius 6, font Source Sans 3 600 16
- Hover: darken 6%; Active: darken 10%; Focus: brand outline
- Used for: Approve order, Start paper desk, Save version, Run simulation

### Secondary button
- Bg transparent, border `--line`, text `--ink`
- Used for: Not now, Export, Reconcile

### Danger button
- Text `--danger`, border `--danger-soft` or quiet text button
- Used for Kill, Reject, Flatten (after confirm)

### Inputs
- H 44px, border `--line`, focus border `--brand`
- Labels above fields, 14px muted
- Help text 12px under field

### Tables
- Header 12px uppercase tracking wide muted
- Row h ~44–52; hover `--atmosphere-1`
- Numeric columns right-aligned mono

---

## END-TO-END SEQUENCE DIAGRAM (BUILDERS: MATCH THIS)

```text
TV Alert → Webhook Route → verify secret → insert Signal
        → queue → normalize → riskCheck
        → if draft: insert Approval(pending) → push Attention
        → user Approve → submit Alpaca (client_order_id)
        → poll/stream → insert Fill(s) → audit → recompute rollups
        → UI blotter/analytics refresh
```

Armed Auto skips Approval insert when risk pass; still writes audit `proposal_auto_accepted`.

---

## LOCAL DEV SCRIPT EXPECTATIONS

package.json scripts:
- `dev` — next dev
- `build` / `start`
- `db:migrate` / `db:seed`
- `test` / `test:e2e`
- `lint` / `typecheck`

Seed command loads Demo ORB pack + sample analytics + sample approvals marked Sample.

---

## FINAL QUALITY BAR (CONTRACTOR LENS)

If a senior designer reviews the landing and can swap the logo for another fintech and it still “fits,” branding failed — strengthen wordmark and atmosphere until TradeDesk-specific.

If a senior engineer reviews risk/train and finds context able to bypass max daily loss, fail the PR.

If analytics disagree with summed fills by more than one cent after rounding rules, fail the PR.

Rounding: banker’s rounding to cent for display; store full precision decimals.


---

## AI MODEL TRAINING MASTER — OWN YOUR TRADING MODEL

### Mission
The product is not “an LLM that vibes trades.” It is a **school + factory**:
1. The human **learns** a trading system (rules, risk, review).
2. The desk **captures** every decision as labeled data.
3. The lab **trains** models that imitate and then improve *that* system.
4. Only models that beat baselines in **paper shadow** may propose under Draft/Armed.

Truth over magic. No “guaranteed alpha.” Ownership of the model weights/adapters and datasets stays with the user.

### What “our own trading model” means
A user-owned artifact stack:
- **Dataset** `D` — signals, features, human labels, outcomes
- **Policy model** `π` — maps (context, signal, account snapshot) → `{no_trade | propose_order}` + structured order fields + rationale citations
- **Risk layer** `R` — deterministic gates (never learned away)
- **Eval suite** `E` — offline metrics + paper shadow PnL + agreement with human labels
- **Promotion record** — which hash of `π` is allowed in Desk

Base LLM (GPT/Claude/Llama/etc.) is a **bootstrapping teacher**. The destination is a **specialized trader policy** fine-tuned / adapted on the user’s data (LoRA/QLoRA or full FT when justified), optionally distilled to a smaller local model later.

### Learning ladder (human + model together)

| Stage | Human learns | Model learns | Desk mode |
|---|---|---|---|
| L0 Rules | Write System Bible in Train | Context injection only (RAG/prompt) | Draft proposals |
| L1 Imitation | Correct/Wrong/Almost on sims + live Draft | Supervised labels: action, side, size bin, skip reason | Draft |
| L2 Preference | Rank two proposals / edit orders | DPO/ORPO-style preference pairs | Draft |
| L3 Outcome | Journal reviews tagged good process vs lucky | Outcome-aware review models; no PnL leakage into features | Paper Armed shadow |
| L4 Ownership | Read eval report; approve promote | Deploy adapter/weights as `π_user` | Draft → Armed paper |
| L5 Live (optional) | Accept real-money risk | Same `π_user` behind gates | Live only after ENABLE LIVE + promote |

Never jump to L5 without L3–L4 paper evidence.

### Model Lab UI (`/app/lab`) — one job: build & prove models
Sections:
1. **Datasets** — build from journal + training_feedback + context versions
2. **Runs** — start training job, status, loss curve (one chart, one job)
3. **Evals** — held-out accuracy, skip precision, calibration, paper shadow summary
4. **Registry** — model cards: name, base model, data hash, metrics, stage
5. **Promote** — checklist → sets Desk `active_policy_id` (still behind risk gates)

Same design system; no GPU-bro aesthetic. Receipts for every train start, finish, promote, rollback.

### Nav
Add **Lab** and **Learn** to the app rail after Train. Badge Lab when a run completes.

### Dataset schema (export + store)

Each row is a **decision episode**:

```json
{
  "episode_id": "ep_…",
  "ts": "2026-11-14T18:04:02Z",
  "env": "paper",
  "strategy_id": "strat_orb",
  "context_hash": "sha256:…",
  "signal": { "raw": {}, "normalized": {} },
  "account_snapshot": { "bp": 98420, "open_positions": [], "today_pnl": 120 },
  "assetClass": "option",
  "features": {
    "session": "rth",
    "symbol": "AAPL",
    "assetClass": "option",
    "right": "call",
    "strike": 230,
    "expiry": "2026-11-21"
  },
  "label": {
    "action": "submit_order",
    "order": { "side": "buy", "qty": 2, "orderType": "limit", "limitPrice": 1.85 },
    "skip_reason": null,
    "source": "human_approval",
    "feedback": "correct"
  },
  "outcome": {
    "realized_pnl": 140.0,
    "hold_minutes": 42,
    "hit_stop": false,
    "hit_target": true,
    "process_grade": "unlabeled"
  }
}
```

Rules:
- Split **by time** (and optionally by symbol) — no random shuffle leakage
- Train / val / test = 70 / 15 / 15 default; show counts in UI
- Teacher-LLM labels marked `source=teacher_llm` and down-weighted until human confirms
- Rejects and `no_trade` are first-class (critical for options discipline)

### Feature policy
v1 Lab features = signal + snapshot + context hash + session clocks (+ optional TV fields in webhook).  
**Leakage bans:** no future bars, no final PnL inside features, no post-split bible edits bleeding into training labels without versioning.

### Teacher → Student recipe (default stack)

**Teacher (L0–L1):** frontier LLM + Context Pack assembly. Produces proposals + citations. Human grades.

**Student policy targets (Lab allows swap; build in this order):**
1. **Baseline ensemble (ship first):** `no_trade vs trade` classifier + heads for side / qty bin / limit offset — often wins on small data
2. **LoRA/QLoRA adapter on open instruct model** (path to “own model”): Llama 3.1/3.3 or Qwen2.5 — **strict JSON** action schema
3. **DPO/ORPO preference adapter:** chosen human order vs rejected proposal
4. **Distilled mini policy (optional):** 1–3B local proposer; teacher keeps explanations

Do **not** start with RL on live dollars. PnL is noisy; use behavioral cloning + preferences first; bandit/RL only in paper shadow later.

### Training job contract

```http
POST /api/lab/runs
{
  "datasetId": "ds_…",
  "recipe": "baseline_ensemble | lora_sft | dpo",
  "baseModel": "qwen2.5-14b-instruct",
  "hyperparams": { "lr": 1e-4, "epochs": 3, "loraRank": 16 },
  "splitSeed": 7
}
```

Worker (Python alongside Node): pull JSONL/parquet → train → write metrics + `artifact_uri`.  
Scripts required in repo: `scripts/train_baseline.py`, `scripts/train_lora.py` (CPU baseline must run without GPU).

### Evaluation harness (required before Promote)

Offline:
- Action accuracy / macro-F1 (`trade` vs `no_trade`)
- Conditional order-field exact-match when action=trade
- Skip-F1 (treat skips as positive class of interest)
- Schema validity %
- Slice metrics: symbol, side, hour

Paper shadow:
- Candidate `π` proposes in parallel; no submit unless Shadow-Armed experiment
- Compare to human approvals and ex-post PnL

Promotion gates (all required):
1. ≥ N labeled episodes (default 200; warn if <500 for LoRA)
2. Val skip-F1 ≥ baseline + 0.05
3. Schema validity ≥ 99%
4. Shadow ≥ 20 sessions or 50 signals; risk contradiction rate ≤ 1%
5. Human types `PROMOTE MODEL` + selects registry id
6. Risk engine still wraps every order

Rollback: one click; receipt written.

### Desk inference routing
```text
features + context → active_policy.predict() → riskCheck() → Draft approval OR Armed submit
```
Invalid JSON / policy error → fallback teacher LLM Draft-only + Attention `policy_fallback`.

### Trader Learning track (`/app/learn`)
Parallel curriculum for the human (calm WeBuilt tone):
1. Risk units & max daily loss
2. Reading an approval card
3. Writing a System Bible a model can imitate
4. Labeling quality (Wrong > vibes)
5. Reading eval reports (skip-F1, leakage, shadow)
6. When to promote vs keep labeling

Each lesson ends with a Train/Lab task. Checklist in Settings.

### Model card (every registry entry)
Name, stage L1–L5, base model, recipe, dataset hash/counts/range/split, metrics, failure slices, intended use (paper Draft / paper Armed / live Draft), explicit **not advice / no guarantees**.

### Lab tables
```text
datasets(id, user_id, name, filter jsonb, row_count, hash, created_at)
dataset_rows(id, dataset_id, episode jsonb)
train_runs(id, dataset_id, recipe, base_model, status, metrics jsonb, artifact_uri, created_at)
model_registry(id, user_id, run_id, name, stage, active boolean, card jsonb)
shadow_predictions(id, model_id, signal_id, proposal jsonb, created_at)
```

### Phases 7–10 (after desk Phases 0–6)
- **P7 Dataset flywheel** — export episodes, split preview, JSONL download
- **P8 Baseline student** — train + eval + shadow logger
- **P9 LoRA SFT** — adapter registry + Desk routing flag
- **P10 DPO + promote/rollback + Learn curriculum**

Do not start P9 until P8 beats prompt-only teacher on skip-F1 on held-out user data.

### Ops
- `MODEL_ARTIFACT_BUCKET` or `./artifacts` for dev
- Document VRAM for LoRA in README
- No secrets in artifact metadata

### Safety
- No training on data the user doesn’t own
- No fabricating fills
- Banner: paper ≠ future live
- Models cannot disable risk gates, raise caps, or enable live

### Acceptance criteria (Lab)
- Export dataset from journal/feedback with train/val/test counts
- Train baseline; open eval with skip-F1 vs teacher
- Shadow proposals on paper signals without submitting
- Promote only after gates + `PROMOTE MODEL`; rollback works
- Learn checklist advances after labeling + first eval review
- Active student still cannot bypass max daily loss

### Copy
- `Model Lab` · `Build dataset from journal` · `Train baseline student` · `Shadow (no capital)` · `Promote model` · `Rollback model`
- `Your model · your labels · your risk gates`

---

## CREDENTIALS

Human provides later: Alpaca paper (then live) keys, TradingView alert setup, LLM API key.  
**Never invent secrets. Read from env only.**

---

## FINAL INSTRUCTION TO THE BUILDER

Execute as a contract engineer, principal designer, and AI model-training master. Ship Phase 0→6 first (desk truth), then 7→10 (owned model). Prefer deleting chrome over adding widgets. When unsure, copy WeBuilt’s approval/receipt posture and apply it to orders. Charts are subordinate to triage, approvals, trainability, and truth in the journal.

You are not done when the pages render. You are done when Flow A works on paper, Train corrections stick, Analytics match the journal, the UI would not be mistaken for a generic AI crypto dashboard, and Model Lab can turn the user’s labels into a **baseline student** that earns promotion only through eval gates — the path to their own trading model.
