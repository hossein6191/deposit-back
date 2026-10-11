"use client";

// One lease. The flat as a floor plan beside its items, the tenancy line that moves with the
// contract, the next step for whoever is looking (led by a notice slip that says what the flat waits
// for, until when, what is needed, whether the page can be closed and where the deposit is), every
// deduction with the word the network gave it, and where the deposit went. Every transaction shows
// its explorer link from the moment it is sent, while the validators vote.

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { Addr } from "@/components/address";
import { FloorPlan, PlanLegend } from "@/components/floor-plan";
import { ItemList } from "@/components/flat/item-list";
import { NextStep, guideInput, type Role } from "@/components/flat/next-step";
import { SectionHead } from "@/components/help";
import { Placeholder, ReadError } from "@/components/read-state";
import { SplitBar, partyWords } from "@/components/split-bar";
import { StatusStamp, OutcomeStamp } from "@/components/stamps";
import { TenancyLine } from "@/components/tenancy-line";
import { TxRail } from "@/components/tx-rail";
import { useDemoStatus } from "@/components/use-demo";
import { useLocal } from "@/components/use-local";
import { useMe } from "@/components/use-me";
import { useNow } from "@/components/use-now";
import { useRead } from "@/components/use-read";
import { useTx } from "@/components/use-tx";
import { isJudged, isMock, phaseNow, readFlat, txUrl } from "@/lib/chain";
import { sampleFor } from "@/lib/demo-flats";
import { gen, when, windowLabel } from "@/lib/format";
import { flatGuide, signGuide } from "@/lib/guide";
import { itemStates, planForFlat } from "@/lib/plans";
import { parseFlatId } from "@/lib/rules";
import { parseRemembered, rememberTx, rememberedRaw } from "@/lib/tx-memory";
import type { Call, Flat } from "@/lib/types";

export default function FlatPage() {
  const params = useParams<{ id: string }>();
  const id = parseFlatId(String(params?.id ?? ""));
  if (!id)
    return (
      <div className="wrap py-12">
        <h1 className="text-3xl">That is not a flat id</h1>
        <p className="mt-2 text-ink-soft">
          Flat ids look like F12. <Link href="/flats" className="link">See the flats to let</Link>.
        </p>
      </div>
    );
  return <FlatView key={id} id={id} />;
}

function FlatView({ id }: { id: string }) {
  const read = useRead(() => readFlat(id), [id]);
  const flat = read.data;
  return (
    <div className="wrap py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-ink-soft">
        <Link href="/flats" className="link">
          Flats
        </Link>{" "}
        / <span className="mono">{id}</span>
      </nav>
      {read.error ? (
        <ReadError detail={read.error} onRetry={read.retry} />
      ) : read.loading ? (
        <div className="sheet p-6">
          <Placeholder lines={6} />
        </div>
      ) : !flat ? (
        <div className="sheet p-6">
          <h1 className="text-3xl">No flat {id} yet</h1>
          <p className="mt-2 text-ink-soft">
            The contract holds no flat with that id. <Link href="/flats" className="link">See the flats to let</Link>.
          </p>
        </div>
      ) : (
        <Lease flat={flat} refresh={read.refresh} />
      )}
    </div>
  );
}

