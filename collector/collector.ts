import chalk from "chalk";

import areas from "../config/areas.json";

import { saveLiveMap } from "./liveMap";

import { fetchTrain, saveTrain } from "./trainDetails";

import { queue } from "../services/queue";

import { setAreaCache } from "../services/areaCache";

import { inArea } from "../utils/areaFilter";

import { health } from "../services/health";

import { db } from "../db/db";

const lastTrainRows = new Map<string, string>();

export async function runCycle() {
  const cycleStart = Date.now();

  console.log(chalk.magenta(`[${new Date().toISOString()}] Starting cycle`));

  const trains = await saveLiveMap();

  health.liveMapCount = trains.length;

  const processed = new Set<string>();

  const trainsNeedingUpdate = new Set<string>();

  let detailCount = 0;

  for (const area of areas) {
    const filtered = trains.filter((train: any) =>
      inArea(train[3], train[4], area),
    );

    setAreaCache(area.name, filtered);

    console.log(chalk.blue(`[AREA] ${area.name}: ${filtered.length} trains`));

    for (const train of filtered) {
      const trainNo = train[0];

      const currentRow = JSON.stringify(train);

      const previousRow = lastTrainRows.get(trainNo);

      const changed = previousRow !== currentRow;

      lastTrainRows.set(trainNo, currentRow);

      if (changed) {
        trainsNeedingUpdate.add(trainNo);
      }
    }
  }

  console.log(
    chalk.yellow(`[UPDATE] ${trainsNeedingUpdate.size} trains changed`),
  );

  await Promise.all(
    [...trainsNeedingUpdate].map((trainNo) =>
      queue.add(async () => {
        if (processed.has(trainNo)) {
          return;
        }

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
    .query(
      `
      SELECT COUNT(*)
      AS count
      FROM train_details
    `,
    )
    .get() as {
    count: number;
  };

  const elapsed = Date.now() - cycleStart;

  console.log(
    chalk.green(`LIVE=${trains.length}`),
    chalk.cyan(`UPDATED=${detailCount}`),
    chalk.blue(`CACHED=${cached.count}`),
    chalk.magenta(`TIME=${elapsed}ms`),
  );
}
