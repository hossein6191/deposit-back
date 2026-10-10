// Floor plans, as geometry. A plan is described on a grid (column widths, row heights, rooms that
// cover cells, which rooms a door joins, which room holds each item) and buildPlan() turns that into
// what is drawn: walls, door openings with their swing arcs, windows, a little furniture, and one
// numbered marker per item of the flat. components/floor-plan.tsx draws it as interactive SVG, and
// planSvg() below writes the same drawing as an SVG string for the shared-link image.
//
// The sample flats carry hand-made plans (lib/demo-flats.ts). Any other flat gets a plan drawn
// from its items: one room per item around a hall, the room's kind guessed from the item's name.
// No imports at runtime except the sample flats, so node runs it in tests/unit.

import { sampleFor } from "./demo-flats.ts";

export type RoomKind = "living" | "kitchen" | "bath" | "bed" | "bedsit" | "hall" | "garden" | "balcony" | "study" | "dining";
export type Side = "n" | "s" | "e" | "w";
export type RoomSpec = { id: string; label: string; kind: RoomKind; c: number; r: number; cs?: number; rs?: number };
export type ItemPlace = { room: string; near?: string; at?: [number, number] };
export type PlanSpec = {
  cols: number[];
  rows: number[];
  rooms: RoomSpec[];
  /** [from, into]: a door in the wall the two rooms share, swinging into the second */
  doors: [string, string][];
  entry?: { room: string; side: Side };
  /** where each item of the flat sits, in the items' order */
  items: ItemPlace[];
};

export type Rect = { x: number; y: number; w: number; h: number };
export type Seg = { x1: number; y1: number; x2: number; y2: number };
export type Prim =
  | { t: "rect"; x: number; y: number; w: number; h: number; rx?: number; dash?: boolean }
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { t: "line"; x1: number; y1: number; x2: number; y2: number; dash?: boolean };
/** Where a room's name is written: the baseline's start or end point, and the text as it fits. */
export type LabelGeo = { x: number; y: number; anchor: "start" | "end"; text: string };
export type RoomGeo = Rect & { id: string; label: string; kind: RoomKind; open: boolean; labelAt: "top" | "bottom"; name: LabelGeo };
export type DoorGeo = { gap: Seg; leaf: Seg; arc: string; entry: boolean };
export type Marker = { item: number; x: number; y: number; room: string };
export type Plan = {
  width: number;
  height: number;
  rooms: RoomGeo[];
  /** exterior walls, drawn heavy */
  outer: Seg[];
  /** walls between two rooms, drawn light */
  inner: Seg[];
  /** the open edge of a garden or a balcony */
  rails: Seg[];
  doors: DoorGeo[];
  windows: Seg[];
  furniture: Prim[];
  markers: Marker[];
};

export const PAD = 16;
export const OUTER_WALL = 6;
export const INNER_WALL = 3;
const OPEN_KINDS: RoomKind[] = ["garden", "balcony"];

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

type Interval = [number, number];

/** [a, b] minus every interval in `cuts`, as the pieces left (each longer than half a unit). */
function subtract([a, b]: Interval, cuts: Interval[]): Interval[] {
  let pieces: Interval[] = [[a, b]];
  for (const [c, d] of cuts) {
    const next: Interval[] = [];
    for (const [p, q] of pieces) {
      if (d <= p || c >= q) next.push([p, q]);
      else {
        if (c > p) next.push([p, c]);
        if (d < q) next.push([d, q]);
      }
    }
    pieces = next;
  }
  return pieces.filter(([p, q]) => q - p > 0.5);
}

type SideGeo = { side: Side; axis: "h" | "v"; at: number; span: Interval };

function sidesOf(r: Rect): SideGeo[] {
  return [
    { side: "n", axis: "h", at: r.y, span: [r.x, r.x + r.w] },
    { side: "s", axis: "h", at: r.y + r.h, span: [r.x, r.x + r.w] },
    { side: "w", axis: "v", at: r.x, span: [r.y, r.y + r.h] },
    { side: "e", axis: "v", at: r.x + r.w, span: [r.y, r.y + r.h] },
  ];
}
const OPPOSITE: Record<Side, Side> = { n: "s", s: "n", e: "w", w: "e" };

const segOf = (axis: "h" | "v", at: number, [p, q]: Interval): Seg =>
  axis === "h" ? { x1: p, y1: at, x2: q, y2: at } : { x1: at, y1: p, x2: at, y2: q };

