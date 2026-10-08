// One builder per write method of the contract: the method's name, its arguments in the contract's
// order, and the value sent. Pure, so tests/unit/interface.test.mjs checks every builder against
// the signatures in contracts/deposit_back.py with no browser and no network.

import type { Call } from "./types.ts";

export type ItemDraft = { name: string; moveIn: string };
export type DeductionDraft = { item: number; amountAtto: bigint; reason: string };

export const calls = {
  /** offer(title, address_line, items_json, deposit_atto, moveout_seconds, response_seconds): anyone; the sender is the landlord. */
  offer: (title: string, addressLine: string, items: ItemDraft[], depositAtto: bigint, moveoutSeconds: number, responseSeconds: number): Call => ({
    fn: "offer",
    args: [
      title,
      addressLine,
      JSON.stringify(items.map((i) => ({ name: i.name, move_in: i.moveIn }))),
      depositAtto.toString(),
      Math.trunc(moveoutSeconds),
      Math.trunc(responseSeconds),
    ],
  }),
  /** withdraw_offer(flat): the landlord, while nobody has taken the flat. */
  withdrawOffer: (flat: string): Call => ({ fn: "withdraw_offer", args: [flat] }),
  /** report(flat, moveout_json, deductions_json): the landlord, after the notice, within the report window, once. */
  report: (flat: string, moveOut: string[], deductions: DeductionDraft[]): Call => ({
    fn: "report",
    args: [
      flat,
      JSON.stringify(moveOut),
      JSON.stringify(deductions.map((d) => ({ item: d.item, amount: d.amountAtto.toString(), reason: d.reason }))),
    ],
  }),
  /** take(flat), payable: exactly the deposit. A refused take returns what was sent in the same transaction. */
  take: (flat: string, depositAtto: bigint): Call => ({ fn: "take", args: [flat], value: depositAtto }),
  /** give_notice(flat): the tenant, once, while the flat is let. */
  giveNotice: (flat: string): Call => ({ fn: "give_notice", args: [flat] }),
  /** accept(flat): the tenant accepts every deduction. */
  accept: (flat: string): Call => ({ fn: "accept", args: [flat] }),
  /** contest(flat, indices_json): the tenant names the deductions the network should read, counted from 0. */
  contest: (flat: string, indices: number[]): Call => ({ fn: "contest", args: [flat, JSON.stringify([...indices].sort((a, b) => a - b))] }),
  /** reclaim(flat): anyone, once the report window closed with no report. */
  reclaim: (flat: string): Call => ({ fn: "reclaim", args: [flat] }),
  /** settle(flat): anyone, once the response window closed with no answer. */
  settle: (flat: string): Call => ({ fn: "settle", args: [flat] }),
};

