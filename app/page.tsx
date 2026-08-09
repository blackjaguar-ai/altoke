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
      `select id, product_name, photo_url, list_price, highest_bid, status
         from rooms where status <> 'sold' order by created_at desc limit 12`
    );
    vendidas = await q(
      `select id, product_name, photo_url, final_price
         from rooms where status = 'sold' order by created_at desc limit 8`
    );
  } catch {}

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="display text-6xl leading-[.85] text-amarillo dura">
        Sala<br /><span className="text-fucsia">Viva</span>
      </h1>
      <p className="mt-4 max-w-md text-lg text-papel/75">
        El vendedor pone su precio piso en privado. Su agente negocia en público,
        frente a todos los compradores a la vez. Sin inbox, sin una semana de espera.
      </p>

      <h2 className="mt-10 display text-sm tracking-widest text-papel/50">
        Salas abiertas ahora
      </h2>

      {/* Etapa 1.1 — SSR pinta el estado inicial (primer paint rápido),
         SalasEnVivo se monta encima y escucha el canal `lobby` para los
         diffs que ocurran mientras la pestaña sigue abierta. Sin esto el
         jurado tendría que hacer F5 para ver que algo se cerró o vendió. */}
      <SalasEnVivo initialAbiertas={salas} initialVendidas={vendidas} />
    </main>
  );
}
