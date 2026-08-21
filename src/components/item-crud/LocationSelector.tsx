import type { AppRouter } from "@/server/api/routers/_app";
import type { inferProcedureOutput } from "@trpc/server";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Button } from "../ui/button";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { cn, truncateString } from "@/lib/utils";
import React, { useState, type ReactNode } from "react";
import { useLocation } from "@/hooks/use-location";

type GetSingleLocationOutput = inferProcedureOutput<
  AppRouter["location"]["get"]
>;

interface LocationSelectorProps {
  parentId?: string | null;
  value: string;
  onSelect: (
    locationId: string,
    locationData: GetSingleLocationOutput | null,
  ) => void | boolean;
  key: React.Key | null;
  listPrefix?: ReactNode;
  keepOpen?: boolean;
  valueText?: string | null;
}

// TODO: Update levels to show and path
export function LocationSelector({
  parentId = null,
  value,
  onSelect,
  key = null,
  listPrefix = null,
  valueText = null
}: LocationSelectorProps) {
  const [open, setOpen] = useState(false);

  const { locations, isLoading } = useLocation(parentId);
  const isLeafNode = locations && locations.length <= 0;

  const handleSelect = (selectedName: string) => {
    const location = locations?.find(
      (location) => location.name === selectedName,
    );

    // On time select
    if (location) {
      const newValue = location.id === value ? "" : location.id;
      const result = onSelect(newValue, newValue ? location : null);
      if (result !== false) {
        setOpen(false);
      }
    }
  };

  if (!isLeafNode) {
    return (
      <Popover open={open} onOpenChange={setOpen} key={key}>
        <PopoverTrigger asChild>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-[150px] justify-between"
            >
              {valueText ? truncateString(valueText, 12) : value && locations
                ? truncateString(
                    locations.find((location) => location.id === value)?.name ??
                      "Select location",
                    12,
                  )
                : "Select location"}
              <ChevronsUpDown className="opacity-50" />
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-[150px] p-0">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Command>
              <CommandInput placeholder="Search locations" className="h-9" />
              <CommandList>
                <CommandEmpty>No child locations found</CommandEmpty>
                <CommandGroup>
                  {listPrefix}
                  {locations?.map((location) => (
                    <CommandItem
                      key={location.id}
                      value={location.name}
                      onSelect={handleSelect}
                    >
                      {location.name}
                      <Check
                        className={cn(
                          "ml-auto",
                          value === location.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return <></>;
}
