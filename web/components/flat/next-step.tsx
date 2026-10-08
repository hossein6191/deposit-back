"use client";

// What happens next on a flat, for whoever is looking: the tenant, the landlord or anyone else. One
// panel, driven by the flat's phase on the clock, with the one key tag to press and the money it
// moves said before anything is signed. Every party who could be stuck has a way out here: a
// tenant whose landlord never reports reclaims, a landlord whose tenant never answers settles.

import * as React from "react";
import Link from "next/link";

import { AnswerPanel } from "@/components/flat/answer-panel";
import { KeyTag } from "@/components/key-tag";
import { ReportForm } from "@/components/report-form";
import { SplitBar, partyWords } from "@/components/split-bar";
import { TxRail } from "@/components/tx-rail";
import { WalletGate } from "@/components/wallet-gate";
import { calls, isMock, phaseNow, requestDemoReport } from "@/lib/chain";
import { sampleFor } from "@/lib/demo-flats";
import { gen, span, windowLabel } from "@/lib/format";
import type { Call, DemoStatus, Flat, TxStatus } from "@/lib/types";

export type Role = "tenant" | "landlord" | "other";

/** When the demo landlord was last asked about a flat in this tab: it is asked by itself at most every two minutes. */
const askedAt = new Map<string, number>();

