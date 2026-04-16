import "dotenv/config";

import { Job, Worker } from "bullmq";
import { MatchStatus, Prisma } from "@prisma/client";
import IORedis from "ioredis";

import prisma from "../lib/prisma";
import {
  RATING_QUEUE_NAME,
  RatingJobPayload,
  redisConnectionOptions,
} from "../queue/queue.setup";
import { EloWinner, calculateElo } from "../utils/calculateElo";

const workerConnection = new IORedis(redisConnectionOptions);

function isRetryableTransactionError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("could not serialize access") ||
      message.includes("deadlock detected") ||
      message.includes("40001")
    );
  }

  return false;
}

async function runSerializableTransaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  maxRetries = 3,
): Promise<T> {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await prisma.$transaction(async (tx) => operation(tx), {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      attempt += 1;
      if (isRetryableTransactionError(error) && attempt < maxRetries) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not commit transaction after retries.");
}

async function processMatchJob(job: Job<RatingJobPayload>): Promise<void> {
  const { matchId } = job.data;

  if (!Number.isInteger(matchId) || matchId <= 0) {
    throw new Error(`Invalid matchId: ${String(matchId)}`);
  }

  await runSerializableTransaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM "MatchRecord"
      WHERE id = ${matchId}
      FOR UPDATE
    `;

    const match = await tx.matchRecord.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error(`Match ${matchId} was not found.`);
    }

    if (match.status !== MatchStatus.PENDING) {
      return;
    }

    await tx.$queryRaw`
      SELECT id
      FROM "User"
      WHERE id IN (${match.player1Id}, ${match.player2Id})
      FOR UPDATE
    `;

    const [player1, player2] = await Promise.all([
      tx.user.findUnique({
        where: { id: match.player1Id },
        select: { id: true, currentRating: true },
      }),
      tx.user.findUnique({
        where: { id: match.player2Id },
        select: { id: true, currentRating: true },
      }),
    ]);

    if (!player1 || !player2) {
      throw new Error(`Could not load both players for match ${matchId}.`);
    }

    let winner: EloWinner;
    if (match.winnerId === player1.id) {
      winner = 1;
    } else if (match.winnerId === player2.id) {
      winner = 2;
    } else {
      throw new Error(
        `winnerId ${match.winnerId} is invalid for match ${matchId}.`,
      );
    }

    const { newRating1, newRating2, pointsExchanged } = calculateElo(
      player1.currentRating,
      player2.currentRating,
      winner,
    );

    await tx.user.update({
      where: { id: player1.id },
      data: { currentRating: newRating1 },
    });

    await tx.user.update({
      where: { id: player2.id },
      data: { currentRating: newRating2 },
    });

    await tx.matchRecord.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.PROCESSED,
        pointsExchanged,
      },
    });
  });
}

const worker = new Worker<RatingJobPayload>(
  RATING_QUEUE_NAME,
  processMatchJob,
  {
    connection: workerConnection,
    concurrency: Number(process.env.RATING_WORKER_CONCURRENCY ?? 5),
  },
);

worker.on("completed", (job) => {
  console.info(`Job ${job.id ?? "unknown"} processed successfully.`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id ?? "unknown"} failed.`, error);
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  console.info(`Received ${signal}. Closing rating worker...`);
  await worker.close();
  await workerConnection.quit();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
