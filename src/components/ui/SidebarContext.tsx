import * as React from "react";
import type { SidebarContextProps } from "./sidebar";

export const SidebarContext = React.createContext<SidebarContextProps | null>(
  null,
);
