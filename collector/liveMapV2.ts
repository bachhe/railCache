import { db } from "../db/db";
import { getAreaCache } from "../services/areaCache";

const HISTORY_POINTS = 10;

export function getLiveMapV2(areaName: string) {
  const trains = getAreaCache(areaName);

  if (!trains.length) {
    return {
      generatedAt: Date.now(),
      trains: [],
    };
  }

  const trainNos = trains.map((t) => t[0]);

  const placeholders = trainNos.map(() => "?").join(",");

  const historyRows = db
    .prepare(
      `
      SELECT
        train_no,
        distance_from_origin,
        updated_at
      FROM train_history
      WHERE train_no IN (${placeholders})
      ORDER BY train_no, updated_at DESC
    `,
    )
    .all(...trainNos) as any[];

  const historyMap = new Map<string, Array<[number, number]>>();

  for (const row of historyRows) {
    if (!historyMap.has(row.train_no)) {
      historyMap.set(row.train_no, []);
    }

    const history = historyMap.get(row.train_no)!;

    if (history.length < HISTORY_POINTS) {
      history.push([row.distance_from_origin, row.updated_at]);
    }
  }

  return {
    generatedAt: Date.now(),

    trains: trains.map((train) => ({
      trainNo: train[0],

      lat: train[3],
      lng: train[4],

      speed: train[5],

      previousStation: train[9],
      previousStationKm: train[10],

      nextStation: train[11],
      nextStationKm: train[12],

      distanceFromOrigin: train[10],

      history: historyMap.get(train[0]) ?? [],
    })),
  };
}
