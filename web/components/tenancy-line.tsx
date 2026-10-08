"use client";

// The tenancy line: Offer, Taken, Notice, Move-out report, Answer, Settled. It is the step-by-step
// guide of a lease page and it moves by itself: every step is read off the flat as the contract
// holds it, and a countdown that runs out moves it on (on the browser's clock, with the contract's
// own rule).

import * as React from "react";

import type { Flat } from "@/lib/types";
import { phaseNow } from "@/lib/chain";
import { span, when } from "@/lib/format";
import { cx } from "@/lib/cx";

type StepState = "done" | "current" | "todo" | "skipped";
type Step = { key: string; label: string; state: StepState; note: string };

/** The six steps of a tenancy and where this flat stands on them. */
export function tenancySteps(f: Flat, now: number): Step[] {
  const phase = phaseNow(f, now);
  const left = (end: number) => (now > 0 && end > now ? span(end - now) + " left" : "");
  const closed = ["withdrawn", "reclaimed", "clean", "accepted", "judged", "settled"].includes(f.status);
  const steps: Step[] = [
    { key: "offer", label: "Offer", state: "done", note: when(f.offeredAt) },
    { key: "taken", label: "Taken", state: f.takenAt ? "done" : "todo", note: f.takenAt ? when(f.takenAt) : "" },
    { key: "notice", label: "Notice", state: f.noticeAt ? "done" : "todo", note: f.noticeAt ? when(f.noticeAt) : "" },
    { key: "report", label: "Move-out report", state: f.reportedAt ? "done" : "todo", note: f.reportedAt ? when(f.reportedAt) : "" },
    { key: "answer", label: "Answer", state: f.status === "accepted" || f.status === "judged" ? "done" : "todo", note: "" },
    { key: "settled", label: "Settled", state: closed && f.status !== "withdrawn" ? "done" : "todo", note: closed ? when(f.settledAt) : "" },
  ];
  const at = (k: string) => steps.find((s) => s.key === k)!;
  if (f.status === "withdrawn") {
    at("taken").state = "skipped";
    at("taken").note = "withdrawn";
    for (const k of ["notice", "report", "answer", "settled"]) at(k).state = "skipped";
    return steps;
  }
  if (f.status === "reclaimed") {
    at("report").state = "skipped";
    at("report").note = "none in time";
    at("answer").state = "skipped";
  }
  if (f.status === "clean") {
    at("answer").state = "skipped";
    at("answer").note = "nothing deducted";
  }
  if (f.status === "settled") {
    at("answer").state = "skipped";
    at("answer").note = "none in time";
  }
  if (f.status === "accepted") at("answer").note = "accepted";
  if (f.status === "judged") at("answer").note = "contested";
  if (!closed) {
    const current =
      phase === "take" ? "taken" : phase === "notice" ? "notice" : phase === "report" || phase === "reclaim" ? "report" : "answer";
    at(current).state = "current";
    if (phase === "take") at("taken").note = "waiting for a tenant";
    if (phase === "notice") at("notice").note = "while the tenant lives here";
    if (phase === "report") at("report").note = left(f.moveoutEnd) || "due now";
    if (phase === "reclaim") at("report").note = "window closed: reclaim";
    if (phase === "answer") at("answer").note = left(f.responseEnd) || "due now";
    if (phase === "settle") at("answer").note = "window closed: settle";
  }
  return steps;
}

export function TenancyLine({ flat, now, className }: { flat: Flat; now: number; className?: string }) {
  const steps = tenancySteps(flat, now);
  const doneCount = steps.filter((s) => s.state === "done").length;
  return (
    <div className={cx("relative", className)}>
      <ol aria-label="The tenancy, step by step" className="relative grid grid-cols-6 gap-0">
        {/* the line the steps hang on */}
        <span aria-hidden="true" className="absolute top-[0.9rem] right-[8.33%] left-[8.33%] h-[2px] bg-rule-strong" />
        <span
          aria-hidden="true"
          className="absolute top-[0.9rem] left-[8.33%] h-[2px] bg-ink"
          style={{ width: `${(Math.max(0, doneCount - 1) / 5) * 83.34}%` }}
        />
        {steps.map((s, i) => (
          <li key={s.key} className="relative flex min-w-0 flex-col items-center px-0.5 text-center" aria-current={s.state === "current" ? "step" : undefined}>
            <span
              aria-hidden="true"
              className={cx(
                "relative z-10 flex size-[1.85rem] items-center justify-center rounded-full border-2 text-[0.8rem] font-bold",
                s.state === "done" && "border-ink bg-ink text-paper",
                s.state === "current" && "border-terracotta bg-card text-terracotta-ink ring-4 ring-terracotta/20",
                s.state === "todo" && "border-rule-strong bg-card text-ink-faint",
                s.state === "skipped" && "border-dashed border-rule-strong bg-paper text-ink-faint",
              )}
            >
              {s.state === "done" ? "✓" : s.state === "skipped" ? "–" : i + 1}
            </span>
            <span
              className={cx(
                "mt-1.5 text-[0.72rem] leading-tight font-semibold sm:text-sm",
                s.state === "current" ? "text-terracotta-ink" : s.state === "done" ? "text-ink" : "text-ink-faint",
              )}
            >
              {s.label}
              <span className="sr-only">
                {s.state === "done" ? ", done" : s.state === "current" ? ", now" : s.state === "skipped" ? ", skipped" : ", to come"}
              </span>
            </span>
            {s.note && <span className="mt-0.5 hidden text-xs leading-tight text-ink-faint sm:block">{s.note}</span>}
          </li>
        ))}
      </ol>
      {/* On a phone the notes would crowd the steps: the current one is said once, underneath. */}
      {steps.some((s) => s.state === "current" && s.note) && (
        <p className="mt-2 text-center text-xs text-ink-soft sm:hidden">
          {steps.find((s) => s.state === "current")!.label}: {steps.find((s) => s.state === "current")!.note}
        </p>
      )}
    </div>
  );
}
