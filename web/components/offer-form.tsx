"use client";

// Offering a flat: a title, an address line, a deposit, two windows, and two to eight items, each
// with its condition on the day the tenant moves in. Load one of the ten sample flats, or write
// your own; every field also has ready suggestions that fill it in one click (components/suggest.tsx),
// and the plan beside the form is redrawn from the items as they are typed.

import * as React from "react";

import { FloorPlan } from "@/components/floor-plan";
import { KeyTag } from "@/components/key-tag";
import { Chips, ItemPicker } from "@/components/suggest";
import { calls } from "@/lib/chain";
import { SAMPLE_FLATS, type SampleFlat } from "@/lib/demo-flats";
import { genText, tryAtto } from "@/lib/format";
import { buildPlan, planForFlat } from "@/lib/plans";
import {
  MAX_ADDRESS,
  MAX_DEPOSIT,
  MAX_ITEMS,
  MAX_NAME,
  MAX_NOTE,
  MAX_TITLE,
  MIN_ADDRESS,
  MIN_DEPOSIT,
  MIN_ITEMS,
  MIN_NAME,
  MIN_NOTE,
  MIN_TITLE,
  plain,
  sentence,
  textProblem,
} from "@/lib/rules";
import { ADDRESS_SUGGESTIONS, DEPOSIT_SUGGESTIONS, TITLE_SUGGESTIONS } from "@/lib/suggestions";
import type { Call } from "@/lib/types";
import { cx } from "@/lib/cx";

const REPORT_WINDOWS = [
  { s: 1800, label: "30 minutes" },
  { s: 7200, label: "2 hours" },
  { s: 86400, label: "1 day" },
  { s: 3 * 86400, label: "3 days" },
  { s: 7 * 86400, label: "7 days" },
];
const RESPONSE_WINDOWS = [
  { s: 3600, label: "1 hour" },
  { s: 86400, label: "1 day" },
  { s: 3 * 86400, label: "3 days" },
  { s: 7 * 86400, label: "7 days" },
];

type Draft = { title: string; addressLine: string; deposit: string; moveout: number; response: number; items: { name: string; moveIn: string }[] };

const EMPTY: Draft = { title: "", addressLine: "", deposit: "", moveout: 7200, response: 86400, items: [{ name: "", moveIn: "" }, { name: "", moveIn: "" }] };

const fromSample = (s: SampleFlat): Draft => ({
  title: s.title,
  addressLine: s.addressLine,
  deposit: genText(s.depositAtto),
  moveout: s.moveoutSeconds,
  response: s.responseSeconds,
  items: s.items.map((i) => ({ name: i.name, moveIn: i.move_in })),
});

