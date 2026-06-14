import { db } from "../db/db";
import { getAreaCache } from "../services/areaCache";

const HISTORY_POINTS = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StationCoords {
  lat: number;
  lng: number;
}

interface TrainDetailRow {
  data: string;
}

// ─── Station coord cache ──────────────────────────────────────────────────────
// Parsed train_details are looked up per train. We cache the parsed route
// so repeated requests within the same process don't re-parse the JSON blob.

const detailCache = new Map<
  string,
  {
    maxSpeed: number;
    routeByCode: Map<string, StationCoords>;
  }
>();

function getTrainDetail(trainNo: string) {
  if (detailCache.has(trainNo)) {
    return detailCache.get(trainNo)!;
  }

  const row = db
    .query(`SELECT data FROM train_details WHERE train_no = ? LIMIT 1`)
    .get(trainNo) as TrainDetailRow | undefined;

  if (!row) return null;

  try {
    const parsed = JSON.parse(row.data);

    const maxSpeed: number = parsed?.train?.maxSpeed ?? 130;

    const routeByCode = new Map<string, StationCoords>();

    for (const stop of parsed?.route ?? []) {
      if (
        stop.stationCode &&
        typeof stop.lat === "number" &&
        typeof stop.lng === "number"
      ) {
        routeByCode.set(stop.stationCode, {
          lat: stop.lat,
          lng: stop.lng,
        });
      }
    }

    const result = { maxSpeed, routeByCode };

    // Cache for the lifetime of this process cycle.
    // The collector updates train_details on every changed train, so
    // stale cache at worst misses one cycle — acceptable for predictions.
    detailCache.set(trainNo, result);

    return result;
  } catch {
    return null;
  }
}

// Clear the in-process cache once per minute so station coord updates
// (rare) do eventually propagate without a restart.
setInterval(() => detailCache.clear(), 60_000);

// ─── getLiveMapV2 ─────────────────────────────────────────────────────────────

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
      // [distanceFromOriginKm, updatedAtMs]
      history.push([row.distance_from_origin, row.updated_at]);
    }
  }

  return {
    generatedAt: Date.now(),

    trains: trains.map((train) => {
      const trainNo: string = train[0];

      const previousStation: string = train[9];
      const nextStation: string = train[11];

      const detail = getTrainDetail(trainNo);

      const maxSpeed: number = detail?.maxSpeed ?? 130;

      const prevCoords = detail?.routeByCode.get(previousStation) ?? null;
      const nextCoords = detail?.routeByCode.get(nextStation) ?? null;

      return {
        trainNo,

        lat: train[3],
        lng: train[4],

        speed: train[5],

        previousStation,
        previousStationKm: train[10],

        nextStation,
        nextStationKm: train[12],

        distanceFromOrigin: train[10],

        // ── Enriched fields for the prediction server ──
        maxSpeed,

        // null when train_details hasn't been fetched yet for this train.
        // The prediction server skips trains where either coord is null.
        prevStationLat: prevCoords?.lat ?? null,
        prevStationLng: prevCoords?.lng ?? null,

        nextStationLat: nextCoords?.lat ?? null,
        nextStationLng: nextCoords?.lng ?? null,

        history: historyMap.get(trainNo) ?? [],
      };
    }),
  };
}
