"use client";

// Every flat on offer now. The six sample flats come first: the demo landlord offers several copies
// of each so that many visitors can take one at once, and each card leads to a copy nobody has taken.
// Flats other landlords wrote themselves follow.

import * as React from "react";

import { SectionHead } from "@/components/help";
import { Placeholder, ReadError } from "@/components/read-state";
import { ToLetCard, roomsOnly } from "@/components/to-let-card";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useRead } from "@/components/use-read";
import { flatPath, readFlatsWindow } from "@/lib/chain";
import { SAMPLE_FLATS, type SampleFlat } from "@/lib/demo-flats";
import { plural } from "@/lib/format";
import { buildPlan } from "@/lib/plans";
import type { FlatRow } from "@/lib/types";

/** The sample a short row is a copy of: same title, same number of items, same deposit. */
const sampleOfRow = (r: FlatRow): SampleFlat | null =>
  SAMPLE_FLATS.find((s) => s.title === r.title && s.items.length === r.items && s.depositAtto === r.depositAtto) ?? null;

export default function FlatsPage() {
  const read = useRead(() => readFlatsWindow(8), []);
  const demo = useDemoStatus();
  const me = useMe();
  const rows = read.data?.rows ?? [];
  const open = rows.filter((r) => r.status === "open").sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
  const copies = new Map<string, FlatRow[]>();
  const others: FlatRow[] = [];
  for (const r of open) {
    const s = sampleOfRow(r);
    const demoOwned = !demo?.landlord || r.landlord === demo.landlord;
    if (s && demoOwned) copies.set(s.key, [...(copies.get(s.key) ?? []), r]);
    else others.push(r);
  }
  // Spread visitors over the copies: each address is sent to its own copy of a sample, so two
  // visitors rarely race for the same one (and a lost race is refused and refunded anyway).
  const spread = me.address ? parseInt(me.address.slice(-4), 16) : 0;
  const pick = (list: FlatRow[]) => list[spread % list.length];

  return (
    <div className="wrap py-8">
      <SectionHead
        as="h1"
        eyebrow="Flats to let"
        title="Take a flat, live in it, get your deposit back"
        what="pick a flat, read what its landlord wrote about each item, and take it by paying the deposit into the contract."
        help={
          <>
            <span className="block">The deposit goes into the contract, not to the landlord. It stays there until the tenancy ends.</span>
            <span className="block">
              The six sample flats belong to a demo landlord run by this site. When you give notice on one, it files the move-out report for you, so
              you can contest a deduction and watch the validators decide, alone and in a few minutes.
            </span>
          </>
        }
      />

      {read.error ? (
        <ReadError className="mt-6" detail={read.error} onRetry={read.retry} />
      ) : read.loading ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="sheet p-4">
              <div className="mb-4 aspect-[3/2] rounded-sm bg-paper-deep" />
              <Placeholder lines={3} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <section className="mt-8" aria-labelledby="samples">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="samples" className="text-2xl">
                The six sample flats
              </h2>
              <p className="text-sm text-ink-soft">
                {demo === null ? "" : demo.online ? "The demo landlord is online: it files the move-out report for you." : "The demo landlord is offline: if no report comes in time, you reclaim the whole deposit."}
              </p>
            </div>
            <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {SAMPLE_FLATS.map((s) => {
                const list = copies.get(s.key) ?? [];
                return (
                  <ToLetCard
                    key={s.key}
                    plan={buildPlan(s.plan)}
                    title={s.title}
                    addressLine={s.addressLine}
                    depositAtto={s.depositAtto}
                    items={s.items.length}
                    line={s.blurb}
                    note={list.length ? `${plural(list.length, "copy", "copies")} to let now` : undefined}
                    href={list.length ? flatPath(pick(list).id) : "/flats"}
                    cta={list.length ? "See the flat" : "Every copy is taken right now"}
                    disabled={!list.length}
                    tag="Sample"
                  />
                );
              })}
            </div>
          </section>

          <section className="mt-12" aria-labelledby="others">
            <h2 id="others" className="text-2xl">
              Offered by other landlords
            </h2>
            {others.length === 0 ? (
              <p className="mt-2 text-ink-soft">None to let right now. A flat you offer from the Landlords page appears here.</p>
            ) : (
              <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {others.map((r) => (
                  <ToLetCard
                    key={r.id}
                    plan={roomsOnly(r.items)}
                    title={r.title}
                    addressLine={r.addressLine}
                    depositAtto={r.depositAtto}
                    items={r.items}
                    note={`${r.id}${me.address && r.landlord === me.address ? ", yours" : ""}`}
                    href={flatPath(r.id)}
                    cta="See the flat"
                  />
                ))}
              </div>
            )}
            {read.data?.partial && (
              <p className="mt-4 text-sm text-ink-faint">
                The contract holds {read.data.total} flats; this page read the oldest twenty and the newest pages, to stay inside Studio&apos;s read
                limit.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
