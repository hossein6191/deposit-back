"use client";

// The landlord's side: offer a flat (a sample or one of your own), and file the move-out report on
// your own flats once a tenant has given notice. A notice slip (lib/guide.ts) says what each step
// waits for, whether the page can be closed and where the deposit is; every other flat gets one line.

import * as React from "react";
import Link from "next/link";

import { GuideSlip } from "@/components/flat/guide-slip";
import { guideInput } from "@/components/flat/next-step";
import { SectionHead } from "@/components/help";
import { KeyTagLink } from "@/components/key-tag";
import { OfferForm } from "@/components/offer-form";
import { readMine } from "@/components/my-flats";
import { Placeholder, ReadError } from "@/components/read-state";
import { ReportForm } from "@/components/report-form";
import { StatusStamp } from "@/components/stamps";
import { TxRail } from "@/components/tx-rail";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { WalletGate } from "@/components/wallet-gate";
import { flatPath, isMock, offeredFlat, phaseNow } from "@/lib/chain";
import { gen } from "@/lib/format";
import { flatGuide, flatLine, offerGuide, signGuide, type Guide } from "@/lib/guide";
import { rememberTx } from "@/lib/tx-memory";
import type { Call, Flat } from "@/lib/types";

export default function LandlordPage() {
  const me = useMe();
  const now = useNow();
  const [label, setLabel] = React.useState("");
  const [open, setOpen] = React.useState<string>("");
  // The call being signed: the run knows it only once it has a hash.
  const [pendingCall, setPendingCall] = React.useState<Call | null>(null);
  const mine = useRead(() => readMine(me.address), [me.address], { enabled: !!me.address });
  const refresh = mine.refresh;
  const tx = useTx(() => void refresh());
  const start = tx.start;
  const running = !!tx.hash && !tx.final;
  const busy = tx.sending || running;
  const newFlat = offeredFlat(tx.final);

  const run = React.useCallback(
    async (call: Call, what: string) => {
      setLabel(what);
      setPendingCall(call);
      const h = await start(call);
      if (h && call.fn === "report") rememberTx(String(call.args[0]), h, what);
    },
    [start],
  );

  const signing = tx.sending && !tx.hash && !tx.error ? pendingCall : null;
  const waiting = (mine.data?.landlord ?? []).filter((f) => (now > 0 ? phaseNow(f, now) : f.phase) === "report");
  const rest = (mine.data?.landlord ?? []).filter((f) => !waiting.includes(f));

  return (
    <div className="wrap py-8">
      <SectionHead
        as="h1"
        eyebrow="Landlords"
        title="Offer a flat, and say how it was left"
        what="write down each item as it is on move-in day, set a deposit, and offer the flat. When your tenant moves out, file the move-out report here."
        help={
          <>
            <span className="block">You write every note the network will read. The move-in notes are fixed once a tenant pays, and taking the flat accepts them.</span>
            <span className="block">
              A landlord cannot take their own flat, so trying both sides alone needs a second account. The quickest way to see the whole flow is the
              tenant side of a sample flat, where the demo landlord plays you.
            </span>
          </>
        }
      />

      <section className="sheet mt-8 p-4 sm:p-6" aria-labelledby="offer-title">
        <SectionHead
          title={<span id="offer-title">Offer a flat</span>}
          what="one transaction; nothing is paid by you. The flat is listed at once, and anyone but you may take it with the deposit."
          help={
            <>
              <span className="block">Two to eight items, each named once, with a move-in note of 20 to 400 characters, plain keyboard text on one line.</span>
              <span className="block">
                Your time to report starts at the tenant&apos;s notice; if it runs out, the whole deposit goes back. The tenant&apos;s time to answer
                starts at your report; if it runs out, your deductions stand.
              </span>
            </>
          }
        />
        <div className="mt-5">
          <WalletGate what="to offer a flat">
            <OfferForm run={run} busy={busy} />
          </WalletGate>
        </div>
        {tx.error && <p className="mt-3 text-sm text-brick" role="alert">{tx.error}</p>}
        {signing?.fn === "offer" && <GuideSlip className="mt-4" guide={signGuide({ fn: "offer", label, depositAtto: "0", mock: isMock })} />}
        {running && tx.call?.fn === "offer" && <GuideSlip className="mt-4" guide={offerGuide(isMock)} />}
        {tx.hash && tx.call?.fn === "offer" && <TxRail className="mt-4" hash={tx.hash} label={label} onDone={tx.onDone} />}
        {newFlat && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-sm bg-sage/10 p-3">
            <p className="font-semibold">Offered as {newFlat}.</p>
            <KeyTagLink href={flatPath(newFlat)} size="sm" variant="sage">
              See {newFlat}
            </KeyTagLink>
          </div>
        )}
      </section>

      <section className="mt-10" aria-labelledby="yours-title">
        <SectionHead
          title={<span id="yours-title">Your flats</span>}
          what="the flats this account offered. A flat whose tenant has given notice waits for your move-out report; it is filed here."
          help={
            <>
              <span className="block">One note per item and at most six deductions, one per item, adding up to no more than the deposit.</span>
              <span className="block">A report with no deduction sends the whole deposit back to the tenant in the same transaction.</span>
            </>
          }
        />
        {!me.address ? (
          <p className="mt-3 text-ink-soft">Connect a wallet to see the flats you offered.</p>
        ) : mine.error ? (
          <ReadError className="mt-4" detail={mine.error} onRetry={mine.retry} />
        ) : mine.loading ? (
          <div className="sheet mt-4 p-4">
            <Placeholder />
          </div>
        ) : !mine.data?.landlord.length ? (
          <p className="mt-3 text-ink-soft">This account has not offered a flat yet.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {waiting.map((f) => (
              <article key={f.id} className="sheet border-t-4 border-t-terracotta p-4">
                <FlatLine flat={f} now={now} />
                <ReportSlip
                  guide={
                    signing?.fn === "report" && signing.args[0] === f.id
                      ? signGuide({ fn: "report", label, depositAtto: f.depositAtto, mock: isMock })
                      : flatGuide({
                          ...guideInput(f, "landlord", now > 0 ? now : f.now),
                          sending: running && tx.call?.fn === "report" && tx.call.args[0] === f.id ? "report" : undefined,
                        })
                  }
                />
                {open === f.id ? (
                  <div className="mt-4">
                    <ReportForm flat={f} run={run} busy={busy} />
                  </div>
                ) : (
                  <button type="button" className="link mt-2 text-sm font-semibold" onClick={() => setOpen(f.id)}>
                    Write the move-out report
                  </button>
                )}
                {tx.hash && tx.call?.fn === "report" && tx.call.args[0] === f.id && (
                  <TxRail className="mt-4" hash={tx.hash} label={label} onDone={tx.onDone} />
                )}
              </article>
            ))}
            {rest.length > 0 && (
              <ul className="sheet divide-y divide-dashed divide-rule-strong">
                {rest.map((f) => (
                  <li key={f.id} className="p-4">
                    <FlatLine flat={f} now={now} />
                  </li>
                ))}
              </ul>
            )}
            {mine.data.more.landlord > 0 && <p className="text-sm text-ink-faint">And {mine.data.more.landlord} older flats, not read here.</p>}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportSlip({ guide }: { guide: Guide | null }) {
  return guide ? <GuideSlip className="mt-3" guide={guide} /> : null;
}

function FlatLine({ flat, now }: { flat: Flat; now: number }) {
  const line = flatLine(guideInput(flat, "landlord", now > 0 ? now : flat.now));
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <StatusStamp status={flat.status} />
          <span className="mono text-sm text-ink-faint">{flat.id}</span>
        </div>
        <h3 className="mt-1 text-xl">
          <Link href={flatPath(flat.id)} className="hover:underline">
            {flat.title}
          </Link>
        </h3>
        <p className={line.yours ? "text-sm font-semibold text-terracotta-ink" : "text-sm text-ink-soft"}>{line.text}</p>
      </div>
      <p className="font-display text-xl font-semibold tabular-nums">{gen(flat.depositAtto)}</p>
    </div>
  );
}
