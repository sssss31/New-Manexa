"use client";

import { RouteError } from "@/components/feedback/RouteError";

export default function Error(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} scope="teacher portal" home="/teacher" />;
}
