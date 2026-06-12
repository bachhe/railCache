import { health } from "../services/health";

export function getHealth() {
  return {
    status: "ok",
    lastCycle: health.lastCycle,
    liveMapCount: health.liveMapCount,
    detailCount: health.detailCount,
  };
}
