import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { validateSchema } from "../endpoint.utils";
import { prisma } from "@/server/lib/prisma";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

export const cartItemSchema = z.object({
  itemId: z.uuid(),
  quantity: z.number().min(1),
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Used for check-in / checkout-out
export const validateCart = async (cart: CartItem[]) => {
  return await Promise.all(
    cart.map(async (item) => {
      validateSchema(cartItemSchema, item);
      const itemResponse = await lookUpItemByUuid(item.itemId);
      return {
        ...itemResponse,
        quantity: item.quantity,
      };
    }),
  );
};

export const lookUpItemByUuid = async (id: string) => {
  validateSchema(z.uuid(), id);

  try {
    const item = await prisma.item.findUniqueOrThrow({
      where: {
        id: id,
        deleted: false,
      },
      include: {
        consumable: true,
        ItemRecords: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    return {
      ok: true as const,
      data: item,
    };
  } catch (error) {
    const prismaError = error as PrismaClientKnownRequestError;

    if (prismaError.code === "P2025") {
      return {
        ok: false as const,
        failure: `Item with ${id} does not exist within the database`,
      };
    }

    return {
      ok: false as const,
      failure: prismaError.message,
    };
  }
};

export const getByUuid = async (id: string) => {
  try {
    const item = await prisma.item.findUniqueOrThrow({
      where: { id: id, deleted: false },
      include: {
        location: true,
        tags: true,
        consumable: true,
        ItemRecords: true,
      },
    });

    return item;
  } catch (error) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Item with ${id} does not exist within the database`,
        });
      }
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch item, try again in a few moments",
    });
  }
};