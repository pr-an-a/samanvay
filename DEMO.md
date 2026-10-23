# Samanvay — 2.5-minute demo video script

**The idea in one line:** officers don't need another dashboard. Samanvay checks across bureaus at the moment
they're about to act.

The video is the first thing judges watch, often on mute and skipping around. Every screen has a **caption** (big
text at the bottom, written to make sense without sound) and a **voiceover** line. Record with **video mode on**:
press **V**. It shows the caption bar, softly outlines whatever is being discussed (and scrolls it into view), and
hides admin-only clutter (Admin menu, Reset button, demo-mode notes).

## Before you record

1. From the repo folder run `./start.sh`. Wait for **"Samanvay is running: http://localhost:5173"**. It reseeds, so the data is fresh.
2. Open **http://localhost:5173** in Chrome. Window about 1440 × 900, browser zoom 100%. Everything works offline.
3. Stay on the sign-in page. Press **V** once. Start screen recording.
4. To retake: **Exit** the guided demo, then run `./start.sh` again (fresh data). Always reseed before a take: each run adds notes, audit entries and inbox items.

The guided demo has **11 steps**; its side panel's buttons do the navigating, so the video needs very few clicks.

---

## The script

### 0:00–0:12 · Hook (sign-in page, no clicking yet)

| Caption | Voiceover |
|---|---|
| *Officers don't need another dashboard. Samanvay checks across bureaus at the moment they're about to act.* | "AICTE's Regulation Bureau and its Public Grievance Redressal Cell both handle complaints about colleges, in separate systems. So two bureaus can act on the same college without knowing it. Officers don't need another dashboard. They need a check at the moment they're about to act." |

Let the two threads on the right draw and merge, then click **Start guided demo** (it signs in as the Grievance Cell officer).

### 0:12–0:30 · Without / With (guided step 1)

| When | Click | Caption (changes by itself) | Voiceover |
|---|---|---|---|
| 0:12 | Nothing. Two seconds on the inboxes. | *Each bureau sees only its own cases.* | "Today each bureau sees only its own inbox." |
| 0:20 | **Turn on Samanvay** | *Samanvay finds the same college across bureaus — even when the name is spelt differently.* | "Samanvay connects the same college across bureaus, even when the name is spelt differently, and even without an AICTE ID." |

Three threads draw in under a second: two **Matched without AICTE ID**, one **Same AICTE ID**. Click **Next: an officer drafts a request**.

### 0:30–0:50 · The officer drafts a request, and the pre-action check stops them (guided steps 2–3)

| When | Click | Caption | Voiceover |
|---|---|---|---|
| 0:30 | On the case page: **Use demo example**, then **Check and send** | *A Grievance Cell officer is about to ask a college for its lab report.* | "Here a Grievance Cell officer is about to ask a college for its laboratory report. Nothing has been sent." |
| 0:38 | The charcoal check panel slides in. Pause on the two actions side by side. | *Samanvay stops the officer first: the Regulation Bureau already asked, six days ago.* | "Before it's saved, Samanvay checks the same college's cases at other bureaus. 'Before you send: another bureau already asked.' The Regulation Bureau requested the same report six days ago. Two asks, one college." |

### 0:50–1:05 · Coordinate, and the other bureau gets the note (guided steps 4–5)

| When | Click | Caption | Voiceover |
|---|---|---|---|
| 0:50 | **Coordinate with Regulation Bureau**, then **Send note** | *Instead of a second request, the officer sends a note. The college is not asked twice.* | "The officer chooses to coordinate. A note goes to the other bureau, and the request to the college is held." |
| 0:58 | **Close**, then **Show the Regulation Bureau's bell** (the Inbox opens), then click the bell | *The Regulation Bureau's bell rings straight away.* | "The Regulation Bureau's bell rings straight away, and the note is waiting at the top of their inbox." |

The other options on the panel were **Send anyway** (needs a reason, written to the audit log) and **Cancel**.

### 1:05–1:20 · Merged timeline (guided step 6)

Click **Next: the merged timeline**. The page scrolls to the timeline; the events appear one after another.

| Caption | Voiceover |
|---|---|
| *Two bureau threads, one shared timeline.* | "On the college page each bureau has its own thread. Where an officer confirmed it's the same college, the threads join into one shared timeline." |

### 1:20–1:42 · Stress test (guided step 7)

Click **Next: stress test**, then **Run**.

| Caption | Voiceover |
|---|---|
| *Twenty ways to misspell one college. The real matcher, row by row.* (while it runs) | "One college, twenty ways a complainant might write its name: capitals, abbreviations, merged words, dropped honorifics, initials, a missing district. This is the real matcher, run live on each one." |
| *Samanvay 17/20 · Exact name 3/20 · ID-only 0/20* (when it finishes; read the real numbers off the screen) | "Samanvay catches seventeen. An exact-name search catches three, and an AICTE-ID search catches none, because these complaints have no ID. The misses are in red, not hidden: initials without dots, a typo with no district, and 'College' instead of 'Institute'." |

### 1:42–1:58 · Baselines and accuracy, with the honest caveat (guided step 8)

Click **Next: simpler methods**. The bars grow when the page appears.

