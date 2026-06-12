import { db } from "../db/db";

export async function fetchLiveMap() {
  const res = await fetch("https://railradar.in/api/v1/live-map");

  const json = await res.json();

  return json.data;
}

export async function saveLiveMap() {
  const trains = await fetchLiveMap();

  const stmt = db.prepare(`
      INSERT OR REPLACE INTO live_map
      (
        train_no,
        train_type,
        train_status,
        lat,
        lng,
        speed,
        station_from,
        station_from_km,
        station_to,
        station_to_km,
        raw_json,
        updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

  const now = Date.now();

  for (const train of trains) {
    stmt.run(
      train[0],
      train[1],
      train[2],
      train[3],
      train[4],
      train[5],
      train[9],
      train[10],
      train[11],
      train[12],
      JSON.stringify(train),
      now,
    );
  }

  return trains;
}
