import { db } from "../db/db";

export function getTrain(trainNo: string) {
  const row = db
    .prepare(
      `
      SELECT data
      FROM train_details
      WHERE train_no = ?
    `,
    )
    .get(trainNo) as any;

  if (!row) return null;

  return JSON.parse(row.data);
}
