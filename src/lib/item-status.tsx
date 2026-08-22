import { Badge, badgeVariants } from "@/components/ui/badge";
import type { ItemStatus } from "@prisma/client";
import type { VariantProps } from "class-variance-authority";

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

export function getItemStatusBadge(status: ItemStatus) {
  const config = getItemStatusBadgeConfig(status);
  if (!config) return null;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.name}
    </Badge>
  );
}

export function getItemStatusBadgeConfig(status: ItemStatus) {
  return itemStatusBadgeConfig.filter(({ value }) => value === status)?.[0];
}
