"use client";

// The landlord's move-out report: one move-out note per item, and a deduction for any item that
// needs one (an amount and a reason). Every note, reason and amount has ready suggestions that fill
// it in one click (lib/suggestions.ts); the reasons offered follow the note picked. Checked here
// against the contract's own limits before the wallet is asked; the contract checks again.

import * as React from "react";

import { KeyTag } from "@/components/key-tag";
import { SplitBar } from "@/components/split-bar";
import { Chips } from "@/components/suggest";
import { calls, type DeductionDraft } from "@/lib/chain";
import { sampleFor } from "@/lib/demo-flats";
import { genText, gen, tryAtto } from "@/lib/format";
import { MAX_DEDUCTIONS, MAX_NOTE, MAX_REASON, MIN_NOTE, MIN_REASON, plain, sentence, textProblem } from "@/lib/rules";
import { AMOUNT_SUGGESTIONS, NOTE_KINDS, REASON_KINDS, deductionReason, moveOutNote, reasonsFor, type NoteKind } from "@/lib/suggestions";
import type { Call, Flat } from "@/lib/types";
import { cx } from "@/lib/cx";

/** `kind` is the move-out suggestion last picked for the line, which decides the reasons offered. */
type Line = { note: string; kind: NoteKind | ""; on: boolean; amount: string; reason: string };

