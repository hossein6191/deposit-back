// Stamps: the status of a flat, and the word the contract wrote for one deduction.

import type { FlatStatus, Outcome } from "@/lib/rules";
import { cx } from "@/lib/cx";

export const STATUS_WORDS: Record<FlatStatus, { label: string; tone: string; line: string }> = {
  open: { label: "To let", tone: "text-terracotta-ink", line: "Offered; anyone but the landlord may take it with the deposit." },
  let: { label: "Let", tone: "text-ink", line: "Taken; the contract holds the deposit." },
  notice: { label: "Moved out", tone: "text-ochre-ink", line: "The tenant gave notice; the landlord's report window runs." },
  reported: { label: "Report filed", tone: "text-terracotta-ink", line: "The move-out report is filed; the tenant's response window runs." },
  withdrawn: { label: "Withdrawn", tone: "text-ink-faint", line: "The landlord withdrew the offer before anybody took it." },
  reclaimed: { label: "Reclaimed", tone: "text-sage-ink", line: "No report in time: the whole deposit went back to the tenant." },
  clean: { label: "Clean", tone: "text-sage-ink", line: "A report with no deduction: the whole deposit went back." },
  accepted: { label: "Accepted", tone: "text-ink-soft", line: "The tenant accepted every deduction." },
  judged: { label: "Judged", tone: "text-ink", line: "The tenant contested; the network read the contested deductions." },
  settled: { label: "Settled as filed", tone: "text-ink-soft", line: "No answer in the response window: the deductions stood." },
};

export function StatusStamp({ status, className }: { status: FlatStatus; className?: string }) {
  const w = STATUS_WORDS[status];
  return <span className={cx("stamp", w.tone, className)}>{w.label}</span>;
}

export const OUTCOME_WORDS: Record<Exclude<Outcome, "">, { label: string; tone: string; line: string }> = {
  damage: { label: "Damage", tone: "text-brick", line: "beyond ordinary wear: the landlord keeps this deduction" },
  wear: { label: "Wear", tone: "text-sage-ink", line: "ordinary wear and tear: this deduction goes back to the tenant" },
  unclear: { label: "Unclear", tone: "text-ochre-ink", line: "the notes do not settle it, and the burden of proof is the landlord's: back to the tenant" },
  uncontested: { label: "Uncontested", tone: "text-ink-soft", line: "the tenant contested other deductions, not this one: it stands" },
  accepted: { label: "Accepted", tone: "text-ink-soft", line: "the tenant accepted the report: it stands" },
  unanswered: { label: "Unanswered", tone: "text-ink-soft", line: "nobody answered in the response window: it stands" },
};

export function OutcomeStamp({ outcome, className }: { outcome: Outcome; className?: string }) {
  if (!outcome) return null;
  const w = OUTCOME_WORDS[outcome];
  return <span className={cx("stamp", w.tone, className)}>{w.label}</span>;
}
