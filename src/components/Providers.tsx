"use client";

// App-wide client providers: React Query (client-side data fetching / caching —
// the RSC layer still owns server reads) and sonner toasts on the MANEXA palette.

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgb(var(--card))",
            color: "rgb(var(--fg))",
            border: "1px solid rgb(var(--border))",
            borderRadius: "12px",
          },
          className: "font-sans",
        }}
        theme="dark"
        richColors={false}
      />
    </QueryClientProvider>
  );
}
