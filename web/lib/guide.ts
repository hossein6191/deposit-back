// What a visitor is told whenever a flat makes them wait, in five plain lines: what is happening now
// and who it waits for (you, the other side, the validators, the demo landlord or the clock), how long
// that takes or the exact time, what is needed from them, whether they can close the page, and where
// the deposit is right now. The same words for every in-between state of the site: a wallet prompt, a
// transaction on its way, a tenancy with nothing to do, a window running, the other side's move, the
// validators reading a contest, and the end of a tenancy with where every part of the deposit went.
//
// Pure, with no React: the flat, the viewer's role and the clock in, the words out. The lease page
// renders a guide as the notice slip at the top of its next step (components/flat/guide-slip.tsx);
// /mine and the landlord's list print the one-line form. tests/unit/guide.test.mjs runs every state
// for every role. Nothing here may promise what contracts/deposit_back.py does not do.

import { clockTime, gen, span, windowLabel } from "./format.ts";
import type { FlatStatus } from "./rules.ts";
import type { WriteFn } from "./types.ts";

/** Who is looking: the tenant, the landlord, or anyone else. */
export type Role = "tenant" | "landlord" | "other";

/** Whose move it is now. "done" is a closed flat: nobody's. */
export type Waiter = "you" | "tenant" | "landlord" | "validators" | "demo" | "clock" | "anyone" | "nobody" | "done";

export type GuideTone = "busy" | "clock" | "late" | "ready" | "done";

export type Guide = {
  /** a stable name for the state, written on the slip for tests and tools */
  id: string;
  tone: GuideTone;
  waitsFor: Waiter;
  /** the small capitals above the line: who it waits for */
  kicker: string;
  /** 1. what is happening now */
  now: string;
  /** 2. how long it usually takes, or the exact time */
  time: string;
  /** 3. what is needed from the viewer right now */
  need: string;
  /** 4. whether the viewer can close the page, and where the flat stays */
  leave: string;
  canLeave: boolean;
  /** 5. where the deposit is right now, with the amount */
  money: string;
  /** one more sentence when the state needs it, e.g. why the demo landlord did not file */
  note?: string;
  /** seconds left on the contract's clock, for a countdown */
  left?: number;
  leftLabel?: string;
};

export const KICKERS: Record<Waiter, string> = {
  you: "Waiting for you",
  tenant: "Waiting for the tenant",
  landlord: "Waiting for the landlord",
  validators: "Waiting for the validators",
  demo: "Waiting for the demo landlord",
  clock: "Waiting for the clock",
  anyone: "Open to anyone",
  nobody: "Nothing is waiting on you",
  done: "Settled · nothing left to do",
};

export const NOTHING_NEEDED = "Nothing is needed from you.";
export const NOTHING_LEFT = "Nothing is left to do here.";

type Lines = Omit<Guide, "kicker"> & { kicker?: string };
const make = (g: Lines): Guide => ({ ...g, kicker: g.kicker ?? KICKERS[g.waitsFor] });

/** "You can close this page; F12 stays under Mine" (no full stop). */
function keep(id: string, role: Role): string {
  if (role === "other") return "You can close this page and come back to this address later";
  return `You can close this page; ${id} stays under Mine`;
}

const ABOUT_30 = (mock?: boolean) => (mock ? "A few seconds in this demo build; about 30 seconds on Studio." : "About 30 seconds.");

/** a - b in atto; 0 for anything that is not a whole number. */
const minus = (a: string, b: string): bigint => {
  try {
    return BigInt(a) - BigInt(b);
  } catch {
    return 0n;
  }
};

// ---- the wallet prompt --------------------------------------------------------------------------------

export type SignInput = {
  fn: WriteFn;
  /** what the call does, e.g. "Taking F12 with a 1 GEN deposit" */
  label: string;
  depositAtto: string;
  deductedAtto?: string;
  mock?: boolean;
};

