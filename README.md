# Virasat

A playful heritage site for learning about **Udaipur** and **Kolkata**.

The home page is an illustrated Indian street drawn in 3D layers, so it tilts with your mouse or phone. Pick a city and Gaju the elephant walks to its gate. The camera then moves into the gate and a letter arrives with that city's stamp. The stamp gets postmarked and the envelope flips over. At that point there is a **log-in checkpoint**: the wax seal stays locked until you sign in. After that the flap opens, the city poster slides out of the envelope and settles at the top of the page, and the letter unfolds below it. The letter covers landmarks, festivals and arts, food, fun facts and a quiz.

## Run it

```bash
cd server
npm install
npm start          # http://localhost:3024
npm test           # 7 API tests: email, phone OTP, Google, progress
```

All data is saved in SQLite at `server/data/virasat.db`. That covers users, login sessions, OTPs, the cities each person has opened, and their quiz scores.

## Sign-in methods

| Method | Works out of the box? | To make it real |
|---|---|---|
| Email + password | Yes | Nothing needed. Passwords are hashed with scrypt. |
| Phone + OTP | Yes, in **demo mode**: the code appears on screen as an SMS-style card | Set the three `TWILIO_*` variables and real texts are sent |
| Google | No. The button explains that it isn't switched on yet | Set `GOOGLE_CLIENT_ID` |

Copy `server/.env.example` to `server/.env`, fill it in, and start the server with `node --env-file=.env index.js`.

### Google client ID (free, about 5 minutes)
1. Go to https://console.cloud.google.com, create a project, then open **APIs & Services → OAuth consent screen** and set it up as *External*.
2. Go to **Credentials → Create credentials → OAuth client ID**, with application type **Web application**.
3. Under **Authorized JavaScript origins**, add `http://localhost:3024` and your live domain.
4. Paste the client ID into `GOOGLE_CLIENT_ID`. The server checks every Google token against this ID.

### Real SMS
Create a Twilio account, buy or verify a sending number, and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. Each OTP text costs a small amount. Codes expire after 5 minutes. A new code can be requested every 30 seconds, with at most 5 per number per hour. A code locks after 5 wrong tries.

## Putting it online (Netlify)
The live site is **https://virasat-gaju.netlify.app** (Netlify project `virasat-gaju`). Netlify builds it from this GitHub repo:
- `netlify.toml` publishes `server/public` and runs the API from `netlify/functions/api.mjs` at `/api/*`. That file uses the same routes as the local server (`server/core.js`).
- Accounts and quiz scores live in **Netlify Database** (Postgres), so they survive restarts. The tables are created by `netlify/database/migrations/`, which Netlify applies on every deploy. Never edit a migration that has already run; add a new one.
- Every push to `main` redeploys the site.
- Keys (`GOOGLE_CLIENT_ID`, `TWILIO_*`) go in Netlify under **Project configuration → Environment variables**, never in the code.

Tests: `npm test` in `server/` (SQLite), and `npm install` then `npm run test:pg` at the root (the same tests on a local Postgres).

`render.yaml` is still here if you ever want Render instead. That version uses SQLite and loses accounts on every restart.

## Files
- `server/core.js`: the API (auth, sessions, OTP, Google check, progress), with no web framework
- `server/app.js`: runs `core.js` under Express with SQLite for local use, plus the static files
- `server/lib/store-sqlite.js`, `server/lib/store-pg.js`: the two storage backends
- `netlify/functions/api.mjs`: runs `core.js` on Netlify with Postgres
- `server/public/js/scene.js`: the street, drawn as layered SVG
- `server/public/js/app.js`: the camera, Gaju's walk, the envelope and checkpoint, login, the letter and the quiz
- `server/public/js/content.js`: all city facts and quiz questions (edit here to add more). Every card has a `src` link and each city a `sources` list, shown on the site; add one for any new fact
- `server/public/assets/`: Gaju (cut out from the supplied elephant art), both stamps and both posters
