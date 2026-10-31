# Luminous rebuild foundation

This is a fresh, separate application. It does not touch the existing live app or database.

## Included
- Mobile-responsive Luminous UI, violet/magenta branding, dark/light themes.
- PostgreSQL schema for accounts, follows, posts, Lums, Stories, wallet ledger, XP, missions, milestones, relationships, AI companions and chat history.
- Registration/login using bcrypt and JWT.
- Lumicoin balance derived from an append-only transaction ledger (100 LC = $5 CAD reference value).
- Google Gemini streaming endpoint, five built-in mentors and a five-companion-per-user limit.
- Home/feed, wallet, missions and AI mentor/companion starter screens.

## Run
1. Use Node.js 20+ and PostgreSQL; create a database.
2. Copy `.env.example` to `.env`; set `DATABASE_URL`, a random `JWT_SECRET` of 32+ characters, and `GOOGLE_AI_API_KEY`.
3. Run `npm install`, then `npm start`; open http://localhost:3000.

## Existing accounts and migration
No migration has been performed. The only known real users are the owner and Mister Sloth, but their original database records, IDs, password hashes, balances and media have not been accessed. Keep the old production database intact. Before switching over, export and back it up, identify those two accounts by stable IDs, import compatible password hashes (or issue password resets), migrate wallet transactions and reconcile balances. Do not invent opening balances or credentials.

## Before public launch
This is a working foundation, not a production-certified complete social network. Add email verification/password reset, rate limiting, moderation/report/block tools, media storage/CDN, realtime chat and livestream infrastructure, backups, monitoring, accessibility and a security/privacy review. Cash redemption or wagering of Lumicoins requires separate legal and regulatory review.
