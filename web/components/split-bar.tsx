// The money split: one bar the width of the deposit, in parts. Sage is what goes back to the
// tenant, terracotta what goes to the landlord, and a hatched ochre part is money whose way the
// verdict has not decided yet.

import { gen, share } from "@/lib/format";
import { cx } from "@/lib/cx";

export type Part = { label: string; atto: bigint; tone: "tenant" | "landlord" | "open" };

const TONE: Record<Part["tone"], string> = {
  tenant: "bg-sage",
  landlord: "bg-terracotta",
  open: "bg-[repeating-linear-gradient(45deg,rgba(194,138,44,0.55)_0_5px,rgba(194,138,44,0.22)_5px_10px)]",
};
const DOT: Record<Part["tone"], string> = {
  tenant: "bg-sage",
  landlord: "bg-terracotta",
  open: "bg-ochre",
};

export function SplitBar({ total, parts, caption, className }: { total: bigint; parts: Part[]; caption?: string; className?: string }) {
  const shown = parts.filter((p) => p.atto > 0n);
  return (
    <figure className={cx("w-full", className)}>
      <div
        className="flex h-5 w-full overflow-hidden rounded-[3px] border border-ink/70 bg-paper-deep"
        role="img"
        aria-label={shown.map((p) => `${p.label}: ${gen(p.atto)}`).join("; ") + ` of ${gen(total)}`}
      >
        {shown.map((p, i) => (
          <span
            key={i}
            className={cx("h-full", TONE[p.tone], i > 0 && "border-l-2 border-card")}
            style={{ width: `${share(p.atto, total)}%` }}
          />
        ))}
      </div>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {parts.map((p, i) => (
          <span key={i} className="inline-flex items-baseline gap-1.5">
            <span aria-hidden="true" className={cx("inline-block size-2.5 translate-y-[1px] rounded-[2px]", DOT[p.tone])} />
            <span className="text-ink-soft">{p.label}</span>
            <strong className="font-semibold tabular-nums">{gen(p.atto)}</strong>
          </span>
        ))}
        {caption && <span className="w-full text-ink-faint">{caption}</span>}
      </figcaption>
    </figure>
  );
}

/** "you" when the viewer is that party, else the party's name. */
export function partyWords(viewer: "tenant" | "landlord" | "other"): { tenant: string; landlord: string } {
  return {
    tenant: viewer === "tenant" ? "Back to you" : "Back to the tenant",
    landlord: viewer === "landlord" ? "To you" : "To the landlord",
  };
}
