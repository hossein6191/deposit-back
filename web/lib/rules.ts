// The contract's rules, in TypeScript, with no imports: the limits, the readers of the caller's
// JSON, the combine table, the phase on the clock and the money of each ending. The in-memory
// contract of mock mode (lib/chain-mock.ts) is built on these, the forms check against them before
// anything is signed, and tests/unit/*.test.mjs runs them from node with no browser.
//
// Every refusal sentence here is the contract's own, word for word (contracts/deposit_back.py), so
// a form, the mock and the chain all say the same thing about the same input.

export const ATTO = 10n ** 18n;

export const MIN_TITLE = 3;
export const MAX_TITLE = 60;
export const MIN_ADDRESS = 3;
export const MAX_ADDRESS = 80;
export const MIN_ITEMS = 2;
export const MAX_ITEMS = 8;
export const MIN_NAME = 3;
export const MAX_NAME = 40;
export const MIN_NOTE = 20;
export const MAX_NOTE = 400;
export const MIN_REASON = 20;
export const MAX_REASON = 300;
export const MAX_DEDUCTIONS = 6;
export const MIN_DEPOSIT = ATTO / 10n;
export const MAX_DEPOSIT = 1000n * ATTO;
export const MIN_WINDOW = 300;
export const MAX_WINDOW = 30 * 86400;
export const PAGE = 20;
export const ID_CHARS = 12;
export const ADDRESS_CHARS = 42;
export const ZERO = "0x0000000000000000000000000000000000000000";

export const STATUS = {
  open: "open",
  let: "let",
  notice: "notice",
  reported: "reported",
  withdrawn: "withdrawn",
  reclaimed: "reclaimed",
  clean: "clean",
  accepted: "accepted",
  judged: "judged",
  settled: "settled",
} as const;
export type FlatStatus = (typeof STATUS)[keyof typeof STATUS];
export const STATUSES: FlatStatus[] = Object.values(STATUS);
/** The statuses in which the contract holds the deposit. */
export const HOLDING: FlatStatus[] = ["let", "notice", "reported"];
/** The statuses after which nothing more can happen to a flat. */
export const CLOSED: FlatStatus[] = ["withdrawn", "reclaimed", "clean", "accepted", "judged", "settled"];

/** Which call a flat waits for now: the contract's _phase. */
export type Phase = "take" | "notice" | "report" | "reclaim" | "answer" | "settle" | "closed" | "unknown";

/** The verdict the network gives one contested deduction. */
export type Verdict = "damage" | "wear" | "unclear";
export const VERDICTS: Verdict[] = ["damage", "wear", "unclear"];
/** What happened to a deduction nobody asked the network about. */
export type Untested = "uncontested" | "accepted" | "unanswered";
export type Outcome = Verdict | Untested | "";
export type Payee = "landlord" | "tenant" | "";

export type Answer = "yes" | "no" | "unclear" | "";

/** Two framings into one verdict: yes then no is damage, no then yes is wear, anything else unclear. */
export function combine(damageAnswer: Answer, wearAnswer: Answer): Verdict {
  if (damageAnswer === "yes" && wearAnswer === "no") return "damage";
  if (damageAnswer === "no" && wearAnswer === "yes") return "wear";
  return "unclear";
}

/** Where the money of one deduction goes: damage, and every deduction nobody contested, to the landlord. */
export function payeeOf(outcome: Outcome): Payee {
  if (outcome === "damage" || outcome === "uncontested" || outcome === "accepted" || outcome === "unanswered") return "landlord";
  if (outcome === "wear" || outcome === "unclear") return "tenant";
  return "";
}

/** "D1:wear,D2:damage": the value the validators agree on, one word per contested deduction. */
export const vectorOf = (pairs: [string, Verdict][]): string => pairs.map(([id, v]) => id + ":" + v).join(",");

/** The contested deductions' verdicts read back from a stored vector: { D1: "wear", ... }. */
export function readVector(vector: string): Record<string, Verdict> {
  const out: Record<string, Verdict> = {};
  for (const part of String(vector || "").split(",")) {
    const [id, verdict] = part.split(":");
    if (id && VERDICTS.includes(verdict as Verdict)) out[id] = verdict as Verdict;
  }
  return out;
}

export const deductionId = (index: number): string => "D" + (index + 1);

/** The contract's _phase: which call a flat waits for at `now` (seconds). */
export function phaseOf(status: string, moveoutEnd: number, responseEnd: number, now: number): Phase {
  if (status === STATUS.open) return "take";
  if (status === STATUS.let) return "notice";
  if (status !== STATUS.notice && status !== STATUS.reported) return "closed";
  if (!(now > 0)) return "unknown";
  if (status === STATUS.notice) return now < moveoutEnd ? "report" : "reclaim";
  return now < responseEnd ? "answer" : "settle";
}

/**
 * The money of an ending, exactly as _close moves it: every deduction whose payee is the landlord
 * goes to the landlord, and the rest of the deposit goes to the tenant. Every atto goes one way.
 */
