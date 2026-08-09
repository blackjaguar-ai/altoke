"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLobby } from "@/lib/portal-client";

export interface SalaCard {
  id: string;
  product_name: string;
  photo_url: string | null;
  list_price: number;
  highest_bid: number;
  status: string;
}

export interface VentaCard {
  id: string;
  product_name: string;
  photo_url: string | null;
  final_price: number;
}

/**
 * Etapa 1.1 — el grid del home se pinta por SSR (rápido, primer paint sin
 * esperar al socket) y este componente cliente se monta ENCIMA para recibir
 * los diffs de estado que ocurran mientras la pestaña sigue abierta. El
 * jurado nunca necesita darle F5 para ver que una sala se cerró o se
 * vendió - HU explícita del pedido nuevo ("recargarse en tiempo real").
 */
export function SalasEnVivo({
  initialAbiertas,
  initialVendidas,
}: {
  initialAbiertas: SalaCard[];
  initialVendidas: VentaCard[];
}) {
  const [abiertas, setAbiertas] = useState(initialAbiertas);
  const [vendidas, setVendidas] = useState(initialVendidas);
  const eventos = useLobby();
  const procesados = useRef(0);

  useEffect(() => {
    if (eventos.length <= procesados.current) return;
    const nuevos = eventos.slice(procesados.current);
    procesados.current = eventos.length;

    for (const ev of nuevos) {
      if (ev.status === "sold") {
        setAbiertas((prev) => {
          const sala = prev.find((s) => s.id === ev.roomId);
          if (sala) {
            setVendidas((v) => [
              { id: sala.id, product_name: sala.product_name, photo_url: sala.photo_url, final_price: ev.finalPrice ?? sala.highest_bid },
              ...v,
            ]);
          }
          return prev.filter((s) => s.id !== ev.roomId);
        });
      } else {
        setAbiertas((prev) =>
          prev.map((s) =>
            s.id === ev.roomId
              ? { ...s, status: ev.status, highest_bid: ev.highestBid ?? s.highest_bid }
              : s,
          ),
        );
      }
    }
  }, [eventos]);

  return (
    <>
      {abiertas.length === 0 && (
        <p className="mt-4 text-papel/60">
          No hay salas cargadas. Corre <code className="text-amarillo">npm run db:push</code> para sembrar la base.
        </p>
      )}

      <div className="mt-4 grid gap-3">
        {abiertas.map((s) => (
          <Link
            key={s.id}
            href={`/sala/${s.id}`}
            className="borde relative flex items-center gap-3 bg-papel/10 p-3 transition hover:bg-papel/20"
          >
            {s.status === "closing" && (
              <span className="absolute right-3 top-3 border-2 border-tinta bg-fucsia px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-tinta animate-pulse">
                Cerrando
              </span>
            )}
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

      {vendidas.length > 0 && (
        <>
          <h2 className="mt-10 display text-sm tracking-widest text-papel/50">
            Últimas ventas
          </h2>
          <div className="mt-4 grid gap-2">
            {vendidas.map((s) => (
              <Link
                key={s.id}
                href={`/sala/${s.id}`}
                className="borde flex items-center gap-3 bg-papel/5 p-2 opacity-70 transition hover:opacity-100"
              >
                {s.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photo_url} alt="" className="h-10 w-10 object-cover borde" />
                )}
                <div className="min-w-0 truncate text-sm">{s.product_name}</div>
                <div className="ml-auto shrink-0 text-sm text-loro">
                  S/{Number(s.final_price) || "—"}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
