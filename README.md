# Sheetner

A Google Sheets–backed Leitner study app built with Google Apps Script and Bootstrap.

## Updating

1. Back up your spreadsheet.
2. Replace all eight .gs and eight .html files in Apps Script. Keep your real spreadsheet ID, sheet names and field headers in Config.gs.
3. Replace intervalsDays with the boxes object shown below. Keys are box names; values are calendar-day intervals. Keep names in progression order, use nonnumeric names, and keep the first interval at 1 day. Values must increase.
4. Run **simplifyMetadata** once from the Apps Script editor to remove legacy history, revision, timestamps and counters from existing nonempty tracking cells. This preserves each word's current box and scheduled date. Empty cells stay empty. It validates all existing data before starting writes; if a write fails partway, rerun it. It is safe to run again.
5. Deploy > Manage deployments > Edit > New version > Deploy. Close old app tabs, then reopen the /exec URL.

Without step 4, old metadata still loads, but old fields remain physically stored until that card is next graded. Show/Hide never rewrites nonempty cells.

## Config

```javascript
function getConfig_() {
  return {
    spreadsheetId: 'YOUR_SPREADSHEET_ID',
    sheetList: {sheetName: 'db', columnName: 'sheetsa'},
    questionField: 'Word',
    showFields: ['Meaning', 'Example'],
    metadataField: 'Metadata',
    notesField: 'My Sentence',
    showSheetName: true,
    timeZone: 'America/Toronto',
    clock: {fixedNow: null},
    examOrder: 'descending',
    boxes: {
      'Box 1': 1,
      'Box 2': 3,
      'Box 3': 7,
      'Box 4': 14,
      'Box 5': 30
    }
  };
}
```

You can instead use names such as Learning, Familiar, Strong, Confident and Mastered. Existing numeric boxes from earlier versions map to the configured order (1 = first entry, 2 = second, etc.). Once names have been stored, changing a name requires updating stored metadata too. There is no answerField, retryMinutes or revision setting.

All sheet columns are found by header name, not position. showFields controls revealed details and their order. Each configured tab must contain questionField, every showFields name, and metadataField, but column positions may differ between tabs. Extra columns are ignored by the UI. Headers must be unique and nonempty. Metadata can be anywhere, as demonstrated by sample-cards.csv. showSheetName controls the generated final source-sheet detail.

## Corrected workflow

| Word state | Daily words | Exam |
| --- | --- | --- |
| Unread, empty metadata | Yes | No |
| First stage, future exam date | Yes | No |
| First stage, exam due today or overdue | No | Yes |
| Later stage, future exam date | No | No |
| Later stage, exam due | No | Yes |
| Exam failed | Immediately returns | Waits until tomorrow |

A word never appears in both lists in a freshly loaded queue. Reload after midnight to refresh the lists; there is no automatic midnight timer. A failed exam returns to Daily words immediately within the open app, with no reload or 10-minute wait.

Daily words: circular Previous/Next and Show/Hide. Next on the last word returns to the first; Previous on the first returns to the last. Moving hides the revealed details. Navigation is disabled while saving or when fewer than two words exist. The first Show details initializes metadata only if the cell is empty, placing the word in the first box and scheduling tomorrow's exam. Loading words alone never initializes them. Later Show/Hide clicks never change existing metadata or postpone the exam.

Exam: Show details, then I know / I don't know. No Previous/Next. Exam shows remaining due-word counts for every named box, for example `Box 5: 30d (4 words)`. The current box is highlighted. There is no separate box/interval label or words-left sentence. A successful submission automatically advances to the next question.

- I know: move to the next configured box and schedule using that box's interval. Passing the last box keeps it there and schedules another last-interval exam.
- I don't know: reset to the first configured box; return to Daily words immediately; schedule tomorrow's exam. The word leaves Daily words when that date arrives.

## Calendar days

Scheduling uses the timezone in config, not elapsed 24-hour waits. Reveal a new word October 25 at 11 PM Toronto time: its first exam is due October 26, including at 7 AM. Pass that exam: Box 2 at 3 days schedules October 29. Fail on October 29: return to Daily words immediately and Exam October 30.

## Simple metadata

```json
{
  "box": "Box 1",
  "nextReviewAt": "2026-10-26"
}
```

Only the current box and exam date are stored. No history, revision, last-reviewed timestamp or counters. Old numeric box values and ISO timestamp dates are converted in memory when loaded; timestamps use their calendar date in the configured timezone. simplifyMetadata persists the compact format across existing cards. Malformed or incomplete nonempty tracking data raises an error rather than resetting progress silently.

Write requests are still serialized with a script lock. The server rechecks that an exam is due before grading; immediate duplicate submissions cannot advance it twice after it is rescheduled. Without historical request IDs, a lost-response retry can return 'no longer due' if the first request succeeded: reload the app to see the saved result. There is no historical retry deduplication or revision-based conflict detection in this version. Use a single active study session.

## Spreadsheet rules

