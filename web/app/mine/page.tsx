"use client";

// The connected account's tenancies and flats, each with the step it waits for and whose step that is.

import Link from "next/link";

import { FloorPlan } from "@/components/floor-plan";
import { SectionHead } from "@/components/help";
import { KeyTagLink } from "@/components/key-tag";
import { readMine } from "@/components/my-flats";
import { Placeholder, ReadError } from "@/components/read-state";
import { StatusStamp } from "@/components/stamps";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useRead } from "@/components/use-read";
import { WalletGate } from "@/components/wallet-gate";
import { flatPath, phaseNow } from "@/lib/chain";
import { gen, span } from "@/lib/format";
import { itemStates, planForFlat } from "@/lib/plans";
import type { Flat } from "@/lib/types";
import { cx } from "@/lib/cx";

type Side = "tenant" | "landlord";

/** What the flat waits for, from one side, and whether it is that side's move. */
function nextOf(f: Flat, side: Side, now: number): { text: string; yours: boolean } {
  const phase = now > 0 ? phaseNow(f, now) : f.phase;
  const left = (end: number) => (now > 0 ? span(end - now) : "the time");
  const t = side === "tenant";
  switch (phase) {
    case "take":
      return { text: "To let; nobody has taken it yet.", yours: false };
    case "notice":
      return t ? { text: "You live here. Give notice when you move out.", yours: true } : { text: "Let. Waiting for the tenant's notice.", yours: false };
    case "report":
      return t
        ? { text: `Waiting for the landlord's move-out report: ${left(f.moveoutEnd)} left.`, yours: false }
        : { text: `Your move-out report is due: ${left(f.moveoutEnd)} left.`, yours: true };
    case "reclaim":
      return { text: "No report in time: the whole deposit can be sent back to the tenant now.", yours: true };
    case "answer":
      return t
        ? { text: `The report is filed: accept it or contest it, ${left(f.responseEnd)} left.`, yours: true }
        : { text: `The tenant is answering your report: ${left(f.responseEnd)} left.`, yours: false };
    case "settle":
      return { text: "No answer in time: the report can be settled as filed now.", yours: true };
    case "closed":
      return {
        text:
          f.status === "withdrawn"
            ? "Withdrawn before anybody took it."
            : t
              ? `Closed: ${gen(f.paidTenantAtto)} came back to you.`
              : `Closed: ${gen(f.paidLandlordAtto)} came to you.`,
        yours: false,
      };
    default:
      return { text: "", yours: false };
  }
}

function FlatCard({ flat, side, now }: { flat: Flat; side: Side; now: number }) {
  const n = nextOf(flat, side, now);
  return (
    <article className={cx("sheet flex gap-4 p-4", n.yours && "border-l-4 border-l-terracotta")}>
      <div className="hidden w-36 shrink-0 rounded-sm border border-rule bg-paper p-1 sm:block">
        <FloorPlan plan={planForFlat(flat.title, flat.items)} states={itemStates(flat.items.length, flat.deductions)} compact title={`Plan of ${flat.title}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusStamp status={flat.status} />
          <span className="mono text-sm text-ink-faint">{flat.id}</span>
          <span className="ml-auto font-display text-lg font-semibold tabular-nums">{gen(flat.depositAtto)}</span>
        </div>
        <h3 className="mt-1 text-xl">
          <Link href={flatPath(flat.id)} className="hover:underline">
            {flat.title}
          </Link>
        </h3>
        <p className={cx("mt-1 text-[0.95rem]", n.yours ? "font-semibold text-terracotta-ink" : "text-ink-soft")}>{n.text}</p>
        {n.yours && (
          <KeyTagLink href={flatPath(flat.id)} size="sm" className="mt-3">
            Open {flat.id}
          </KeyTagLink>
        )}
      </div>
    </article>
  );
}

export default function MinePage() {
  const me = useMe();
  const now = useNow();
  const mine = useRead(() => readMine(me.address), [me.address], { enabled: !!me.address });
  return (
    <div className="wrap py-8">
      <SectionHead
        as="h1"
        eyebrow="Mine"
        title="Your tenancies and your flats"
        what="every flat this account took or offered, and the step each one waits for. A flat that waits for you is marked."
        help={
          <>
            <span className="block">This page reads the contract&apos;s own index of the account, flats_of(address), and then each flat.</span>
            <span className="block">The twelve newest of each kind are read, to stay inside Studio&apos;s limit of thirty reads a minute.</span>
          </>
        }
      />
      <div className="mt-6">
        <WalletGate what="to see your tenancies">
          {mine.error ? (
            <ReadError detail={mine.error} onRetry={mine.retry} />
          ) : mine.loading || !mine.data ? (
            <div className="sheet p-4">
              <Placeholder />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
              <section aria-labelledby="as-tenant">
                <h2 id="as-tenant" className="text-2xl">
                  As a tenant
                </h2>
                {mine.data.tenant.length === 0 ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-ink-soft">You have not taken a flat with this account.</p>
                    <KeyTagLink href="/flats">Find a flat to rent</KeyTagLink>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {mine.data.tenant.map((f) => (
                      <FlatCard key={f.id} flat={f} side="tenant" now={now} />
                    ))}
                  </div>
                )}
              </section>
              <section aria-labelledby="as-landlord">
                <h2 id="as-landlord" className="text-2xl">
                  As a landlord
                </h2>
                {mine.data.landlord.length === 0 ? (
                  <div className="mt-2 space-y-3">
                    <p className="text-ink-soft">You have not offered a flat with this account.</p>
                    <KeyTagLink href="/landlord" variant="outline">
                      Offer a flat
                    </KeyTagLink>
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {mine.data.landlord.map((f) => (
                      <FlatCard key={f.id} flat={f} side="landlord" now={now} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </WalletGate>
      </div>
    </div>
  );
}
