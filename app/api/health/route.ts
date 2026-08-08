import { q } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function GET() {
  const out: Record<string, unknown> = { ok: true, ts: new Date().toISOString() };
  try { await q("select 1"); out.db = "up"; } catch (e) { out.db = "down"; out.ok = false; }
  out.portal = process.env.PORTAL_SECRET_KEY ? "configured" : "MISSING";
  out.llm = process.env.LLM_API_KEY ? "configured" : "MISSING";
  return Response.json(out, { status: out.ok ? 200 : 503 });
}
