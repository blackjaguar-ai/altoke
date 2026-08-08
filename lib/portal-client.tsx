"use client";

import { useCallback, useMemo } from "react";
import { useChannel } from "@portalsdk/react";
import { canalSala } from "./portal";

/**
 * Contenido del mensaje. `t` es el discriminador y vive DENTRO de `content` a
 * propósito: es el único campo que controlamos end-to-end tanto en las
 * publicaciones del cliente (socket) como en las del servidor (HTTP API).
 */
export type Contenido =
  | { t: "bid"; handle: string; amount: number; district?: string | null }
  | { t: "agent"; action: string; amount: number | null; text: string }
  | { t: "state"; status: string; winner?: string; finalPrice?: number }
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

export function useSala(roomId: string, handle: string, district: string) {
  const { messages, send, presence, typing, sendTyping, status } =
    useChannel<Contenido>({
      channelId: canalSala(roomId),
      history: 50,
      metadata: { handle, district },
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
  const participantes = useMemo(() => {
    if (presence?.kind === "detailed") {
      return presence.participants.map((p: any) => ({
        id: String(p.id),
        handle: String(p.metadata?.handle ?? p.username ?? p.id).slice(0, 12),
      }));
    }
    return [];
  }, [presence]);

  const cuantos = presence?.kind ? presence.count : 1;

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

  const vendido = useMemo(() => {
    for (let i = eventos.length - 1; i >= 0; i--) {
      const c = eventos[i].c;
      if (c.t === "state" && c.status === "sold")
        return { winner: c.winner, finalPrice: c.finalPrice };
    }
    return null;
  }, [eventos]);

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

  // Mensaje de texto libre: ESTE sí lo publica el cliente, y por eso pasa por
  // el middleware onPublish que enmascara DNI, celular y dirección.
  const comentar = useCallback(
    async (body: string) => {
      try {
        await send({ content: { t: "chat", handle, body } });
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
    ofertar,
    reaccionar,
    comentar,
  };
}
