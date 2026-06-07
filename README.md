# Voice Poker

Voice-controlled Texas Hold'em. You play one seat at a 4-player table against
three LLM bots. A visual poker table runs in the browser; you control your seat
by **calling a phone number** and talking to an AI agent that can read the hand,
give you live strategy advice, and make your move once you confirm.

## Live

- **Play (web table):** https://f5yqxhuy.insforge.site
- **Call to play your seat:** **+1 (657) 837-9072**
- **Backend API:** https://voice-poker-012c477d-cb51-431e-b0c5-aafac6e47303.fly.dev

Open the web table, click **New hand**, then call the number. Ask "what are my
cards?", "what should I do?", or say "raise to 200" — the agent reads the move
back and confirms before acting. Buttons on the table are a backup control path.

## How it fits together

| Piece | Tech | Role |
|-------|------|------|
| Game engine | Python (`backend/engine.py`) | Full Hold'em: shuffle, blinds, streets, betting, showdown, hand eval. Turn gate freezes on your turn. |
| State store | InsForge Postgres (`backend/store.py`) | The whole hand is one JSON row — shared across web, phone, and bot turns; survives restarts. |
| Bots | OpenAI `gpt-4.1-nano` (`backend/bots.py`) | Each bot decides a legal move; safe check/call fallback on any error. |
| Advice | MOSS retrieval (`backend/advice.py`, `strategy_corpus.py`) | Strategy corpus indexed in MOSS; queried live (<10ms) by the spot, not card names. |
| Voice tools | Flask `/vapi` webhook (`backend/voice.py`) | `get_state`, `get_advice`, `submit_action` — one webhook, Vapi-compatible. |
| Phone agent | Vapi (`backend/vapi_setup.py`) | gpt-4o assistant; system prompt enforces read-back confirmation before any action. |
| Web table | Next.js + Tailwind (`frontend/`) | Polls state, renders the table, Fold/Check-Call/Raise/All-in buttons. |
| Hosting | Fly.io (backend, via InsForge) + Vercel (frontend, via InsForge) | |

**Design note:** live game state is a struct lookup (read directly), while poker
*strategy* is the big fuzzy knowledge base — so that part lives in MOSS. Right
tool for each job.

## Run locally

Secrets live in `env_script.sh` (gitignored). Then:

```bash
# backend
source env_script.sh
cd backend && PORT=5050 python3 app.py        # http://localhost:5050

# frontend (another terminal)
cd frontend && npm install && npm run dev      # http://localhost:3000
```

The frontend talks to `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:5050`).

## Redeploy / re-provision

```bash
source env_script.sh

# backend -> Fly.io (uses root Dockerfile)
export PATH="$HOME/.fly/bin:$PATH"
npx @insforge/cli compute deploy . --name voice-poker --port 8080 --env-file .env.deploy

# frontend -> Vercel
npx @insforge/cli deployments deploy frontend \
  --env '{"NEXT_PUBLIC_API_URL":"https://voice-poker-012c477d-cb51-431e-b0c5-aafac6e47303.fly.dev"}'

# (re)build the MOSS strategy index
cd backend && python3 seed_moss.py

# (re)create the Vapi assistant + phone number
cd backend && BACKEND_URL=<backend-url> python3 vapi_setup.py
```

## Notes

- All credentials are in `env_script.sh` and `.env.deploy` — both gitignored.
  Rotate keys that were shared in chat after the event.
- One hand at a time, fixed blinds (10/20), 1000-chip stacks, human is the dealer.
- Side pots are simplified (whole pot to the best non-folded hand).
