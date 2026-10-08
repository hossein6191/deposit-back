// The home page: what Deposit Back is in one minute, a live example drawn as a floor plan, how the
// money splits, and the ways in.

import { HomeExample } from "@/components/home-example";
import { SectionHead } from "@/components/help";
import { KeyTagLink } from "@/components/key-tag";
import { SplitBar } from "@/components/split-bar";

const STEPS = [
  {
    n: "1",
    title: "The landlord writes it down",
    text: "Two to eight items, each with its condition on move-in day, in the landlord's own words. They are fixed before anybody pays.",
  },
  {
    n: "2",
    title: "You pay the deposit into the contract",
    text: "Not to the landlord. Taking the flat accepts the move-in notes; the contract holds the money for the whole tenancy.",
  },
  {
    n: "3",
    title: "At move-out, a report",
    text: "You give notice; the landlord has a fixed window to write a move-out note for every item and up to six deductions.",
  },
  {
    n: "4",
    title: "You accept, or you contest",
    text: "Validators read each contested deduction against the two notes: damage or wear. The money moves in the same transaction.",
  },
];

const GEN = 10n ** 18n;

export default function Home() {
  return (
    <>
      <section className="wrap grid grid-cols-1 gap-10 pt-10 pb-14 lg:grid-cols-[1.05fr_1fr] lg:items-start lg:pt-16">
        <div>
          <p className="eyebrow">Rental deposits, read item by item</p>
          <h1 className="mt-3 text-[2.6rem] leading-[1.04] sm:text-6xl">Your deposit comes back item by item.</h1>
          <p className="mt-5 max-w-xl text-lg text-ink-soft">
            Moving out ends with a list: repainting, carpet cleaning, a new worktop. Some of it is fair; some of it is the flat getting older. Here
            each deduction is read by GenLayer validators against what was written at move-in and at move-out, and the deposit follows their word in
            the same transaction. No agent holds the money, and nobody waits months.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-4">
            <KeyTagLink href="/flats">Find a flat to rent</KeyTagLink>
            <KeyTagLink href="/landlord" variant="outline">
              Offer a flat
            </KeyTagLink>
          </div>
          <p className="mt-6 max-w-xl text-sm text-ink-faint">
            Studio test network, test GEN only. Six sample flats are offered by a demo landlord, so you can try the whole tenancy alone in a few
            minutes: take one, give notice, and it files the move-out report for you to contest.
          </p>
        </div>
        <HomeExample />
      </section>

      <section className="border-y border-ink/10 bg-paper-deep/50 py-14">
        <div className="wrap">
          <SectionHead
            eyebrow="In one minute"
            title="A tenancy in four steps"
            what="what each side does, in order. The tenancy line on every lease page follows these steps as they happen."
            help={
              <>
                <span className="block">Nobody&apos;s money waits on somebody else&apos;s silence.</span>
                <span className="block">
                  A landlord who never files the report loses every deduction: once the window closes, anyone may send the whole deposit back. A tenant
                  who never answers accepts the report: once the window closes, anyone may settle it as filed.
                </span>
              </>
            }
          />
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="sheet relative p-5 pt-6">
                <span
                  aria-hidden="true"
                  className="absolute -top-4 left-5 flex size-9 items-center justify-center rounded-full border-2 border-ink bg-terracotta font-display text-lg font-bold text-paper"
                >
                  {s.n}
                </span>
                <h3 className="mt-2 text-xl">{s.title}</h3>
                <p className="mt-2 text-[0.95rem] text-ink-soft">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap grid grid-cols-1 gap-10 py-14 lg:grid-cols-2">
        <div>
          <SectionHead
            eyebrow="The money"
            title="How the deposit splits"
            what="each deduction goes one way or the other, and the rest of the deposit always goes back to the tenant."
            help={
              <>
                <span className="block">The model never sees an amount. It is asked whether the tenant should pay for a change at all, never how much.</span>
                <span className="block">So a damage verdict pays the deduction as filed. The tenant sees every amount before choosing what to contest.</span>
              </>
            }
          />
          <ul className="mt-6 space-y-3">
            <li className="flex items-start gap-3">
              <span className="stamp mt-0.5 text-brick">Damage</span>
              <span>Beyond ordinary wear: the deduction goes to the landlord.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="stamp mt-0.5 text-sage-ink">Wear</span>
              <span>The flat getting older: the deduction comes back to you.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="stamp mt-0.5 text-ochre-ink">Unclear</span>
              <span>The notes do not settle it. The burden of proof is the landlord&apos;s, so it comes back to you.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="stamp mt-0.5 text-ink-soft">As filed</span>
              <span>A deduction you do not contest, or a report you accept or leave unanswered, goes to the landlord.</span>
            </li>
          </ul>
        </div>
        <div className="sheet self-start p-5">
          <p className="font-display text-lg font-semibold">The flat above the bakery: a 1 GEN deposit</p>
          <p className="mt-1 text-sm text-ink-soft">
            Four deductions. The tenant contests the wall, the worktop and the carpet, and leaves the cracked mirror alone.
          </p>
          <table className="mt-4 w-full text-sm">
            <tbody className="divide-y divide-dashed divide-rule-strong">
              {[
                ["Living room walls", "0.3", "wear", "text-sage-ink", "back to the tenant"],
                ["Kitchen worktop", "0.2", "damage", "text-brick", "to the landlord"],
                ["Bedroom carpet", "0.15", "wear", "text-sage-ink", "back to the tenant"],
                ["Bathroom mirror", "0.25", "not contested", "text-ink-soft", "to the landlord"],
                ["The rest", "0.1", "", "", "back to the tenant"],
              ].map(([item, amount, word, tone, to]) => (
                <tr key={item}>
                  <td className="py-1.5 pr-2">{item}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{amount}</td>
                  <td className={"py-1.5 pr-2 font-semibold " + tone}>{word}</td>
                  <td className="py-1.5 text-ink-soft">{to}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <SplitBar
            className="mt-4"
            total={GEN}
            parts={[
              { label: "Back to the tenant", atto: (GEN * 55n) / 100n, tone: "tenant" },
              { label: "To the landlord", atto: (GEN * 45n) / 100n, tone: "landlord" },
            ]}
            caption="In the transaction that carried the verdict."
          />
        </div>
      </section>

      <section className="wrap pb-6">
        <div className="sheet flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Try it alone</p>
            <h2 className="mt-2 text-3xl">The demo landlord plays the other side</h2>
            <p className="mt-2 text-ink-soft">
              Connect a wallet and get 10 test GEN from the menu. Take one of the six sample flats, give notice, and the demo landlord files a move-out
              report with damage and wear in it. Contest what you think is wear and watch the validators decide.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-4">
            <KeyTagLink href="/flats">Pick a sample flat</KeyTagLink>
            <KeyTagLink href="/how" variant="outline">
              How it decides
            </KeyTagLink>
          </div>
        </div>
      </section>
    </>
  );
}
