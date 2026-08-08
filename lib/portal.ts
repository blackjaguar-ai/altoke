"use client";

import { Portal } from "@portalsdk/core";

/**
 * Una sola instancia, a nivel de módulo. La construcción es síncrona y pasiva:
 * no abre socket hasta que un componente monta un canal.
 * La pk_ es publicable: va en el bundle a propósito. La sk_ NUNCA.
 */
export const portal = new Portal({
  apiKey: process.env.NEXT_PUBLIC_PORTAL_PUBLISHABLE_KEY!,
});

/** Debe calzar con la plantilla `sala-*` de portal.config.ts */
export const canalSala = (roomId: string) => `sala-${roomId}`;
/** Canal privado post-cierre. Plantilla `trato-*`, anonymous: true. */
export const canalTrato = (roomId: string, handle: string) =>
  `trato-${roomId}-${handle.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