No ID column is needed. Cards use sheet name + actual row number. Append words only at the bottom; do not sort, move, insert above or delete existing rows. Blank rows are skipped without renumbering later words. Columns can move because lookups use names; avoid manual edits during a running submission. Metadata is written only to its named column in the correct tab.

## First-time deployment

Create each provided .gs and .html file in Apps Script (the editor adds .html). Do not add README, tests or CSV as script files. Configure your spreadsheet and headers. Use the supplied appsscript.json manifest or retain V8 and spreadsheet authorization in your own manifest. Run apiLoad once to authorize read access. Deploy as a web app, execute as yourself, access Only myself. Open and bookmark the /exec URL. This is a personal app with shared sheet progress, not a public multi-user app.

## Architecture

Config.gs: declarative settings. Card.gs: data model and compact metadata. SheetCardRepository.gs: named reads/writes. LeitnerScheduler.gs: calendar dates, box transitions and eligibility. ReviewService.gs: queues, initialization, grading and metadata cleanup. Controller.gs: API endpoints, config checks and locks. Index.html/Styles.html: Bootstrap markup and styling. ApiClient.html: google.script.run transport. ReviewModel.html, ReviewView.html and ReviewController.html: separate client state, rendering and interaction.

Bootstrap 5.3.8 CSS is loaded from jsDelivr; no Bootstrap JavaScript or build step is needed. Sheet text is rendered with textContent. Server classes are instantiated inside functions to avoid shared-global file initialization order issues.

## Validation

Run `node tests/run.cjs`. Local tests cover exclusive queues on calendar rollover, initialize-once behavior, named boxes, pass/fail scheduling, compact metadata, legacy cleanup, duplicate due checks, UI reveal gates, box labels and DST date arithmetic. They use mocked Sheets/timezone and a small DOM stub. They passed locally; full visual browser and live Google deployment testing remain unverified.

## Override time for testing

All reads of current system time go through **AppClock.now()** in the new **AppClock.gs** file. The same clock object is injected into the review service and scheduler. Calendar parsing and date arithmetic are also centralized in that class; parsing a supplied date does not read system time. Client code does not read system time.

Normal operation:

```javascript
clock: {fixedNow: null},
```

Simulate 11 PM in Toronto:

```javascript
clock: {fixedNow: '2026-10-25T23:00:00-04:00'},
```

Reveal an unread word: it is scheduled for October 26. Change to the following and deploy a new version, then reload:

```javascript
clock: {fixedNow: '2026-10-26T07:00:00-04:00'},
```

That word is now in Exam only. Use ISO timestamps with an explicit offset or Z, so tests are unambiguous. The clock returns a fresh Date on each call; changing one returned Date cannot alter the fixed clock. Set fixedNow back to null and redeploy after testing. Fixed-time actions write real sheet metadata, so use a spreadsheet copy for tests.

A custom test clock can be injected as an object with now(), while the scheduler can receive an AppClock with the same fixed time. AppClock also exposes today(), toDateKey(date), addDays(dateKey, days) and normalizeDate(value). The composition function service_() wires one shared instance for production.

The test suite checks fixed timestamps, timezone boundaries, fresh Date isolation, service injection, circular navigation and the absence of direct system-clock reads outside AppClock.

## Updated interface and exam ordering

- Sheetner is the app heading and browser-page title. Reload words sits beside the heading.
- The tagline and study-section explanatory subtitles are removed.
- Daily navigation is Previous — **Word 1 of 12** — Next, with the counter centered. Circular navigation and answer hiding on movement are preserved.
- Exam sorts by configured box order according to examOrder: descending finishes the last box first, while ascending finishes the first box first. It does not parse numbers from box names, so custom names work too. Existing source order is retained within a box.
- Box badges always run from lowest to highest and show each configured interval and the remaining Exam count. Counts represent due words still in the queue, not all stored words. They decrease after grading and include zeroes. Badges remain visible when Exam is complete.
- The standalone current-box label and words-left label are removed; the badge highlight identifies the current box. The descriptions under Daily words and Exam are removed.
- No metadata migration is required for this UI update. Keep your existing config values, fixed clock setting and spreadsheet metadata; replace the code files and redeploy a new version.

The local suite also checks ordering on server and client, badge count changes, transitions between boxes, failed words returning to Daily, empty-queue counts, header layout markup, removed copy, and the centered navigation counter. Full visual browser and live Apps Script verification remain unverified.

Suggested repository name: `sheetner`. No repository was created, no code was published, and name availability has not been checked. Choose a license before publishing as open source.

## Feedback placement update

- First reveal no longer displays the first-stage exam date message. Initialization and tomorrow scheduling still happen.
- Exam submission feedback includes the submitted question/word, for example: You marked “achieve” as known. It is now in Box 2. Its next exam is on 2026-11-28.
- Feedback and errors are below the main word card (or empty-state panel), so advancing does not confuse the submitted word with the new question.
- Exam badges always stay immediately below the section tabs and above both the main card and the empty-state panel.
- When Previous or Next skips a Daily word with empty metadata, a note below the card names the skipped word and explains that it stays in Daily words and cannot be scheduled for tomorrow's Exam until Show details is used. Navigation never initializes it. The note clears on the next navigation from a read word, on reveal, reload or section change.
- No config or metadata migration is needed. This update changes Index.html, ReviewController.html and tests; replacing the complete file set also works. Redeploy a new version after updating.

