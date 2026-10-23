# Samanvay — 2.5-minute demo video script

The video is the first thing judges watch, often on mute and skipping around. So every screen has a
**caption** (big text at the bottom, written to make sense without sound) and a **voiceover** line (the same idea,
spoken). Record with **video mode on**: press **V**. It shows the caption bar, softly outlines whatever is being
discussed, and hides admin-only clutter (Admin menu, Reset button, demo-mode notes).

## Before you record

1. From the repo folder run `./start.sh`. Wait for **"Samanvay is running: http://localhost:5173"**. It reseeds, so the data is fresh.
2. Open **http://localhost:5173** in Chrome. Window about 1440 × 900, browser zoom 100%. Everything works offline.
3. Stay on the sign-in page. Press **V** once (the caption bar appears when a screen has a caption). Start screen recording.
4. To retake: **Exit** the guided demo, then run `./start.sh` again (fresh data), or sign in as Administrator and use **Overview → Reset demo data** (turn video mode off with **V** to see it).

Everything below follows the **guided demo** (9 steps). The side panel's buttons do the navigating, so the video needs very few clicks.

---

## The script

### 0:00–0:15 · Problem hook (sign-in page, no clicking yet)

| Caption | Voiceover |
|---|---|
| *Two AICTE bureaus. One college. Neither knows about the other.* | "AICTE's Regulation Bureau and its Public Grievance Redressal Cell both handle complaints about colleges. They keep separate records, so both can act on the same college without knowing it. The brief calls this *Potential Overlapping Cases – Coordination Required*. We built the tool that raises that alert." |

Point at the headline on the sign-in page, then click **Start guided demo** (it signs in as the Grievance Cell officer).

### 0:15–0:35 · Without / With animation (guided step 1)

| When | Click | Caption (changes by itself) | Voiceover |
|---|---|---|---|
| 0:15 | Nothing. Let the two inboxes sit for two seconds. | *Each bureau sees only its own cases.* | "Today this is what each bureau sees: only its own inbox." |
| 0:25 | **Turn on Samanvay** | *Samanvay finds the same college across bureaus — even when the name is spelt differently.* | "Turn Samanvay on, and it connects the same college across bureaus, even when the name is spelt differently, and even when there is no AICTE ID." |

The three lines draw in under a second. Two are labelled **Matched without AICTE ID** (ochre), one **Same AICTE ID**.
Then click **Next: a new complaint**.

### 0:35–1:20 · New complaint → warning → confirm → shared timeline → note (guided steps 2–6)

| When | Click | Caption | Voiceover |
|---|---|---|---|
| 0:35 | **Fill in demo complaint**, then **Register complaint** | *A complaint reaches the Grievance Cell: misspelt college name, no AICTE ID.* | "A student's complaint reaches the Grievance Cell. The college name is misspelt and there's no AICTE ID, so a plain search would find nothing." |
| 0:45 | The ochre warning appears. Read its first line. | *Samanvay warns the officer: the Regulation Bureau is already handling this college.* | "Samanvay checks the other bureaus the moment it's saved, and warns: the Regulation Bureau opened a case on this college eight days ago. Every match shows why: similar name, same address, same district." |
| 0:58 | **Check and confirm**. Optionally type a short note. Then **Yes, same college** | *Nothing is merged automatically. An officer sees the evidence and decides.* | "Nothing is merged automatically. An officer compares both cases and decides. The decision is recorded." |
| 1:06 | The shared timeline opens (**See the shared timeline** if needed). Type *We've issued a show-cause notice. Please hold your reply.* → **Post note** | *One shared timeline. The bureaus can now leave each other notes.* | "Now both bureaus share one timeline, and can leave each other notes, so neither acts blind." |
| 1:14 | **Show the Regulation Bureau's bell**, then click the bell | *The note rings the other bureau's bell straight away.* | "The note rings the other bureau's bell straight away." |

If you want to save time, **Skip the note: stress test** jumps ahead.

### 1:20–1:45 · Stress test (guided step 7)

Click **Next: stress test** in the side panel, then **Run**.

| Caption | Voiceover |
|---|---|
| *Twenty ways to misspell one college. The real matcher, row by row.* (while it runs) | "Here's the stress test. One college, twenty ways a complainant might write its name: capitals, abbreviations, merged words, dropped honorifics, initials, a missing district. This is the real matcher, run live on each one." |
| *Samanvay 17/20 · Exact name 3/20 · ID-only 0/20* (when it finishes; read the real numbers off the screen) | "Samanvay catches seventeen. Searching for the exact name catches three, and searching by AICTE ID catches none, because these complaints have no ID. And the three Samanvay misses are shown in red, not hidden: initials without dots, a typo with no district, and 'College' instead of 'Institute'." |

