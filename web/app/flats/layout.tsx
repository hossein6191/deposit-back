import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flats to let",
  description: "Every flat on offer now, drawn as a plan, with its deposit and its items.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
