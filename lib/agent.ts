/**
 * CAPA LLM — SOLO REDACTA.
 * El número ya viene decidido por lib/pricing.ts. Aquí no se calcula nada.
 * Si el LLM falla o tarda, hay fallback determinístico: la demo no se cae.
 */
import type { Decision } from "./pricing";

const BASE = process.env.LLM_BASE_URL!;
const KEY = process.env.LLM_API_KEY!;
const MODEL = process.env.LLM_MODEL!;
const TIMEOUT_MS = 2500;

/** Lo único de presentación que el LLM necesita para sonar como un
 *  vendedor real y no un script genérico. Nunca toca pricing.ts: esto es
 *  contexto de qué se vende, no una decisión de precio. */
export interface Producto {
  name: string;
  desc: string | null;
}

const SYSTEM = `Eres el agente negociador de un vendedor peruano en una sala de venta en vivo.
Vendes un producto REAL, no genérico - usa su nombre y descripción para que la
respuesta suene hecha a la medida de ESE producto, no intercambiable con
cualquier otro artículo.

Reglas absolutas:
- NUNCA inventes, calcules ni menciones ningún número que no esté en los datos que recibes.
- NUNCA menciones un precio mínimo, piso, o "lo menos que acepto". Ese dato no existe para ti.
- Responde en 1-2 frases, máximo 30 palabras, español peruano coloquial, sin emojis.
- Dirígete al comprador por su nombre.
- VARÍA el recurso según la situación - no repitas la misma fórmula
  ("Te la dejo en X, es buen precio") en cada respuesta, eso es lo que suena
  a script y no a negociador real. Alterna entre: una pregunta retórica
  ("¿quién da más por esto?"), una imagen concreta del producto en la vida
  del comprador ("imagínatela ya en tu casa este fin de semana"), urgencia
  genuina si quedan pocos segundos, o simple firmeza si la oferta es baja.
- Si hay descripción del producto, apóyate en UN detalle concreto de ella
  cuando aporte al argumento - nunca la repitas entera, nunca inventes
  características que no están ahí.
- Si los datos traen su distrito, puedes usarlo como argumento de cierre cuando aporte
  (ej: "acepta, para qué te mueves de Surco por 20 soles"). Nunca inventes distancias
  ni compares con otro comprador si no tienes ese dato.`;

function fallback(d: Decision, tone: string): string {
  const h = d.facts.buyerHandle;
  switch (d.action) {
    case "accept":
      return `Trato hecho, ${h}. S/${d.amount} y es tuya.`;
    case "outbid":
      return `${h}, ya hay una oferta de S/${d.facts.highestBid}. Tienes que subir.`;
    case "counter":
      return d.facts.isLowball
        ? `${h}, esa oferta no camina. S/${d.amount} y cerramos.`
        : `Te la dejo en S/${d.amount}, ${h}. Es buen precio.`;
    default:
      return `${h}, sigo escuchando ofertas.`;
  }
}

export async function draft(d: Decision, tone: string, producto?: Producto): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  // Contexto del producto va en el SYSTEM (es estable para toda la sala,
  // no cambia oferta a oferta) - d.facts sigue siendo lo único que va en
  // el turno "user", auditado y sin floorPrice, sin tocar ese contrato.
  const contextoProducto = producto
    ? `\n\nProducto en venta: "${producto.name}".${producto.desc ? ` Descripción: ${producto.desc}` : ""}`
    : "";
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 90,
        messages: [
          { role: "system", content: `${SYSTEM}\nTono del vendedor: ${tone}${contextoProducto}` },
          { role: "user", content: JSON.stringify(d.facts) },
        ],
      }),
    });
    if (!res.ok) return fallback(d, tone);
    const j = await res.json();
    const text = String(j?.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    return text.length > 4 && text.length < 260 ? text : fallback(d, tone);
  } catch {
    return fallback(d, tone);
  } finally {
    clearTimeout(timer);
  }
}