function moneyBeforeSigning(fn: WriteFn, dep: string, ded: string, rest: string): string {
  switch (fn) {
    case "take":
      return `${dep} is still in your wallet; it leaves only when you confirm.`;
    case "give_notice":
      return `Your ${dep} stays held by the contract; notice sends no GEN.`;
    case "report":
      return `The tenant's ${dep} stays held by the contract while you sign.`;
    case "accept":
      return `Your ${dep} stays held by the contract until the acceptance lands; then ${ded} goes to the landlord and ${rest} back to you.`;
    case "contest":
      return `Your ${dep} stays held by the contract until the verdict.`;
    case "reclaim":
      return `${dep} is held by the contract; the reclaim sends all of it to the tenant.`;
    case "settle":
      return `${dep} is held by the contract; settling sends ${ded} to the landlord and ${rest} to the tenant.`;
    case "withdraw_offer":
      return "Nothing is held, so no GEN moves.";
    case "offer":
      return "Offering a flat sends no GEN; the tenant pays the deposit in when they take it.";
  }
}

/** A transaction is waiting for the visitor's signature (in mock mode: being sent, a moment). */
export function signGuide(s: SignInput): Guide {
  const ded = s.deductedAtto ?? "0";
  const money = moneyBeforeSigning(s.fn, gen(s.depositAtto), gen(ded), gen(minus(s.depositAtto, ded)));
  if (s.mock)
    return make({
      id: "sign",
      tone: "busy",
      waitsFor: "validators",
      kicker: "Sending",
      now: `${s.label}…`,
      time: "A moment in this demo build.",
      need: NOTHING_NEEDED,
      leave: "Stay on this page for a moment.",
      canLeave: false,
      money,
    });
  return make({
    id: "sign",
    tone: "busy",
    waitsFor: "you",
    kicker: "Your wallet",
    now: `Your wallet is asking you to confirm: ${s.label}`,
    time: "Until you confirm or reject it in the wallet.",
    need: "Confirm it in your wallet, or reject it and nothing is sent.",
    leave: "Stay on this page until you have answered the wallet; this page then follows the transaction for you.",
    canLeave: false,
    money,
  });
}

// ---- one flat ------------------------------------------------------------------------------------------

export type DemoState = "asking" | "filing" | "failed" | "offline" | "idle";

export type FlatInput = {
  role: Role;
  /** the contract's clock, seconds; 0 when there is none */
  now: number;
  /** "F12" */
  id: string;
  status: FlatStatus;
  depositAtto: string;
  /** the deductions together; "0" before the report */
  deductedAtto: string;
  moveoutSeconds: number;
  responseSeconds: number;
  moveoutEnd: number;
  responseEnd: number;
  paidTenantAtto: string;
  paidLandlordAtto: string;
  settledAt?: number;
  /** a sample flat whose landlord is the demo landlord: it files the report when the tenant's page asks */
  demo?: boolean;
  /** the demo landlord's side of the report window, as this browser knows it */
  demoState?: DemoState;
  demoReason?: string;
  /** a transaction on this flat, sent from this browser, is on its way */
  sending?: WriteFn;
  mock?: boolean;
};

/** The contract's _phase on the given clock. */
function phaseOf(f: FlatInput): "take" | "notice" | "report" | "reclaim" | "answer" | "settle" | "closed" | "unknown" {
  if (f.status === "open") return "take";
  if (f.status === "let") return "notice";
  if (f.status !== "notice" && f.status !== "reported") return "closed";
  if (!(f.now > 0)) return "unknown";
  if (f.status === "notice") return f.now < f.moveoutEnd ? "report" : "reclaim";
  return f.now < f.responseEnd ? "answer" : "settle";
}

