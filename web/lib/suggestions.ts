// Ready answers for every field of the landlord's two forms, so a flat can be offered and a
// move-out report filed without typing: one click fills a field, and the text stays editable.
// Every suggestion is printable ASCII inside the contract's limits, which
// tests/unit/suggestions.test.mjs checks against lib/rules.ts. No imports, so node runs it in tests.

/** Titles for a flat of your own, none of them a sample flat's. */
export const TITLE_SUGGESTIONS: string[] = [
  "One-bedroom flat over the florist",
  "Corner flat with two bay windows",
  "Basement studio near the market",
  "Third-floor flat by the park gates",
  "Cottage flat with a walled garden",
  "Two-bedroom maisonette on the hill",
  "Attic room with a dormer window",
  "Split-level flat in the old school",
];

/** Address lines, all made up. */
export const ADDRESS_SUGGESTIONS: string[] = [
  "Flat 3, 41 Orchard Row",
  "Flat 1B, 9 Ropemaker Street",
  "Top flat, 27 Bell Hill",
  "Unit 12, 5 Foundry Yard",
  "Flat 6, 88 Willow Crescent",
  "Basement flat, 15 Market Square",
  "Flat 2, 63 Kiln Lane",
  "4 Lantern Mews",
];

/** Deposits in GEN, as the deposit field takes them. */
export const DEPOSIT_SUGGESTIONS: string[] = ["0.5", "1", "1.5", "2", "3"];

export type ItemSuggestion = { name: string; moveIn: string };

/**
 * Common items with a move-in note written the way the sample flats' notes are: what it is, its
 * colour, and what is already wrong with it, so a stranger could check it on the day.
 */
export const ITEM_SUGGESTIONS: ItemSuggestion[] = [
  { name: "Kitchen worktop", moveIn: "Oak-effect laminate worktop along one wall, no burns, cuts, chips or swelling at the joints." },
  { name: "Living room walls", moveIn: "Living room walls painted off-white last month, no marks, holes, scuffs or tape residue." },
  { name: "Bedroom carpet", moveIn: "Light grey carpet, professionally cleaned before move-in, no stains, burns or worn patches." },
  { name: "Bathroom mirror", moveIn: "Mirror above the basin intact, no cracks, chips or dark spots in the silvering, fixings tight." },
  { name: "Oven", moveIn: "Electric oven cleaned before move-in, both racks and the grill pan present, glass door clean and whole." },
  { name: "Hob", moveIn: "Four-ring gas hob, every ring lights, pan supports and burner caps present, enamel clean and unchipped." },
  { name: "Fridge", moveIn: "Under-counter fridge clean and working, two glass shelves, the salad drawer and the door rack all intact." },
  { name: "Washing machine", moveIn: "Front-loading washing machine works on every programme, door seal clean, soap drawer intact." },
  { name: "Windows", moveIn: "Double glazed windows open, close and lock, glass clean with no cracks, seals and handles intact." },
  { name: "Front door", moveIn: "Painted green front door, lock works with both keys, letterbox flap and door chain intact, no dents." },
  { name: "Sofa", moveIn: "Grey fabric three-seat sofa, frame firm, cushions clean with no tears, stains or burns." },
  { name: "Dining table", moveIn: "Pine dining table for four, top varnished, no burns, heat rings or deep scratches, legs firm." },
  { name: "Wardrobe", moveIn: "White two-door wardrobe, both doors hang straight and close, hanging rail and top shelf in place." },
  { name: "Desk", moveIn: "Beech desk with one drawer, top smooth with no scratches or ink marks, drawer runs smoothly." },
  { name: "Mattress", moveIn: "Double mattress with a fitted protector, one year old, no stains, sagging or tears." },
  { name: "Curtains", moveIn: "Blue lined curtains on the living room window, clean, hems intact, every hook in place." },
  { name: "Shower screen", moveIn: "Glass shower screen fixed firmly to the wall, no chips or cracks, seal along the tray complete." },
  { name: "Bathroom tiles", moveIn: "White wall tiles around the bath, no cracks or drill holes, grout clean and white throughout." },
  { name: "Wooden floor", moveIn: "Oak boards in the hall and living room, sanded and oiled last year, even finish, no deep scratches." },
  { name: "Kitchen cupboards", moveIn: "Eight cream cupboard doors, hinges adjusted, all close flush, no chips, every handle fitted." },
  { name: "Light fittings", moveIn: "Every ceiling light works, glass shades clean and uncracked, switches and the dimmer work in every room." },
  { name: "Balcony decking", moveIn: "Hardwood decking on the balcony, oiled in the spring, every board firm, no splits or loose screws." },
  { name: "Garden lawn", moveIn: "Lawn cut short with trimmed edges and no bare patches; borders weeded, roses along the back fence." },
  { name: "Radiators", moveIn: "Five white radiators, all heat evenly, valves turn, no rust, leaks or chipped paint." },
];

