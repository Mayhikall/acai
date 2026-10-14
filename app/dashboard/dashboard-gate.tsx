"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/app/lib/wallet/context";
import { useAuth } from "@/app/lib/auth/context";

export function DashboardGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isReady, status } = useWallet();
  const auth = useAuth();

  useEffect(() => {
    if (isReady && status !== "connected" && status !== "connecting") {
      router.replace(`/connect?next=${encodeURIComponent(location.pathname)}`);
    } else if (
      isReady &&
      status === "connected" &&
      auth.status === "unauthenticated"
    ) {
      router.replace(`/connect?next=${encodeURIComponent(location.pathname)}`);
    }
  }, [auth.status, isReady, router, status]);

  if (!isReady || status !== "connected" || auth.status !== "authenticated") {
    return (
      <main
        aria-busy="true"
        aria-label="Checking wallet connection"
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#101012",
          color: "#b49aff",
          fontFamily: "var(--font-barlow), Arial, sans-serif",
        }}
      >
        Verifying wallet and session...
      </main>
    );
  }

  return children;
}
