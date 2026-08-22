import { z } from "zod";
import type { inferProcedureOutput } from "@trpc/server";
import type { itemRouter } from "@/server/api/routers/item";
import { consumableInput, createConsumableInput } from "./consumable.schema";
import { tagInput } from "./tag.schema";
import { ItemStatusSchema } from "@/prisma-zod/schemas/enums/ItemStatus.schema";

export const itemInput = z.object({
  // technical info
  serial: z
    .string()
    .min(1, "Serial number is required")
    .max(100, "Serial number too long (max 100 chars)")
    .optional(),
  consumable: consumableInput.optional(),
  // item description
  name: z
    .string()
    .min(1, "Item name is required")
    .max(200, "Name too long (max 200 chars)"),
  manufacturer: z
    .string()
    .max(200, "Manufacturer too long (max 200 chars)")
    .optional(),
  model: z.string().max(200, "Model too long (max 200 chars)").optional(),
  itemSerial: z
    .string()
    .max(100, "Item serial too long (max 100 chars)")
    .optional(),
  tags: z.array(tagInput),
  // location
  locationId: z.uuid("Invalid location ID format"),
  status: ItemStatusSchema.optional(),
  // purchase info
  costCents: z
    .number()
    .int("Must be an integer")
    .nonnegative("Cost cannot be negative")
    .optional(),
  depreciatedValue: z
    .number()
    .int("Must be an integer")
    .nonnegative("Depreciated value cannot be negative")
    .optional(),
  purchasedAt: z
    .date()
    .max(new Date(), "Purchase date must be in the past")
    .optional(),
  // deprecated
  stored: z.boolean().optional(),
  cost: z
    .number()
    .int("Must be an integer")
    .nonnegative("Cost cannot be negative")
    .optional(),
});

// NOTE: THIS IS A QUICK PATCH
// TODO: figure out what's going on here
export const createItemInput = z.object({
  serial: z
    .string()
    .min(1, "Serial number is required")
    .max(100, "Serial number too long (max 100 chars)")
    .optional(),
  name: z
    .string()
    .min(1, "Item name is required")
    .max(200, "Name too long (max 200 chars)"),
  locationId: z.uuid("Invalid location ID format"),
  stored: z.boolean().optional(),
  tags: z.array(tagInput),
  costCents: z
    .number()
    .int("Must be an integer")
    .nonnegative("Cost cannot be negative")
    .optional(),
  consumable: createConsumableInput.optional(),
});

export const updateItemInput = itemInput.extend({
  id: z.string().nonempty(),
});

// UPDATE INPUT SCHEMA (For PATCH requests)
export const itemUpdateInput = itemInput.partial();

export type ItemGetOutput = inferProcedureOutput<(typeof itemRouter)["get"]>;
export type ItemCreateOutput = inferProcedureOutput<
  (typeof itemRouter)["create"]
>;
export type ItemUpdateOutput = inferProcedureOutput<
  (typeof itemRouter)["update"]
>;
export type ItemDeleteOutput = inferProcedureOutput<
  (typeof itemRouter)["delete"]
>;
export type ItemListOutput = inferProcedureOutput<(typeof itemRouter)["list"]>;
