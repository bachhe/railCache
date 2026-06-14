import { db } from "../db/db";

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

  if (!res.ok) {
    return null;
  }

  return await res.json();
}

export function saveTrain(json: any) {
  const train = json.data;

  const lat = train.currentLocation?.coordinates?.lat;
  const lng = train.currentLocation?.coordinates?.lng;

  const distance = train.currentLocation?.distanceFromOriginKm;

  const previous = db
    .query(
      `
      SELECT distance_from_origin
      FROM train_history
      WHERE train_no = ?
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    )
    .get(train.trainNumber) as
    | {
        distance_from_origin: number;
      }
    | undefined;

  const changed = !previous || previous.distance_from_origin !== distance;

  if (changed) {
    db.prepare(
      `
      INSERT INTO train_history
      (
        train_no,
        updated_at,
        lat,
        lng,
        distance_from_origin,
        last_updated_at
      )
      VALUES
      (?, ?, ?, ?, ?, ?)
    `,
    ).run(
      train.trainNumber,
      Date.now(),
      lat,
      lng,
      distance,
      train.lastUpdatedAt,
    );

    db.prepare(
      `
      DELETE FROM train_history
      WHERE rowid NOT IN (
        SELECT rowid
        FROM train_history
        WHERE train_no = ?
        ORDER BY updated_at DESC
        LIMIT 10
      )
      AND train_no = ?
    `,
    ).run(train.trainNumber, train.trainNumber);
  }

  db.prepare(
    `
    INSERT OR REPLACE INTO train_details
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    train.trainNumber,
    train.trainName,
    train.train.type,
    train.train.source.code,
    train.train.destination.code,
    train.status,
    train.lastUpdatedAt,
    JSON.stringify(train),
    Date.now(),
  );
}
