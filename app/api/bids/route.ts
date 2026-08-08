import { createHash } from "crypto";
import { pool } from "@/lib/db";
import { decide, assertNoFloorLeak } from "@/lib/pricing";
import { draft } from "@/lib/agent";
import { mask } from "@/lib/mask";
import { publicar, canalSala } from "@/lib/portal-server";

export const dynamic = "force-dynamic";

/** La voz del agente sale por la HTTP API de Portal con la secret key. */
async function difundir(roomId: string, content: any) {
  await publicar(canalSala(roomId), content);
}

export async function POST(req: Request) {
  const t0 = Date.now();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }

  const roomId = String(body.roomId ?? "");
  const handleRaw = String(body.handle ?? "").slice(0, 24).trim();
  const district = body.district ? String(body.district).slice(0, 40) : null;
  const amount = Math.floor(Number(body.amount));

  if (!roomId || !handleRaw) {
    return Response.json({ error: "missing_fields" }, { status: 400 });
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return Response.json({ error: "bad_amount" }, { status: 400 });
  }

  const handle = mask(handleRaw).text;
  const contentHash = createHash("sha256")
    .update(`${roomId}|${handle}|${amount}`)
    .digest("hex");

  const client = await pool.connect();
  try {
    // ============================================================
    // FASE 1 - transaccion corta: leer, decidir, guardar la oferta.
    // Todo o nada. Si algo falla aca (incluido el guard del piso), se
    // revierte COMPLETO: nunca queda highest_bid actualizado sin su
    // fila de bid correspondiente. Esto es lo que se rompio antes.
    // ============================================================
    await client.query("BEGIN");

    const room = (
      await client.query(
        `select id, list_price, floor_price, agent_tone, status,
                highest_bid, counter_count, closes_at
           from rooms where id = $1
          for update`, // lock de fila: serializa ofertas concurrentes en la misma sala
        [roomId],
      )
    ).rows[0];

    if (!room) {
      await client.query("ROLLBACK");
      return Response.json({ error: "room_not_found" }, { status: 404 });
    }
    if (room.status === "sold") {
      await client.query("ROLLBACK");
      return Response.json({ error: "room_closed" }, { status: 409 });
    }

    const dup = (
      await client.query(`select id from bids where content_hash = $1`, [contentHash])
    ).rows[0];
    if (dup) {
      await client.query("ROLLBACK");
      return Response.json({ ok: true, deduped: true }, { status: 200 });
    }

    const bumped = await client.query(
      `update rooms set highest_bid = $1, highest_handle = $2
         where id = $3 and $1 > highest_bid
       returning highest_bid`,
      [amount, handle, roomId],
    );
    const wonTheRace = bumped.rowCount === 1;

    const floorPrice = Number(room.floor_price);
    const decision = decide(
      { amount, handle, district },
      {
        floorPrice,
        listPrice: Number(room.list_price),
        highestBid: Number(room.highest_bid),
        counterCount: Number(room.counter_count),
        closesAt: room.closes_at ? new Date(room.closes_at).getTime() : null,
      },
    );

    // Cinturon y tirantes: si la CONTRAOFERTA CALCULADA coincide con el
    // piso, algo esta mal en FLOOR_MARGIN - revienta aca, en el servidor,
    // con ROLLBACK, y no delante del jurado con la base a medio escribir.
    assertNoFloorLeak(decision, floorPrice);

    const bidRow = (
      await client.query(
        `insert into bids (room_id, buyer_handle, district, amount, content_hash)
         values ($1,$2,$3,$4,$5) returning id`,
        [roomId, handle, district, amount, contentHash],
      )
    ).rows[0];

    await client.query("COMMIT");

    // ============================================================
    // FASE 1.5 - la oferta ya es verdad en la base. Se ve YA, sin
    // esperar al LLM.
    // ============================================================
    await difundir(roomId, { t: "bid", handle, amount, district });

    // ============================================================
    // FASE 2 - llamada externa lenta (LLM). A PROPOSITO fuera de la
    // transaccion: nunca sostener un lock de fila esperando a OpenAI.
    // ============================================================
    const tLlm = Date.now();
    const text = await draft(decision, room.agent_tone);
    const latency = Date.now() - tLlm;

    // ============================================================
    // FASE 3 - segunda transaccion corta: aplicar el resultado del
    // agente. Independiente de la Fase 1; si esta falla no corrompe
    // el estado de la oferta ya confirmada.
    // ============================================================
    await client.query("BEGIN");
    try {
      if (decision.action === "counter") {
        await client.query(`update rooms set counter_count = counter_count + 1 where id = $1`, [
          roomId,
        ]);
      }
      if (decision.action === "accept") {
        await client.query(
          `update rooms set status = 'sold', winner_handle = $1, final_price = $2
             where id = $3 and status <> 'sold'`,
          [handle, decision.amount, roomId],
        );
      }
      await client.query(
        `insert into agent_msgs (room_id, bid_id, action, amount, reason, text, latency_ms)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          roomId,
          bidRow?.id ?? null,
          decision.action,
          decision.action === "outbid" ? null : decision.amount,
          decision.reason,
          text,
          latency,
        ],
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }

    await difundir(roomId, {
      t: "agent",
      action: decision.action,
      amount: decision.action === "outbid" ? null : decision.amount,
      text,
    });

    if (decision.action === "accept") {
      await difundir(roomId, {
        t: "state",
        status: "sold",
        winner: handle,
        finalPrice: decision.amount,
      });
    }

    console.log(
      `[bid] room=${roomId} handle=${handle} amount=${amount} raceWon=${wonTheRace} -> ${decision.action}/${decision.reason} llm=${latency}ms total=${Date.now() - t0}ms`,
    );

    return Response.json({ ok: true });
  } catch (e) {
    // Si la Fase 1 ya hizo COMMIT, esto solo revierte una Fase 3 a medias
    // (que ya tiene su propio try/catch con ROLLBACK). Si el error vino
    // ANTES del primer COMMIT, este rollback es el que salva el estado.
    await client.query("ROLLBACK").catch(() => {});
    console.error("[bid] error", e);
    return Response.json({ error: "server_error" }, { status: 500 });
  } finally {
    client.release();
  }
}
