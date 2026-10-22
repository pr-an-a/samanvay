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
| `data/` | Synthetic data generator — *coming next* |
| `eval/` | Matcher evaluation — *coming next* |

## Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m app.seed                # resets samanvay.db with demo data
uvicorn app.main:app --reload     # API docs: http://localhost:8000/docs
```

If dependency wheels fail to install on your Python version, create the venv with
`python3.12 -m venv .venv` instead.

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
