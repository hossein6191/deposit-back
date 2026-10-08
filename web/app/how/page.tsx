// How the network decides whether a deduction is damage or ordinary wear, where the money goes,
// and the limits, said plainly. The last section is the contract's own words, read live.

import Link from "next/link";

import { ContractWords } from "@/components/contract-words";
import { SectionHead } from "@/components/help";
import { KeyTagLink } from "@/components/key-tag";

const th = "py-2 pr-4 text-left text-xs font-bold tracking-wider text-ink-faint uppercase";
const td = "py-2.5 pr-4 align-top";

export default function HowPage() {
  return (
    <div className="wrap py-8">
      <SectionHead
        as="h1"
        eyebrow="How it decides"
        title="Damage, or the flat getting older?"
        what="the question under every line of a move-out bill, how the validators answer it, and what their answer does with the money."
        help={
          <span className="block">
            Everything here is enforced by the contract, contracts/deposit_back.py. Its own words are at the foot of this page, read from the chain.
          </span>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-8">
          <section className="sheet p-5" aria-labelledby="q">
            <h2 id="q" className="text-2xl">
              The question
            </h2>
            <p className="mt-2 max-w-prose">
              Going by what the landlord wrote when the tenant moved in, and what the landlord wrote when the tenant moved out, is this change damage the
              tenant should pay for, or ordinary wear and tear? Ordinary wear is the gradual decline of normal, careful living. Damage is harm beyond
              that: an accident, misuse, carelessness or neglect.
            </p>
            <p className="mt-2 max-w-prose text-ink-soft">
              Only the change between the two notes is judged. <strong className="text-ink">The reason is the landlord&apos;s claim, not evidence:</strong> a
              change the move-out note does not describe counts for nothing, however the reason describes it.
            </p>
          </section>

          <section className="sheet p-5" aria-labelledby="ask">
            <h2 id="ask" className="text-2xl">
              Asked twice, the opposite way round
            </h2>
            <p className="mt-2 max-w-prose">
              A contest runs one consensus round. For every contested deduction, each validator asks its model the question twice, in two framings and
              with the four texts in opposite orders:
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="border-b border-ink/30">
                  <tr>
                    <th className={th}>Asking</th>
                    <th className={th}>The texts, in order</th>
                    <th className={th}>The question</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-rule-strong">
                  <tr>
                    <td className={td + " font-semibold"}>1</td>
                    <td className={td + " mono"}>ITEM, MOVE-IN, MOVE-OUT, REASON</td>
                    <td className={td}>Is the change damage beyond ordinary wear and tear, so the tenant should pay for it?</td>
                  </tr>
                  <tr>
                    <td className={td + " font-semibold"}>2</td>
                    <td className={td + " mono"}>REASON, MOVE-OUT, MOVE-IN, ITEM</td>
                    <td className={td}>Is the change ordinary wear and tear, or not shown by the notes at all, so the tenant should not pay for it?</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 max-w-prose">The contract, not the model, turns the two answers into one word:</p>
            <div className="mt-2 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-sm border border-ink/40 bg-ink/30 text-center text-sm">
              <div className="bg-paper-deep p-2 font-semibold">Asking 1</div>
              <div className="bg-paper-deep p-2 font-semibold">Asking 2</div>
              <div className="bg-paper-deep p-2 font-semibold">Word</div>
              <div className="bg-card p-2">yes</div>
              <div className="bg-card p-2">no</div>
              <div className="bg-card p-2 font-bold text-brick">damage</div>
              <div className="bg-card p-2">no</div>
              <div className="bg-card p-2">yes</div>
              <div className="bg-card p-2 font-bold text-sage-ink">wear</div>
              <div className="col-span-2 bg-card p-2">anything else, an answer it cannot read included</div>
              <div className="bg-card p-2 font-bold text-ochre-ink">unclear</div>
            </div>
            <p className="mt-4 max-w-prose text-ink-soft">
              A model that says yes to everything, or no to everything, lands on unclear, and unclear goes back to the tenant. A disagreement between the
              two askings is part of the answer, never smoothed over.
            </p>
          </section>

          <section className="sheet p-5" aria-labelledby="agree">
            <h2 id="agree" className="text-2xl">
              What the validators agree on
            </h2>
            <p className="mt-2 max-w-prose">
              The value stored is one closed word per contested deduction, in order:{" "}
              <code className="mono rounded-sm bg-paper-deep px-1.5 py-0.5">D1:wear,D2:damage,D3:wear</code>. Every validator reruns every asking itself
              and compares the whole value by exact string equality. No validator agrees with a leader whose run failed; a validator whose own run
              fails disagrees.
            </p>
            <p className="mt-2 max-w-prose text-ink-soft">
              A round that does not reach a majority stores nothing, moves nothing, and can be sent again while the tenant&apos;s window is open. A round
              that does is final, unclear included.
            </p>
          </section>

          <section className="sheet p-5" aria-labelledby="money">
            <h2 id="money" className="text-2xl">
              Where the money goes
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead className="border-b border-ink/30">
                  <tr>
                    <th className={th}>When</th>
                    <th className={th}>What moves, in the same transaction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-rule-strong">
                  <tr>
                    <td className={td + " font-semibold"}>The tenant takes the flat</td>
                    <td className={td}>Exactly the deposit goes into the contract. A wrong amount comes back at once.</td>
                  </tr>
                  <tr>
                    <td className={td + " font-semibold"}>A contest</td>
                    <td className={td}>
                      <span className="font-semibold text-brick">Damage</span> to the landlord; <span className="font-semibold text-sage-ink">wear</span> and{" "}
                      <span className="font-semibold text-ochre-ink">unclear</span> back to the tenant, because the burden of proof is the landlord&apos;s;
                      a deduction not contested to the landlord; the rest of the deposit to the tenant.
                    </td>
                  </tr>
                  <tr>
                    <td className={td + " font-semibold"}>The tenant accepts</td>
                    <td className={td}>Every deduction to the landlord, the rest to the tenant.</td>
                  </tr>
                  <tr>
                    <td className={td + " font-semibold"}>A report with no deduction</td>
                    <td className={td}>The whole deposit back to the tenant.</td>
                  </tr>
                  <tr>
                    <td className={td + " font-semibold"}>No report in time</td>
                    <td className={td}>Anyone may reclaim: the whole deposit back to the tenant.</td>
                  </tr>
                  <tr>
                    <td className={td + " font-semibold"}>No answer in time</td>
                    <td className={td}>Anyone may settle: the deductions to the landlord, the rest to the tenant.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-prose text-ink-soft">
              Every ending pays out exactly the deposit, split two ways, and the contract&apos;s balance is always the deposits it still holds.
            </p>
          </section>

          <section className="sheet p-5" aria-labelledby="sees">
            <h2 id="sees" className="text-2xl">
              What the model sees, and what it never sees
            </h2>
            <p className="mt-2 max-w-prose">
              The item&apos;s name, its move-in note, its move-out note and the landlord&apos;s reason. <strong>Never an amount</strong>, never an address,
              never the deposit: it is asked whether the tenant should pay for a change at all, never how much.
            </p>
            <p className="mt-2 max-w-prose text-ink-soft">
              The landlord wrote all four texts, with money at stake, so each is treated as untrusted: the prompt says so before them, every angle bracket
              is replaced, and each text sits between two delimiter lines tagged with the start of its own sha256, so no text can write the line that
              closes it.
            </p>
          </section>

          <section className="sheet border-t-4 border-t-ochre p-5" aria-labelledby="limits">
            <h2 id="limits" className="text-2xl">
              The limits, stated plainly
            </h2>
            <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5">
              <li>
                <strong>The landlord writes every text the network reads.</strong> It judges whether the landlord&apos;s own words show damage beyond wear,
                not whether those words are true. The tenant&apos;s protection: the move-in notes are fixed before the tenant pays, the move-out notes are
                public and signed, the reason is not evidence, and a change the notes do not show goes back to the tenant.
              </li>
              <li>
                <strong>The tenant adds no evidence of their own:</strong> no reply, no photo. Text only, and only the landlord&apos;s.
              </li>
              <li>
                <strong>The amount is never judged.</strong> A damage verdict pays the deduction as filed, so an inflated price for real damage stands. The
                tenant sees every amount before choosing what to contest.
              </li>
              <li>
                <strong>Unclear costs the landlord.</strong> A real stain described vaguely goes back to the tenant.
              </li>
              <li>
                <strong>A tenant who never gives notice keeps the deposit held.</strong> The landlord cannot start the move-out without the tenant.
              </li>
              <li>
                <strong>One general rule</strong> decides wear and tear, written in the prompt, not the law of any country. This is not legal advice and
                replaces no deposit scheme where one is required.
              </li>
              <li>
                <strong>Texts are printable ASCII on one line:</strong> titles 3 to 60 characters, item names 3 to 40, notes 20 to 400, reasons 20 to 300;
                2 to 8 items and at most 6 deductions, one per item. Deposits are 0.1 to 1000 GEN; each window 5 minutes to 30 days.
              </li>
            </ul>
          </section>

          <section className="sheet p-5" aria-labelledby="words">
            <h2 id="words" className="text-2xl">
              The contract&apos;s own words
            </h2>
            <p className="mt-1 mb-4 text-sm text-ink-soft">Read live from rules(), a view anyone can call.</p>
            <ContractWords />
          </section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="sheet p-4">
            <p className="font-display text-lg font-semibold">See it decide</p>
            <p className="mt-1 text-sm text-ink-soft">
              Take a sample flat, give notice, and the demo landlord files a report with damage and wear in it. Contest it and watch the votes come in.
            </p>
            <KeyTagLink href="/flats" size="sm" className="mt-3">
              Find a flat
            </KeyTagLink>
            <p className="mt-4 text-sm">
              <Link href="/ledger" className="link">
                How past contests were read
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
