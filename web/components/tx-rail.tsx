"use client";

// The receipt of one transaction while it goes through: the explorer link from the first second,
// the stages (pending, proposing, committing, revealing, accepted, finalized) and, for a contest, the
// validators' votes. FINALIZED does not mean the state changed: a round whose validators split
// finalizes too, with nothing stored. The rail reads the tally, not only the status, and says so.

import * as React from "react";

import { useWallet } from "@/components/wallet";
import { failureOf, invalidateReads, isMock, movesMoney, txStatus, txUrl } from "@/lib/chain";
import { STAGES } from "@/lib/rpc";
import type { TxStatus } from "@/lib/types";
import { cx } from "@/lib/cx";

/** The in-memory contract of mock mode answers at once, so its rail moves faster. */
const POLL_MS = isMock ? 700 : 3000;

const isFinal = (s: TxStatus) => s.undetermined || s.status === "FINALIZED" || s.status === "CANCELED" || s.status === "UNDETERMINED";

/** Polls txStatus(hash) until it is final. The status is kept with its hash, so a new hash never shows an old result. */
export function useTxStatus(hash: string | null): TxStatus | null {
  const [latest, setLatest] = React.useState<{ hash: string; status: TxStatus } | null>(null);
  React.useEffect(() => {
    if (!hash) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const s = await txStatus(hash);
        if (stopped) return;
        setLatest({ hash, status: s });
        if (isFinal(s)) return;
      } catch {
        /* a dropped poll is not a failed transaction; the next one may answer */
      }
      if (!stopped) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [hash]);
  return latest && latest.hash === hash ? latest.status : null;
}

const STAGE_WORD: Record<string, string> = {
  PENDING: "Sent",
  PROPOSING: "Proposing",
  COMMITTING: "Committing",
  REVEALING: "Revealing",
  ACCEPTED: "Accepted",
  FINALIZED: "Final",
};

export function TxRail({
  hash,
  label,
  judged,
  onDone,
  className,
}: {
  hash: string;
  /** what the tx does, e.g. "Taking F3" */
  label: string;
  /** true for a contest: the validators read with their models and their votes are shown */
  judged?: boolean;
  /** called once when the tx is final, with its final status */
  onDone?: (status: TxStatus) => void;
  className?: string;
}) {
  const status = useTxStatus(hash);
  const wallet = useWallet();
  const doneFor = React.useRef<string | null>(null);
  const onDoneRef = React.useRef(onDone);
  const refreshRef = React.useRef(wallet.refreshBalance);
  const watchRef = React.useRef(wallet.watchBalance);
  React.useEffect(() => {
    onDoneRef.current = onDone;
    refreshRef.current = wallet.refreshBalance;
    watchRef.current = wallet.watchBalance;
  }, [onDone, wallet.refreshBalance, wallet.watchBalance]);

  React.useEffect(() => {
    if (!status || !isFinal(status) || doneFor.current === hash) return;
    doneFor.current = hash;
    // The cached views are stale the moment the chain moved: drop them before the page re-reads.
    invalidateReads();
    // A transfer lands a few seconds after FINALIZED: when this call moves GEN, the balance is
    // re-read until it changes.
    if (movesMoney(status)) watchRef.current();
    else void refreshRef.current();
    onDoneRef.current?.(status);
  }, [status, hash]);

  const stageIndex = status ? STAGES.indexOf(status.status) : -1;
  const final = status ? isFinal(status) : false;
  const canceled = status?.status === "CANCELED";
  const split = !!status?.undetermined;
  const failure = status && final ? failureOf(status) : "";
  const ok = final && !failure;
  const votes = status?.votes ?? { agree: 0, disagree: 0, idle: 0 };
  const total = votes.agree + votes.disagree + votes.idle;

  return (
    <div className={cx("rounded-md border border-dashed border-ink/50 bg-card px-4 py-3 text-sm", className)} data-tx={hash}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-semibold">{label}</p>
        <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="link mono text-xs break-all">
          {isMock ? "demo transaction " : "explorer: "}
          {hash.slice(0, 10)}…{hash.slice(-6)} ↗
        </a>
      </div>

      <ol className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label="Consensus stages">
        {STAGES.map((stage, i) => {
          const reached = split ? i < 4 : final && !canceled ? true : i <= stageIndex;
          const current = !final && i === stageIndex;
          return (
            <li key={stage} className="inline-flex items-center gap-1.5" aria-current={current ? "step" : undefined}>
              <span
                aria-hidden="true"
                className={cx(
                  "size-2.5 rounded-full border-[1.5px]",
                  reached ? "border-ink bg-ink" : current ? "border-terracotta bg-terracotta/30" : "border-rule-strong bg-card",
                )}
              />
              <span className={cx("text-xs", reached ? "text-ink" : current ? "font-semibold text-terracotta-ink" : "text-ink-faint")}>
                {STAGE_WORD[stage]}
              </span>
              {i < STAGES.length - 1 && <span aria-hidden="true" className="h-px w-3 bg-rule-strong" />}
            </li>
          );
        })}
      </ol>

      {judged && (
        <div className="mt-3">
          <div className="flex gap-1" aria-label="Validator votes">
            {Array.from({ length: Math.max(5, total) }, (_, i) => {
              const kind = i < votes.agree ? "agree" : i < votes.agree + votes.disagree ? "disagree" : total ? "idle" : "waiting";
              return (
                <span
                  key={i}
                  title={kind}
                  className={cx(
                    "h-6 flex-1 rounded-[3px] border text-center text-[0.68rem] leading-6 font-semibold uppercase",
                    kind === "agree" && "border-sage-ink bg-sage/20 text-sage-ink",
                    kind === "disagree" && "border-brick bg-brick/15 text-brick",
                    kind === "idle" && "border-rule-strong bg-paper-deep text-ink-faint",
                    kind === "waiting" && "border-dashed border-rule-strong bg-paper text-ink-faint",
                  )}
                >
                  {kind === "waiting" ? "" : kind}
                </span>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            {total === 0 ? "Waiting for the validators' votes…" : `${votes.agree} agree · ${votes.disagree} disagree · ${votes.idle} idle (did not vote this round)`}
          </p>
        </div>
      )}

      <div className="mt-2.5" role="status" aria-live="polite">
        {!status && <p className="text-ink-soft">Sent. Waiting for the network to list it…</p>}
        {status && !final && (
          <p className="text-ink-soft">
            {status.status === "UNKNOWN"
              ? "The network has not listed this transaction yet. It usually appears within a few seconds."
              : judged
                ? "Each validator asks its own model about every contested deduction twice, in two framings and two orders, and the contract writes damage, wear or unclear for each. This usually takes one to three minutes; the page moves on by itself."
                : "The validators are checking the call. This usually takes under a minute; the page moves on by itself."}
          </p>
        )}
        {split && !canceled && (
          <p className="text-ochre-ink">
            <strong>The validators did not reach a majority, so nothing was stored.</strong> Nothing moved; sending the same call again is safe.
          </p>
        )}
        {canceled && <p className="text-brick">The network cancelled this transaction. Nothing was stored.</p>}
        {final && !split && !canceled && failure && (
          <p className="text-brick">
            <strong>Final, and refused:</strong> {failure}
            {status?.result && "returned" in status.result ? " What was sent came back in the same transaction." : ""}
          </p>
        )}
        {ok && !split && (
          <p className="text-sage-ink">
            <strong>Final.</strong> The validators agreed and the result is stored.
            {status && movesMoney(status) ? " Money moved by this call lands a few seconds after it is final." : ""}
          </p>
        )}
      </div>
    </div>
  );
}
