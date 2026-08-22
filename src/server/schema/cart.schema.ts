import z from "zod";

export const cartItemSchema = z.object({
  id: z.uuid(),
  quantity: z
    .number()
    .min(1, "Quantity must be at least 1")
    .int("Quantity must be a whole number"),
});

export const cartFormSchema = z.object({
  items: z.array(cartItemSchema),
});

export type CartForm = z.infer<typeof cartFormSchema>;
