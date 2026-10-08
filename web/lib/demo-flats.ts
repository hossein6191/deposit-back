// The six sample flats. The demo landlord offers copies of them on chain (tools/offer-demo.mjs),
// the landlord page loads them into its form, the floor plans are drawn from them, and the demo
// landlord's move-out report for each is scripted here: POST /api/demo/report signs exactly these
// notes and deductions, and the in-memory contract of mock mode files the same.
//
// Every sample has a clear mix: at least one deduction that is plainly damage, at least one that is
// plainly wear, and at least one item with no deduction. Each also shows one thing on its own (its
// `lesson`). `expect` is what the in-memory contract answers for a contested deduction; on chain the
// validators decide. Every text is printable ASCII inside the contract's limits, which
// tests/unit/demo-flats.test.mjs checks against lib/rules.ts.

import type { PlanSpec } from "./plans.ts";
import type { Verdict } from "./rules.ts";

const GEN = 10n ** 18n;
/** An amount in hundredths of a GEN, as a decimal string of atto: gen(25) is 0.25 GEN. */
const gen = (hundredths: number) => ((BigInt(hundredths) * GEN) / 100n).toString();

export type SampleDeduction = { item: number; amount: string; reason: string; expect: Verdict };

export type SampleFlat = {
  /** a short handle for the site and the offer script */
  key: string;
  title: string;
  addressLine: string;
  depositAtto: string;
  /** the landlord's time to report, from the notice */
  moveoutSeconds: number;
  /** the tenant's time to answer, from the report */
  responseSeconds: number;
  /** one line for a card */
  blurb: string;
  /** the one thing this flat shows */
  lesson: string;
  items: { name: string; move_in: string }[];
  /** the demo landlord's move-out note for each item, in the items' order */
  moveOut: string[];
  deductions: SampleDeduction[];
  plan: PlanSpec;
};

/** The report window of every sample flat: the demo landlord files at once, so two hours is plenty. */
export const DEMO_MOVEOUT_SECONDS = 2 * 3600;
/** The response window: a day for the visitor to read the report and answer it. */
export const DEMO_RESPONSE_SECONDS = 24 * 3600;

