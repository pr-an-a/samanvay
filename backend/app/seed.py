"""Reset the database with a small demo dataset. Run: python -m app.seed

All institutions, people and cases are fictional. SLA days are demo values,
not official AICTE rules.
"""

from datetime import date, timedelta

from .db import Base, SessionLocal, engine
from .models import Case, CaseEvent, CaseLink, Institution, SLARule, User

CATEGORIES = ["fee_refund", "infrastructure", "faculty", "admission", "approval"]

# Demo SLA days per bureau (configurable, not official).
SLA_DAYS = {"RB": 45, "PGRC": 30, "REGIONAL": 21}

USERS = [
    ("Demo RB Officer", "RB_OFFICER", "RB"),
    ("Demo PGRC Officer", "PGRC_OFFICER", "PGRC"),
    ("Demo Regional Officer", "REGIONAL", "REGIONAL"),
    ("Demo Admin", "ADMIN", None),
]

INSTITUTIONS = [
    ("DEMO-1-0001", "Suryakiran Institute of Technology", "Plot 12, Lakeview Road, Navapur", "Navapur", "Western"),
    ("DEMO-1-0002", "Kaveriprabha College of Engineering", "NH-44 Bypass, Tirunagar", "Tirunagar", "Southern"),
    ("DEMO-1-0003", "Himgiri School of Management Studies", "Sector 9, Pinevale", "Pinevale", "Northern"),
    ("DEMO-1-0004", "Brahmaputra Valley Polytechnic", "Riverside Campus, Chandmari Ghat", "Chandmari", "North-Eastern"),
    ("DEMO-1-0005", "Vindhyachal Institute of Pharmacy", "Station Road, Rewapur", "Rewapur", "Central"),
]

# (case_id, bureau, true_inst_idx, id_known, raw_name, raw_address, category, description, days_ago, status, complainant)
CASES = [
    ("RB-2026-0001", "RB", 0, True, "Suryakiran Institute of Technology", "Plot 12, Lakeview Road, Navapur",
     "approval", "Running intake beyond approved capacity in CSE.", 40, "under_process", "Asha Demo"),
    ("PGRC-2026-0001", "PGRC", 0, False, "Surya Kiran Inst. of Tech", "Lakeview Rd, Navapur",
     "fee_refund", "Fee not refunded after withdrawal of admission.", 25, "pending", "Ravi Sample"),
    ("REG-W-2026-0001", "REGIONAL", 0, False, "Suryakiran Instt of Technology", "Lake View Road, Navapur",
     "infrastructure", "Labs lack equipment listed in approval documents.", 12, "pending", "Meena Test"),
    ("PGRC-2026-0002", "PGRC", 1, True, "Kaveriprabha College of Engineering", "NH-44 Bypass, Tirunagar",
     "faculty", "Faculty salaries delayed for three months.", 60, "escalated", "Karthik Demo"),
    ("RB-2026-0002", "RB", 1, False, "Kaveri Prabha College of Engg", "NH 44 bypass, Tirunagar",
     "faculty", "Faculty-student ratio below norms.", 30, "under_process", None),
    ("PGRC-2026-0003", "PGRC", 2, True, "Himgiri School of Management Studies", "Sector 9, Pinevale",
     "admission", "Admission cancelled without notice.", 15, "pending", "Neha Sample"),
    ("REG-NE-2026-0001", "REGIONAL", 3, True, "Brahmaputra Valley Polytechnic", "Riverside Campus, Chandmari Ghat",
     "infrastructure", "Hostel building declared unsafe.", 50, "transferred", "Bikash Test"),
    ("PGRC-2026-0004", "PGRC", 4, True, "Vindhyachal Institute of Pharmacy", "Station Road, Rewapur",
     "fee_refund", "Excess fee collected for practicals.", 90, "disposed", "Pooja Demo"),
    ("RB-2026-0003", "RB", 4, True, "Vindhyachal Institute of Pharmacy", "Station Road, Rewapur",
     "approval", "Extension of approval application incomplete.", 20, "pending", None),
    ("REG-S-2026-0001", "REGIONAL", 1, False, "Kaveriprabha Engineering College", "Tirunagar",
     "admission", "Management quota seats sold above notified fee.", 8, "pending", "Lakshmi Sample"),
]


def run() -> None:
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    today = date.today()

    with SessionLocal() as db:
        db.add_all(User(name=n, role=r, bureau=b) for n, r, b in USERS)
        db.add_all(SLARule(bureau=b, category=c, days=d) for b, d in SLA_DAYS.items() for c in CATEGORIES)

        insts = [Institution(permanent_id=p, name=n, address=a, district=d, region=r)
                 for p, n, a, d, r in INSTITUTIONS]
        db.add_all(insts)
        db.flush()

        cases: dict[str, Case] = {}
        for cid, bureau, idx, id_known, name, addr, cat, desc, ago, status, complainant in CASES:
            # Ground-truth institution gives district/region; its ID is withheld when id_known is False.
            inst = insts[idx]
            received = today - timedelta(days=ago)
            case = Case(
                case_id=cid, source_bureau=bureau, institution_id=inst.id if id_known else None,
                raw_institution_name=name, raw_address=addr, district=inst.district, region=inst.region,
                category=cat, description=desc, received_date=received, status=status,
                assigned_officer=f"Demo {bureau} Officer", last_action="Complaint registered",
                next_action="Seek institution response",
                expected_disposal_date=received + timedelta(days=SLA_DAYS[bureau]),
                complainant_name=complainant,
            )
            db.add(case)
            db.flush()
            db.add(CaseEvent(case_id=case.id, actor="System", bureau=bureau,
                             action="Complaint registered", remarks=None))
            cases[cid] = case

        # One hand-made suggestion so review endpoints work before the matcher exists.
        a, b = sorted((cases["RB-2026-0001"], cases["PGRC-2026-0001"]), key=lambda c: c.id)
        db.add(CaseLink(case_a_id=a.id, case_b_id=b.id, status="suggested", scores={
            "name_similarity": 0.91, "address_similarity": 0.84, "same_district": 1.0,
            "institution_id_match": None, "date_proximity": 0.8, "total": 0.88,
        }))
        db.commit()

    print(f"Seeded {len(USERS)} users, {len(INSTITUTIONS)} institutions, {len(CASES)} cases, 1 suggested link.")


if __name__ == "__main__":
    run()
