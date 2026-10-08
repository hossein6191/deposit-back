"use client";

// The slim top bar: the key-ring mark, five places to go, and the wallet. Under 768 px the places
// fold into a menu so the bar keeps to one row on a phone.

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "@/components/brand/logo";
import { WalletButton, WrongChainBanner } from "@/components/wallet";
import { MockBar } from "@/components/mock-bar";
import { isMock } from "@/lib/chain";
import { cx } from "@/lib/cx";

export const NAV = [
  { href: "/flats", label: "Flats to let" },
  { href: "/landlord", label: "Landlords" },
  { href: "/mine", label: "Mine" },
  { href: "/ledger", label: "Ledger" },
  { href: "/how", label: "How it decides" },
];

export function TopBar() {
  const path = usePathname();
  const [open, setOpen] = React.useState(false);
  const [lastPath, setLastPath] = React.useState(path);
  // A link followed from the menu closes it.
  if (path !== lastPath) {
    setLastPath(path);
    setOpen(false);
  }
  const active = (href: string) => path === href || (href === "/flats" && path.startsWith("/flat/"));
  return (
    <header className="sticky top-0 z-30 border-b border-ink/15 bg-paper/95 backdrop-blur-[2px]">
      <div className="wrap flex h-14 items-center justify-between gap-3">
        <Link href="/" className="shrink-0 rounded-sm" aria-label="Deposit Back, home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? "page" : undefined}
                  className={cx(
                    "rounded-sm px-2.5 py-1.5 text-[0.95rem] font-semibold",
                    active(n.href) ? "text-terracotta-ink underline decoration-2 underline-offset-[6px]" : "text-ink-soft hover:text-ink",
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 items-center gap-2">
          {!isMock && <WalletButton inHeader />}
          <button
            type="button"
            className="rounded-sm border border-ink/40 px-2.5 py-1.5 text-sm font-semibold md:hidden"
            aria-expanded={open}
            aria-controls="small-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>
      {open && (
        <nav id="small-nav" aria-label="Main" className="border-t border-ink/10 md:hidden">
          <ul className="wrap flex flex-col py-2">
            <li>
              <Link href="/" className="block py-2 font-semibold">
                Home
              </Link>
            </li>
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} className={cx("block py-2 font-semibold", active(n.href) && "text-terracotta-ink")}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <WrongChainBanner />
      {isMock && <MockBar />}
    </header>
  );
}