/** The stretch of wall rooms a and b share, with the axis and the coordinate of that wall; null when they do not touch. */
function sharedWall(a: Rect, b: Rect): { axis: "h" | "v"; at: number; span: Interval; bSide: Side } | null {
  for (const s of sidesOf(a)) {
    const t = sidesOf(b).find((x) => x.side === OPPOSITE[s.side]);
    if (!t || t.at !== s.at) continue;
    const lo = Math.max(s.span[0], t.span[0]);
    const hi = Math.min(s.span[1], t.span[1]);
    if (hi - lo > 1) return { axis: s.axis, at: s.at, span: [lo, hi], bSide: t.side };
  }
  return null;
}

/**
 * A door of length `len` starting at `start` along a wall, hinged at the start and swinging to the
 * side `s` (+1 right or down, -1 left or up).
 */
function door(axis: "h" | "v", at: number, start: number, len: number, s: 1 | -1, entry: boolean): DoorGeo {
  if (axis === "v") {
    const gap = { x1: at, y1: start, x2: at, y2: start + len };
    const leaf = { x1: at, y1: start, x2: at + s * len, y2: start };
    const arc = `M${r1(at + s * len)} ${r1(start)} A${len} ${len} 0 0 ${s > 0 ? 1 : 0} ${r1(at)} ${r1(start + len)}`;
    return { gap, leaf, arc, entry };
  }
  const gap = { x1: start, y1: at, x2: start + len, y2: at };
  const leaf = { x1: start, y1: at, x2: start, y2: at + s * len };
  const arc = `M${r1(start)} ${r1(at + s * len)} A${len} ${len} 0 0 ${s > 0 ? 0 : 1} ${r1(start + len)} ${r1(at)}`;
  return { gap, leaf, arc, entry };
}

type Anchors = Record<string, [number, number]>;

/** Kinds whose furniture stands against the bottom wall, and kinds with something against the right wall. */
const FLIP_V: RoomKind[] = ["kitchen", "bath", "bed", "bedsit", "living"];
const FLIP_H: RoomKind[] = ["kitchen", "bath", "bed", "bedsit"];

/** Mirrors a room's furniture so that nothing stands where a door swings in. */
function mirror(r: Rect, prims: Prim[], anchors: Anchors, v: boolean, h: boolean): void {
  const fy = (y: number) => (v ? 2 * r.y + r.h - y : y);
  const fx = (x: number) => (h ? 2 * r.x + r.w - x : x);
  for (const p of prims) {
    if (p.t === "rect") {
      if (v) p.y = 2 * r.y + r.h - p.y - p.h;
      if (h) p.x = 2 * r.x + r.w - p.x - p.w;
    } else if (p.t === "circle" || p.t === "ellipse") {
      p.cx = fx(p.cx);
      p.cy = fy(p.cy);
    } else {
      p.x1 = fx(p.x1);
      p.x2 = fx(p.x2);
      p.y1 = fy(p.y1);
      p.y2 = fy(p.y2);
    }
  }
  for (const k of Object.keys(anchors)) anchors[k] = [fx(anchors[k][0]), fy(anchors[k][1])];
}

/** The furniture of one room, drawn in thin lines, and the named spots an item marker can sit on. */
function furnish(r: RoomGeo, swingSides: Side[]): { prims: Prim[]; anchors: Anchors; flipV: boolean } {
  const out = furnishUpright(r);
  const flipV = FLIP_V.includes(r.kind) && swingSides.includes("s") && !swingSides.includes("n");
  const flipH = FLIP_H.includes(r.kind) && swingSides.includes("e") && !swingSides.includes("w");
  if (flipV || flipH) mirror(r, out.prims, out.anchors, flipV, flipH);
  return { ...out, flipV };
}

