"use client";

import { PortalProvider } from "@portalsdk/react";
import { portal } from "@/lib/portal";

export function Providers({ children }: { children: React.ReactNode }) {
  // Sin `token`: modo anónimo. Identidad estable entre refrescos, cero
  // registro para el comprador. Esa es la regla dura del producto.
  return <PortalProvider client={portal}>{children}</PortalProvider>;
}
