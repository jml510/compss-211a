# COMPSS 211A practice studio

A course page with a cumulative self-check, browser-saved practice, automatic anonymous activity tracking,
54 skill-specific quick checks, nine deeper examples across filtering,
functions, and debugging, and 40 code drills. The checklist is the home page. All 57 skill titles
and their Open practice links lead directly to a stable #skill/<id> route.

## Weekly maintenance

The checklist defaults to **Covered through Week N**. It calculates the current
course week in the browser using `America/Los_Angeles`, so GitHub Pages needs no
weekly rebuild, scheduled workflow, or manual update. An open checklist refreshes
within a minute of a release and when the student returns to the tab.

`schedule.mjs` lists the actual Fall 2026 bCourses week-start dates. Week 1 begins
August 31 and lasts two calendar weeks; Week 2 begins September 14. Week 4 opens
September 28, and subsequent course weeks open each Monday at midnight Berkeley
time through Week 13 on November 30. Adjust that list for a revised calendar or
another semester. **Entire course** remains available for looking ahead; future
skills are labeled. This is a display filter, not an access restriction. It uses
the device clock. No “First introduced” filter remains.

Add or revise skill descriptions, resource links, and `releaseWeek` values there.
Keep each skill's `id` unchanged: saved ratings are tied to IDs, not row order.
The catalog is a snapshot of the Google Sheet, not a live connection to it.
SQL remains in the catalog; its current notebook link is provisional.

Students return to the same URL. Their ratings stay in localStorage under
`compss-211a-practice-v1`. The course link enables automatic anonymous activity tracking. It records fixed outcome labels and self-ratings; code drafts and typed answers never leave the browser.
Progress does not automatically move between browsers or website origins.
Students can export a JSON backup and merge it on another device; newer ratings
and code drafts win, and practice results are combined. The app does not collect
student names, IDs, or grades. Normal host/CDN access logging still applies.

## Exercise behavior

`skill-checks.mjs` contains a unique question, answer choices, feedback, and hint
for each of the 54 quick-check skills. `exercises.mjs` contains the three deeper
activities, task variants, feedback rules, hints and worked solutions.
Filtering and debugging are guided prediction/diagnosis exercises, not a Python
editor. Functions execute real Python in a disposable-capable Web Worker using
Pyodide 314.0.7 from jsDelivr. No pandas or API credentials are needed. Download
failures have a retry path and notebook alternative; a Stop button and six-second
execution timeout handle runaway code. Code drafts survive stopping a run.
Passing an example never sets a self-rating automatically.

## Code drills

Open `#drills` from the navigation, a skill page's “Practise by writing code” list,
or the “Code drills: n of m done” link on a checklist row. Each drill (`#drill/<id>`)
has students write real Python on course data: the HW1 commute survey, gapminder,
and the Week 4–5 SF311 requests with the supervisor-districts table. There are two
kinds: fill-in-the-code drills with an explanation and a runnable example, and
“Write it yourself” drills that start from an empty editor and report a list of tests.

`drills.mjs` holds the drills. Each one has a stable `id`, one catalog `skill`, and a
`week`; it appears when that course week starts, like the checklist. Check runs the
student's code and the model answer in fresh namespaces, then compares the named
results. It then runs both again with different inputs (changed starting values, or
a 60% sample of the table), so typing in the printed result does not pass. After
adding or editing a drill, run `uv run python docs/practice/scripts/check_drills.py`
from the repository. It confirms that each model answer passes, each starter fails,
and each second run changes the answer. `npm test` checks IDs, skills, and weeks.

Drills run in `drill-worker.mjs`, a Web Worker with Pyodide 0.27.7 and pandas 2.2.3
from jsDelivr (about 30 MB on first use, then cached). This is a separate runtime from
the function exercise, matching the course interactives.
A Stop button and a 15-second timeout end runaway code. The tables in
`drill-data.mjs` load only in the worker.

Passing a drill marks it done (under `drills` in the progress record) and offers the
skill's self-check. It never sets a rating. Drafts are saved as `drill:<id>`. Backups
include both, and a merge keeps a drill done if it was done on either device. The
drill list can show only drills for skills rated yellow or red.

## Develop and publish

No build dependencies are required. Run `npm test` for the logic and Python
checks, and `npm run build` to assemble a static `dist/`, or `npm run build:hosted` for the Sites Worker. Node 18 or newer is required. The root files
can also be served as-is under the course's existing GitHub Pages `docs/practice/`
path. The parent course repository is not pushed by the private Sites deployment.

