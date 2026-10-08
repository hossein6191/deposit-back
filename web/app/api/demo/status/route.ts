// GET /api/demo/status: whether the demo landlord can file reports now, and its public address,
// so the flat page can tell a sample flat's tenant that the report comes by itself.

import { demoStatusNow } from "@/lib/demo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(demoStatusNow(), { headers: { "cache-control": "no-store" } });
}
