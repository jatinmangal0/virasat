# How Virasat works

This is the explanation to give your professor and teammates. You don't need to know how to code to follow it.

## The big picture

Virasat has three parts, like most real websites:

```
  Visitor's phone or laptop                Vercel + Neon (hosting)
 ┌──────────────────────────┐      ┌─────────────────────────────────────────┐
 │ 1. FRONTEND              │      │ 2. BACKEND (API)        3. DATABASE      │
 │ The website people see:  │ ───► │ The rules. Answers      Postgres. Holds  │
 │ the street, Gaju, the    │ /api │ requests like "give me  every city,      │
 │ letters, the quiz.       │ ◄─── │ Udaipur" or "save this  fact, question,  │
 │ server/public/           │ JSON │ score". server/api/ ──► account, score   │
 │                          │      │                         and change.      │
 │ Editor page: /admin      │      │                                          │
 └──────────────────────────┘      └─────────────────────────────────────────┘
```

1. **Frontend:** the pages and pictures that run in the visitor's browser. It holds **no facts of its own**. When it opens, it asks the backend for the cities and shows whatever comes back.
2. **Backend (the API):** a small program on Vercel's servers. It's the only part allowed to read or change the database, so it is where the rules live: who may edit, what counts as verified, how many points a quiz is worth.
3. **Database:** a Postgres database on Neon. Everything that changes lives here: content, accounts, progress and history.

A browser never talks to the database directly. It always goes through the API, and the API checks every request. That's the main reason real sites are built this way.

## What happens when someone opens Udaipur

1. The browser loads the website files from Vercel.
2. It asks the API: `GET /api/cities`.
3. The API asks the database for published cities and **only verified** facts and quiz questions, then sends them back as JSON (structured text).
4. The browser draws the letter from that data.
5. When the learner reads a section, the browser tells the API (`POST /api/progress/section`). The API records it and adds 5 points, but only the first time.

## What's in the database

Each box is a table, like a sheet in Excel. The arrows show which table points to which.

```
 users ──< sessions            (who is logged in)
   │
   ├──< visits                 (cities opened)
   ├──< covered_sections       (letter parts read)
   ├──< quiz_results           (every quiz attempt)
   ├──< points_ledger          (every point earned, like a bank statement)
   ├──< stamps                 (the Fading Passport: one stamp per city, and when it next fades)
   └──< content_log            (every change an editor made)

 cities ──< sections ──< facts (the fact cards)
   ├──────< quiz_questions
   └──────< timeline_events    (the city's history, along the thread)

 greetings                     (Namaste, Vanakkam... in the top bar)
```