// ---- the move-out report --------------------------------------------------------------------------

export type NoteKind = "same" | "scuffs" | "burn" | "crack" | "stain" | "faded" | "missing" | "broken";

/** The move-out chips, in the order they are shown. */
export const NOTE_KINDS: { kind: NoteKind; label: string }[] = [
  { kind: "same", label: "No change from move-in" },
  { kind: "scuffs", label: "Light scuffs" },
  { kind: "burn", label: "Small burn mark" },
  { kind: "crack", label: "Crack" },
  { kind: "stain", label: "Stain" },
  { kind: "faded", label: "Faded" },
  { kind: "missing", label: "Missing" },
  { kind: "broken", label: "Broken" },
];

/** An item's name as it reads inside a sentence: "Kitchen worktop" becomes "kitchen worktop", "TV unit" stays. */
export function inSentence(name: string): string {
  const t = String(name ?? "").trim();
  if (t.length > 1 && /[A-Z]/.test(t[0]) && /[a-z]/.test(t[1])) return t[0].toLowerCase() + t.slice(1);
  return t;
}

/** A concrete move-out note for one item, built from its name. */
export function moveOutNote(kind: NoteKind, name: string): string {
  const t = inSentence(name);
  switch (kind) {
    case "same":
      return `The ${t} is in the same condition as the move-in note describes; nothing new was found at move-out.`;
    case "scuffs":
      return `Light scuffs on the ${t} from everyday use, a few centimetres each; no chips, burns or stains.`;
    case "burn":
      return `A small burn mark about 3 cm across on the ${t}; the surface is scorched and blistered there.`;
    case "crack":
      return `A crack about 10 cm long across the ${t}, which was not there at move-in.`;
    case "stain":
      return `A dark stain about 15 cm across on the ${t} that does not come out with ordinary cleaning.`;
    case "faded":
      return `The ${t} has faded evenly where daylight reaches it; no tears, marks or breakage.`;
    case "missing":
      return `The ${t} is missing at move-out; it was present and listed in the move-in note.`;
    case "broken":
      return `The ${t} is broken and no longer works or holds together as it did at move-in.`;
  }
}

export type ReasonKind = "repaint" | "replace" | "clean" | "repair" | "refinish";

export const REASON_KINDS: { kind: ReasonKind; label: string }[] = [
  { kind: "repaint", label: "Repaint" },
  { kind: "replace", label: "Replace" },
  { kind: "clean", label: "Deep clean" },
  { kind: "repair", label: "Repair" },
  { kind: "refinish", label: "Refinish" },
];

const ALL_REASONS: ReasonKind[] = REASON_KINDS.map((r) => r.kind);

/** Which kinds of work fit a move-out note; every kind when the note was written by hand. */
export const REASONS_FOR: Record<NoteKind, ReasonKind[]> = {
  same: ALL_REASONS,
  scuffs: ["repaint", "clean", "refinish", "repair"],
  burn: ["repair", "refinish", "replace"],
  crack: ["repair", "replace"],
  stain: ["clean", "repaint", "replace"],
  faded: ["repaint", "refinish", "replace"],
  missing: ["replace"],
  broken: ["repair", "replace"],
};

export const reasonsFor = (note: NoteKind | ""): ReasonKind[] => (note ? REASONS_FOR[note] : ALL_REASONS);

/** What a reason points back to in the move-out note. */
const WHAT: Record<NoteKind | "", string> = {
  "": "what the move-out note describes",
  same: "what the move-out note describes",
  scuffs: "the scuffs found at move-out",
  burn: "the burn mark found at move-out",
  crack: "the crack found at move-out",
  stain: "the stain found at move-out",
  faded: "the faded finish found at move-out",
  missing: "what is missing at move-out",
  broken: "the breakage found at move-out",
};

/** A concrete reason for a deduction: the work it pays for, on this item, for what the note found. */
export function deductionReason(kind: ReasonKind, note: NoteKind | "", name: string): string {
  const t = inSentence(name);
  const what = WHAT[note];
  switch (kind) {
    case "repaint":
      return `Repainting the ${t} to cover ${what}.`;
    case "replace":
      return note === "missing" ? `Replacing the missing ${t} with a new one of the same kind and quality.` : `Replacing the ${t} because of ${what}; it cannot be repaired.`;
    case "clean":
      return `A professional deep clean of the ${t} to lift ${what}.`;
    case "repair":
      return `Repairing the ${t} to put right ${what}, back to its move-in condition.`;
    case "refinish":
      return `Sanding and refinishing the ${t} to remove ${what}.`;
  }
}

/** Deduction amounts in GEN, as the amount field takes them. */
export const AMOUNT_SUGGESTIONS: string[] = ["0.05", "0.1", "0.2", "0.3", "0.5"];
