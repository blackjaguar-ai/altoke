/**
 * Configuración de Portal — se despliega con `npx @portalsdk/cli deploy`.
 * Requiere PORTAL_SECRET exportado.
 *
 * Aquí vive la capa de moderación (HU-09). Solo regex: cero estado, cero LLM,
 * cero debugging complejo a las 3am. El agente vive en el VPS, no aquí.
 */
import { defineConfig, defineMiddleware, allow, mask } from "@portalsdk/config";

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

const protegerDatos = defineMiddleware<Contenido>("publish", (ctx) => {
  const c = ctx.message.content;
  if (c?.t !== "chat" || typeof c.body !== "string") return allow();

  let texto = c.body;
  let tocado = false;
  for (const r of REGLAS) {
    if (new RegExp(r.re.source, r.re.flags).test(texto)) {
      texto = texto.replace(new RegExp(r.re.source, r.re.flags), r.mask);
      tocado = true;
    }
  }
  if (OFENSIVAS.test(texto)) {
    texto = texto.replace(OFENSIVAS, "***");
    tocado = true;
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
  },
});
