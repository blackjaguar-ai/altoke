/**
 * Compartido entre los dos endpoints de moderación (check/strike).
 * El middleware en portal.config.ts corre en el edge de Portal, fuera de
 * nuestra red - sin este secreto, cualquiera podría hacer POST a estos
 * endpoints y banear a un comprador cualquiera desde afuera.
 */
export const STRIKE_LIMIT = 3;

export function secretoValido(req: Request): boolean {
  const esperado = process.env.MODERATION_WEBHOOK_SECRET;
  if (!esperado) return false; // sin secreto configurado, cierra por defecto
  return req.headers.get("x-altoke-mod-secret") === esperado;
}
