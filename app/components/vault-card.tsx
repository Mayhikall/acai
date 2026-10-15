"use client";

import { useWallet } from "../lib/wallet/context";
import { useCluster } from "./cluster-context";

export function VaultCard() {
  const { wallet, status } = useWallet();
  const { cluster } = useCluster();
  const isConnected = status === "connected" && !!wallet;

  return (
    <div className="w-full max-w-xl mx-auto rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-xl p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <span>🪙</span>
            Acai Smart Contract Ready
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Solana Devnet Escrow & Settlement Engine (PRD v4)
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Anchor 1.1.2
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50">
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-medium text-sm">
            <span>🛡️</span>
            Campaign Escrow
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Locked aUSDC vault with permissioned refunds & top-up
          </p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/50">
          <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300 font-medium text-sm">
            <span>🎬</span>
            Submissions
          </div>
          <p className="text-xs text-neutral-500 mt-1">
            Review window, appeal timeout & auto-accept finalized
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1">
        <div className="font-semibold flex items-center gap-1.5">
          <span>⚡</span> On-Chain Codama Client Generated
        </div>
        <div>
          Typed client instructions (InitializeConfig, InitializeCampaign,
          RegisterSubmission, SubmitOracleReport, Claim, Refund) are compiled
          and ready.
        </div>
      </div>

      <div className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center justify-between pt-2">
        <span>
          Connected:{" "}
          {isConnected
            ? `${wallet.account.address.slice(0, 4)}...${wallet.account.address.slice(-4)}`
            : "None"}
        </span>
        <span>Network: {cluster}</span>
      </div>
    </div>
  );
}
