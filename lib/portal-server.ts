/**
 * LA VOZ DEL AGENTE — publicación server-side por HTTP.
 * ------------------------------------------------------------------
 * Contrato (Wire protocol → HTTP surface):
 *   POST {PORTAL_API_URL}/v1/channels/{channelId}/messages
 *   Authorization: Bearer <credencial>
 *   body: { senderId, kind, content }
 *   200 -> { id, seq, timestamp }
 *
 * Confirmado empiricamente (npm run portal:smoke): la ruta exige senderId
 * en el body y SOLO Authorization: Bearer sk_... en headers. Nada de
 * x-portal-key aqui - eso es para la publishable key desde el browser.
 *
 * La secret key (sk_) es server-only. Este archivo nunca se importa desde un
 * componente cliente.
 */

import type { Contenido } from "./portal-client";

const API = process.env.PORTAL_API_URL ?? "https://api.useportal.co";
const SECRET = process.env.PORTAL_SECRET_KEY!;

export interface AckPublicacion {
  id: string;
  seq: number | null;
  timestamp: number;
}

// La identidad fija del agente en el canal. No hace falta que "exista" de
// antemano - el control plane la crea al primer mensaje.
const AGENT_SENDER_ID = "agent-vendedor";

export async function publicar(
  channelId: string,
  content: Contenido,
): Promise<AckPublicacion | null> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${API}/v1/channels/${encodeURIComponent(channelId)}/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify({
        senderId: AGENT_SENDER_ID,
        kind: content.t,
        content,
      }),
    });

    if (!res.ok) {
      const cuerpo = await res.text().catch(() => "");
      console.error(`[portal] publicar ${content.t} -> ${res.status} ${cuerpo}`);
      return null;
    }
    return (await res.json()) as AckPublicacion;
  } catch (e) {
    // Nunca tumbes la request del comprador porque el publish falló.
    console.error("[portal] publicar excepcion", e);
    return null;
  } finally {
    console.log(`[portal] publicar ${content.t} ${Date.now() - t0}ms`);
  }
}

export const canalSala = (roomId: string) => `sala-${roomId}`;
export const canalTrato = (roomId: string, handle: string) =>
  `trato-${roomId}-${handle.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
