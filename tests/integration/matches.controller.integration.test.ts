import { MatchStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, queueAddMock } = vi.hoisted(() => ({
  queueAddMock: vi.fn(),
  prismaMock: {
    user: {
      count: vi.fn(),
    },
    matchRecord: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../../src/lib/prisma", () => ({
  default: prismaMock,
}));

vi.mock("../../src/queue/queue.setup", () => ({
  getRatingQueue: () => ({
    add: queueAddMock,
  }),
}));

import app from "../../src/app";

describe("POST /matches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueAddMock.mockResolvedValue(undefined);
  });

  it("returns 202 and enqueues the match for processing", async () => {
    prismaMock.user.count.mockResolvedValue(2);
    prismaMock.matchRecord.create.mockResolvedValue({
      id: 42,
    });

    const response = await request(app).post("/matches").send({
      player1Id: 1,
      player2Id: 2,
      winnerId: 1,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      status: "accepted",
      matchId: 42,
    });

    expect(prismaMock.matchRecord.create).toHaveBeenCalledWith({
      data: {
        player1Id: 1,
        player2Id: 2,
        winnerId: 1,
        status: MatchStatus.PENDING,
      },
    });

    expect(queueAddMock).toHaveBeenCalledWith(
      "process-rating",
      { matchId: 42 },
      { jobId: "match:42" },
    );
  });

  it("returns 400 when players are the same", async () => {
    const response = await request(app).post("/matches").send({
      player1Id: 1,
      player2Id: 1,
      winnerId: 1,
    });

    expect(response.status).toBe(400);
    expect(prismaMock.user.count).not.toHaveBeenCalled();
    expect(prismaMock.matchRecord.create).not.toHaveBeenCalled();
    expect(queueAddMock).not.toHaveBeenCalled();
  });
});
