# Samanvay

Prototype for Smart India Hackathon **SIH26264**: an integrated dashboard for monitoring
institution-related complaint cases across AICTE bureaus/cells (Regulation Bureau,
Public Grievance Redressal Cell, Regional Offices). It flags **Potential Overlapping
Cases – Coordination Required** when different bureaus handle complaints about the same
institution, with a score breakdown, for an officer to confirm or reject.

> **Disclaimer:** All data is synthetic and all institutions/people are fictional.
> SLA timelines are configurable demo values, not official AICTE rules.
> This project is not affiliated with or integrated into any AICTE system.

## Layout
| Folder | Purpose |
|---|---|
| `backend/` | FastAPI + SQLite (SQLAlchemy) API |
| `frontend/` | React (Vite) + Tailwind + Recharts dashboard |
| `data/` | Synthetic data generator (`generate.py`) and its output (`sources/`) |
| `eval/` | `ground_truth.json` (planted overlaps + decoys); matcher evaluation — *coming next* |

## Synthetic data

```bash
python3 data/generate.py          # fixed seed: same output every run
```

Writes a 150-institution registry and ~500 complaints split across three differently-shaped exports:

| File | Format quirks |
|---|---|
| `data/sources/rb_cases.csv` | `dd-mm-yyyy`, permanent_id mostly filled |
| `data/sources/pgrc_grievances.json` | ISO datetimes, `college_name`, `aicte_id` often null |
| `data/sources/regional_cases.csv` | Terse column names, RO/category/status codes, `dd-Mon-yyyy`, abbreviated names |

`eval/ground_truth.json` lists 50 planted cross-bureau overlaps (15 easy: shared ID; 15 medium:
no ID, clean name; 20 hard: no ID, misspelled/abbreviated/initialed name) and 25 decoy pairs that
must NOT be linked, all in the same region as their partner so the matcher really scores them:
15 similar-name institutions in another district, and 10 neighbouring campuses sharing a street
and pincode. Half the true pairs have address differences (street wording, missing door/plot
number, pincode on one side only); 5 hard pairs have no address on one side. The overlap list is
exhaustive: background institutions only receive complaints from one bureau, which the generator
asserts. 40 cases are planted as old and unresolved so they breach SLA.

A second dataset for unseen-data evaluation (never used for tuning):

```bash
python3 data/generate.py --seed 43 --out data/sources_seed43 --truth eval/ground_truth_seed43.json
```

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed                # resets samanvay.db: demo users, demo SLA rules, all three exports
uvicorn app.main:app --reload     # API docs: http://localhost:8000/docs
```

`app/ingest/` holds one adapter per export (field mapping, dates, codes) feeding a common
`NormalizedCase`; institution names and addresses are kept verbatim for the matcher. The loader
shifts dates so the generator's reference date becomes today (`--no-shift` to disable), keeping
the SLA picture stable whatever day you demo.

If dependency wheels fail to install on your Python version, create the venv with
`python3.12 -m venv .venv` instead.

## Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173  (needs the backend on :8000; /api is proxied to it)
```

Use `npm run dev` or `./node_modules/.bin/vite`, not a bare `npx vite`. If the project's Vite
isn't installed, `npx` fetches a different major version that ignores `vite.config.js`, so the
`/api` proxy stops working.

