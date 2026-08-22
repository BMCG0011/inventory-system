import { badgeVariants } from "@/components/ui/variants";
import type { ItemStatus as PrismaItemStatus } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

// Re-exported as a plain runtime object (not imported from @prisma/client) so
// frontend code can reference status values without pulling the generated
// Prisma client into the browser bundle, which breaks at runtime (bare
// specifier ".prisma/client/index-browser" cannot be resolved outside Node).
export type ItemStatus = PrismaItemStatus;

export const ItemStatus = {
  CHURCH_USE: "CHURCH_USE",
  STORED: "STORED",
  IN_REPAIR: "IN_REPAIR",
  DISPOSED_OF: "DISPOSED_OF",
  ON_LOAN: "ON_LOAN",
} as const satisfies Record<ItemStatus, ItemStatus>;

export const itemStatusBadgeConfig: {
  value: ItemStatus;
  name: string;
  variant?: VariantProps<typeof badgeVariants>["variant"];
  className?: string;
  selectable?: boolean;
}[] = [
  {
    value: "CHURCH_USE",
    name: "Church Use",
    className: "bg-blue-600 text-white hover:bg-blue-700",
  },
  {
    value: "STORED",
    name: "Stored",
    variant: "secondary",
  },
  {
    value: "IN_REPAIR",
    name: "In Repair",
    className: "bg-orange-600 text-white hover:bg-orange-700",
  },
  {
    value: "DISPOSED_OF",
    name: "Disposed Of",
    variant: "destructive",
  },
  {
    value: "ON_LOAN",
    name: "On Loan",
    variant: "default",
    selectable: false,
  },
];

export function getItemStatusBadgeConfig(status: ItemStatus) {
  return itemStatusBadgeConfig.filter(({ value }) => value === status)?.[0];
}
