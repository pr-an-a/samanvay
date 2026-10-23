# Samanvay — live demo script

## Before you start (5 minutes before)

1. In a terminal, from the repo folder: `./start.sh`. Wait for **"Samanvay is running: http://localhost:5173"**.
2. Open **http://localhost:5173** in Chrome. Set the browser zoom so the top menu fits on one line (100–125% on a projector).
3. If you rehearsed already: sign in as **Administrator**, scroll to the bottom of **Overview**, click
   **Reset demo data → Yes, reset demo data**. (Or just run `./start.sh` again; it reloads fresh data.)
4. Click **Switch user** so you are back on the sign-in page.

Everything works offline: no internet is needed once `./start.sh` has run once on this laptop.

---

## The 3-minute demo (follows the guided demo)

| Time | Click | Say |
|---|---|---|
| 0:00 | Sign-in page. Point at the headline. | "AICTE's bureaus each handle complaints about colleges, but they can't see each other's cases. So two bureaus can act on the same college without knowing it." |
| 0:15 | **Start guided demo** | "Samanvay spots that overlap and warns the officer before anyone acts. Here's a complaint arriving at the Grievance Cell." |
| 0:25 | **Fill in demo complaint**. Point at the college name. | "The student misspelled the college's name and didn't give its AICTE ID, so a simple search would miss it." |
| 0:40 | **Register complaint** | "The moment it's saved, Samanvay checks the other bureaus' cases." |
| 0:45 | The warning banner (ochre) appears. Read the first sentence aloud. | "The Regulation Bureau opened a case on this same college 8 days ago, and their last action was asking the college for a reply." |
| 1:05 | Point at the ticked reasons. (Optional: **Show details**.) | "It explains why it thinks it's the same college: nearly the same name, same address, same district. Every match shows its evidence." |
| 1:25 | **Check and confirm** | "Nothing is merged automatically. An officer looks at both cases side by side and decides." |
| 1:40 | Type a short note, then **Yes, same college** | "The decision and the note are recorded on both cases and in the audit log." |
| 1:55 | **See the shared timeline** (in the side panel) | "Now the college has one timeline. Both bureaus see each other's actions, so neither acts blind." |
| 2:05 | At the top of the college page, point at the one-line summary. | "A plain summary built from the data: bureaus involved, open cases, how long the oldest has waited, and the last action." |
| 2:10 | Type a note (e.g. *We've issued a show-cause notice. Please hold your reply.*), **Post note** (guided demo step 5). Then **Show the Regulation Bureau's bell** in the side panel, and click the bell. | "The officers can leave each other short notes, which can't be edited or deleted. The other bureau's bell rings straight away: *Grievance Cell left a note on …*." |
| 2:25 | **Finish tour** → Overview. **Switch user → Administrator**. Bell → **Run check now**. | "It also watches deadlines. This check flags overdue and due-soon cases for each bureau. These time limits are demo settings, not official AICTE timelines." |
| 2:40 | **Escalations**, then **Audit log** | "Long-overdue cases can be escalated, and every decision is logged: who, what, when, and why." |
| 2:50 | **How accurate is matching?** (optional) | "We tested the matching on labelled, made-up data. It's honest about its limits: this is a prototype on synthetic data." |

## Coordination notes (guided demo step 5)

After **Yes, same college**, the match page and the college page show a **Coordination notes** box.
Officers of the two bureaus involved (and the Administrator) can post a short note; nobody else can.
Each note shows the bureau, the officer's name and the time, and is recorded in the audit log.
Notes can't be edited or deleted. Posting a note rings the **other** bureau's bell.
In the guided demo, posting a note moves it to step 5; **Show the Regulation Bureau's bell** signs you in as that
officer so you can open the bell and see the note.

## The 30-second version

1. **Start guided demo → Fill in demo complaint → Register complaint.**
   *"A complaint with a misspelled college name arrives at the Grievance Cell."*
2. Point at the warning banner.
   *"Samanvay immediately finds that the Regulation Bureau opened a case on the same college 8 days ago, and shows why it thinks so."*
3. **Check and confirm → Yes, same college → See the shared timeline.**
   *"An officer confirms, and both bureaus now share one timeline, so nobody acts without knowing what the other has done."*

---

## If something goes wrong

| What happens | Do this | Say |
|---|---|---|
| A **"Signed out"** box appears | Click **Sign in again** and pick **Grievance Cell officer**, then **Register complaint → Fill in demo complaint → Register complaint**. | "Let me sign back in. The complaint wasn't saved, so nothing is lost." |
| No warning banner after registering (a "Saved" box instead) | Open **Needs your check** and click **Check now** on the first match. | "Here's one the system found earlier. It works the same way." |
| The banner shows a different case or several cases | Carry on with the first one. Reset demo data after the demo. | "Earlier rehearsals added a few complaints; the system found those too." |
| The guided-demo side panel is gone | Continue with the buttons on the page: **Check and confirm**, then **Yes, same college**, then **See the shared timeline**. | (Nothing needed.) |
| The page doesn't load at all | In the terminal: `./stop.sh && ./start.sh`, then reload the page. | "Give me ten seconds to restart the demo server." |
| Bell shows no alerts | Press **Run check now** inside the bell. | "In demo mode the deadline check runs when I press this button; normally it runs every few minutes." |

## After the demo

- Reset for the next run: **Administrator → Overview → Reset demo data**, or `./start.sh`.
- Stop everything: `./stop.sh`.
