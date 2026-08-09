"use client";

import { useCallback, useMemo } from "react";
import { useChannel } from "@portalsdk/react";
import { canalSala, canalTrato } from "./portal";
import { mask } from "./mask";

/**
 * Contenido del mensaje. `t` es el discriminador y vive DENTRO de `content` a
 * propósito: es el único campo que controlamos end-to-end tanto en las
 * publicaciones del cliente (socket) como en las del servidor (HTTP API).
 */
export type Contenido =
  | { t: "bid"; handle: string; amount: number; district?: string | null }
  | { t: "agent"; action: string; amount: number | null; text: string }
  | { t: "state"; status: string; winner?: string; finalPrice?: number; closesAt?: number }
  | { t: "agent_typing" }
  | { t: "reaction"; emoji: string }
  | { t: "chat"; handle: string; body: string };

export interface EventoUI {
  id: string;
  ts: number;
  senderId: string;
  ephemeral: boolean;
  c: Contenido;
}

export function useSala(roomId: string, handle: string, district: string, role: "buyer" | "seller" = "buyer") {
  const { messages, send, presence, typing, sendTyping, status } =
    useChannel<Contenido>({
      channelId: canalSala(roomId),
      history: 50,
      metadata: { handle, district, role },
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

  // Presencia: `detailed` en salas chicas, `aggregate` en grandes.
  // Se narrowea por `kind`; nunca se asume una sola forma.
  // El vendedor (`?seller=1`) SE CONECTA al mismo canal para controlar el
  // countdown, pero no es un comprador negociando - se filtra por metadata
  // tanto de la lista de avatares como del contador. Si no se filtrara,
  // el vendedor aparecería como un negociante más en su propia sala.
  const participantes = useMemo(() => {
    if (presence?.kind === "detailed") {
      return presence.participants
        .filter((p: any) => p.metadata?.role !== "seller")
        .map((p: any) => ({
          id: String(p.id),
          handle: String(p.metadata?.handle ?? p.username ?? p.id).slice(0, 12),
        }));
    }
    return [];
  }, [presence]);

  // En salas grandes (`aggregate`) Portal solo da un conteo agregado, sin
  // metadata por participante - ahí no se puede filtrar al vendedor del
  // total. Documentado a propósito: en la escala de este hackathon
  // (`detailed`) el conteo real ya sale bien filtrado arriba.
  const cuantos = presence?.kind === "detailed" ? participantes.length : presence?.kind ? presence.count : 1;

  // "El agente está escribiendo": estado efímero que publica quien ofertó.
  // Se apaga solo cuando llega el mensaje del agente.
  const ultimoTyping = useMemo(
    () => eventos.reduce((t, e) => (e.c.t === "agent_typing" ? Math.max(t, e.ts) : t), 0),
    [eventos],
  );
  const ultimoAgente = useMemo(
    () => eventos.reduce((t, e) => (e.c.t === "agent" ? Math.max(t, e.ts) : t), 0),
    [eventos],
  );
  const agenteEscribiendo =
    ultimoTyping > ultimoAgente && Date.now() - ultimoTyping < 8000;

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
      // El monto es dinero: lo valida y lo publica el SERVIDOR.
      // El cliente jamás publica una oferta directo al canal.
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, handle, amount, district }),
      });

      if (res.ok) {
        void send({ ephemeral: true, content: { t: "agent_typing" } });
        return null;
      }

      const j: any = await res.json().catch(() => ({}));
      const errores: Record<string, string> = {
        bad_amount: "Escribe un monto válido.",
        room_closed: "Esta sala ya se cerró.",
        room_not_found: "No encontramos esta sala.",
        server_error: "Algo falló de nuestro lado. Intenta otra vez.",
      };
      return errores[j.error] ?? "No se pudo enviar la oferta.";
    },
    [roomId, handle, district, send],
  );

  const reaccionar = useCallback(
    (emoji: string) => {
      void send({ ephemeral: true, content: { t: "reaction", emoji } });
    },
    [send],
  );

  // Mensaje de texto libre: pasa por el middleware onPublish server-side
  // (portal.config.ts) que enmascara DNI/celular/dirección/tarjeta, PERO
  // Portal pinta un eco optimista en la pantalla del propio remitente con
  // el texto crudo ANTES de que el servidor lo procese - ese eco nunca se
  // corrige con la versión filtrada. Fix: enmascarar acá, cliente, antes
  // de mandar. Así el emisor jamás ve su propio dato sensible en pantalla,
  // y lo que llega al servidor ya viene limpio (el middleware no encuentra
  // nada que tocar - es idempotente sobre texto ya enmascarado).
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
    cuantos,
    agenteEscribiendo,
    escribiendo: typing as readonly string[],
    sendTyping,
    status,
    maximoCanal,
    vendido,
    cierre,
    ofertar,
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