| Table | One row is… | Important columns |
|---|---|---|
| `users` | a person | name, email or phone, password (scrambled, never readable), **role**: learner / editor / admin |
| `cities` | a city | name, letter text, quick facts, stamp and poster images, **outline** (the city's boundary, drawn as a map), published yes/no |
| `sections` | a tab in a letter | Landmarks, Festivals & Arts, Food, Fun Facts |
| `facts` | a fact card | title, text, **source link**, **status**: needs_check / verified, who wrote it, who verified it |
| `timeline_events` | an event in a city's history | year, title, short paragraph, photo links, source, status |
| `greetings` | a greeting in the top bar | the word, its own script, language, source, status |
| `quiz_questions` | a question | options, right answer (never sent to the browser early), source, status |
| `heritage_places` | a heritage place from Aksh's research | name, description, **map position** (latitude, longitude), source, status, plus Aksh's other research columns |
| `points_ledger` | one award of points | how many, why, for what. A learner's total is the sum. |
| `stamps` | a city stamp in a learner's passport | **box** (1 to 4) and **due_at**: when it starts to fade and Gaju sends a three-question memory letter. Passing moves it up a box (2, 7, then 21 days); failing sends it back to box 1; box 4 is kept for good. |
| `content_log` | one change | who, when, what, and the full before and after |

## The rules (all enforced by the backend)

- **Verified only.** The website only ever receives facts, quiz questions, timeline events and greetings with status `verified`.
- **Four eyes.** The person who made the latest change to an item cannot verify it. Someone else has to check the source.
- **A source is required.** Nothing can be verified without a source link.
- **Change means re-check.** If the words of a live item change, it goes back to "needs check" and disappears from the website until someone verifies it again.
- **Nothing is lost.** Every change is stored in `content_log` with the before and after.
- **Stamps fade on a schedule.** Sealing a letter (3 in 5 or better) presses the city's stamp. The rules for fading and re-inking are three small functions in `server/api/passport.js`, the Leitner system for spaced practice.
- **Points can't be faked.** The browser never says "I scored 5". It sends the chosen answers, and the backend marks them. Each award has a unique label (for example "first visit to Udaipur"), so it can only be paid once.
- **Roles.** Learners use the site. Editors write and verify content. Admins also manage roles and can hide a city.

## Security basics

- Passwords are stored scrambled (scrypt), never as plain text.
- Logins use a secure cookie the page's own scripts cannot read (HttpOnly).
- Login codes expire after 5 minutes and lock after 5 wrong tries. Too many attempts are slowed down.
- The first admin needs a secret setup code kept in Vercel's settings, and it stops working once an admin exists.

## How the database grows safely: migrations

The database's structure (its tables and columns) is never changed by hand. Each change is a numbered file in `db/migrations/`:

| File | What it did |
|---|---|
| `20261026120000_create_virasat_tables.sql` | accounts, sessions, login codes, visits, quiz results |
| `20261027100000_content_roles_points.sql` | content tables, roles, points, change log |
| `20261027100100_import_udaipur_kolkata.sql` | moved the old Udaipur and Kolkata content in, as "needs check" |
| `20261027110000_heritage_places.sql` | added Aksh's 325 heritage places (20 Udaipur, 305 Kolkata), as "needs check" |
| `20261027110100_verify_aksh_places.sql` | made Aksh's places live: a teammate had already checked them |
| `20261027120000_timeline_greetings_outline.sql` | timeline events, greetings, and each city's outline; starting events and greetings arrive as "needs check" |
| `20261027130000_timeline_motifs.sql` | a drawing name (`motif`) for each timeline event, shown when it has no photos |
| `20261030120000_content_fixes.sql` | corrections from the fact check (Udaipur founded 1553, and others); places with no source sent back to "needs check" |
| `20261030130000_passport_record_memory.sql` | the `stamps` table (Fading Passport), and the record-and-memory fields on timeline events |

On every publish to the live site, Vercel runs `scripts/migrate.js`, which runs any new files in order and records which ones have run. To add a feature (badges, a new city, comments), you **add a new file**. You never edit an old one. This is how real teams change a live database without losing anyone's data.

## Where the code lives

| Folder / file | Part | What it is |
|---|---|---|
| `server/public/` | frontend | the website: `index.html`; `js/app.js` (start-up, the street, logging in), `js/scene.js` (the street, drawn in code; Gaju is `assets/gaju.webp`), `js/city.js` (the arrival through the arch, the scroll, the timeline), `js/quiz.js` (Seal the letter), `js/places.js` (the map's places), `js/passport.js` (passport and memory letters), `js/classes.js`, `js/kit.js` (Project Kit), `js/stamps.js` and `js/hero.js` (stamps and arrival scenes), `js/lib.js` (shared helpers), `css/`, `assets/` |
| `server/public/admin.html`, `js/admin.js` | frontend | the editor page |
| `server/api/` | backend | the rules: `auth.js` (log in), `content.js` (what visitors see), `progress.js` (points), `admin.js` (editing) |
| `api/index.js` | backend | connects Vercel to `server/api/` |
| `db/migrations/` | database | the history of the database's structure |
| `test/` | checks | 33 automatic tests of the rules, run on a real Postgres |
| `server/dev.js` | tools | runs everything on your own computer |
| `vercel.json` | hosting | tells Vercel where the website and backend are |

## Hosting and cost

- **Vercel** (free Hobby plan) hosts the website and the API. Every merge into `main` on GitHub publishes a new version within a minute or two, and every pull request gets its own preview link. Publishing does not cost anything.
- **Neon** (free plan, 0.5 GB) hosts the database. It sleeps when nobody visits, so the first request after a quiet spell takes a second or two longer.
- The site used to be on Netlify. It moved in October 2026 because Netlify's free credits ran out, which paused every publish until the next month.
- GitHub (`jatinmangal0/virasat`) keeps every version of the code, so any change can be undone.
