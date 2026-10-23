# Samanvay demo video — script and shot list (v2)

**Goal:** a first-time viewer, possibly on mute, understands *what* is happening, *why* it matters and *when* in the story we are.
The v1 draft failed that: screens changed without explanation and the voice often described a click after it had happened.

## The five rules every scene follows

1. **CONTEXT → action → result → WHY.** A short sentence says where we are and what is about to happen. Then the action. Then the result is on screen. Then one sentence says why it matters.
2. **The voice explains before each click, never after.** While the sentence is spoken the cursor glides (slowly) to the target. Only when the sentence ends does the element pulse for 0.5 s and get clicked.
3. **Who and when are always visible.** A top-left label shows who we are watching (e.g. "Priya · Grievance Cell officer"). When the person changes, a 2-second card says so ("Meanwhile, at the Regulation Bureau…"). Six chapter cards (2 s) show where we are in the story.
4. **The bottom bar is the subtitle, nothing else.** It shows the sentence being spoken, in step with the voice (same text as `video/out/samanvay_demo.srt`). Chapter and persona are separate labels. The guided-demo side panel is hidden.
5. **Look where the story is.** Smooth zooms (0.6 s, ease in/out, up to 1.8×) onto the check panel, the coordination note, the merged-thread timeline, the stress-test score line, the three baseline bars, the second-dataset line and the inbox's top rows. Zoomed elements are scaled in place so text stays sharp, and never reach the subtitles. Silent holds are kept to about 1.5–2 s.

## Structure (12 scenes in 6 chapters; was 11 scenes and no chapters)

| Chapter card | Scene | Persona label | Length goal | Time spent on it |
|---|---|---|---|---|
| 1 · The problem | Ananya's story | none (illustrative) | 15 s | normal |
| 2 · Finding the same college | Without / With | Priya · Grievance Cell officer | 18 s | normal |
| 3 · Stopping a duplicate request | **The pre-action check** (draft, check, alert) | Priya · Grievance Cell officer | ~40 s | **slowest: voice 20 % slower, cursor 35 % slower, longest holds** |
| | **Coordinate** (three choices, drafted note, send) | Priya | ~20 s | slow |
| | *Transition card: "Meanwhile, at the Regulation Bureau…"* | | 2 s | |
| | At the Regulation Bureau (inbox, note, shared timeline) | Arjun · Regulation Bureau officer | ~26 s | normal |
| 4 · Does it work? | Stress test | none | ~24 s | normal |
| | Accuracy (bars + second dataset) | none | ~28 s | normal |
| 5 · How it works | Four ideas | none | ~26 s | normal |
| 6 · Built for officers | Reports dashboard (short) | "Senior officers · all bureaus" | ~10 s | short |
| | Inbox, privacy and close | Arjun · Regulation Bureau officer | ~17 s | short |

Cut or merged since v1: the separate "timeline" scene is now part of the Regulation Bureau scene; the inbox, privacy and closing line share one short scene; the deadline-check beat was cut to fit 4:00 (the Administrator persona and its transition card went with it); the How-it-works scene lost its long intro; the Reports scene is two sentences. 10 scenes in 6 chapters.
Title card (3 s) and end card (4 s, key numbers and the synthetic-data disclaimer) stay.

## Script (what is said, what happens, what is on screen)

`→` marks the click, which always comes **after** the sentence before it. `{…}` are numbers filled from live data; a sentence that says a number is spoken only once that number is on screen.

### 1 · The problem — Ananya's story (illustrative scenario label on screen throughout)

| # | Voiceover (and subtitle) | On screen |
|---|---|---|
| 1 | This is Ananya. Her college is holding back her certificates. | Ananya appears |
| 2 | She complains to the Grievance Cell. | Her complaint reaches the Grievance Cell (terracotta thread) |
| 3 | The Regulation Bureau already has a case against the same college. | A second file appears at the Regulation Bureau (slate thread); both threads reach one college |
| 4 | Neither can see the other's file, so the college may be asked twice. | "No connection" between the two files |

### 2 · Finding the same college — Without / With

