import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const MAX_FOTOS_POR_SALA = 6;
const MAX_BYTES_POR_FOTO = 5 * 1024 * 1024; // 5MB

const TIPOS_PERMITIDOS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

/**
 * Sube 1-N fotos para una sala (multipart/form-data, campo "fotos",
 * repetido). Usa `request.formData()` nativo de Next - no hace falta
 * ninguna librería de multipart aparte.
 *
 * Sin auth todavía a propósito - mismo patrón ya aceptado que `?seller=1`
 * para el panel de vendedor (ESTADO-ALTOKE §4). Cuando entre Clerk, este
 * endpoint gana el mismo guard que el resto de rutas de vendedor: no antes.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await ctx.params;

  const existe = await pool.query(`select id from rooms where id = $1`, [roomId]);
  if (existe.rowCount === 0) {
    return Response.json({ error: "room_not_found" }, { status: 404 });
  }

  const yaHay = Number(
    (await pool.query(`select count(*)::int as n from room_photos where room_id = $1`, [roomId]))
      .rows[0].n,
  );

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_form" }, { status: 400 });
  }

  const archivos = form.getAll("fotos").filter((f): f is File => f instanceof File);
  if (archivos.length === 0) {
    return Response.json({ error: "sin_archivos" }, { status: 400 });
  }
  if (yaHay + archivos.length > MAX_FOTOS_POR_SALA) {
    return Response.json(
      { error: "demasiadas_fotos", max: MAX_FOTOS_POR_SALA, yaHay },
      { status: 400 },
    );
  }

  const dirSala = path.join(UPLOADS_DIR, roomId);
  await mkdir(dirSala, { recursive: true });

  const urls: string[] = [];
  let posicion = yaHay;

  for (const archivo of archivos) {
    const ext = TIPOS_PERMITIDOS[archivo.type];
    if (!ext) {
      return Response.json({ error: "tipo_no_permitido", tipo: archivo.type }, { status: 400 });
    }
    if (archivo.size > MAX_BYTES_POR_FOTO) {
      return Response.json({ error: "archivo_muy_grande", max: MAX_BYTES_POR_FOTO }, { status: 400 });
    }

    const nombre = `${randomUUID()}${ext}`;
    const bytes = Buffer.from(await archivo.arrayBuffer());
    await writeFile(path.join(dirSala, nombre), bytes);

    const url = `/api/uploads/${roomId}/${nombre}`;
    await pool.query(
      `insert into room_photos (room_id, url, position) values ($1, $2, $3)`,
      [roomId, url, posicion],
    );
    urls.push(url);
    posicion += 1;
  }

  return Response.json({ ok: true, urls });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await ctx.params;
  const rows = await pool.query(
    `select url from room_photos where room_id = $1 order by position asc`,
    [roomId],
  );
  return Response.json({ urls: rows.rows.map((r) => r.url as string) });
}
