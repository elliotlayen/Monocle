import type { StateCreator } from "zustand";
import type { TreeSlice } from "./tree-slice";
import type { UiSlice } from "./ui-slice";
import type { TabsSlice } from "./tabs-slice";
import type { ScanSlice } from "./scan-slice";
import type { SearchSlice } from "./search-slice";

export type DateRange = { from?: Date; to?: Date } | null;

export type ExplorerStore = TreeSlice &
  UiSlice &
  TabsSlice &
  ScanSlice &
  SearchSlice;

export type SliceCreator<T> = StateCreator<ExplorerStore, [], [], T>;
