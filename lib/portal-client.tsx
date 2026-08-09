"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChannel } from "@portalsdk/react";
import { canalSala, canalTrato, canalLobby } from "./portal";
import { mask } from "./mask";

/**
 * Contenido del mensaje. `t` es el discriminador y vive DENTRO de `content` a
 * propósito: es el único campo que controlamos end-to-end tanto en las
 * publicaciones del cliente (socket) como en las del servidor (HTTP API).
 *
 * NOTA — Etapa 1.3: este tipo YA NO incluye "agent_typing" ni "reaction".
 * Ambos se mandaban con `send({ephemeral:true, ...})`, y el SDK de Portal
 * (verificado leyendo @portalsdk/core/dist/index.js) DESCARTA cualquier
 * mensaje entrante marcado ephemeral en su capa de ingest - nunca llegaban
 * a `messages`, ni para el que los mandaba ni para nadie más. No era un bug
 * de esta app: es cómo funciona el SDK. El reemplazo correcto es
 * `sendActivity()` / `activity`, que es un canal de señales aparte (el
 * mismo que ya usa "alguien está escribiendo una oferta").
 */
export type Contenido =
  | { t: "bid"; handle: string; amount: number; district?: string | null }
  | { t: "agent"; action: string; amount: number | null; text: string }
  | { t: "state"; status: string; winner?: string; finalPrice?: number; closesAt?: number }
  | { t: "chat"; handle: string; body: string };

export interface EventoUI {
  id: string;
  ts: number;
  senderId: string;
  ephemeral: boolean;
  c: Contenido;
}

/** Reacción flotante ya resuelta para pintar - propia o de otro, da igual
 *  para el componente que la renderiza. */
export interface ReaccionUI {
  id: string;
  emoji: string;
}

const REACCION_PREFIJO = "reaccion:";
const REACCION_VIDA_MS = 1800;

export type RolSala = "seller" | "bidder" | "spectator";

