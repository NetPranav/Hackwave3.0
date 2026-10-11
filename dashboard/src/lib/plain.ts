// Plain-English wording for terms that come from the engine. Screens call these so one place decides how it reads.

/** "enum (3)" becomes "list (3 values)". Other types read fine as they are. */
export function plainType(type: string): string {
  return type.replace(/^enum \((\d+)\)/, "list ($1 values)").replace(/^enum$/, "list of values");
}

const USAGE: Record<string, string> = {
  display: "shown on screen",
  persistence: "saved to the database",
  branching: "decides what happens",
  money: "money",
  arithmetic: "calculations",
};

/** "persistence + display" becomes "saved to the database + shown on screen". */
export function plainUsage(kind: string): string {
  return kind
    .split(" + ")
    .map((part) => USAGE[part] ?? part)
    .join(" + ");
}

/** The fix type, without the internal "rung" numbering. */
export function plainFixType(rung: string): string {
  if (rung.startsWith("Rung 1")) return "Automatic fix: you merge it";
  if (rung.startsWith("Rung 2")) return "Needs a person: convert the values";
  return "Needs a person: change the code";
}

/** The eight safety checks every automatic fix passes, in words. The numbered code stays available as a tooltip. */
export const SAFETY_CHECKS: Record<string, { name: string; text: string }> = {
  C1: { name: "Safe names", text: "Both names are plain, normal field names with nothing tricky in them." },
  C2: { name: "Nothing to overwrite", text: "The old field is missing in almost every response, so the fix only fills a gap." },
  C3: { name: "Same kind of data", text: "Both fields hold the same type of data, such as text." },
  C4: { name: "Same meaning", text: "The values look alike, so it really is the same thing under a new name." },
  C5: { name: "No clash in your code", text: "Nothing in your code already uses the new name for something else." },
  C6: { name: "One clear match", text: "There is a single obvious match, not several possibilities." },
  C7: { name: "The fix passes its own tests", text: "Automatic tests for the fix pass, thousands of random cases." },
  C8: { name: "Your tests pass", text: "The tests in your repository pass with the fix in place." },
};

/** The four promises the fix code keeps. */
export const FIX_PROMISES = [
  { id: "G1", name: "Changes nothing it doesn't need to", text: "If the old field is still there, the response is left exactly as it was." },
  { id: "G2", name: "Only adds", text: "Every existing field is kept. The fix may add one that is missing, nothing more." },
  { id: "G3", name: "Blocks unsafe names", text: "Names that could cause security problems are refused." },
  { id: "G4", name: "Never breaks your app", text: "If anything goes wrong, your app gets the original response back." },
];
