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

## Putting it online (Render)
1. Sign in at https://render.com with GitHub.
2. Click **New → Blueprint**, pick the `virasat` repo, and click **Apply**. Render reads `render.yaml`, installs everything and starts the site at `https://virasat-xxxx.onrender.com`.
3. Every push to `main` redeploys the site automatically.

On the free plan the site sleeps after 15 minutes without visitors, so the first visit after that takes about a minute to wake up. The free plan also has no permanent disk, so saved accounts and scores reset whenever the site restarts or redeploys. To keep them, add a Render disk mounted at `/var/data` and set `DB_FILE=/var/data/virasat.db` (paid), or move the database to a free hosted one.

## Files
- `server/app.js`: the API (auth, sessions, OTP, Google check, progress) plus static files
- `server/public/js/scene.js`: the street, drawn as layered SVG
- `server/public/js/app.js`: the camera, Gaju's walk, the envelope and checkpoint, login, the letter and the quiz
- `server/public/js/content.js`: all city facts and quiz questions (edit here to add more)
- `server/public/assets/`: Gaju (cut out from the supplied elephant art), both stamps and both posters
