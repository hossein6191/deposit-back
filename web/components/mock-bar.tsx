"use client";

// Mock mode only. There is no wallet and no chain: the visitor acts as one of the demo accounts of
// the in-memory contract, and this bar says so on every page, lets them change account, gives test
// GEN, and moves the clock on so a closed window can be seen.

import { useLocal } from "@/components/use-local";
import { PERSONAS, advanceClock, mockAddress, mockBalanceText, mockClockOffset, setMockPersona } from "@/lib/chain-mock";
import { faucet } from "@/lib/chain";
import { gen, span } from "@/lib/format";

export function MockBar() {
  const address = useLocal(mockAddress, PERSONAS[0].address);
  const balance = useLocal(() => mockBalanceText(mockAddress()), "0");
  const offset = useLocal(mockClockOffset, 0);
  return (
    <div className="border-t border-ochre/50 bg-[#f1e4c4]">
      <div className="wrap flex flex-col gap-2 py-2 text-xs lg:flex-row lg:items-center lg:justify-between">
        <p>
          <strong className="font-bold">Demo build.</strong> An in-memory copy of the contract; the verdicts are scripted, not read by validators.
          Nothing here is on chain, and a reload starts again.
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <label htmlFor="mock-persona" className="shrink-0 font-semibold">
            Acting as
          </label>
          <select
            id="mock-persona"
            value={address}
            onChange={(e) => setMockPersona(e.target.value)}
            className="h-8 max-w-full min-w-0 rounded-sm border border-ink/40 bg-card px-1.5 text-xs"
          >
            {PERSONAS.map((p) => (
              <option key={p.address} value={p.address}>
                {p.name}: {p.note}
              </option>
            ))}
          </select>
          <span className="mono whitespace-nowrap">{gen(balance)}</span>
          <button type="button" onClick={() => void faucet(address)} className="rounded-sm border border-ink/40 bg-card px-2 py-1 font-semibold">
            +10 GEN
          </button>
          <button type="button" onClick={() => advanceClock(3600)} className="rounded-sm border border-ink/40 bg-card px-2 py-1 font-semibold">
            Clock +1 h
          </button>
          <button type="button" onClick={() => advanceClock(86400)} className="rounded-sm border border-ink/40 bg-card px-2 py-1 font-semibold">
            +1 day
          </button>
          {offset > 0 && <span className="text-ink-soft">clock moved on {span(offset)}</span>}
        </div>
      </div>
    </div>
  );
}
