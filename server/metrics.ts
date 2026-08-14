// ─── Metrics Orchestrator ────────────────────────────────────────────────────
// Combines all native metric collectors into a single Prometheus text response.

import { collectInventoryMetrics } from "./metrics/inventoryCollector";
import { logger as rootLogger } from "@/server/lib/logger";

const logger = rootLogger.child({ module: "metrics" });

export async function collectMetrics(): Promise<string> {
    const start = Date.now();

    const sections: Promise<string>[] = [];

    // Inventory metrics: pull from DB on each request
    const invStart = Date.now();
    sections.push(
        collectInventoryMetrics().then((result) => {
            logger.debug({ ms: Date.now() - invStart, chars: result.length }, "Inventory collected");
            return result;
        }),
    );

    const results = await Promise.allSettled(sections);
    const output: string[] = [];

    for (const result of results) {
        if (result.status === "fulfilled" && result.value) {
            output.push(result.value.trimEnd());
        } else if (result.status === "rejected") {
            logger.error({ err: result.reason }, "Collection error");
            output.push(
                `# ERROR: Metrics collection failed - ${result.reason}`,
            );
        }
    }

    const total = output.join("\n\n") + "\n";
    logger.debug({ ms: Date.now() - start, chars: total.length }, "Scrape complete");
    return total;
}
