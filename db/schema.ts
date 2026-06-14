import { db } from "./db";

db.run(`
CREATE TABLE IF NOT EXISTS live_map (
    train_no TEXT PRIMARY KEY,

    train_type INTEGER,
    train_status INTEGER,

    lat REAL,
    lng REAL,

    speed REAL,

    station_from TEXT,
    station_from_km REAL,

    station_to TEXT,
    station_to_km REAL,

    raw_json TEXT,

    updated_at INTEGER
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS train_details (
    train_no TEXT PRIMARY KEY,

    train_name TEXT,
    train_type TEXT,

    source_station TEXT,
    destination_station TEXT,

    status TEXT,

    last_updated TEXT,

    data TEXT,

    -- Extracted fields so getLiveMapV2 never has to parse data JSON at runtime.
    -- Populated by saveTrain alongside the data column.
    max_speed REAL,
    route_json TEXT,

    updated_at INTEGER
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS train_history (
    train_no TEXT,
    updated_at INTEGER,

    lat REAL,
    lng REAL,

    distance_from_origin REAL,

    last_updated_at TEXT,

    PRIMARY KEY (
        train_no,
        updated_at
    )
)
`);

// ── Migrate existing train_details rows that predate the new columns ──────────
// ALTER TABLE ... ADD COLUMN is a no-op if the column already exists in SQLite
// (it throws, so we catch). Running this on every startup is safe.

for (const col of [
  "ALTER TABLE train_details ADD COLUMN max_speed REAL",
  "ALTER TABLE train_details ADD COLUMN route_json TEXT",
]) {
  try {
    db.run(col);
  } catch {
    // column already exists — ignore
  }
}
