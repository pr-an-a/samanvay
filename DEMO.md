# Samanvay — demo video script (about 3½ minutes)

**The idea in one line:** officers don't need another dashboard. Samanvay checks across bureaus at the moment
they're about to act.

The video is made by a script, not by hand: `node video/build.mjs` reseeds the data, writes the voiceover with Piper,
records every section in the real app (video mode, 1920×1080), and assembles `video/out/samanvay_demo_draft.mp4`.
The exact voiceover lines, their target lengths and where every spoken number comes from are in
[`video/VOICEOVER.md`](video/VOICEOVER.md) (generated). This page is the plan and the human-run version.

Every number said in the voiceover is filled from the live app or `eval/results.json`, and the recorder waits until the same
text is on screen before the sentence is spoken. If the screen disagrees, the build stops.

## The flow

| # | Scene | Screen | What happens | Spoken numbers (source) |
|---|---|---|---|---|
| T | Title card | Charcoal card | Samanvay · SIH26264 · Team First Commit · VNR VJIET | none |
| 1 | **Illustrative scenario** (label on screen) | `/story` | Ananya's college withholds her original certificates; she complains to the Grievance Cell; the Regulation Bureau is already acting on the same college. Two files, one college, no connection | none |
| 2 | Without / With | `/without-with` | Two bureau inboxes; **Turn on Samanvay** draws the matches | matches and how many have no AICTE ID (`/demo/without-with`) |
| 3 | The pre-action check | Case `PG-2026-00169` | An officer types a request for Ananya's certificate records; the check panel shows the official alert **"Potential Overlapping Cases – Coordination Required"** and that the Regulation Bureau already asked | days since the other bureau asked (`/cases/{id}/actions/check`) |
| 4 | Coordinate | Check panel → Regulation Bureau inbox | A note instead of a duplicate request; the other bureau's bell rings and the note waits at the top of their inbox | none |
| 5 | One merged timeline | College page | Two bureau threads join into one shared timeline | none |
| 6 | Reports | `/reports` | KPIs count up; open vs overdue by bureau; ageing chart | none |
| 7 | Stress test | `/stress` | Twenty ways to write one college's name through the real matcher; misses shown in red | totals from `/demo/stress-test` |
| 8 | Baselines and accuracy | `/accuracy` | Bars: AICTE ID only, exact name, Samanvay on 50 planted overlaps; and a second dataset the matcher was never tuned on | `eval/results.json` (`baselines.seed42`, `baselines.unseen_seed43`) |
| 9 | How it works | `/how-it-works` | AICTE ID match; fuzzy name and address matching; description similarity; rule-based clash checks; explainable rules, no black-box AI | none |
| 10 | Inbox, privacy, deadlines | Inbox → case page (hidden complainant name) → Administrator bell | One coordination inbox; the other bureau sees "A*** R***"; "Run check now" | none |
| 11 | Close | Inbox | "Samanvay checks across bureaus at the moment an officer is about to act." | none |
| E | End card | Charcoal card | Key numbers and "Prototype on synthetic data. Not integrated with AICTE systems." | same sources |

## Run it by hand (the guided demo)

1. `./start.sh`, open <http://localhost:5173>, press **V** (video mode) and click **Start guided demo**.
2. The guided demo has **12 steps** and its side panel does the navigating:
   Without/With → draft a request → the check stops you → coordinate → the other bureau's bell → merged timeline →
   Reports → stress test → baselines → how it works → inbox, deadlines and privacy → close.
3. Reseed (`./start.sh`) before every take: each run adds notes, audit entries and inbox items.

## Captions (video mode, one line per step)

Defined in `frontend/src/tour.jsx`; the story and sign-in captions are in `frontend/src/video.jsx`.

| Step | Caption |
|---|---|
| — | Officers don't need another dashboard. Samanvay checks across bureaus at the moment they're about to act. |
| 1 | Each bureau sees only its own cases. → Samanvay finds the same college across bureaus — even when the name is spelt differently. |
| 2 | A Grievance Cell officer is about to ask the college for her certificate records. |
| 3 | Samanvay stops the officer first: the Regulation Bureau already asked, six days ago. |
| 4 | Instead of a second request, the officer sends a note. The college is not asked twice. |
| 5 | The Regulation Bureau's bell rings straight away. |
| 6 | Two bureau threads, one shared timeline. |
| 7 | One dashboard: every bureau's pending, ageing and overdue cases together. |
| 8 | Twenty ways to misspell one college. The real matcher, row by row. |
| 9 | On 50 planted overlaps, simpler methods miss most. Synthetic data: a prototype, not a proof. |
| 10 | ID match, fuzzy names, description similarity, clash rules. Explainable, no black-box AI. |
| 11 | One inbox, deadline alerts for each bureau, and complainant names stay private. |
| 12 | Samanvay checks across bureaus at the moment they're about to act. |

## What is staged, and what is not

- **The demo college is staged history.** On every seed, `app/seed.py` re-themes the Grievance Cell case `PG-2026-00169` (Ananya's certificate complaint, the
  college name written with a spelling slip, no AICTE ID; complainant name is fictional) and the Regulation Bureau case `RB/2026/0138`, **before** the matcher
  runs, so the match is real. Afterwards it writes history so the check fires reliably: the confirmation of the match is dated 10 days ago and attributed to the demo
  Grievance Cell officer (it is in the audit log), and the Regulation Bureau's request for the certificate register is dated 6 days ago. The matcher itself never confirms anything.
  The evaluation seeds with `--bare` and is unaffected.
- **The Ananya scene is illustrative** and labelled so on screen: an invented person and story, not a real case.
- The pre-action check's windows (14 / 30 / 21 days) are demo settings in `backend/app/clash_config.json`, not official AICTE rules. SLA time limits are demo settings too.
- Everything is synthetic and nothing is connected to AICTE systems. Sign-in is demo-grade.

## Using a human voice

Record one file per section as `video/voice/<section>.m4a` (section ids and target lengths are in `video/VOICEOVER.md`), then run `node video/build.mjs`.
Sections with a human file are re-recorded and re-timed to it; the others keep the Piper voice.

## If something goes wrong

| What happens | Do this |
|---|---|
| The check panel does not appear | The demo has already been run on this data: run `./start.sh` for a fresh reseed |
| A "Signed out" box appears | Click **Sign in again**, pick **Grievance Cell officer**, carry on |
| The caption bar is missing | Press **V** (not while typing in a box) |
| The page does not load | `./stop.sh && ./start.sh`, then reload |