/** The furniture as it stands when no door swings into the bottom or the right wall. */
function furnishUpright(r: RoomGeo): { prims: Prim[]; anchors: Anchors } {
  const prims: Prim[] = [];
  const anchors: Anchors = {};
  const m = 6;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  anchors.floor = [cx, cy + Math.min(10, r.h * 0.1)];
  anchors.wall = [r.x + r.w - 18, r.y + 20];
  const bed = (len: number, wid: number) => {
    const bx = r.x + r.w - m - len;
    const by = r.y + r.h - m - wid;
    prims.push({ t: "rect", x: bx, y: by, w: len, h: wid, rx: 3 });
    prims.push({ t: "rect", x: bx + len - 16, y: by + 4, w: 12, h: wid / 2 - 6, rx: 2 });
    prims.push({ t: "rect", x: bx + len - 16, y: by + wid / 2 + 2, w: 12, h: wid / 2 - 6, rx: 2 });
    prims.push({ t: "line", x1: bx + len * 0.55, y1: by, x2: bx + len * 0.55, y2: by + wid });
    anchors.bed = [bx + len * 0.32, by + wid / 2];
    anchors.mattress = anchors.bed;
  };
  const wardrobe = () => {
    const ww = Math.min(52, r.w * 0.3);
    const wx = r.x + m;
    const wy = r.y + r.h - m - 18;
    prims.push({ t: "rect", x: wx, y: wy, w: ww, h: 18 });
    prims.push({ t: "line", x1: wx + ww / 2, y1: wy, x2: wx + ww / 2, y2: wy + 18 });
    anchors.wardrobe = [wx + ww / 2, wy - 12];
  };
  switch (r.kind) {
    case "living": {
      const sw = Math.min(r.w * 0.5, 100);
      const sx = cx - sw / 2;
      const sy = r.y + r.h - m - 26;
      prims.push({ t: "rect", x: sx, y: sy, w: sw, h: 26, rx: 4 });
      prims.push({ t: "line", x1: sx + 7, y1: sy + 18, x2: sx + sw - 7, y2: sy + 18 });
      prims.push({ t: "line", x1: sx + 7, y1: sy, x2: sx + 7, y2: sy + 26 });
      prims.push({ t: "line", x1: sx + sw - 7, y1: sy, x2: sx + sw - 7, y2: sy + 26 });
      anchors.sofa = [cx, sy + 9];
      if (r.h >= 110) {
        const tw = sw * 0.46;
        prims.push({ t: "rect", x: cx - tw / 2, y: sy - 26, w: tw, h: 14, rx: 2 });
        anchors.table = [cx, sy - 19];
      }
      if (r.w >= 170) {
        const tw = 54;
        const tx = r.x + r.w - m - tw - 10;
        const ty = r.y + 28;
        prims.push({ t: "rect", x: tx, y: ty, w: tw, h: 30, rx: 2 });
        for (const k of [0.2, 0.5, 0.8]) {
          prims.push({ t: "rect", x: tx + tw * k - 5, y: ty - 9, w: 10, h: 7, rx: 1.5 });
          prims.push({ t: "rect", x: tx + tw * k - 5, y: ty + 32, w: 10, h: 7, rx: 1.5 });
        }
        anchors.table = [tx + tw / 2, ty + 15];
        anchors.wall = [r.x + 22, r.y + r.h * 0.55];
      }
      anchors.floor = [r.x + r.w * 0.35, cy];
      break;
    }
    case "kitchen": {
      const ky = r.y + r.h - 4 - 20;
      prims.push({ t: "rect", x: r.x + 4, y: ky, w: r.w - 8, h: 20 });
      const hx = r.x + r.w * 0.68;
      for (const [dx, dy] of [[-6, 5], [6, 5], [-6, 15], [6, 15]]) prims.push({ t: "circle", cx: hx + dx, cy: ky + dy, r: 3.4 });
      const sx = r.x + r.w * 0.24;
      prims.push({ t: "rect", x: sx - 10, y: ky + 3, w: 20, h: 14, rx: 2 });
      prims.push({ t: "rect", x: sx - 7, y: ky + 6, w: 14, h: 8, rx: 1.5 });
      prims.push({ t: "rect", x: r.x + r.w - 4 - 22, y: r.y + 4, w: 22, h: 22 });
      prims.push({ t: "line", x1: r.x + r.w - 26, y1: r.y + 10, x2: r.x + r.w - 4, y2: r.y + 10 });
      anchors.hob = [hx, ky - 13];
      anchors.sink = [sx, ky - 13];
      anchors.counter = [r.x + r.w * 0.46, ky - 13];
      anchors.cupboard = anchors.counter;
      anchors.fridge = [r.x + r.w - 15, r.y + 38];
      anchors.oven = anchors.hob;
      break;
    }
    case "bath": {
      const bw = Math.min(r.w - 38, 74);
      const by = r.y + r.h - 4 - 28;
      prims.push({ t: "rect", x: r.x + 4, y: by, w: bw, h: 28, rx: 7 });
      prims.push({ t: "rect", x: r.x + 8, y: by + 4, w: bw - 8, h: 20, rx: 6 });
      prims.push({ t: "ellipse", cx: r.x + r.w - 15, cy: r.y + r.h - 17, rx: 7, ry: 10 });
      prims.push({ t: "rect", x: r.x + r.w - 23, y: r.y + r.h - 8, w: 16, h: 4 });
      prims.push({ t: "rect", x: r.x + r.w - 4 - 22, y: r.y + 26, w: 22, h: 16, rx: 3 });
      prims.push({ t: "ellipse", cx: r.x + r.w - 15, cy: r.y + 34, rx: 6, ry: 4.5 });
      anchors.bath = [r.x + 4 + bw / 2, by - 12];
      anchors.tiles = anchors.bath;
      anchors.shower = anchors.bath;
      anchors.basin = [r.x + r.w - 40, r.y + 34];
      anchors.mirror = anchors.basin;
      anchors.wc = [r.x + r.w - 15, r.y + r.h - 40];
      break;
    }
    case "bed": {
      bed(Math.min(r.w * 0.5, 92), Math.min(r.h * 0.56, 62));
      wardrobe();
      anchors.floor = [r.x + r.w * 0.3, r.y + r.h * 0.48];
      anchors.wall = [r.x + r.w * 0.55, r.y + 20];
      break;
    }
    case "bedsit": {
      bed(Math.min(r.w * 0.46, 88), Math.min(r.h * 0.34, 58));
      wardrobe();
      const dw = 52;
      const dx = r.x + r.w - m - dw;
      prims.push({ t: "rect", x: dx, y: r.y + m, w: dw, h: 22 });
      prims.push({ t: "circle", cx: dx + dw / 2, cy: r.y + m + 34, r: 7 });
      anchors.desk = [dx - 14, r.y + m + 12];
      break;
    }
    case "study": {
      const dw = 56;
      const dx = r.x + r.w - m - dw;
      prims.push({ t: "rect", x: dx, y: r.y + m, w: dw, h: 22 });
      prims.push({ t: "circle", cx: dx + dw / 2, cy: r.y + m + 34, r: 7 });
      anchors.desk = [dx - 14, r.y + m + 12];
      break;
    }
    case "dining": {
      const tw = Math.min(70, r.w * 0.5);
      prims.push({ t: "rect", x: cx - tw / 2, y: cy - 16, w: tw, h: 32, rx: 2 });
      anchors.table = [cx, cy];
      break;
    }
    case "hall": {
      const hx = r.x + r.w - 14;
      for (let k = 0; k < 3; k++) prims.push({ t: "circle", cx: hx - k * 9, cy: r.y + 7, r: 2 });
      anchors.wall = [r.x + r.w * 0.6, r.y + r.h * 0.55];
      anchors.door = [r.x + r.w / 2, r.y + r.h / 2];
      break;
    }
    case "garden": {
      prims.push({ t: "rect", x: r.x + 14, y: r.y + 16, w: r.w - 28, h: r.h - 26, rx: 10, dash: true });
      for (let x = r.x + 16; x < r.x + r.w - 10; x += 26) prims.push({ t: "circle", cx: x, cy: r.y + 9, r: 5 });
      anchors.lawn = [cx, cy + 4];
      anchors.border = [cx, r.y + 14];
      break;
    }
    case "balcony": {
      for (let x = r.x + 10; x < r.x + r.w - 4; x += 12) prims.push({ t: "line", x1: x, y1: r.y + 4, x2: x, y2: r.y + r.h - 4 });
      anchors.deck = [cx, cy];
      break;
    }
  }
  return { prims, anchors };
}