export function useSala(roomId: string, handle: string, district: string, rolInicial: RolSala = "bidder") {
  const [rol, setRol] = useState<RolSala>(rolInicial);

  const { messages, send, presence, typing, sendTyping, activity, sendActivity, setMetadata, status } =
    useChannel<Contenido>({
      channelId: canalSala(roomId),
      history: 50,
      metadata: { handle, district, role: rolInicial },
    });

  const eventos: EventoUI[] = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        ts: m.timestamp,
        senderId: m.sender.id,
        ephemeral: Boolean(m.ephemeral),
        c: m.content,
      })),
    [messages],
  );

  // Etapa 1.2 — espectador vs ofertante. El vendedor NUNCA cambia de rol
  // acá (su conexión es aparte, ver PanelVendedor). setMetadata reemplaza
  // la metadata de presencia EN VIVO, sin reconectar - el filtro de abajo
  // reacciona solo porque `presence` se re-emite en cada delta.
  const cambiarRol = useCallback(
    (nuevo: "bidder" | "spectator") => {
      if (rolInicial === "seller") return;
      setRol(nuevo);
      setMetadata({ handle, district, role: nuevo });
    },
    [handle, district, rolInicial, setMetadata],
  );

  // Presencia: `detailed` en salas chicas, `aggregate` en grandes.
  // Se narrowea por `kind`; nunca se asume una sola forma.
  const participantes = useMemo(() => {
    if (presence?.kind === "detailed") {
      // El vendedor SE CONECTA al canal (para el countdown/panel), pero no
      // es un negociante ni un espectador de su propia sala - se filtra
      // acá, en la fuente. Bug real visto en vivo: este filtro se perdió
      // en un refactor y el vendedor volvió a aparecer en la lista de
      // avatares, con el conteo desalineado del número de avatares.
      return presence.participants
        .filter((p: any) => p.metadata?.role !== "seller")
        .map((p: any) => ({
          id: String(p.id),
          handle: String(p.metadata?.handle ?? p.username ?? p.id).slice(0, 12),
          role: (p.metadata?.role as RolSala | undefined) ?? "bidder",
        }));
    }
    return [];
  }, [presence]);

  // participantes ya viene sin el vendedor (filtrado arriba). Acá solo se
  // parte en dos: quién puede ofertar y quién solo mira. En salas grandes
  // (`aggregate`) Portal solo da un conteo total sin metadata - ahí no se
  // puede partir en dos, así que todo el agregado cae en "ofertantes"
  // (documentado a propósito; a la escala de este hackathon `detailed` es
  // lo que se usa de verdad).
  const ofertantes = useMemo(
    () => participantes.filter((p) => p.role !== "spectator"),
    [participantes],
  );
  const espectadores = useMemo(
    () => participantes.filter((p) => p.role === "spectator"),
    [participantes],
  );
  const cuantosOfertando =
    presence?.kind === "detailed" ? ofertantes.length : presence?.kind ? presence.count : 1;
  const cuantosMirando = presence?.kind === "detailed" ? espectadores.length : 0;

  // "El agente está escribiendo": derivado de eventos PERSISTENTES reales
  // ("bid" se publica en Fase 1.5, antes del LLM; "agent" se publica en
  // Fase 3, después) - no de una señal aparte. Antes usaba sendActivity()
  // disparado DESPUÉS de que el fetch a /api/bids ya había esperado la
  // respuesta COMPLETA del LLM (bug real visto en vivo: el aviso aparecía
  // recién cuando el agente YA había contestado, al revés de su propósito).
  // Con los timestamps de "bid" y "agent" el timing es exacto por diseño:
  // ambos ya estaban ahí, solo había que compararlos.
  const ultimaOferta = useMemo(
    () => eventos.reduce((t, e) => (e.c.t === "bid" ? Math.max(t, e.ts) : t), 0),
    [eventos],
  );
  const ultimoAgente = useMemo(
    () => eventos.reduce((t, e) => (e.c.t === "agent" ? Math.max(t, e.ts) : t), 0),
    [eventos],
  );
  const agenteEscribiendo = ultimaOferta > ultimoAgente && Date.now() - ultimaOferta < 8000;

  const maximoCanal = useMemo(
    () => eventos.reduce((m, e) => (e.c.t === "bid" ? Math.max(m, e.c.amount) : m), 0),
    [eventos],
  );

  // Un solo escaneo hacia atrás por el ÚLTIMO evento "state": es la fuente
  // de verdad del estado actual (open -> closing -> sold, o closing -> open
  // si nadie ofertó a tiempo). Escanear así evita que un "closing" viejo
  // sobreviva visualmente después de un "sold" más reciente.
  const estadoSala = useMemo(() => {
    for (let i = eventos.length - 1; i >= 0; i--) {
      const c = eventos[i].c;
      if (c.t === "state") return c;
    }
    return null;
  }, [eventos]);

  const vendido = useMemo(
    () =>
      estadoSala?.status === "sold"
        ? { winner: estadoSala.winner, finalPrice: estadoSala.finalPrice }
        : null,
    [estadoSala],
  );

  // Countdown de cierre (HU-06). closesAt es un epoch ms server-truth: todas
  // las pantallas calculan el mismo restante desde el mismo número, así que
  // queda sincronizado sin necesitar un reloj compartido por socket.
  const cierre = useMemo(
    () =>
      estadoSala?.status === "closing" && estadoSala.closesAt
        ? { closesAt: estadoSala.closesAt }
        : null,
    [estadoSala],
  );

  const ofertar = useCallback(
    async (amount: number): Promise<string | null> => {
      if (rol === "spectator") return "Estás en modo espectador. Cambia a ofertante para participar.";

      // Un nonce nuevo POR CLICK, no por sesión. Reenvío de red de esta
      // misma request (mismo nonce) => el servidor lo dedupea en silencio,
      // como debe ser. Un click nuevo del comprador, aunque sea el mismo
      // monto, es una oferta nueva y debe llegar hasta el agente - antes se
      // perdía sin aviso (bug real, prueba HU-02).
      const clientNonce =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // El monto es dinero: lo valida y lo publica el SERVIDOR.
      // El cliente jamás publica una oferta directo al canal.
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, handle, amount, district, clientNonce }),
      });

      if (res.ok) {
        return null;
      }

      const j: any = await res.json().catch(() => ({}));
      if (j.error === "rate_limited") {
        const s = Math.ceil((Number(j.retryMs) || 0) / 1000);
        return `Espera ${s}s antes de volver a ofertar.`;
      }
      if (j.error === "increment_bajo") {
        return `Sube al menos a S/${j.minRequired} para superar la oferta actual.`;
      }
      const errores: Record<string, string> = {
        bad_amount: "Escribe un monto válido.",
        room_closed: "Esta sala ya se cerró.",
        room_not_found: "No encontramos esta sala.",
        missing_nonce: "Algo falló al enviar tu oferta. Intenta otra vez.",
        server_error: "Algo falló de nuestro lado. Intenta otra vez.",
      };
      return errores[j.error] ?? "No se pudo enviar la oferta.";
    },
    [roomId, handle, district, rol],
  );

  // ============================================================
  // Etapa 1.3 — reacciones reales, sobre `activity` en vez de `send`.
  // `sendActivity` NUNCA nos devuelve nuestro propio evento (activity
  // "never self" por diseño del SDK), así que el emisor se pinta su propio
  // globo LOCAL Y OPTIMISTA al instante - no espera ida y vuelta. Los demás
  // lo reciben vía `activity` y se detecta por diff contra lo ya visto.
  // ============================================================
  const [reacciones, setReacciones] = useState<ReaccionUI[]>([]);
  const vistas = useRef<Set<string>>(new Set());

  const soltar = useCallback((id: string) => {
    setTimeout(() => setReacciones((prev) => prev.filter((r) => r.id !== id)), REACCION_VIDA_MS);
  }, []);

  useEffect(() => {
    for (const a of activity) {
      if (!a.kind.startsWith(REACCION_PREFIJO)) continue;
      const key = `${a.userId}:${a.kind}:${a.since}`;
      if (vistas.current.has(key)) continue;
      vistas.current.add(key);
      const emoji = a.kind.slice(REACCION_PREFIJO.length);
      const id = `r-${key}`;
      setReacciones((prev) => [...prev, { id, emoji }]);
      soltar(id);
    }
  }, [activity, soltar]);

  const reaccionar = useCallback(
    (emoji: string) => {
      // sendActivity tiene throttle de 3s POR KIND EXACTO (mismo emoji,
      // mismo usuario) del lado del SDK - si alguien clickea el mismo
      // emoji cinco veces seguidas, solo la primera sale por el socket.
      // El burst local igual se pinta siempre: es feedback inmediato al
      // que hace click, no depende de si el broadcast se cortó.
      sendActivity(`${REACCION_PREFIJO}${emoji}`);
      const id = `own-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setReacciones((prev) => [...prev, { id, emoji }]);
      soltar(id);
    },
    [sendActivity, soltar],
  );

  // Mensaje de texto libre: pasa por el middleware onPublish server-side
  // (portal.config.ts) que enmascara DNI/celular/dirección/tarjeta y ahora
  // también chequea baneo por 3 strikes (Etapa 1.4), PERO Portal pinta un
  // eco optimista en la pantalla del propio remitente con el texto crudo
  // ANTES de que el servidor lo procese - ese eco nunca se corrige con la
  // versión filtrada. Fix: enmascarar acá, cliente, antes de mandar. Así el
  // emisor jamás ve su propio dato sensible en pantalla, y lo que llega al
  // servidor ya viene limpio (el middleware no encuentra nada que tocar -
  // es idempotente sobre texto ya enmascarado).
  const comentar = useCallback(
    async (body: string) => {
      try {
        await send({ content: { t: "chat", handle, body: mask(body).text } });
        return null;
      } catch (e: any) {
        return e?.reason ?? "No se pudo enviar el mensaje.";
      }
    },
    [send, handle],
  );

  return {
    eventos,
    participantes,
    ofertantes,
    espectadores,
    cuantos: cuantosOfertando,
    cuantosMirando,
    rol,
    cambiarRol,
    agenteEscribiendo,
    escribiendo: typing as readonly string[],
    sendTyping,
    status,
    maximoCanal,
    vendido,
    cierre,
    ofertar,
    reacciones,
    reaccionar,
    comentar,
  };
}

/**
 * Canal privado post-cierre (HU-05). Se monta SOLO cuando ya hay ganador -
 * el componente que llama esto no debe renderizarse antes de que la venta
 * se cierre, porque `winnerHandle` vacío produciría un channelId inválido.
 * Mismo patrón `trato-*` que ya cubre portal.config.ts con moderación de
 * datos sensibles (HU-09) - coordinar Yape/Plin aquí pasa por el mismo
 * middleware que enmascara DNI/celular/dirección.
 */
export function useTrato(roomId: string, winnerHandle: string, myHandle: string) {
  const { messages, send, status } = useChannel<Contenido>({
    channelId: canalTrato(roomId, winnerHandle),
    history: 50,
    metadata: { handle: myHandle },
  });

  const eventos: EventoUI[] = useMemo(
    () =>
      messages.map((m) => ({
        id: m.id,
        ts: m.timestamp,
        senderId: m.sender.id,
        ephemeral: Boolean(m.ephemeral),
        c: m.content,
      })),
    [messages],
  );

  // Canal PRIVADO: a propósito NO se enmascara acá. HU-09 es explícito -
  // "los datos se liberan SOLO en el canal privado post-cierre". Enmascarar
  // acá también dejaría el chat de coordinación de entrega inservible: nadie
  // podría pegar su Yape ni su celular. (Ver fix en portal.config.ts: el
  // middleware protegerDatos ya NO corre sobre `trato-*`.)
  const comentar = useCallback(
    async (body: string) => {
      try {
        await send({ content: { t: "chat", handle: myHandle, body } });
        return null;
      } catch (e: any) {
        return e?.reason ?? "No se pudo enviar el mensaje.";
      }
    },
    [send, myHandle],
  );

  return { eventos, comentar, status };
}

/**
 * Etapa 1.1 — estado de salas en tiempo real para el HOME. Un solo canal
 * global (`lobby`), donde SOLO el backend publica (HTTP, persistente,
 * nunca ephemeral - por eso no pisa el bug de la sección de arriba).
 * `history: "none"`: el home ya trae el estado inicial por SSR: este canal
 * solo aporta los DIFFS que ocurren mientras la pestaña está abierta.
 */
export interface EventoLobby {
  t: "room_state";
  roomId: string;
  status: "open" | "closing" | "sold";
  highestBid?: number;
  closesAt?: number | null;
  finalPrice?: number;
}

export function useLobby() {
  const { messages } = useChannel<EventoLobby>({
    channelId: canalLobby(),
    history: "none",
  });

  return useMemo(
    () => messages.filter((m) => m.content?.t === "room_state").map((m) => m.content),
    [messages],
  );
}
