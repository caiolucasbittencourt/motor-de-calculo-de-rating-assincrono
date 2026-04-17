import { MatchStatus } from "@prisma/client";
import { NextFunction, Request, Response } from "express";

import prisma from "../lib/prisma";
import { getRatingQueue } from "../queue/queue.setup";

type CreateMatchBody = {
  player1Id: number;
  player2Id: number;
  winnerId: number;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export async function createMatch(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { player1Id, player2Id, winnerId } = req.body as Partial<CreateMatchBody>;

    if (
      !isPositiveInteger(player1Id) ||
      !isPositiveInteger(player2Id) ||
      !isPositiveInteger(winnerId)
    ) {
      res.status(400).json({
        message: "player1Id, player2Id e winnerId devem ser inteiros positivos.",
      });
      return;
    }

    if (player1Id === player2Id) {
      res.status(400).json({
        message: "player1Id e player2Id devem ser diferentes.",
      });
      return;
    }

    if (winnerId !== player1Id && winnerId !== player2Id) {
      res.status(400).json({
        message: "winnerId deve ser um dos jogadores da partida.",
      });
      return;
    }

    const existingPlayers = await prisma.user.count({
      where: {
        id: {
          in: [player1Id, player2Id],
        },
      },
    });

    if (existingPlayers !== 2) {
      res.status(404).json({
        message: "Um ou mais jogadores nao foram encontrados.",
      });
      return;
    }

    const match = await prisma.matchRecord.create({
      data: {
        player1Id,
        player2Id,
        winnerId,
        status: MatchStatus.PENDING,
      },
    });

    await getRatingQueue().add(
      "process-rating",
      { matchId: match.id },
      { jobId: `match:${match.id}` },
    );

    res.status(202).json({
      status: "accepted",
      matchId: match.id,
    });
  } catch (error) {
    next(error);
  }
}