The numbers come from the live run and can change if the matcher or the variant list changes. Say what is on screen.

### 1:45–2:05 · Baseline bars and accuracy, with the honest caveat (guided step 8)

Click **Next: compared with simpler methods**. The bars grow when the page appears.

| Caption | Voiceover |
|---|---|
| *On 50 planted overlaps, simpler methods miss most. Synthetic data: a prototype, not a proof.* | "On fifty planted overlaps, matching by AICTE ID alone finds fifteen, exact name finds twenty-two, with four wrong matches, and Samanvay finds all fifty with none. Now the honest part: this is synthetic data, made by us, with mistakes we designed. Real complaints will be messier, and every match is still only a suggestion until an officer confirms it." |

The same page shows the held-out test half and the accuracy table. Scroll no further than the caveat.

### 2:05–2:30 · Deadlines and closing (guided step 9)

Click **Next: deadlines**, then **Sign in as Administrator**, open the bell, click **Run check now**.

| Caption | Voiceover |
|---|---|
| *Overdue and due-soon cases alert each bureau. Demo time limits, not official ones.* | "Samanvay also watches deadlines. This check flags overdue and due-soon cases for each bureau. These time limits are demo settings, not official AICTE timelines." |
| *(hold on the bell for the closing line)* | "Samanvay: one view across bureaus, an explanation behind every match, and a human making every decision." |

End the recording. Press **V** to turn video mode off.

---

## Every caption, step by step

These are the exact captions the video-mode bar shows, in guided-demo order (they are defined in `frontend/src/tour.jsx`).

| Step | Screen | Caption |
|---|---|---|
| 1 | Without / With, before | Each bureau sees only its own cases. |
| 1 | Without / With, after "Turn on Samanvay" | Samanvay finds the same college across bureaus — even when the name is spelt differently. |
| 2 | Register a complaint | A complaint reaches the Grievance Cell: misspelt college name, no AICTE ID. |
| 3 | Overlap warning | Samanvay warns the officer: the Regulation Bureau is already handling this college. |
| 4 | Check and confirm | Nothing is merged automatically. An officer sees the evidence and decides. |
| 5 | College page / notes | One shared timeline. The bureaus can now leave each other notes. |
| 6 | Other bureau's bell | The note rings the other bureau's bell straight away. |
| 7 | Stress test, while running | Twenty ways to misspell one college. The real matcher, row by row. |
| 7 | Stress test, finished | The live score line, e.g. Samanvay 17/20 · Exact name 3/20 · ID-only 0/20 |
| 8 | Accuracy | On 50 planted overlaps, simpler methods miss most. Synthetic data: a prototype, not a proof. |
| 9 | Deadlines | Overdue and due-soon cases alert each bureau. Demo time limits, not official ones. |

Outside the guided demo, video mode still captions the main screens (Overview, Needs check, Register, All cases, a match, a college, Audit log, Escalations).

## Notes on what the screens show

- **Without / With** uses real cases from the demo data (all synthetic). The "New today" complaint is the prepared demo complaint against its real Regulation Bureau case; the other two pairs are real matches from the data, chosen for the biggest difference in spelling.
- **Stress test** runs the real matcher (the same function the live matching uses) on twenty variants of one fictional college. Nothing is saved. The variant list was written once, before running, and no failing variant has been removed. "Exact name" only ignores capitals and punctuation.
- **Baseline bars** are computed by `eval/evaluate.py` and stored by `eval/build_results.py` (re-run it to refresh). Every method sees the same pairs. The threshold was tuned on half of the overlaps, so the page also shows the held-out test half.
- Time limits are **demo settings, not official AICTE timelines**. Everything is synthetic; nothing is connected to AICTE systems.

## If something goes wrong

| What happens | Do this | Say |
|---|---|---|
| A **"Signed out"** box appears | Click **Sign in again**, pick **Grievance Cell officer**, and carry on from the step you were on. | (Cut this in the edit.) |
| No warning banner after registering | Open **Needs check** and click **Check now** on the first match. | "Here's one the system found earlier. It works the same way." |
| The guided-demo panel is gone | **Start guided demo** again, or use the sidebar: **Without / With**, **Stress test**, **Accuracy**. | (Nothing needed.) |
| The caption bar is missing | Press **V** (not while typing in a box). | (Nothing needed.) |
| The page doesn't load at all | `./stop.sh && ./start.sh`, then reload. | (Cut in the edit.) |
| Bell shows no alerts at the end | Press **Run check now** inside the bell. | "In demo mode the deadline check runs when I press this." |

## After recording

Reset for the next take with `./start.sh`. Stop everything with `./stop.sh`.
