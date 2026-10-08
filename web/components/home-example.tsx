"use client";

// The home page's live example: the newest flat on chain whose tenant contested, drawn as a plan
// with the network's words on it. Until there is one, the worked example from the README.

import * as React from "react";
import Link from "next/link";

import { FloorPlan, PlanLegend } from "@/components/floor-plan";
import { ItemBadge } from "@/components/flat/item-list";
import { SplitBar } from "@/components/split-bar";
import { OUTCOME_WORDS, OutcomeStamp } from "@/components/stamps";
import { useRead } from "@/components/use-read";
import { flatPath, hasContract, readFlat, readFlatPage, readStats } from "@/lib/chain";
import { exampleFlat } from "@/lib/example";
import { gen } from "@/lib/format";
import { itemStates, planForFlat } from "@/lib/plans";
import { PAGE } from "@/lib/rules";
import type { Flat, ReadResult } from "@/lib/types";

/** The newest judged flat on chain, or null: three reads at most. */
async function readNewestJudged(): Promise<ReadResult<Flat | null>> {
  const stats = await readStats();
  if (stats.data.judged === 0) return { data: null, source: stats.source };
  const page = await readFlatPage(Math.max(0, stats.data.flats - PAGE), PAGE);
  const row = [...page.data.rows].reverse().find((r) => r.status === "judged");
  if (!row) return { data: null, source: stats.source };
  return readFlat(row.id);
}

export function HomeExample() {
  const live = useRead(() => readNewestJudged(), [], { enabled: hasContract() });
  const fallback = React.useMemo(() => exampleFlat(), []);
  const flat = live.data ?? fallback;
  const isLive = !!live.data;
  const firstDamage = flat.deductions.find((d) => d.verdict === "damage")?.item ?? 0;
  const [picked, setPicked] = React.useState<number | null>(null);
  const selected = picked ?? firstDamage;
  const plan = planForFlat(flat.title, flat.items);
  const states = itemStates(flat.items.length, flat.deductions);
  const item = flat.items[selected];
  const d = flat.deductions.find((x) => x.item === selected);
  const deposit = BigInt(flat.depositAtto);

  return (
    <figure className="sheet p-3 sm:p-4">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <span className="eyebrow">{isLive ? `On chain now: ${flat.id}, judged` : "A worked example"}</span>
        <span className="text-sm font-semibold">{flat.title}</span>
      </figcaption>
      <div className="mt-2 rounded-sm border border-rule bg-paper p-1.5">
        <FloorPlan
          plan={plan}
          states={states}
          names={flat.items.map((i) => i.name)}
          selected={selected}
          onSelect={(k) => setPicked(k)}
          title={`Floor plan of ${flat.title}, with the verdict on each item`}
        />
      </div>
      <PlanLegend className="mt-2 px-1 text-xs" only={["untouched", "deducted", "damage", "wear", "unclear"]} />
      {item && (
        <div className="mt-3 rounded-sm border border-rule bg-card p-3" aria-live="polite">
          <p className="flex items-center gap-2 font-display text-lg font-semibold">
            <ItemBadge n={selected + 1} state={states[selected]} />
            {item.name}
            {d?.verdict && <OutcomeStamp outcome={d.verdict} className="ml-auto" />}
          </p>
          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="block text-xs font-bold tracking-wider text-ink-faint uppercase">In</span>
              {item.moveIn}
            </p>
            <p>
              <span className="block text-xs font-bold tracking-wider text-ink-faint uppercase">Out</span>
              {item.moveOut}
            </p>
          </div>
          {d ? (
            <p className="mt-2 text-sm text-ink-soft">
              {d.id}, {gen(d.amountAtto)}: {d.verdict ? OUTCOME_WORDS[d.verdict as Exclude<typeof d.verdict, "">].line : "not answered yet"}.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">Nothing was deducted for this item.</p>
          )}
        </div>
      )}
      <SplitBar
        className="mt-3"
        total={deposit}
        parts={[
          { label: "Back to the tenant", atto: BigInt(flat.paidTenantAtto), tone: "tenant" },
          { label: "To the landlord", atto: BigInt(flat.paidLandlordAtto), tone: "landlord" },
        ]}
        caption={`The verdict ${flat.verdict} moved the money in the same transaction.`}
      />
      {isLive && (
        <p className="mt-2 px-1 text-sm">
          <Link href={flatPath(flat.id)} className="link">
            Open {flat.id}
          </Link>
        </p>
      )}
    </figure>
  );
}
