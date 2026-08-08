/**
 * MOTOR DE PRECIO — DETERMINÍSTICO.
 * ------------------------------------------------------------------
 * REGLA INVIOLABLE: este archivo es el ÚNICO lugar donde se decide un
 * número. El LLM jamás calcula, jamás ve `floorPrice`. Si alguna vez te
 * ves tentado a mandar el piso al prompt: no. Ese es el bug más caro
 * posible en cámara.
 * ------------------------------------------------------------------
 * Cero dependencias, cero I/O, cero async => testeable sin LLM ni DB.
 */

export type Action = "accept" | "counter" | "outbid" | "hold";

export interface PriceState {
  floorPrice: number; // SECRETO. server-only.
  listPrice: number; // público
  highestBid: number; // público (0 si no hay)
  counterCount: number; // cuántas contraofertas ya hizo el agente
  closesAt?: number | null; // epoch ms
  now?: number;
}

export interface Offer {
  amount: number;
  handle: string;
  district?: string | null;
}

export interface Decision {
  action: Action;
  /** El número que el agente dirá. NUNCA es el piso. */
  amount: number;
  /** Código estable para logs, tests y métricas. */
  reason:
    | "over_list"
    | "meets_target"
    | "below_target"
    | "lowball"
    | "already_outbid"
    | "closing_accept";
  /** Lo ÚNICO que se le pasa al LLM. Auditado: no contiene floorPrice. */
  facts: {
    action: Action;
    offer: number;
    counterAmount: number | null;
    listPrice: number;
    highestBid: number;
    buyerHandle: string;
    district?: string | null;
    isLowball: boolean;
    round: number;
    secondsLeft: number | null;
  };
}

/** Curva de concesión: el agente baja desde el precio de lista hacia el piso. */
const DECAY = 0.68;
/** Nunca aterriza exactamente en el piso: deja margen para no delatarlo. */
const FLOOR_MARGIN = 1.03;
/** Bajo esto es lowball declarado (tono más firme, mismo número). */
const LOWBALL_RATIO = 0.55;

export function roundSoles(n: number): number {
  if (n < 200) return Math.round(n / 5) * 5;
  if (n < 2000) return Math.round(n / 10) * 10;
  return Math.round(n / 50) * 50;
}

/** Precio objetivo del agente en la ronda n. Decae hacia el piso, nunca lo toca. */
export function targetPrice(s: PriceState): number {
  const { floorPrice, listPrice, counterCount } = s;
  const span = Math.max(0, listPrice - floorPrice);
  const raw = floorPrice + span * Math.pow(DECAY, counterCount);
  const min = floorPrice * FLOOR_MARGIN;
  return roundSoles(Math.max(raw, min));
}

export function decide(offer: Offer, s: PriceState): Decision {
  const now = s.now ?? Date.now();
  const secondsLeft = s.closesAt
    ? Math.max(0, Math.round((s.closesAt - now) / 1000))
    : null;
  const target = targetPrice(s);
  const isLowball = offer.amount < s.floorPrice * LOWBALL_RATIO;

  const mk = (
    action: Action,
    amount: number,
    reason: Decision["reason"],
  ): Decision => ({
    action,
    amount,
    reason,
    facts: {
      action,
      offer: offer.amount,
      counterAmount: action === "counter" ? amount : null,
      listPrice: s.listPrice,
      highestBid: s.highestBid,
      buyerHandle: offer.handle,
      district: offer.district ?? null,
      isLowball,
      round: s.counterCount + 1,
      secondsLeft,
    },
  });

  // 1. Alguien ya ofreció igual o más: no hay nada que negociar con este.
  if (offer.amount <= s.highestBid) {
    return mk("outbid", s.highestBid, "already_outbid");
  }

  // 2. Iguala o supera el precio de lista: cierre inmediato.
  if (offer.amount >= s.listPrice) {
    return mk("accept", offer.amount, "over_list");
  }

  // 3. Cierre inminente y la oferta ya supera el piso: se acepta.
  if (secondsLeft !== null && secondsLeft <= 15 && offer.amount > s.floorPrice) {
    return mk("accept", offer.amount, "closing_accept");
  }

  // 4. Alcanza el objetivo de esta ronda: se acepta.
  if (offer.amount >= target) {
    return mk("accept", offer.amount, "meets_target");
  }

  // 5. Contraoferta. Siempre por encima de la oferta y del máximo actual.
  const counter = roundSoles(
    Math.max(
      target,
      offer.amount + Math.max(10, offer.amount * 0.08),
      s.highestBid + 10,
    ),
  );
  const safeCounter = Math.min(counter, s.listPrice);
  return mk("counter", safeCounter, isLowball ? "lowball" : "below_target");
}

/**
 * Guard de auditoría: revienta si la CONTRAOFERTA CALCULADA coincide con el
 * piso. Ojo con el alcance: solo mira `counterAmount`, que es el único
 * número que el motor deriva a partir de floorPrice.
 *
 * `facts.offer` y `facts.highestBid` NO se revisan a propósito: son datos
 * que el comprador ya conoce (su propia oferta, la mejor oferta pública).
 * Si un comprador oferta por coincidencia el mismo número que el piso
 * secreto, eso no es una fuga - es una coincidencia con algo que él mismo
 * escribió. Escanear esos campos producía falsos positivos que tumbaban
 * negociaciones legítimas.
 */
export function assertNoFloorLeak(d: Decision, floorPrice: number): void {
  if (d.action !== "counter" || d.facts.counterAmount === null) return;
  const objetivo = new Set([String(floorPrice), String(roundSoles(floorPrice))]);
  if (objetivo.has(String(d.facts.counterAmount))) {
    throw new Error(
      "FLOOR LEAK: la contraoferta calculada coincide con el piso - revisa FLOOR_MARGIN",
    );
  }
}