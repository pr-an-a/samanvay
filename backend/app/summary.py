"""The one-sentence summary at the top of a college page. Built from a template, no AI."""

import re
from datetime import date, datetime

from .models import Case
from .services import is_open

BUREAU_NAMES = {"RB": "Regulation Bureau", "PGRC": "Grievance Cell", "REGIONAL": "Regional Office", "ADMIN": "Administrator"}


def plain_action(text: str) -> str:
    """Event text in plain words, lower-cased for the middle of a sentence."""
    m = re.match(r"^Overlap with (\S+) (confirmed|rejected)$", text)
    if m:
        text = f"Match with case {m[1]} {m[2]}"
    text = re.sub(r"^Disposed:", "Closed:", text)
    text = re.sub(r"\b(RB|PGRC|REGIONAL)\b(?![/-])", lambda c: BUREAU_NAMES[c[1]], text)
    return text[0].lower() + text[1:]


def plural(n: int, word: str) -> str:
    return f"{n} {word}{'' if n == 1 else 's'}"


def college_summary(cases: list[Case], events: list[tuple[datetime, str, str]], today: date) -> str:
    """events: (timestamp, action, acting bureau) for every case event on the college."""
    if not cases:
        return "No cases on this college yet."
    bureaus = {c.source_bureau for c in cases}
    open_cases = [c for c in cases if is_open(c)]
    parts = [f"{plural(len(bureaus), 'bureau')} involved"]
    if open_cases:
        age = (today - min(c.received_date for c in open_cases)).days
        parts.append(plural(len(open_cases), "open case"))
        parts.append("oldest open today" if age <= 0 else f"oldest open {plural(age, 'day')}")
    else:
        parts.append("no open cases")
    if events:
        when, action, bureau = max(events, key=lambda e: e[0].replace(tzinfo=None))
        day = f"{when.day} {when:%b}" + ("" if when.year == today.year else f" {when.year}")
        parts.append(f"last action: {plain_action(action)} by {BUREAU_NAMES.get(bureau, bureau)}, {day}")
    else:
        parts.append("no actions yet")
    return " · ".join(parts) + "."
