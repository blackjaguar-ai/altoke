import { pool } from "@/lib/db";
import { publicar, canalSala, difundirLobby } from "@/lib/portal-server";

export const dynamic = "force-dynamic";

const MIN_S = 10;
const MAX_S = 300;
const DEFAULT_S = 300; // 5 min, ritmo tipo Binance P2P (PRD, punto 2 del pedido nuevo)

/**
 * Anuncia el cierre de la sala: arranca el countdown sincronizado (HU-06).
 * Idempotente por diseño: solo transiciona una sala que está `open`. Si dos
 * llamadas llegan a la vez (dos jueces con el panel de control abierto),
 * el WHERE status = 'open' hace que solo una gane la carrera - la misma
 * disciplina que ya usa /api/bids con el UPDATE ... RETURNING.
 *
 * Quién llama esto: el control del vendedor en la UI (`?seller=1`). El
 * vendedor no necesita estar conectado al canal - solo dispara este POST y
 * el agente toma la voz desde aquí en adelante. Encaja con HU-10.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await ctx.params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // sin body está bien, usamos el default
  }
  const seconds = Math.min(MAX_S, Math.max(MIN_S, Math.floor(Number(body?.seconds) || DEFAULT_S)));
  const closesAtDate = new Date(Date.now() + seconds * 1000);

  const client = await pool.connect();
  try {
    const res = await client.query(
      `update rooms set status = 'closing', closes_at = $1
         where id = $2 and status = 'open'
       returning highest_bid, highest_handle`,
      [closesAtDate, roomId],
    );

    if (res.rowCount === 0) {
      // O no existe, o ya no está 'open' (closing o sold). No es un error
      // duro: alguien más ya lo disparó, o ya se vendió.
      const existe = (await client.query(`select status from rooms where id = $1`, [roomId])).rows[0];
      if (!existe) return Response.json({ error: "room_not_found" }, { status: 404 });
      return Response.json({ ok: true, alreadyClosing: true, status: existe.status });
    }

    const closesAt = closesAtDate.getTime();
    const highestBid = Number(res.rows[0].highest_bid);
    const highestHandle = res.rows[0].highest_handle as string | null;

    // Etapa 1.5 — presión social real con lo que sí podemos verificar: un
    // anuncio público en la sala con el conteo de corazones. Lo que NO
    // hacemos es prometer una notificación push al celular vía Portal
    // Inbox para gente anónima que no está conectada - la identidad anon
    // de Portal no está confirmada como estable entre sesiones/pestañas
    // distintas, y una promesa de "te avisamos" que a veces no llega es
    // peor que no hacerla. Quien tiene la pestaña abierta (esta sala o el
    // home) sí recibe el aviso en vivo, eso es lo que garantizamos.
    const interesados = Number(
      (await client.query(`select count(*)::int as n from interests where room_id = $1`, [roomId]))
        .rows[0].n,
    );

    const sufijoInteres = interesados > 0 ? ` ${interesados} personas se anotaron con el corazón.` : "";
    const texto = highestBid > 0
      ? `Cerramos en ${seconds} segundos. Mejor oferta ahora: S/${highestBid}. Última oportunidad para subir.${sufijoInteres}`
      : `Cerramos en ${seconds} segundos. Todavía nadie ha ofertado - no se cierra sin oferta.${sufijoInteres}`;

    await publicar(canalSala(roomId), { t: "state", status: "closing", closesAt });
    await publicar(canalSala(roomId), { t: "agent", action: "hold", amount: null, text: texto });
    // Etapa 1.1 — el home escucha esto para actualizar el badge de la
    // tarjeta sin que el jurado tenga que refrescar la página.
    await difundirLobby({ roomId, status: "closing", closesAt, highestBid: highestBid || undefined });

    console.log(`[close] room=${roomId} seconds=${seconds} highest=${highestBid} handle=${highestHandle ?? "-"}`);
    return Response.json({ ok: true, closesAt, status: "closing" });
  } catch (e) {
    console.error("[close] error", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
