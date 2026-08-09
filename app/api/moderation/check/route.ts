import { one } from "@/lib/db";
import { secretoValido } from "@/lib/moderation";

export const dynamic = "force-dynamic";

/**
 * Llamado (AWAITED) por el middleware `protegerDatos` en portal.config.ts,
 * ANTES de dejar pasar un mensaje de chat. Debe responder rápido: el
 * middleware corta a los 800ms y falla abierto (allow) si no llegamos.
 *
 * Read-only, un solo SELECT por PK - no hay razón para que esto sea lento.
 */
export async function POST(req: Request) {
  if (!secretoValido(req)) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const roomId = String(body.roomId ?? "");
  const handle = String(body.handle ?? "").slice(0, 24);
  if (!roomId || !handle) return Response.json({ banned: false });

  const row = await one<{ banned: boolean }>(
    `select banned from strikes where room_id = $1 and handle = $2`,
    [roomId, handle],
  );
  return Response.json({ banned: row?.banned === true });
}
