import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/lib/utils";

describe("formatConsumableTotalCost", () => {
  it("formats total cost directly as dollars without cent conversion", () => {
    expect(formatCurrency(125)).toBe("$125.00");
  });

  it("keeps cents precision for fractional totals", () => {
    expect(formatCurrency(12.345)).toBe("$12.35");
  });
});
