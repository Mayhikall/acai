"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeDollarSign,
  Check,
  Clapperboard,
  LoaderCircle,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { AcaiLogo } from "@/app/components/acai-logo";
import { useWallet } from "@/app/lib/wallet/context";
import { useAuth } from "@/app/lib/auth/context";
import styles from "./connect.module.css";

export function ConnectWallet({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const { connectors, connect, error, isReady, status, wallet } = useWallet();
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "authenticated") router.replace(nextPath);
  }, [auth.status, nextPath, router]);

  const errorMessage =
    error instanceof Error
      ? error.message
      : error
        ? "We couldn't connect your wallet. Please try again."
        : null;

  return (
    <main className={styles.page}>
      <section className={styles.connectSide} aria-labelledby="connect-title">
        <div className={styles.connectInner}>
          <header className={styles.header}>
            <Link href="/" aria-label="Back to the Acai home page">
              <AcaiLogo />
            </Link>
            <span>Solana Devnet</span>
          </header>

          <div className={styles.card}>
            <div className={styles.iconWrap} aria-hidden="true">
              <Wallet size={25} strokeWidth={1.8} />
            </div>
            <p className={styles.eyebrow}>Your Acai workspace</p>
            <h1 id="connect-title">Connect your wallet</h1>
            <p className={styles.intro}>
              Your wallet is how Acai knows it&apos;s you. Connect once, then
              sign a free message. No transaction required.
            </p>

            <div className={styles.walletList} aria-live="polite">
              {!isReady ? (
                <div className={styles.loadingRow}>
                  <LoaderCircle className={styles.spinner} size={20} />
                  <span>Looking for an available wallet...</span>
                </div>
              ) : wallet ? (
                <button
                  className={styles.walletButton}
                  type="button"
                  disabled={auth.status === "authenticating"}
                  onClick={() => void auth.signIn()}
                >
                  <span className={styles.walletIdentity}>
                    <ShieldCheck size={20} aria-hidden="true" />
                    <span>
                      <strong>Sign in with your wallet</strong>
                      <small>Free to sign. No transaction.</small>
                    </span>
                  </span>
                  {auth.status === "authenticating" ? (
                    <LoaderCircle className={styles.spinner} size={19} />
                  ) : (
                    <ArrowRight size={19} aria-hidden="true" />
                  )}
                </button>
              ) : connectors.length > 0 ? (
                connectors.map((connector) => (
                  <button
                    className={styles.walletButton}
                    key={connector.id}
                    type="button"
                    disabled={status === "connecting"}
                    onClick={() => void connect(connector.id)}
                  >
                    <span className={styles.walletIdentity}>
                      {connector.icon ? (
                        <Image
                          src={connector.icon}
                          alt=""
                          width={34}
                          height={34}
                          unoptimized
                        />
                      ) : (
                        <Wallet size={20} aria-hidden="true" />
                      )}
                      <span>
                        <strong>{connector.name}</strong>
                        <small>Ready to connect</small>
                      </span>
                    </span>
                    {status === "connecting" ? (
                      <LoaderCircle className={styles.spinner} size={19} />
                    ) : (
                      <ArrowRight size={19} aria-hidden="true" />
                    )}
                  </button>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <strong>No Solana wallet found</strong>
                  <p>
                    Install or enable a Wallet Standard-compatible wallet, then
                    refresh this page.
                  </p>
                  <button
                    type="button"
                    onClick={() => window.location.reload()}
                  >
                    Refresh page
                  </button>
                </div>
              )}
            </div>

            {errorMessage && (
              <p className={styles.error} role="alert">
                {errorMessage}
              </p>
            )}

            {auth.error && (
              <p className={styles.error} role="alert">
                {auth.error}
              </p>
            )}

            {auth.status === "authenticated" && (
              <p className={styles.connected}>
                <Check size={16} /> You&apos;re in. Opening your workspace...
              </p>
            )}

            <div className={styles.safetyNote}>
              <ShieldCheck size={18} aria-hidden="true" />
              <p>
                Acai will never ask for your private key or recovery phrase.
                You&apos;ll always approve sign-in inside your wallet.
              </p>
            </div>
          </div>

          <Link className={styles.backLink} href="/">
            <ArrowLeft size={16} /> Back to home
          </Link>
        </div>
      </section>

      <aside className={styles.storySide} aria-label="About Acai">
        <div className={styles.orb} aria-hidden="true" />
        <div className={styles.grid} aria-hidden="true" />
        <div className={styles.storyContent}>
          <span className={styles.storyKicker}>Creator + Clipper</span>
          <h2>
            One wallet.
            <br />
            Two ways to create.
          </h2>
          <p className={styles.storyIntro}>
            Discover campaigns, turn great moments into clips, and track
            view-based rewards in one Solana workspace.
          </p>

          <div className={styles.roles}>
            <article>
              <span>
                <Clapperboard size={20} />
              </span>
              <div>
                <strong>For clippers</strong>
                <p>
                  Find a brief, publish your clip, and track every submission.
                </p>
              </div>
            </article>
            <article>
              <span>
                <BadgeDollarSign size={21} />
              </span>
              <div>
                <strong>For creators</strong>
                <p>Fund campaigns and review every clip in one place.</p>
              </div>
            </article>
          </div>
        </div>

        <footer className={styles.storyFooter}>
          <span>
            <i /> Solana Devnet
          </span>
          <span>Demo rewards in aUSDC</span>
        </footer>
      </aside>
    </main>
  );
}
