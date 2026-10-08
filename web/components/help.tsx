"use client";

// Every section says in one line what happens there, and offers a little more behind a "?" pin.
// The pin opens a note under itself; Escape, a click elsewhere or the close button shuts it.

import * as React from "react";

import { cx } from "@/lib/cx";

export function Help({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  const box = React.useRef<HTMLSpanElement>(null);
  const pin = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        pin.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={box} className="relative inline-flex">
      <button
        ref={pin}
        type="button"
        className="pin"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`More about ${title.toLowerCase()}`}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="note"
          className="sheet absolute top-full right-0 z-40 mt-2 block w-[min(22rem,calc(100vw-2rem))] p-4 text-left text-sm leading-relaxed text-ink"
        >
          <span className="mb-1 block font-display text-base font-semibold">{title}</span>
          <span className="block space-y-2 text-ink-soft">{children}</span>
          <button type="button" className="link mt-3 text-sm" onClick={() => setOpen(false)}>
            Close
          </button>
        </span>
      )}
    </span>
  );
}

/** The plain text of a heading, for the help pin's name: a string, or the string inside one element. */
function textOf(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  if (Array.isArray(node)) return node.map(textOf).join("");
  return "";
}

/** A section's heading, its one-line "what happens here", and its help pin. */
export function SectionHead({
  eyebrow,
  title,
  what,
  help,
  as: Tag = "h2",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  what: React.ReactNode;
  help?: React.ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <Tag className={Tag === "h1" ? "text-3xl sm:text-4xl" : Tag === "h2" ? "text-2xl" : "text-xl"}>{title}</Tag>
        <p className="mt-1.5 max-w-prose text-[0.95rem] text-ink-soft">
          <span className="font-semibold text-ink">What happens here: </span>
          {what}
        </p>
      </div>
      {help && <Help title={textOf(title) || "this section"}>{help}</Help>}
    </div>
  );
}
