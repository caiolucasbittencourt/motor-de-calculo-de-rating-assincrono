import { Queue } from "bullmq";
import IORedis, { RedisOptions } from "ioredis";

export const RATING_QUEUE_NAME = "rating-processing";

export type RatingJobPayload = {
  matchId: number;
};

export const redisConnectionOptions: RedisOptions = {
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  maxRetriesPerRequest: null,
};

let producerConnection: IORedis | null = null;
let ratingQueue: Queue<RatingJobPayload> | null = null;

function getProducerConnection(): IORedis {
  if (!producerConnection) {
    producerConnection = new IORedis(redisConnectionOptions);
  }

  return producerConnection;
}

export function getRatingQueue(): Queue<RatingJobPayload> {
  if (!ratingQueue) {
    ratingQueue = new Queue<RatingJobPayload>(RATING_QUEUE_NAME, {
      connection: getProducerConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: {
          count: 1000,
        },
        removeOnFail: {
          count: 1000,
        },
      },
    });
  }

  return ratingQueue;
}

export async function closeProducerQueue(): Promise<void> {
  if (ratingQueue) {
    await ratingQueue.close();
    ratingQueue = null;
  }

  if (producerConnection) {
    await producerConnection.quit();
    producerConnection = null;
  }
}