Screens: sign-in (demo users and a **guided demo**), overview (the hero list "Colleges needing
coordination", then 4 key numbers, then small charts), needs your check, register complaint, all
cases (search, filters, CSV download), case detail, college profile (one shared timeline across
bureaus), the "Is this the same college?" check screen, and "How accurate is matching?".

Design: navy top bar, white cards on light grey, one blue accent, Inter (bundled, works offline),
two font weights. Plain language throughout: bureau full names, "match strength", "needs your
check". Codes and "overlap" wording from the API are translated in `src/labels.js`.

**Guided demo:** on the sign-in page click **Start guided demo**. A side panel walks through four
steps: a complaint arrives, Samanvay finds the other bureau's case, the officer confirms, and both
bureaus share one timeline. Reseed (`python -m app.seed`) to run it again from scratch.

Rebuild the accuracy page data after matcher changes: `python ../eval/build_results.py` (from `backend/`).

### Overlap matcher
`app/matcher.py` suggests links between cases from different bureaus (at least one open),
blocked by region. Dates are never used.

1. **Permanent ID**: same ID means same institution; different IDs are never linked.
2. **Entity resolution** when an ID is missing: normalised name (abbreviations expanded, merged
   words handled), initials vs name words, institution type, honorific, address (door/plot no.,
   street, pincode), district and region. Weighted mean over the signals that are present;
   missing fields are not penalised.
3. **Issue similarity** (TF-IDF on descriptions + category) labels a suggested link
   "same issue" / "different issue". It never decides whether two cases are the same institution.

Every link stores a per-signal score breakdown and human-readable reasons. All weights and
thresholds are in `app/matcher_config.json`. `match_case(db, case)` matches a single new case.

```bash
python ../eval/evaluate.py                  # tune threshold on tune half, report test half
python ../eval/evaluate.py --save           # ...and write the tuned threshold to the config
python ../eval/evaluate.py --fixed          # no tuning, use the config threshold
python ../eval/evaluate.py --half tune      # print error details for the tune half (diagnose here, not on test)
python ../eval/evaluate.py --show P031 D005 # full score breakdown for given pairs

# unseen data (seed 43), separate DB, no retuning:
SAMANVAY_DB=sqlite:///./unseen43.db python -m app.seed --data-dir ../data/sources_seed43
SAMANVAY_DB=sqlite:///./unseen43.db python ../eval/evaluate.py --truth ../eval/ground_truth_seed43.json --all
```

Current results (threshold 0.78): precision, recall and F1 of 1.0 on the seed-42 test half and on
the unseen seed-43 dataset. The lowest-scoring true match is 0.875 and the highest-scoring
non-match 0.671. Read these as an upper bound. Seed 43 comes from the same generator, so it has
new samples but no new *kinds* of variation, and the matcher was written knowing which
variations the generator produces. Real data will score lower.

### Demo login
Auth is demo-grade: pick a demo user, receive a bearer token. No passwords. **Not production auth.**

```bash
curl localhost:8000/auth/demo-users
TOKEN=$(curl -s -X POST localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"user_id": 2}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
curl localhost:8000/cases -H "Authorization: Bearer $TOKEN"
curl localhost:8000/links?status=suggested -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:8000/links/1/confirm -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"remarks": "Same institution, coordinate with RB"}'
```

Demo users: 1 RB Officer, 2 PGRC Officer, 3 Regional Officer, 4 Admin.

### Endpoints
- `GET /health`
- `GET /auth/demo-users`, `POST /auth/login`, `GET /auth/me`
- `GET /cases` — filters: `q` (institution name / permanent ID / case ID), `institution`, `permanent_id`,
  `case_id`, `bureau`, `region`, `category`, `status`, `received_from`, `received_to`, `institution_id`, `overdue`
- `POST /cases` — new complaint; runs the matcher immediately and returns the case plus any
  "Potential Overlapping Cases – Coordination Required" alerts with score breakdowns
- `GET /cases/{id}`, `GET /cases/{id}/events`, `POST /cases/{id}/events` (append-only history)
- `GET /alerts/overlaps?bureau=&region=` — suggested links awaiting review, newest first
- `GET /links?status=`, `POST /links/{id}/confirm`, `POST /links/{id}/reject`
- `GET /institutions`, `GET /institutions/{id}` — details, chronological timeline across bureaus,
  links. Cases join the timeline through the permanent ID or an officer-*confirmed* link, never a suggested one.
- `GET /dashboard/stats` — status totals, bureau workload, ageing of open cases (0-15/16-30/31-60/60+ days),
  overdue vs SLA, overlap counts, region counts
- `GET /reports/cases.csv` — CSV export, same filters as `GET /cases`
- `GET /sla-rules`

**Privacy:** complainant names are masked ("R*** K***") on cases from another bureau, in the
API, alerts and CSV export alike. ADMIN sees full names.

### Demo: new complaint raises an overlap alert
`data/demo_complaint.json` is a PGRC complaint with a misspelled name and no permanent ID. It
matches the open RB case RB/2026/0150 (last action: reply sought from institution). Seed first so
the case exists:

```bash
TOKEN=$(curl -s -X POST localhost:8000/auth/login -H 'Content-Type: application/json' \
  -d '{"user_id": 2}' | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
curl -X POST localhost:8000/cases -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d @../data/demo_complaint.json
```

### Tests
```bash
python -m pytest -q    # uses a temporary database; the demo DB is untouched
```

### Design rules
- Cases are never auto-merged; the system only *suggests* links and an officer confirms/rejects.
- Every suggested link stores a per-signal score breakdown.
- Case history (`CaseEvent`) is append-only; link decisions are recorded on both cases.

## Data handling
Even though all data here is synthetic, the design assumes production use would need
encryption at rest and in transit, role-based access controls, and audit logging
(ISO 27001 Annex A), plus GDPR-style data minimisation for complainant details.