/** A transaction of this flat on its way: what it does and where the money goes. */
function sendingGuide(f: FlatInput, fn: WriteFn): Guide {
  const dep = gen(f.depositAtto);
  const ded = gen(f.deductedAtto);
  const rest = gen(minus(f.depositAtto, f.deductedAtto));
  const tenant = f.role === "tenant" ? "you" : "the tenant";
  const landlord = f.role === "landlord" ? "you" : "the landlord";
  const stays = keep(f.id, f.role);
  const base = { tone: "busy" as const, waitsFor: "validators" as const, time: ABOUT_30(f.mock), need: NOTHING_NEEDED, canLeave: true };
  switch (fn) {
    case "take":
      return make({
        ...base,
        id: "taking",
        now: `Taking ${f.id}: the validators are checking the transaction`,
        leave: "You can close this page; once it lands, the tenancy stays under Mine. Stay here and it appears by itself.",
        money: `${dep} goes with this transaction. Once it lands the contract holds it for the whole tenancy; a refused take sends all of it back in the same transaction.`,
      });
    case "give_notice":
      return make({
        ...base,
        id: "giving-notice",
        now: "Your notice is being sent",
        leave: f.demo
          ? `Stay on this page: once it lands, this page asks the demo landlord to file its report, within a minute. If you close it, the report is asked for when you next open ${f.id} from Mine.`
          : `${stays}; the notice still lands. The landlord then has ${windowLabel(f.moveoutSeconds)} to file the move-out report.`,
        canLeave: !f.demo,
        money: `Your ${dep} stays held by the contract; notice moves no GEN.`,
      });
    case "report":
      return make({
        ...base,
        id: "reporting",
        now: "Your move-out report is being filed",
        leave: `${stays}; the report lands whether or not this page is open. The tenant then has ${windowLabel(f.responseSeconds)} to answer.`,
        money: `The tenant's ${dep} stays held by the contract; a report with no deduction sends all of it back to the tenant in this same transaction.`,
      });
    case "accept":
      return make({
        ...base,
        id: "accepting",
        now: "Your acceptance is being sent",
        leave: `${stays}; the acceptance lands whether or not this page is open.`,
        money: `${ded} is on its way to the landlord and ${rest} back to ${tenant}, in this transaction.`,
      });
    case "contest":
      return make({
        ...base,
        id: "judging",
        now: "The validators are reading each contested deduction",
        time: f.mock ? "A few seconds in this demo build; 1 to 2 minutes on Studio." : "Usually 1 to 2 minutes.",
        leave: `${stays}; the verdict and the money land whether or not this page is open.`,
        money: `${dep} is held by the contract until the verdict, in this same transaction: damage goes to the landlord, wear and unclear come back to ${tenant}, and every deduction not contested goes to the landlord. ${rest} comes back to ${tenant} whatever happens.`,
      });
    case "reclaim":
      return make({
        ...base,
        id: "reclaiming",
        now: "Sending the whole deposit back to the tenant",
        leave: `${stays}; the reclaim lands whether or not this page is open.`,
        money: `${dep} is on its way from the contract to ${tenant}.`,
      });
    case "settle":
      return make({
        ...base,
        id: "settling",
        now: "Settling the report as filed",
        leave: `${stays}; the settlement lands whether or not this page is open.`,
        money: `${ded} is on its way to ${landlord} and ${rest} to ${tenant}.`,
      });
    case "withdraw_offer":
      return make({
        ...base,
        id: "withdrawing",
        now: `Withdrawing the offer of ${f.id}`,
        leave: `${stays}; the withdrawal lands whether or not this page is open.`,
        money: "Nothing is held, so no GEN moves.",
      });
    case "offer":
      return make({
        ...base,
        id: "offering",
        now: "Offering your flat",
        leave: "You can close this page; once it lands, the flat stays under Mine and on the Landlords page.",
        money: "Offering a flat sends no GEN; the tenant pays the deposit in when they take it.",
      });
  }
}

/** Offering a new flat: no flat id yet. */
export function offerGuide(mock?: boolean): Guide {
  return sendingGuide(
    { role: "landlord", now: 0, id: "", status: "open", depositAtto: "0", deductedAtto: "0", moveoutSeconds: 0, responseSeconds: 0, moveoutEnd: 0, responseEnd: 0, paidTenantAtto: "0", paidLandlordAtto: "0", mock },
    "offer",
  );
}

