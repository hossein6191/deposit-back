// The mark (a key whose bow is a house) and the name beside it.

import { MARK_PATHS } from "@/lib/mark";
import { cx } from "@/lib/cx";

export function Mark({ className, title, ring }: { className?: string; title?: string; ring?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {/* on the key ring: a split ring threaded through the door of the bow */}
      {ring && <path d="M12.5 50.5 A9.5 9.5 0 1 0 14.2 38.6" fill="none" stroke="#22303A" strokeWidth="2.4" strokeLinecap="round" />}
      <g transform="translate(0 -1)">
        <path d={MARK_PATHS.bow} fill="#B85C38" fillRule="evenodd" />
        <path d={MARK_PATHS.blade} fill="#22303A" />
      </g>
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <Mark className="size-9 shrink-0" ring />
      <span className="font-display text-[1.32rem] leading-none font-semibold tracking-tight">Deposit Back</span>
    </span>
  );
}
