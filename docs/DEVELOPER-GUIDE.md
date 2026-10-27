# Developer guide

For whoever changes the code, on their own computer or with Claude Code.

## Run it on your computer

You need Node.js 22 or newer.

```bash
npm install
npm run dev      # http://localhost:3024 , editor page at /admin
npm test         # 27 tests on a real local Postgres; all should pass
```

`npm run dev` starts a local Postgres in `.data/` (git ignores it), applies every migration, and serves the site and API. The first-admin setup code locally is `local-admin`. Delete the `.data/` folder to start again with an empty database.

Keys go in a `.env` file (copy `.env.example`). Git ignores it, so never commit keys.

## How a change reaches the live site

1. Make the change on a branch, run `npm test`, and push the branch to GitHub. Pushing a branch does **not** publish.
2. Merge it into `main`. Netlify then builds, applies any new migrations, and publishes. (Netlify does not run the tests, so run `npm test` before merging.)
3. Each publish costs Netlify credits, so group changes together instead of publishing every small fix.

## Common jobs

### Add a new database table or column
Create a new file in `netlify/database/migrations/`, named with the date and time first, e.g. `20261103090000_add_badges.sql`. Write the SQL in it. **Never edit or delete a migration that has already reached the live site.** Netlify refuses, because live data depends on it.

### Add a new API route
Pick the file in `server/api/` for that area, or make a new one and add it to the list in `server/api/index.js`. A route looks like this:
```js
r.get('/api/badges', { role: 'learner' }, async ({ user }) => json(200, { badges: [] }));
```
`role` is who may call it: leave it out for everyone, or use `'learner'` (logged in), `'editor'` or `'admin'`. Add a test in `test/`.

### Add a new city (e.g. Shimla)
1. Add a migration that inserts the city and its sections (copy the Udaipur part of `20261027100100_import_udaipur_kolkata.sql`). Facts and quiz questions can then be added on the editor page.
2. Add its stamp and poster images to `server/public/assets/`, and its outline in the same migration (`UPDATE cities SET outline = '[[lng, lat], ...]'`, plus `outline_source` saying where the shape came from). The thread draws it at the end of the timeline.
3. The street drawing is code: add a gate in `server/public/js/scene.js` (`GATES`) and a pin in `setupStreet()` in `server/public/js/app.js`.

### Change colours or layout
`server/public/css/style.css` (website) and `server/public/css/admin.css` (editor page).

## Settings on Netlify (Project configuration → Environment variables)

| Name | What it is for |
|---|---|
| `ADMIN_SETUP_CODE` | code for claiming the first admin account |
| `GOOGLE_CLIENT_ID` | Google sign-in (optional) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | real SMS login codes (optional; without them, phone login runs in demo mode) |

Changes to these only take effect after the next publish.
