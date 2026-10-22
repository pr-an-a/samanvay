"""Generate Samanvay's synthetic dataset. Run from the repo root: python data/generate.py

Everything here is fictional: institution names are assembled from invented parts, districts
are made up, permanent IDs use a SYN- prefix, and people's names are random combinations.

Outputs
  data/sources/institutions.csv       master registry (permanent_id -> canonical record)
  data/sources/rb_cases.csv           Regulation Bureau export (dd-mm-yyyy, ID mostly filled)
  data/sources/pgrc_grievances.json   PGRC portal export (ISO datetimes, "college_name", ID often missing)
  data/sources/regional_cases.csv     Regional Offices export (own column names and codes, abbreviations)
  data/sources/meta.json              seed, reference date, counts
  eval/ground_truth.json              planted overlap pairs (easy/medium/hard) and decoy pairs

Eval invariant: the planted overlaps are the *only* cross-bureau pairs that concern the same
institution. Background institutions receive complaints from a single bureau, and planted/decoy
institutions get no background cases. This is asserted at the end of generation.
"""

import csv
import json
import random
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from itertools import combinations, cycle
from pathlib import Path

SEED = 42
# "Today" for the generated data. The backend loader shifts all dates so this maps to the real today.
REF_DATE = date(2026, 10, 20)

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "sources"
GROUND_TRUTH = ROOT / "eval" / "ground_truth.json"

N_INSTITUTIONS = 150
N_CASES = 500
TIERS = {"easy": 15, "medium": 15, "hard": 20}
N_DECOYS = 15
N_SLA_BREACH = 40

rng = random.Random(SEED)

# Canonical region -> (Regional Office code, fictional districts)
REGIONS = {
    "Northern": ("NRO", ["Kesarganj", "Amravan", "Sitapuri", "Haridwal"]),
    "North-Western": ("NWRO", ["Sutlejpur", "Ranikhetri", "Dhauladhar", "Panchnad"]),
    "Western": ("WRO", ["Sagarwadi", "Konkanvadi", "Sahyadripur", "Mahimgaon"]),
    "Central": ("CRO", ["Rewapur", "Vindhyanagar", "Malwagarh", "Betwapur"]),
    "Eastern": ("ERO", ["Damodarpur", "Subarnagram", "Kansaiganj", "Teestapara"]),
    "South-Eastern": ("SERO", ["Krishnapalli", "Godavaripet", "Nallamalapuram", "Sileruvaram"]),
    "Southern": ("SRO", ["Tirunagar", "Kaverikulam", "Vaigaipuram", "Palarkottai"]),
    "South-Western": ("SWRO", ["Tungapura", "Malnadahalli", "Sharavathinagar", "Kodagiri"]),
}

HONORIFICS = ["Sri", "Shri", "Smt.", "Dr.", "", "", "", ""]
HON_SWAP = {"Sri": "Shri", "Shri": "Sri", "Smt.": "Shrimati", "Dr.": "", "": "Sri"}
ROOTS = [
    "Venkata", "Lakshmi", "Saraswati", "Narayana", "Godavari", "Kaveri", "Surya", "Chandra",
    "Megha", "Udaya", "Prerana", "Vasundhara", "Sahyadri", "Malwa", "Aravali",
    "Nilgiri", "Vindhya", "Himgiri", "Tapti", "Narmada", "Amrit", "Siddhi", "Gyandeep", "Vidyadhar",
    "Pragati", "Shanti", "Kesar", "Devika", "Rohini", "Anand", "Mahima", "Tejas", "Ojas",
    "Akshara", "Kirti", "Sumati", "Bhaskara", "Kamala", "Ramana", "Padmavati",
]
ENGG_KINDS = [
    "Institute of Technology", "College of Engineering", "Engineering College",
    "Institute of Engineering and Technology", "Institute of Information Technology",
    "Memorial College of Engineering", "Institute of Technology and Management",
]
MGMT_KINDS = ["Institute of Management Studies", "School of Management", "Business School"]
KINDS = ENGG_KINDS + MGMT_KINDS
ABBREV = {
    "Institute": "Inst", "Technology": "Tech", "Engineering": "Engg", "College": "Coll",
    "Management": "Mgmt", "Information": "Info", "Studies": "Studs", "School": "Sch",
    "Memorial": "Meml", "Business": "Bus", "and": "&",
}
STREETS = ["Station Road", "Lakeview Road", "Temple Street", "College Road", "Ring Road",
           "Market Street", "Canal Road", "Hill View Road"]

