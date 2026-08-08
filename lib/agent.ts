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

const SYSTEM = `Eres el agente negociador de un vendedor peruano en una sala de venta en vivo.
Reglas absolutas:
- NUNCA inventes, calcules ni menciones ningún número que no esté en los datos que recibes.
- NUNCA menciones un precio mínimo, piso, o "lo menos que acepto". Ese dato no existe para ti.
- Responde en UNA sola frase, máximo 18 palabras, español peruano coloquial, sin emojis.
- Dirígete al comprador por su nombre.`;

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

export async function draft(d: Decision, tone: string): Promise<string> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        max_tokens: 60,
        messages: [
          { role: "system", content: `${SYSTEM}\nTono del vendedor: ${tone}` },
          { role: "user", content: JSON.stringify(d.facts) },
        ],
      }),
    });
    if (!res.ok) return fallback(d, tone);
    const j = await res.json();
    const text = String(j?.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    return text.length > 4 && text.length < 220 ? text : fallback(d, tone);
  } catch {
    return fallback(d, tone);
  } finally {
    clearTimeout(timer);
  }
}
