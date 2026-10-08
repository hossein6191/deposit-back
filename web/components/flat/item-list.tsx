"use client";

// Every item of a flat, the move-in note beside the move-out note, and the deduction made for it
// with what happened to it. A row and its marker on the floor plan select each other.

import * as React from "react";

import { OUTCOME_WORDS, OutcomeStamp } from "@/components/stamps";
import { STATE_LABEL } from "@/components/floor-plan";
import type { Flat } from "@/lib/types";
import type { ItemState } from "@/lib/plans";
import { gen } from "@/lib/format";
import { cx } from "@/lib/cx";

const BADGE: Record<ItemState, string> = {
  untouched: "bg-card text-ink border-ink",
  deducted: "bg-terracotta text-paper border-ink",
  contested: "bg-card text-terracotta-ink border-terracotta border-dashed",
  damage: "bg-brick text-paper border-ink",
  wear: "bg-sage text-paper border-ink",
  unclear: "bg-ochre text-ink border-ink",
};

export function ItemBadge({ n, state, className }: { n: number; state: ItemState; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx("inline-flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold", BADGE[state], className)}
    >
      {n}
    </span>
  );
}

export function ItemList({
  flat,
  states,
  selected,
  onSelect,
}: {
  flat: Flat;
  states: ItemState[];
  selected: number | null;
  onSelect: (item: number) => void;
}) {
  const refs = React.useRef<(HTMLLIElement | null)[]>([]);
  const lastSelected = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (selected === null || selected === lastSelected.current) return;
    lastSelected.current = selected;
    const el = refs.current[selected];
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [selected]);

  const reported = flat.reportedAt > 0;
  return (
    <ol className="space-y-3" aria-label="The items of this flat">
      {flat.items.map((item) => {
        const d = flat.deductions.find((x) => x.item === item.index);
        const st = states[item.index] ?? "untouched";
        const isSel = selected === item.index;
        return (
          <li
            key={item.index}
            id={`item-${item.index + 1}`}
            ref={(el) => {
              refs.current[item.index] = el;
            }}
            className={cx(
              "sheet scroll-mt-28 p-3.5 sm:p-4",
              isSel && "outline-2 outline-offset-2 outline-terracotta",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(item.index)}
              aria-pressed={isSel}
              className="flex w-full items-center gap-2.5 rounded-sm text-left"
            >
              <ItemBadge n={item.index + 1} state={st} />
              <span className="min-w-0 flex-1 font-display text-lg leading-tight font-semibold">{item.name}</span>
              <span className="text-xs font-semibold text-ink-faint">{STATE_LABEL[st]}</span>
            </button>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">At move-in</p>
                <p className="mt-0.5 text-[0.95rem]">{item.moveIn}</p>
              </div>
              <div className="sm:border-l sm:border-dashed sm:border-rule-strong sm:pl-3">
                <p className="text-xs font-bold tracking-wider text-ink-faint uppercase">At move-out</p>
                <p className={cx("mt-0.5 text-[0.95rem]", !item.moveOut && "text-ink-faint italic")}>
                  {item.moveOut || (reported ? "No note." : "Not written yet: the landlord writes it in the move-out report.")}
                </p>
              </div>
            </div>
            {d && (
              <div className="mt-3 rounded-sm border-l-4 border-terracotta bg-paper-deep/70 px-3 py-2 text-sm">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-bold">{d.id}</span>
                  <span className="font-semibold tabular-nums">{gen(d.amountAtto)}</span>
                  <span className="text-ink-faint">deducted</span>
                  {d.verdict && <OutcomeStamp outcome={d.verdict} className="ml-auto" />}
                </p>
                <p className="mt-1 text-ink-soft">
                  <span className="font-semibold text-ink">The landlord&apos;s reason: </span>
                  {d.reason}
                </p>
                {d.verdict && (
                  <p className="mt-1 text-ink-soft">
                    {OUTCOME_WORDS[d.verdict].line}
                    {d.to && (
                      <>
                        {" "}
                        (<strong className="text-ink">{d.to === "tenant" ? "to the tenant" : "to the landlord"}</strong>)
                      </>
                    )}
                    .
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