BUREAUS = ["RB", "PGRC", "REGIONAL"]
CATEGORIES = ["fee_refund", "faculty_shortage", "infrastructure", "admission_irregularity",
              "certificate_withholding", "ragging_admin", "other"]
STATUSES = ["pending", "under_process", "transferred", "escalated", "disposed"]

# Each source system labels categories and statuses its own way.
RB_CATEGORY = {"fee_refund": "Fee Refund", "faculty_shortage": "Faculty Shortage",
               "infrastructure": "Infrastructure Deficiency", "admission_irregularity": "Admission Irregularity",
               "certificate_withholding": "Withholding of Certificates",
               "ragging_admin": "Ragging - Administrative Lapse", "other": "Others"}
PGRC_CATEGORY = {"fee_refund": "Refund of fees", "faculty_shortage": "Faculty related",
                 "infrastructure": "Infrastructure / facilities", "admission_irregularity": "Admission related",
                 "certificate_withholding": "Original certificates not returned",
                 "ragging_admin": "Ragging (administrative action)", "other": "Miscellaneous"}
REG_CATEGORY = {"fee_refund": "FEE", "faculty_shortage": "FAC", "infrastructure": "INFRA",
                "admission_irregularity": "ADM", "certificate_withholding": "CERT",
                "ragging_admin": "RAG", "other": "OTH"}
RB_STATUS = {"pending": "Pending", "under_process": "Under Process", "transferred": "Transferred",
             "escalated": "Escalated", "disposed": "Disposed"}
PGRC_STATUS = {"pending": "Open", "under_process": "In Progress", "transferred": "Forwarded",
               "escalated": "Escalated", "disposed": "Closed"}
REG_STATUS = {"pending": "PEND", "under_process": "UP", "transferred": "TRF",
              "escalated": "ESC", "disposed": "DISP"}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

DESCRIPTIONS = {
    "fee_refund": [
        "Fee of Rs {amt} not refunded after withdrawal from {course} within the cancellation window.",
        "Institution demanding Rs {amt} over the approved fee structure for {course}.",
        "Caution deposit not returned {m} months after course completion.",
        "Tuition fee refund pending despite seat being cancelled before classes began.",
    ],
    "faculty_shortage": [
        "Faculty-student ratio in {course} well below norms; several subjects without regular faculty.",
        "No permanent faculty for {course}; classes taken only by visiting staff.",
        "Faculty salaries delayed for {m} months, staff leaving mid-semester.",
        "Faculty list submitted for approval does not match staff actually teaching {course}.",
    ],
    "infrastructure": [
        "Laboratories for {course} lack equipment listed in approval documents.",
        "Hostel in poor condition; repeated complaints about water and electricity ignored.",
        "Library has outdated books and no digital access as claimed in disclosure.",
        "Classrooms insufficient for sanctioned intake; students seated in temporary sheds.",
    ],
    "admission_irregularity": [
        "Admissions in {course} reportedly exceed sanctioned intake.",
        "Management quota seats allotted without publishing a merit list.",
        "Admission cancelled without notice after fee payment for {course}.",
        "Students admitted to {course} without meeting eligibility criteria.",
    ],
    "certificate_withholding": [
        "Original {cert} certificates withheld; institution demanding fee for full course duration.",
        "Institution refusing to return original documents after withdrawal from {course}.",
        "Transfer certificate not issued for {m} months.",
        "Degree and provisional certificates withheld over disputed dues of Rs {amt}.",
    ],
    "ragging_admin": [
        "Anti-ragging committee not constituted; administration inactive on complaints.",
        "Ragging incident reported to institution but no administrative action taken.",
        "Anti-ragging undertakings not collected and helpline details not displayed.",
        "Institutional inquiry into a reported ragging complaint delayed for {m} months.",
    ],
    "other": [
        "Mandatory disclosure on institution website not updated for the current year.",
        "Institute-level grievance redressal committee not functional.",
        "Students charged for industrial visits that never took place.",
        "Scholarship disbursement delayed by institution administration.",
    ],
}
ENGG_COURSES = ["B.Tech CSE", "B.Tech ECE", "B.Tech Mechanical", "B.Tech Civil", "B.Tech AI&DS", "M.Tech", "MCA"]
MGMT_COURSES = ["MBA", "PGDM", "MBA (Finance)", "PGDM (Marketing)"]
CERTS = ["10th and 12th", "UG degree", "migration and 12th"]