export function splitOf(deposit: bigint, amounts: bigint[], payees: Payee[]): { tenant: bigint; landlord: bigint } {
  let landlord = 0n;
  for (let k = 0; k < amounts.length; k++) if (payees[k] === "landlord") landlord += amounts[k];
  return { tenant: deposit - landlord, landlord };
}

// ---- reading the caller, as the contract does -----------------------------------------------------

/** The characters Python's str.strip() and str.split() treat as whitespace (str.isspace()). */
const PY_SPACE_CHARS = "\t\n\x0b\x0c\r\x1c\x1d\x1e\x1f \x85\xa0                　";

/** Python's str.strip(): JS trim() also takes U+FEFF and misses \x1c-\x1f and \x85. */
export function pyStrip(text: string): string {
  let a = 0;
  let b = text.length;
  while (a < b && PY_SPACE_CHARS.includes(text[a])) a++;
  while (b > a && PY_SPACE_CHARS.includes(text[b - 1])) b--;
  return text.slice(a, b);
}

/** The contract's _text_problem: "" when the text may be stored, else why not. Printable ASCII on one line. */
export function textProblem(text: string, least: number, most: number, what: string): string {
  // Python counts code points; a JS string's length counts UTF-16 units.
  const n = [...text].length;
  if (n < least || n > most) return `${what} is ${least} to ${most} characters; this one is ${n}`;
  for (const ch of text) {
    const c = ch.codePointAt(0) ?? 0;
    if (c < 32 || c > 126) return `${what} is printable ASCII on one line`;
  }
  return "";
}

/**
 * True when a JSON text holds a number with a fraction or an exponent outside its strings. The
 * contract parses with hooks that refuse those (a float traps the VM), so such a text is unreadable.
 */
export function hasFraction(raw: string): boolean {
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "." || ch === "e" || ch === "E") {
      // Outside a string, '.', 'e' and 'E' only ever appear inside a number (true/false/null have
      // an 'e' too, but no digit before it).
      const prev = raw[i - 1] ?? "";
      if (ch === "." || /[0-9]/.test(prev)) return true;
    }
  }
  return false;
}

/** json.loads with the contract's hooks: throws on anything the contract could not read. */
export function loads(raw: string): unknown {
  if (hasFraction(raw)) throw new Error("a number with a fraction or an exponent");
  return JSON.parse(raw);
}

/** The contract's _whole: a non-negative whole number in ASCII digits, or -1. */
export function whole(raw: string): bigint {
  const s = pyStrip(raw);
  if (!s || s.length > 40 || !/^[0-9]+$/.test(s)) return -1n;
  return BigInt(s);
}