/** Turns a plan description into the drawing. */
export function buildPlan(spec: PlanSpec): Plan {
  const width = PAD * 2 + sum(spec.cols);
  const height = PAD * 2 + sum(spec.rows);
  const rooms: RoomGeo[] = spec.rooms.map((s) => ({
    id: s.id,
    label: s.label,
    kind: s.kind,
    open: OPEN_KINDS.includes(s.kind),
    labelAt: "top" as const,
    name: { x: 0, y: 0, anchor: "start" as const, text: s.label },
    x: PAD + sum(spec.cols.slice(0, s.c)),
    y: PAD + sum(spec.rows.slice(0, s.r)),
    w: sum(spec.cols.slice(s.c, s.c + (s.cs ?? 1))),
    h: sum(spec.rows.slice(s.r, s.r + (s.rs ?? 1))),
  }));
  const byId = new Map(rooms.map((r) => [r.id, r]));

  // Walls: each side of each room, split into the stretches it shares with a neighbour and the rest.
  const outer: Seg[] = [];
  const inner: Seg[] = [];
  const rails: Seg[] = [];
  const outerByRoom = new Map<string, { side: Side; seg: Seg; len: number }[]>();
  rooms.forEach((room, i) => {
    for (const s of sidesOf(room)) {
      const shared: { span: Interval; other: RoomGeo; j: number }[] = [];
      rooms.forEach((other, j) => {
        if (j === i) return;
        const t = sidesOf(other).find((x) => x.side === OPPOSITE[s.side]);
        if (!t || t.at !== s.at) return;
        const lo = Math.max(s.span[0], t.span[0]);
        const hi = Math.min(s.span[1], t.span[1]);
        if (hi - lo > 0.5) shared.push({ span: [lo, hi], other, j });
      });
      for (const sh of shared) {
        if (sh.j < i) continue; // each shared wall once
        const seg = segOf(s.axis, s.at, sh.span);
        if (room.open && sh.other.open) rails.push(seg);
        else if (room.open || sh.other.open) outer.push(seg);
        else inner.push(seg);
      }
      for (const piece of subtract(s.span, shared.map((x) => x.span))) {
        const seg = segOf(s.axis, s.at, piece);
        if (room.open) rails.push(seg);
        else {
          outer.push(seg);
          const list = outerByRoom.get(room.id) ?? [];
          list.push({ side: s.side, seg, len: piece[1] - piece[0] });
          outerByRoom.set(room.id, list);
        }
      }
    }
  });

  // Doors between rooms, centred on the wall they share, swinging into the second room.
  const doors: DoorGeo[] = [];
  const swings = new Map<string, Side[]>();
  const swingInto = (room: string, side: Side) => swings.set(room, [...(swings.get(room) ?? []), side]);
  for (const [fromId, intoId] of spec.doors) {
    const a = byId.get(fromId);
    const b = byId.get(intoId);
    if (!a || !b) continue;
    const w = sharedWall(a, b);
    if (!w) continue;
    const span = w.span[1] - w.span[0];
    const len = Math.max(14, Math.min(28, span - 12));
    const start = w.span[0] + (span - len) / 2;
    // b lies beyond the wall on the side it faces: its west side faces right (+1), its north side faces down (+1).
    const s: 1 | -1 = w.bSide === "w" || w.bSide === "n" ? 1 : -1;
    doors.push(door(w.axis, w.at, start, len, s, false));
    swingInto(b.id, w.bSide);
  }
  let entrySpan: { room: string; side: Side; span: Interval } | null = null;
  if (spec.entry) {
    const r = byId.get(spec.entry.room);
    if (r) {
      const side = spec.entry.side;
      const axis = side === "n" || side === "s" ? "h" : "v";
      const at = side === "n" ? r.y : side === "s" ? r.y + r.h : side === "w" ? r.x : r.x + r.w;
      const [p, q] = axis === "h" ? [r.x, r.x + r.w] : [r.y, r.y + r.h];
      const len = Math.max(14, Math.min(30, q - p - 12));
      const start = p + (q - p - len) / 2;
      const s: 1 | -1 = side === "n" || side === "w" ? 1 : -1;
      doors.push(door(axis, at, start, len, s, true));
      swingInto(r.id, side);
      entrySpan = { room: r.id, side, span: [start - 4, start + len + 4] };
    }
  }

  // Windows: the longest stretches of each room's exterior wall, never over the front door.
  const windows: Seg[] = [];
  const windowAt = new Map<string, [number, number]>();
  for (const room of rooms) {
    if (room.open || room.kind === "hall") continue;
    const list = (outerByRoom.get(room.id) ?? []).filter((o) => o.len >= 44).sort((a, b) => b.len - a.len);
    for (const o of list.slice(0, room.kind === "bath" ? 1 : 2)) {
      const horizontal = o.seg.y1 === o.seg.y2;
      const [p, q] = horizontal ? [o.seg.x1, o.seg.x2] : [o.seg.y1, o.seg.y2];
      const len = Math.min(room.kind === "bath" ? 30 : 64, (q - p) * 0.46);
      const start = p + (q - p - len) / 2;
      if (entrySpan && entrySpan.room === room.id && entrySpan.side === o.side && start < entrySpan.span[1] && start + len > entrySpan.span[0]) continue;
      const seg = horizontal ? { x1: start, y1: o.seg.y1, x2: start + len, y2: o.seg.y1 } : { x1: o.seg.x1, y1: start, x2: o.seg.x1, y2: start + len };
      windows.push(seg);
      if (!windowAt.has(room.id)) {
        const mx = (seg.x1 + seg.x2) / 2;
        const my = (seg.y1 + seg.y2) / 2;
        // the marker sits just inside the room, off the wall
        const ix = horizontal ? mx : mx + (o.side === "w" ? 18 : -18);
        const iy = horizontal ? my + (o.side === "n" ? 18 : -18) : my;
        windowAt.set(room.id, [ix, iy]);
      }
    }
  }

  // Furniture, and the markers of the items.
  const furniture: Prim[] = [];
  const anchorsOf = new Map<string, Anchors>();
  for (const room of rooms) {
    const f = furnish(room, swings.get(room.id) ?? []);
    if (f.flipV) room.labelAt = "bottom";
    furniture.push(...f.prims);
    const w = windowAt.get(room.id);
    if (w) f.anchors.window = w;
    anchorsOf.set(room.id, f.anchors);
  }
  const markers: Marker[] = [];
  spec.items.forEach((place, item) => {
    const room = byId.get(place.room) ?? rooms[0];
    const anchors = anchorsOf.get(room.id) ?? {};
    let [x, y] = place.near && anchors[place.near] ? anchors[place.near] : place.at ? [room.x + room.w * place.at[0], room.y + room.h * place.at[1]] : [room.x + room.w / 2, room.y + room.h / 2];
    const inset = 13;
    x = Math.min(Math.max(x, room.x + inset), room.x + room.w - inset);
    y = Math.min(Math.max(y, room.y + inset), room.y + room.h - inset);
    for (let tries = 0; tries < 6 && markers.some((m) => Math.hypot(m.x - x, m.y - y) < 24); tries++) {
      x = Math.min(x + 24, room.x + room.w - inset);
      if (markers.some((m) => Math.hypot(m.x - x, m.y - y) < 24)) y = Math.min(y + 24, room.y + room.h - inset);
    }
    markers.push({ item, x: r1(x), y: r1(y), room: room.id });
  });

  // Room names: a corner clear of every door's swing and every marker, the furniture's side last.
  const swingBoxes = doors.map((d) => ({
    x0: Math.min(d.gap.x1, d.gap.x2, d.leaf.x2) - 3,
    x1: Math.max(d.gap.x1, d.gap.x2, d.leaf.x2) + 3,
    y0: Math.min(d.gap.y1, d.gap.y2, d.leaf.y2) - 3,
    y1: Math.max(d.gap.y1, d.gap.y2, d.leaf.y2) + 3,
  }));
  for (const room of rooms) {
    const most = Math.max(3, Math.floor((room.w - 16) / LABEL_CHAR));
    const text = room.label.length > most ? room.label.slice(0, Math.max(3, most - 1)) + "." : room.label;
    const wide = text.length * LABEL_CHAR;
    const top = room.y + 15;
    const bottom = room.y + room.h - 8;
    const rows = room.labelAt === "top" ? [top, bottom] : [bottom, top];
    const options: LabelGeo[] = [];
    for (const y of rows) {
      options.push({ x: room.x + 7, y, anchor: "start", text });
      options.push({ x: room.x + room.w - 7, y, anchor: "end", text });
    }
    const clear = (o: LabelGeo) => {
      const x0 = o.anchor === "start" ? o.x : o.x - wide;
      const box = { x0, x1: x0 + wide, y0: o.y - 10, y1: o.y + 2 };
      const hit = (b: { x0: number; x1: number; y0: number; y1: number }) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0;
      if (swingBoxes.some(hit)) return false;
      return !markers.some((m) => hit({ x0: m.x - 14, x1: m.x + 14, y0: m.y - 14, y1: m.y + 14 }));
    };
    room.name = options.find(clear) ?? options[0];
  }

  return { width, height, rooms, outer, inner, rails, doors, windows, furniture, markers };
}