OFFICERS = {"RB": ["A. Rao", "S. Menon", "P. Kulkarni", "R. Bhatt"],
            "PGRC": ["K. Das", "M. Iyer", "N. Verma"],
            "REGIONAL": ["T. Singh", "L. Nair", "V. Patil", "D. Ghosh", "H. Reddy"]}
FIRST_NAMES = ["Aarav", "Diya", "Rohan", "Ananya", "Karthik", "Meera", "Imran", "Sneha", "Vikram",
               "Priya", "Arjun", "Fatima", "Rahul", "Kavya", "Siddharth", "Nisha", "Manoj", "Pooja",
               "Harpreet", "Lakshmi", "Abhishek", "Ritu", "Suresh", "Neha", "Joseph", "Tanvi"]
LAST_NAMES = ["Sharma", "Reddy", "Nair", "Patel", "Das", "Singh", "Iyer", "Khan", "Mehta", "Gupta",
              "Rao", "Banerjee", "Kulkarni", "Joshi", "Pillai", "Verma", "Hegde", "Mishra", "Thomas"]
OPEN_ACTIONS = {
    "pending": (["Complaint registered"], ["Scrutiny of complaint"]),
    "under_process": (["Notice issued to institution", "Reply sought from institution",
                       "Institution reply received"],
                      ["Examine institution reply", "Schedule hearing", "Site verification"]),
    "escalated": (["Escalated to senior officer"], ["Decision by senior officer"]),
    "disposed": (["Disposed: grievance resolved", "Disposed: institution complied",
                  "Closed: no merit found"], [""]),
}

institutions: list[dict] = []
used_names: set[str] = set()


# ---------- institutions ----------

def render(hon: str, roots: list[str], kind: str) -> str:
    return " ".join(p for p in [hon, *roots, kind] if p)


def make_address(district: str) -> str:
    prefix = rng.choice(["Plot No.", "Survey No.", "Door No."])
    street = rng.choice(STREETS + [f"NH-{rng.randint(10, 99)} Bypass"])
    return f"{prefix} {rng.randint(1, 450)}, {street}, {district} - {rng.randint(100000, 999999)}"


def new_institution(region=None, district=None, hon=None, roots=None, kind=None, allow_dup=False) -> dict:
    region = region or rng.choice(list(REGIONS))
    district = district or rng.choice(REGIONS[region][1])
    while True:
        h = rng.choice(HONORIFICS) if hon is None else hon
        # Two invented roots per name keeps combinations clearly fictional.
        r = roots or rng.sample(ROOTS, 2)
        k = kind or rng.choice(KINDS)
        name = render(h, r, k)
        if allow_dup or name not in used_names:
            break
        if hon is not None and roots and kind:
            raise ValueError(f"duplicate fixed name {name}")
    used_names.add(name)
    inst = {"permanent_id": None, "hon": h, "roots": list(r), "kind": k, "name": name,
            "address": make_address(district), "district": district, "region": region}
    institutions.append(inst)
    return inst


