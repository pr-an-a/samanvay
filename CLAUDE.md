# Samanvay

Prototype for Smart India Hackathon problem **SIH26264**: an integrated dashboard for
monitoring institution-related complaint cases across AICTE bureaus/cells — Regulation
Bureau (RB), Public Grievance Redressal Cell (PGRC) and Regional Offices.

**Core value:** detect when different bureaus are handling complaints about the same
institution, even when institution names are misspelled or permanent IDs are missing,
and show an explainable **"Potential Overlapping Cases – Coordination Required"** alert
that an officer confirms or rejects.

## Constraints
- 2-night build. Prefer simple and reliable over clever.
- All data is synthetic. Fictional institutions only. No real people, no real institutions.
- No real AICTE integration — no external APIs, no scraping.

## Stack
- Backend: Python FastAPI + SQLite via SQLAlchemy 2.0 (`Mapped[]` style), Pydantic v2.
- Frontend: React (Vite) + Tailwind + Recharts.

## Layout
- `/backend` — FastAPI app (`app/main.py`), models (`app/models.py`), routers (`app/routers/`),
  source adapters (`app/ingest/`), reset + load script (`app/seed.py`).
- `/frontend` — React dashboard.
- `/data` — `generate.py` (fixed seed, stdlib only) writes `data/sources/` (registry + 3 bureau exports).
- `/eval` — `ground_truth.json` (planted overlaps by tier + decoys); matcher evaluation.

Ingestion adapters normalise fields but keep institution name/address verbatim; reconciling
names is the matcher's job. Ground truth overlaps are exhaustive (background institutions get
complaints from one bureau only); keep that invariant if you change the generator.

## Run
```bash
python3 data/generate.py   # only if the generator changed
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed          # resets samanvay.db with demo data
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

## Hard rules
1. **Never auto-merge cases.** The system only creates `CaseLink` rows with status
   `suggested`. Only a human officer action sets `confirmed` / `rejected`, recording
   `reviewed_by` and `reviewed_at`. Cases are never merged or deleted as a result.
2. **Every match shows a score breakdown.** `CaseLink.scores` holds per-signal scores
   (e.g. name similarity, address, district/region, category, date proximity) plus the
   total. The UI must display the breakdown with every alert.
3. **SLA timelines are configurable demo values** stored in `SLARule` — not official
   AICTE rules. Label them as such in the UI and docs.
4. **`CaseEvent` is append-only.** No update or delete endpoints for events.
5. **Privacy:** complainant names are fake; keep PII minimal (no phone/email fields),
   never log complainant names.
6. Auth is demo-grade (token per demo user, no passwords). Do not present it as production auth.
