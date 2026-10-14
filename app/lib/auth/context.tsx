"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { apiRequest } from "../api/client";
import { useWallet } from "../wallet/context";
import { encodeBase58 } from "./base58";

const SESSION_KEY = "acai:session";

type StoredSession = {
  token: string;
  wallet: string;
  expiresAt: string;
};

type AuthStatus =
  "loading" | "unauthenticated" | "authenticating" | "authenticated" | "error";

type AuthContextValue = {
  status: AuthStatus;
  session?: StoredSession;
  error?: string;
  signIn: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readSession(): StoredSession | undefined {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    const value = JSON.parse(raw) as StoredSession;
    if (
      !value.token ||
      !value.wallet ||
      Date.parse(value.expiresAt) <= Date.now()
    ) {
      sessionStorage.removeItem(SESSION_KEY);
      return undefined;
    }
    return value;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return undefined;
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const { wallet, disconnect } = useWallet();
  const [session, setSession] = useState<StoredSession>();
  const [status, setStatus] = useState<AuthStatus>("unauthenticated");
  const [error, setError] = useState<string>();

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(undefined);
    setStatus("unauthenticated");
  }, []);

  useEffect(() => {
    const stored = readSession();
    if (!stored) return;
    if (wallet && stored.wallet !== wallet.account.address) {
      const timeout = window.setTimeout(clearSession, 0);
      return () => window.clearTimeout(timeout);
    }
    void apiRequest<{ user: { wallet: string } }>("/auth/me", {
      token: stored.token,
    })
      .then(({ user }) => {
        if (user.wallet !== stored.wallet) throw new Error("Wallet mismatch");
        setSession(stored);
        setStatus("authenticated");
      })
      .catch(clearSession);
  }, [clearSession, wallet]);

  const signIn = useCallback(async () => {
    if (!wallet) throw new Error("Connect your wallet first.");
    if (!wallet.signMessage) {
      setStatus("error");
      setError("This wallet does not support message signing.");
      return;
    }
    setStatus("authenticating");
    setError(undefined);
    try {
      const walletAddress = wallet.account.address;
      const challenge = await apiRequest<{
        message: string;
        expiresAt: string;
      }>("/auth/nonce", {
        method: "POST",
        body: { wallet: walletAddress },
      });
      const signature = await wallet.signMessage(
        new TextEncoder().encode(challenge.message)
      );
      const verified = await apiRequest<StoredSession>("/auth/verify", {
        method: "POST",
        body: {
          wallet: walletAddress,
          message: challenge.message,
          signature: encodeBase58(signature),
        },
      });
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(verified));
      setSession(verified);
      setStatus("authenticated");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Wallet sign-in failed.";
      setError(message);
      setStatus("error");
    }
  }, [wallet]);

  const logout = useCallback(async () => {
    if (session) {
      await apiRequest<void>("/auth/logout", {
        method: "POST",
        token: session.token,
      }).catch(() => undefined);
    }
    clearSession();
    await disconnect();
  }, [clearSession, disconnect, session]);

  const value = useMemo(
    () => ({
      status,
      session,
      error,
      signIn,
      logout,
      clearError: () => setError(undefined),
    }),
    [error, logout, session, signIn, status]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
