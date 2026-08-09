import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quita tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Crea una sala. Sin auth todavía a propósito - mismo patrón ya aceptado
 * que `?seller=1` para el panel de vendedor (ESTADO-ALTOKE §4, "aceptable
 * para una demo de hackathon controlada por el mismo builder"). El campo
 * `seller_id` queda NULL: existe en el schema desde el diseño original
 * pensando en Clerk, se poblará cuando ese guard entre - no antes, para no
 * mezclar dos sistemas nuevos (upload + auth) en un mismo cambio.
 */
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const productName = String(body.productName ?? "").trim().slice(0, 80);
  const productDesc = body.productDesc ? String(body.productDesc).trim().slice(0, 500) : null;
  const listPrice = Math.floor(Number(body.listPrice));
  const floorPrice = Math.floor(Number(body.floorPrice));
  const agentTone = body.agentTone
    ? String(body.agentTone).trim().slice(0, 120)
    : "firme pero amable, criollo"; // mismo default que la columna en schema.sql

  if (!productName) return Response.json({ error: "falta_nombre" }, { status: 400 });
  if (!Number.isFinite(listPrice) || listPrice <= 0) {
    return Response.json({ error: "precio_lista_invalido" }, { status: 400 });
  }
  if (!Number.isFinite(floorPrice) || floorPrice <= 0) {
    return Response.json({ error: "precio_piso_invalido" }, { status: 400 });
  }
  if (floorPrice > listPrice) {
    return Response.json({ error: "piso_mayor_a_lista" }, { status: 400 });
  }

  const base = slugify(productName) || "sala";
  const client = await pool.connect();
  try {
    // Hasta 5 intentos con sufijo random si el slug choca - el id es
    // PRIMARY KEY, no hay upsert posible ni tiene sentido acá.
    for (let intento = 0; intento < 5; intento++) {
      const id = intento === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        const row = (
          await client.query(
            `insert into rooms (id, product_name, product_desc, list_price, floor_price, agent_tone)
             values ($1, $2, $3, $4, $5, $6)
             returning id`,
            [id, productName, productDesc, listPrice, floorPrice, agentTone],
          )
        ).rows[0];
        console.log(`[rooms] creada room=${row.id} lista=${listPrice} piso=${floorPrice}`);
        return Response.json({ ok: true, id: row.id });
      } catch (e: any) {
        if (e?.code === "23505") continue; // unique_violation en id - reintenta
        throw e;
      }
    }
    return Response.json({ error: "no_se_pudo_generar_id" }, { status: 500 });
  } catch (e) {
    console.error("[rooms] error creando sala", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
