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
/** Canal único, global, de solo transiciones de estado (Etapa 1.1). El home
 *  lo escucha para actualizarse sin refresh. Nunca lleva ofertas ni chat -
 *  solo `{t:"room_state", ...}`, así que su volumen es bajísimo aunque haya
 *  muchas salas activas a la vez. */
export const canalLobby = () => "lobby";
