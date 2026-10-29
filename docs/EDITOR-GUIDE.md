# Editor guide (no coding needed)

The editor page is at **https://virasat-psi.vercel.app/admin**.

## Getting access

1. Sign up on the website with your email and a password.
2. Tell the admin (Jatin) which email you used. They make you an **editor** on the Team tab.
3. Open `/admin` and log in.

## The golden rule

> Nothing appears on the website until **someone other than the last person who changed it** has opened the source link and pressed **Verify**.

| Colour / label | Meaning |
|---|---|
| 🟨 **Needs check** | Hidden from the website. Waiting for a teammate. |
| 🟩 **Live** | On the website now. |

## Checking a fact (the most common job)

1. Pick a city at the top, then the **Facts** tab. The **Needs check** filter is on by default.
2. For each fact, open the source link and read it.
3. Ask yourself: does the source really say this? Are the dates, names and numbers the same?
4. If yes, press **I checked the source · Verify**. The fact goes live straight away.
5. If something is wrong, press **Edit** and fix it. Since you've now changed it, a different teammate has to verify it.
6. If there's no good source, leave the fact as it is, or delete it.

The **Verify** button is greyed out on anything you changed last. That's on purpose.

## Adding a fact

1. **Facts** tab → **+ Add a fact**.
2. Choose the section, write a short title and one or two sentences, and paste the link where you found it.
3. Save. It starts as **Needs check**. Ask a teammate to verify it.

Good sources: official sites (UNESCO, government, museums), encyclopaedias (Britannica), well-known newspapers. Be careful with travel blogs and fan sites.

## Places

**Places** tab. Aksh's list of heritage places (buildings, lakes, crafts, food spots), each with a position on the map. Use the search box to find one. Aksh's places were checked by a teammate before they were imported, so they are already **Live**. If you change one (a better source, a fixed map position), it goes back to **Needs check** and a different teammate verifies it, as with facts. "Aksh's notes" says how sure the original research was. Live places appear as marigolds on the city's map at the end of the timeline, and tapping one opens a card with its photo (if it has one), description and source.

## Quiz questions

**Quiz** tab. Write the question, put each option on its own line, choose which line is the right answer, and add the source. The same check-and-verify rule applies.

## Timeline events

**Timeline** tab. Each event has a year (written the way it should appear, like `1559` or `1620s`), a title, a short paragraph of two or three sentences, and a source. **Place on the timeline** decides the order: smallest number first. Changing only the place does not need a new check.

Photos are optional: up to 4, one per line, as `https://link-to-photo | caption`. Only use photos you are allowed to share (Wikimedia Commons is a good place to look) and put the credit in the caption. Without photos, the city's stamp is shown next to the event.

Events follow the same check-and-verify rule as facts. The starting events for Udaipur and Kolkata arrive as **Needs check**, so the timeline stays empty on the website until someone verifies them.

## Greetings

**Greetings** tab. These scroll in the yellow bar at the top of the website, for every city. Each one has the greeting in English letters, the same greeting in its own script, the language, and a source. Same check-and-verify rule. Until at least one greeting is verified, the bar shows the site's old lines. A few starting greetings have no source yet; add one before verifying.

## The city letter

The **City letter** tab changes the opening of a city's letter: the greeting, paragraphs and quick facts. Saving makes a draft; a different teammate checks it against its sources and verifies it, and only then does it go live. Every save is recorded in History.

## History

The **History** tab lists every change: who, what and when. Nothing is ever truly lost. The database keeps the full before and after of each change.

## For admins

- **Team** tab: find a person and change their role to `editor`, or back to `learner`.
- **City letter** tab: untick "Show this city on the website" to hide a whole city.
- There must always be at least one admin.

## The record and the memory (timeline events)

Some events are told one way by the sources and remembered another way: Haldighati, Job Charnock, the year Udaipur was founded. For these, fill in the three extra boxes on the event:

- **How it is remembered**: the popular version, in one or two sentences. The event's main paragraph stays the record.
- **Source for how it is remembered**: required. The memory needs a source too (a textbook debate, a news report, a page that tells the popular version).
- **Why people disagree**: one line.

The website then shows the record and the memory side by side. Changing any of these sends the event back to "needs check", like any other wording.

## Who may verify

- **Not anyone who wrote the words.** Everyone who wrote or changed an item's words since it was last checked is listed as one of its authors, and none of them can verify it. If you write a fact and a teammate fixes a typo, a third teammate checks it.
- **Only the version you are looking at.** If someone changes an item after you opened the page, Verify is refused: reload and check the new version.
- **Moving counts as a change.** Moving a live fact to another section or city sends it back to be checked.
- **The city letter too.** Saving the letter makes a draft. A different teammate checks it against its sources and presses Verify; only then does it replace the live letter.

