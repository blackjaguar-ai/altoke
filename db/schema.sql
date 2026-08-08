CREATE TABLE IF NOT EXISTS rooms (
  id            TEXT PRIMARY KEY,
  product_name  TEXT NOT NULL,
  product_desc  TEXT,
  photo_url     TEXT,
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