function Lease({ flat, refresh }: { flat: Flat; refresh: () => Promise<void> }) {
  const me = useMe();
  const now = useNow();
  const demo = useDemoStatus();
  const [selected, setSelected] = React.useState<number | null>(null);
  const [ticked, setTicked] = React.useState<ReadonlySet<number>>(new Set());
  const [label, setLabel] = React.useState("");
  // The call being signed: the run knows it only once it has a hash.
  const [pendingCall, setPendingCall] = React.useState<Call | null>(null);
  const tx = useTx((s, _hash, call) => {
    void refresh();
    if (call.fn === "contest" && s.status === "FINALIZED") setTicked(new Set());
  });
  const remembered = parseRemembered(useLocal(() => rememberedRaw(flat.id), ""));

  const role: Role = me.address && me.address === flat.landlord ? "landlord" : me.address && me.address === flat.tenant ? "tenant" : "other";
  const phase = now > 0 ? phaseNow(flat, now) : flat.phase;
  const running = !!tx.hash && !tx.final;
  const busy = tx.sending || running;
  const plan = planForFlat(flat.title, flat.items);
  const showTicks = role === "tenant" && phase === "answer";
  const states = itemStates(flat.items.length, flat.deductions, showTicks || (running && tx.call?.fn === "contest") ? ticked : undefined);
  const isDemoFlat = !!demo?.landlord && flat.landlord === demo.landlord;
  const sample = sampleFor(flat.title, flat.items);
  const words = partyWords(role);

  // While somebody else's move is due (the landlord's report, the tenant's answer), read again every half minute.
  React.useEffect(() => {
    if (busy || !(phase === "report" || phase === "answer")) return;
    const t = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(t);
  }, [busy, phase, refresh]);

  const start = tx.start;
  const run = React.useCallback(
    async (call: Call, what: string) => {
      setLabel(what);
      setPendingCall(call);
      const h = await start(call);
      if (h) rememberTx(flat.id, h, what);
    },
    [start, flat.id],
  );
  const remember = React.useCallback((hash: string, what: string) => rememberTx(flat.id, hash, what), [flat.id]);
  const onTick = (index: number, on: boolean) =>
    setTicked((t) => {
      const next = new Set(t);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });
  const select = (item: number) => setSelected((s) => (s === item ? null : item));

  // A transaction this page is signing or sending takes the slip: what it does, and where the deposit goes.
  const signing = tx.sending && !tx.hash && !tx.error ? pendingCall : null;
  const activity = signing
    ? signGuide({ fn: signing.fn, label, depositAtto: flat.depositAtto, deductedAtto: flat.deductedAtto, mock: isMock })
    : running && tx.call
      ? flatGuide({ ...guideInput(flat, role, now), demo: isDemoFlat && !!sample, sending: tx.call.fn })
      : null;

  const deposit = BigInt(flat.depositAtto);
  const nextTitle =
    phase === "closed" ? "How it ended" : role === "other" ? "What happens now" : "Your next step";

  return (
    <>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusStamp status={flat.status} />
            <span className="mono text-sm text-ink-faint">{flat.id}</span>
            {isDemoFlat && <span className="stamp text-ink-faint">Sample flat</span>}
            {role !== "other" && <span className="stamp text-ink">You are the {role}</span>}
          </div>
          <h1 className="mt-2 text-3xl sm:text-4xl">{flat.title}</h1>
          <p className="mt-1 text-lg text-ink-soft">{flat.addressLine}</p>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:text-right">
          <div>
            <dt className="text-ink-faint">Deposit</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{gen(deposit)}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Held now</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{gen(flat.heldAtto)}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Landlord</dt>
            <dd>
              <Addr address={flat.landlord} me={me.address} />
              {isDemoFlat && <span className="block text-xs text-ink-faint">the demo landlord</span>}
            </dd>
          </div>
          <div>
            <dt className="text-ink-faint">Tenant</dt>
            <dd>
              <Addr address={flat.tenant} me={me.address} />
            </dd>
          </div>
        </dl>
      </header>

      <section className="sheet mt-6 px-3 py-4 sm:px-6" aria-label="The tenancy line">
        <TenancyLine flat={flat} now={now} />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <section className="sheet p-4 lg:sticky lg:top-20" aria-labelledby="plan-title">
            <SectionHead
              as="h2"
              title={<span id="plan-title">The flat</span>}
              what="every numbered marker is an item; its colour is what happened to it. Press one to read its notes."
              help={
                <>
                  <span className="block">
                    {sample
                      ? "This plan is the sample flat's own drawing."
                      : "This flat was written by its landlord, so the plan is drawn from its items: one room for each, around a hall."}
                  </span>
                  <span className="block">
                    Untouched items have no deduction. A deducted item turns terracotta, a ticked one is hatched while you decide, and a judged one
                    takes the word the network gave it: damage, wear or unclear.
                  </span>
                </>
              }
            />
            <div className="mt-3 rounded-sm border border-rule bg-paper p-1.5">
              <FloorPlan
                plan={plan}
                states={states}
                names={flat.items.map((i) => i.name)}
                selected={selected}
                onSelect={select}
                title={`Floor plan of ${flat.title}`}
              />
            </div>
            <PlanLegend className="mt-3" />
          </section>
        </div>

        <div className="space-y-6 lg:col-span-7">
          <section className="sheet border-t-4 border-t-terracotta p-4 sm:p-5" aria-labelledby="next-title">
            <SectionHead
              title={<span id="next-title">{nextTitle}</span>}
              what={
                phase === "closed"
                  ? "the deposit has left the contract; this is where it went."
                  : "the step this flat waits for, who may take it, and what it does with the money."
              }
              help={
                <>
                  <span className="block">
                    A tenancy goes offer, taken, notice, move-out report, answer, settled. The line above moves by itself as the contract changes and
                    as a window runs out.
                  </span>
                  <span className="block">
                    Nobody&apos;s money waits on somebody else&apos;s silence: a landlord who never reports loses every deduction, and a tenant who
                    never answers accepts the report.
                  </span>
                </>
              }
            />
            <div className="mt-4">
              <NextStep
                flat={flat}
                role={role}
                now={now}
                demo={demo}
                ticked={ticked}
                onTick={onTick}
                run={run}
                busy={busy}
                activity={activity}
                onDemoFinal={() => void refresh()}
                remember={remember}
              />
            </div>
            {tx.error && <p className="mt-3 text-sm text-brick" role="alert">{tx.error}</p>}
            {tx.hash && tx.call && (
              <TxRail className="mt-4" hash={tx.hash} label={label} judged={isJudged(tx.call.fn)} onDone={tx.onDone} />
            )}
          </section>

          <section aria-labelledby="items-title">
            <SectionHead
              title={<span id="items-title">The items, in and out</span>}
              what="what the landlord wrote at move-in, which the tenant accepted by taking the flat, beside what the landlord wrote at move-out."
              help={
                <>
                  <span className="block">The landlord writes every note. The move-in notes are fixed before anybody pays, and taking the flat accepts them.</span>
                  <span className="block">
                    A deduction is judged on the change between the two notes. The reason is the landlord&apos;s claim and is not evidence: a change the
                    move-out note does not describe counts for nothing.
                  </span>
                </>
              }
            />
            <div className="mt-3">
              <ItemList flat={flat} states={states} selected={selected} onSelect={select} />
            </div>
          </section>
        </div>
      </div>

      {flat.deductions.length > 0 && (
        <section className="sheet mt-8 p-4 sm:p-5" aria-labelledby="money-title">
          <SectionHead
            title={<span id="money-title">Where the deposit goes</span>}
            what="each deduction, the word it got, and whose it became. Every atto of the deposit goes one way or the other."
            help={
              <>
                <span className="block">Damage goes to the landlord. Wear and unclear go back to the tenant, because the burden of proof is the landlord&apos;s.</span>
                <span className="block">A deduction nobody contested, an accepted report, and a report nobody answered all stand as filed. The rest of the deposit goes to the tenant.</span>
              </>
            }
          />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-ink/30 text-xs tracking-wider text-ink-faint uppercase">
                <tr>
                  <th className="py-2 pr-2 font-bold">Deduction</th>
                  <th className="py-2 pr-2 text-right font-bold">Amount</th>
                  <th className="py-2 pr-2 font-bold">Word</th>
                  <th className="py-2 font-bold">Goes to</th>
                </tr>
              </thead>
              <tbody>
                {flat.deductions.map((d) => (
                  <tr key={d.index} className="border-b border-dashed border-rule-strong align-top">
                    <td className="py-2 pr-2">
                      <span className="font-semibold">{d.id}</span>{" "}
                      <button type="button" className="link text-left" onClick={() => select(d.item)}>
                        {d.itemName}
                      </button>
                    </td>
                    <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">{gen(d.amountAtto)}</td>
                    <td className="py-2 pr-2">{d.verdict ? <OutcomeStamp outcome={d.verdict} /> : <span className="text-ink-faint">not answered yet</span>}</td>
                    <td className="py-2">{d.to === "tenant" ? (role === "tenant" ? "back to you" : "the tenant") : d.to === "landlord" ? (role === "landlord" ? "you" : "the landlord") : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {flat.paidTenantAtto !== "0" || flat.paidLandlordAtto !== "0" ? (
            <SplitBar
              className="mt-4"
              total={deposit}
              parts={[
                { label: words.tenant, atto: BigInt(flat.paidTenantAtto), tone: "tenant" },
                { label: words.landlord, atto: BigInt(flat.paidLandlordAtto), tone: "landlord" },
              ]}
            />
          ) : null}
        </section>
      )}

      <section className="mt-8" aria-labelledby="tx-title">
        <h2 id="tx-title" className="text-xl">
          Transactions from this browser
        </h2>
        {remembered.length === 0 ? (
          <p className="mt-1 text-sm text-ink-soft">
            None yet. Every call sent from this page, and the demo landlord&apos;s report, is listed here with its explorer link.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-dashed divide-rule-strong text-sm">
            {remembered.map((r) => (
              <li key={r.hash} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                <span>{r.label}</span>
                <span className="flex items-baseline gap-3">
                  <span className="text-ink-faint">{when(r.at)}</span>
                  <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="link mono text-xs">
                    {isMock ? "demo tx" : "explorer"} {r.hash.slice(0, 10)}… ↗
                  </a>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-ink-faint">
          Windows on this flat: the landlord reports within {windowLabel(flat.moveoutSeconds)} of the notice; the tenant answers within{" "}
          {windowLabel(flat.responseSeconds)} of the report.
        </p>
      </section>
    </>
  );
}