export const SAMPLE_FLATS: SampleFlat[] = [
  {
    key: "bakery",
    title: "Two-bedroom flat above the bakery",
    addressLine: "Flat 2, 14 Mill Lane, above the bakery",
    depositAtto: gen(100),
    moveoutSeconds: DEMO_MOVEOUT_SECONDS,
    responseSeconds: DEMO_RESPONSE_SECONDS,
    blurb: "Five items, four deductions: a scuffed wall, a burnt worktop, a flattened carpet and a cracked mirror.",
    lesson: "Damage and wear side by side: the burn and the crack are damage, the scuffs and the flattened path are wear.",
    items: [
      { name: "Living room walls", move_in: "Freshly painted white throughout, no marks, holes or scuffs on any wall." },
      { name: "Kitchen worktop", move_in: "Grey laminate worktop, no burns, cuts, chips or stains anywhere along its length." },
      { name: "Bedroom carpet", move_in: "Beige carpet, professionally cleaned before move-in, no stains or worn areas." },
      { name: "Bathroom mirror", move_in: "Mirror above the basin is intact, with no cracks, chips or loose fixings." },
      { name: "Windows and frames", move_in: "Double glazed windows open and close smoothly, frames clean, seals intact." },
    ],
    moveOut: [
      "Two small scuffs near the light switch where furniture touched the wall; the paint is otherwise clean.",
      "A 6 cm burn mark from a hot pan on the laminate next to the hob; the surface is blistered there.",
      "General flattening of the pile along the path from the door to the bed; no stains, tears or burns.",
      "The mirror is cracked across the lower left corner, with a crack about 15 cm long.",
      "Windows open and close smoothly, frames clean and seals intact, the same as at move-in.",
    ],
    deductions: [
      { item: 0, amount: gen(30), reason: "Repainting the living room wall to remove the scuffs left near the light switch.", expect: "wear" },
      { item: 1, amount: gen(20), reason: "Cutting out and replacing the burnt section of the laminate worktop next to the hob.", expect: "damage" },
      { item: 2, amount: gen(15), reason: "Steam cleaning and re-stretching the bedroom carpet to lift the flattened walking path.", expect: "wear" },
      { item: 3, amount: gen(25), reason: "Replacing the cracked bathroom mirror and its fixings.", expect: "damage" },
    ],
    plan: {
      cols: [230, 120, 90],
      rows: [100, 50, 120],
      rooms: [
        { id: "living", label: "Living room", kind: "living", c: 0, r: 0, rs: 2 },
        { id: "kitchen", label: "Kitchen", kind: "kitchen", c: 1, r: 0 },
        { id: "bath", label: "Bathroom", kind: "bath", c: 2, r: 0 },
        { id: "hall", label: "Hall", kind: "hall", c: 1, r: 1, cs: 2 },
        { id: "bed", label: "Bedroom", kind: "bed", c: 0, r: 2 },
        { id: "bed2", label: "Bedroom 2", kind: "bed", c: 1, r: 2, cs: 2 },
      ],
      doors: [["hall", "living"], ["hall", "kitchen"], ["hall", "bath"], ["living", "bed"], ["hall", "bed2"]],
      entry: { room: "hall", side: "e" },
      items: [
        { room: "living", near: "wall" },
        { room: "kitchen", near: "hob" },
        { room: "bed", near: "floor" },
        { room: "bath", near: "basin" },
        { room: "bed2", near: "window" },
      ],
    },
  },
  {
    key: "canal",
    title: "Studio flat by the canal",
    addressLine: "Unit 5, 3 Canal Walk",
    depositAtto: gen(80),
    moveoutSeconds: DEMO_MOVEOUT_SECONDS,
    responseSeconds: DEMO_RESPONSE_SECONDS,
    blurb: "One open room over the water: a torn sofa bed, a scratched oak floor, a hob and a shower screen left as found.",
    lesson: "The reason is not evidence: it claims deep gouges in the floor, but the move-out note describes light scratches on the walking path.",
    items: [
      { name: "Sofa bed", move_in: "Grey fabric sofa bed, frame and mechanism work, seat fabric clean with no tears or stains." },
      { name: "Oak floor", move_in: "Oak floorboards across the main room, sanded and oiled last spring, an even finish throughout." },
      { name: "Kitchenette hob", move_in: "Two-ring ceramic hob, both rings work, glass top clean with no cracks or chips." },
      { name: "Shower screen", move_in: "Glass shower screen fixed firmly to the wall, seal along the tray complete and clean." },
    ],
    moveOut: [
      "A 10 cm tear in the seat fabric of the left cushion, with the foam showing through the tear.",
      "Light surface scratches and a duller finish along the walking path from the door to the window.",
      "Both rings work and the glass top is clean, with no cracks or chips, the same as at move-in.",
      "Screen fixed firmly to the wall, seal complete, a little limescale along the bottom edge of the glass.",
    ],
    deductions: [
      { item: 0, amount: gen(25), reason: "Reupholstering the left seat cushion of the sofa bed where the fabric was torn open.", expect: "damage" },
      { item: 1, amount: gen(30), reason: "Deep gouges across the floor that need the whole room sanded back to bare wood and refinished.", expect: "wear" },
    ],
    plan: {
      cols: [220, 110],
      rows: [110, 90],
      rooms: [
        { id: "main", label: "Main room", kind: "living", c: 0, r: 0, rs: 2 },
        { id: "kitchenette", label: "Kitchenette", kind: "kitchen", c: 1, r: 0 },
        { id: "shower", label: "Shower room", kind: "bath", c: 1, r: 1 },
      ],
      doors: [["main", "kitchenette"], ["main", "shower"]],
      entry: { room: "main", side: "w" },
      items: [
        { room: "main", near: "sofa" },
        { room: "main", near: "floor" },
        { room: "kitchenette", near: "hob" },
        { room: "shower", near: "bath" },
      ],
    },
  },
  {
    key: "garden",
    title: "Garden flat behind the library",
    addressLine: "Garden flat, 22 Library Street",
    depositAtto: gen(120),
    moveoutSeconds: DEMO_MOVEOUT_SECONDS,
    responseSeconds: DEMO_RESPONSE_SECONDS,
    blurb: "A ground-floor flat with its own lawn: a cracked back door pane, a faded hallway, a vague note about the garden.",
    lesson: "A vague note proves nothing: 'needs some attention' cannot show damage, so the garden deduction goes back to the tenant.",
    items: [
      { name: "Back door", move_in: "Glazed back door to the garden, both glass panes intact, lock and handle work." },
      { name: "Hallway walls", move_in: "Hallway painted pale green two years ago, even colour, no marks or holes." },
      { name: "Fridge", move_in: "Under-counter fridge clean and working, both shelves and the salad drawer present." },
      { name: "Lawn and borders", move_in: "Lawn cut short, borders weeded and planted with lavender along the back fence." },
    ],
    moveOut: [
      "The lower glass pane of the back door is cracked from corner to corner and taped over.",
      "Paint slightly faded where the sun reaches, a few light marks at shoulder height by the coat hooks.",
      "Fridge clean and working, both shelves and the salad drawer present and intact.",
      "The garden is in a different state from move-in and needs some attention.",
    ],
    deductions: [
      { item: 0, amount: gen(40), reason: "Replacing the cracked lower glass pane of the back door to the garden.", expect: "damage" },
      { item: 1, amount: gen(25), reason: "Repainting the hallway because the paint is faded and marked by the coat hooks.", expect: "wear" },
      { item: 3, amount: gen(20), reason: "Garden maintenance to bring the lawn and the borders back to how they were.", expect: "unclear" },
    ],
    plan: {
      cols: [150, 150],
      rows: [70, 110, 40, 100],
      rooms: [
        { id: "garden", label: "Garden", kind: "garden", c: 0, r: 0, cs: 2 },
        { id: "kitchen", label: "Kitchen", kind: "kitchen", c: 0, r: 1 },
        { id: "living", label: "Living room", kind: "living", c: 1, r: 1 },
        { id: "hall", label: "Hall", kind: "hall", c: 0, r: 2, cs: 2 },
        { id: "bed", label: "Bedroom", kind: "bed", c: 0, r: 3 },
        { id: "bath", label: "Bathroom", kind: "bath", c: 1, r: 3 },
      ],
      doors: [["kitchen", "garden"], ["hall", "kitchen"], ["hall", "living"], ["hall", "bed"], ["hall", "bath"]],
      entry: { room: "hall", side: "w" },
      items: [
        { room: "kitchen", at: [0.5, 0.12] },
        { room: "hall", near: "wall" },
        { room: "kitchen", near: "fridge" },
        { room: "garden", near: "lawn" },
      ],
    },
  },
  {
    key: "loft",
    title: "Loft room in the shared house on Elm Row",
    addressLine: "Room 4, 31 Elm Row",
    depositAtto: gen(60),
    moveoutSeconds: DEMO_MOVEOUT_SECONDS,
    responseSeconds: DEMO_RESPONSE_SECONDS,
    blurb: "A room under the roof with a skylight: a stained mattress, a worn desk top, a wardrobe and a skylight as found.",
    lesson: "Plain on both sides: a stain that soaked through the protector is damage, a worn patch where the wrists rest is wear.",
    items: [
      { name: "Mattress", move_in: "Double mattress with a fitted protector, new this year, no stains, sagging or tears." },
      { name: "Desk", move_in: "Pine desk with two drawers, top sanded and varnished, drawers run smoothly." },
      { name: "Skylight", move_in: "Skylight opens on its winder pole, glass clean, blind works, no leaks around the frame." },
      { name: "Wardrobe", move_in: "Two-door wardrobe, both doors close flush, hanging rail and shelf in place." },
    ],
    moveOut: [
      "A large dark stain about 30 cm across in the middle of the mattress, soaked through the protector.",
      "Light scratches and a worn patch in the varnish where the wrists rest; the drawers run smoothly.",
      "Skylight opens on its winder pole, glass clean, blind works, no leaks around the frame.",
      "Both doors close flush, the hanging rail and the shelf are in place as at move-in.",
    ],
    deductions: [
      { item: 0, amount: gen(25), reason: "Replacing the mattress, which has a large stain that went through the protector.", expect: "damage" },
      { item: 1, amount: gen(10), reason: "Sanding and revarnishing the desk top, which is scratched and worn.", expect: "wear" },
    ],
    plan: {
      cols: [200, 90],
      rows: [90, 90],
      rooms: [
        { id: "room", label: "Loft room", kind: "bedsit", c: 0, r: 0, rs: 2 },
        { id: "landing", label: "Landing", kind: "hall", c: 1, r: 0 },
        { id: "shower", label: "Shower", kind: "bath", c: 1, r: 1 },
      ],
      doors: [["landing", "room"], ["landing", "shower"]],
      entry: { room: "landing", side: "e" },
      items: [
        { room: "room", near: "bed" },
        { room: "room", near: "desk" },
        { room: "room", at: [0.55, 0.5] },
        { room: "room", near: "wardrobe" },
      ],
    },
  },
  {
    key: "station",
    title: "Ground-floor flat on Station Road",
    addressLine: "Flat A, 7 Station Road",
    depositAtto: gen(150),
    moveoutSeconds: DEMO_MOVEOUT_SECONDS,
    responseSeconds: DEMO_RESPONSE_SECONDS,
    blurb: "A bay-windowed flat by the station: a key that never came back, sun-faded curtains, cracked tiles, sound cupboards.",
    lesson: "Something missing is not wear: one front door key never came back, so the lock has to be changed.",
    items: [
      { name: "Front door keys", move_in: "Two front door keys and one key fob for the building handed over at move-in." },
      { name: "Living room curtains", move_in: "Cream lined curtains on the bay window, clean, hems intact, all hooks in place." },
      { name: "Bathroom tiles", move_in: "White wall tiles around the bath, no cracks, no drill holes, grout clean." },
      { name: "Kitchen cupboards", move_in: "Six white kitchen cupboard doors, hinges adjusted, no chips, all handles fitted." },
    ],
    moveOut: [
      "One front door key and the key fob were handed back; the second front door key is missing.",
      "Curtains faded on the side facing the window after two summers of sun; hems intact, hooks in place.",
      "Two tiles above the bath are cracked and there are four drill holes where a shelf was fixed.",
      "Six cupboard doors close properly, no chips, all handles fitted, the same as at move-in.",
    ],
    deductions: [
      { item: 0, amount: gen(20), reason: "Changing the front door lock and cutting new keys because one key was not returned.", expect: "damage" },
      { item: 1, amount: gen(15), reason: "Replacing the bay window curtains because they have faded.", expect: "wear" },
      { item: 2, amount: gen(30), reason: "Replacing two cracked tiles and filling the four drill holes above the bath.", expect: "damage" },
    ],
    plan: {
      cols: [170, 90, 110],
      rows: [120, 100],
      rooms: [
        { id: "living", label: "Living room", kind: "living", c: 0, r: 0 },
        { id: "hall", label: "Hall", kind: "hall", c: 1, r: 0, rs: 2 },
        { id: "kitchen", label: "Kitchen", kind: "kitchen", c: 2, r: 0 },
        { id: "bed", label: "Bedroom", kind: "bed", c: 0, r: 1 },
        { id: "bath", label: "Bathroom", kind: "bath", c: 2, r: 1 },
      ],
      doors: [["hall", "living"], ["hall", "kitchen"], ["hall", "bed"], ["hall", "bath"]],
      entry: { room: "hall", side: "n" },
      items: [
        { room: "hall", at: [0.5, 0.14] },
        { room: "living", near: "window" },
        { room: "bath", near: "bath" },
        { room: "kitchen", near: "counter" },
      ],
    },
  },
  {
    key: "harbour",
    title: "Top-floor flat with the balcony",
    addressLine: "Flat 9, 40 Harbour View",
    depositAtto: gen(200),
    moveoutSeconds: DEMO_MOVEOUT_SECONDS,
    responseSeconds: DEMO_RESPONSE_SECONDS,
    blurb: "Up under the roof with a balcony over the harbour: a marked oak table, a creased sofa, weathered decking.",
    lesson: "Weather and sitting are wear: the decking greyed in the rain and the sofa creased; the table's heat ring and gouge are not.",
    items: [
      { name: "Dining table", move_in: "Solid oak dining table seating six, top oiled, no burns, heat rings or gouges." },
      { name: "Leather sofa", move_in: "Three-seat leather sofa, two years old, no tears, scratches or stains." },
      { name: "Balcony decking", move_in: "Hardwood decking on the balcony, oiled in the spring, every board firm." },
      { name: "Kitchen sink", move_in: "Stainless steel sink and mixer tap, no leaks, plug and waste work." },
      { name: "Bedroom walls", move_in: "Bedroom walls painted light grey, no marks, holes or tape residue." },
    ],
    moveOut: [
      "A white heat ring about 20 cm across and a 4 cm deep gouge near the edge of the table top.",
      "Seat cushions slightly softer and the leather creased where people sit; no tears, scratches or stains.",
      "Every board firm; the oil has weathered to grey on the side open to the rain.",
      "Sink and mixer tap work with no leaks; plug and waste work as at move-in.",
      "Walls light grey with no marks, holes or tape residue, the same as at move-in.",
    ],
    deductions: [
      { item: 0, amount: gen(50), reason: "Sanding out and refinishing the oak table top to remove the heat ring and the gouge.", expect: "damage" },
      { item: 1, amount: gen(40), reason: "Reconditioning the leather sofa, which is creased and has lost its shape.", expect: "wear" },
      { item: 2, amount: gen(15), reason: "Sanding and re-oiling the balcony decking, which has gone grey.", expect: "wear" },
    ],
    plan: {
      cols: [120, 190, 100],
      rows: [50, 120, 110],
      rooms: [
        { id: "balcony", label: "Balcony", kind: "balcony", c: 0, r: 0, cs: 2 },
        { id: "kitchen", label: "Kitchen", kind: "kitchen", c: 0, r: 1 },
        { id: "living", label: "Living and dining", kind: "living", c: 1, r: 1 },
        { id: "hall", label: "Hall", kind: "hall", c: 2, r: 1, rs: 2 },
        { id: "bath", label: "Bathroom", kind: "bath", c: 0, r: 2 },
        { id: "bed", label: "Bedroom", kind: "bed", c: 1, r: 2 },
      ],
      doors: [["living", "balcony"], ["hall", "living"], ["living", "kitchen"], ["hall", "bed"], ["bed", "bath"]],
      entry: { room: "hall", side: "e" },
      items: [
        { room: "living", near: "table" },
        { room: "living", near: "sofa" },
        { room: "balcony", near: "deck" },
        { room: "kitchen", near: "sink" },
        { room: "bed", near: "wall" },
      ],
    },
  },
];

