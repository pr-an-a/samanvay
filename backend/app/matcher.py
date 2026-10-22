"""Explainable 3-tier overlap matcher.

Tier 1  same permanent_id -> same institution. Different permanent_ids -> never linked.
Tier 2  entity resolution when an ID is missing: normalised name, initials, institution type,
        honorific, address parts, district, region. Weighted mean over available signals.
Tier 3  issue similarity (TF-IDF on descriptions + category). Only labels a link as
        same/different issue; it never decides whether two cases are the same institution.

Only cross-bureau pairs with at least one open case are considered, blocked by region.
Dates are never used. The matcher only *suggests* links; an officer confirms or rejects.
"""

import json
import re
from dataclasses import dataclass
from difflib import SequenceMatcher
from itertools import combinations
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .audit import notify_link
from .models import Case, CaseLink, CaseStatus

CONFIG_PATH = Path(__file__).with_name("matcher_config.json")
CONFIG = json.loads(CONFIG_PATH.read_text())

ABBREVIATIONS = {"inst": "institute", "instt": "institute", "engg": "engineering", "engr": "engineering",
                 "tech": "technology", "mgmt": "management", "coll": "college", "meml": "memorial",
                 "studs": "studies", "info": "information", "sch": "school", "bus": "business"}
HONORIFICS = {"sri": "sri", "shri": "sri", "smt": "smt", "shrimati": "smt", "dr": "dr"}
TYPE_WORDS = {"institute", "college", "school", "engineering", "technology", "information",
              "management", "studies", "business", "memorial"}
FILLER_WORDS = {"of", "and", "the"}
# Common Indian address abbreviations; "national highway 96" / "nh96" -> "nh 96".
STREET_ABBREVIATIONS = {"rd": "road", "st": "street", "str": "street", "strt": "street", "stn": "station",
                        "mkt": "market", "clg": "college", "coll": "college", "marg": "road", "ngr": "nagar"}
NUMBER_SEGMENT_RE = re.compile(r"^(?:(plot|door|survey|h)\b\D*)?(?:no\.?\s*)?(\d+[a-z]?)$")
INITIALS_RE = re.compile(r"^(?:[a-z]\.){2,}[a-z]?\.?$")  # "s.a.m." / "s.a.m"
PINCODE_RE = re.compile(r"\b(\d{6})\b")


def is_open(case: Case) -> bool:
    return case.status != CaseStatus.disposed.value


# ---------- per-case profile ----------

@dataclass
class Profile:
    case: Case
    honorific: str | None
    core: list[str]                 # distinguishing name words, in order
    initials: str | None            # letters, when the name is written as initials
    type_words: frozenset[str]
    addr_number: str | None         # e.g. "plot 116"
    street: str | None
    pincode: str | None
    addr_tokens: frozenset[str]


def parse_name(raw: str) -> tuple[str | None, list[str], str | None, frozenset[str]]:
    honorific, core, initials, types = None, [], None, set()
    for tok in raw.lower().replace("&", " and ").split():
        if INITIALS_RE.match(tok):
            initials = tok.replace(".", "")
            continue
        word = re.sub(r"[^a-z0-9]", "", tok)
        word = ABBREVIATIONS.get(word, word)
        if not word or word in FILLER_WORDS:
            continue
        if word in HONORIFICS and not core and honorific is None and initials is None:
            honorific = HONORIFICS[word]
        elif word in TYPE_WORDS:
            types.add(word)
        else:
            core.append(word)
    return honorific, core, initials, frozenset(types)


def normalize_street(text: str) -> str:
    text = re.sub(r"national\s+highway", "nh", text)
    text = re.sub(r"\b([a-z]+)-?(\d+)\b", r"\1 \2", text)  # nh-96 / nh96 -> nh 96
    return " ".join(STREET_ABBREVIATIONS.get(t, t) for t in re.findall(r"[a-z0-9]+", text))


