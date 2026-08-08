/**
 * Enmascarado de datos personales. Mismo array de regex en el middleware
 * de Portal y en el backend: una sola fuente de verdad.
 * El contenido original NUNCA se almacena.
 */
export const PII_RULES: { name: string; re: RegExp; mask: string }[] = [
  { name: "dni", re: /\b\d{8}\b/g, mask: "[DNI oculto]" },
  { name: "ruc", re: /\b(10|20)\d{9}\b/g, mask: "[RUC oculto]" },
  { name: "celular", re: /(\+?51[\s-]?)?9\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/g, mask: "[celular oculto]" },
  { name: "email", re: /[\w.+-]+@[\w-]+\.[\w.]{2,}/g, mask: "[correo oculto]" },
  { name: "direccion", re: /\b(av\.?|avenida|jr\.?|jiron|jirón|calle|mz\.?|lote|urb\.?)\s+[\wáéíóúñ.\s]{3,30}\b/gi, mask: "[dirección oculta]" },
  { name: "tarjeta", re: /\b(?:\d[ -]?){13,16}\b/g, mask: "[tarjeta oculta]" },
];

export const BAD_WORDS = [
  "concha","conchatumadre","ctm","mierda","puta","huevon","huevón","carajo","imbecil","imbécil","estupido","estúpido",
];

export interface MaskResult { text: string; hits: string[]; blocked: boolean }

export function mask(input: string): MaskResult {
  let text = input;
  const hits: string[] = [];
  for (const r of PII_RULES) {
    if (r.re.test(text)) { hits.push(r.name); text = text.replace(new RegExp(r.re.source, r.re.flags), r.mask); }
    r.re.lastIndex = 0;
  }
  let blocked = false;
  for (const w of BAD_WORDS) {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    if (re.test(text)) { blocked = true; hits.push("ofensivo"); text = text.replace(re, "***"); }
  }
  return { text, hits, blocked };
}
