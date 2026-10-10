// The demo landlord, server side only (imported by app/api/demo/*). It holds a throwaway Studio test
// key from the DEMO_LANDLORD_KEY environment variable and signs exactly one kind of call with it: the
// scripted move-out report of a copy of a sample flat it offered itself, once its tenant has given
// notice and while the report window is open. The key is never logged, never returned and never
// written anywhere; an answer names the landlord's public address at most.

import { createAccount, createClient } from "genlayer-js";
import type { Address } from "viem";

import { contractAddress, isMock, readFlat, studio } from "./chain";
import { DEMO_LIMITS, createLimiter } from "./demo-limit";
import { demoReportProblem, reportArgs, sampleFor } from "./demo-flats";
import type { DemoStatus } from "./types";

const KEY_RE = /^0x[0-9a-fA-F]{64}$/;

type Account = ReturnType<typeof createAccount>;
let account: { key: string; value: Account } | null = null;

/**
 * The key as it was pasted into the host, made usable when it can be: surrounding quotes and spaces
 * are dropped and a 64-hex key without its 0x is given one. Anything else stays unusable.
 */
function cleanKey(raw: string): string {
  let key = raw.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (/^[0-9a-fA-F]{64}$/.test(key)) key = "0x" + key;
  return key;
}

/** Why the configured key cannot be used, in words that never repeat it; "" when it can. */
function keyProblem(): string {
  const raw = process.env.DEMO_LANDLORD_KEY ?? "";
  if (!raw.trim()) return "the demo landlord is offline: this site has no key for it";
  if (!KEY_RE.test(cleanKey(raw))) return "the demo landlord is offline: the key set on this site is not a 0x private key of 64 hex characters";
  return "";
}

/** The demo landlord's account, or null when no usable key is configured. */
function demoAccount(): Account | null {
  const key = cleanKey(process.env.DEMO_LANDLORD_KEY ?? "");
  if (!KEY_RE.test(key)) return null;
  if (!account || account.key !== key) account = { key, value: createAccount(key as `0x${string}`) };
  return account.value;
}

export function demoStatusNow(): DemoStatus {
  if (isMock) return { online: false, landlord: "", reason: "in the demo build the demo landlord answers in the browser" };
  const a = demoAccount();
  if (!a) return { online: false, landlord: "", reason: keyProblem() };
  if (!contractAddress()) return { online: false, landlord: a.address.toLowerCase(), reason: "the contract is not deployed yet" };
  return { online: true, landlord: a.address.toLowerCase(), reason: "" };
}

const limiter = createLimiter(DEMO_LIMITS);

// One signature at a time: two reports signed at once would ask for the same nonce.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export type DemoAnswer = { status: number; body: { ok: true; hash: string } | { ok: false; reason: string; retryAfter?: number } };

/** Files the scripted report of `flat` as the demo landlord, if it is one of its sample copies waiting for a report. */
export async function fileDemoReport(flat: string): Promise<DemoAnswer> {
  const status = demoStatusNow();
  if (!status.online) return { status: 503, body: { ok: false, reason: status.reason } };
  const a = demoAccount()!;
  const turn = limiter.attempt(flat, Date.now());
  if (!turn.ok) return { status: 429, body: { ok: false, reason: `the demo landlord was asked about ${flat} a moment ago; try again in ${turn.retryAfter} s`, retryAfter: turn.retryAfter } };
  let row;
  try {
    row = (await readFlat(flat, { fresh: true })).data;
  } catch {
    return { status: 502, body: { ok: false, reason: "could not read the flat from Studio; try again in a minute" } };
  }
  if (!row) return { status: 404, body: { ok: false, reason: `there is no flat ${flat}` } };
  const now = row.now > 0 ? row.now : Math.floor(Date.now() / 1000);
  const problem = demoReportProblem(row, a.address, now);
  if (problem) return { status: 409, body: { ok: false, reason: problem } };
  const sample = sampleFor(row.title, row.items)!;
  const args = reportArgs(sample);
  try {
    const hash = await serial(async () => {
      const client = createClient({ chain: studio, account: a });
      return client.writeContract({
        address: contractAddress() as Address,
        functionName: "report",
        args: [flat, args.moveoutJson, args.deductionsJson],
        value: 0n,
      });
    });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("no hash");
    limiter.hold(flat, DEMO_LIMITS.sentHoldMs, Date.now());
    return { status: 200, body: { ok: true, hash } };
  } catch {
    // Nothing of the error goes out: it is the network's, and it is not the visitor's business.
    return { status: 502, body: { ok: false, reason: "Studio did not take the demo landlord's report; try again in a minute" } };
  }
}