def parse_address(raw: str | None) -> tuple[str | None, str | None, str | None, frozenset[str]]:
    """Split an address by the role of each comma segment (door/plot no., street, locality), not by position."""
    if not raw:
        return None, None, None, frozenset()
    text = raw.lower()
    pin = PINCODE_RE.search(text)
    text = PINCODE_RE.sub(" ", text)
    tokens = frozenset(normalize_street(text).split())
    segments = [s for s in (seg.strip(" -") for seg in text.split(",")) if s]
    number = None
    if segments and (m := NUMBER_SEGMENT_RE.match(segments[0])):
        number = m.group(2)
        segments = segments[1:]
    # The last segment is the locality/district; anything between number and locality is the street.
    street = normalize_street(" ".join(segments[:-1])) if len(segments) > 1 else None
    return number, street or None, pin.group(1) if pin else None, tokens


def profile(case: Case) -> Profile:
    hon, core, initials, types = parse_name(case.raw_institution_name)
    number, street, pincode, tokens = parse_address(case.raw_address)
    return Profile(case, hon, core, initials, types, number, street, pincode, tokens)


# ---------- signals ----------

def name_similarity(p: Profile, q: Profile) -> float | None:
    if p.initials or q.initials or not p.core or not q.core:
        return None
    # Compare with spaces removed so "aravalimahima" == "aravali mahima".
    return SequenceMatcher(None, "".join(p.core), "".join(q.core)).ratio()


def _subsequence_from_start(letters: str, word: str) -> bool:
    if not letters or not word or word[0] != letters[0]:
        return False
    pos = 1
    for ch in letters[1:]:
        pos = word.find(ch, pos) + 1
        if pos == 0:
            return False
    return True


def initials_match(p: Profile, q: Profile) -> float | None:
    if not p.initials and not q.initials:
        return None
    if p.initials and q.initials:
        return 1.0 if p.initials == q.initials else 0.0
    init, full = (p, q) if p.initials else (q, p)
    letters = init.initials
    core_letters = "".join(w[0] for w in full.core)
    hon_letter = full.honorific[0] if full.honorific else ""
    if letters in (hon_letter + core_letters, core_letters):
        return 1.0
    if letters[0] in "sd" and letters[1:] == core_letters:
        return 1.0  # honorific (Sri/Smt/Dr) written in the initials but dropped from the full name
    # Merged words ("Aravalimahima"): initials appear in order inside the joined name.
    joined = "".join(full.core)
    candidates = [letters] + ([letters[1:]] if letters[0] in "sd" else [])
    if any(_subsequence_from_start(c, joined) for c in candidates):
        return CONFIG["initials_partial_score"]
    return 0.0


def jaccard(a: frozenset, b: frozenset) -> float | None:
    if not a and not b:
        return None
    return len(a & b) / len(a | b)


def honorific_match(p: Profile, q: Profile) -> float | None:
    if p.initials or q.initials or (p.honorific is None and q.honorific is None):
        return None
    if p.honorific is None or q.honorific is None:
        return 0.5
    return 1.0 if p.honorific == q.honorific else 0.0


def same_street(a: str, b: str) -> bool:
    # Spacing-insensitive fuzzy compare: "hill view road" == "hillview road", "nh 96 bypass road" ~ "nh 96 bypass".
    ratio = SequenceMatcher(None, a.replace(" ", ""), b.replace(" ", "")).ratio()
    return ratio >= CONFIG["street_match_ratio"]


def address_similarity(p: Profile, q: Profile) -> float | None:
    if not p.case.raw_address or not q.case.raw_address:
        return None  # missing on one side: not evidence either way
    w = CONFIG["address_weights"]
    scored = [(w[k], 1.0 if same(a, b) else 0.0) for k, a, b, same in (
        ("number", p.addr_number, q.addr_number, str.__eq__),
        ("street", p.street, q.street, same_street),
        ("pincode", p.pincode, q.pincode, str.__eq__),
    ) if a and b]
    if scored:
        return sum(wt * s for wt, s in scored) / sum(wt for wt, _ in scored)
    return jaccard(p.addr_tokens, q.addr_tokens)


