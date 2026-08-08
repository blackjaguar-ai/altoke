# Altoke

> Un marketplace de negociación en vivo donde el vendedor define su precio piso
> en privado y un agente de IA negocia por él en tiempo real frente a todos los
> compradores a la vez.

**The Realtime Hackathon by Portal** · 7–9 de agosto 2026 · Solo builder
Demo: https://altoke.escai.tech · Licencia MIT

---

## El bug que arregla

En LATAM no se compra por catálogo — se negocia. Facebook Marketplace mata la
negociación: el vendedor no publica precio porque negociar en público lo expone
a que le tumben el valor. Sin precio publicado todo se va a inbox privado, el
vendedor termina con 40 conversaciones paralelas, y la venta tarda una semana.

**El insight:** si quien negocia en público es un *agente*, y el piso vive
*privado en el servidor*, la negociación puede ser pública, simultánea y en
tiempo real sin exponer al vendedor. La presión que antes tumbaba el precio
ahora lo sube, porque los compradores compiten a la vista.

---

## Arquitectura

```
  Compradores ───▶ ┌─────────────────────────────┐ ◀─── Espectadores
  (anónimos, QR)   │  Portal — canal público      │
                   │  presence · typing · efímeros│
                   │  history: últimos 50         │
                   └──────┬───────────────▲───────┘
                 onPublish middleware      │ HTTP API
                 (regex PII + ofensivas)   │ POST publish (secret key)
                          │                │
                          ▼                │
                   ┌──────────────────────┴───────┐
                   │   Backend  (VPS · Docker)     │
                   │  ┌────────────────────────┐   │
                   │  │ MOTOR DE PRECIO        │   │
                   │  │ determinístico (código)│   │
                   │  │ decide acción + NÚMERO │   │
                   │  └──────────┬─────────────┘   │
                   │             ▼                 │
                   │  ┌────────────────────────┐   │
                   │  │ LLM — solo REDACTA     │   │
                   │  │ nunca calcula el precio│   │
                   │  └────────────────────────┘   │
                   │   Postgres: piso privado,     │
                   │   ofertas, estado de sala     │
                   └───────────────────────────────┘
```

### Las tres decisiones que sostienen todo

1. **El agente vive en el backend, no en el navegador.** ¿En el browser de quién
   correría? ¿Del vendedor, que no está? ¿Del comprador, que vería el piso en sus
   devtools? El `POST publish` de la HTTP API con secret key es lo que hace la
   tesis técnicamente posible.

2. **El LLM nunca decide el número.** `lib/pricing.ts` es código determinístico:
   recibe oferta, piso e historial y devuelve `{action, amount}`. El LLM recibe
   esa decisión ya tomada y solo la redacta.
   → *Un LLM no puede alucinar un número que nunca calculó.*

3. **Cada capa donde le conviene.** Middleware de Portal: solo regex, cero estado.
   Backend: el agente, donde hay Postgres y debugger.

---

## Primitivas de Portal usadas

| Primitiva | Dónde |
|---|---|
| Canal + modo anónimo | Entrada por QR sin registro |
| Presence | "N negociando ahora" + avatares |
| Typing dots | "un comprador está escribiendo una oferta" — presión competitiva |
| Estados efímeros | Reacciones de la audiencia, sin persistir |
| `history: true` | Últimos 50: quien entra tarde ve la negociación en curso |
| Inbox / notificaciones | "te superaron", "el vendedor aceptó" |
| Middleware `onPublish` | Enmascarado de DNI/celular/dirección + ofensivas |
| HTTP API `publish` | La voz del agente |
| HTTP API mint JWT | Vendedores autenticados |

---

## Correr en local

```bash
cp .env.example .env      # rellena llaves de Portal y del LLM
docker compose up -d db
npm install
npm run db:push           # esquema + salas de ejemplo
npm run test:pricing      # el motor, sin LLM ni DB. Debe salir TODO VERDE
npm run dev
```

Abre `http://localhost:3000`, entra a una sala desde dos pestañas distintas.

## Desplegar

```bash
./deploy.sh               # rsync + docker compose up -d --build en el VPS
curl https://altoke.escai.tech/api/health
```

---

## Garantía de privacidad del piso

El piso (`rooms.floor_price`) nunca sale del servidor:

- `GET /api/rooms/[id]` hace un `SELECT` con columnas explícitas. Nunca `select *`.
- `POST /api/bids` responde solo `{ok:true}` — no devuelve la decisión.
- `assertNoFloorLeak()` corre en cada oferta y revienta en el servidor si el
  número del piso aparece en los datos que van al LLM.
- `lib/pricing.test.ts` audita 200 ofertas aleatorias buscando filtraciones.

Prueba tú mismo: ofrece S/1 y abre devtools. El agente contraoferta y el piso
no aparece en ningún payload.

---

## Estructura

```
lib/pricing.ts        motor determinístico  ← el corazón. Cero I/O, cero async
lib/pricing.test.ts   pruebas del motor
lib/agent.ts          capa LLM: solo redacta, con fallback si tarda o falla
lib/portal-server.ts  la voz del agente: POST /v1/channels/{id}/messages con sk_
lib/portal-client.tsx useSala(): useChannel + presence + typing + efímeros
lib/portal.ts         instancia del cliente (pk_) y nombres de canal
portal.config.ts      middleware onPublish: enmascarado de DNI/celular/dirección
lib/mask.ts           mismas regex del lado del backend
app/api/bids/route.ts el flujo completo de una oferta
```

## Fuera de alcance, a propósito

Pagos integrados · subida de productos desde la UI · búsqueda y categorías ·
mapa con GPS · app móvil.

El hueco de pagos no es un problema de producto, es infraestructura financiera
regional. El botón "Trato cerrado" abre un canal privado entre las dos partes
para coordinar Yape/Plin.
