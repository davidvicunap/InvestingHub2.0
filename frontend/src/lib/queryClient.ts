// TanStack Query client with an IndexedDB-backed persistence layer. Historical
// data (candles, fundamentals) survives reloads, so reopening the terminal
// paints instantly from cache while the network revalidates in the background.

import { QueryClient } from '@tanstack/react-query'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { get, set, del } from 'idb-keyval'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // treat data fresh for 1 min before revalidating
      gcTime: 24 * 60 * 60 * 1000, // keep in cache for a day
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// idb-keyval as the async storage surface the persister expects.
export const idbPersister = createAsyncStoragePersister({
  key: 'ih-terminal-query-cache',
  storage: {
    getItem: (k) => get(k).then((v) => v ?? null),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
})
