CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,
  product_name  TEXT NOT NULL,
  product_desc  TEXT,
  photo_url     TEXT,
  category      TEXT NOT NULL DEFAULT 'otros', -- vehiculos|tecnologia|hogar|moda|otros
  list_price    NUMERIC(10,2) NOT NULL,
  floor_price   NUMERIC(10,2) NOT NULL,   -- SECRETO. Jamás sale en un payload al cliente.
  agent_tone    TEXT NOT NULL DEFAULT 'firme pero amable, criollo',
  status        TEXT NOT NULL DEFAULT 'open',  -- open | closing | sold
  highest_bid   NUMERIC(10,2) NOT NULL DEFAULT 0,
  highest_handle TEXT,
  counter_count INT NOT NULL DEFAULT 0,
  winner_handle TEXT,
  final_price   NUMERIC(10,2),
  seller_id     TEXT,
  closes_at     TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Para bases ya existentes: CREATE TABLE IF NOT EXISTS no altera una tabla
-- que ya existe, así que esto es lo que de verdad agrega la columna en tu
-- VPS. Seguro de correr repetido.
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'otros';

CREATE TABLE IF NOT EXISTS bids (
  id           BIGSERIAL PRIMARY KEY,
  room_id      TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  buyer_handle TEXT NOT NULL,
  district     TEXT,
  amount       NUMERIC(10,2) NOT NULL,
  content_hash TEXT NOT NULL,             -- idempotencia por hash de contenido
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bids_hash_uq ON bids(content_hash);
CREATE INDEX IF NOT EXISTS bids_room_idx ON bids(room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_msgs (
  id         BIGSERIAL PRIMARY KEY,
  room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bid_id     BIGINT,
  action     TEXT NOT NULL,
  amount     NUMERIC(10,2),
  reason     TEXT,
  text       TEXT NOT NULL,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Etapa 1.4 — moderación con memoria. Escopeado a (room_id, handle): no hay
-- cuentas persistentes todavía (HU-04 sigue siendo anónimo), así que un
-- baneo es por sala, no global. El middleware en portal.config.ts consulta
-- y escribe acá vía HTTP, nunca directo a Postgres (vive en el edge).
CREATE TABLE IF NOT EXISTS strikes (
  room_id    TEXT NOT NULL,
  handle     TEXT NOT NULL,
  count      INT NOT NULL DEFAULT 0,
  banned     BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, handle)
);

-- Etapa 1.5 — botón de interés (corazón). Toggle idempotente por handle.
CREATE TABLE IF NOT EXISTS interests (
  room_id    TEXT NOT NULL,
  handle     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, handle)
);

-- Etapa "subir producto" — múltiples fotos por sala, en orden, para el
-- carrusel. `photo_url` en `rooms` se mantiene para las salas de prueba ya
-- sembradas a mano (nunca tuvieron fila acá) - el carrusel cae de vuelta a
-- esa columna si esta tabla está vacía para esa sala.
CREATE TABLE IF NOT EXISTS room_photos (
  id         BIGSERIAL PRIMARY KEY,
  room_id    TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS room_photos_room_idx ON room_photos(room_id, position);
