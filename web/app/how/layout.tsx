import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it decides",
  description: "How validators decide whether a deduction is damage or ordinary wear, where the money goes, and the limits.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
