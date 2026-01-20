"use client";

import { createContext, useContext, useState, useCallback } from "react";

type RefreshContextType = {
  refresh: () => void;
  registerRefresh: (fn: () => void | Promise<void>) => () => void;
};

const RefreshContext = createContext<RefreshContextType | null>(null);

export function RefreshProvider({ children }: { children: React.ReactNode }) {
  const [refreshCallbacks, setRefreshCallbacks] = useState<
    Set<() => void | Promise<void>>
  >(new Set());

  const registerRefresh = useCallback(
    (fn: () => void | Promise<void>) => {
      setRefreshCallbacks((prev) => new Set(prev).add(fn));
      return () => {
        setRefreshCallbacks((prev) => {
          const next = new Set(prev);
          next.delete(fn);
          return next;
        });
      };
    },
    [],
  );

  const refresh = useCallback(async () => {
    const promises = Array.from(refreshCallbacks).map((fn) => fn());
    await Promise.all(promises);
  }, [refreshCallbacks]);

  return (
    <RefreshContext.Provider value={{ refresh, registerRefresh }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const context = useContext(RefreshContext);
  if (!context) {
    throw new Error("useRefresh must be used within RefreshProvider");
  }
  return context;
}
