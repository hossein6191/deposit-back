// The transactions this browser sent or asked for on each flat, with what each one did. A contract
// does not know the hashes of the transactions that ran it, so the flat on chain cannot list them;
// the browser that sent them can, and the flat page links each one to the explorer.

import { readItem, writeItem } from "./browser-store";
import { contractAddress } from "./config";

export type Remembered = { hash: string; label: string; at: number };

const HASH = /^0x[0-9a-fA-F]{64}$/;
const keyOf = (flat: string) => `deposit-back:tx:${(contractAddress() || "mock").toLowerCase()}:${flat}`;

/** The raw stored list for a flat (a string, so it can be a stable store snapshot). */
export const rememberedRaw = (flat: string): string => readItem(keyOf(flat));

export function parseRemembered(raw: string): Remembered[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as Remembered[];
    return Array.isArray(list) ? list.filter((r) => r && HASH.test(String(r.hash)) && typeof r.label === "string") : [];
  } catch {
    return [];
  }
}

export function rememberTx(flat: string, hash: string, label: string): void {
  if (!flat || !HASH.test(hash)) return;
  const list = parseRemembered(rememberedRaw(flat)).filter((r) => r.hash !== hash);
  list.unshift({ hash, label, at: Math.floor(Date.now() / 1000) });
  writeItem(keyOf(flat), JSON.stringify(list.slice(0, 12)));
}