def equal_or_none(a: str | None, b: str | None) -> float | None:
    if not a or not b:
        return None
    return 1.0 if a.lower() == b.lower() else 0.0


# ---------- tier 3 ----------

class TextIndex:
    def __init__(self, cases: list[Case]):
        self.row = {c.id: i for i, c in enumerate(cases)}
        self.matrix = TfidfVectorizer(stop_words="english", ngram_range=(1, 2)).fit_transform(
            [c.description or "" for c in cases])

    def similarity(self, a: Case, b: Case) -> float:
        # Rows are L2-normalised, so the dot product is the cosine similarity.
        return float(self.matrix[self.row[a.id]].multiply(self.matrix[self.row[b.id]]).sum())


# ---------- scoring ----------

def _r(x: float | None) -> float | None:
    return None if x is None else round(x, 3)


def score_pair(p: Profile, q: Profile, text: TextIndex) -> dict | None:
    """Score one candidate pair. Returns None when permanent IDs conflict (never the same institution)."""
    a, b = p.case, q.case
    id_match = None
    if a.institution_id and b.institution_id:
        if a.institution_id != b.institution_id:
            return None
        id_match = 1.0

    name_sim = name_similarity(p, q)
    init = initials_match(p, q)
    signals = {
        "name": name_sim if name_sim is not None else init,
        "address": address_similarity(p, q),
        "type": jaccard(p.type_words, q.type_words),
        "district": equal_or_none(a.district, b.district),
        "honorific": honorific_match(p, q),
        "region": equal_or_none(a.region, b.region),
    }
    weights = CONFIG["weights"]
    avail = {k: v for k, v in signals.items() if v is not None}
    entity = sum(weights[k] * v for k, v in avail.items()) / sum(weights[k] for k in avail) if avail else 0.0
    if signals["type"] is not None and signals["type"] < 1:
        # A different kind of institution (e.g. engineering college vs business school next door) is
        # strong evidence of a different institution, more than its share of the weighted mean.
        entity *= 1 - CONFIG["type_mismatch_penalty"] * (1 - signals["type"])
    final = 1.0 if id_match else entity

    text_sim = text.similarity(a, b)
    category = 1.0 if a.category == b.category else 0.0
    iw = CONFIG["issue"]
    issue_score = iw["text_weight"] * text_sim + iw["category_weight"] * category
    same_issue = issue_score >= iw["same_issue_threshold"]
    linked = final >= CONFIG["link_threshold"]

    scores = {
        "match_tier": "id" if id_match else "entity",
        "id_match": id_match,
        "name_similarity": _r(name_sim),
        "initials_match": _r(init),
        "type_match": _r(signals["type"]),
        "honorific_match": _r(signals["honorific"]),
        "address_similarity": _r(signals["address"]),
        "district_match": signals["district"],
        "region_match": signals["region"],
        "entity_score": _r(entity),
        "text_similarity": _r(text_sim),
        "category_match": category,
        # The issue label only describes a suggested link; it is never used to decide one.
        "issue_label": (("same institution, same issue" if same_issue else "same institution, different issue")
                        if linked else None),
        "final_confidence": _r(final),
    }
    scores["reasons"] = reasons(p, q, scores)
    return scores


