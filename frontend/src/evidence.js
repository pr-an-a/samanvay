// Turns the matcher's score breakdown into a few plain, ticked reasons.

const INITIALS = /(?:^|\s)((?:[A-Za-z]\.){2,}[A-Za-z]?\.?)(?=\s|$)/;

export function plainReasons(scores, a, b) {
  const out = [];
  if (scores.id_match) out.push("Both complaints give the same AICTE permanent ID.");

  if (scores.initials_match !== null && scores.initials_match !== undefined) {
    const short = (a.raw_institution_name.match(INITIALS) || b.raw_institution_name.match(INITIALS) || [])[1];
    if (scores.initials_match >= 1) out.push(`The short form “${short}” matches the full college name.`);
    else if (scores.initials_match > 0) out.push(`The short form “${short}” fits the full college name.`);
  } else if (scores.name_similarity !== null && scores.name_similarity !== undefined) {
    if (scores.name_similarity >= 0.98) out.push("The college names match.");
    else if (scores.name_similarity >= 0.85) out.push("The college names are almost the same, apart from spelling.");
  }

  if (scores.address_similarity >= 0.99) out.push("Same address: same plot or door number and street.");
  else if (scores.address_similarity >= 0.5) out.push("The addresses partly match.");

  if (scores.district_match === 1) out.push(`Same district: ${a.district || b.district}.`);
  if (scores.type_match === 1) out.push("Same type of college.");

  return out.slice(0, 4);
}

export function issueSentence(scores) {
  if (!scores.issue_label) return null;
  return scores.issue_label.endsWith("same issue")
    ? "The two complaints are about the same kind of problem."
    : "The two complaints are about different problems at the same college.";
}