# ---------- name / address variations ----------

def abbreviate(text: str, dots: bool) -> str:
    return " ".join(ABBREV[w] + ("." if dots and w != "and" else "") if w in ABBREV else w
                    for w in text.split())


def typo(word: str) -> str:
    i = rng.randrange(1, len(word) - 1)
    match rng.choice(["swap", "drop", "double", "vowel"]):
        case "swap":
            return word[:i] + word[i + 1] + word[i] + word[i + 2:]
        case "drop":
            return word[:i] + word[i + 1:]
        case "double":
            return word[:i] + word[i] + word[i:]
        case _:
            for a, b in (("ee", "i"), ("i", "ee"), ("a", "e"), ("v", "w"), ("sh", "s")):
                if a in word[1:]:
                    j = word.index(a, 1)
                    return word[:j] + b + word[j + len(a):]
            return word[:i] + word[i + 1:]


def vary(inst: dict, ops: list[str]) -> str:
    """Apply name variations: abbrev, typo, honorific, merge, initials."""
    hon, roots, kind = inst["hon"], list(inst["roots"]), inst["kind"]
    for op in ops:
        if op == "abbrev":
            kind = abbreviate(kind, dots=rng.random() < 0.5)
        elif op == "typo":
            i = rng.randrange(len(roots))
            roots[i] = typo(roots[i])
        elif op == "honorific":
            hon = HON_SWAP[hon]
        elif op == "merge":
            roots = [roots[0] + "".join(r.lower() for r in roots[1:])]
    if "initials" in ops:
        parts = [p for p in [hon, *roots] if p]
        return ".".join(p[0].upper() for p in parts) + ". " + kind
    return render(hon, roots, kind)


def vary_address(address: str) -> str:
    out = address.replace("Road", "Rd").replace("Street", "St").replace("No. ", "")
    if rng.random() < 0.5:
        out = out.rsplit(" - ", 1)[0]
    return out


def default_name(inst: dict, bureau: str) -> str:
    """Background noise each source system introduces on its own."""
    roll = rng.random()
    if bureau == "RB" and roll < 0.1:
        return vary(inst, ["honorific"])
    if bureau == "PGRC" and roll < 0.25:
        return vary(inst, [rng.choice(["abbrev", "honorific"])])
    if bureau == "REGIONAL" and roll < 0.4:
        return vary(inst, ["abbrev"])
    return inst["name"]


# ---------- cases ----------

cases: list[dict] = []


def open_status() -> str:
    return rng.choices(["pending", "under_process", "escalated", "transferred"], [4, 4, 1, 1])[0]


def actions(status: str, bureau: str) -> tuple[str, str]:
    if status == "transferred":
        other = rng.choice([b for b in BUREAUS if b != bureau])
        return f"Transferred to {other}", "Await action by receiving office"
    last, nxt = OPEN_ACTIONS[status]
    return rng.choice(last), rng.choice(nxt)


def describe(inst: dict, category: str) -> str:
    courses = MGMT_COURSES if inst["kind"] in MGMT_KINDS else ENGG_COURSES
    return rng.choice(DESCRIPTIONS[category]).format(
        amt=f"{rng.randrange(15, 250) * 1000:,}", course=rng.choice(courses),
        m=rng.randint(2, 8), cert=rng.choice(CERTS))


def make_case(inst, bureau, *, age, status, category=None, has_pid=True, name=None,
              address=None, district=True) -> dict:
    category = category or rng.choice(CATEGORIES)
    last, nxt = actions(status, bureau)
    case = {
        "bureau": bureau, "inst": inst, "has_pid": has_pid,
        "name": name or default_name(inst, bureau),
        "address": address or inst["address"],
        "district": inst["district"] if district else None,
        "region": inst["region"], "category": category,
        "description": describe(inst, category),
        "received": REF_DATE - timedelta(days=age), "status": status,
        "officer": rng.choice(OFFICERS[bureau]), "last_action": last, "next_action": nxt,
        "complainant": None if rng.random() < 0.1 else f"{rng.choice(FIRST_NAMES)} {rng.choice(LAST_NAMES)}",
        "case_id": None,
    }
    cases.append(case)
    return case


