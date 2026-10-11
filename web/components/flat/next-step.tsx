"use client";

// What happens next on a flat, for whoever is looking: the tenant, the landlord or anyone else. One
// notice slip on top (lib/guide.ts) says what the flat waits for and who for, how long or until when,
// what is needed from the viewer, whether they can close the page and where the deposit is; under it,
// the one key tag to press, or the form to fill. While a transaction of this page is being signed or
// is on its way, the slip follows it instead. Every party who could be stuck has a way out here: a
// tenant whose landlord never reports reclaims, a landlord whose tenant never answers settles.

import * as React from "react";
import Link from "next/link";

import { AnswerPanel } from "@/components/flat/answer-panel";
import { GuideSlip } from "@/components/flat/guide-slip";
import { KeyTag } from "@/components/key-tag";
import { ReportForm } from "@/components/report-form";
import { SplitBar, partyWords } from "@/components/split-bar";
import { TxRail } from "@/components/tx-rail";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock, phaseNow, requestDemoReport } from "@/lib/chain";
import { sampleFor } from "@/lib/demo-flats";
import { gen } from "@/lib/format";
import { flatGuide, type FlatInput, type Guide } from "@/lib/guide";
import type { Call, DemoStatus, Flat, TxStatus } from "@/lib/types";

export type Role = "tenant" | "landlord" | "other";

/** When the demo landlord was last asked about a flat in this tab: it is asked by itself at most every two minutes. */
const askedAt = new Map<string, number>();

/** The flat as lib/guide.ts reads it. */
export function guideInput(flat: Flat, role: Role, now: number): FlatInput {
  return {
    role,
    now,
    id: flat.id,
    status: flat.status,
    depositAtto: flat.depositAtto,
    deductedAtto: flat.deductedAtto,
    moveoutSeconds: flat.moveoutSeconds,
    responseSeconds: flat.responseSeconds,
    moveoutEnd: flat.moveoutEnd,
    responseEnd: flat.responseEnd,
    paidTenantAtto: flat.paidTenantAtto,
    paidLandlordAtto: flat.paidLandlordAtto,
    settledAt: flat.settledAt,
    mock: isMock,
  };
}

function DemoReport({
  flat,
  now,
  demo,
  onFinal,
  remember,
}: {
  flat: Flat;
  now: number;
  demo: DemoStatus | null;
  onFinal: (s: TxStatus) => void;
  remember: (hash: string, label: string) => void;
}) {
  const [hash, setHash] = React.useState("");
  const [asking, setAsking] = React.useState(false);
  const [why, setWhy] = React.useState("");

  const ask = React.useCallback(async () => {
    askedAt.set(flat.id, Date.now());
    setAsking(true);
    setWhy("");
    const answer = await requestDemoReport(flat.id);
    setAsking(false);
    if (answer.ok) {
      setHash(answer.hash);
      remember(answer.hash, "The demo landlord's move-out report");
    } else setWhy(answer.reason);
  }, [flat.id, remember]);

  React.useEffect(() => {
    if (!demo?.online || hash) return;
    const last = askedAt.get(flat.id) ?? 0;
    if (Date.now() - last < 120_000) return;
    const t = setTimeout(() => void ask(), 0);
    return () => clearTimeout(t);
  }, [demo?.online, flat.id, hash, ask]);

  const state = !demo ? undefined : !demo.online ? "offline" : asking ? "asking" : hash ? "filing" : why ? "failed" : "idle";
  const guide = flatGuide({ ...guideInput(flat, "tenant", now), demo: true, demoState: state, demoReason: !demo?.online ? demo?.reason : why || undefined });

  return (
    <div className="space-y-3">
      {guide && (
        <GuideSlip
          guide={guide}
          action={
            why ? (
              <KeyTag size="sm" variant="outline" onClick={() => void ask()} disabled={asking}>
                Ask the demo landlord again
              </KeyTag>
            ) : state === "idle" ? (
              <KeyTag size="sm" variant="outline" onClick={() => void ask()}>
                Ask the demo landlord now
              </KeyTag>
            ) : undefined
          }
        />
      )}
      <p className="text-sm text-ink-soft">
        This flat is one of the six sample flats, and its landlord is a demo account run by this site: it signs the sample&apos;s scripted move-out notes
        and deductions, so you can answer them alone.
      </p>
      {hash && <TxRail hash={hash} label="The demo landlord files the move-out report" onDone={onFinal} />}
    </div>
  );
}

export function NextStep({
  flat,
  role,
  now,
  demo,
  ticked,
  onTick,
  run,
  busy,
  activity,
  onDemoFinal,
  remember,
}: {
  flat: Flat;
  role: Role;
  now: number;
  demo: DemoStatus | null;
  ticked: ReadonlySet<number>;
  onTick: (index: number, on: boolean) => void;
  run: (call: Call, label: string) => void;
  busy: boolean;
  /** the slip of a transaction this page is signing or sending, which takes the place of the flat's own */
  activity: Guide | null;
  onDemoFinal: (s: TxStatus) => void;
  remember: (hash: string, label: string) => void;
}) {
  const phase = now > 0 ? phaseNow(flat, now) : flat.phase;
  const isDemoFlat = !!demo?.landlord && flat.landlord === demo.landlord && !!sampleFor(flat.title, flat.items);
  const demoReport = role === "tenant" && phase === "report" && isDemoFlat && !activity;
  const guide = activity ?? (demoReport ? null : flatGuide({ ...guideInput(flat, role, now), demo: isDemoFlat }));
  return (
    <div className="space-y-4">
      {guide && <GuideSlip guide={guide} />}
      {demoReport ? (
        <DemoReport flat={flat} now={now} demo={demo} onFinal={onDemoFinal} remember={remember} />
      ) : (
        <StepBody flat={flat} role={role} phase={phase} isDemoFlat={isDemoFlat} now={now} ticked={ticked} onTick={onTick} run={run} busy={busy} />
      )}
    </div>
  );
}

