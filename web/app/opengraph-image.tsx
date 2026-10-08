import { ImageResponse } from "next/og";

import { SAMPLE_FLATS } from "@/lib/demo-flats";
import { markDataUri } from "@/lib/mark";
import { buildPlan, itemStates, planSvg } from "@/lib/plans";

export const alt = "Deposit Back: a rental deposit that comes back item by item";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The card shared links show: the mark and the name on paper, the one sentence the site is about,
// and the flat above the bakery drawn as a plan with its verdicts: two items damage, two wear.
export default function OpengraphImage() {
  const bakery = SAMPLE_FLATS[0];
  const plan = buildPlan(bakery.plan);
  const states = itemStates(
    bakery.items.length,
    bakery.deductions.map((d, index) => ({ item: d.item, index, verdict: d.expect })),
  );
  const svg = planSvg(plan, states);
  const planUri = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  const planW = 410;
  const planH = Math.round((plan.height * planW) / plan.width);
  const chip = (color: string, text: string) => (
    <div style={{ display: "flex", alignItems: "center", marginRight: 28 }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: color, border: "2px solid #22303A", marginRight: 10 }} />
      <div style={{ fontSize: 26, color: "#22303A" }}>{text}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: "#F6F1E7", padding: 56, color: "#22303A" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 600 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
                <img src={markDataUri({ size: 92 })} width={92} height={92} alt="" />
            <div style={{ marginLeft: 16, fontSize: 52, fontWeight: 700, letterSpacing: -1 }}>Deposit Back</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.08, letterSpacing: -1.5 }}>Your deposit comes back item by item.</div>
            <div style={{ marginTop: 22, fontSize: 27, lineHeight: 1.35, color: "#4A5862" }}>
              Validators read each deduction against the move-in and move-out notes, decide damage or wear, and the money moves in the same transaction.
            </div>
          </div>
          <div style={{ display: "flex" }}>
            {chip("#A63D32", "damage: to the landlord")}
            {chip("#5E7F63", "wear: back to you")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 40, flex: 1 }}>
          <div style={{ display: "flex", padding: 14, backgroundColor: "#FBF8F1", border: "2px solid #D9CFBD", borderRadius: 10 }}>
                <img src={planUri} width={planW} height={planH} alt="" />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
