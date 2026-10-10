"use client";

// Suggestions for the landlord's forms: a row of small outline tags (app/globals.css, .chip), each
// filling a field in one click; and the item picker, a folded list of common items that fills an
// item's name and its move-in note together. What a chip fills stays editable.

import * as React from "react";

import { cx } from "@/lib/cx";
import { ITEM_SUGGESTIONS, type ItemSuggestion } from "@/lib/suggestions";

export type Chip = { key: string; label: string; pressed?: boolean; disabled?: boolean };

export function Chips({
  label,
  lead,
  chips,
  onPick,
  className,
}: {
  /** what the group is, for a screen reader */
  label: string;
  /** a short word shown before the chips */
  lead?: string;
  chips: Chip[];
  onPick: (key: string) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cx("flex flex-wrap items-center gap-1.5", className)}>
      {lead && (
        <span className="mr-0.5 text-xs text-ink-faint" aria-hidden="true">
          {lead}
        </span>
      )}
      {chips.map((c) => (
        <button
          key={c.key}
          type="button"
          className="chip"
          aria-pressed={!!c.pressed}
          disabled={c.disabled}
          onClick={() => onPick(c.key)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The common items, folded behind one tag. Picking one fills the item's name and its move-in note
 * and folds the list again; an item already in the flat is greyed out.
 */
export function ItemPicker({ id, used, onPick }: { id: string; used: ReadonlySet<string>; onPick: (s: ItemSuggestion) => void }) {
  const [open, setOpen] = React.useState(false);
  const toggle = React.useRef<HTMLButtonElement>(null);
  return (
    <div className="contents">
      <button ref={toggle} type="button" className="chip" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {open ? "Hide suggestions" : "Suggestions"}
      </button>
      {open && (
        <div id={id} className="order-last mt-2 w-full rounded-sm border border-dashed border-rule-strong bg-paper p-2">
          <p className="mb-2 text-xs text-ink-faint">
            One click fills the name and the move-in note; both stay editable. Items already in this flat are greyed out.
          </p>
          <Chips
            label="Common items"
            chips={ITEM_SUGGESTIONS.map((s) => ({ key: s.name, label: s.name, disabled: used.has(s.name.toLowerCase()) }))}
            onPick={(key) => {
              const s = ITEM_SUGGESTIONS.find((x) => x.name === key);
              if (!s) return;
              onPick(s);
              setOpen(false);
              toggle.current?.focus();
            }}
          />
        </div>
      )}
    </div>
  );
}
