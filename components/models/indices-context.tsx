"use client";

import { createContext, useContext } from "react";
import type { IndexWithLatest } from "@/lib/db/indices";

const IndicesContext = createContext<IndexWithLatest[]>([]);

export const IndicesProvider = IndicesContext.Provider;
export const useIndices = () => useContext(IndicesContext);
