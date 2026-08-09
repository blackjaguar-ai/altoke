import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Toggle idempotente del corazón (Etapa 1.5). Un handle, un voto por sala.
 * GET devuelve el estado actual (para pintar el corazón al cargar la sala
 * sin depender de localStorage); POST alterna.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await ctx.params;
  const handle = new URL(req.url).searchParams.get("handle")?.slice(0, 24) ?? "";
  const client = await pool.connect();
  try {
    const count = (
      await client.query(`select count(*)::int as n from interests where room_id = $1`, [roomId])
    ).rows[0].n as number;
    let interested = false;
    if (handle) {
      const row = (
        await client.query(`select 1 from interests where room_id = $1 and handle = $2`, [roomId, handle])
      ).rows[0];
      interested = Boolean(row);
    }
    return Response.json({ interested, count });
  } finally {
    client.release();
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: roomId } = await ctx.params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const handle = String(body.handle ?? "").slice(0, 24).trim();
  if (!roomId || !handle) return Response.json({ error: "missing_fields" }, { status: 400 });

  const client = await pool.connect();
  try {
    const existe = (
      await client.query(`select 1 from interests where room_id = $1 and handle = $2`, [roomId, handle])
    ).rows[0];

    if (existe) {
      await client.query(`delete from interests where room_id = $1 and handle = $2`, [roomId, handle]);
    } else {
      await client.query(
        `insert into interests (room_id, handle) values ($1, $2)
         on conflict (room_id, handle) do nothing`,
        [roomId, handle],
      );
    }

    const count = (
      await client.query(`select count(*)::int as n from interests where room_id = $1`, [roomId])
    ).rows[0].n as number;

    return Response.json({ interested: !existe, count });
  } finally {
    client.release();
  }
}