export function ReportForm({ flat, run, busy }: { flat: Flat; run: (call: Call, label: string) => void; busy: boolean }) {
  const [lines, setLines] = React.useState<Line[]>(() => flat.items.map(() => ({ note: "", kind: "", on: false, amount: "", reason: "" })));
  const [tried, setTried] = React.useState(false);
  const sample = sampleFor(flat.title, flat.items);
  const deposit = BigInt(flat.depositAtto);

  const set = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, i) => (i === k ? { ...l, ...patch } : l)));

  const loadSample = () => {
    if (!sample) return;
    setLines(
      flat.items.map((_, k) => {
        const d = sample.deductions.find((x) => x.item === k);
        return { note: sample.moveOut[k] ?? "", kind: "", on: !!d, amount: d ? genText(d.amount) : "", reason: d?.reason ?? "" };
      }),
    );
  };

  // What the contract would say about each line, in the site's words.
  const problems = lines.map((l, k) => {
    const name = flat.items[k].name;
    const note = textProblem(plain(l.note), MIN_NOTE, MAX_NOTE, `The move-out note for ${name}`);
    if (!l.on) return { note, amount: "", reason: "" };
    const atto = tryAtto(l.amount);
    const amount = atto === null || atto < 1n ? "Write the amount in GEN, like 0.25." : "";
    const reason = textProblem(plain(l.reason), MIN_REASON, MAX_REASON, `The reason for ${name}`);
    return { note, amount, reason };
  });
  const deductions: DeductionDraft[] = lines.flatMap((l, k) => {
    const atto = l.on ? tryAtto(l.amount) : null;
    return l.on && atto !== null && atto > 0n ? [{ item: k, amountAtto: atto, reason: plain(l.reason) }] : [];
  });
  const total = deductions.reduce((a, d) => a + d.amountAtto, 0n);
  /** What the other lines leave of the deposit for line k: an amount chip above it is greyed out. */
  const leftFor = (k: number) => deposit - deductions.reduce((a, d) => (d.item === k ? a : a + d.amountAtto), 0n);
  const count = lines.filter((l) => l.on).length;
  const whole: string[] = [];
  if (count > MAX_DEDUCTIONS) whole.push(`At most ${MAX_DEDUCTIONS} deductions, one per item; this report has ${count}.`);
  if (total > deposit) whole.push(`The deductions add up to ${gen(total)}, more than the deposit of ${gen(deposit)}.`);
  const ok = whole.length === 0 && problems.every((p) => !p.note && !p.amount && !p.reason);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!ok) return;
    run(
      calls.report(
        flat.id,
        lines.map((l) => plain(l.note)),
        deductions,
      ),
      `Filing the move-out report of ${flat.id}`,
    );
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {sample && (
        <div className="flex flex-wrap items-center gap-3 rounded-sm bg-paper-deep/70 p-3 text-sm">
          <p className="min-w-0 flex-1">
            This is a copy of the sample flat <strong>{sample.title}</strong>. Its scripted move-out notes and deductions are ready to load.
          </p>
          <KeyTag size="sm" variant="outline" onClick={loadSample}>
            Load the sample report
          </KeyTag>
        </div>
      )}
      <ol className="space-y-4">
        {flat.items.map((item, k) => {
          const l = lines[k];
          const p = problems[k];
          return (
            <li key={k} className="rounded-sm border border-rule p-3">
              <p className="font-display text-lg font-semibold">
                {k + 1}. {item.name}
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                <span className="font-semibold text-ink">At move-in: </span>
                {item.moveIn}
              </p>
              <label className="mt-2 block text-sm font-semibold" htmlFor={`note-${k}`}>
                At move-out
              </label>
              <textarea
                id={`note-${k}`}
                className="field mt-1 min-h-[4.5rem]"
                value={l.note}
                onChange={(e) => set(k, { note: e.target.value })}
                aria-invalid={tried && !!p.note}
                aria-describedby={`note-${k}-help`}
                placeholder="What you found, in plain words: where, how big, how bad."
              />
              <p id={`note-${k}-help`} className={cx("mt-1 text-xs", tried && p.note ? "text-brick" : "text-ink-faint")}>
                {tried && p.note ? sentence(p.note) : `${plain(l.note).length} of ${MIN_NOTE} to ${MAX_NOTE} characters. Only what this note says can show damage.`}
              </p>
              <Chips
                className="mt-2"
                label={`Move-out suggestions for ${item.name}`}
                lead="Pick one:"
                chips={NOTE_KINDS.map((n) => ({ key: n.kind, label: n.label, pressed: plain(l.note) === moveOutNote(n.kind, item.name) }))}
                onPick={(kind) => set(k, { note: moveOutNote(kind as NoteKind, item.name), kind: kind as NoteKind })}
              />
              <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="size-4 accent-[#a4502f]" checked={l.on} onChange={(e) => set(k, { on: e.target.checked })} />
                Deduct for this item
              </label>
              {l.on && (
                <div className="mt-2 grid gap-3 sm:grid-cols-[9rem_1fr]">
                  <div>
                    <label className="block text-sm font-semibold" htmlFor={`amount-${k}`}>
                      Amount (GEN)
                    </label>
                    <input
                      id={`amount-${k}`}
                      inputMode="decimal"
                      className="field mt-1"
                      value={l.amount}
                      onChange={(e) => set(k, { amount: e.target.value })}
                      aria-invalid={tried && !!p.amount}
                      placeholder="0.25"
                    />
                    {tried && p.amount && <p className="mt-1 text-xs text-brick">{p.amount}</p>}
                    <Chips
                      className="mt-2"
                      label={`Amount suggestions in GEN for ${item.name}`}
                      chips={AMOUNT_SUGGESTIONS.map((v) => {
                        const atto = tryAtto(v) ?? 0n;
                        return { key: v, label: v, pressed: tryAtto(l.amount) === atto, disabled: atto > leftFor(k) };
                      })}
                      onPick={(v) => set(k, { amount: v })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold" htmlFor={`reason-${k}`}>
                      Reason
                    </label>
                    <textarea
                      id={`reason-${k}`}
                      className="field mt-1 min-h-[3.5rem]"
                      value={l.reason}
                      onChange={(e) => set(k, { reason: e.target.value })}
                      aria-invalid={tried && !!p.reason}
                      placeholder="What the money pays for."
                    />
                    <p className={cx("mt-1 text-xs", tried && p.reason ? "text-brick" : "text-ink-faint")}>
                      {tried && p.reason ? sentence(p.reason) : `${MIN_REASON} to ${MAX_REASON} characters. The reason is your claim, not evidence.`}
                    </p>
                    <Chips
                      className="mt-2"
                      label={`Reason suggestions for ${item.name}`}
                      lead="Pick one:"
                      chips={REASON_KINDS.filter((r) => reasonsFor(l.kind).includes(r.kind)).map((r) => {
                        return { key: r.kind, label: r.label, pressed: plain(l.reason) === deductionReason(r.kind, l.kind, item.name) };
                      })}
                      onPick={(kind) => {
                        const r = REASON_KINDS.find((x) => x.kind === kind);
                        if (r) set(k, { reason: deductionReason(r.kind, l.kind, item.name) });
                      }}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="rounded-sm border border-rule bg-card p-3">
        <p className="text-sm font-semibold">
          {count === 0 ? "No deduction: the whole deposit goes back to the tenant in the same transaction." : `${count} deduction${count === 1 ? "" : "s"}, ${gen(total)} of a ${gen(deposit)} deposit.`}
        </p>
        {count > 0 && total <= deposit && (
          <SplitBar
            className="mt-2"
            total={deposit}
            parts={[
              { label: "Back to the tenant whatever happens", atto: deposit - total, tone: "tenant" },
              { label: "Deducted, until the tenant answers", atto: total, tone: "open" },
            ]}
          />
        )}
        {whole.map((w) => (
          <p key={w} className="mt-1 text-sm text-brick">
            {w}
          </p>
        ))}
      </div>
      <KeyTag type="submit" disabled={busy}>
        {busy ? "Waiting for the wallet…" : "File the move-out report"}
      </KeyTag>
      {tried && !ok && <p className="text-sm text-brick">Something above needs fixing before the report can be filed.</p>}
    </form>
  );
}
