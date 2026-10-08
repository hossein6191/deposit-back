// A "To let" card: the plan as a thumbnail, the deposit, the items, and the way in.

import { FloorPlan } from "@/components/floor-plan";
import { KeyTagLink } from "@/components/key-tag";
import { buildPlan, genericSpec, type Plan } from "@/lib/plans";
import { gen } from "@/lib/format";
import { cx } from "@/lib/cx";

const blank = new Map<number, Plan>();
/** A plan for a flat whose item names a short row does not carry: as many rooms as items. */
export function roomsOnly(n: number): Plan {
  const k = Math.max(2, Math.min(8, n));
  if (!blank.has(k)) blank.set(k, buildPlan(genericSpec(Array.from({ length: k }, (_, i) => ({ name: "Room " + (i + 1) })))));
  return blank.get(k)!;
}

export function ToLetCard({
  plan,
  title,
  addressLine,
  depositAtto,
  items,
  line,
  note,
  href,
  cta,
  disabled,
  tag,
}: {
  plan: Plan;
  title: string;
  addressLine: string;
  depositAtto: string;
  items: number;
  line?: string;
  note?: string;
  href: string;
  cta: string;
  disabled?: boolean;
  tag?: string;
}) {
  return (
    <article className="sheet flex flex-col overflow-hidden">
      <div className="relative h-56 border-b border-rule bg-paper p-2 pt-9">
        <FloorPlan plan={plan} states={[]} compact fit title={`Plan of ${title}`} />
        <span className="stamp absolute top-3 left-3 bg-card text-terracotta-ink">To let</span>
        {tag && <span className="stamp absolute top-3 right-3 bg-card text-ink-soft">{tag}</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-xl">{title}</h3>
        <p className="text-sm text-ink-soft">{addressLine}</p>
        <dl className="mt-3 flex gap-6 text-sm">
          <div>
            <dt className="text-ink-faint">Deposit</dt>
            <dd className="font-display text-xl font-semibold tabular-nums">{gen(depositAtto)}</dd>
          </div>
          <div>
            <dt className="text-ink-faint">Items</dt>
            <dd className="font-display text-xl font-semibold">{items}</dd>
          </div>
        </dl>
        {line && <p className="mt-3 text-[0.95rem]">{line}</p>}
        {note && <p className="mt-2 text-sm text-ink-faint">{note}</p>}
        <div className={cx("mt-auto pt-4")}>
          {disabled ? (
            <p className="text-sm font-semibold text-ink-faint">{cta}</p>
          ) : (
            <KeyTagLink href={href} size="sm">
              {cta}
            </KeyTagLink>
          )}
        </div>
      </div>
    </article>
  );
}

