import { q } from "@/lib/db";
import { SalasEnVivo, type SalaCard, type VentaCard } from "./SalasEnVivo";

export const dynamic = "force-dynamic";

export default async function Home() {
  let salas: SalaCard[] = [];
  let vendidas: VentaCard[] = [];
  try {
    // Abiertas y cerrando en un solo grid principal. Vendidas NUNCA
    // aparecen acá - si el jurado navega al home después de cerrar una
    // sala en vivo, no debe confundirse una vendida con una abierta.
    salas = await q(
      `select id, product_name, photo_url, category, list_price, highest_bid, status, closes_at
         from rooms where status <> 'sold' order by created_at desc limit 24`
    );
    vendidas = await q(
      `select id, product_name, photo_url, final_price
         from rooms where status = 'sold' order by created_at desc limit 8`
    );
  } catch {}

  // MarketplaceHome (v0) ya trae su propio header, buscador, chips de
  // categoría y nav inferior - no hace falta el markup viejo alrededor.
  // Etapa 1.1 sigue igual: SSR pinta el estado inicial, SalasEnVivo se
  // monta encima y escucha `lobby` para los diffs en vivo.
  return <SalasEnVivo initialAbiertas={salas} initialVendidas={vendidas} />;
}