export function OfferForm({ run, busy }: { run: (call: Call, label: string) => void; busy: boolean }) {
  const [d, setD] = React.useState<Draft>(EMPTY);
  const [tried, setTried] = React.useState(false);
  const [loaded, setLoaded] = React.useState("");

  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));
  const setItem = (k: number, patch: Partial<{ name: string; moveIn: string }>) =>
    setD((x) => ({ ...x, items: x.items.map((it, i) => (i === k ? { ...it, ...patch } : it)) }));

  const title = plain(d.title);
  const addressLine = plain(d.addressLine);
  const items = d.items.map((i) => ({ name: plain(i.name), moveIn: plain(i.moveIn) }));
  const deposit = tryAtto(d.deposit);
  const problems = {
    title: textProblem(title, MIN_TITLE, MAX_TITLE, "The title"),
    address: textProblem(addressLine, MIN_ADDRESS, MAX_ADDRESS, "The address line"),
    deposit: deposit === null || deposit < MIN_DEPOSIT || deposit > MAX_DEPOSIT ? "The deposit is from 0.1 to 1000 GEN, written like 1.5." : "",
    items: items.map((it, k) => {
      const name = textProblem(it.name, MIN_NAME, MAX_NAME, `The name of item ${k + 1}`);
      const twin = !name && items.findIndex((o) => o.name.toLowerCase() === it.name.toLowerCase()) < k ? `Two items are named ${it.name}; give each its own name` : "";
      return { name: name || twin, note: textProblem(it.moveIn, MIN_NOTE, MAX_NOTE, `The move-in note of item ${k + 1}`) };
    }),
  };
  const used = new Set(items.map((it) => it.name.toLowerCase()).filter(Boolean));
  const ok = !problems.title && !problems.address && !problems.deposit && problems.items.every((p) => !p.name && !p.note);
  const plan = planForFlat(title, items.map((it, k) => ({ name: it.name || `Item ${k + 1}`, moveIn: it.moveIn })));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (!ok || deposit === null) return;
    run(calls.offer(title, addressLine, items, deposit, d.moveout, d.response), `Offering ${title}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold">Load a sample flat</p>
        <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SAMPLE_FLATS.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => {
                  setD(fromSample(s));
                  setLoaded(s.key);
                  setTried(false);
                }}
                aria-pressed={loaded === s.key}
                className={cx(
                  "flex h-full w-full flex-col rounded-sm border bg-card p-1.5 text-left text-xs",
                  loaded === s.key ? "border-terracotta outline-2 outline-terracotta" : "border-rule hover:border-ink/50",
                )}
              >
                <FloorPlan plan={buildPlan(s.plan)} states={[]} compact title="" />
                <span className="mt-1 font-semibold leading-tight">{s.title}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-faint">
          Or{" "}
          <button
            type="button"
            className="link"
            onClick={() => {
              setD(EMPTY);
              setLoaded("");
              setTried(false);
            }}
          >
            start from a blank form
          </button>{" "}
          and write your own.
        </p>
      </div>

      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Field
            id="title"
            label="Title"
            problem={tried ? problems.title : ""}
            hint={`${MIN_TITLE} to ${MAX_TITLE} characters`}
            extra={
              <Chips
                label="Title suggestions"
                lead="Pick one:"
                chips={TITLE_SUGGESTIONS.map((t) => ({ key: t, label: t, pressed: title === t }))}
                onPick={(t) => set({ title: t })}
              />
            }
          >
            <input id="title" className="field" value={d.title} onChange={(e) => set({ title: e.target.value })} aria-invalid={tried && !!problems.title} placeholder="Two-bedroom flat above the bakery" />
          </Field>
          <Field
            id="address"
            label="Address line"
            problem={tried ? problems.address : ""}
            hint={`${MIN_ADDRESS} to ${MAX_ADDRESS} characters`}
            extra={
              <Chips
                label="Address suggestions"
                lead="Pick one:"
                chips={ADDRESS_SUGGESTIONS.map((a) => ({ key: a, label: a, pressed: addressLine === a }))}
                onPick={(a) => set({ addressLine: a })}
              />
            }
          >
            <input id="address" className="field" value={d.addressLine} onChange={(e) => set({ addressLine: e.target.value })} aria-invalid={tried && !!problems.address} placeholder="Flat 2, 14 Mill Lane" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              id="deposit"
              label="Deposit (GEN)"
              problem={tried ? problems.deposit : ""}
              hint="0.1 to 1000 test GEN"
              extra={
                <Chips
                  label="Deposit suggestions in GEN"
                  chips={DEPOSIT_SUGGESTIONS.map((v) => ({ key: v, label: `${v} GEN`, pressed: deposit !== null && deposit === tryAtto(v) }))}
                  onPick={(v) => set({ deposit: v })}
                />
              }
            >
              <input id="deposit" inputMode="decimal" className="field" value={d.deposit} onChange={(e) => set({ deposit: e.target.value })} aria-invalid={tried && !!problems.deposit} placeholder="1" />
            </Field>
            <Field id="moveout" label="Your time to report" hint="from the tenant's notice">
              <select id="moveout" className="field" value={d.moveout} onChange={(e) => set({ moveout: Number(e.target.value) })}>
                {REPORT_WINDOWS.map((w) => (
                  <option key={w.s} value={w.s}>
                    {w.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="response" label="Tenant's time to answer" hint="from your report">
              <select id="response" className="field" value={d.response} onChange={(e) => set({ response: Number(e.target.value) })}>
                {RESPONSE_WINDOWS.map((w) => (
                  <option key={w.s} value={w.s}>
                    {w.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">
              The items, {MIN_ITEMS} to {MAX_ITEMS}, as they are on move-in day
            </legend>
            {d.items.map((it, k) => (
              <div key={k} className="rounded-sm border border-rule bg-card p-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="mr-auto font-display text-lg font-semibold">Item {k + 1}</span>
                  <ItemPicker id={`picker-${k}`} used={used} onPick={(s) => setItem(k, { name: s.name, moveIn: s.moveIn })} />
                  {d.items.length > MIN_ITEMS && (
                    <button type="button" className="link text-sm" onClick={() => setD((x) => ({ ...x, items: x.items.filter((_, i) => i !== k) }))}>
                      Remove
                    </button>
                  )}
                </div>
                <div className="mt-2 grid gap-3 sm:grid-cols-[12rem_1fr]">
                  <Field id={`name-${k}`} label="Name" problem={tried ? problems.items[k].name : ""}>
                    <input id={`name-${k}`} className="field" value={it.name} onChange={(e) => setItem(k, { name: e.target.value })} aria-invalid={tried && !!problems.items[k].name} placeholder="Kitchen worktop" />
                  </Field>
                  <Field id={`movein-${k}`} label="Condition at move-in" problem={tried ? problems.items[k].note : ""} hint={`${items[k].moveIn.length} of ${MIN_NOTE} to ${MAX_NOTE} characters`}>
                    <textarea id={`movein-${k}`} className="field min-h-[4rem]" value={it.moveIn} onChange={(e) => setItem(k, { moveIn: e.target.value })} aria-invalid={tried && !!problems.items[k].note} placeholder="Grey laminate, no burns, cuts, chips or stains anywhere along its length." />
                  </Field>
                </div>
              </div>
            ))}
            {d.items.length < MAX_ITEMS && (
              <KeyTag size="sm" variant="outline" onClick={() => setD((x) => ({ ...x, items: [...x.items, { name: "", moveIn: "" }] }))}>
                Add an item
              </KeyTag>
            )}
          </fieldset>
          <p className="text-sm text-ink-soft">
            Write each move-in note so that a stranger could check it: what it is, its colour, what is wrong with it already. The tenant accepts these
            notes by taking the flat, and every deduction is later read against them.
          </p>
          <KeyTag type="submit" disabled={busy}>
            {busy ? "Waiting for the wallet…" : "Offer this flat"}
          </KeyTag>
          {tried && !ok && <p className="text-sm text-brick">Something above needs fixing before the flat can be offered.</p>}
        </div>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-sm font-semibold">The plan tenants will see</p>
          <div className="mt-2 rounded-sm border border-rule bg-paper p-1.5">
            <FloorPlan plan={plan} states={[]} names={items.map((i) => i.name)} title="Plan preview" />
          </div>
          <p className="mt-2 text-xs text-ink-faint">A sample flat keeps its own plan. A flat you write is drawn from its items: one room each, the kind guessed from the name.</p>
        </aside>
      </form>
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  problem,
  extra,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  problem?: string;
  /** shown under the hint: the field's suggestions */
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {problem ? <p className="mt-1 text-xs text-brick">{sentence(problem)}</p> : hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
      {extra && <div className="mt-2">{extra}</div>}
    </div>
  );
}