/** The width one letter of a room name takes, in plan units (9.5 px bold capitals with tracking). */
const LABEL_CHAR = 6.6;

// ---- a plan for any flat -----------------------------------------------------------------------

const KIND_WORDS: [RoomKind, RegExp][] = [
  ["kitchen", /kitchen|oven|hob|cooker|fridge|freezer|worktop|counter|sink|dishwasher|cupboard|microwave|kettle/i],
  ["bath", /bath|shower|toilet|\bwc\b|basin|mirror|tile|loo/i],
  ["bed", /bed|mattress|wardrobe|pillow|duvet|bedroom/i],
  ["garden", /garden|lawn|border|patio|fence|hedge|shed|yard/i],
  ["balcony", /balcony|terrace|deck/i],
  ["study", /desk|study|office|bookcase|shelf|shelves/i],
  ["dining", /table|dining|chairs/i],
  ["living", /sofa|couch|living|lounge|tv|television|curtain|carpet|rug|fireplace/i],
];

/** The kind of room an item most likely sits in, from its name. */
export function guessKind(name: string): RoomKind {
  for (const [kind, re] of KIND_WORDS) if (re.test(name)) return kind;
  return "living";
}

const DEFAULT_NEAR: Partial<Record<RoomKind, string>> = {
  kitchen: "counter",
  bath: "basin",
  bed: "bed",
  living: "floor",
  garden: "lawn",
  balcony: "deck",
  study: "desk",
  dining: "table",
};