| # | Voiceover | On screen |
|---|---|---|
| 1 | Two inboxes. Some cases are about the same college, but nobody can tell. | The two bureau inboxes; the cursor points at one case on each side |
| 2 | Now we turn Samanvay on. | Cursor glides to **Turn on Samanvay** → pulse, click |
| 3 | It joins {ww.pairs} pairs. {ww.noid} have no AICTE ID, and every name is spelt differently. | Threads draw between the matching cases; labels "Matched without AICTE ID" / "Same AICTE ID" |
| 4 | It finds the same college, however it is written. | Hold on the three matches |

### 3 · Stopping a duplicate request

**The pre-action check** (slowest scene)

| # | Voiceover | On screen |
|---|---|---|
| 1 | Now Ananya's case. The officer wants her certificate records from the college. | Case page, scrolled to the **New action** form |
| 2 | She picks the action and types her request. | Action chosen, request typed at human speed |
| 3 | Before anything is sent, Samanvay checks the other bureaus. | Cursor glides to **Check and send** → pulse, click |
| 4 | It stops her. This is AICTE's own alert: Potential Overlapping Cases, Coordination Required. | The charcoal check panel slides in over a dimmed page; the official wording is shown in its header |
| 5 | The Regulation Bureau asked for the same records {check.days} days ago. | **Zoom** onto the panel: the two actions side by side, "6 days ago" |
| 6 | Without this check, the college would get two requests. | Hold on the panel |

**Coordinate**

| # | Voiceover | On screen |
|---|---|---|
| 1 | The officer can coordinate, send anyway with a reason, or cancel. | Zoomed panel; the cursor visits the three buttons |
| 2 | She chooses to coordinate. | Cursor on **Coordinate with Regulation Bureau** → pulse, click |
| 3 | Samanvay drafts the note. She reads it, then sends it. | **Zoom** onto the drafted note → **Send note** (pulse, click); "bell has rung" confirmation |
| 4 | The college is asked once, and both bureaus know. | Hold on the confirmation |

*Transition card (2 s): "Meanwhile, at the Regulation Bureau…" — persona label changes to Arjun · Regulation Bureau officer.*

**At the Regulation Bureau**

| # | Voiceover | On screen |
|---|---|---|
| 1 | The Regulation Bureau officer opens the inbox. | Inbox; the note is on screen before the sentence starts |
| 2 | The note is at the top. | **Zoom** onto the inbox's top rows (waiting note, prevented clash) |
| 3 | Opening it shows both cases and one shared timeline. | Zoom out; cursor on the top row → pulse, click; the workspace opens |
| 4 | Each bureau has its own thread. Once an officer confirms the match, the threads join. | **Zoom** onto the timeline; cursor follows the threads down to the "Threads join" chip |
| 5 | So nobody acts blind. | Hold on the merged timeline |

### 4 · Does it work?

**Stress test**

| # | Voiceover | On screen |
|---|---|---|
| 1 | Does it work? Names are the hard part. | Cursor → **Stress test** in the sidebar → pulse, click |
| 2 | Here is one college, written {stress.total} different ways. | The table of name variants (top of the table in view, above the subtitles) |
| 3 | Each goes through the real matcher. We press Run. | Cursor → **Run** → pulse, click; the 20 rows reveal one by one (table stays above the subtitles) |
| 4 | Samanvay finds {stress.samanvay}. An exact-name search finds {stress.exact}. An ID-only search finds {stress.id}. | Scrolls to and **zooms** onto the score line |
| 5 | The {stress.misses} misses are shown, not hidden. | Zoom out; the "Where Samanvay missed" card in red |

**Accuracy**

| # | Voiceover | On screen |
|---|---|---|
| 1 | Now we compare it with two simpler methods, on {base.overlaps} planted overlaps. | Cursor → **Accuracy** → pulse, click |
| 2 | An ID-only search finds {base.id}. An exact-name search finds {base.exact}, with {base.exact_wrong} wrong. | **Zoom** onto the three bars (grown, with their "Found X of 50") |
| 3 | Samanvay finds {base.samanvay}, with {base.samanvay_wrong} wrong. | Hold on the zoomed bars |
| 4 | On a second dataset it was never tuned on, it again found {seed43.found} of {seed43.overlaps}. | **Zoom** onto the second-dataset line |
| 5 | This is synthetic data. Real complaints will be messier, and every match is only a suggestion. | Zoom out; the caveat is outlined |

### 5 · How it works

