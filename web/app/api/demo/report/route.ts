// POST /api/demo/report {flat}: the demo landlord files the scripted move-out report of one of its
// sample flats, once the visitor (its tenant) has given notice. Rate-limited per flat; answers the
// transaction hash, or why not. Nothing here ever logs or returns the key.

import { fileDemoReport } from "@/lib/demo-server";
import { parseFlatId } from "@/lib/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A read of the flat (retried while Studio is slow) and one signature: allow up to a minute.
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let flat = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { flat?: unknown };
    flat = typeof body.flat === "string" ? parseFlatId(body.flat) : "";
  } catch {
    flat = "";
  }
  if (!flat) return Response.json({ ok: false, reason: 'send {"flat": "F12"}' }, { status: 400, headers: noStore });
  const answer = await fileDemoReport(flat);
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
