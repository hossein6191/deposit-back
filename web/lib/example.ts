// The worked example, as a flat: the flat above the bakery after its tenant contested the wall,
// the worktop and the carpet and left the cracked mirror alone. The home page shows it when the
// chain has no judged flat to show yet; the numbers are the README's.

import { SAMPLE_FLATS } from "./demo-flats";
import { payeeOf, splitOf, vectorOf, deductionId, type Outcome, type Verdict } from "./rules";
import type { Flat } from "./types";

export function exampleFlat(): Flat {
  const s = SAMPLE_FLATS[0];
  const contested = [0, 1, 2];
  const outcomes: Outcome[] = s.deductions.map((d, k) => (contested.includes(k) ? d.expect : "uncontested"));
  const deposit = BigInt(s.depositAtto);
  const split = splitOf(
    deposit,
    s.deductions.map((d) => BigInt(d.amount)),
    outcomes.map(payeeOf),
  );
  return {
    id: "",
    title: s.title,
    addressLine: s.addressLine,
    status: "judged",
    phase: "closed",
    landlord: "",
    tenant: "",
    depositAtto: s.depositAtto,
    heldAtto: "0",
    moveoutSeconds: s.moveoutSeconds,
    responseSeconds: s.responseSeconds,
    offeredAt: 0,
    takenAt: 0,
    noticeAt: 0,
    moveoutEnd: 0,
    reportedAt: 1,
    responseEnd: 0,
    items: s.items.map((it, k) => ({ index: k, name: it.name, moveIn: it.move_in, moveOut: s.moveOut[k] })),
    deductions: s.deductions.map((d, k) => ({
      id: deductionId(k),
      index: k,
      item: d.item,
      itemName: s.items[d.item].name,
      amountAtto: d.amount,
      reason: d.reason,
      contested: contested.includes(k),
      verdict: outcomes[k],
      to: payeeOf(outcomes[k]),
    })),
    deductedAtto: s.deductions.reduce((a, d) => a + BigInt(d.amount), 0n).toString(),
    contested,
    verdict: vectorOf(contested.map((k) => [deductionId(k), s.deductions[k].expect as Verdict])),
    paidTenantAtto: split.tenant.toString(),
    paidLandlordAtto: split.landlord.toString(),
    settledAt: 0,
    settledBy: "",
    now: 0,
  };
}
