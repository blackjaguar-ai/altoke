"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSala, useTrato, type EventoUI } from "@/lib/portal-client";
import {
  AuctionRoom,
  type Room,
  type Bid,
  type ChatMsg,
  type Reaction,
  type Seller,
} from "@/components/altoke/auction-room";
import { SellerRoom } from "@/components/altoke/seller-room";

const DISTRITOS = ["Surco", "Miraflores", "San Juan de Lurigancho", "Comas", "Callao", "Ate", "Los Olivos"];
const EMOJIS = ["🔥", "😱", "💸", "👏"];
// Único fallback cuando una sala no tiene ni room_photos ni photo_url - el
// tipo Room de v0 exige photos: [string, ...string[]] (tuple no vacío),
// así que necesita algo que renderizar sí o sí.
const FOTO_VACIA =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'><rect width='400' height='400' fill='%23232733'/></svg>";

interface RoomPublic {
  id: string;
  product_name: string;
  product_desc: string | null;
  photo_url: string | null;
  photos: string[];
  category: string;
  list_price: string;
  status: string;
  highest_bid: string;
  highest_handle: string | null;
  winner_handle: string | null;
  final_price: string | null;
  closes_at: string | null;
}

export default function SalaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const esVendedor = searchParams.get("seller") === "1";

  const [handle, setHandle] = useState("");
  const [distrito, setDistrito] = useState(DISTRITOS[0]);
  const [entrado, setEntrado] = useState(false);

  useEffect(() => {
    const g = localStorage.getItem("altoke.handle");
    if (g) setHandle(g);
  }, []);

  // El vendedor NO pasa por la entrada de comprador: no elige distrito, no
  // ocupa un cupo de "negociando ahora". Se conecta directo con un handle
  // fijo y `role: "seller"` en la metadata del canal (ver lib/portal-client).
  if (esVendedor) return <SalaVendedor id={id} />;

  if (!entrado)
    return (
      <Entrada
        handle={handle} setHandle={setHandle}
        distrito={distrito} setDistrito={setDistrito}
        onEntrar={() => { localStorage.setItem("altoke.handle", handle.trim()); setEntrado(true); }}
      />
    );
  return <SalaComprador id={id} handle={handle.trim()} distrito={distrito} />;
}

function Entrada(p: {
  handle: string; setHandle: (v: string) => void;
  distrito: string; setDistrito: (v: string) => void; onEntrar: () => void;
}) {
  const listo = p.handle.trim().length >= 2;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <h1 className="display text-5xl leading-none text-amarillo dura">Entra a<br />la sala</h1>
      <p className="text-papel/70">Sin cuenta, sin correo. Solo tu nombre.</p>
      <input
        autoFocus value={p.handle} maxLength={24}
        onChange={(e) => p.setHandle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && listo && p.onEntrar()}
        placeholder="¿Cómo te llamamos?"
        className="borde w-full bg-papel px-4 py-4 text-xl font-bold text-tinta outline-none focus:ring-4 focus:ring-fucsia"
      />
      <label className="text-sm font-semibold uppercase tracking-widest text-papel/60">
        ¿De qué distrito eres?
      </label>
      <select
        value={p.distrito} onChange={(e) => p.setDistrito(e.target.value)}
        className="borde w-full bg-papel px-4 py-3 font-bold text-tinta outline-none focus:ring-4 focus:ring-fucsia"
      >
        {DISTRITOS.map((d) => <option key={d}>{d}</option>)}
      </select>
      <button
        disabled={!listo} onClick={p.onEntrar}
        className="borde bg-amarillo px-6 py-5 display text-2xl text-tinta disabled:opacity-40"
      >
        Entrar a negociar
      </button>
    </main>
  );
}