/** The sample flat a flat on chain is a copy of: the same title and the same items, word for word. */
export function sampleFor(title: string, items: { name: string; moveIn?: string; move_in?: string }[]): SampleFlat | null {
  for (const s of SAMPLE_FLATS) {
    if (s.title !== title || s.items.length !== items.length) continue;
    if (s.items.every((it, k) => it.name === items[k].name && it.move_in === (items[k].moveIn ?? items[k].move_in))) return s;
  }
  return null;
}

export const sampleByKey = (key: string): SampleFlat | null => SAMPLE_FLATS.find((s) => s.key === key) ?? null;

/** offer()'s arguments for a sample, in the contract's order. */
export function offerArgs(s: SampleFlat): [string, string, string, string, number, number] {
  return [s.title, s.addressLine, JSON.stringify(s.items), s.depositAtto, s.moveoutSeconds, s.responseSeconds];
}

/** report()'s two JSON arguments for a sample: the move-out notes and the deductions, without the scripted verdicts. */
export function reportArgs(s: SampleFlat): { moveoutJson: string; deductionsJson: string } {
  return {
    moveoutJson: JSON.stringify(s.moveOut),
    deductionsJson: JSON.stringify(s.deductions.map((d) => ({ item: d.item, amount: d.amount, reason: d.reason }))),
  };
}

