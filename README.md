# ✨ Luminous — deployable build

Instagram-style social app: feed with posts, 24-hour Stories, "Lums" short videos,
livestreaming with a coin economy, 5 AI mentors, customizable AI companions,
leveling + milestones, creator earnings, and light/dark mode.

**One Docker container** serves the API and the frontend. SQLite keeps everything
in a single file — no database service to pay for.

## Quick start (local)

```bash
npm install
cp .env.example .env   # optional; app runs fine without it
node server.js         # → http://localhost:3000
```

Without `OPENAI_API_KEY`, AI mentors/companions show a clear
"AI not configured" notice; everything else works.

## Deploy to Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint** → connect the repo (uses `render.yaml`).
   - Creates one **Starter** Docker web service named `luminous`.
   - Attaches a 1 GB persistent disk at `/app/data` (SQLite DB + uploads survive restarts).
3. In the Render dashboard, set the `OPENAI_API_KEY` environment variable
   (leave empty for no-AI mode).
4. Deploy. Health check: `GET /api/config` → `{ "aiConfigured": true/false }`.

**Cost:** Render Starter web service (~$7/mo) + disk (~$0.25/GB/mo). No other services needed.

## Deploy with plain Docker

```bash
docker build -t luminous .
docker run -d -p 3000:3000 \
  -e OPENAI_API_KEY="sk-..." \
  -v luminous-data:/app/data \
  --name luminous luminous
```

## Features

- **Feed** — text/photo posts; sponsored in-feed ads styled as posts
- **Stories** — 24h expiry, tap-to-advance viewer, replies
- **Lums** — vertical short-video feed with auto-play + view counts
- **AI mentors (5)** — fitness, social growth, mental-health venting (non-judgmental),
  healthy eating, business/budgeting — real AI replies via OpenAI
- **AI companions** — up to 5 per user (name, emoji, color, age 18–99, gender,
  4 traits, 5 interests, job/vibe, backstory), in-character chat;
  first companion unlocks the **Kindred Spirit** milestone
- **Leveling** — XP for posting, stories, Lums, streams, chats; 11 unlockable milestones
- **Livestreaming** — 10 taps = 5 coins, share +10, watch +2/min, coin gifts,
  free gifts (20s cooldown), host withdrawal at 1,000 coins
- **Wallet** — coin balance + ad-revenue earnings (55% share, $3.30 / 1,000 real views)
  for Approved Business/Creator accounts; $10 payout threshold (ledger only,
  no real payment processing yet)
- **Profiles** — custom color, bio, hobbies, public age, active/offline/away status,
  grid/list layout; 6 seeded 🤖 AI demo accounts (their views never count toward earnings)
- **Light/dark mode**, violet→magenta gradient, frosted glass, floating nav

## API overview

| Method | Path | Notes |
|---|---|---|
| POST | /api/auth/register · /api/auth/login | Bearer-token sessions |
| GET | /api/feed | posts + injected ads |
| POST | /api/posts · /api/stories · /api/lums | multipart uploads |
| POST | /api/posts/:id/view | view counting (AI views excluded from earnings) |
| GET/POST | /api/mentors · /api/mentors/:key/chat | AI mentor chat |
| GET/POST/DELETE | /api/companions · /api/companions/:id/chat | AI companion chat |
| POST | /api/live/start · /api/live/:id/{tap,share,watch,gift,free-gift,withdraw,end} | coin economy |
| GET/POST | /api/wallet · /api/wallet/payout | balances, $10 threshold |
| GET/PATCH | /api/users/:username · /api/profile | profiles + customization |

## Notes / simplifications

- Identity verification for the Approved badge is self-serve in this build
  (production would use manual/KYC review).
- Payouts are ledger entries marked `pending` — no real money movement.
- Livestreams are interactive coin/chat rooms; real video ingest (RTMP/WebRTC)
  is not included.
- Uploads are stored on the persistent disk (`/app/data/uploads`).
