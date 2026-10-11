"use client";

// The notice slip at the top of a flat's next step: what is happening now and who it waits for, then
// four ruled lines (how long, what is needed from you, whether you can leave, where the deposit is),
// a countdown when a window runs, and the key tag to press when there is one. The words come from
// lib/guide.ts. Paper and ink like the rest of the site: a coloured left edge says the kind of wait
// (ochre at work, plain for the clock, brick when it is late, sage when it is your move to collect,
// faint when it is over), and nothing moves.

import * as React from "react";

import { span } from "@/lib/format";
import type { Guide, GuideTone } from "@/lib/guide";
import { cx } from "@/lib/cx";

const EDGE: Record<GuideTone, string> = {
  busy: "border-l-ochre",
  clock: "border-l-rule-strong",
  late: "border-l-brick",
  ready: "border-l-sage",
  done: "border-l-ink-faint",
};

const KICK: Record<GuideTone, string> = {
  busy: "text-ochre-ink",
  clock: "text-ink-faint",
  late: "text-brick",
  ready: "text-sage-ink",
  done: "text-ink-faint",
};

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="grid gap-x-3 py-1.5 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <dt className="text-[0.7rem] font-bold tracking-[0.12em] text-ink-faint uppercase sm:pt-[0.2rem]">{label}</dt>
      <dd className={cx("min-w-0", className)}>{children}</dd>
    </div>
  );
}

export function GuideSlip({ guide, action, className }: { guide: Guide; action?: React.ReactNode; className?: string }) {
  const tone = guide.tone;
  return (
    <div data-guide={guide.id} className={cx("rounded-sm border border-l-4 border-rule bg-paper/70 px-3.5 py-3 sm:px-4", EDGE[tone], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
          <p className={cx("text-xs font-bold tracking-[0.14em] uppercase", KICK[tone])}>{guide.kicker}</p>
          <p className="mt-1 font-display text-lg leading-snug font-semibold text-ink sm:text-xl">{guide.now}</p>
        </div>
        {guide.left !== undefined && guide.left > 0 && (
          <div className="shrink-0 text-right">
            <p className="font-display text-xl leading-none font-semibold tabular-nums">{span(guide.left)}</p>
            {guide.leftLabel && <p className="mt-1 text-xs text-ink-faint">{guide.leftLabel}</p>}
          </div>
        )}
      </div>
      {guide.note && <p className="mt-1.5 text-sm text-ink-soft">{guide.note}</p>}
      <dl className="mt-2.5 divide-y divide-dashed divide-rule-strong border-t border-dashed border-rule-strong text-[0.95rem] leading-snug">
        <Row label="How long" className="text-ink-soft">
          {guide.time}
        </Row>
        <Row label="From you" className="font-semibold text-ink">
          {guide.need}
        </Row>
        <Row label="Leave?" className={guide.canLeave ? "text-ink-soft" : "font-semibold text-terracotta-ink"}>
          {guide.leave}
        </Row>
        <Row label="The deposit" className="text-ink-soft">
          {guide.money}
        </Row>
      </dl>
      {action && <div className="mt-3 flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}
