import { pool } from "@/lib/db";
import { publicar, canalSala, difundirLobby } from "@/lib/portal-server";

export const dynamic = "force-dynamic";

/**
 * Resuelve la sala cuando el countdown de cierre llega a cero (HU-06).
 *
 * Quién llama esto: cualquier cliente conectado, en cuanto SU reloj local
 * calcula que `closesAt` ya pasó (ver Countdown en app/sala/[id]/page.tsx).
 * No hay cron ni worker en este stack - no lo necesitamos: el guard
 * `where status = 'closing' and closes_at <= now()` hace que sea seguro
 * que 1, 5 o 20 pestañas llamen esto al mismo tiempo. Solo una gana la
 * carrera y aplica el cambio; el resto recibe `alreadyResolved`.
 *
 * Regla de negocio: se cierra con la MEJOR OFERTA VIGENTE, tal como pide
 * el PRD ("al llegar a cero se cierra con la mejor oferta"). Si nadie
 * ofertó nunca, no hay nada que vender - la sala vuelve a 'open' sin piso
 * expuesto en ningún momento.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await ctx.params;

  const client = await pool.connect();
  try {
    const sold = await client.query(
      `update rooms set status = 'sold', winner_handle = highest_handle, final_price = highest_bid
         where id = $1 and status = 'closing' and closes_at <= now() and highest_bid > 0
       returning winner_handle, final_price`,
      [roomId],
    );

    if (sold.rowCount === 1) {
      const { winner_handle, final_price } = sold.rows[0];
      const finalPrice = Number(final_price);

      await publicar(canalSala(roomId), {
        t: "agent",
        action: "accept",
        amount: finalPrice,
        text: `Se cerró la ronda. Trato hecho con ${winner_handle} en S/${finalPrice}.`,
      });
      await publicar(canalSala(roomId), {
        t: "state",
        status: "sold",
        winner: winner_handle,
        finalPrice,
      });
      // Etapa 1.1 — saca la sala del grid principal del home y la manda a
      // "Últimas ventas" sin que nadie tenga que refrescar.
      await difundirLobby({ roomId, status: "sold", finalPrice });

      console.log(`[resolve] room=${roomId} sold winner=${winner_handle} price=${finalPrice}`);
      return Response.json({ ok: true, status: "sold", winner: winner_handle, finalPrice });
    }

    // Nadie ofertó a tiempo: reabre la sala en vez de dejarla colgada.
    const reopened = await client.query(
      `update rooms set status = 'open', closes_at = null
         where id = $1 and status = 'closing' and closes_at <= now() and highest_bid = 0
       returning id`,
      [roomId],
    );

    if (reopened.rowCount === 1) {
      await publicar(canalSala(roomId), { t: "state", status: "open" });
      await publicar(canalSala(roomId), {
        t: "agent",
        action: "hold",
        amount: null,
        text: "Se acabó el tiempo sin ofertas. Seguimos abiertos, manda tu oferta.",
      });
      // Etapa 1.1 — vuelve a "abierta" en el home, sin refresh.
      await difundirLobby({ roomId, status: "open", closesAt: null });
      console.log(`[resolve] room=${roomId} reopened, sin ofertas`);
      return Response.json({ ok: true, status: "open" });
    }

    // Ya lo resolvió otra pestaña, o todavía no toca (closes_at en el futuro).
    const current = (
      await client.query(`select status, final_price, winner_handle from rooms where id = $1`, [roomId])
    ).rows[0];
    if (!current) return Response.json({ error: "room_not_found" }, { status: 404 });
    return Response.json({ ok: true, alreadyResolved: true, status: current.status });
  } catch (e) {
    console.error("[resolve] error", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
