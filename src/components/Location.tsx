import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/client/trpc";
import type { inferProcedureOutput } from "@trpc/server";
import type { AppRouter } from "@/server/api/routers/_app";

interface Location {
  id: string; // UUID from database
  name: string; // Display name
  path: string; // URL path segment (id)
  parent: Location | null;
}

interface ComboboxOption {
  value: string; // Location ID
  label: string; // Location name
}

type GetLocationPathResponse = inferProcedureOutput<
  AppRouter["location"]["getPath"]
>;

export default function SelectableLocationBreadcrumb() {
  const [breadcrumbTrail, setBreadcrumbTrail] = useState<Location[] | null>(
    null,
  );
  const rawPath = useParams()["*"];
  const pathArr = useMemo(
    () => rawPath?.split("/").filter(Boolean) ?? [],
    [rawPath],
  );
  const location = useLocation();
  const navigate = useNavigate();
  const parentRoute = location.pathname.split("/")[1]; // Either "consumables" or "assets"

  // State for managing combobox open states and selected values
  const [openStates, setOpenStates] = useState<Record<string, boolean>>({});
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(
    {},
  );

  // Fetch all locations
  const { data: allLocations, isLoading: isLoadingLocations } =
    trpc.location.list.useQuery();

  // Add this useEffect near your other hooks
  useEffect(() => {
    if (breadcrumbTrail) {
      const initialValues: Record<string, string> = {};
      breadcrumbTrail.forEach((loc) => {
        initialValues[loc.id] = loc.id; // Set the current location ID as selected
      });
      setSelectedValues(initialValues);
    }
  }, [breadcrumbTrail]);

  // Build breadcrumb trail from URL segments
  useEffect(() => {
    if (!allLocations || isLoadingLocations) return;

    const locArr: Location[] = [];
    let currentParent: Location | null = null;

    for (const id of pathArr) {
      const locData = allLocations.find((loc) => loc.id === id);
      if (locData) {
        const loc: Location = {
          id: locData.id,
          name: locData.name,
          path: locData.id,
          parent: currentParent,
        };
        locArr.push(loc);
        currentParent = loc;
      }
    }

    setBreadcrumbTrail(locArr);
  }, [pathArr, allLocations, isLoadingLocations]);

  // Get combobox options for a given breadcrumb
  const getOptionsForLocation = (locId: string | null): ComboboxOption[] => {
    if (!allLocations) return [];

    if (!locId) {
      // Root level: return locations with no parent
      return allLocations
        .filter((loc) => !loc.parentId)
        .map((loc) => ({
          value: loc.id,
          label: loc.name,
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    // Return children of the given location
    return allLocations
      .filter((loc) => loc.parentId === locId)
      .map((loc) => ({
        value: loc.id,
        label: loc.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const handleOpenChange = (id: string, isOpen: boolean) => {
    setOpenStates((prev) => ({ ...prev, [id]: isOpen }));
  };

  const handleSelect = (id: string, value: string) => {
    let newPathArr = [...pathArr];

    // Toggle selection logic: if same value is clicked again, deselect it
    const newValue = selectedValues[id] === value ? "" : value;

    setSelectedValues((prev) => ({
      ...prev,
      [id]: newValue,
    }));

    setOpenStates((prev) => ({ ...prev, [id]: false }));

    if (id === "add") {
      if (newValue) {
        // Add new segment only if a new one was selected
        newPathArr.push(newValue);
        setSelectedValues((prev) => ({ ...prev, add: "" })); // Clear after add
      }
    } else {
      const index = breadcrumbTrail?.findIndex((loc) => loc.id === id) ?? -1;
      if (index >= 0) {
        if (newValue) {
          // Replace existing id with new value
          newPathArr[index] = newValue;
          newPathArr = newPathArr.slice(0, index + 1); // Truncate further breadcrumbs
        } else {
          // Value was deselected → remove this and deeper segments
          newPathArr = newPathArr.slice(0, index);
        }
      }
    }

    const newPath = `/${parentRoute}/${newPathArr.join("/")}`;
    void navigate(newPath);
  };

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbTrail?.length === 0 && (
          <BreadcrumbItem>
            <span className="text-muted-foreground">Select a location</span>
          </BreadcrumbItem>
        )}
        {breadcrumbTrail?.map((loc) => {
          const options = getOptionsForLocation(loc.parent?.id ?? null);
          return (
            <Fragment key={loc.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <Popover
                  open={openStates[loc.id] || false}
                  onOpenChange={(isOpen) => handleOpenChange(loc.id, isOpen)}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      role="combobox"
                      aria-expanded={openStates[loc.id] || false}
                      className="bg-background text-foreground hover:bg-accent justify-between"
                      disabled={isLoadingLocations}
                    >
                      {selectedValues[loc.id]
                        ? options.find(
                            (option) => option.value === selectedValues[loc.id],
                          )?.label
                        : loc.name}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-0">
                    <Command>
                      <CommandInput placeholder="Search location..." />
                      <CommandList>
                        {isLoadingLocations ? (
                          <CommandEmpty>Loading...</CommandEmpty>
                        ) : options.length === 0 ? (
                          <CommandEmpty>No location found.</CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {options.map((option) => (
                              <CommandItem
                                key={option.value}
                                value={option.value}
                                onSelect={(currentValue) =>
                                  handleSelect(loc.id, currentValue)
                                }
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedValues[loc.id] === option.value
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                                {option.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </BreadcrumbItem>
            </Fragment>
          );
        })}
        <Fragment key="add">
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <Popover
              open={openStates.add || false}
              onOpenChange={(isOpen) => handleOpenChange("add", isOpen)}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  role="combobox"
                  aria-expanded={openStates.add || false}
                  className="bg-background text-foreground hover:bg-accent justify-between"
                  disabled={isLoadingLocations}
                >
                  {selectedValues.add
                    ? getOptionsForLocation(
                        breadcrumbTrail?.[breadcrumbTrail.length - 1]?.id ??
                          null,
                      ).find((option) => option.value === selectedValues.add)
                        ?.label
                    : "+"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search location..." />
                  <CommandList>
                    {isLoadingLocations ? (
                      <CommandEmpty>Loading...</CommandEmpty>
                    ) : getOptionsForLocation(
                        breadcrumbTrail?.[breadcrumbTrail.length - 1]?.id ??
                          null,
                      ).length === 0 ? (
                      <CommandEmpty>No location found.</CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {getOptionsForLocation(
                          breadcrumbTrail?.[breadcrumbTrail.length - 1]?.id ??
                            null,
                        ).map((option) => (
                          <CommandItem
                            key={option.value}
                            value={option.value}
                            onSelect={(currentValue) =>
                              handleSelect("add", currentValue)
                            }
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedValues.add === option.value
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {option.label}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </BreadcrumbItem>
        </Fragment>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function StaticLocationBreadcrumb({path} : {path: GetLocationPathResponse}) {
  return <Breadcrumb>
    <BreadcrumbList className="text-foreground sm:gap-1 text-base">
    {path && 
      path.map((location, index) => ( <>
        <BreadcrumbItem>{location.name}</BreadcrumbItem>
        {index !== path.length - 1 ? <BreadcrumbSeparator /> : null}
      </>

      ))
    }
    </BreadcrumbList>
  </Breadcrumb>
}