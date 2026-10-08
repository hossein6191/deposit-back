// The site's buttons are key tags: a solid tag with a rounded end, a punched hole and a string
// (app/globals.css, .keytag). Solid for the one thing to do next, outline for the alternative,
// sage for an action that sends money back to a tenant.

import * as React from "react";
import Link from "next/link";

import { cx } from "@/lib/cx";

type Look = { variant?: "solid" | "outline" | "sage"; size?: "md" | "sm"; block?: boolean };

const classes = ({ variant = "solid", size = "md", block }: Look, extra?: string) =>
  cx(
    "keytag",
    variant === "outline" && "keytag-outline",
    variant === "sage" && "keytag-sage",
    size === "sm" && "keytag-sm",
    block && "keytag-block",
    extra,
  );

export function KeyTag({
  variant,
  size,
  block,
  className,
  type = "button",
  ...props
}: Look & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes({ variant, size, block }, className)} {...props} />;
}

export function KeyTagLink({
  variant,
  size,
  block,
  className,
  href,
  external,
  children,
}: Look & { className?: string; href: string; external?: boolean; children: React.ReactNode }) {
  if (external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={classes({ variant, size, block }, className)}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={classes({ variant, size, block }, className)}>
      {children}
    </Link>
  );
}