The Sites deployment collects anonymous activity. The instructor report lives in a private Google Sheet, with no instructor interface on the student website. Its public student audience still requires explicit approval before activation. The GitHub Pages copy remains static and cannot receive activity.

## Flashcards

Open `#flashcards` from the navigation or use the Flashcards link beside a skill.
The 100 cards in `flashcards.mjs` cover Python, pandas, SQL, and analysis decisions. Coverage defaults to the
current course week; Entire course allows review ahead. Prompts require recall
rather than choosing from multiple-choice answers. Students may type a temporary
answer before revealing the answer; this scratch text is not saved after reload.

Reviews are saved under `flashcards` in the existing progress record. Again returns
a card in 1 minute; Hard in 10 minutes for new/learning cards; Good in 1 day; Easy
in 4 days. For established cards, Hard increases the interval by 1.2x, Good by 2x,
and Easy by 3x (rounded up, capped at 365 days). Again resets the interval.
This is a simple interval schedule, not FSRS or an estimate of mastery. Due cards
come before unseen cards. Review ahead is optional when no cards are due.
Flashcard reviews do not set the checklist's self-ratings. Backups include review
schedules, merge the most recent review per card, and accept older backups.
Dates use the device clock; progress remains local to this browser and origin.


## Automatic activity and private reporting

The class link is stored in the instructor's private Google Sheet. It opens the
practice homepage and enables automatic tracking in that browser. A visible
notice explains tracking before students interact. There is no Share button,
manual submission, instructor page, or instructor navigation link.

Tracked events: completed checks (pass/fail), code drill checks (pass/fail, with
the drill ID), self-ratings (including clearing a rating), and flashcard difficulty ratings. Hint and solution openings are not
tracked. The client drops queued openings and the server discards them from
cached clients; earlier opening events are excluded from report aggregates.
No names, student IDs, code drafts, typed answers, keystrokes, general navigation,
IP addresses, or arbitrary error text are stored by this application. Normal
hosting logs still apply. Historical local progress is not uploaded; tracking
starts after opening the class link. Clearing local progress does not delete
previously recorded events. Anonymous browser IDs do not establish attendance
or identify unique people across browsers/devices.

The browser queues bounded events individually in local storage and sends them
automatically. It retries after connection failures and reloads; unique event
IDs make retries idempotent. A maximum of 500 unsent events protects browser
storage; the notice reports when it cannot keep additional events. Unavailable
browser storage means queued events survive only while the page stays open.
Data is grouped by server receipt time, so delayed offline events appear on
reconnection. The report supports 7, 30, and 120 days and includes currently
covered skills plus any later skills with activity.

The private Google Sheet's Class patterns tab shows self-rating counts, attempt
and incorrect counts, and browsers whose latest checked example is incorrect.
Unrated/untried skills are never counted as failures. Retries are attempts, not
additional participants. Activity feed also contains flashcard measures. Three code drill columns come last
(checks, checks not passed, and browsers that passed a drill for the skill), so
existing Sheet columns keep their positions. Legacy hint and solution
columns remain zero for compatibility with the existing Sheet importer. Self-ratings use the latest rating recorded inside
the selected window. Practice results may follow hints and are not grades.

The Sheet imports aggregate CSV using a private read key. IMPORTDATA refreshes
about hourly while open (Google: https://support.google.com/docs/answer/12188454).
It is not a real-time dashboard. The report includes generation and latest-event
timestamps. Keep the Sheet restricted: its Connection tab contains the read key.
The class link authorizes sending only; it cannot read the report.

Hosted secrets `REPORT_KEY` and `CLASS_CODE` are managed through Sites and never
included in public assets or source. `/api/activity` is write-only; every request
checks class code, browser key, origin, size, and allowlisted event schema.
`/api/report.csv` requires the separate private read key and returns aggregates,
never per-browser histories. Its bounded 50,000-event read fails visibly when a
reporting period is too large instead of silently truncating data.

`db/schema.ts` and generated `drizzle/` files own schema changes. Applied
migrations are immutable. The legacy manual-check-in tables remain for source
and data preservation but have no exposed routes and are not in the new report.
Use `npm run db:generate` for new changes and inspect generated SQL before
publishing. `build-hosted.mjs` packages an explicit public asset allowlist; server
source, tests, migrations, and local databases are not public assets.

`npm test` checks payload minimization, real SQLite persistence, secret-protected
reporting, deduplication, browser queue retries/reloads, and denominators, plus
the existing practice tests. `node scripts/preview.mjs` runs a loopback-only
preview with disposable SQLite data; its test configuration is never deployed.
