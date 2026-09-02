import { create } from "zustand";
import type { ExplorerStore } from "./store-types";
import { createTreeSlice } from "./tree-slice";
import { createUiSlice } from "./ui-slice";
import { createTabsSlice } from "./tabs-slice";
import { createScanSlice } from "./scan-slice";
import { createSearchSlice } from "./search-slice";

export type { DateRange, ExplorerStore } from "./store-types";
export { parseSearchTermsFrontend } from "./search-slice";

export const useExplorerStore = create<ExplorerStore>((...args) => ({
  ...createTreeSlice(...args),
  ...createUiSlice(...args),
  ...createTabsSlice(...args),
  ...createScanSlice(...args),
  ...createSearchSlice(...args),
}));
