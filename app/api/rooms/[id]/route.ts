import { one, q } from "@/lib/db";
export const dynamic = "force-dynamic";

/**
 * Estado PÚBLICO de la sala.
 * Nota el SELECT explícito: floor_price no está en la lista y nunca lo estará.
 * Nunca uses `select *` en este endpoint.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const room = await one(
    `select id, product_name, product_desc, photo_url, list_price,
            status, highest_bid, highest_handle, winner_handle,
            final_price, closes_at
       from rooms where id = $1`,
    [id]
  );
  if (!room) return Response.json({ error: "not_found" }, { status: 404 });

  // Carrusel: room_photos si el vendedor subió fotos por /crear, si no
  // cae de vuelta al photo_url único de las salas sembradas a mano.
  const fotos = await q<{ url: string }>(
    `select url from room_photos where room_id = $1 order by position asc`,
    [id],
  );
  const photos = fotos.length > 0 ? fotos.map((f) => f.url) : room.photo_url ? [room.photo_url] : [];

  return Response.json({ ...room, photos });
}
