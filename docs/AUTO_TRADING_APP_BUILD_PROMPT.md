# Master Build Prompt — WeBuilt-style Auto Trading Desk

Copy everything below the line into Cursor (or another coding agent) as the product brief.

---

## Prompt

Build a full-stack **auto trading desk** product with UX patterned after **getwebuilt.com / Studly**: plain-language assistant, **approval-first** money actions, activity receipts with Undo where safe, and a complete audit trail — but for **options (calls/puts), equity longs, and shorts**, not contractors.

### Product name / positioning
- Working name: **TradeDesk** (rename later)
- One-line: “Your trading desk, handled. You approve; the system executes and logs everything.”
- Audience: a single trader (solo) first; team later optional
- Tone: calm, operational, receipt-driven — not crypto-casino, not purple-glow dashboard, not newspaper layout

### Non-negotiable product rules (WeBuilt DNA)
1. **Nothing that spends capital or opens/closes risk runs without explicit approval** unless the user has toggled a strategy into **Armed Auto** mode with hard risk limits.
2. Default mode is **Propose → Approve → Execute**.
3. Every action produces an **on-the-record receipt** (who/what/when/why/source/result).
4. Prefer **Undo / Cancel / Flatten** for reversible ops; never pretend irreversible broker fills are undoable.
5. Paper trading is the default environment until the user explicitly switches to live with a typed confirm.

### Core capabilities (v1)
1. **Connections**
   - Alpaca: API key/secret, paper vs live, account status, buying power, positions, option buying power / level.
   - TradingView: inbound webhook alerts (HMAC or shared secret), map alert JSON → order intent.
2. **Instruments / order types**
   - Equity buy / sell
   - Equity short / cover (respect Alpaca shortability & margin)
   - Options: buy-to-open / sell-to-close calls and puts (and sell-to-open / buy-to-close only if Alpaca account level allows — gate clearly)
   - Limit / market / stop / bracket where Alpaca supports them
3. **Strategies / automations**
   - Create a Strategy: name, symbols/universe, TradingView alert keys, size rules (% equity or fixed $), max daily loss, max open risk, max contracts/shares, allowed sides (long/short/calls/puts), schedule (market hours only by default)
   - Modes per strategy: `Off` | `Draft (propose only)` | `Armed Auto` (execute within limits)
   - Kill switch: global flatten / cancel-all / disarm-all
4. **Assistant (Studly-analogue)**
   - Chat/command bar: “What’s my P&L today?”, “Propose a 2-contract call on AAPL weekly ATM”, “Disarm all strategies”, “Show last 20 fills”
   - Answers from **this user’s records + Alpaca live state**, not generic advice
   - Money/risk actions always surface an **approval card** (symbol, side, qty, estimated cost, max loss if known, strategy source)
5. **Trade journal / audit log (mandatory)**
   Log every: signal received, proposal created, approval/rejection, order submitted, broker ack, fill, partial fill, cancel, reject, error, strategy arm/disarm, connection change, kill-switch use.
   Fields: `id, ts, actor (user|system|webhook), strategy_id?, signal_id?, intent, raw_payload, normalized_order, broker_order_id?, status, fills[], pnl_delta?, notes, ip/source`
   UI: filterable ledger + export CSV
6. **Dashboard surfaces (not a cluttered trading terminal)**
   - Needs attention (pending approvals, rejects, limit breaches)
   - Open risk (positions + options Greeks-lite if available; at least underlying, strike, expiry, qty, avg, mark, uPnL)
   - Today’s P&L + fill blotter
   - Strategies list with mode badges
   - Activity feed (receipts)

### Architecture
- **Frontend:** Next.js (App Router) + TypeScript + Tailwind. Expressive typography (not Inter/Roboto/system). Atmospheric background (subtle gradient/pattern), brand-first landing. Product app is calm and sparse — **no cards in the hero**; cards only for interactive approval/actions.
- **Backend:** Next.js route handlers or separate Nest/Fastify service — pick one and keep it simple.
- **DB:** Postgres (Prisma or Drizzle) for users, strategies, signals, orders, fills, audit_events, api_credentials (encrypted at rest).
- **Queue/worker:** process webhooks → normalize → risk check → propose or execute; never block webhook ACK longer than needed (store raw, respond 200, process async).
- **Secrets:** Alpaca keys and webhook secrets in env / secret manager; never log raw secrets.
- **Auth:** email magic link or Clerk/Auth.js; session required for approve/execute.

### TradingView → order flow
1. User creates alert on TradingView pointing to `POST /api/webhooks/tradingview/:strategyId`
2. Payload includes shared secret + fields like `{ action, symbol, side, qty?, option?: { type, strike, expiry }, orderType, limitPrice?, strategyKey }`
3. Server verifies secret, stores raw signal, normalizes to OrderIntent
4. Risk engine validates limits
5. If strategy `Draft` → create ApprovalRequest; notify UI
6. If `Armed Auto` and all checks pass → submit to Alpaca; else create ApprovalRequest or Reject with reason
7. Poll/websocket Alpaca order updates → update fills + ledger

### Alpaca integration requirements
- Use official Alpaca API (paper + live base URLs)
- Idempotent client order IDs for every submit
- Reconcile positions/orders on startup and periodically
- Surface broker rejects clearly in Needs Attention
- Hard-block live trading until paper path is proven in tests

### Risk engine (v1 hard gates)
- Max notional per order
- Max contracts / shares per order
- Max open positions / open option contracts
- Max daily realized+unrealized loss → auto-disarm
- Market hours gate (configurable)
- Duplicate signal suppression (same alert fingerprint within N seconds)
- No naked short options unless explicitly enabled AND account approved (default OFF)

### Landing page (getwebuilt-inspired structure)
- Hero: brand + one headline + one supporting sentence + CTA (Start paper desk) + full-bleed atmospheric visual (desk/markets mood — not inset card collage)
- Section: “What the desk does” (signals → approve → execute → log)
- Section: “You stay in charge” (approval cards + receipts)
- Section: activity/approval samples with fictional data labeled Sample
- Straight answers FAQ
- No pricing required for v1 unless asked

### Out of scope for v1
- Multi-broker
- Social copy-trading
- Mobile native apps
- Tax lots / Form 8949 perfection
- Complex multi-leg option spreads (single-leg only in v1)
- Investment advice / “AI picks”

### Compliance / copy
- Product is execution + journaling software, **not** financial advice
- Show paper vs live badge everywhere
- Require acknowledgment of risk before enabling Armed Auto or Live

### Deliverables expected from the coding agent
1. Repo scaffold with README (setup Alpaca paper keys, TradingView webhook URL, migrate DB, run)
2. Working paper-trading path: webhook → proposal → approve → Alpaca paper order → fill logged
3. Strategy arm/disarm + kill switch
4. Full audit/trade log UI + CSV export
5. Seed fictional sample receipts for empty states
6. Minimal test suite: risk gates, webhook auth, order normalization, idempotency
7. `.env.example` with all required vars

### Acceptance criteria
- I can create a strategy, paste a TradingView webhook URL, fire a test alert, see a pending approval, approve it, see a paper fill on Alpaca, and see every step in the trade log.
- Kill switch disarms strategies and can cancel open orders.
- Live mode cannot be enabled accidentally; requires explicit confirm.
- No trade exists without a ledger row.

### Credentials (provided by human later)
- TradingView (alert webhook will be configured by user)
- Alpaca API key + secret (start with **paper**)
- Do not invent keys; read from env.

Build it end-to-end, commit in small logical steps, and keep the UI opinionated and sparse like WeBuilt — approval cards and receipts first, charts second.
