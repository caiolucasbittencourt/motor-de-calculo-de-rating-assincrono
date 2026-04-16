import "dotenv/config";

import app from "./app";
import prisma from "./lib/prisma";
import { closeProducerQueue } from "./queue/queue.setup";

const port = Number(process.env.PORT ?? 3000);

const server = app.listen(port, () => {
  console.info(`HTTP server listening on port ${port}`);
});

async function closeResources(): Promise<void> {
  await closeProducerQueue();
  await prisma.$disconnect();
}

function handleShutdown(signal: NodeJS.Signals): void {
  console.info(`Received ${signal}. Shutting down API server...`);
  server.close(() => {
    void closeResources()
      .then(() => process.exit(0))
      .catch((error) => {
        console.error("Failed to shutdown resources cleanly.", error);
        process.exit(1);
      });
  });
}

process.on("SIGINT", () => {
  handleShutdown("SIGINT");
});

process.on("SIGTERM", () => {
  handleShutdown("SIGTERM");
});
