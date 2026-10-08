"use client";

// The tenant's answer to a move-out report: accept every deduction, or tick the ones the network
// should read. The money each choice moves is shown before anything is signed.

import * as React from "react";

import { KeyTag } from "@/components/key-tag";
import { SplitBar } from "@/components/split-bar";
import { calls } from "@/lib/chain";
import { gen, span } from "@/lib/format";
import type { Call, Flat } from "@/lib/types";
import { cx } from "@/lib/cx";

export function AnswerPanel({
  flat,
  now,
  ticked,
  onTick,
  run,
  busy,
}: {
  flat: Flat;
  now: number;
  ticked: ReadonlySet<number>;
  onTick: (index: number, on: boolean) => void;
  run: (call: Call, label: string) => void;
  busy: boolean;
}) {
  const [confirmAccept, setConfirmAccept] = React.useState(false);
  const deposit = BigInt(flat.depositAtto);
  const deducted = BigInt(flat.deductedAtto);
  const contested = flat.deductions.filter((d) => ticked.has(d.index)).reduce((a, d) => a + BigInt(d.amountAtto), 0n);
  const standing = deducted - contested;
  const picked = [...ticked].sort((a, b) => a - b);
  const left = flat.responseEnd - now;

  return (
    <div className="space-y-4">
      <p className="text-[0.95rem]">
        The landlord deducted <strong>{gen(deducted)}</strong> of your <strong>{gen(deposit)}</strong> deposit. You have{" "}
        <strong>{now > 0 ? span(left) : "until the window closes"}</strong> to answer; if you do not, anyone may settle the report as filed.
      </p>
      <fieldset>
        <legend className="text-sm font-semibold">Tick each deduction you want the network to read</legend>
        <ul className="mt-2 space-y-2">
          {flat.deductions.map((d) => {
            const on = ticked.has(d.index);
            return (
              <li key={d.index}>
                <label
                  className={cx(
                    "flex cursor-pointer gap-3 rounded-sm border p-2.5 text-sm",
                    on ? "border-terracotta bg-terracotta/5" : "border-rule bg-card",
                  )}
                >
                  <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#a4502f]" checked={on} onChange={(e) => onTick(d.index, e.target.checked)} />
                  <span className="min-w-0">
                    <span className="flex flex-wrap gap-x-2 font-semibold">
                      <span>{d.id}</span>
                      <span>{d.itemName}</span>
                      <span className="tabular-nums">{gen(d.amountAtto)}</span>
                    </span>
                    <span className="mt-0.5 block text-ink-soft">{d.reason}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <SplitBar
        total={deposit}
        parts={[
          { label: "Back to you whatever happens", atto: deposit - deducted, tone: "tenant" },
          { label: picked.length ? "Read by the network" : "Ticked: none", atto: contested, tone: "open" },
          { label: "Stands as filed, to the landlord", atto: standing, tone: "landlord" },
        ]}
        caption={
          picked.length
            ? `If the network reads every ticked deduction as wear or unclear, ${gen(deposit - standing)} comes back to you; if all of them as damage, ${gen(deposit - deducted)}.`
            : "Tick at least one deduction to contest, or accept the report as it is."
        }
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <KeyTag disabled={busy || picked.length === 0} onClick={() => run(calls.contest(flat.id, picked), `Contesting ${picked.map((k) => "D" + (k + 1)).join(", ")} on ${flat.id}`)}>
          {busy ? "Waiting for the wallet…" : picked.length ? `Contest ${picked.length} deduction${picked.length === 1 ? "" : "s"}` : "Contest"}
        </KeyTag>
        {!confirmAccept ? (
          <KeyTag variant="outline" disabled={busy} onClick={() => setConfirmAccept(true)}>
            Accept every deduction
          </KeyTag>
        ) : (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <span>
              {gen(deducted)} to the landlord and {gen(deposit - deducted)} back to you, now. Sure?
            </span>
            <KeyTag size="sm" variant="outline" disabled={busy} onClick={() => run(calls.accept(flat.id), `Accepting the report of ${flat.id}`)}>
              Yes, accept
            </KeyTag>
            <button type="button" className="link" onClick={() => setConfirmAccept(false)}>
              No
            </button>
          </span>
        )}
      </div>
      <p className="text-xs text-ink-faint">
        A contest is one transaction. Every validator reads each ticked deduction twice, in two framings, and the money moves in the same transaction:
        damage to the landlord, wear and unclear back to you, unticked ones to the landlord. A contest is final; it can be sent again only if the
        validators did not reach a majority.
      </p>
    </div>
  );
}
