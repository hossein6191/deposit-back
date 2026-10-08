// An address as people read it: short, with the whole of it on hover, a "you" when it is the
// viewer's own, and a link to the explorer.

import { addressUrl, isMock } from "@/lib/chain";
import { short } from "@/lib/format";
import { cx } from "@/lib/cx";

export function Addr({ address, me, className }: { address: string; me?: string; className?: string }) {
  if (!address) return <span className={cx("text-ink-faint", className)}>nobody yet</span>;
  const mine = !!me && me.toLowerCase() === address.toLowerCase();
  const text = (
    <span className="whitespace-nowrap">
      <span className="mono">{short(address)}</span>
      {mine && <span className="ml-1 rounded-sm bg-ink px-1 text-[0.68rem] font-bold tracking-wide text-paper uppercase">you</span>}
    </span>
  );
  if (isMock)
    return (
      <span className={className} title={address}>
        {text}
      </span>
    );
  return (
    <a href={addressUrl(address)} target="_blank" rel="noreferrer" title={address} className={cx("hover:underline", className)}>
      {text}
    </a>
  );
}
