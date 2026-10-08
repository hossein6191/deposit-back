import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Landlords",
  description: "Offer a flat with its move-in notes, and file the move-out report on your own flats.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