/**
 * Why the demo landlord would not file this flat's report now; "" when it may. The server route and
 * the in-memory contract both ask this, from a flat as flat(id) answers it.
 */
export function demoReportProblem(
  flat: { landlord: string; status: string; title: string; items: { name: string; moveIn: string }[]; depositAtto: string; moveoutEnd: number },
  demoLandlord: string,
  nowSeconds: number,
): string {
  if (!demoLandlord) return "the demo landlord is offline";
  if (flat.landlord.toLowerCase() !== demoLandlord.toLowerCase()) return "this flat is not one of the demo landlord's";
  const sample = sampleFor(flat.title, flat.items);
  if (!sample) return "this flat is not a copy of a sample flat, so there is no scripted report for it";
  if (sample.depositAtto !== flat.depositAtto) return "this flat's deposit is not the sample's, so the scripted deductions do not fit it";
  if (flat.status === "reported" || flat.status === "clean" || flat.status === "accepted" || flat.status === "judged" || flat.status === "settled")
    return "the move-out report for this flat is already filed";
  if (flat.status !== "notice") return "the tenant has not given notice yet; the report comes after the notice";
  if (nowSeconds > 0 && flat.moveoutEnd > 0 && nowSeconds >= flat.moveoutEnd) return "the report window has closed; anyone may now reclaim the whole deposit for the tenant";
  return "";
}
