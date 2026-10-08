import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mine",
  description: "Your tenancies and your flats, with the next step on each.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
