# Virasat: handover guide

Welcome! This is everything you need to take over **Virasat**, a website that teaches the heritage of Udaipur and Kolkata. Visitors pick a city, Gaju the elephant walks them there, and a letter arrives with the city's stamp. They log in to break the seal, the city poster slides out, and they read about landmarks, festivals, food and fun facts, then take a quiz.

- **Live demo (current owner's copy):** https://virasat-uk9c.onrender.com. This will be switched off once yours is running, so don't share it.
- **What it's built with:** Node.js + Express on the server, SQLite for the database, and plain HTML/CSS/JavaScript in the browser. There is no build step and no framework to learn.
- **Paid services needed to start:** none. Everything below has a free option.

---

## Step 1. Get the code

You'll receive it in one of two ways:

**A. As a GitHub repository (recommended).** You'll get an email from GitHub saying the repository `virasat` is being transferred to you. Accept it within 24 hours. The full history comes with it, and it stays private.

**B. As a zip file (`virasat-project.zip`).** Unzip it, then put it on your own GitHub:
```bash
cd virasat
git init -b main
git add -A
git commit -m "Virasat: initial import"
gh repo create virasat --private --source . --push   # or create the repo on github.com and push to it
```

## Step 2. Run it on your own computer

You need **Node.js 20 or newer** (download from https://nodejs.org).

```bash
cd virasat/server
npm install
npm start        # open http://localhost:3024
npm test         # should print: pass 7, fail 0
```

Try it out: pick a city, log in with any phone number (the 6-digit code shows on screen in demo mode), and finish a quiz. Then open the passport icon in the top right to see your progress.

## Step 3. Put it online under your own account (free)

1. Sign up at https://render.com using **Sign in with GitHub**.
2. When Render asks for repository access, choose **Only select repositories** and pick `virasat`.
3. In Render, click **New + → Blueprint**, pick `virasat`, give it the name `virasat`, and click **Deploy Blueprint**. Leave the four key fields (Google, Twilio) empty for now.
4. After about 2 minutes you'll have a link like `https://virasat-xxxx.onrender.com`. That link is yours to share.

From then on, every `git push` to the `main` branch updates the live site automatically.

**About the free plan:**
- The site sleeps after 15 minutes with no visitors, and the next visit takes about a minute to wake it up.
- Saved accounts and quiz scores are **wiped whenever the site restarts**, because the free plan has no permanent disk. To keep them, see Step 5.

## Step 4. Turn on real logins

Email + password works immediately. The other two need accounts that only you can create.

| Login | What you set up | Where to put it |
|---|---|---|
| **Phone OTP (real SMS)** | A Twilio account and a sending number, at https://www.twilio.com. Each SMS costs a small amount. | Render → your service → **Environment**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` |
| **Google** | A free OAuth client ID from Google Cloud. The steps are in `README.md`. Under **Authorized JavaScript origins**, add your Render link and `http://localhost:3024`. | Render → **Environment**: `GOOGLE_CLIENT_ID` |

Render restarts the site by itself after you save environment variables.

> **Important:** until Twilio is set up, phone login runs in **demo mode**. The code is shown on screen, so anyone can log in as any phone number. That's fine for testing, but switch on Twilio before real users rely on it.

**Never put keys in the code or commit a `.env` file.** For local testing, copy `server/.env.example` to `server/.env`, which git already ignores, and start the server with `node --env-file=.env index.js`.

## Step 5. Keep accounts permanently (when you're ready)

Pick one:
- **Render disk (paid, about $7/month):** Render → your service → **Disks** → add a disk mounted at `/var/data`. Then under **Environment**, add `DB_FILE=/var/data/virasat.db`. No code changes needed.
- **A free hosted database (e.g. Supabase or Turso):** this needs a small code change in `server/lib/db.js` and in the queries in `server/app.js`.

## Step 6. Find your way around the code

| To change… | Edit |
|---|---|
| City facts, landmarks, food, fun facts, quiz questions | `server/public/js/content.js`. Plain text, no coding needed. |
| The street drawing (buildings, shop signs, vehicles) | `server/public/js/scene.js` |
| Gaju's walk, the envelope, checkpoint, login screens, quiz | `server/public/js/app.js` |
| Colours, fonts, layout | `server/public/css/style.css` (colours are at the top) |
| Login, OTP, sessions, saving progress (server) | `server/app.js`, `server/lib/` |
| Images (Gaju, stamps, posters) | `server/public/assets/` |
| Hosting settings | `render.yaml` |

**To add a third city:** add a new entry to `content.js` with the same shape as `udaipur`, then add its stamp and poster to `assets/`. Add its id to `CITIES` in `server/app.js`, and add a gate for it in `scene.js` (`GATES` and the buildings layer).

## Step 7. Good to know

- **Image rights:** the elephant artwork, both stamps and both posters were supplied by the previous owner and come from outside sources. The Udaipur stamp carries a "©PSHAIRS" mark. Check that you have permission before using the site publicly or commercially, or swap in your own images: just keep the same file names in `server/public/assets/`.
- **Facts:** the city content uses widely documented history, but have a teacher check it before students use it.
- **Security already built in:**
  - Passwords are hashed (scrypt).
  - Logins use secure, HttpOnly cookies.
  - OTPs expire after 5 minutes and lock after 5 wrong tries.
  - There are limits on how often people can request codes or try to log in.
- **Tests:** run `npm test` in `server/` before you push changes to the login code.

That's it. Have fun with Gaju! 🐘
