"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLobby } from "@/lib/portal-client";
import { MarketplaceHome, type MarketplaceCategory } from "@/components/altoke/marketplace-home";
import type { Room } from "@/components/altoke/auction-room";

export interface SalaCard {
  id: string;
  product_name: string;
  photo_url: string | null;
  category: string;
  list_price: number;
  highest_bid: number;
  status: string;
  closes_at: string | null;
}

export interface VentaCard {
  id: string;
  product_name: string;
  photo_url: string | null;
  final_price: number;
}

const CATEGORIAS_VALIDAS = ["vehiculos", "tecnologia", "hogar", "moda", "otros"] as const;

const CATEGORIAS: MarketplaceCategory[] = [
  { id: "all", label: "Todos" },
  { id: "vehiculos", label: "Vehículos" },
  { id: "tecnologia", label: "Tecnología" },
  { id: "hogar", label: "Hogar" },
  { id: "moda", label: "Moda" },
  { id: "otros", label: "Otros" },
];

// Room.photoUrl es obligatorio en el componente de v0 (string, no
// string|null) - mismo fallback que en la Sala, para salas sin foto.
const FOTO_VACIA =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='%23e1e5ee'/></svg>";

function categoriaValida(c: string): Room["category"] {
  return (CATEGORIAS_VALIDAS as readonly string[]).includes(c) ? (c as Room["category"]) : "otros";
}

/**
 * Home.bidderCount/spectatorCount/district no tienen dato real acá a
 * propósito: requeriría conectarse al canal de CADA sala listada solo para
 * poblar un número que MarketplaceHome ni siquiera renderiza hoy
 * (confirmado leyendo el componente - RoomCard/HotCard no los usan). Si
 * algún día se necesitan de verdad, ahí sí vale la pena resolverlo.
 */
function salaARoom(s: SalaCard): Room {
  const lista = Number(s.list_price);
  const max = Number(s.highest_bid);
  return {
    id: s.id,
    productName: s.product_name,
    photoUrl: s.photo_url ?? FOTO_VACIA,
    listPrice: lista,
    highestBid: max || null,
    category: categoriaValida(s.category),
    status: (s.status as Room["status"]) ?? "open",
    closesAt: s.closes_at ? new Date(s.closes_at).getTime() : null,
    finalPrice: null,
    bidderCount: 0,
    spectatorCount: 0,
    district: "",
    heat: lista > 0 ? Math.min(100, (max / lista) * 100) : 0,
  };
}

function ventaARoom(v: VentaCard): Room {
  const precio = Number(v.final_price);
  return {
    id: v.id,
    productName: v.product_name,
    photoUrl: v.photo_url ?? FOTO_VACIA,
    listPrice: precio,
    highestBid: precio,
    category: "otros",
    status: "sold",
    closesAt: null,
    finalPrice: precio,
    bidderCount: 0,
    spectatorCount: 0,
    district: "",
    heat: 0,
  };
}

/**
 * Etapa 1.1 — el grid del home se pinta por SSR (rápido, primer paint sin
 * esperar al socket) y este componente cliente se monta ENCIMA para recibir
 * los diffs de estado que ocurran mientras la pestaña sigue abierta. El
 * jurado nunca necesita darle F5 para ver que una sala se cerró o se
 * vendió - HU explícita del pedido nuevo ("recargarse en tiempo real").
 *
 * Ahora renderiza vía MarketplaceHome (v0) en vez de la lista cruda de
 * antes - el componente nunca se toca, solo se le arman los props exactos.
 */
export function SalasEnVivo({
  initialAbiertas,
  initialVendidas,
}: {
  initialAbiertas: SalaCard[];
  initialVendidas: VentaCard[];
}) {
  const router = useRouter();
  const [abiertas, setAbiertas] = useState(initialAbiertas);
  const [vendidas, setVendidas] = useState(initialVendidas);
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory["id"]>("all");
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
              ? {
                  ...s,
                  status: ev.status,
                  highest_bid: ev.highestBid ?? s.highest_bid,
                  closes_at: ev.closesAt ? new Date(ev.closesAt).toISOString() : s.closes_at,
                }
              : s,
          ),
        );
      }
    }
  }, [eventos]);

  const rooms: Room[] = useMemo(
    () => [...abiertas.map(salaARoom), ...vendidas.map(ventaARoom)],
    [abiertas, vendidas],
  );

  return (
    <MarketplaceHome
      rooms={rooms}
      categories={CATEGORIAS}
      activeCategory={activeCategory}
      onSelectCategory={setActiveCategory}
      onOpenRoom={(room) => router.push(`/sala/${room.id}`)}
      onNavigateVender={() => router.push("/crear")}
    />
  );
}