def pair_ages() -> tuple[int, int]:
    a = rng.randint(2, 25)
    return a, max(0, a + rng.randint(-12, 12))


def pair_categories() -> tuple[str, str]:
    a = rng.choice(CATEGORIES)
    return a, a if rng.random() < 0.6 else rng.choice(CATEGORIES)


def build() -> tuple[list, list, list]:
    bureau_pairs = cycle([("RB", "PGRC"), ("RB", "REGIONAL"), ("PGRC", "REGIONAL"),
                          ("PGRC", "RB"), ("REGIONAL", "RB"), ("REGIONAL", "PGRC")])

    # Planted overlaps: same institution, two different bureaus.
    overlaps = []
    for tier, n in TIERS.items():
        for _ in range(n):
            inst = new_institution()
            (b1, b2), (age1, age2), (cat1, cat2) = next(bureau_pairs), pair_ages(), pair_categories()
            info = {"tier": tier, "institution": inst, "variations": {}}
            if tier == "easy":
                kw1, kw2 = {}, {}
            elif tier == "medium":
                # No usable ID: the non-RB side always lacks it (both sides if RB isn't involved).
                kw1 = {"has_pid": b1 == "RB", "name": inst["name"]}
                kw2 = {"has_pid": b2 == "RB", "name": inst["name"]}
            else:
                ops_a = rng.sample(["abbrev", "typo", "honorific", "merge"], rng.choice([1, 2]))
                ops_b = ["initials"] + (["abbrev"] if rng.random() < 0.5 else [])
                if rng.random() < 0.5:
                    ops_a, ops_b = ops_b, ops_a
                name_a, name_b = vary(inst, ops_a), vary(inst, ops_b)
                while name_a in (name_b, inst["name"]):
                    name_a = vary(inst, ops_a + ["typo"])
                kw1 = {"has_pid": False, "name": name_a, "address": vary_address(inst["address"])}
                kw2 = {"has_pid": False, "name": name_b, "district": rng.random() > 0.25}
                info["variations"] = {"a": ops_a, "b": ops_b}
            c1 = make_case(inst, b1, age=age1, status=open_status(), category=cat1, **kw1)
            c2 = make_case(inst, b2, age=age2, status=open_status(), category=cat2, **kw2)
            overlaps.append((info, c1, c2))

    # Decoys: different institutions with similar names in different districts.
    decoys = []
    variants = cycle(["same_name", "different_kind", "extra_root", "honorific"])
    for _ in range(N_DECOYS):
        a = new_institution()
        variant = next(variants)
        region = a["region"] if rng.random() < 0.5 else rng.choice([r for r in REGIONS if r != a["region"]])
        district = rng.choice([d for d in REGIONS[region][1] if d != a["district"]])
        hon, roots, kind = a["hon"], list(a["roots"]), a["kind"]
        if variant == "different_kind":
            kind = rng.choice([k for k in KINDS if k != kind])
        elif variant == "extra_root":
            roots = roots + [rng.choice([r for r in ROOTS if r not in roots])]
        elif variant == "honorific":
            hon = "" if hon else "Sri"
        b = new_institution(region, district, hon, roots, kind, allow_dup=variant == "same_name")
        (b1, b2), (age1, age2), (cat1, cat2) = next(bureau_pairs), pair_ages(), pair_categories()
        c1 = make_case(a, b1, age=age1, status=open_status(), category=cat1,
                       has_pid=b1 == "RB", name=a["name"])
        c2 = make_case(b, b2, age=age2, status=open_status(), category=cat2,
                       has_pid=b2 == "RB", name=b["name"])
        decoys.append(({"variant": variant, "a": a, "b": b}, c1, c2))

    # Background: each institution complains to exactly one "home" bureau.
    background = [new_institution() for _ in range(N_INSTITUTIONS - len(institutions))]
    home = {id(i): rng.choices(BUREAUS, weights=[40, 35, 25])[0] for i in background}
    pid_rate = {"RB": 0.92, "PGRC": 0.35, "REGIONAL": 0.5}
    breaches = []
    for n in range(N_CASES - len(cases)):
        inst = rng.choice(background)
        bureau = home[id(inst)]
        if n < N_SLA_BREACH:
            age, status = rng.randint(120, 300), rng.choice(["pending", "under_process", "escalated"])
        else:
            age = int(rng.triangular(0, 365, 0))  # skewed toward recent complaints
            status = (rng.choices(["disposed", "transferred"], [9, 1])[0] if age > 30
                      else rng.choices(STATUSES, [3, 4, 1, 1, 2])[0])
        c = make_case(inst, bureau, age=age, status=status, has_pid=rng.random() < pid_rate[bureau],
                      district=bureau != "PGRC" or rng.random() > 0.1)
        if n < N_SLA_BREACH:
            breaches.append(c)

    return overlaps, decoys, breaches


