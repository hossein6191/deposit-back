"use client";

// rules(): the contract's own words, read live and shown as it wrote them.

import { Placeholder, ReadError } from "@/components/read-state";
import { useRead } from "@/components/use-read";
import { readRules } from "@/lib/chain";

const title = (k: string) => {
  const t = k.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function Value({ v }: { v: unknown }) {
  if (typeof v === "string" || typeof v === "number") return <span>{String(v)}</span>;
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x === "number" || (typeof x === "string" && x.length < 30))) return <span className="mono">{v.map(String).join(" to ")}</span>;
    return (
      <ul className="list-disc space-y-1 pl-5">
        {v.map((x, i) => (
          <li key={i}>
            <Value v={x} />
          </li>
        ))}
      </ul>
    );
  }
  if (v && typeof v === "object")
    return (
      <dl className="space-y-1.5">
        {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
          <div key={k} className="grid gap-x-3 sm:grid-cols-[11rem_1fr]">
            <dt className="mono text-ink-faint">{k}</dt>
            <dd>
              <Value v={x} />
            </dd>
          </div>
        ))}
      </dl>
    );
  return null;
}

export function ContractWords() {
  const read = useRead(() => readRules(), []);
  if (read.error) return <ReadError detail={read.error} onRetry={read.retry} />;
  if (!read.data) return <Placeholder lines={6} />;
  return (
    <dl className="space-y-4 text-sm">
      {Object.entries(read.data).map(([k, v]) => (
        <div key={k} className="border-t border-dashed border-rule-strong pt-3">
          <dt className="font-display text-base font-semibold">{title(k)}</dt>
          <dd className="mt-1 text-ink-soft">
            <Value v={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