/** A plan drawn from the items alone: one room per item, two rows around a hall. */
export function genericSpec(items: { name: string }[]): PlanSpec {
  const n = Math.max(1, items.length);
  const k = Math.ceil(n / 2);
  const width = k <= 2 ? 300 : 440;
  const cols = Array.from({ length: k }, () => Math.round(width / k));
  const rows = [110, 40, 110];
  const rooms: RoomSpec[] = [];
  const places: ItemPlace[] = [];
  items.forEach((it, i) => {
    const top = i < k;
    const c = top ? i : i - k;
    const kind = guessKind(it.name);
    // a closed room for every item, even a garden one: this plan is a sketch of the list, not of the land
    const shown: RoomKind = kind === "garden" || kind === "balcony" ? "living" : kind;
    const lastBottom = !top && i === n - 1 && n - k < k;
    rooms.push({ id: "i" + i, label: it.name, kind: shown, c, r: top ? 0 : 2, cs: lastBottom ? k - c : 1 });
    places.push({ room: "i" + i, near: DEFAULT_NEAR[shown] });
  });
  rooms.push({ id: "hall", label: "Hall", kind: "hall", c: 0, r: 1, cs: k });
  return {
    cols,
    rows,
    rooms,
    doors: items.map((_, i) => ["hall", "i" + i] as [string, string]),
    entry: { room: "hall", side: "w" },
    items: places,
  };
}

