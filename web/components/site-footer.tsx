// The foot of every page: the network, the contract, and the plain limits.

import Link from "next/link";

import { addressUrl, contractAddress, isMock } from "@/lib/chain";
import { REPO_URL } from "@/lib/config";
import { short } from "@/lib/format";

export function SiteFooter() {
  const contract = contractAddress();
  return (
    <footer className="mt-16 border-t border-ink/15 bg-paper-deep/60">
      <div className="wrap grid gap-6 py-8 text-sm text-ink-soft sm:grid-cols-3">
        <div>
          <p className="font-display text-base font-semibold text-ink">Deposit Back</p>
          <p className="mt-1">A rental deposit that comes back item by item, read by validators on GenLayer.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Network</p>
          <p className="mt-1">
            GenLayer Studio, chain 61999: a test network, test GEN only.{" "}
            {isMock ? (
              "This build runs on an in-memory copy of the contract."
            ) : contract ? (
              <>
                Contract{" "}
                <a className="link mono" href={addressUrl(contract)} target="_blank" rel="noreferrer">
                  {short(contract)}
                </a>
                .
              </>
            ) : (
              "The contract is not deployed yet."
            )}
          </p>
        </div>
        <div>
          <p className="font-semibold text-ink">Plainly</p>
          <p className="mt-1">
            Wear and tear is judged by one general rule, not the law of any country. Not legal advice.{" "}
            <Link href="/how" className="link">
              The limits
            </Link>
            {REPO_URL && (
              <>
                {" · "}
                <a href={REPO_URL} className="link" target="_blank" rel="noreferrer">
                  Source
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </footer>
  );
}
