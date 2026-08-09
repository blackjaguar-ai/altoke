import { pool } from "@/lib/db";
import { publicar, canalSala } from "@/lib/portal-server";
import { secretoValido, STRIKE_LIMIT } from "@/lib/moderation";

export const dynamic = "force-dynamic";

/**
 * Llamado fire-and-forget vía `ctx.notify()` en portal.config.ts, DESPUÉS de
 * que un mensaje con palabra ofensiva ya se entregó (enmascarada). Nunca
 * bloquea al remitente actual - eso ya lo decidió el middleware en el mismo
 * tick. Esto solo cuenta y, si corresponde, expulsa hacia ADELANTE.
 *
 * La advertencia es PÚBLICA a propósito, no un DM: es presión social, y la
 * tesis del producto es que todo pasa a la vista de todos.
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
  if (!roomId || !handle) return Response.json({ error: "missing_fields" }, { status: 400 });

  const client = await pool.connect();
  try {
    const row = (
      await client.query(
        `insert into strikes (room_id, handle, count, banned, updated_at)
         values ($1, $2, 1, false, now())
         on conflict (room_id, handle) do update
           set count = strikes.count + 1,
               banned = (strikes.count + 1) >= $3,
               updated_at = now()
         returning count, banned`,
        [roomId, handle, STRIKE_LIMIT],
      )
    ).rows[0];

    const count = Number(row.count);
    const banned = row.banned === true;

    if (banned) {
      await publicar(canalSala(roomId), {
        t: "agent",
        action: "hold",
        amount: null,
        text: `${handle} fue retirado de la sala por lenguaje ofensivo repetido.`,
      });
    } else {
      await publicar(canalSala(roomId), {
        t: "agent",
        action: "hold",
        amount: null,
        text: `Cuidado con el vocabulario, ${handle} (${count}/${STRIKE_LIMIT}).`,
      });
    }

    console.log(`[strike] room=${roomId} handle=${handle} count=${count} banned=${banned}`);
    return Response.json({ ok: true, strikes: count, banned });
  } catch (e) {
    console.error("[strike] error", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
