# Language choices

Why Virasat is built the way it is, and where to see each idea in the code. Written for the Introduction to Programming Languages viva: each section is a choice, the reason, and a place to point at.

## One language, three places, no build step

The website, the API and the scripts are all JavaScript (ES modules), run by the browser and by Node 22. There is no bundler, no framework and no compile step: the files in `server/public/js/` are exactly what the browser runs.

- **Why:** one language means every teammate can read every part. With no build step, what you read is what runs, which makes bugs easier to trace and the code easier to explain.
- **The cost:** no type checker. We guard the edges by hand instead (see *Types at the boundary*).
- **Where:** `import`/`export` everywhere; `<script type="module" src="js/app.js">` in `index.html`; `"type": "module"` in `package.json`.

## A small language for routes

The API does not use a web framework. `server/api/router.js` is about 30 lines. It turns patterns like `/api/cities/:id` into regular expressions and keeps a list of routes. Each route says who may call it:

```js
r.get('/api/passport', { role: 'learner' }, async ({ user }) => ...);
```

- **Why:** it reads like a table of the API's rules, and the role check happens in one place (`server/api/index.js`), so no route can forget it.
- **Idea:** an internal domain-specific language built from plain functions and objects.

## Data-driven code: one set of routes for five kinds of content

`server/api/admin.js` describes each kind of content (fact, quiz question, timeline event, greeting, place) as an object: its table, how to read a form, which columns count as wording. A single loop builds the create, edit, verify, unverify and delete routes for all five.

- **Why:** the four-eyes rule is written once, so it is the same for every kind of content. Adding a kind is adding an object, not copying routes.
- **Idea:** higher-order, table-driven design. The `kinds` object is data that the code interprets.

## Functions passed in, not reached for

`createApi({ db, sms, verifyGoogle, ... })` receives the database, the SMS sender and the Google check as arguments. The live site passes real ones (`api/index.js`); the tests pass fakes (`test/helpers.js`), so the tests never send a text message or call Google.

- **Why:** testable code, and the live-site rules (for example `allowDemoSms: false`) are visible in one call.
- **Idea:** dependency injection with closures. Each area's routes close over the `db` they were given.

## SQL for data, JavaScript for behaviour

The data's shape lives in SQL migrations (`db/migrations/`), numbered by date and never edited once live. Queries are written in SQL with `$1` placeholders, never by gluing strings.

- **Why:** SQL is declarative: we say what we want (`SELECT … WHERE status = 'verified'`), and Postgres works out how. Placeholders make SQL injection impossible.
- **Idempotency in the database:** points are rows in `points_ledger` with `UNIQUE (user_id, reason, ref)`, and awards use `ON CONFLICT DO NOTHING`. Paying twice is impossible because the database refuses it, not because the code remembered to check.

## Pure functions for the rules that matter

The Fading Passport's whole rule is three small functions in `server/api/passport.js`:

```js
export const nextBox = (box, passed) => (passed ? Math.min(box + 1, KEPT) : 1);
export const dueAfter = (box, now) => (box >= KEPT ? null : new Date(now.getTime() + BOX_DAYS[box] * DAY));
export function inkOf(dueAt, now) { ... }
```

They take values and return values, with no database and no clock of their own (`now` is passed in). `test/passport.test.js` tests them directly with fixed dates. `scripts/build-pages.js` does the same for page building: `cityPage(template, city)` is pure, and the database is only touched in the script's main block.

- **Idea:** keep side effects at the edges, logic in the middle.

## Asynchronous code and cancellation

The arrival animation is a chain of `await`s: walk, push in, open the arch, fly the pigeon, break the seal. If you press Back halfway, the rest must stop. JavaScript promises cannot be cancelled, so each run takes a number:

```js
const my = ++state.seq;          // app.js, goToCity
await walkTo(GATES[city]);
if (my !== state.seq) return;    // someone started something newer: stop
```

- **Idea:** a cancellation token by generation counter. `settle()` in `city.js` also races each animation against a timer, because animation promises can stall in a background tab.

## Types at the boundary

Everything that arrives from a browser is checked and converted before use: `Number(body.id)` with `Number.isInteger`, `text(v, max)` for strings with a length limit, and `isUrl` for links. Inside, the code can trust its values.

- **Where:** `text()` and `isUrl()` at the top of `server/api/admin.js`; the quiz routes in `content.js` and `progress.js`.
- **What a typed language would add:** these checks would be types, checked before running. Adding `// @ts-check` and JSDoc comments to `server/api/` would give much of that without a build step.

## Event-driven interface, drawn from data

The page is not a framework app. It reacts to events (clicks, scrolling, `popstate` for the back button, `IntersectionObserver` for "this section was read") and redraws from data with template strings. Every piece of text from the database goes through `esc()` before it becomes HTML, which is what stops cross-site scripting.

## Drawing with code

The street, the stamps (`stamps.js`), the arrival scenes (`hero.js`) and the timeline drawings (`motifs.js`) are SVG built by functions. A pointed arch, for example, is one function of `x, y, w, h`, used for windows, gates and the arch you fly through. The thread is a Verlet rope (`twine.js`): points with positions and previous positions, moved by gravity and pulled back to fixed lengths a few times per frame, then drawn as a smooth curve.

- **Why:** drawings that are code can be changed, reused and animated, and carry no outside copyright.