const cache = new Map<string, Plan>();

/** The plan of a flat: its sample's own plan when it is a copy of one, else one drawn from its items. */
export function planForFlat(title: string, items: { name: string; moveIn?: string; move_in?: string }[]): Plan {
  const key = title + "\u0000" + items.map((i) => i.name + "\u0001" + (i.moveIn ?? i.move_in ?? "")).join("\u0002");
  const hit = cache.get(key);
  if (hit) return hit;
  const sample = sampleFor(title, items);
  const plan = buildPlan(sample ? sample.plan : genericSpec(items));
  if (cache.size > 64) cache.clear();
  cache.set(key, plan);
  return plan;
}

// ---- the state of each item -----------------------------------------------------------------

export type ItemState = "untouched" | "deducted" | "contested" | "damage" | "wear" | "unclear";
export const ITEM_STATES: ItemState[] = ["untouched", "deducted", "contested", "damage", "wear", "unclear"];

/** Which state wins when one room holds several items. */
const WEIGHT: Record<ItemState, number> = { untouched: 0, wear: 1, deducted: 2, contested: 3, unclear: 4, damage: 5 };
export const strongest = (states: ItemState[]): ItemState => states.reduce<ItemState>((a, b) => (WEIGHT[b] > WEIGHT[a] ? b : a), "untouched");

/**
 * The state of every item of a flat: untouched when nothing was deducted for it; the network's word
 * once a contested deduction is judged; contested while the tenant has it ticked (or the contest is
 * in flight); deducted for a deduction that stands as filed or is not answered yet.
 */
export function itemStates(
  itemCount: number,
  deductions: { item: number; index: number; verdict: string }[],
  ticked: ReadonlySet<number> = new Set(),
): ItemState[] {
  const out: ItemState[] = Array.from({ length: itemCount }, () => "untouched");
  for (const d of deductions) {
    if (d.item < 0 || d.item >= itemCount) continue;
    if (d.verdict === "damage" || d.verdict === "wear" || d.verdict === "unclear") out[d.item] = d.verdict;
    else if (!d.verdict && ticked.has(d.index)) out[d.item] = "contested";
    else out[d.item] = "deducted";
  }
  return out;
}

// ---- the drawing as an SVG string ---------------------------------------------------------------

export const PLAN_COLORS = {
  paper: "#F6F1E7",
  ink: "#22303A",
  terracotta: "#B85C38",
  sage: "#5E7F63",
  brick: "#A63D32",
  ochre: "#C28A2C",
} as const;