| Caption | Voiceover |
|---|---|
| *On 50 planted overlaps, simpler methods miss most. Synthetic data: a prototype, not a proof.* | "On fifty planted overlaps, matching by AICTE ID alone finds fifteen, exact name finds twenty-two with four wrong matches, and Samanvay finds all fifty with none. The honest part: this is synthetic data we made, with mistakes we designed. Real complaints will be messier, and every match is only a suggestion until an officer confirms it." |

### 1:58–2:08 · How it works (guided step 9)

Click **Next: how it works**.

| Caption | Voiceover |
|---|---|
| *Match the college. Show the evidence. Check before acting. A person decides.* | "Four steps. Find the same college. Show the evidence behind every match. Check before an action goes out, with plain rules and no AI. And a person always decides." |

### 2:08–2:25 · Inbox, deadlines and privacy (guided step 10)

Click **Next: inbox and deadlines**, then **Sign in as Administrator**, open the bell, click **Run check now**.

| Caption | Voiceover |
|---|---|
| *One inbox, deadline alerts for each bureau, and complainant names stay private.* | "Each officer gets one coordination inbox: notes waiting, clashes prevented, overdue linked cases, new matches. Overdue and due-soon cases alert each bureau. Those time limits are demo settings, not official AICTE ones. And a bureau never sees another bureau's complainant names." |

### 2:25–2:35 · Close (guided step 11)

Click **Next: close**. Hold on the inbox.

| Caption | Voiceover |
|---|---|
| *Samanvay checks across bureaus at the moment they're about to act.* | "Samanvay: a check across bureaus at the moment an officer is about to act, an explanation behind every match, and a person making every decision." |

Click **Finish tour**. Press **V** to turn video mode off.

---

## Every caption, step by step

Defined in `frontend/src/tour.jsx` (the sign-in caption and the other screens' captions are in `frontend/src/video.jsx`).

| Step | Screen | Caption |
|---|---|---|
| — | Sign-in page | Officers don't need another dashboard. Samanvay checks across bureaus at the moment they're about to act. |
| 1 | Without / With, before | Each bureau sees only its own cases. |
| 1 | Without / With, after "Turn on Samanvay" | Samanvay finds the same college across bureaus — even when the name is spelt differently. |
| 2 | Case page, New action | A Grievance Cell officer is about to ask a college for its lab report. |
| 3 | Pre-action check panel | Samanvay stops the officer first: the Regulation Bureau already asked, six days ago. |
| 4 | Coordinate | Instead of a second request, the officer sends a note. The college is not asked twice. |
| 5 | Other bureau's bell and inbox | The Regulation Bureau's bell rings straight away. |
| 6 | College page timeline | Two bureau threads, one shared timeline. |
| 7 | Stress test, while running | Twenty ways to misspell one college. The real matcher, row by row. |
| 7 | Stress test, finished | The live score line, e.g. Samanvay 17/20 · Exact name 3/20 · ID-only 0/20 |
| 8 | Accuracy | On 50 planted overlaps, simpler methods miss most. Synthetic data: a prototype, not a proof. |
| 9 | How it works | Match the college. Show the evidence. Check before acting. A person decides. |
| 10 | Inbox | One inbox, deadline alerts for each bureau, and complainant names stay private. |
| 11 | Close | Samanvay checks across bureaus at the moment they're about to act. |

## What the screens show (and what is staged)

- **The pre-action check** runs three plain rules against the cases an officer has *confirmed* as the same college. They are in `backend/app/clash.py`, with the windows in `backend/app/clash_config.json` (14 / 30 / 21 days: demo settings, not official AICTE rules):
  - **Duplicate effort**: a similar request or notice from another bureau within 14 days.
  - **Conflicting action**: closing while another bureau has escalated or issued a show-cause notice (30 days), or transferring to a bureau already handling the college.
  - **Waiting on each other**: both linked cases quiet for 21 days.
- **The demo college is staged history.** On every seed the demo college (Shri Megha Saraswati Institute of Technology) gets a back-story so the check fires reliably: the Grievance Cell officer's confirmation of the match is dated 10 days ago (attributed to the demo officer, in the audit log), and the Regulation Bureau's "documents requested" is dated 6 days ago. The matcher itself never confirms anything.
- **Without / With** uses real cases from the data. The "New today" complaint is the prepared demo complaint; the other two pairs are real matches chosen for the biggest difference in spelling.
- **Stress test** runs the real matcher on twenty variants of one fictional college, saves nothing, and none of the variants were removed after seeing results.
- **Baseline bars** are computed by `eval/evaluate.py` and stored by `eval/build_results.py`. All methods see the same pairs.
- Everything is synthetic and nothing is connected to AICTE systems. Sign-in is demo-grade.

## If something goes wrong

| What happens | Do this | Say |
|---|---|---|
| The check panel does not appear | The demo has already been run on this data. Run `./start.sh` for a fresh reseed. | (Cut and retake.) |
| A **"Signed out"** box appears | Click **Sign in again**, pick **Grievance Cell officer**, and carry on from the step you were on. | (Cut this in the edit.) |
| The guided-demo panel is gone | **Start guided demo** again, or use the sidebar. | (Nothing needed.) |
| The caption bar is missing | Press **V** (not while typing in a box). | (Nothing needed.) |
| The page doesn't load | `./stop.sh && ./start.sh`, then reload. | (Cut in the edit.) |
| Bell shows no deadline alerts | Press **Run check now** inside the bell. | "In demo mode the deadline check runs when I press this." |

## After recording

Reset for the next take with `./start.sh`. Stop everything with `./stop.sh`.
