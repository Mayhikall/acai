"use client";

import useSWR from "swr";
import { useAuth } from "../auth/context";
import { apiRequest } from "./client";

export function useApi<T>(
  path: string | null,
  options: { refreshInterval?: number } = {}
) {
  const { session, status } = useAuth();
  return useSWR<T>(
    path && session && status === "authenticated"
      ? ["api", path, session.token]
      : null,
    ([, requestPath, token]) =>
      apiRequest<T>(requestPath as string, { token: token as string }),
    options
  );
}

export function usePublicApi<T>(path: string | null) {
  return useSWR<T>(path ? ["public-api", path] : null, ([, requestPath]) =>
    apiRequest<T>(requestPath as string)
  );
}