function DemoReport({
  flat,
  demo,
  onFinal,
  remember,
}: {
  flat: Flat;
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

  return (
    <div className="space-y-3">
      <p className="text-[0.95rem]">
        <strong>The demo landlord files the move-out report for you.</strong> This flat is one of the six sample flats, and its landlord is a demo
        account run by this site: it signs the sample&apos;s scripted move-out notes and deductions now, so you can answer them alone.
      </p>
      {demo && !demo.online && (
        <p className="rounded-sm bg-[#f3e6c8] p-2.5 text-sm">
          The demo landlord is offline right now ({demo.reason}). Nothing is lost: if no report is filed within the window, you reclaim your whole
          deposit from this page.
        </p>
      )}
      {asking && <p className="text-sm text-ink-soft">Asking the demo landlord…</p>}
      {hash && <TxRail hash={hash} label="The demo landlord files the move-out report" onDone={onFinal} />}
      {why && (
        <div className="space-y-2 text-sm">
          <p className="text-brick">The demo landlord did not file it: {why}</p>
          <KeyTag size="sm" variant="outline" onClick={() => void ask()} disabled={asking}>
            Ask the demo landlord again
          </KeyTag>
        </div>
      )}
      {!hash && !asking && !why && demo?.online && (
        <KeyTag size="sm" variant="outline" onClick={() => void ask()}>
          Ask the demo landlord now
        </KeyTag>
      )}
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
  onDemoFinal: (s: TxStatus) => void;
  remember: (hash: string, label: string) => void;
}) {
  const [readNotes, setReadNotes] = React.useState(false);
  const phase = now > 0 ? phaseNow(flat, now) : flat.phase;
  const deposit = BigInt(flat.depositAtto);
  const deducted = BigInt(flat.deductedAtto);
  const words = partyWords(role);
  const left = (end: number) => (now > 0 ? span(end - now) : "the time left");
  const isDemoFlat = !!demo?.landlord && flat.landlord === demo.landlord && !!sampleFor(flat.title, flat.items);

  switch (phase) {
    case "take":
      if (role === "landlord")
        return (
          <div className="space-y-3">
            <p>Nobody has taken this flat yet. While nobody has, you may withdraw the offer; nothing is held, so nothing moves.</p>
            <KeyTag variant="outline" disabled={busy} onClick={() => run(calls.withdrawOffer(flat.id), `Withdrawing the offer of ${flat.id}`)}>
              Withdraw the offer
            </KeyTag>
          </div>
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
            <p>
              You live here, and the contract holds your deposit. When you have moved out, give notice: the landlord then has{" "}
              <strong>{windowLabel(flat.moveoutSeconds)}</strong> to file the move-out report. If no report comes in that time, you reclaim the whole
              deposit.
            </p>
            {isDemoFlat && <p className="text-sm text-ink-soft">This is a sample flat: right after your notice, the demo landlord files its move-out report for you.</p>}
            <WalletGate what="to give notice">
              <KeyTag disabled={busy} onClick={() => run(calls.giveNotice(flat.id), `Giving notice on ${flat.id}`)}>
                {busy ? "Waiting for the wallet…" : "I have moved out: give notice"}
              </KeyTag>
            </WalletGate>
          </div>
        );
      return (
        <p>
          {role === "landlord" ? "Your tenant lives here." : "Let; a tenant lives here."} Nothing happens until the tenant gives notice; then the
          landlord has {windowLabel(flat.moveoutSeconds)} to file the move-out report.
        </p>
      );
    case "report":
      if (role === "landlord")
        return (
          <div className="space-y-3">
            <p>
              Your tenant has moved out. File the move-out report within <strong>{left(flat.moveoutEnd)}</strong>: one note per item, and a
              deduction for any item that needs one. If you do not, anyone may send the whole deposit back to the tenant.
            </p>
            <WalletGate what="to file the report">
              <ReportForm flat={flat} run={run} busy={busy} />
            </WalletGate>
          </div>
        );
      if (role === "tenant" && isDemoFlat) return <DemoReport flat={flat} demo={demo} onFinal={onDemoFinal} remember={remember} />;
      return (
        <p>
          The {role === "tenant" ? "" : "tenant has moved out and the "}landlord has <strong>{left(flat.moveoutEnd)}</strong> to file the
          move-out report. If no report comes in that time, anyone may send the whole deposit back to the tenant.
        </p>
      );
    case "reclaim":
      return (
        <div className="space-y-3">
          <p>
            The report window closed with no report. The landlord loses every deduction: anyone may now send the{" "}
            <strong>whole deposit, {gen(deposit)}, back to the tenant</strong>. Who presses does not change where the money goes.
          </p>
          <WalletGate what="to reclaim it">
            <KeyTag variant="sage" disabled={busy} onClick={() => run(calls.reclaim(flat.id), `Reclaiming the deposit of ${flat.id} for the tenant`)}>
              {busy ? "Waiting for the wallet…" : `Send ${gen(deposit)} back to the tenant`}
            </KeyTag>
          </WalletGate>
        </div>
      );
    case "answer":
      if (role === "tenant")
        return (
          <WalletGate what="to answer the report">
            <AnswerPanel flat={flat} now={now} ticked={ticked} onTick={onTick} run={run} busy={busy} />
          </WalletGate>
        );
      return (
        <div className="space-y-3">
          <p>
            The report is filed: {flat.deductions.length} deduction{flat.deductions.length === 1 ? "" : "s"}, {gen(deducted)} of {gen(deposit)}. The
            tenant has <strong>{left(flat.responseEnd)}</strong> to accept it or contest some of it. If they do not answer, anyone may settle it
            as filed.
          </p>
          <SplitBar
            total={deposit}
            parts={[
              { label: words.tenant + " whatever happens", atto: deposit - deducted, tone: "tenant" },
              { label: "Deducted, until the tenant answers", atto: deducted, tone: "open" },
            ]}
          />
        </div>
      );
    case "settle":
      return (
        <div className="space-y-3">
          <p>
            The response window closed with no answer, so the report stands as filed: anyone may now send <strong>{gen(deducted)} to the landlord</strong>{" "}
            and <strong>{gen(deposit - deducted)} back to the tenant</strong>.
          </p>
          <WalletGate what="to settle it">
            <KeyTag disabled={busy} onClick={() => run(calls.settle(flat.id), `Settling ${flat.id} as filed`)}>
              {busy ? "Waiting for the wallet…" : "Settle as filed"}
            </KeyTag>
          </WalletGate>
        </div>
      );
    case "closed":
      return <Closed flat={flat} role={role} />;
    default:
      return <p className="text-ink-soft">The contract had no clock when it was read; this page reads it again in a moment.</p>;
  }
}

const ENDINGS: Record<string, string> = {
  withdrawn: "The landlord withdrew the offer before anybody took it. Nothing was ever held.",
  reclaimed: "The landlord filed no report in time, so the whole deposit went back to the tenant.",
  clean: "The landlord filed a report with no deduction, so the whole deposit went back to the tenant in the same transaction.",
  accepted: "The tenant accepted every deduction: they went to the landlord and the rest of the deposit to the tenant.",
  judged: "The tenant contested; the network read each contested deduction and the money moved in the same transaction.",
  settled: "The tenant did not answer in time, so the report stood as filed.",
};

function Closed({ flat, role }: { flat: Flat; role: Role }) {
  const words = partyWords(role);
  const deposit = BigInt(flat.depositAtto);
  return (
    <div className="space-y-3">
      <p>{ENDINGS[flat.status]}</p>
      {flat.status !== "withdrawn" && (
        <SplitBar
          total={deposit}
          parts={[
            { label: words.tenant, atto: BigInt(flat.paidTenantAtto), tone: "tenant" },
            { label: words.landlord, atto: BigInt(flat.paidLandlordAtto), tone: "landlord" },
          ]}
        />
      )}
      {flat.verdict && (
        <p className="text-sm text-ink-soft">
          The value the validators agreed on: <code className="mono rounded-sm bg-paper-deep px-1.5 py-0.5 text-ink">{flat.verdict}</code>
        </p>
      )}
      {flat.status !== "withdrawn" && (
        <p className="text-sm">
          <Link href="/flats" className="link">
            {isMock ? "Try another flat" : "Find another flat"}
          </Link>
        </p>
      )}
    </div>
  );
}
