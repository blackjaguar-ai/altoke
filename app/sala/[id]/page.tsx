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

const DISTRITOS = ["Surco", "Miraflores", "San Juan de Lurigancho", "Comas", "Callao", "Ate", "Los Olivos"];
const EMOJIS = ["🔥", "😱", "💸", "👏"];
// Único fallback cuando una sala no tiene ni room_photos ni photo_url -
// Room.photoUrl en el componente de v0 es obligatorio (string, no
// string|null), así que necesita algo que renderizar sí o sí.
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
    photoUrl: room.photos[0] ?? FOTO_VACIA,
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
 * VENDEDOR — se queda con la UI original ("afiche chicha"). No hay
 * panel de vendedor en lo que generó v0 (el brief nunca lo pidió),
 * así que no hay razón para tocar esto ni riesgo que correr acá.
 * ============================================================
 */
function SalaVendedor({ id }: { id: string }) {
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const handle = "Vendedor";

  const s = useSala(id, handle, "", "seller");

  useEffect(() => {
    const cargar = () => fetch(`/api/rooms/${id}`).then((r) => r.json()).then(setRoom).catch(() => {});
    cargar();
    const t = setInterval(cargar, 15000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 1e9, behavior: "smooth" });
  }, [s.eventos.length, s.agenteEscribiendo]);

  if (!room) return <main className="p-8 display text-2xl text-amarillo">Cargando sala…</main>;

  const lista = Number(room.list_price);
  const maximo = Math.max(s.maximoCanal, Number(room.highest_bid));
  const vendido =
    s.vendido ??
    (room.status === "sold"
      ? { finalPrice: Number(room.final_price), winner: room.winner_handle ?? undefined }
      : null);
  const persistentes = s.eventos;
  const ganadorHandle = vendido?.winner;

  const closesAt =
    !vendido &&
    (s.cierre?.closesAt ?? (room.status === "closing" && room.closes_at ? new Date(room.closes_at).getTime() : null));

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="border-b-4 border-amarillo p-4">
        {room.photos.length > 0 && <Carrusel fotos={room.photos} alt={room.product_name} />}
        <div className="mt-3 flex items-center gap-3">
          <div className="min-w-0">
            <h1 className="display truncate text-2xl text-amarillo dura">{room.product_name}</h1>
            <p className="truncate text-xs text-papel/60">{room.product_desc}</p>
          </div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-papel/50">Mejor oferta</div>
            <div className="display text-4xl text-loro dura">S/{maximo || "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-bold uppercase tracking-widest text-papel/50">Precio de lista</div>
            <div className="display text-2xl text-papel/70">S/{lista}</div>
          </div>
        </div>

        <Termometro maximo={maximo} lista={lista} />

        {closesAt && <Countdown closesAt={closesAt} roomId={id} />}

        {!vendido && <PanelVendedor roomId={id} status={room.status} />}

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${s.status === "ready" ? "bg-loro" : "bg-naranja"}`} />
          <span className="font-bold text-papel/70">
            {s.cuantos} negociando{s.cuantosMirando > 0 ? ` · ${s.cuantosMirando} mirando` : ""}
          </span>
          <div className="ml-auto flex -space-x-2">
            {s.ofertantes.slice(0, 6).map((p) => (
              <span key={p.id} title={p.handle}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-tinta bg-fucsia text-[11px] font-black text-tinta">
                {p.handle.slice(0, 2).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div ref={feedRef} className="relative flex-1 space-y-2 overflow-y-auto p-4">
        {persistentes.length === 0 && (
          <p className="display text-center text-lg text-papel/40">Nadie ha ofertado.<br />Sé el primero.</p>
        )}
        {persistentes.map((e) => <Linea key={e.id} e={e} yo={handle} />)}

        {s.escribiendo.length > 0 && (
          <p className="text-xs font-bold uppercase tracking-widest text-papel/50">
            alguien está escribiendo una oferta…
          </p>
        )}
        {s.agenteEscribiendo && (
          <div className="borde inline-flex items-center gap-1 bg-amarillo px-3 py-2 text-tinta">
            <span className="text-xs font-black uppercase">El agente responde</span>
            <span className="punto">•</span><span className="punto">•</span><span className="punto">•</span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-4">
          {s.reacciones.map((r) => (
            <span key={r.id} className="reaccion text-4xl">
              {r.emoji}
            </span>
          ))}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t-4 border-amarillo bg-tinta p-3">
        {vendido ? (
          ganadorHandle ? (
            <CanalPrivado
              roomId={id}
              winnerHandle={ganadorHandle}
              myHandle={handle}
              finalPrice={vendido.finalPrice ?? maximo}
            />
          ) : (
            <div className="borde bg-loro px-4 py-4 text-center display text-2xl text-tinta">
              Vendido — S/{vendido.finalPrice ?? maximo}
            </div>
          )
        ) : (
          <p className="text-center text-xs font-bold uppercase tracking-widest text-papel/50">
            Vista de vendedor — el agente negocia por ti
          </p>
        )}
      </footer>
    </main>
  );
}

/** SIGNATURE: el termómetro. La tesis del producto hecha píxeles.
 *  El piso NO está en la escala: no existe para el cliente.
 *  Solo lo usa SalaVendedor - SalaComprador usa el termómetro que ya
 *  trae integrado el componente de v0. */
function Termometro({ maximo, lista }: { maximo: number; lista: number }) {
  const pct = lista > 0 ? Math.min(100, (maximo / lista) * 100) : 0;
  return (
    <div className="mt-3">
      <div className="borde relative h-6 overflow-hidden bg-papel/15">
        <div className="h-full bg-gradient-to-r from-naranja via-fucsia to-loro transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }} />
        <div className="absolute top-0 h-full w-1 bg-tinta transition-[left] duration-700 ease-out"
          style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-bold uppercase tracking-widest text-papel/40">
        <span>Arranque</span>
        <span>{Math.round(pct)}% del precio de lista</span>
      </div>
    </div>
  );
}

/** Carrusel simple: botones prev/next + puntos. Solo lo usa SalaVendedor -
 *  SalaComprador usa la foto única que ya maneja el componente de v0
 *  (ver nota en la Etapa "subir producto": el carrusel multi-foto todavía
 *  no tiene equivalente en el diseño nuevo, pendiente si se quiere). */
function Carrusel({ fotos, alt }: { fotos: string[]; alt: string }) {
  const [i, setI] = useState(0);
  const actual = Math.min(i, fotos.length - 1);

  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fotos[actual]} alt={alt} className="borde h-48 w-full object-cover" />
      {fotos.length > 1 && (
        <>
          <button
            onClick={() => setI((n) => (n - 1 + fotos.length) % fotos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-tinta/70 text-papel"
            aria-label="Foto anterior"
          >
            ‹
          </button>
          <button
            onClick={() => setI((n) => (n + 1) % fotos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-8 w-8 place-items-center rounded-full bg-tinta/70 text-papel"
            aria-label="Foto siguiente"
          >
            ›
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {fotos.map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 w-1.5 rounded-full ${idx === actual ? "bg-amarillo" : "bg-papel/40"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Countdown de cierre (HU-06). Solo lo usa SalaVendedor - SalaComprador
 *  usa el countdown que ya trae integrado el componente de v0 (mismo
 *  cálculo, closesAt server-truth). */
function Countdown({ closesAt, roomId }: { closesAt: number; roomId: string }) {
  const [restanteMs, setRestanteMs] = useState(() => closesAt - Date.now());
  const disparado = useRef(false);

  useEffect(() => {
    disparado.current = false;
    const t = setInterval(() => setRestanteMs(closesAt - Date.now()), 250);
    return () => clearInterval(t);
  }, [closesAt]);

  useEffect(() => {
    if (restanteMs > 0 || disparado.current) return;
    disparado.current = true;
    fetch(`/api/rooms/${roomId}/resolve`, { method: "POST" }).catch(() => {});
  }, [restanteMs, roomId]);

  const segundos = Math.max(0, Math.ceil(restanteMs / 1000));
  const urgente = segundos <= 10;

  return (
    <div
      className={`borde mt-3 flex items-center justify-between px-4 py-2 ${urgente ? "bg-fucsia" : "bg-naranja"} text-tinta`}
    >
      <span className="text-xs font-black uppercase tracking-widest">
        {segundos > 0 ? "Cierra en" : "Cerrando…"}
      </span>
      <span className={`display text-3xl dura ${urgente ? "animate-pulse" : ""}`}>
        {String(Math.floor(segundos / 60)).padStart(2, "0")}:{String(segundos % 60).padStart(2, "0")}
      </span>
    </div>
  );
}

/** Canal privado post-venta (HU-05). Compartido entre SalaVendedor y
 *  SalaComprador (solo el ganador). Sin equivalente en el componente de
 *  v0 - se queda con su UI original a propósito. */
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

/** Control del vendedor (HU-10). Sin equivalente en el componente de v0 -
 *  se queda con su UI original. */
function PanelVendedor({ roomId, status }: { roomId: string; status: string }) {
  const [enviando, setEnviando] = useState<number | null>(null);

  async function anunciarCierre(seconds: number) {
    setEnviando(seconds);
    try {
      await fetch(`/api/rooms/${roomId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      });
    } finally {
      setEnviando(null);
    }
  }

  if (status !== "open") return null;

  return (
    <div className="borde mt-3 flex items-center gap-2 bg-tinta px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-widest text-amarillo">Panel vendedor</span>
      <div className="ml-auto flex gap-1">
        {[300, 60, 15].map((s) => (
          <button
            key={s}
            disabled={enviando !== null}
            onClick={() => anunciarCierre(s)}
            className="borde bg-amarillo px-2 py-1 text-xs font-black text-tinta disabled:opacity-40"
          >
            {enviando === s ? "…" : s >= 60 && s % 60 === 0 ? `Cerrar ${s / 60}min` : `Cerrar ${s}s`}
          </button>
        ))}
      </div>
    </div>
  );
}