/** The contract's _number_arg: an int, or a string of digits; -1 otherwise (a bool is refused by name). */
export function numberArg(raw: unknown): bigint {
  if (typeof raw === "boolean") return -1n;
  if (typeof raw === "bigint") return raw >= 0n ? raw : -1n;
  if (typeof raw === "number") return Number.isSafeInteger(raw) && raw >= 0 ? BigInt(raw) : -1n;
  if (typeof raw === "string") return whole(raw);
  return -1n;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const keysAre = (o: Record<string, unknown>, keys: string[]) => Object.keys(o).sort().join("|") === keys.join("|");

export type ItemInput = { name: string; move_in: string };

/** The contract's _read_items. */
export function readItems(raw: string): { items: ItemInput[]; problem: string } {
  const shape = `the items are a JSON list of ${MIN_ITEMS} to ${MAX_ITEMS} objects, each {"name": ..., "move_in": ...}`;
  let parsed: unknown;
  try {
    parsed = loads(raw);
  } catch {
    return { items: [], problem: shape };
  }
  if (!Array.isArray(parsed) || parsed.length < MIN_ITEMS || parsed.length > MAX_ITEMS) return { items: [], problem: shape };
  const items: ItemInput[] = [];
  const names: string[] = [];
  for (let k = 0; k < parsed.length; k++) {
    const entry = parsed[k];
    if (!isObject(entry) || !keysAre(entry, ["move_in", "name"]))
      return { items: [], problem: `item ${k} is an object with exactly a name and a move_in note` };
    if (typeof entry.name !== "string" || typeof entry.move_in !== "string")
      return { items: [], problem: `the name and the move_in note of item ${k} are strings` };
    const name = pyStrip(entry.name);
    const note = pyStrip(entry.move_in);
    const problem =
      textProblem(name, MIN_NAME, MAX_NAME, `the name of item ${k}`) || textProblem(note, MIN_NOTE, MAX_NOTE, `the move-in note of item ${k}`);
    if (problem) return { items: [], problem };
    if (names.includes(name.toLowerCase())) return { items: [], problem: `two items are named ${name}; every item has a name of its own` };
    names.push(name.toLowerCase());
    items.push({ name, move_in: note });
  }
  return { items, problem: "" };
}

/** The contract's _read_moveout. */
export function readMoveout(raw: string, count: number): { notes: string[]; problem: string } {
  const shape = `the move-out notes are a JSON list of ${count} strings, one per item, in the items' order`;
  let parsed: unknown;
  try {
    parsed = loads(raw);
  } catch {
    return { notes: [], problem: shape };
  }
  if (!Array.isArray(parsed) || parsed.length !== count) return { notes: [], problem: shape };
  const notes: string[] = [];
  for (let k = 0; k < count; k++) {
    if (typeof parsed[k] !== "string") return { notes: [], problem: shape };
    const note = pyStrip(parsed[k] as string);
    const problem = textProblem(note, MIN_NOTE, MAX_NOTE, `the move-out note of item ${k}`);
    if (problem) return { notes: [], problem };
    notes.push(note);
  }
  return { notes, problem: "" };
}

export type DeductionInput = { item: number; amount: string; reason: string };

/** The contract's _read_deductions: amounts come back as decimal strings of atto. */
export function readDeductions(raw: string, count: number, deposit: bigint): { deductions: DeductionInput[]; total: bigint; problem: string } {
  const shape = `the deductions are a JSON list of at most ${MAX_DEDUCTIONS} objects, each {"item": index, "amount": atto, "reason": ...}`;
  const no = (problem: string) => ({ deductions: [], total: 0n, problem });
  let parsed: unknown;
  try {
    parsed = loads(raw);
  } catch {
    return no(shape);
  }
  if (!Array.isArray(parsed) || parsed.length > MAX_DEDUCTIONS) return no(shape);
  const out: DeductionInput[] = [];
  const used: number[] = [];
  let total = 0n;
  for (let k = 0; k < parsed.length; k++) {
    const entry = parsed[k];
    if (!isObject(entry) || !keysAre(entry, ["amount", "item", "reason"]))
      return no(`deduction ${k} is an object with exactly an item, an amount and a reason`);
    const item = entry.item;
    if (!isInt(item) || item < 0 || item >= count) return no(`the item of deduction ${k} is an index from 0 to ${count - 1}`);
    if (used.includes(item)) return no(`item ${item} has two deductions; one deduction per item`);
    const amount = numberArg(entry.amount);
    if (amount < 1n) return no(`the amount of deduction ${k} is a whole number of atto, at least 1`);
    if (typeof entry.reason !== "string") return no(`the reason of deduction ${k} is a string`);
    const reason = pyStrip(entry.reason);
    const problem = textProblem(reason, MIN_REASON, MAX_REASON, `the reason of deduction ${k}`);
    if (problem) return no(problem);
    used.push(item);
    total += amount;
    out.push({ item, amount: amount.toString(), reason });
  }
  if (total > deposit) return no(`the deductions add up to ${total} atto, more than the deposit of ${deposit}`);
  return { deductions: out, total, problem: "" };
}

/** The contract's _read_indices: the contested deduction indices, ascending. */
export function readIndices(raw: string, count: number): { picked: number[]; problem: string } {
  const shape = `the contested deductions are a non-empty JSON list of deduction indices from 0 to ${count - 1}, each once`;
  let parsed: unknown;
  try {
    parsed = loads(raw);
  } catch {
    return { picked: [], problem: shape };
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > count) return { picked: [], problem: shape };
  const picked: number[] = [];
  for (const index of parsed) {
    if (!isInt(index) || index < 0 || index >= count || picked.includes(index)) return { picked: [], problem: shape };
    picked.push(index);
  }
  return { picked: picked.sort((a, b) => a - b), problem: "" };
}

// ---- what the site sends -------------------------------------------------------------------------

const TYPOGRAPHIC: [string, string][] = [
  ["‘", "'"],
  ["’", "'"],
  ["“", '"'],
  ["”", '"'],
  ["–", "-"],
  ["—", "-"],
  ["…", "..."],
  [" ", " "],
];

/**
 * A text as a form sends it: typographic quotes, dashes and the ellipsis made plain, and every run
 * of whitespace, line breaks included, turned into one space. The contract itself only strips the
 * ends; this is what keeps a pasted note on one line of printable ASCII.
 */
export function plain(text: string): string {
  let t = String(text ?? "");
  for (const [fancy, plainChar] of TYPOGRAPHIC) t = t.split(fancy).join(plainChar);
  return t
    .split(/[\s\x1c-\x1f\x85]+/)
    .filter(Boolean)
    .join(" ");
}

/** A contract sentence as a sentence: capital first letter, full stop at the end. */
export function sentence(text: string): string {
  const t = String(text ?? "").replace(/^\s*\[(EXPECTED|TRANSIENT)\]\s*/i, "").trim();
  if (!t) return "";
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?)]$/.test(s) ? s : s + ".";
}

const FLAT_RE = /^F?([1-9]\d{0,8})$/i;

/** "F3" from "F3", "f3" or "3"; "" for anything else. */
export function parseFlatId(raw: string): string {
  let text = "";
  try {
    text = decodeURIComponent(String(raw ?? "")).trim();
  } catch {
    return "";
  }
  const m = FLAT_RE.exec(text);
  return m ? "F" + m[1] : "";
}

/** The number inside a flat id: 3 for "F3"; 0 when there is none. */
export const flatNumber = (id: string): number => Number(/^F([1-9]\d{0,8})$/.exec(id)?.[1] ?? 0);
