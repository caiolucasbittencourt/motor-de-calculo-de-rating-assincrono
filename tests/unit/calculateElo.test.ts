import { describe, expect, it } from "vitest";

import { calculateElo } from "../../src/utils/calculateElo";

describe("calculateElo", () => {
  it("applies a smaller rating change when the favorite wins", () => {
    const result = calculateElo(1200, 1000, 1);

    expect(result).toEqual({
      newRating1: 1208,
      newRating2: 992,
      pointsExchanged: 8,
    });
  });

  it("applies a larger rating change when the underdog wins", () => {
    const result = calculateElo(1200, 1000, 2);

    expect(result).toEqual({
      newRating1: 1176,
      newRating2: 1024,
      pointsExchanged: 24,
    });
  });
});
