import Link from "next/link";

import { KeyTagLink } from "@/components/key-tag";

export default function NotFound() {
  return (
    <div className="wrap py-16">
      <p className="eyebrow">Not found</p>
      <h1 className="mt-2 text-4xl">No room by that name</h1>
      <p className="mt-3 max-w-prose text-ink-soft">
        This address is not part of the site. The flats are on <Link href="/flats" className="link">the flats page</Link>.
      </p>
      <KeyTagLink href="/" className="mt-6">
        Back to the start
      </KeyTagLink>
    </div>
  );
}
