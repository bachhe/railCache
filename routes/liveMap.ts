import { db } from "../db/db";

export function getLiveMap() {
  return db
    .query(
      `
    SELECT *
    FROM live_map
  `,
    )
    .all();
}