const ENDING: Record<string, string> = {
  withdrawn: "The offer was withdrawn before anybody took it",
  reclaimed: "Settled: no report came in time, so the whole deposit went back to the tenant",
  clean: "Settled: the report had no deduction, so the whole deposit went back to the tenant",
  accepted: "Settled: the tenant accepted the report",
  judged: "Settled: the network read each contested deduction, and the money moved in the same transaction",
  settled: "Settled: the tenant did not answer in time, so the report stood as filed",
};

/**
 * Every state of a flat, for the tenant, the landlord or anyone else; null when nothing waits (a
 * flat to let, seen by anyone but its landlord, or a flat read with no clock).
 */
export function flatGuide(f: FlatInput): Guide | null {
  if (f.sending) return sendingGuide(f, f.sending);
  const dep = gen(f.depositAtto);
  const ded = gen(f.deductedAtto);
  const rest = gen(minus(f.depositAtto, f.deductedAtto));
  const at = (x: number) => clockTime(x, f.now);
  const left = (x: number) => span(x - f.now);
  const stays = keep(f.id, f.role);
  const tenant = f.role === "tenant" ? "you" : "the tenant";
  const landlord = f.role === "landlord" ? "you" : "the landlord";
  const phase = phaseOf(f);

  switch (phase) {
    case "take":
      if (f.role !== "landlord") return null;
      return make({
        id: "to-let",
        tone: "clock",
        waitsFor: "tenant",
        kicker: "Waiting for a tenant",
        now: `${f.id} is listed: waiting for a tenant`,
        time: "Until somebody takes it; there is no deadline.",
        need: `${NOTHING_NEEDED} You may withdraw the offer below while nobody has taken it.`,
        leave: `${stays}, and it shows there once a tenant has taken it.`,
        canLeave: true,
        money: "Nothing is held yet: the tenant pays the deposit in when they take the flat.",
      });
    case "notice":
      if (f.role === "tenant")
        return make({
          id: "living",
          tone: "clock",
          waitsFor: "nobody",
          now: "You live here: nothing is needed until you move out",
          time: `No clock runs until you give notice. Then the landlord has ${windowLabel(f.moveoutSeconds)} to file the move-out report.`,
          need: `${NOTHING_NEEDED} When you have moved out, press "I have moved out: give notice" below.`,
          leave: `${stays}.`,
          canLeave: true,
          money: `Your ${dep} deposit is held by the contract; the landlord cannot touch it.`,
        });
      return make({
        id: "let",
        tone: "clock",
        waitsFor: "tenant",
        kicker: "Waiting for the tenant's notice",
        now: f.role === "landlord" ? "Let: waiting for your tenant's notice" : "Let: a tenant lives here",
        time:
          f.role === "landlord"
            ? `No clock runs until the tenant gives notice; then you have ${windowLabel(f.moveoutSeconds)} to file the move-out report.`
            : "No clock runs until the tenant gives notice.",
        need: f.role === "landlord" ? NOTHING_NEEDED : "Nothing; only the tenant can give notice.",
        leave: f.role === "landlord" ? `${stays}; when the tenant gives notice, it waits for your report there and on the Landlords page.` : `${stays}.`,
        canLeave: true,
        money: `The tenant's ${dep} is held by the contract until the tenancy ends; the landlord cannot touch it.`,
      });
    case "report": {
      const reclaimLater = `If no report is filed by ${at(f.moveoutEnd)} (in ${left(f.moveoutEnd)}), the whole deposit can be sent back to ${tenant}.`;
      const heldForTenant = `${f.role === "tenant" ? "Your" : "The tenant's"} ${dep} is held by the contract. If no report comes by ${at(f.moveoutEnd)}, all of it goes back to ${tenant}.`;
      if (f.role === "tenant" && f.demo && f.demoState) {
        switch (f.demoState) {
          case "asking":
            return make({
              id: "demo-asking",
              tone: "busy",
              waitsFor: "demo",
              now: "Asking the demo landlord to file its move-out report",
              time: "A few seconds to ask; the report itself lands within about a minute.",
              need: NOTHING_NEEDED,
              leave: "Stay a few seconds while the demo landlord sends it; after that you can close this page.",
              canLeave: false,
              money: heldForTenant,
            });
          case "filing":
            return make({
              id: "demo-filing",
              tone: "busy",
              waitsFor: "demo",
              now: "The demo landlord is filing its move-out report",
              time: f.mock ? "A few seconds in this demo build; within about a minute on Studio." : "Usually within a minute.",
              need: NOTHING_NEEDED,
              leave: `${stays}; the report lands whether or not this page is open. You then have ${windowLabel(f.responseSeconds)} to answer it.`,
              canLeave: true,
              money: `Your ${dep} is held by the contract. Nothing moves when the report lands: you then accept it or contest it.`,
            });
          case "failed":
          case "offline":
            return make({
              id: f.demoState === "failed" ? "demo-failed" : "demo-offline",
              tone: "late",
              waitsFor: f.demoState === "failed" ? "you" : "clock",
              kicker: f.demoState === "failed" ? "No report yet" : "The demo landlord is offline",
              now: f.demoState === "failed" ? "The demo landlord did not file its report" : "The demo landlord cannot file its report right now",
              note: f.demoReason,
              time: reclaimLater,
              need:
                f.demoState === "failed"
                  ? "Press Ask the demo landlord again."
                  : `Nothing until ${at(f.moveoutEnd)}. If no report has come by then, press the reclaim button and the whole ${dep} comes back to you.`,
              leave: `${stays}; if no report comes by ${at(f.moveoutEnd)}, the reclaim button waits for you there.`,
              canLeave: true,
              money: heldForTenant,
              left: f.moveoutEnd - f.now,
              leftLabel: "until reclaim opens",
            });
          case "idle":
            return make({
              id: "demo-idle",
              tone: "clock",
              waitsFor: "you",
              now: "The demo landlord has not been asked to file yet",
              time: `It files within about a minute once asked. ${reclaimLater}`,
              need: "Press Ask the demo landlord now.",
              leave: `${stays}; if no report comes by ${at(f.moveoutEnd)}, the reclaim button waits for you there.`,
              canLeave: true,
              money: heldForTenant,
              left: f.moveoutEnd - f.now,
              leftLabel: "until reclaim opens",
            });
        }
      }
      if (f.role === "landlord")
        return make({
          id: "report-due",
          tone: "clock",
          waitsFor: "you",
          now: "Your tenant has moved out: your move-out report is due",
          time: `You have until ${at(f.moveoutEnd)} (${left(f.moveoutEnd)} left).`,
          need: "Write one note per item, add any deductions, and press File the move-out report.",
          leave: `You can close this page; ${f.id} waits for your report under Mine and on the Landlords page until ${at(f.moveoutEnd)}. After that anyone may send the whole deposit back to the tenant.`,
          canLeave: true,
          money: `The tenant's ${dep} is held by the contract. A report with no deduction sends all of it back to the tenant at once.`,
          left: f.moveoutEnd - f.now,
          leftLabel: "to file",
        });
      return make({
        id: "report-wait",
        tone: "clock",
        waitsFor: "landlord",
        now: f.role === "tenant" ? "Waiting for the landlord's move-out report" : "The tenant moved out: waiting for the landlord's move-out report",
        time: `The landlord has until ${at(f.moveoutEnd)} (${left(f.moveoutEnd)} left).`,
        need: f.role === "tenant" ? NOTHING_NEEDED : `Nothing; only the landlord can report. If no report comes by ${at(f.moveoutEnd)}, anyone may send the whole deposit back to the tenant.`,
        leave:
          f.role === "tenant"
            ? `${stays}. If no report has come by ${at(f.moveoutEnd)}, you can reclaim the whole deposit there: come back then.`
            : `${stays}.`,
        canLeave: true,
        money: heldForTenant,
        left: f.moveoutEnd - f.now,
        leftLabel: "until reclaim opens",
      });
    }
    case "reclaim":
      return make({
        id: "reclaim-ready",
        tone: "ready",
        waitsFor: f.role === "tenant" ? "you" : "anyone",
        now: f.role === "landlord" ? "Your report window closed with no report" : "No report came in time: the whole deposit goes back to the tenant",
        time: "Reclaim is open now, with no deadline; about 30 seconds once sent.",
        need:
          f.role === "tenant"
            ? `Press "Send ${dep} back to the tenant" below and all of it comes back to you.`
            : f.role === "landlord"
              ? `Nothing you can file now. Anyone may send the whole ${dep} back to the tenant, you included.`
              : "Anyone may press it, you included; the money goes to the tenant whoever sends it.",
        leave: f.role === "tenant" ? `You can close this page; nothing happens until someone presses it, and the button waits for you on ${f.id} under Mine.` : `${stays}.`,
        canLeave: true,
        money: f.role === "tenant" ? `${dep} is still held by the contract; the reclaim sends all of it to you.` : `${dep} is still held by the contract; it goes to the tenant whoever presses.`,
      });
    case "answer":
      if (f.role === "tenant")
        return make({
          id: "answer-due",
          tone: "clock",
          waitsFor: "you",
          now: "The move-out report is filed: your answer is due",
          time: `You have until ${at(f.responseEnd)} (${left(f.responseEnd)} left).`,
          need: "Tick the deductions you contest and press Contest, or accept every deduction.",
          leave: `You can close this page; ${f.id} waits for your answer under Mine until ${at(f.responseEnd)}. If you have not answered by then, the report stands as filed and anyone may settle it.`,
          canLeave: true,
          money: `Your ${dep} is held by the contract: ${ded} is deducted until you answer, and ${rest} comes back to you whatever happens.`,
          left: f.responseEnd - f.now,
          leftLabel: "to answer",
        });
      return make({
        id: "answer-wait",
        tone: "clock",
        waitsFor: "tenant",
        now: f.role === "landlord" ? "Waiting for the tenant's answer to your report" : "Waiting for the tenant's answer to the report",
        time: `The tenant has until ${at(f.responseEnd)} (${left(f.responseEnd)} left).`,
        need: f.role === "landlord" ? NOTHING_NEEDED : "Nothing; only the tenant can answer.",
        leave: f.role === "landlord" ? `${stays}. If the tenant has not answered by ${at(f.responseEnd)}, anyone may settle it as filed there.` : `${stays}.`,
        canLeave: true,
        money:
          f.role === "landlord"
            ? `The tenant's ${dep} is held by the contract: your deductions, ${ded}, stand unless the tenant contests them, and ${rest} goes back to the tenant whatever happens.`
            : `${dep} is held by the contract: ${ded} is deducted until the tenant answers, and ${rest} goes back to the tenant whatever happens.`,
        left: f.responseEnd - f.now,
        leftLabel: "until settle opens",
      });
    case "settle":
      return make({
        id: "settle-ready",
        tone: "ready",
        waitsFor: f.role === "landlord" ? "you" : "anyone",
        now: "The tenant did not answer in time: the report stands as filed",
        time: "Settle is open now, with no deadline; about 30 seconds once sent.",
        need:
          f.role === "landlord"
            ? `Press "Settle as filed" and ${ded} reaches you; ${rest} goes back to the tenant.`
            : f.role === "tenant"
              ? `Nothing you can answer now. Anyone may press "Settle as filed", you included; it sends ${rest} back to you.`
              : `Anyone may press "Settle as filed", you included; it pays both sides as filed.`,
        leave: f.role === "other" ? `${stays}.` : `You can close this page; nothing happens until someone presses it, and the button waits for you on ${f.id} under Mine.`,
        canLeave: true,
        money: `${dep} is still held by the contract: settling sends ${ded} to ${landlord} and ${rest} to ${tenant}.`,
      });
    case "closed": {
      const toTenant = gen(f.paidTenantAtto);
      const toLandlord = gen(f.paidLandlordAtto);
      const whole = f.status === "reclaimed" || f.status === "clean";
      const money =
        f.status === "withdrawn"
          ? "Nothing was ever held, so no GEN moved."
          : whole
            ? f.role === "tenant"
              ? `${toTenant}, the whole deposit, came back to your wallet.`
              : f.role === "landlord"
                ? `The whole deposit, ${toTenant}, went back to the tenant; nothing came to you.`
                : `${toTenant}, the whole deposit, went back to the tenant.`
            : f.role === "tenant"
              ? `${toTenant} came back to your wallet and ${toLandlord} went to the landlord.`
              : f.role === "landlord"
                ? `${toLandlord} came to your wallet and ${toTenant} went back to the tenant.`
                : `${toTenant} went back to the tenant and ${toLandlord} to the landlord.`;
      return make({
        id: "closed-" + f.status,
        tone: "done",
        waitsFor: "done",
        kicker: f.status === "withdrawn" ? "Withdrawn · nothing left to do" : undefined,
        now: ENDING[f.status] ?? "Settled",
        time: `${f.status === "withdrawn" ? "Withdrawn" : "Settled"}${f.settledAt ? " at " + at(f.settledAt) : ""}; nothing more will happen to this flat.`,
        need: NOTHING_LEFT,
        leave: f.role === "other" ? "You can close this page." : `${stays} as a record.`,
        canLeave: true,
        money,
      });
    }
    default:
      return null;
  }
}

