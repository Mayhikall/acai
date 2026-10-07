import "dotenv/config";
import { createApp } from "./app.js";
import { closeDatabase } from "./db/index.js";
import { startMaintenanceWorker } from "./services/maintenance-worker.js";
import { startChainIndexer } from "./services/chain-indexer.js";

const stopMaintenance = startMaintenanceWorker(console);
const stopIndexer = startChainIndexer(console);

const server = createApp().listen(Number(process.env.PORT || 4000), () => {
  console.log(
    `Acai API listening on ${process.env.API_ORIGIN || "http://localhost:4000"}`
  );
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down`);
  stopMaintenance();
  stopIndexer();
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
