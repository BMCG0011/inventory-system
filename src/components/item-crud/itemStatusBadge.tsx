import { getItemStatusBadgeConfig, ItemStatus } from "@/lib/item-status";
import { Badge } from "../ui/badge";

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const config = getItemStatusBadgeConfig(status);
  if (!config) return null;

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.name}
    </Badge>
  );
}
