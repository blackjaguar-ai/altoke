import { one } from "@/lib/db";
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
  return Response.json(room);
}
