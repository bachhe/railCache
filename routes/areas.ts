import { getAreaCache } from "../services/areaCache";

import { db } from "../db/db";

export function getAreaLiveMap(areaName: string) {
  return getAreaCache(areaName);
}

export function getAreaTrains(areaName: string) {
  const trains = getAreaCache(areaName);

  if (!trains.length) return [];

  const stmt = db.prepare(`
      SELECT data
      FROM train_details
      WHERE train_no = ?
    `);

  const result = [];

  for (const train of trains) {
    const row = stmt.get(train[0]) as any;

    if (row) {
      result.push(JSON.parse(row.data));
    }
  }

  return result;
}
