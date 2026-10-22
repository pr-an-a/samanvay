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
| `frontend/` | React (Vite) + Tailwind + Recharts dashboard — *coming next* |
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
no ID, clean name; 20 hard: no ID, misspelled/abbreviated/initialed name) and 15 decoy pairs
(similar names, different institutions and districts — must not be linked). The overlap list is
exhaustive: background institutions only receive complaints from one bureau, which the generator
asserts. 40 cases are planted as old and unresolved so they breach SLA.

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
python ../eval/evaluate.py            # tune threshold on tune half, report precision/recall/F1 on test half
python ../eval/evaluate.py --show P031 D005   # full score breakdown for given pairs
```

On the synthetic test half the matcher scores precision, recall and F1 of 1.0. Treat that as an
upper bound: the generator keeps the door/plot number and street identical across a true pair,
and the matcher was written knowing which name variations the generator makes. Without the
address signal, tune-half precision drops to 0.90.

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
- `GET /cases?bureau=&status=&region=&institution_id=`, `GET /cases/{id}`
- `GET /cases/{id}/events`, `POST /cases/{id}/events` (append-only history)
- `GET /links?status=`, `POST /links/{id}/confirm`, `POST /links/{id}/reject`
- `GET /institutions`, `GET /sla-rules`

### Design rules
- Cases are never auto-merged; the system only *suggests* links and an officer confirms/rejects.
- Every suggested link stores a per-signal score breakdown.
- Case history (`CaseEvent`) is append-only; link decisions are recorded on both cases.

## Data handling
Even though all data here is synthetic, the design assumes production use would need
encryption at rest and in transit, role-based access controls, and audit logging
(ISO 27001 Annex A), plus GDPR-style data minimisation for complainant details.
