import { db } from "../db/db";

export async function fetchTrain(trainNo: string) {
  const res = await fetch(
    `https://railradar.in/api/v1/trains/${trainNo}/live?includeCoordinates=true`,
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
      SELECT *
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

  let changed = true;

  if (previous) {
    changed = previous.distance_from_origin !== distance;
  }

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
        LIMIT 2
      )
      AND train_no = ?
    `,
    ).run(train.trainNumber, train.trainNumber);
  }

  db.prepare(
    `
    INSERT OR REPLACE INTO
    train_details
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
