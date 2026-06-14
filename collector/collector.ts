import chalk from "chalk";

import areas from "../config/areas.json";

import { saveLiveMap } from "./liveMap";
import { fetchTrain, saveTrain, hasTrainDetails } from "./trainDetails";
import { queue } from "../services/queue";
import { setAreaCache } from "../services/areaCache";
import { inArea } from "../utils/areaFilter";
import { health } from "../services/health";
import { db } from "../db/db";

// ── Prepared statement used to check whether a train's live data changed ──────
//
// live_map.raw_json is written by saveLiveMap on every cycle, so it always
// holds the previous cycle's raw tuple for every train. Comparing the current
// tuple against it replaces the in-memory lastTrainRows Map — and survives
// process restarts.

const stmtPrevRaw = db.prepare(
  `SELECT raw_json FROM live_map WHERE train_no = ? LIMIT 1`,
);

export async function runCycle() {
  const cycleStart = Date.now();

  console.log(chalk.magenta(`[${new Date().toISOString()}] Starting cycle`));

  // saveLiveMap writes the new raw_json to live_map BEFORE we read it below,
  // so "previous" is whatever was there at the start of the *previous* cycle.
  // We need to read the old values first, then save the new ones.
  //
  // Strategy: read current live_map.raw_json → save new data → compare.
  // We capture the pre-save snapshot in a Map so the comparison is cheap.

  const prevSnapshot = new Map<string, string>();

  const existing = db
    .query(`SELECT train_no, raw_json FROM live_map`)
    .all() as { train_no: string; raw_json: string }[];

  for (const row of existing) {
    prevSnapshot.set(row.train_no, row.raw_json);
  }

  // Now overwrite live_map with fresh data
  const trains = await saveLiveMap();

  health.liveMapCount = trains.length;

  const processed = new Set<string>();
  const needsDetail = new Set<string>();
  let detailCount = 0;

  for (const area of areas) {
    const filtered = trains.filter((train: any) =>
      inArea(train[3], train[4], area),
    );

    setAreaCache(area.name, filtered);

    console.log(chalk.blue(`[AREA] ${area.name}: ${filtered.length} trains`));

    for (const train of filtered) {
      const trainNo = train[0];
      const currentRaw = JSON.stringify(train);
      const prevRaw = prevSnapshot.get(trainNo);

      // Skip entirely if the live tuple is byte-for-byte identical
      if (prevRaw === currentRaw) continue;

      // Tuple changed — do we also need a fresh detail fetch?
      // Only if we don't yet have a route-complete train_details row.
      if (!hasTrainDetails(trainNo)) {
        needsDetail.add(trainNo);
      }
    }
  }

  const skipped = trains.length - needsDetail.size;

  console.log(
    chalk.yellow(
      `[UPDATE] ${needsDetail.size} detail fetches needed, ${skipped} trains already cached`,
    ),
  );

  await Promise.all(
    [...needsDetail].map((trainNo) =>
      queue.add(async () => {
        if (processed.has(trainNo)) return;
        processed.add(trainNo);

        try {
          const json = await fetchTrain(trainNo);
          if (!json) return;

          saveTrain(json);
          detailCount++;
        } catch (err) {
          console.error(chalk.red(`[ERROR] Failed train ${trainNo}`), err);
        }
      }),
    ),
  );

  health.detailCount = detailCount;
  health.lastCycle = Date.now();

  const cached = db
    .query(`SELECT COUNT(*) AS count FROM train_details`)
    .get() as { count: number };

  const elapsed = Date.now() - cycleStart;

  console.log(
    chalk.green(`LIVE=${trains.length}`),
    chalk.cyan(`FETCHED=${detailCount}`),
    chalk.blue(`CACHED=${cached.count}`),
    chalk.magenta(`TIME=${elapsed}ms`),
  );
}