/**
 * ============================================================
 * COMPRADOR — usa el componente nuevo de v0 (components/altoke/
 * auction-room.tsx). Este archivo solo construye los datos exactos
 * que ese componente pide (Room, Bid, ChatMsg, Reaction, Seller) a
 * partir de lo que ya viene del hook real - AuctionRoom en sí mismo
 * nunca se toca, sigue siendo el archivo tal como lo generó v0.
 * ============================================================
 */
function SalaComprador({ id, handle, distrito }: { id: string; handle: string; distrito: string }) {
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [bidDraft, setBidDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [panel, setPanel] = useState<"chat" | "bids">("chat");
  const [toast, setToast] = useState<string | null>(null);
  const [interesado, setInteresado] = useState(false);
  const [cuentaInteres, setCuentaInteres] = useState(0);

  const s = useSala(id, handle, distrito, "bidder");

  useEffect(() => {
    const cargar = () => fetch(`/api/rooms/${id}`).then((r) => r.json()).then(setRoom).catch(() => {});
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    fetch(`/api/rooms/${id}/interest?handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((j) => { setInteresado(Boolean(j.interested)); setCuentaInteres(Number(j.count) || 0); })
      .catch(() => {});
  }, [id, handle]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const maximo = room ? Math.max(s.maximoCanal, Number(room.highest_bid)) : 0;

  const vendido = useMemo(() => {
    if (!room) return null;
    return (
      s.vendido ??
      (room.status === "sold"
        ? { finalPrice: Number(room.final_price), winner: room.winner_handle ?? undefined }
        : null)
    );
  }, [s.vendido, room]);

  const closesAt = useMemo(() => {
    if (!room || vendido) return null;
    return s.cierre?.closesAt ?? (room.status === "closing" && room.closes_at ? new Date(room.closes_at).getTime() : null);
  }, [s.cierre, room, vendido]);

  const bidsVM: Bid[] = useMemo(
    () =>
      s.eventos
        .filter((e): e is EventoUI & { c: { t: "bid"; handle: string; amount: number; district?: string | null } } => e.c.t === "bid")
        .map((e) => ({
          id: e.id,
          handle: e.c.handle,
          amount: e.c.amount,
          district: e.c.district ?? "",
          createdAt: e.ts,
          isLeader: e.c.amount === maximo,
        }))
        .reverse(), // más reciente primero - calza con visibleBids.slice(0,5) del componente
    [s.eventos, maximo],
  );

  const messagesVM: ChatMsg[] = useMemo(
    () =>
      s.eventos
        .filter((e) => e.c.t === "chat" || e.c.t === "agent")
        .map((e) => {
          if (e.c.t === "agent") {
            return { id: e.id, handle: "Agente del vendedor", text: e.c.text, role: "agent" as const, createdAt: e.ts };
          }
          const c = e.c as { handle: string; body: string };
          return { id: e.id, handle: c.handle, text: c.body, role: "buyer" as const, createdAt: e.ts };
        }),
    [s.eventos],
  );

  // handle vacío a propósito: el componente nunca renderiza reaction.handle
  // (confirmado leyendo auction-room.tsx - solo pinta el emoji), así que no
  // vale la pena tocar el hook para rastrear quién mandó cada reacción.
  const reactionsVM: Reaction[] = s.reacciones.map((r) => ({ id: r.id, emoji: r.emoji, handle: "" }));

  const ganadorHandle = vendido?.winner;
  const soyGanador = Boolean(ganadorHandle) && handle === ganadorHandle;

  async function onBid() {
    const n = Math.floor(Number(bidDraft));
    if (!Number.isFinite(n) || n <= 0) { setToast("Escribe un monto válido."); return; }
    const err = await s.ofertar(n);
    if (err) setToast(err); else setBidDraft("");
  }

  async function onSend() {
    if (!messageDraft.trim()) return;
    const err = await s.comentar(messageDraft.trim());
    if (err) setToast(err); else setMessageDraft("");
  }

  async function onToggleInterest() {
    const res = await fetch(`/api/rooms/${id}/interest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ handle }),
    });
    const j = await res.json().catch(() => ({}));
    setInteresado(Boolean(j.interested));
    setCuentaInteres(Number(j.count) || 0);
  }

  function onShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator === "undefined") return;
    if (navigator.share) {
      navigator.share({ title: room?.product_name, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => setToast("Enlace copiado."));
    }
  }

  if (!room) {
    return (
      <main className="grid min-h-dvh place-items-center bg-altoke-bg">
        <p className="text-sm font-bold text-altoke-ink-soft">Cargando sala…</p>
      </main>
    );
  }

  // El comprador ganador ve el canal privado a pantalla completa, no
  // superpuesto al AuctionRoom - la negociación ya terminó, no tiene
  // sentido mostrar controles de oferta encima de eso (HU-05).
  if (vendido && ganadorHandle && soyGanador) {
    return (
      <main className="mx-auto min-h-dvh max-w-lg bg-altoke-bg p-4">
        <CanalPrivado
          roomId={id}
          winnerHandle={ganadorHandle}
          myHandle={handle}
          finalPrice={vendido.finalPrice ?? maximo}
        />
      </main>
    );
  }

  const lista = Number(room.list_price);
  const roomVM: Room = {
    id: room.id,
    productName: room.product_name,
    // room.photos ya es string[] (Postgres); el tipo Room del componente
    // exige un tuple no vacío, de ahí el fallback explícito al índice 0.
    photos: room.photos.length > 0 ? (room.photos as [string, ...string[]]) : [FOTO_VACIA],
    listPrice: lista,
    highestBid: maximo || null,
    category: (["vehiculos", "tecnologia", "hogar", "moda", "otros"] as const).includes(room.category as any)
      ? (room.category as Room["category"])
      : "otros",
    status: vendido ? "sold" : ((room.status as Room["status"]) ?? "open"),
    closesAt: closesAt ?? null,
    finalPrice: vendido?.finalPrice ?? null,
    bidderCount: s.cuantos,
    spectatorCount: s.cuantosMirando,
    district: bidsVM.find((b) => b.isLeader)?.district || distrito,
    heat: lista > 0 ? Math.min(100, (maximo / lista) * 100) : 0,
  };

  const sellerVM: Seller = {
    handle: "Vendedor",
    isAgentRepresented: !s.vendedorConectado,
  };

  return (
    <>
      <AuctionRoom
        room={roomVM}
        seller={sellerVM}
        bids={bidsVM}
        messages={messagesVM}
        reactions={reactionsVM}
        myRole={s.rol === "spectator" ? "spectator" : "bidder"}
        isInterested={interesado}
        activePanel={panel}
        bidDraft={bidDraft}
        messageDraft={messageDraft}
        onBid={onBid}
        onSend={onSend}
        onReact={(emoji) => s.reaccionar(emoji)}
        onToggleRole={() => s.cambiarRol(s.rol === "spectator" ? "bidder" : "spectator")}
        onToggleInterest={onToggleInterest}
        onPanelChange={setPanel}
        onBidDraftChange={(v) => { setBidDraft(v.replace(/\D/g, "")); s.sendTyping(); }}
        onMessageDraftChange={(v) => { setMessageDraft(v); s.sendTyping(); }}
        onShare={onShare}
        onCollapse={() => {
          // Sin spec visual de qué debería pasar al colapsar más allá del
          // ícono en sí - no-op a propósito hasta que haya un diseño real
          // para este estado. No inventar comportamiento no pedido.
        }}
      />
      {toast && (
        <div className="fixed inset-x-4 top-4 z-50 rounded-2xl bg-altoke-accent px-4 py-3 text-center text-sm font-bold text-white shadow-lg md:left-1/2 md:right-auto md:w-96 md:-translate-x-1/2">
          {toast}
        </div>
      )}
      {/* cuentaInteres no se muestra acá aparte: el corazón de AuctionRoom
         ya refleja isInterested. Se queda en estado por si se necesita
         mostrar el conteo en algún punto futuro. */}
    </>
  );
}