def reasons(p: Profile, q: Profile, s: dict) -> list[str]:
    a, b = p.case, q.case
    out = []
    if s["id_match"]:
        out.append("Same AICTE permanent ID on both cases")
    else:
        out.append("No shared permanent ID; matched on institution details")
    if s["name_similarity"] is not None:
        out.append(f"Name similarity {s['name_similarity']:.2f} after normalising "
                   f"('{' '.join(p.core)}' vs '{' '.join(q.core)}')")
    if s["initials_match"] is not None:
        init, full = (p, q) if p.initials else (q, p)
        verdict = {1.0: "match", 0.0: "do not match"}.get(s["initials_match"], "partly match")
        out.append(f"Initials '{init.initials.upper()}' {verdict} '{full.case.raw_institution_name}'")
    if s["type_match"] is not None:
        out.append("Same institution type" if s["type_match"] == 1
                   else f"Institution type differs ({' '.join(sorted(p.type_words))} vs {' '.join(sorted(q.type_words))})")
    if s["honorific_match"] == 0:
        out.append(f"Honorific differs ({p.honorific} vs {q.honorific})")
    elif s["honorific_match"] == 0.5:
        out.append("Honorific present on only one name")
    if s["address_similarity"] is not None:
        parts = []
        for label, x, y in (("door/plot no.", p.addr_number, q.addr_number), ("street", p.street, q.street),
                            ("pincode", p.pincode, q.pincode)):
            if x and y:
                parts.append(f"{'same' if x == y else 'different'} {label}")
            else:
                parts.append(f"{label} missing on one side")
        out.append(f"Address similarity {s['address_similarity']:.2f}: " + ", ".join(parts))
    if s["district_match"] is None:
        out.append("District missing on one side (not penalised)")
    else:
        out.append(f"District {'matches' if s['district_match'] else 'differs'} ({a.district} / {b.district})")
    out.append(f"Issue: category {'matches' if s['category_match'] else 'differs'} "
               f"({a.category.replace('_', ' ')} / {b.category.replace('_', ' ')}), description similarity {s['text_similarity']:.2f}"
               + (f" -> {s['issue_label']}" if s["issue_label"] else " (no link suggested, so no issue label)"))
    return out


def eligible(a: Case, b: Case) -> bool:
    return a.source_bureau != b.source_bureau and (is_open(a) or is_open(b)) and a.region == b.region


def score_candidates(cases: list[Case]) -> list[tuple[Case, Case, dict]]:
    """Score every eligible pair (blocked by region), without thresholding. Used by evaluation."""
    profiles = {c.id: profile(c) for c in cases}
    text = TextIndex(cases)
    blocks: dict[str | None, list[Case]] = {}
    for c in cases:
        blocks.setdefault(c.region, []).append(c)
    out = []
    for block in blocks.values():
        for a, b in combinations(block, 2):
            if eligible(a, b) and (s := score_pair(profiles[a.id], profiles[b.id], text)):
                out.append((a, b, s))
    return out


def _existing_pairs(db: Session) -> set[tuple[int, int]]:
    return {(l.case_a_id, l.case_b_id) for l in db.scalars(select(CaseLink))}


def _suggest(db: Session, a: Case, b: Case, scores: dict, existing: set) -> CaseLink | None:
    key = (min(a.id, b.id), max(a.id, b.id))
    if scores["final_confidence"] < CONFIG["link_threshold"] or key in existing:
        return None  # never re-suggest a pair an officer already reviewed
    link = CaseLink(case_a_id=key[0], case_b_id=key[1], scores=scores)
    db.add(link)
    notify_link(db, link)
    existing.add(key)
    return link


def run_all(db: Session) -> int:
    """Suggest links across all cases. Idempotent: existing links are left alone."""
    existing = _existing_pairs(db)
    created = [l for a, b, s in score_candidates(list(db.scalars(select(Case))))
               if (l := _suggest(db, a, b, s, existing))]
    db.commit()
    return len(created)


def match_case(db: Session, case: Case, commit: bool = True) -> list[CaseLink]:
    """Suggest links for one (new) case against existing cases from other bureaus in its region."""
    q = select(Case).where(Case.region == case.region, Case.source_bureau != case.source_bureau, Case.id != case.id)
    if not is_open(case):
        q = q.where(Case.status != CaseStatus.disposed.value)
    candidates = list(db.scalars(q))
    if not candidates:
        return []
    # Fit TF-IDF on the whole corpus so IDF weights match a full run.
    text = TextIndex(list(db.scalars(select(Case))))
    me, existing = profile(case), _existing_pairs(db)
    created = [l for other in candidates
               if (s := score_pair(me, profile(other), text)) and (l := _suggest(db, case, other, s, existing))]
    if commit:
        db.commit()
    else:
        db.flush()
    return created
