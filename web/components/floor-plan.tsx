"use client";

// The floor plan: the flat drawn as an architect's plan, walls, door swings and windows, with one
// numbered marker per item coloured by what happened to it. A marker (or its room) is a button that
// selects the item; the item list beside the plan follows the selection.

import * as React from "react";

import { ITEM_STATES, OUTER_WALL, INNER_WALL, STATE_FILL, STATE_TINT, strongest, type ItemState, type Plan, type Prim } from "@/lib/plans";
import { cx } from "@/lib/cx";

export const STATE_LABEL: Record<ItemState, string> = {
  untouched: "No deduction",
  deducted: "Deducted",
  contested: "Contested",
  damage: "Damage",
  wear: "Wear",
  unclear: "Unclear",
};

const INK = "#22303A";
const PAPER = "#F6F1E7";
const TERRACOTTA = "#B85C38";

function PrimShape({ p }: { p: Prim }) {
  const common = { fill: "none", stroke: INK, strokeOpacity: 0.5, strokeWidth: 1.1 } as const;
  switch (p.t) {
    case "rect":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={p.rx ?? 0} {...common} strokeDasharray={p.dash ? "3 3" : undefined} />;
    case "circle":
      return <circle cx={p.cx} cy={p.cy} r={p.r} {...common} />;
    case "ellipse":
      return <ellipse cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} {...common} />;
    case "line":
      return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} {...common} strokeDasharray={p.dash ? "3 3" : undefined} />;
  }
}