function Linea({ e, yo }: { e: EventoUI; yo: string }) {
  const c = e.c;
  if (c.t === "bid") {
    const mio = c.handle === yo;
    return (
      <div className={`ticket borde flex items-center gap-2 px-3 py-2 ${mio ? "bg-amarillo text-tinta" : "bg-papel/10"}`}>
        <span className="font-black">{c.handle}</span>
        {c.district && <span className="text-[10px] uppercase opacity-60">{c.district}</span>}
        <span className="ml-auto display text-xl">S/{c.amount}</span>
      </div>
    );
  }
  if (c.t === "agent") {
    const cerrado = c.action === "accept";
    return (
      <div className={`ticket borde px-3 py-3 ${cerrado ? "bg-loro" : "bg-fucsia"} text-tinta`}>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-70">Agente del vendedor</div>
        <p className="text-lg font-bold leading-snug">{c.text}</p>
      </div>
    );
  }
  if (c.t === "chat") {
    return (
      <p className="px-1 text-sm text-papel/70">
        <span className="font-black text-papel">{c.handle}</span> {c.body}
      </p>
    );
  }
  if (c.t === "state" && c.status === "sold") {
    return (
      <div className="borde bg-loro px-3 py-3 text-center display text-xl text-tinta">
        Vendido a {c.winner} — S/{c.finalPrice}
      </div>
    );
  }
  return null;
}
