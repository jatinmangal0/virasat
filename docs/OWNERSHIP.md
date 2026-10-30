# Who owns what

Each part of Virasat has one owner who can explain it end to end, change it with confidence, and answer questions about it in the viva. **This split is a suggestion: agree it as a team, put your names in, and each owner should read, run and re-commit their part in their own words.**

| Part | Files | Owner | What to be able to explain |
|---|---|---|---|
| The street and Gaju | `server/public/js/scene.js`, `gaju.js`, `night.js`, the street parts of `app.js`, `sound.js` | _name_ | Layers at different depths, the camera that follows Gaju, his walk (parts rotated by CSS), night mode's mask |
| Arrival and the scroll | `server/public/js/hero.js`, `stamps.js`, the arrival and delivery parts of `city.js` | _name_ | The arch fly-through (a clip path grown frame by frame), the pigeon's flight, skip and the short repeat version |
| The letter, cards and quiz | the letter parts of `city.js`, `quiz.js`, `kit.js`, `server/api/content.js`, `progress.js` | _name_ | Marking on the server, first tries, the points ledger and why it cannot pay twice, the Project Kit |
| Timeline, map and places | the story parts of `city.js`, `places.js`, `twine.js`, `motifs.js`, `server/api/places.js` | _name_ (Aksh?) | The Verlet rope, the thread's shapes along the scroll, map projection, water from OpenStreetMap, clustering |
| Passport, recall and classes | `server/public/js/passport.js`, `classes.js`, `server/api/passport.js`, `classes.js` | _name_ | The Leitner boxes, the ink, the memory letter, class codes and the teacher's view |
| Accounts and security | `server/api/auth.js`, `session.js`, `server/lib/security.js`, `vercel.json` headers, `lib.js` | _name_ | Hashed passwords and sessions, why phone login is off on the live site, the security headers |
| The editor and four eyes | `server/api/admin.js`, `server/public/js/admin.js` | _name_ | Authors, version pinning, the letter draft, the To check inbox and its word diff |
| Database and deployment | `db/migrations/`, `scripts/`, `.github/workflows/`, `api/index.js` | _name_ | Migrations that only move forward, the city pages built at deploy, tests in CI, the nightly backup |
| Content and sources | the content in the editor, `docs/EDITOR-GUIDE.md` | everyone | How a fact gets checked, and the record and the memory |

## Before the viva

- Each owner runs the tests for their part (`npm test`) and walks through their part on the live site.
- Each owner can answer: what does it do, why this way, what would you change, and what breaks if this line is removed.
- See `docs/LANGUAGE-CHOICES.md` for the language ideas behind each part.
