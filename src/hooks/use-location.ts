import { trpc } from "@/client/trpc";

export function useLocation(parentId: string | null) {
  const {
    data: rootLocations,
    isLoading: rootLoading,
    error: rootError,
  } = trpc.location.getRoots.useQuery();

  const {
    data: childLocations,
    isLoading: childLoading,
    error: childError,
  } = trpc.location.getChildren.useQuery(
    { parentId: parentId! },
    { enabled: parentId !== null },
  );

  return {
    locations: parentId === null ? rootLocations : childLocations,
    isLoading: parentId === null ? rootLoading : childLoading,
    error: parentId === null ? rootError : childError,
  };
}

export function useLocationPath(locationId: string | null) {
  const {
    data: path,
    isLoading,
    error,
  } = trpc.location.getPath.useQuery(
    { id: locationId! },
    { enabled: locationId !== null },
  );

  return {
    path,
    isLoading,
    error,
  };
}
