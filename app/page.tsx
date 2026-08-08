import { q } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  let salas: any[] = [];
  try {
    salas = await q(
      `select id, product_name, photo_url, list_price, highest_bid, status
         from rooms order by created_at desc limit 12`
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

      {salas.length === 0 && (
        <p className="mt-4 text-papel/60">
          No hay salas cargadas. Corre <code className="text-amarillo">npm run db:push</code> para sembrar la base.
        </p>
      )}

      <div className="mt-4 grid gap-3">
        {salas.map((s) => (
          <Link
            key={s.id}
            href={`/sala/${s.id}`}
            className="borde flex items-center gap-3 bg-papel/10 p-3 transition hover:bg-papel/20"
          >
            {s.photo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.photo_url} alt="" className="h-16 w-16 object-cover borde" />
            )}
            <div className="min-w-0">
              <div className="display truncate text-xl">{s.product_name}</div>
              <div className="text-xs text-papel/60">Lista S/{s.list_price}</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-[10px] uppercase tracking-widest text-papel/50">Mejor oferta</div>
              <div className="display text-2xl text-loro">S/{Number(s.highest_bid) || "—"}</div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