| # | Voiceover | On screen |
|---|---|---|
| 1 | Samanvay uses four ideas. | Cursor → **How it works** → pulse, click; the thread diagram draws |
| 2 | One: an AICTE ID match, when both complaints have one. | Card 1 outlined |
| 3 | Two: fuzzy name and address matching, which handles initials and abbreviations. | Card 2 outlined |
| 4 | Three: description similarity, to spot the same issue. | Card 3 outlined |
| 5 | Four: rule-based clash checks, before an action goes out. | Card 4 outlined |
| 6 | The rules are explainable: no black-box AI, and a person decides. | The charcoal "Explainable rules, no black-box AI" card |

### 6 · Built for officers

| # | Voiceover | On screen |
|---|---|---|
| 1 | Now, a view for senior officers. | Cursor → **Reports** → pulse, click |
| 2 | One dashboard shows every bureau's pending, ageing and overdue cases together. | Label "Senior officers · all bureaus"; KPIs count up; the cursor visits open vs overdue by bureau and the ageing chart |
| 3 | Each officer works from one inbox. | Label returns to Arjun · Regulation Bureau officer; cursor → **Inbox** → pulse, click |
| 4 | Open another bureau's case, and the complainant's name is hidden. | Top row opened, then a cut to the Grievance Cell's case: "A*** R***" outlined |
| 5 | Samanvay checks across bureaus at the moment an officer is about to act. | Hold; the end card follows |

## Numbers said, and the proof on screen before they are spoken

| Spoken | Source | Proof the recorder waits for |
|---|---|---|
| {ww.pairs} pairs, {ww.noid} without an AICTE ID | `/demo/without-with` | 3 connector lines drawn; the labels are counted on screen |
| {check.days} days ago | the check API (nothing saved) | "N days ago" in the check panel |
| {stress.*} | `/demo/stress-test` (real matcher) | the score line and "Where Samanvay missed (3 of 20)" |
| {base.*}, {seed43.*} | `eval/results.json` | bars grown to 30 / 44 / 100 %; "Found X of 50"; the second-dataset line |

## Self-review: would a first-time viewer understand what, why and when?

I read this as someone who has never seen Samanvay:

| Question | Check | Result |
|---|---|---|
| **What** is happening? | Every scene opens with a context sentence naming the screen and the person ("Now Ananya's case. The officer wants…"); the subtitle shows exactly what is said; the cursor points at things while they are described | Yes. v1 jumped between screens with no setup |
| **Why** does it matter? | Each scene ends with a WHY line ("Without this check, the college would get two requests", "So nobody acts blind", "It finds the same college, however it is written") | Yes for 8 scenes. Reports and the inbox are short by design; their WHY is the sentence itself |
| **When** are we? | Chapter cards 1–6, the persona label, two transition cards, and Ananya's story (the one thread) running from the hook to the check | Yes |
| Does the voice ever describe a click after it happened? | Clicks happen only in each beat's "after" step, after its sentence | No |
| Is the key idea (the check) given room? | ~60 s across two scenes, voice 15–20 % slower, panel zoomed | Yes |
| Jargon? | "Fuzzy matching" appears once, with "initials and abbreviations" in the same sentence; "ID-only" and "exact-name" are shown as labelled bars; "planted overlaps" is explained by the caveat | Acceptable |
| Anything claimed that is not on screen? | Each number is checked on screen first; the caveats stay; the Ananya scene is labelled illustrative; the pre-seeded history of the demo college is described in `DEMO.md` | Fine |

**Changes the review caused:** a single-sentence Reports scene became two (a context line before the click); "Opening it shows both cases…" was added so the click into the workspace is explained; the privacy line now says *how* ("Open another bureau's case, and…") instead of only stating the rule; the transition between people has its own card.

**Known soft spots:** the stress table is taller than the screen, so the top is shown while rows reveal and the score line is shown after (the bar never covers it). Reading the "Where Samanvay missed" details takes longer than the 3 s given. They are on screen, but the voice only says "shown, not hidden".

## Length (measured)

Final cut **3:54** (234 s), hard limit 4:00 (the build stops above 239 s). Speech is 175 s with the confirmed voice (Kokoro `af_heart`): the pre-action check runs at the confirmed pace and the other scenes a little faster so the video fits. 
Each scene's start and length are in `video/out/report.json`; subtitles are `video/out/samanvay_demo.srt`. Every on-screen proof passed (16 of 16), and all 22 highlighted elements fit above the subtitles.