export const STATE_FILL: Record<ItemState, string> = {
  untouched: PLAN_COLORS.paper,
  deducted: PLAN_COLORS.terracotta,
  contested: PLAN_COLORS.paper,
  damage: PLAN_COLORS.brick,
  wear: PLAN_COLORS.sage,
  unclear: PLAN_COLORS.ochre,
};
export const STATE_TINT: Record<ItemState, string> = {
  untouched: "transparent",
  deducted: "rgba(184,92,56,0.13)",
  contested: "rgba(184,92,56,0.10)",
  damage: "rgba(166,61,50,0.17)",
  wear: "rgba(94,127,99,0.18)",
  unclear: "rgba(194,138,44,0.20)",
};

const attr = (n: number) => String(r1(n));
const line = (s: Seg, stroke: string, w: number, extra = "") =>
  `<line x1="${attr(s.x1)}" y1="${attr(s.y1)}" x2="${attr(s.x2)}" y2="${attr(s.y2)}" stroke="${stroke}" stroke-width="${w}"${extra}/>`;

function primSvg(p: Prim, stroke: string): string {
  const base = `fill="none" stroke="${stroke}" stroke-width="1.1"`;
  switch (p.t) {
    case "rect":
      return `<rect x="${attr(p.x)}" y="${attr(p.y)}" width="${attr(p.w)}" height="${attr(p.h)}" rx="${p.rx ?? 0}" ${base}${p.dash ? ' stroke-dasharray="3 3"' : ""}/>`;
    case "circle":
      return `<circle cx="${attr(p.cx)}" cy="${attr(p.cy)}" r="${attr(p.r)}" ${base}/>`;
    case "ellipse":
      return `<ellipse cx="${attr(p.cx)}" cy="${attr(p.cy)}" rx="${attr(p.rx)}" ry="${attr(p.ry)}" ${base}/>`;
    case "line":
      return `<line x1="${attr(p.x1)}" y1="${attr(p.y1)}" x2="${attr(p.x2)}" y2="${attr(p.y2)}" ${base}${p.dash ? ' stroke-dasharray="3 3"' : ""}/>`;
  }
}

/** The plan as an SVG document string, with the items coloured by state. No text: an image renderer may lack the fonts. */
export function planSvg(plan: Plan, states: ItemState[]): string {
  const c = PLAN_COLORS;
  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.width} ${plan.height}" width="${plan.width}" height="${plan.height}">`);
  parts.push(`<rect width="${plan.width}" height="${plan.height}" fill="${c.paper}"/>`);
  for (const room of plan.rooms) {
    const mine = plan.markers.filter((m) => m.room === room.id).map((m) => states[m.item] ?? "untouched");
    const tint = STATE_TINT[strongest(mine)];
    if (tint !== "transparent") parts.push(`<rect x="${room.x}" y="${room.y}" width="${room.w}" height="${room.h}" fill="${tint}"/>`);
  }
  for (const p of plan.furniture) parts.push(primSvg(p, "rgba(34,48,58,0.55)"));
  for (const s of plan.rails) parts.push(line(s, c.ink, 1.4, ' stroke-dasharray="5 4"'));
  for (const s of plan.inner) parts.push(line(s, c.ink, INNER_WALL, ' stroke-linecap="square"'));
  for (const s of plan.outer) parts.push(line(s, c.ink, OUTER_WALL, ' stroke-linecap="square"'));
  for (const s of plan.windows) {
    parts.push(line(s, c.paper, OUTER_WALL + 1));
    const h = s.y1 === s.y2;
    for (const off of [-2.2, 2.2]) {
      parts.push(line(h ? { ...s, y1: s.y1 + off, y2: s.y2 + off } : { ...s, x1: s.x1 + off, x2: s.x2 + off }, c.ink, 1));
    }
  }
  for (const d of plan.doors) {
    parts.push(line(d.gap, c.paper, OUTER_WALL + 1));
    parts.push(line(d.leaf, c.ink, 1.4));
    parts.push(`<path d="${d.arc}" fill="none" stroke="${c.ink}" stroke-width="0.9" stroke-dasharray="2 2"/>`);
  }
  for (const m of plan.markers) {
    const st = states[m.item] ?? "untouched";
    const fill = STATE_FILL[st];
    parts.push(`<circle cx="${m.x}" cy="${m.y}" r="9" fill="${fill}" stroke="${st === "contested" ? c.terracotta : c.ink}" stroke-width="${st === "contested" ? 2.2 : 1.4}"/>`);
  }
  parts.push("</svg>");
  return parts.join("");
}
