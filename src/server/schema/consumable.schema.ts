import { z } from "zod";
import type { inferProcedureOutput } from "@trpc/server";
import type { consumableRouter } from "@/server/api/routers/consumable";

const consumableQuantitySchema = z.object({
  available: z
    .number()
    .int("Available quantity must be an integer")
    .nonnegative("Available quantity cannot be negative"),
  total: z
    .number()
    .int("Total quantity must be an integer")
    .nonnegative("Total quantity cannot be negative"),
});

const quantityRefinement = (data: { total: number; available: number }) =>
  data.total >= (data.available || 0);
const quantityRefinementOptions = {
  message: "Total quantity cannot be less than available quantity",
  path: ["total"],
};

export const createConsumableInput = consumableQuantitySchema.refine(
  quantityRefinement,
  quantityRefinementOptions,
);

const consumableSchema = consumableQuantitySchema.safeExtend({
  itemId: z.uuid("Invalid item ID format"),
});

export const consumableInput = consumableSchema.refine(
  quantityRefinement,
  quantityRefinementOptions,
);

// UPDATE INPUT SCHEMA (For PATCH requests)
export const consumableUpdateInput = consumableSchema.partial();

export type ConsumableGetOutput = inferProcedureOutput<
  (typeof consumableRouter)["get"]
>;
export type ConsumableCreateOutput = inferProcedureOutput<
  (typeof consumableRouter)["create"]
>;
export type ConsumableUpdateOutput = inferProcedureOutput<
  (typeof consumableRouter)["update"]
>;
export type ConsumableDeleteOutput = inferProcedureOutput<
  (typeof consumableRouter)["delete"]
>;
export type ConsumableListOutput = inferProcedureOutput<
  (typeof consumableRouter)["list"]
>;
