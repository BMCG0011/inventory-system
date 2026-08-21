import { useMemo, useState } from "react";
import { LocationSelector } from "./LocationSelector";
import type { inferProcedureOutput } from "@trpc/server";
import type { AppRouter } from "@/server/api/routers/_app";
import { CommandItem } from "../ui/command";
import { Check, ChevronLeft } from "lucide-react";

type GetSingleLocationOutput = inferProcedureOutput<
  AppRouter["location"]["get"]
>;

export default function NestingLocation({initialPath = [], onSelect = undefined}: {
    initialPath?: GetSingleLocationOutput[];
    onSelect?: (selectedId: string) => void; 
}) {
    const [selection, setSelection] = useState(initialPath);

    const [parentLocation, selectedId, selectedName] = useMemo<[GetSingleLocationOutput, string | null, string | null]>(() => {
        if (!selection) return [null, null, null];

        const lastSelected = selection[selection.length - 1];

        if ((lastSelected?.children.length ?? 0) > 0) {
            // parent is lastSelected, as is value
            return [lastSelected, lastSelected?.id ?? "", lastSelected?.name ?? null];
        }

        // parent is 2nd from end
        return [selection[selection.length - 2] ?? null, lastSelected?.id ?? "", lastSelected?.name ?? null];
    }, [selection])

    console.log(selection)

    return <LocationSelector 
        parentId={parentLocation?.id}
        value={selectedId ?? ""}
        valueText={selectedName}
        onSelect={(id, location) => {
            if (!location) return;

            // if selected location is a child of currently selected location, append to end
            if (location.parentId == selectedId) {
                console.log("child select");
                setSelection([...selection, location]);
            } else {
                console.log("non-child select")
                setSelection([...selection.slice(0, -1), location]);
            }

            onSelect?.(id);

            return location.children.length === 0;
        }}
        key={1}
        listPrefix={parentLocation && (
            <CommandItem
                onSelect={() => setSelection(selection.slice(0, -1))}
            >
                <ChevronLeft className="text-foreground-muted" />
                {parentLocation?.name}
                {selectedId === parentLocation.id && (<Check className="ml-auto" />)}
            </CommandItem>
        )}
    />
}