export function FloorPlan({
  plan,
  states,
  names = [],
  selected = null,
  onSelect,
  compact = false,
  fit = false,
  title,
  className,
}: {
  plan: Plan;
  states: ItemState[];
  /** item names, for the markers' accessible labels */
  names?: string[];
  selected?: number | null;
  onSelect?: (item: number) => void;
  /** a thumbnail: no labels, nothing to press */
  compact?: boolean;
  /** fill a box of fixed size, keeping the plan's proportions */
  fit?: boolean;
  title: string;
  className?: string;
}) {
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const hatch = `hatch${uid}`;
  const interactive = !!onSelect && !compact;
  const r = compact ? 11 : 12.5;

  return (
    <svg
      viewBox={`0 0 ${plan.width} ${plan.height}`}
      className={cx("block w-full select-none", fit ? "h-full" : "h-auto", className)}
      role={interactive ? "group" : "img"}
      aria-label={title}
    >
      <defs>
        <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" fill="rgba(184,92,56,0.07)" />
          <line x1="0" y1="0" x2="0" y2="7" stroke={TERRACOTTA} strokeOpacity="0.45" strokeWidth="2" />
        </pattern>
      </defs>

      {/* rooms, tinted by the strongest state of the items in them */}
      {plan.rooms.map((room) => {
        const mine = plan.markers.filter((m) => m.room === room.id);
        const st = strongest(mine.map((m) => states[m.item] ?? "untouched"));
        const fill = st === "contested" ? `url(#${hatch})` : STATE_TINT[st];
        const pick = interactive && mine.length ? () => onSelect!(mine[0].item) : undefined;
        const isSelected = selected !== null && mine.some((m) => m.item === selected);
        return (
          <rect
            key={room.id}
            x={room.x}
            y={room.y}
            width={room.w}
            height={room.h}
            fill={fill === "transparent" ? "rgba(0,0,0,0)" : fill}
            stroke={isSelected ? TERRACOTTA : "none"}
            strokeWidth={isSelected ? 2 : 0}
            strokeDasharray={isSelected ? "6 4" : undefined}
            onClick={pick}
            className={pick ? "cursor-pointer" : undefined}
            aria-hidden="true"
          />
        );
      })}

      <g aria-hidden="true" pointerEvents="none">
        {plan.furniture.map((p, i) => (
          <PrimShape key={i} p={p} />
        ))}
        {plan.rails.map((s, i) => (
          <line key={"r" + i} {...s} stroke={INK} strokeWidth={1.4} strokeDasharray="5 4" />
        ))}
        {plan.inner.map((s, i) => (
          <line key={"i" + i} {...s} stroke={INK} strokeWidth={INNER_WALL} strokeLinecap="square" />
        ))}
        {plan.outer.map((s, i) => (
          <line key={"o" + i} {...s} stroke={INK} strokeWidth={OUTER_WALL} strokeLinecap="square" />
        ))}
        {plan.windows.map((s, i) => {
          const h = s.y1 === s.y2;
          return (
            <g key={"w" + i}>
              <line {...s} stroke={PAPER} strokeWidth={OUTER_WALL + 1} />
              <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={INK} strokeWidth={0.8} />
              {[-2.4, 2.4].map((o) => (
                <line
                  key={o}
                  x1={h ? s.x1 : s.x1 + o}
                  y1={h ? s.y1 + o : s.y1}
                  x2={h ? s.x2 : s.x2 + o}
                  y2={h ? s.y2 + o : s.y2}
                  stroke={INK}
                  strokeWidth={1}
                />
              ))}
            </g>
          );
        })}
        {plan.doors.map((d, i) => (
          <g key={"d" + i}>
            <line {...d.gap} stroke={PAPER} strokeWidth={OUTER_WALL + 1} />
            <line {...d.leaf} stroke={INK} strokeWidth={1.5} />
            <path d={d.arc} fill="none" stroke={INK} strokeWidth={0.9} strokeDasharray="2 2" />
          </g>
        ))}
        {!compact &&
          plan.rooms.map((room) => (
            <text
              key={"t" + room.id}
              x={room.name.x}
              y={room.name.y}
              textAnchor={room.name.anchor}
              fontSize={9.5}
              fontWeight={700}
              letterSpacing={0.9}
              fill={INK}
              fillOpacity={0.72}
              style={{ fontFamily: "var(--font-sans)", textTransform: "uppercase" }}
            >
              {room.name.text}
            </text>
          ))}
      </g>

      {plan.markers.map((m) => {
        const st = states[m.item] ?? "untouched";
        const filled = st !== "untouched" && st !== "contested";
        const isSelected = selected === m.item;
        const label = `Item ${m.item + 1}${names[m.item] ? ", " + names[m.item] : ""}: ${STATE_LABEL[st].toLowerCase()}`;
        const body = (
          <>
            {interactive && <circle cx={m.x} cy={m.y} r={r + 7} fill="rgba(0,0,0,0)" />}
            {interactive && (
              <circle
                cx={m.x}
                cy={m.y}
                r={r + 5}
                fill="none"
                stroke={INK}
                strokeWidth={2.5}
                className="invisible group-focus-visible:visible"
              />
            )}
            {isSelected && <circle cx={m.x} cy={m.y} r={r + 4} fill="none" stroke={INK} strokeWidth={1.6} strokeDasharray="3 2.5" />}
            <circle
              cx={m.x}
              cy={m.y}
              r={r}
              fill={STATE_FILL[st]}
              stroke={st === "contested" ? TERRACOTTA : INK}
              strokeWidth={st === "contested" ? 2.6 : 1.5}
              strokeDasharray={st === "contested" ? "4 2.5" : undefined}
            />
            {!compact && (
              <text
                x={m.x}
                y={m.y + 4.4}
                textAnchor="middle"
                fontSize={12.5}
                fontWeight={700}
                fill={filled ? PAPER : INK}
                style={{ fontFamily: "var(--font-sans)" }}
              >
                {m.item + 1}
              </text>
            )}
          </>
        );
        if (!interactive)
          return (
            <g key={"m" + m.item} aria-hidden="true">
              {body}
            </g>
          );
        return (
          <g
            key={"m" + m.item}
            role="button"
            tabIndex={0}
            aria-label={label}
            aria-pressed={isSelected}
            className="group cursor-pointer outline-none"
            onClick={() => onSelect!(m.item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect!(m.item);
              }
            }}
          >
            <title>{label}</title>
            {body}
          </g>
        );
      })}
    </svg>
  );
}

/** What the colours of the plan mean. */
export function PlanLegend({ only, className }: { only?: ItemState[]; className?: string }) {
  const shown = only ?? ITEM_STATES;
  return (
    <ul className={cx("flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-ink-soft", className)} aria-label="What the colours mean">
      {shown.map((st) => (
        <li key={st} className="inline-flex items-center gap-1.5">
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
            <circle
              cx="10"
              cy="10"
              r="7.5"
              fill={STATE_FILL[st]}
              stroke={st === "contested" ? TERRACOTTA : INK}
              strokeWidth={st === "contested" ? 2.2 : 1.4}
              strokeDasharray={st === "contested" ? "3.5 2" : undefined}
            />
          </svg>
          {STATE_LABEL[st]}
        </li>
      ))}
    </ul>
  );
}