/** One line for a flat on /mine and the landlord's list, from one side, and whether it waits for that side. */
export function flatLine(f: FlatInput): { text: string; yours: boolean } {
  const dep = gen(f.depositAtto);
  const rest = gen(minus(f.depositAtto, f.deductedAtto));
  const at = (x: number) => clockTime(x, f.now);
  const t = f.role === "tenant";
  const l = f.role === "landlord";
  switch (phaseOf(f)) {
    case "take":
      return { text: l ? "To let · waiting for a tenant; nothing to do" : "To let; nobody has taken it yet", yours: false };
    case "notice":
      return t
        ? { text: "You live here · nothing to do until you give notice", yours: false }
        : { text: l ? "Let · waits for the tenant's notice; nothing to do" : "Let · waits for the tenant's notice", yours: false };
    case "report":
      return l
        ? { text: `Your move-out report is due by ${at(f.moveoutEnd)}`, yours: true }
        : { text: `Waits for the landlord's report until ${at(f.moveoutEnd)}${t ? " · nothing to do, you can leave" : ""}`, yours: false };
    case "reclaim":
      return t
        ? { text: `No report in time · press reclaim to get ${dep} back`, yours: true }
        : { text: `No report in time · the whole ${dep} goes back to the tenant`, yours: false };
    case "answer":
      return t
        ? { text: `Report filed · accept or contest it by ${at(f.responseEnd)}`, yours: true }
        : { text: `Waits for the tenant's answer until ${at(f.responseEnd)}${l ? " · nothing to do, you can leave" : ""}`, yours: false };
    case "settle":
      return t
        ? { text: `No answer in time · anyone may settle it; ${rest} comes back to you`, yours: true }
        : l
          ? { text: `No answer in time · press settle and ${gen(f.deductedAtto)} reaches you`, yours: true }
          : { text: "No answer in time · anyone may settle it as filed", yours: false };
    case "closed":
      if (f.status === "withdrawn") return { text: "Withdrawn · nothing was ever held", yours: false };
      return {
        text: t
          ? `Settled · ${gen(f.paidTenantAtto)} came back to you · nothing left to do`
          : l
            ? `Settled · ${gen(f.paidLandlordAtto)} came to you, ${gen(f.paidTenantAtto)} back to the tenant`
            : `Settled · ${gen(f.paidTenantAtto)} to the tenant, ${gen(f.paidLandlordAtto)} to the landlord`,
        yours: false,
      };
    default:
      return { text: "", yours: false };
  }
}
