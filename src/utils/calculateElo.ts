export type EloWinner = 1 | 2;

export type EloCalculationResult = {
  newRating1: number;
  newRating2: number;
  pointsExchanged: number;
};

export function calculateElo(
  rating1: number,
  rating2: number,
  winner: EloWinner,
  kFactor = 32,
): EloCalculationResult {
  const expected1 = 1 / (1 + 10 ** ((rating2 - rating1) / 400));
  const expected2 = 1 - expected1;

  const score1 = winner === 1 ? 1 : 0;
  const score2 = winner === 2 ? 1 : 0;

  const delta1 = Math.round(kFactor * (score1 - expected1));
  const delta2 = Math.round(kFactor * (score2 - expected2));

  return {
    newRating1: rating1 + delta1,
    newRating2: rating2 + delta2,
    pointsExchanged: Math.abs(delta1),
  };
}
