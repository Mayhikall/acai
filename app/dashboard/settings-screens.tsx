"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "../lib/api/client";
import { useApi } from "../lib/api/hooks";
import { useAuth } from "../lib/auth/context";
import { AUSDC_MINT } from "../lib/transactions/intents";
import { DataState, PageHeader, styles } from "./workspace-ui";

type Channel = { title: string; channel_id: string; subscriber_count: number };

export function YoutubeSettings() {
  const { session } = useAuth();
  const response = useApi<{ channel: Channel | null }>("/youtube/channel");
  const [busy, setBusy] = useState(false);
  const connect = async () => {
    if (!session) return;
    setBusy(true);
    try {
      const result = await apiRequest<{ url?: string; connected?: boolean }>(
        "/youtube/connect",
        { token: session.token }
      );
      if (result.url) location.href = result.url;
      else {
        toast.success("YouTube channel connected");
        await response.mutate();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "YouTube connection failed"
      );
    } finally {
      setBusy(false);
    }
  };
  const revoke = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await apiRequest<void>("/youtube/channel", {
        method: "DELETE",
        token: session.token,
      });
      toast.success("YouTube access revoked");
      await response.mutate();
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="YouTube channel"
        description="Read-only OAuth is used to verify video ownership and view counts."
      />
      <section className={styles.panel}>
        <DataState loading={response.isLoading} error={response.error} />
        {response.data && (
          <div className={styles.panelBody}>
            {response.data.channel ? (
              <>
                <dl className={styles.details}>
                  <div>
                    <dt>Channel</dt>
                    <dd>{response.data.channel.title}</dd>
                  </div>
                  <div>
                    <dt>Channel ID</dt>
                    <dd>{response.data.channel.channel_id}</dd>
                  </div>
                  <div>
                    <dt>Subscribers</dt>
                    <dd>{response.data.channel.subscriber_count}</dd>
                  </div>
                </dl>
                <div className={styles.actions}>
                  <button
                    className={`${styles.button} ${styles.buttonSecondary}`}
                    type="button"
                    disabled={busy}
                    onClick={() => void revoke()}
                  >
                    Revoke access
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>No YouTube channel connected yet.</p>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    type="button"
                    disabled={busy}
                    onClick={() => void connect()}
                  >
                    Connect YouTube
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </>
  );
}

export function DevnetSettings() {
  const { session } = useAuth();
  const [busy, setBusy] = useState(false);
  const faucet = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await apiRequest("/faucet", { method: "POST", token: session.token });
      toast.success("aUSDC faucet request completed");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Faucet unavailable"
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Devnet tools"
        description="Tokens and transactions here are for testing only and have no real-world value."
      />
      <section className={styles.panel}>
        <div className={styles.panelBody}>
          <dl className={styles.details}>
            <div>
              <dt>Cluster</dt>
              <dd>Solana Devnet</dd>
            </div>
            <div>
              <dt>Program</dt>
              <dd>CceJ…6K8E</dd>
            </div>
            <div>
              <dt>aUSDC mint</dt>
              <dd>{AUSDC_MINT}</dd>
            </div>
          </dl>
          <div className={styles.actions}>
            <button
              className={styles.button}
              type="button"
              disabled={busy}
              onClick={() => void faucet()}
            >
              Request test aUSDC
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