/** Under the slip: the key tag or the form for this phase and this viewer, and nothing that only waits. */
function StepBody({
  flat,
  role,
  phase,
  isDemoFlat,
  now,
  ticked,
  onTick,
  run,
  busy,
}: {
  flat: Flat;
  role: Role;
  phase: ReturnType<typeof phaseNow>;
  isDemoFlat: boolean;
  now: number;
  ticked: ReadonlySet<number>;
  onTick: (index: number, on: boolean) => void;
  run: (call: Call, label: string) => void;
  busy: boolean;
}) {
  const [readNotes, setReadNotes] = React.useState(false);
  const deposit = BigInt(flat.depositAtto);
  const deducted = BigInt(flat.deductedAtto);
  const words = partyWords(role);

  switch (phase) {
    case "take":
      if (role === "landlord")
        return (
          <KeyTag variant="outline" disabled={busy} onClick={() => run(calls.withdrawOffer(flat.id), `Withdrawing the offer of ${flat.id}`)}>
            Withdraw the offer
          </KeyTag>
        );
      return (
        <div className="space-y-3">
          <p>
            Take this flat by paying the deposit, <strong>{gen(deposit)}</strong>, into the contract. It holds the money for the whole tenancy;
            the landlord cannot touch it. <strong>Taking it accepts the move-in notes as written</strong>, so read them below first.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-[#a4502f]" checked={readNotes} onChange={(e) => setReadNotes(e.target.checked)} />
            I have read the {flat.items.length} move-in notes and accept them as the condition of the flat.
          </label>
          <WalletGate need={deposit} what="to take this flat">
            <KeyTag disabled={busy || !readNotes} onClick={() => run(calls.take(flat.id, deposit), `Taking ${flat.id} with a ${gen(deposit)} deposit`)}>
              {busy ? "Waiting for the wallet…" : `Take it for ${gen(deposit)}`}
            </KeyTag>
          </WalletGate>
          <p className="text-xs text-ink-faint">
            A take with the wrong amount, or on a flat somebody took a moment earlier, is refused and what was sent comes back in the same
            transaction.
          </p>
        </div>
      );
    case "notice":
      if (role === "tenant")
        return (
          <div className="space-y-3">
            {isDemoFlat && <p className="text-sm text-ink-soft">This is a sample flat: right after your notice, the demo landlord files its move-out report for you.</p>}
            <WalletGate what="to give notice">
              <KeyTag disabled={busy} onClick={() => run(calls.giveNotice(flat.id), `Giving notice on ${flat.id}`)}>
                {busy ? "Waiting for the wallet…" : "I have moved out: give notice"}
              </KeyTag>
            </WalletGate>
          </div>
        );
      return null;
    case "report":
      if (role === "landlord")
        return (
          <WalletGate what="to file the report">
            <ReportForm flat={flat} run={run} busy={busy} />
          </WalletGate>
        );
      return null;
    case "reclaim":
      return (
        <WalletGate what="to reclaim it">
          <KeyTag variant="sage" disabled={busy} onClick={() => run(calls.reclaim(flat.id), `Reclaiming the deposit of ${flat.id} for the tenant`)}>
            {busy ? "Waiting for the wallet…" : `Send ${gen(deposit)} back to the tenant`}
          </KeyTag>
        </WalletGate>
      );
    case "answer":
      if (role === "tenant")
        return (
          <WalletGate what="to answer the report">
            <AnswerPanel flat={flat} now={now} ticked={ticked} onTick={onTick} run={run} busy={busy} />
          </WalletGate>
        );
      return (
        <SplitBar
          total={deposit}
          parts={[
            { label: words.tenant + " whatever happens", atto: deposit - deducted, tone: "tenant" },
            { label: "Deducted, until the tenant answers", atto: deducted, tone: "open" },
          ]}
        />
      );
    case "settle":
      return (
        <WalletGate what="to settle it">
          <KeyTag disabled={busy} onClick={() => run(calls.settle(flat.id), `Settling ${flat.id} as filed`)}>
            {busy ? "Waiting for the wallet…" : "Settle as filed"}
          </KeyTag>
        </WalletGate>
      );
    case "closed":
      return <Closed flat={flat} role={role} />;
    default:
      return <p className="text-ink-soft">The contract had no clock when it was read; this page reads it again in a moment.</p>;
  }
}

function Closed({ flat, role }: { flat: Flat; role: Role }) {
  const words = partyWords(role);
  const deposit = BigInt(flat.depositAtto);
  if (flat.status === "withdrawn") return null;
  return (
    <div className="space-y-3">
      <SplitBar
        total={deposit}
        parts={[
          { label: words.tenant, atto: BigInt(flat.paidTenantAtto), tone: "tenant" },
          { label: words.landlord, atto: BigInt(flat.paidLandlordAtto), tone: "landlord" },
        ]}
      />
      {flat.verdict && (
        <p className="text-sm text-ink-soft">
          The value the validators agreed on: <code className="mono rounded-sm bg-paper-deep px-1.5 py-0.5 text-ink">{flat.verdict}</code>
        </p>
      )}
      <p className="text-sm">
        <Link href="/flats" className="link">
          {isMock ? "Try another flat" : "Find another flat"}
        </Link>
      </p>
    </div>
  );
}
