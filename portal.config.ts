/**
 * Configuración de Portal — se despliega con `npx @portalsdk/cli deploy`.
 * Requiere PORTAL_SECRET exportado.
 *
 * Aquí vive la capa de moderación (HU-09). Solo regex: cero estado, cero LLM,
 * cero debugging complejo a las 3am. El agente vive en el VPS, no aquí.
 */
import { defineConfig, defineMiddleware, allow, block, mask, env } from "@portalsdk/config";

interface Contenido {
  t: string;
  body?: string;
  handle?: string;
  [k: string]: unknown;
}

/** Mismas reglas que lib/mask.ts. Duplicadas a propósito: el middleware se
 *  despliega al edge de Portal y no puede importar del bundle de Next. */
const REGLAS: { re: RegExp; mask: string }[] = [
  { re: /\b\d{8}\b/g, mask: "[DNI oculto]" },
  { re: /\b(10|20)\d{9}\b/g, mask: "[RUC oculto]" },
  { re: /(\+?51[\s-]?)?9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, mask: "[celular oculto]" },
  { re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/g, mask: "[correo oculto]" },
  {
    re: /\b(av\.?|avenida|jr\.?|jiron|jirón|calle|mz\.?|lote|urb\.?)\s+[\wáéíóúñ.\s]{3,30}/gi,
    mask: "[dirección oculta]",
  },
  { re: /\b(?:\d[ -]?){13,16}\b/g, mask: "[tarjeta oculta]" },
];

const OFENSIVAS =
  /\b(conchatumadre|ctm|mierda|puta|huev[oó]n|carajo|imb[eé]cil|est[uú]pido)\b/gi;

// ============================================================
// ETAPA 1.4 — TRES STRIKES. El middleware sigue siendo "cero LLM", pero deja
// de ser "cero estado" a propósito: contar strikes ES estado, y Postgres en
// el VPS es el lugar correcto para tenerlo, no el edge. Dos llamadas HTTP
// cortas hacia nuestro propio backend:
//   - chequearBaneo(): AWAITED, antes de decidir. Si el backend no responde
//     en 800ms, FAIL-OPEN (allow) - un blip de nuestro VPS no debe tumbar
//     el chat de toda la sala. Preferible dejar pasar un mensaje ofensivo
//     ocasional a romper la demo completa por una excepción de red.
//   - registrarStrike(): vía ctx.notify(), fire-and-forget, DESPUÉS de que
//     el mensaje ya se entregó. Nunca bloquea al remitente actual.
// ============================================================
const APP_BASE = "https://altoke.blackjaguar.dev";
const MOD_TIMEOUT_MS = 800;

async function chequearBaneo(roomId: string, handle: string): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), MOD_TIMEOUT_MS);
  try {
    const res = await fetch(`${APP_BASE}/api/moderation/check`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "content-type": "application/json",
        "x-altoke-mod-secret": env("MODERATION_WEBHOOK_SECRET"),
      },
      body: JSON.stringify({ roomId, handle }),
    });
    if (!res.ok) return false; // fail-open
    const j = (await res.json()) as { banned?: boolean };
    return j.banned === true;
  } catch {
    return false; // timeout o red caída - fail-open, no tumbes la sala
  } finally {
    clearTimeout(timer);
  }
}

function registrarStrike(roomId: string, handle: string): Promise<unknown> {
  return fetch(`${APP_BASE}/api/moderation/strike`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-altoke-mod-secret": env("MODERATION_WEBHOOK_SECRET"),
    },
    body: JSON.stringify({ roomId, handle }),
  }).catch(() => {}); // notify() ya loguea fallas por su cuenta - no relanzar
}

const protegerDatos = defineMiddleware<Contenido>("publish", async (ctx) => {
  const c = ctx.message.content;
  if (c?.t !== "chat" || typeof c.body !== "string") return allow();

  const handle = String(c.handle ?? "").slice(0, 24);
  // "sala-{roomId}" -> roomId. ctx.channel.id es el canal concreto, no la
  // plantilla, así que esto siempre trae el id real.
  const roomId = ctx.channel.id.replace(/^sala-/, "");

  if (handle && (await chequearBaneo(roomId, handle))) {
    return block("Fuiste retirado de esta sala por lenguaje ofensivo repetido.");
  }

  let texto = c.body;
  let tocado = false;
  let fueOfensiva = false;
  for (const r of REGLAS) {
    if (new RegExp(r.re.source, r.re.flags).test(texto)) {
      texto = texto.replace(new RegExp(r.re.source, r.re.flags), r.mask);
      tocado = true;
    }
  }
  if (OFENSIVAS.test(texto)) {
    texto = texto.replace(OFENSIVAS, "***");
    tocado = true;
    fueOfensiva = true;
  }

  // Solo palabras ofensivas amonestan. Enmascarar un DNI que alguien pegó
  // sin querer es un descuido, no una ofensa - no debería sumar strike.
  if (fueOfensiva && handle) {
    ctx.notify(() => registrarStrike(roomId, handle));
  }

  // mask() deja pasar el mensaje pero reemplaza el contenido antes de que
  // alguien lo vea. El original no se almacena.
  return tocado ? mask<Contenido>({ ...c, body: texto }) : allow();
});

export default defineConfig({
  channels: {
    // Salas públicas: cualquiera entra sin registrarse. Es la regla dura del
    // producto — si el jurado tiene que crear cuenta, pierdes la demo.
    "sala-*": { anonymous: true, onPublish: [protegerDatos] },
    // Canal privado post-cierre entre vendedor y comprador ganador. SIN
    // protegerDatos a propósito: HU-09 pide que los datos se liberen SOLO
    // acá. Si se enmascarara igual que la sala pública, nadie podría pegar
    // su Yape/celular para coordinar la entrega - el canal quedaría inútil
    // para el único fin por el que existe.
    "trato-*": { anonymous: true },
    // Etapa 1.1 — solo transiciones de estado de sala, publicadas por
    // nuestro backend vía HTTP. Nadie publica acá desde el cliente, así que
    // no necesita middleware ni moderación.
    lobby: { anonymous: true },
  },
});
