import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ledger",
  description: "What the contract holds, what it has paid out, and how the network has read the contested deductions.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
