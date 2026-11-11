-- Esquema inicial NoIdea. Ver docs/modelo-datos.md
-- Volúmenes en litros (REAL), distancias en mm (INTEGER), fechas ISO 8601 UTC (TEXT).

CREATE TABLE families (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  sector      TEXT    NOT NULL,
  members     INTEGER NOT NULL CHECK (members > 0),
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL UNIQUE,
  pin_hash    TEXT    NOT NULL,
  role        TEXT    NOT NULL CHECK (role IN ('family', 'admin', 'municipal')),
  family_id   INTEGER REFERENCES families(id),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (role <> 'family' OR family_id IS NOT NULL)
);

CREATE TABLE sessions (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE quotas (
  id            INTEGER PRIMARY KEY,
  family_id     INTEGER NOT NULL REFERENCES families(id),
  period_start  TEXT    NOT NULL,
  period_end    TEXT    NOT NULL,
  allocated_l   REAL    NOT NULL CHECK (allocated_l >= 0),
  used_l        REAL    NOT NULL DEFAULT 0 CHECK (used_l >= 0),
  reserved_l    REAL    NOT NULL DEFAULT 0 CHECK (reserved_l >= 0),
  UNIQUE (family_id, period_start)
);

CREATE TABLE tanks (
  id                 INTEGER PRIMARY KEY,
  name               TEXT    NOT NULL,
  nfc_tag_uid        TEXT    NOT NULL UNIQUE,
  capacity_l         REAL    NOT NULL CHECK (capacity_l > 0),
  empty_distance_mm  INTEGER NOT NULL,
  full_distance_mm   INTEGER NOT NULL,
  flow_lps           REAL    NOT NULL CHECK (flow_lps > 0),
  critical_percent   REAL    NOT NULL DEFAULT 20,
  status             TEXT    NOT NULL DEFAULT 'available'
                     CHECK (status IN ('available', 'dispensing', 'maintenance', 'offline')),
  CHECK (empty_distance_mm > full_distance_mm)
);

CREATE TABLE level_readings (
  id           INTEGER PRIMARY KEY,
  tank_id      INTEGER NOT NULL REFERENCES tanks(id),
  distance_mm  INTEGER,
  volume_l     REAL,
  percent      REAL,
  backup_raw   INTEGER,
  error        TEXT,
  source       TEXT    NOT NULL CHECK (source IN ('device', 'simulator')),
  measured_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_level_readings_tank_time ON level_readings (tank_id, measured_at);

CREATE TABLE withdrawals (
  id                  INTEGER PRIMARY KEY,
  family_id           INTEGER NOT NULL REFERENCES families(id),
  tank_id             INTEGER NOT NULL REFERENCES tanks(id),
  quota_id            INTEGER NOT NULL REFERENCES quotas(id),
  requested_l         REAL    NOT NULL CHECK (requested_l > 0),
  open_ms             INTEGER,
  delivered_l         REAL,
  measurement_method  TEXT    NOT NULL DEFAULT 'estimated_time'
                      CHECK (measurement_method IN ('estimated_time', 'flowmeter')),
  level_before_l      REAL,
  level_after_l       REAL,
  level_delta_l       REAL,
  status              TEXT    NOT NULL DEFAULT 'authorized'
                      CHECK (status IN ('authorized', 'dispensing', 'completed', 'failed', 'cancelled')),
  close_reason        TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  finished_at         TEXT
);
-- Un solo retiro activo por estanque.
CREATE UNIQUE INDEX idx_withdrawals_one_active_per_tank
  ON withdrawals (tank_id) WHERE status IN ('authorized', 'dispensing');

CREATE TABLE alerts (
  id          INTEGER PRIMARY KEY,
  tank_id     INTEGER REFERENCES tanks(id),
  type        TEXT    NOT NULL
              CHECK (type IN ('critical_level', 'sensor_error', 'device_offline', 'dispense_failed')),
  status      TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  message     TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT
);

CREATE TABLE refill_requests (
  id                  INTEGER PRIMARY KEY,
  tank_id             INTEGER NOT NULL REFERENCES tanks(id),
  status              TEXT    NOT NULL DEFAULT 'requested'
                      CHECK (status IN ('requested', 'scheduled', 'in_transit', 'delivered', 'cancelled')),
  requested_volume_l  REAL,
  notes               TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      TEXT    NOT NULL,
  payload     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
