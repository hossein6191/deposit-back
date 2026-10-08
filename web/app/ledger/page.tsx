"use client";

// The ledger: what the contract holds now, what it has paid out and to whom, how the network has
// read the deductions tenants contested, and the flats that closed most recently.

import Link from "next/link";

import { SectionHead } from "@/components/help";
import { Placeholder, ReadError } from "@/components/read-state";
import { SplitBar } from "@/components/split-bar";
import { StatusStamp } from "@/components/stamps";
import { useRead } from "@/components/use-read";
import { flatPath, isClosed, readFlatsWindow, readStats } from "@/lib/chain";
import { gen } from "@/lib/format";
import { readVector } from "@/lib/rules";
import { cx } from "@/lib/cx";

function Figure({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="sheet p-4">
      <p className="text-sm text-ink-faint">{label}</p>
      <p className={cx("mt-1 font-display text-3xl font-semibold tabular-nums", tone)}>{value}</p>
      {note && <p className="mt-1 text-xs text-ink-faint">{note}</p>}
    </div>
  );
}

const WORD_TONE: Record<string, string> = { damage: "text-brick", wear: "text-sage-ink", unclear: "text-ochre-ink" };

export default function LedgerPage() {
  const stats = useRead(() => readStats(), []);
  const recent = useRead(() => readFlatsWindow(3), []);
  const s = stats.data;
  const closed = (recent.data?.rows ?? []).filter((r) => isClosed(r.status) && r.status !== "withdrawn").slice(0, 20);
  const read = s ? s.damage + s.wear + s.unclear : 0;
  return (
    <div className="wrap py-8">
      <SectionHead
        as="h1"
        eyebrow="Ledger"
        title="Every deposit, accounted for"
        what="the contract's own counters: what it holds, what it has paid back to tenants and to landlords, and the words the network has given."
        help={
          <>
            <span className="block">The contract&apos;s balance is always the sum of the deposits it still holds. Every ending pays out exactly one deposit, split two ways.</span>
            <span className="block">These numbers are read from stats(), a view anyone can call.</span>
          </>
        }
      />

      {stats.error ? (
        <ReadError className="mt-6" detail={stats.error} onRetry={stats.retry} />
      ) : !s ? (
        <div className="sheet mt-6 p-4">
          <Placeholder />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Figure label="Flats offered" value={String(s.flats)} note={`${s.taken} taken, ${s.active} still open or running`} />
            <Figure label="Held now" value={gen(s.heldAtto)} note="deposits of tenancies still running" />
            <Figure label="Paid back to tenants" value={gen(s.paidToTenantsAtto)} tone="text-sage-ink" />
            <Figure label="Paid to landlords" value={gen(s.paidToLandlordsAtto)} tone="text-terracotta-ink" />
          </div>

          <section className="sheet mt-6 p-4 sm:p-5" aria-labelledby="words">
            <SectionHead
              title={<span id="words">How contested deductions were read</span>}
              what={`${s.contested} deduction${s.contested === 1 ? "" : "s"} contested so far, each read twice by every validator.`}
              help={
                <span className="block">
                  Damage goes to the landlord; wear and unclear go back to the tenant. A deduction both askings could not agree on is unclear.
                </span>
              }
            />
            {read > 0 ? (
              <div className="mt-4">
                <div className="flex h-5 overflow-hidden rounded-[3px] border border-ink/70" role="img" aria-label={`damage ${s.damage}, wear ${s.wear}, unclear ${s.unclear}`}>
                  <span className="bg-brick" style={{ width: `${(s.damage / read) * 100}%` }} />
                  <span className="border-l-2 border-card bg-sage" style={{ width: `${(s.wear / read) * 100}%` }} />
                  <span className="border-l-2 border-card bg-ochre" style={{ width: `${(s.unclear / read) * 100}%` }} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-5 text-sm">
                  <span>
                    <strong className="text-brick">{s.damage}</strong> damage
                  </span>
                  <span>
                    <strong className="text-sage-ink">{s.wear}</strong> wear
                  </span>
                  <span>
                    <strong className="text-ochre-ink">{s.unclear}</strong> unclear
                  </span>
                </p>
              </div>
            ) : (
              <p className="mt-3 text-ink-soft">No deduction has been contested yet.</p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["Judged", s.judged],
                ["Accepted", s.accepted],
                ["Settled as filed", s.settled],
                ["Clean", s.clean],
                ["Reclaimed", s.reclaimed],
                ["Withdrawn", s.withdrawn],
              ].map(([k, v]) => (
                <div key={k} className="border-t border-dashed border-rule-strong pt-1">
                  <dt className="text-ink-faint">{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-ink-faint">
              {s.refusedTakes} take{s.refusedTakes === 1 ? " was" : "s were"} refused, and what was sent came back in the same transaction each time.
            </p>
          </section>
        </>
      )}

      <section className="mt-8" aria-labelledby="recent">
        <SectionHead
          title={<span id="recent">Recently closed</span>}
          what="the newest flats whose deposit has left the contract, and how it was split."
          help={<span className="block">Read from the newest pages of flats(); a withdrawn offer never held anything and is left out.</span>}
        />
        {recent.error ? (
          <ReadError className="mt-4" detail={recent.error} onRetry={recent.retry} />
        ) : recent.loading ? (
          <div className="sheet mt-4 p-4">
            <Placeholder />
          </div>
        ) : closed.length === 0 ? (
          <p className="mt-3 text-ink-soft">No tenancy has closed yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {closed.map((r) => {
              const words = readVector(r.verdict);
              const total = BigInt(r.paidTenantAtto) + BigInt(r.paidLandlordAtto);
              return (
                <li key={r.id} className="sheet p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusStamp status={r.status} />
                    <span className="mono text-sm text-ink-faint">{r.id}</span>
                    <Link href={flatPath(r.id)} className="font-display text-lg font-semibold hover:underline">
                      {r.title}
                    </Link>
                    {Object.keys(words).length > 0 && (
                      <span className="ml-auto flex flex-wrap gap-1.5 text-xs font-bold">
                        {Object.entries(words).map(([id, w]) => (
                          <span key={id} className={cx("stamp", WORD_TONE[w])}>
                            {id} {w}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                  <SplitBar
                    className="mt-3"
                    total={total}
                    parts={[
                      { label: "Back to the tenant", atto: BigInt(r.paidTenantAtto), tone: "tenant" },
                      { label: "To the landlord", atto: BigInt(r.paidLandlordAtto), tone: "landlord" },
                    ]}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
