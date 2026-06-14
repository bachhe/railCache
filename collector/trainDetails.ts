import { db } from "../db/db";

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function fetchTrain(trainNo: string) {
  const res = await fetch(
    `https://api.railradar.in/app/v1/trains/${trainNo}/live?includeCoordinates=true`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/137.0.0.0 Safari/537.36",
        Accept: "application/json,text/plain,*/*",
        Referer: "https://railradar.in/",
      },
    },
  );

  if (!res.ok) return null;

  return await res.json();
}

// ─── Check ────────────────────────────────────────────────────────────────────
//
// Returns true if we already have a route-complete train_details row.
// "Route-complete" means route_json is non-null — the new extracted column
// added in schema.ts. Old rows (from before the migration) have route_json=NULL
// and will be re-fetched once to backfill them.

export function hasTrainDetails(trainNo: string): boolean {
  const row = db
    .query(
      `SELECT 1
       FROM train_details
       WHERE train_no = ?
         AND route_json IS NOT NULL
       LIMIT 1`,
    )
    .get(trainNo);

  return row != null;
}

// ─── Save ─────────────────────────────────────────────────────────────────────

export function saveTrain(json: any) {
  const train = json.data;

  const lat = train.currentLocation?.coordinates?.lat;
  const lng = train.currentLocation?.coordinates?.lng;
  const distance = train.currentLocation?.distanceFromOriginKm;

  // ── train_history: append only when position changed ─────────────────────

  const previous = db
    .query(
      `SELECT distance_from_origin
       FROM train_history
       WHERE train_no = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(train.trainNumber) as { distance_from_origin: number } | undefined;

  const moved = !previous || previous.distance_from_origin !== distance;

  if (moved) {
    db.prepare(
      `INSERT INTO train_history
       (train_no, updated_at, lat, lng, distance_from_origin, last_updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      train.trainNumber,
      Date.now(),
      lat,
      lng,
      distance,
      train.lastUpdatedAt,
    );

    db.prepare(
      `DELETE FROM train_history
       WHERE rowid NOT IN (
         SELECT rowid FROM train_history
         WHERE train_no = ?
         ORDER BY updated_at DESC
         LIMIT 10
       )
       AND train_no = ?`,
    ).run(train.trainNumber, train.trainNumber);
  }

  // ── train_details: upsert with extracted max_speed + route_json ───────────
  //
  // route_json is a compact JSON array: [{stationCode, lat, lng}, ...]
  // Only stops that carry coordinates are included (some stops don't).
  // This lets getLiveMapV2 do a single row read per train with no JSON parsing
  // beyond what SQLite already does on storage.

  const maxSpeed: number = train.train?.maxSpeed ?? 130;

  const routeJson: string = JSON.stringify(
    (train.route ?? [])
      .filter(
        (s: any) =>
          s.stationCode &&
          typeof s.lat === "number" &&
          typeof s.lng === "number",
      )
      .map((s: any) => ({
        c: s.stationCode, // code  — abbreviated key to keep the blob small
        a: s.lat, // lat
        o: s.lng, // lng
      })),
  );

  db.prepare(
    `INSERT OR REPLACE INTO train_details
     (train_no, train_name, train_type, source_station, destination_station,
      status, last_updated, data, max_speed, route_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    train.trainNumber,
    train.trainName,
    train.train.type,
    train.train.source.code,
    train.train.destination.code,
    train.status,
    train.lastUpdatedAt,
    JSON.stringify(train),
    maxSpeed,
    routeJson,
    Date.now(),
  );
}
