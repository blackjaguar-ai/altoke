/**
 * Pruebas del motor. Corre con: npm run test:pricing
 * No requiere DB, ni LLM, ni red. Si esto falla, no despliegues.
 */
import {
  decide,
  targetPrice,
  assertNoFloorLeak,
  type PriceState,
} from "./pricing";

let fails = 0;
function t(name: string, fn: () => void) {
  try {
    fn();
    console.log("  OK   " + name);
  } catch (e) {
    fails++;
    console.log("  FAIL " + name + "\n       " + (e as Error).message);
  }
}
function eq(a: unknown, b: unknown, msg = "") {
  if (a !== b)
    throw new Error(
      `esperaba ${JSON.stringify(b)}, obtuve ${JSON.stringify(a)} ${msg}`,
    );
}
function ok(c: boolean, msg: string) {
  if (!c) throw new Error(msg);
}

const base: PriceState = {
  floorPrice: 450,
  listPrice: 800,
  highestBid: 0,
  counterCount: 0,
};

console.log("\nMOTOR DE PRECIO");

t("oferta S/1 => contraoferta, y el piso NO aparece nunca", () => {
  const d = decide({ amount: 1, handle: "juez" }, base);
  eq(d.action, "counter");
  ok(d.amount > 1, "la contraoferta debe superar la oferta");
  ok(d.facts.isLowball, "S/1 es lowball");
  assertNoFloorLeak(d, base.floorPrice); // <-- el test mas importante del repo
});

t("nunca contraoferta por debajo del piso", () => {
  for (let round = 0; round < 12; round++) {
    const d = decide({ amount: 10, handle: "x" }, { ...base, counterCount: round });
    ok(d.amount > base.floorPrice, `ronda ${round}: contraoferta ${d.amount} <= piso`);
  }
});

t("oferta >= precio de lista => acepta", () => {
  eq(decide({ amount: 800, handle: "x" }, base).action, "accept");
  eq(decide({ amount: 950, handle: "x" }, base).action, "accept");
});

t("oferta <= mejor oferta actual => outbid", () => {
  const d = decide({ amount: 500, handle: "x" }, { ...base, highestBid: 520 });
  eq(d.action, "outbid");
});

t("la contraoferta nunca supera el precio de lista", () => {
  const d = decide({ amount: 790, handle: "x" }, { ...base, highestBid: 780 });
  ok(d.amount <= base.listPrice, `contraoferta ${d.amount} > lista`);
});

t("el objetivo decae con las rondas pero nunca cruza el piso", () => {
  let prev = Infinity;
  for (let r = 0; r < 10; r++) {
    const tgt = targetPrice({ ...base, counterCount: r });
    ok(tgt <= prev, "el objetivo debe ser no creciente");
    ok(tgt > base.floorPrice, `objetivo ${tgt} <= piso`);
    prev = tgt;
  }
});

t("countdown <=15s con oferta sobre el piso => acepta", () => {
  const now = Date.now();
  const d = decide(
    { amount: 460, handle: "x" },
    { ...base, now, closesAt: now + 10_000 },
  );
  eq(d.action, "accept");
});

t("REGRESION: comprador oferta justo el piso - no debe reventar (bug real de altoke)", () => {
  // Encontrado en vivo: Cristian ofertó exactamente S/450 con floorPrice=450.
  // El guard viejo escaneaba facts.offer (input del comprador) y confundia
  // la coincidencia con una fuga real. No debe lanzar.
  const s: PriceState = { floorPrice: 450, listPrice: 800, highestBid: 445, counterCount: 6 };
  const d = decide({ amount: 450, handle: "Cristian" }, s);
  assertNoFloorLeak(d, s.floorPrice); // no debe throw
  ok(d.action === "counter" || d.action === "accept", "debe resolver, no colgarse");
});

t("auditoria de fuga: 200 ofertas aleatorias, cero filtraciones", () => {
  for (let i = 0; i < 200; i++) {
    const floorPrice = 100 + Math.floor(Math.random() * 900);
    const s: PriceState = {
      floorPrice,
      listPrice: floorPrice * 2,
      highestBid: 0,
      counterCount: i % 6,
    };
    const d = decide(
      { amount: Math.floor(Math.random() * s.listPrice), handle: "h" },
      s,
    );
    assertNoFloorLeak(d, floorPrice);
  }
});

console.log(
  fails === 0 ? "\nTODO VERDE\n" : `\n${fails} FALLAS - no despliegues\n`,
);
process.exit(fails === 0 ? 0 : 1);