"use client";

// What stands between a visitor and a signature: a wallet, the Studio chain, and enough test GEN.
// Each missing piece is offered as the one key tag to press; once all three are there, the action
// itself shows. In mock mode there is no wallet and the gate is open.

import * as React from "react";

import { KeyTag } from "@/components/key-tag";
import { useWallet } from "@/components/wallet";
import { isMock } from "@/lib/chain";
import { gen } from "@/lib/format";

export function WalletGate({ need = 0n, children, what = "to sign" }: { need?: bigint; children: React.ReactNode; what?: string }) {
  const w = useWallet();
  const [funding, setFunding] = React.useState(false);
  if (isMock) return <>{children}</>;
  if (!w.address)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-ink-soft">Connect a wallet {what}. Rabby and MetaMask both work; the site adds the Studio test network for you.</p>
        <KeyTag disabled={w.connecting} onClick={() => void w.connect()}>
          {w.connecting ? "Connecting…" : "Connect a wallet"}
        </KeyTag>
        {w.error && <p className="text-sm text-brick">{w.error}</p>}
      </div>
    );
  if (!w.onStudio)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-ink-soft">Your wallet is on another network. This site signs only on GenLayer Studio (chain 61999).</p>
        <KeyTag onClick={() => void w.switchToStudio()}>Switch to Studio</KeyTag>
      </div>
    );
  if (need > 0n && w.balanceAtto < need)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-ink-soft">
          This needs {gen(need)} and the wallet holds {gen(w.balanceAtto)}. Studio&apos;s faucet gives 10 test GEN, free, in about half a minute.
        </p>
        <KeyTag
          disabled={funding}
          onClick={async () => {
            setFunding(true);
            try {
              await w.getTestGen();
            } catch {
              /* the error is in w.error */
            } finally {
              setFunding(false);
            }
          }}
        >
          {funding ? "Waiting for the faucet…" : "Get 10 test GEN"}
        </KeyTag>
        {w.error && <p className="text-sm text-brick">{w.error}</p>}
      </div>
    );
  return <>{children}</>;
}
