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

    updated_at INTEGER
)
`);
