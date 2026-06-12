import "./db/schema";

import { startCollector } from "./collector/scheduler";

import { getLiveMap } from "./routes/liveMap";

import { getAreaLiveMap, getAreaTrains } from "./routes/areas";

import { getTrain } from "./routes/trains";

import { getHealth } from "./routes/health";
import { health } from "./services/health";
import { db } from "./db/db";
import chalk from "chalk";
import { getTrainHistory } from "./routes/trainHistory";

const PORT = Number(process.env.PORT) || 3000;

startCollector();

console.log(chalk.green(`Rail Cache API running on port ${PORT}`));

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    const path = url.pathname;

    if (path === "/health") {
      return Response.json(getHealth());
    }

    if (path === "/live-map") {
      return Response.json(getLiveMap());
    }

    if (path.startsWith("/train/")) {
      const trainNo = path.split("/")[2];

      const train = getTrain(trainNo);

      if (!train) {
        return new Response("Train not found", {
          status: 404,
        });
      }

      return Response.json(train);
    }

    if (path.startsWith("/areas/")) {
      const parts = path.split("/");

      const area = parts[2];

      const action = parts[3];

      if (action === "live-map") {
        return Response.json(getAreaLiveMap(area));
      }

      if (action === "trains") {
        return Response.json(getAreaTrains(area));
      }
    }

    if (path === "/stats") {
      return Response.json({
        liveMapCount: health.liveMapCount,
        cachedTrainCount: db
          .query(
            `
      SELECT COUNT(*) as count
      FROM train_details
    `,
          )
          .get(),
        lastCycle: health.lastCycle,
      });
    }

    if (path.startsWith("/train/") && path.endsWith("/history")) {
      const parts = path.split("/");
      const trainNo = parts[2];
      const i = Number(url.searchParams.get("i")) || 0;

      return Response.json(getTrainHistory(trainNo, i));
    }

    return new Response("Not Found", {
      status: 404,
    });
  },
});