def assign_ids() -> None:
    order = list(institutions)
    rng.shuffle(order)
    for n, inst in enumerate(order):
        inst["permanent_id"] = f"SYN-{100001 + n}"

    counters: dict[tuple, int] = defaultdict(int)
    for c in sorted(cases, key=lambda c: (c["received"], rng.random())):
        y = c["received"].year
        if c["bureau"] == "RB":
            key = ("RB", y)
            counters[key] += 1
            c["case_id"] = f"RB/{y}/{counters[key]:04d}"
        elif c["bureau"] == "PGRC":
            key = ("PG", y)
            counters[key] += 1
            c["case_id"] = f"PG-{y}-{counters[key]:05d}"
        else:
            code = REGIONS[c["region"]][0]
            key = (code, y)
            counters[key] += 1
            c["case_id"] = f"{code}/{y}/{counters[key]:03d}"


# ---------- writers ----------

def pid(c: dict) -> str:
    return c["inst"]["permanent_id"] if c["has_pid"] else ""


def write_outputs(overlaps, decoys, breaches) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    by_bureau = defaultdict(list)
    for c in sorted(cases, key=lambda c: c["case_id"]):
        by_bureau[c["bureau"]].append(c)

    with open(OUT / "institutions.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["permanent_id", "name", "address", "district", "region"])
        for i in sorted(institutions, key=lambda i: i["permanent_id"]):
            w.writerow([i["permanent_id"], i["name"], i["address"], i["district"], i["region"]])

    with open(OUT / "rb_cases.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["case_no", "permanent_id", "institution_name", "address", "district", "region",
                    "category", "description", "received_on", "status", "officer", "last_action",
                    "next_action", "complainant"])
        for c in by_bureau["RB"]:
            w.writerow([c["case_id"], pid(c), c["name"], c["address"], c["district"] or "", c["region"],
                        RB_CATEGORY[c["category"]], c["description"], c["received"].strftime("%d-%m-%Y"),
                        RB_STATUS[c["status"]], c["officer"], c["last_action"], c["next_action"],
                        c["complainant"] or ""])

    grievances = []
    for c in by_bureau["PGRC"]:
        submitted = datetime.combine(c["received"], time(rng.randint(9, 18), rng.choice([0, 15, 30, 45])))
        grievances.append({
            "registration_no": c["case_id"],
            "aicte_id": pid(c) or (None if rng.random() < 0.8 else ""),
            "college_name": c["name"], "college_address": c["address"],
            "district": c["district"], "zone": f"{c['region']} Zone",
            "grievance_type": PGRC_CATEGORY[c["category"]], "grievance_text": c["description"],
            "submitted_at": submitted.isoformat(), "current_status": PGRC_STATUS[c["status"]],
            "handled_by": c["officer"], "action_taken": c["last_action"],
            "next_step": c["next_action"] or None, "grievant_name": c["complainant"],
        })
    with open(OUT / "pgrc_grievances.json", "w") as f:
        json.dump({"source": "PGRC grievance portal export", "exported_on": REF_DATE.isoformat(),
                   "grievances": grievances}, f, indent=2)

    with open(OUT / "regional_cases.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["RO_REF", "INST_ID", "INST_NAME", "ADDR", "DIST", "RO", "CAT", "SUMMARY",
                    "RECD_DT", "STATUS", "DEALING_OFFR", "LAST_ACTN", "NEXT_ACTN", "CMPLT_NAME"])
        for c in by_bureau["REGIONAL"]:
            d = c["received"]
            w.writerow([c["case_id"], pid(c), c["name"], c["address"], (c["district"] or "").upper(),
                        REGIONS[c["region"]][0], REG_CATEGORY[c["category"]], c["description"],
                        f"{d.day:02d}-{MONTHS[d.month - 1]}-{d.year}", REG_STATUS[c["status"]],
                        c["officer"], c["last_action"], c["next_action"], c["complainant"] or ""])

    ground_truth = {
        "seed": SEED, "ref_date": REF_DATE.isoformat(),
        "note": ("overlaps are exhaustive: every cross-bureau pair of cases about the same institution "
                 "is listed. decoys are pairs that must NOT be linked."),
        "overlaps": [{
            "pair_id": f"P{n:03d}", "tier": info["tier"],
            "case_a": c1["case_id"], "case_b": c2["case_id"],
            "institution_permanent_id": info["institution"]["permanent_id"],
            "canonical_name": info["institution"]["name"],
            "name_a": c1["name"], "name_b": c2["name"], "variations": info["variations"],
        } for n, (info, c1, c2) in enumerate(overlaps, 1)],
        "decoys": [{
            "pair_id": f"D{n:03d}", "variant": info["variant"],
            "case_a": c1["case_id"], "case_b": c2["case_id"],
            "institution_a": info["a"]["permanent_id"], "institution_b": info["b"]["permanent_id"],
            "name_a": c1["name"], "name_b": c2["name"],
            "district_a": info["a"]["district"], "district_b": info["b"]["district"],
        } for n, (info, c1, c2) in enumerate(decoys, 1)],
        "sla_breach_planted": sorted(c["case_id"] for c in breaches),
    }
    GROUND_TRUTH.parent.mkdir(parents=True, exist_ok=True)
    GROUND_TRUTH.write_text(json.dumps(ground_truth, indent=2))

    meta = {"seed": SEED, "ref_date": REF_DATE.isoformat(), "institutions": len(institutions),
            "cases": {b: len(by_bureau[b]) for b in BUREAUS}, "total_cases": len(cases),
            "overlaps": len(overlaps), "decoys": len(decoys)}
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta))


def check_invariant(overlaps) -> None:
    by_inst = defaultdict(list)
    for c in cases:
        by_inst[c["inst"]["permanent_id"]].append(c)
    actual = {frozenset((a["case_id"], b["case_id"]))
              for group in by_inst.values() for a, b in combinations(group, 2) if a["bureau"] != b["bureau"]}
    planted = {frozenset((c1["case_id"], c2["case_id"])) for _, c1, c2 in overlaps}
    assert actual == planted, f"ground truth not exhaustive: {len(actual)} actual vs {len(planted)} planted"
    assert len(institutions) == N_INSTITUTIONS and len(cases) == N_CASES


if __name__ == "__main__":
    overlaps, decoys, breaches = build()
    assign_ids()
    check_invariant(overlaps)
    write_outputs(overlaps, decoys, breaches)
