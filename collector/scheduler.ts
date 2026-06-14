import { runCycle } from "./collector";

export async function startCollector() {
  while (true) {
    const started = Date.now();

    try {
      await runCycle();
    } catch (err) {
      console.error("Collector error", err);
    }

    const elapsed = Date.now() - started;

    if (elapsed < 30000) {
      await Bun.sleep(30000 - elapsed);
    }
  }
}
