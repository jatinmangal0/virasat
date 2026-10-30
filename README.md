# Virasat

A playful heritage site for learning about Indian cities, starting with **Udaipur** and **Kolkata**. Visitors pick a city, and Gaju the elephant walks them there. A pigeon flies in with a sealed scroll; they log in to break the seal, read the city's letter, then follow the scroll's twine down through a timeline of the city's history until it draws the outline of the city. Points are collected in their Virasat passport.

**Live site:** https://virasat-psi.vercel.app · **Editor page:** https://virasat-psi.vercel.app/admin

## How it is built

A frontend (the website), a backend API (the rules) and a Postgres database (all the content, accounts and points), with the site on Vercel and the database on Neon (both free plans). Facts only appear on the site after a second teammate has checked the source and verified them.

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the whole thing works, in plain words. Start here, and use it to explain the project.
- [docs/EDITOR-GUIDE.md](docs/EDITOR-GUIDE.md): for teammates adding and checking facts. No coding needed.
- [docs/DEVELOPER-GUIDE.md](docs/DEVELOPER-GUIDE.md): running it locally, adding tables, routes and cities.
- [docs/LANGUAGE-CHOICES.md](docs/LANGUAGE-CHOICES.md): the programming-language ideas behind the code, for the viva.
- [docs/OWNERSHIP.md](docs/OWNERSHIP.md): who owns and explains each part.

## Quick start (developers)

```bash
npm install
npm run dev     # http://localhost:3024
npm test
```

## Good to know

- **Images:** the city stamps and the arrival scenes are drawn in code (`server/public/js/stamps.js`, `hero.js`), so they carry no outside artwork. The old stamp and poster images (sources unknown, one marked "©PSHAIRS") are removed. Gaju (`assets/elephant.png`) still comes from an outside source: replace him or get permission before promoting the site.
- **Phone login** is switched off on the live site until Twilio keys are added on Vercel. On preview links and your own computer it runs in demo mode (the code is shown on screen).
