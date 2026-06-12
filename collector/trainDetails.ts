import { db } from "../db/db";

export async function fetchTrain(trainNo: string) {
  const url = `https://railradar.in/api/v1/trains/${trainNo}/live?geometry=true&format=polyline&includeCoordinates=true`;

  const res = await fetch(url);

  if (!res.ok) return null;

  return await res.json();
}

export function needsRefresh(trainNo: string) {
  const row = db
    .query(
      `
      SELECT updated_at
      FROM train_details
      WHERE train_no = ?
    `,
    )
    .get(trainNo) as { updated_at: number } | undefined;

  if (!row) return true;

  return Date.now() - row.updated_at > 30000;
}

export function saveTrain(json: any) {
  const train = json.data;

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
