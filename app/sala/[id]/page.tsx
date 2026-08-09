"use client";

import { use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSala, useTrato, type EventoUI } from "@/lib/portal-client";

const DISTRITOS = ["Surco", "Miraflores", "San Juan de Lurigancho", "Comas", "Callao", "Ate", "Los Olivos"];
const EMOJIS = ["🔥", "😱", "💸", "👏"];

interface RoomPublic {
  id: string;
  product_name: string;
  product_desc: string | null;
  photo_url: string | null;
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
  if (esVendedor) return <Sala id={id} handle="Vendedor" distrito="" esVendedor />;

  if (!entrado)
    return (
      <Entrada
        handle={handle} setHandle={setHandle}
        distrito={distrito} setDistrito={setDistrito}
        onEntrar={() => { localStorage.setItem("altoke.handle", handle.trim()); setEntrado(true); }}
      />
    );
  return <Sala id={id} handle={handle.trim()} distrito={distrito} esVendedor={false} />;
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

function Sala({ id, handle, distrito, esVendedor }: { id: string; handle: string; distrito: string; esVendedor: boolean }) {
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [monto, setMonto] = useState("");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const s = useSala(id, handle, distrito, esVendedor ? "seller" : "buyer");

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
  const persistentes = s.eventos.filter((e) => !e.ephemeral && e.c.t !== "agent_typing");
  const reacciones = s.eventos.filter((e) => e.c.t === "reaction" && Date.now() - e.ts < 2500);

  // Quién puede ver el canal privado (HU-05): el vendedor siempre, y el
  // comprador SOLO si su handle coincide con el que ganó. Nadie más - ni
  // siquiera otro comprador que perdió la puja puede espiar la coordinación.
  const ganadorHandle = vendido?.winner;
  const soyGanador = !esVendedor && Boolean(ganadorHandle) && handle === ganadorHandle;

  // Countdown de cierre: el canal en vivo (s.cierre) manda; si alguien recién
  // entró y el historial de 50 mensajes no alcanzó a traer el anuncio, el
  // poll de /api/rooms cubre el hueco. Mismo epoch ms en ambos casos - el
  // countdown no se desincroniza aunque cambie la fuente.
  const closesAt =
    !vendido &&
    (s.cierre?.closesAt ?? (room.status === "closing" && room.closes_at ? new Date(room.closes_at).getTime() : null));

  async function ofertar() {
    const n = Math.floor(Number(monto));
    if (!Number.isFinite(n) || n <= 0) return setError("Escribe un monto válido.");
    setEnviando(true); setError(null);
    const err = await s.ofertar(n);
    setEnviando(false);
    if (err) setError(err); else setMonto("");
  }

  async function comentar() {
    if (!texto.trim()) return;
    const err = await s.comentar(texto.trim());
    if (err) setError(err); else setTexto("");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="border-b-4 border-amarillo p-4">
        <div className="flex items-center gap-3">
          {room.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={room.photo_url} alt={room.product_name} className="borde h-20 w-20 object-cover" />
          )}
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

        {esVendedor && !vendido && (
          <PanelVendedor roomId={id} status={room.status} />
        )}

        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${s.status === "ready" ? "bg-loro" : "bg-naranja"}`} />
          <span className="font-bold text-papel/70">{s.cuantos} negociando ahora</span>
          <div className="ml-auto flex -space-x-2">
            {s.participantes.slice(0, 6).map((p) => (
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
          {reacciones.map((e) => (
            <span key={e.id} className="reaccion text-4xl">
              {e.c.t === "reaction" ? e.c.emoji : ""}
            </span>
          ))}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t-4 border-amarillo bg-tinta p-3">
        {vendido ? (
          ganadorHandle && (soyGanador || esVendedor) ? (
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
        ) : esVendedor ? (
          <p className="text-center text-xs font-bold uppercase tracking-widest text-papel/50">
            Vista de vendedor — el agente negocia por ti
          </p>
        ) : (
          <>
            <div className="mb-2 flex gap-2">
              {EMOJIS.map((x) => (
                <button key={x} onClick={() => s.reaccionar(x)} aria-label={`Reaccionar ${x}`}
                  className="borde bg-papel/10 px-3 py-1 text-xl">{x}</button>
              ))}
              <input
                value={texto}
                onChange={(e) => { setTexto(e.target.value); s.sendTyping(); }}
                onKeyDown={(e) => e.key === "Enter" && comentar()}
                placeholder="Escribe algo…"
                className="borde min-w-0 flex-1 bg-papel/10 px-3 py-1 text-sm outline-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="borde flex flex-1 items-center bg-papel px-3">
                <span className="display text-xl text-tinta/50">S/</span>
                <input
                  inputMode="numeric" value={monto}
                  onChange={(e) => { setMonto(e.target.value.replace(/\D/g, "")); s.sendTyping(); }}
                  onKeyDown={(e) => e.key === "Enter" && ofertar()}
                  placeholder={String(Math.max(maximo + 20, Math.round(lista * 0.6)))}
                  className="w-full bg-transparent px-2 py-3 text-2xl font-black text-tinta outline-none"
                />
              </div>
              <button onClick={ofertar} disabled={enviando}
                className="borde bg-fucsia px-5 display text-xl text-tinta disabled:opacity-50">
                {enviando ? "…" : "Ofertar"}
              </button>
            </div>
            {error && <p className="mt-2 text-sm font-bold text-fucsia">{error}</p>}
          </>
        )}
      </footer>
    </main>
  );
}

/** SIGNATURE: el termómetro. La tesis del producto hecha píxeles.
 *  El piso NO está en la escala: no existe para el cliente. */
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

/** Countdown de cierre (HU-06). Sincronizado en todas las pantallas porque
 *  todas leen el mismo `closesAt` (epoch ms, server-truth) - no hay reloj
 *  compartido por socket, solo aritmética contra el reloj de cada cliente. */
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
    // Cualquier pestaña conectada puede disparar esto - es idempotente en
    // el servidor (WHERE status = 'closing' AND closes_at <= now()), así
    // que no importa si 10 clientes lo llaman al mismo segundo.
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

/** Canal privado post-venta (HU-05). Solo lo montan el vendedor y el
 *  comprador ganador - nadie más puede construir este channelId sin conocer
 *  el handle exacto del ganador, y el middleware `trato-*` en
 *  portal.config.ts enmascara igual que la sala pública si alguien pega un
 *  celular o DNI para coordinar Yape/Plin. */
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

/** Control del vendedor. No requiere que el vendedor esté conectado al canal
 *  (HU-10): es un disparo puntual, el agente toma la voz desde el servidor.
 *  Acceso por `?seller=1` a propósito - Clerk para vendedores sigue en
 *  colchón (F6); esto desbloquea la demo sin bloquear en auth. */
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
        {/* 300s (5min) es el ritmo real de cierre, tipo Binance P2P. Los
           cortos (15s/60s) quedan para controlar el timing dramático en
           vivo durante la demo, no para uso normal de producto. */}
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
