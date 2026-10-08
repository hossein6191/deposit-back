// The route's own browser title, from the URL alone: no chain read, and a made-up id never reaches the title.
import type { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const m = /^F?([1-9]\d{0,8})$/i.exec(id);
  return {
    title: m ? `Flat F${m[1]}` : "Flat",
    description: "One lease: the floor plan, every item in and out, the deductions, the verdicts and where the deposit went.",
  };
}

export default function FlatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
