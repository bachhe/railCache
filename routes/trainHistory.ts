import { db } from "../db/db";

export function getTrainHistory(trainNo: string, i = 0) {
  const offset = Math.abs(i);

  return db
    .query(
      `
      SELECT *
      FROM train_history
      WHERE train_no = ?
      ORDER BY updated_at DESC
      LIMIT 1
      OFFSET ?
    `,
    )
    .get(trainNo, offset);
}
