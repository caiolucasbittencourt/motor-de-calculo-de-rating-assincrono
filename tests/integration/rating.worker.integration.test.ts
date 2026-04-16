import { MatchStatus } from "@prisma/client";
import { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RatingJobPayload } from "../../src/queue/queue.setup";

const { prismaMock, txMock } = vi.hoisted(() => ({
  txMock: {
    $queryRaw: vi.fn(),
    matchRecord: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  prismaMock: {
    $transaction: vi.fn(),
    $disconnect: vi.fn(),
  },
}));

vi.mock("../../src/lib/prisma", () => ({
  default: prismaMock,
}));

import { processMatchJob } from "../../src/workers/rating.worker";

describe("rating worker integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    prismaMock.$transaction.mockImplementation(
      async (operation: (tx: unknown) => Promise<unknown>) => operation(txMock),
    );

    txMock.$queryRaw.mockResolvedValue([]);
    txMock.user.update.mockResolvedValue(undefined);
    txMock.matchRecord.update.mockResolvedValue(undefined);
  });

  it("updates both player ratings and marks match as PROCESSED", async () => {
    txMock.matchRecord.findUnique.mockResolvedValue({
      id: 10,
      player1Id: 1,
      player2Id: 2,
      winnerId: 2,
      status: MatchStatus.PENDING,
    });

    txMock.user.findUnique
      .mockResolvedValueOnce({ id: 1, currentRating: 1200 })
      .mockResolvedValueOnce({ id: 2, currentRating: 1000 });

    await processMatchJob({ data: { matchId: 10 } } as Job<RatingJobPayload>);

    expect(txMock.user.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { currentRating: 1176 },
    });

    expect(txMock.user.update).toHaveBeenNthCalledWith(2, {
      where: { id: 2 },
      data: { currentRating: 1024 },
    });

    expect(txMock.matchRecord.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        status: MatchStatus.PROCESSED,
        pointsExchanged: 24,
      },
    });
  });

  it("does nothing when match is already PROCESSED", async () => {
    txMock.matchRecord.findUnique.mockResolvedValue({
      id: 10,
      player1Id: 1,
      player2Id: 2,
      winnerId: 1,
      status: MatchStatus.PROCESSED,
    });

    await processMatchJob({ data: { matchId: 10 } } as Job<RatingJobPayload>);

    expect(txMock.user.findUnique).not.toHaveBeenCalled();
    expect(txMock.user.update).not.toHaveBeenCalled();
    expect(txMock.matchRecord.update).not.toHaveBeenCalled();
  });
});
