"""Pre-action check: rule-based clash detection against linked cases at other bureaus. No AI.

Before an officer sends an action, the cases that an officer has *confirmed* as the same college are looked at:
  duplicate_effort      a similar request or notice from another bureau within `duplicate_days`
  conflicting_action    closing while another bureau escalates or has issued a show-cause notice, or
                        transferring to a bureau that is already handling the college
  waiting_on_each_other both cases quiet for `idle_days`: each bureau may be waiting for the other
The functions here are pure (plain data in, clashes out) so every rule can be tested alone; the database
side is in services_actions.py. Settings are in clash_config.json: demo values, not official AICTE rules.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

CONFIG = json.loads(Path(__file__).with_name("clash_config.json").read_text())

# kind -> (what the officer picks, the text recorded on the case)
ACTIONS = {
    "seek_reply": ("Seek reply from institution", "Reply sought from institution"),
    "request_documents": ("Request documents", "Documents requested from institution"),
    "show_cause": ("Issue show-cause notice", "Show-cause notice issued"),
    "close_case": ("Close case", "Closed"),
    "transfer": ("Transfer to another bureau", "Transferred to {bureau}"),
    "escalate": ("Escalate to senior officer", "Escalated to senior officer"),
}
NEEDS_ASKING_FOR = {"seek_reply", "request_documents", "show_cause"}
REQUESTS = {"seek_reply", "request_documents"}  # asking the college for something: one family
BUREAU_NAMES = {"RB": "Regulation Bureau", "PGRC": "Grievance Cell", "REGIONAL": "Regional Office", "ADMIN": "Administrator"}

# Older records only have free text; read the kind from it.
LEGACY = [(r"^reply sought", "seek_reply"), (r"^documents? requested", "request_documents"),
          (r"show-cause|^notice issued", "show_cause"), (r"^escalated", "escalate"),
          (r"^(closed|disposed)", "close_case"), (r"^transferred to", "transfer")]


def kind_of(action_text: str, kind: str | None = None) -> str | None:
    if kind:
        return kind
    text = action_text.lower()
    return next((k for pattern, k in LEGACY if re.search(pattern, text)), None)


@dataclass
class Move:
    """One thing a bureau did on a case."""
    kind: str | None
    bureau: str
    actor: str
    text: str
    asking_for: str | None
    when: datetime
    case_id: str


@dataclass
class Linked:
    """A case at another bureau that an officer confirmed is the same college."""
    case_id: str
    case_pk: int
    link_id: int
    bureau: str
    is_open: bool
    status: str
    moves: list[Move] = field(default_factory=list)

    def last_activity(self) -> datetime | None:
        return max((m.when for m in self.moves), default=None)


def days_between(later: datetime, earlier: datetime) -> int:
    return (later - earlier).days


def words(text: str | None) -> set[str]:
    return {w for w in re.findall(r"[a-z]+", (text or "").lower()) if len(w) > 3}


def similar_text(a: str | None, b: str | None) -> bool:
    x, y = words(a), words(b)
    return bool(x and y) and len(x & y) / len(x | y) >= 0.3


def other_side(link: Linked, move: Move | None, now: datetime) -> dict:
    return {"case_id": link.case_id, "case_pk": link.case_pk, "link_id": link.link_id, "bureau": link.bureau,
            "action": move.text if move else None, "asking_for": move.asking_for if move else None,
            "actor": move.actor if move else None, "when": move.when.isoformat() if move else None,
            "days_ago": days_between(now, move.when) if move else None}


def ago(days: int) -> str:
    return "today" if days <= 0 else "yesterday" if days == 1 else f"{days} days ago"


def check_action(kind: str, asking_for: str | None, transfer_to: str | None, linked: list[Linked],
                 mine_last: datetime | None, now: datetime, config: dict = CONFIG) -> list[dict]:
    """Every clash between the action about to be sent and the linked cases, most serious first."""
    mine = {"kind": kind, "label": ACTIONS[kind][0], "asking_for": asking_for}
    out = []

    def clash(type_, title, headline, why, link, move):
        out.append({"type": type_, "title": title, "headline": headline, "explanation": why,
                    "mine": mine, "other": other_side(link, move, now)})

    for link in linked:
        who = BUREAU_NAMES[link.bureau]
        recent = lambda ks, days: [m for m in link.moves if m.kind in ks  # noqa: E731
                                   and days_between(now, m.when) <= days]
        # --- conflicting action ---
        if kind == "close_case" and link.is_open:
            risky = recent({"escalate", "show_cause"}, config["conflict_days"])
            if risky or link.status == "escalated":
                m = max(risky, key=lambda m: m.when) if risky else None
                what = {"escalate": "escalated its case", "show_cause": "issued a show-cause notice"}.get(m.kind if m else "escalate")
                clash("conflicting_action", "This could conflict with another bureau's action",
                      "another bureau is escalating or has issued a notice",
                      f"The {who} {what}{' ' + ago(days_between(now, m.when)) if m else ''}; closing this case now could undercut it.",
                      link, m)
        if kind == "transfer" and transfer_to and link.bureau == transfer_to and link.is_open:
            clash("conflicting_action", "This could conflict with another bureau's action",
                  "that bureau is already handling this college",
                  f"The {who} already has case {link.case_id} open on this college, so a transfer would give it a second case.",
                  link, max(link.moves, key=lambda m: m.when, default=None))
        # --- duplicate effort ---
        family = REQUESTS if kind in REQUESTS else {"show_cause"} if kind == "show_cause" else set()
        if family:
            same = recent(family, config["duplicate_days"])
            if same:
                m = max(same, key=lambda m: m.when)
                much = " It asked for much the same thing." if similar_text(asking_for, m.asking_for) else ""
                noun = "sent a show-cause notice to" if kind == "show_cause" else "already asked"
                clash("duplicate_effort",
                      "Another bureau already sent a notice" if kind == "show_cause" else "Another bureau already asked",
                      "another bureau already sent a notice" if kind == "show_cause" else "another bureau already asked",
                      f"The {who} {noun} the college {ago(days_between(now, m.when))} ({m.text.lower()}).{much}", link, m)
        # --- waiting on each other ---
        theirs = link.last_activity()
        if link.is_open and kind != "escalate" and theirs and mine_last:
            quiet = config["idle_days"]
            mine_days, their_days = days_between(now, mine_last), days_between(now, theirs)
            if mine_days >= quiet and their_days >= quiet:
                last = max(link.moves, key=lambda m: m.when)
                clash("waiting_on_each_other", "Both bureaus may be waiting for each other",
                      "both cases have gone quiet",
                      f"Neither case has had any action for {quiet}+ days (yours {mine_days}, the {who}'s {their_days}). Agree who moves first.",
                      link, last)
    order = {"conflicting_action": 0, "duplicate_effort": 1, "waiting_on_each_other": 2}
    return sorted(out, key=lambda c: order[c["type"]])