/**
 * ============================================================
 * VENDEDOR — usa SellerRoom (components/altoke/seller-room.tsx),
 * construido a mano reusando los mismos tokens/clases que v0 generó
 * para AuctionRoom (v0 se quedó sin créditos antes de generar esta
 * pantalla). Ver el propio archivo para el detalle de qué se copió y
 * qué se decidió de cero.
 * ============================================================
 */
function SalaVendedor({ id }: { id: string }) {
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [tratoDraft, setTratoDraft] = useState("");
  const handle = "Vendedor";

  const s = useSala(id, handle, "", "seller");

  useEffect(() => {
    const cargar = () => fetch(`/api/rooms/${id}`).then((r) => r.json()).then(setRoom).catch(() => {});
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [id]);

  const maximo = room ? Math.max(s.maximoCanal, Number(room.highest_bid)) : 0;

  const vendido = useMemo(() => {
    if (!room) return null;
    return (
      s.vendido ??
      (room.status === "sold"
        ? { finalPrice: Number(room.final_price), winner: room.winner_handle ?? undefined }
        : null)
    );
  }, [s.vendido, room]);

  const ganadorHandle = vendido?.winner;

  const closesAt = useMemo(() => {
    if (!room || vendido) return null;
    return s.cierre?.closesAt ?? (room.status === "closing" && room.closes_at ? new Date(room.closes_at).getTime() : null);
  }, [s.cierre, room, vendido]);

  const bidsVM: Bid[] = useMemo(
    () =>
      s.eventos
        .filter((e): e is EventoUI & { c: { t: "bid"; handle: string; amount: number; district?: string | null } } => e.c.t === "bid")
        .map((e) => ({
          id: e.id,
          handle: e.c.handle,
          amount: e.c.amount,
          district: e.c.district ?? "",
          createdAt: e.ts,
          isLeader: e.c.amount === maximo,
        }))
        .reverse(),
    [s.eventos, maximo],
  );

  const messagesVM: ChatMsg[] = useMemo(
    () =>
      s.eventos
        .filter((e) => e.c.t === "chat" || e.c.t === "agent")
        .map((e) => {
          if (e.c.t === "agent") {
            return { id: e.id, handle: "Agente del vendedor", text: e.c.text, role: "agent" as const, createdAt: e.ts };
          }
          const c = e.c as { handle: string; body: string };
          return { id: e.id, handle: c.handle, text: c.body, role: "buyer" as const, createdAt: e.ts };
        }),
    [s.eventos],
  );

  // useTrato SOLO se monta cuando ya hay ganador - mismo canal privado
  // que usa CanalPrivado más abajo, pero acá se consume directo (sin el
  // componente CanalPrivado, que trae su propia UI y SellerRoom ya tiene
  // la suya).
  const trato = useTrato(id, ganadorHandle ?? "", handle);

  async function onClose(seconds: 300 | 60 | 15) {
    if (cerrando) return;
    setCerrando(true);
    try {
      await fetch(`/api/rooms/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      });
    } finally {
      setCerrando(false);
    }
  }

  if (!room) {
    return (
      <main className="grid min-h-dvh place-items-center bg-altoke-bg">
        <p className="text-sm font-bold text-altoke-ink-soft">Cargando sala…</p>
      </main>
    );
  }

  const lista = Number(room.list_price);
  const roomVM: Room = {
    id: room.id,
    productName: room.product_name,
    photos: room.photos.length > 0 ? (room.photos as [string, ...string[]]) : [FOTO_VACIA],
    listPrice: lista,
    highestBid: maximo || null,
    category: (["vehiculos", "tecnologia", "hogar", "moda", "otros"] as const).includes(room.category as any)
      ? (room.category as Room["category"])
      : "otros",
    status: vendido ? "sold" : ((room.status as Room["status"]) ?? "open"),
    closesAt: closesAt ?? null,
    finalPrice: vendido?.finalPrice ?? null,
    bidderCount: s.cuantos,
    spectatorCount: s.cuantosMirando,
    district: bidsVM.find((b) => b.isLeader)?.district || "",
    heat: lista > 0 ? Math.min(100, (maximo / lista) * 100) : 0,
  };

  // El vendedor está VIENDO esta pantalla ahora mismo - por definición
  // está en vivo, no representado por su agente. La distinción
  // "representado" es para lo que ven LOS DEMÁS cuando el vendedor no
  // está conectado (ver s.vendedorConectado en SalaComprador).
  const sellerVM: Seller = { handle, isAgentRepresented: false };

  return (
    <SellerRoom
      room={roomVM}
      seller={sellerVM}
      bids={bidsVM}
      messages={messagesVM}
      onClose={onClose}
      privateChat={
        vendido && ganadorHandle
          ? {
              winnerHandle: ganadorHandle,
              messages: trato.eventos
                .filter((e) => e.c.t === "chat")
                .map((e) => {
                  const c = e.c as { handle: string; body: string };
                  return { id: e.id, handle: c.handle, text: c.body, role: "buyer" as const, createdAt: e.ts };
                }),
              draft: tratoDraft,
              onDraftChange: setTratoDraft,
              onSend: async () => {
                const err = await trato.comentar(tratoDraft.trim());
                if (!err) setTratoDraft("");
              },
            }
          : undefined
      }
    />
  );
}

/** Canal privado post-venta (HU-05). Lo usa SalaComprador (el comprador
 *  ganador, a pantalla completa) - SalaVendedor consume el mismo canal
 *  directo vía useTrato, sin pasar por este componente (SellerRoom trae
 *  su propia UI para esto). Sin equivalente en lo que generó v0 - se
 *  queda con su UI original. */
function CanalPrivado({
  roomId,
  winnerHandle,
  myHandle,
  finalPrice,
}: {
  roomId: string;
  winnerHandle: string;
  myHandle: string;
  finalPrice: number;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const t = useTrato(roomId, winnerHandle, myHandle);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [t.eventos.length]);

  async function enviar() {
    if (!texto.trim()) return;
    const err = await t.comentar(texto.trim());
    if (err) setError(err); else { setTexto(""); setError(null); }
  }

  return (
    <div className="borde bg-loro text-tinta">
      <div className="border-b-2 border-tinta/20 px-4 py-2 text-center">
        <p className="display text-xl dura">Vendido — S/{finalPrice}</p>
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">
          Canal privado para coordinar la entrega
        </p>
      </div>
      <div ref={feedRef} className="max-h-40 space-y-1 overflow-y-auto px-4 py-2">
        {t.eventos.filter((e) => e.c.t === "chat").length === 0 && (
          <p className="text-center text-xs opacity-60">
            Coordinen aquí Yape, Plin o el punto de entrega.
          </p>
        )}
        {t.eventos.map((e) =>
          e.c.t === "chat" ? (
            <p key={e.id} className="text-sm">
              <span className="font-black">{e.c.handle === myHandle ? "Tú" : e.c.handle}</span> {e.c.body}
            </p>
          ) : null,
        )}
      </div>
      <div className="flex gap-2 border-t-2 border-tinta/20 p-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          placeholder="Escribe para coordinar…"
          className="min-w-0 flex-1 rounded-none border-2 border-tinta bg-papel px-3 py-2 text-sm text-tinta outline-none"
        />
        <button onClick={enviar} className="border-2 border-tinta bg-tinta px-4 text-sm font-black text-amarillo">
          Enviar
        </button>
      </div>
      {error && <p className="px-4 pb-2 text-xs font-bold">{error}</p>}
    </div>
  );
}