Local checks cover the new messages, no-write skip behavior, initialize-once behavior and markup ordering. Full visual browser and live Apps Script verification remain unverified.

## Sheetner: display order versus question order

The app title and browser title are now Sheetner. Badge order is always Box 1 through Box 5 (or your custom names in configured progression order), regardless of which box is being examined.

Add this required setting to your existing Config.gs:

```javascript
examOrder: 'descending', // biggest box first
```

Use `'ascending'` for smallest box first. This changes question order on both server and client, not the badges or advancement rules. Within a box the source order remains unchanged. Redeploy a new version and reload after changing the setting. Existing metadata needs no migration.

All earlier UI and scheduling changes are included. Local tests cover both question orders, always-ascending badges and counts, branding, and prior functionality. Full visual browser and live Apps Script verification remain unverified.

## Editable user notes

Add `notesField: 'My Sentence'` to Config.gs. Use the exact header you have, including `my setance` if that is its spelling. Each configured sheet must contain that named column; its position may differ between tabs. It must be separate from questionField and metadataField. You can leave notesField out of showFields; if it is included, it is shown only once as the editor rather than a duplicate read-only value.

After revealing details in Daily words or Exam, the notes value appears in a text area. Save notes is disabled until the text differs from the stored value. Reverting the edit disables Save again. Saving writes only that word's notes cell, not its scheduling metadata; successful saves disable the button. Formula-like text beginning with = is stored as literal text.

Unsaved drafts are retained per word while navigating, switching sections and reloading lists within the same open page. They are not saved to Sheets until Save notes is pressed and do not survive a browser-page refresh or closure. Errors keep the draft. A concurrent change to the saved notes causes a conflict error rather than overwriting it; copy your draft before refreshing the page to load someone else's changes.

Exam feedback is now phrased as sentences: You marked “D” as unknown. It returned to Box 1 and Daily words. Its next exam is on 2026-11-27. Passing uses: You marked “D” as known. It is now in Box 2. Its next exam is on 2026-11-28. The wording also works when the word is already at the final box.

For this update, replace all .gs and .html files, keep your config values and add notesField, ensure the notes column exists in every configured tab, and deploy a new version. No metadata migration is needed. Sample CSV now includes My Sentence.

Local tests cover dirty-state behavior, revert, draft retention, correct notes cell, isolation from metadata, retries, concurrent-change rejection and literal formula-like notes. Full visual browser and live Apps Script testing remain unverified.

## Dynamic study-tab list (latest update)

Study tabs are no longer hardcoded in Config.gs. In the same spreadsheet, create a tab named **db**. Put **sheetsa** in row 1 of a column and enter one study-tab name per row below it. sample-db.csv demonstrates this setup. The list column can be anywhere; it is located by header name.

```text
sheetsa
Book 1
Book 2
Vocabulary
```

Set the configurable source in Config.gs:

```javascript
sheetList: {
  sheetName: 'db',
  columnName: 'sheetsa'
},
```

Remove the old static sheetNames entry. Runtime composition reads SheetListRepository on every API request and supplies the resolved names internally. There is no cached list. Add or remove study-tab names in db, then click Reload words: no redeployment is needed for list edits. Names are case-sensitive after trimming surrounding whitespace. Blank rows are ignored and duplicate names are included only once, preserving list order. An empty list produces empty study queues. The db tab itself must not be listed. Missing source tabs, ambiguous/missing list headers and nonexistent study tabs produce clear errors.

Adding a new study tab still requires its question, showFields, notesField and metadataField headers. Removing a name excludes it from the app but does not delete the sheet or its data. Requests for a removed tab do not write to it. Already loaded browser cards need Reload words to refresh the visible lists.

One deployment is required to install this change: add the new **SheetListRepository.gs**, update **Config.gs** and **Controller.gs**, then deploy a new version. Replacing the full code set also works. Future changes to the source-tab name or source-column header require config update and redeployment; only edits to the list values are deployment-free. There is no metadata migration.

The local test suite covers fresh list edits, header lookup in different columns, trimming, duplicate/blank handling, empty lists, nonexistent study tabs, missing/duplicate headers and source self-reference. Live Google deployment remains unverified.

## Copy question

A Copy button beside the question copies its full text in Daily words and Exam, including line breaks. It does not reveal details, initialize metadata, or alter scheduling. Feedback appears below the card. ClipboardService.html encapsulates clipboard access, with a compatibility fallback for embedded browsers. If the browser blocks copying, the app reports the failure so you can copy manually.

For this update, add **ClipboardService.html** and replace **Index.html** and **ReviewController.html**. Then deploy a new version and reload. No config or metadata changes are needed. Local tests cover copying in both sections, exact text, no initialization, success/failure feedback and Clipboard API calls. Actual browser clipboard permissions and live Apps Script deployment remain unverified.
