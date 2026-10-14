"use client";

import { useRef, useState } from "react";
import { ExternalLink, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "../lib/api/client";
import { useAuth } from "../lib/auth/context";
import { useSendTransaction } from "../lib/hooks/use-send-transaction";
import {
  compileIntent,
  type TransactionIntent,
  validateIntent,
} from "../lib/transactions/intents";
import { useWallet } from "../lib/wallet/context";
import { shortAddress } from "../lib/format";
import { styles } from "./workspace-ui";
import modalStyles from "./transaction.module.css";

type Props = {
  endpoint: string;
  body?:
    | BodyInit
    | Record<string, unknown>
    | (() => BodyInit | Record<string, unknown>);
  label: string;
  title: string;
  details: Array<[string, string]>;
  disabled?: boolean;
  onSuccess?: (signature: string) => void;
};

export function TransactionAction({
  endpoint,
  body,
  label,
  title,
  details,
  disabled,
  onSuccess,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { session } = useAuth();
  const { signer, wallet } = useWallet();
  const { simulate, send, isSending, isSimulating } = useSendTransaction();
  const [instructions, setInstructions] =
    useState<ReturnType<typeof compileIntent>>();
  const [simulationOk, setSimulationOk] = useState(false);
  const [confirmationEndpoint, setConfirmationEndpoint] = useState<string>();
  const [error, setError] = useState<string>();

  const review = async () => {
    if (!session || !signer || !wallet) return;
    setError(undefined);
    setSimulationOk(false);
    dialog.current?.showModal();
    try {
      const response = await apiRequest<{
        transaction: TransactionIntent | null;
        confirmation?: { endpoint?: string };
      }>(endpoint, {
        method: "POST",
        token: session.token,
        body: typeof body === "function" ? body() : body || {},
      });
      if (!response.transaction)
        throw new Error(
          "The oracle report is still being updated. Try claiming again when the request is ready."
        );
      validateIntent(
        response.transaction,
        signer,
        wallet.supportedTransactionVersions
      );
      if (response.transaction.transactionVersion !== 0)
        throw new Error(
          "This frontend currently supports only versioned v0 transactions."
        );
      const compiled = compileIntent(response.transaction, signer);
      await simulate({ instructions: compiled });
      const nextConfirmationEndpoint = response.confirmation?.endpoint;
      setConfirmationEndpoint(
        nextConfirmationEndpoint?.startsWith("/campaigns/intents/") &&
          nextConfirmationEndpoint.endsWith("/submitted")
          ? nextConfirmationEndpoint
          : undefined
      );
      setInstructions(compiled);
      setSimulationOk(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "We couldn't prepare this transaction. Please try again."
      );
    }
  };

  const confirm = async () => {
    if (!instructions || !simulationOk) return;
    try {
      const signature = await send({ instructions });
      if (confirmationEndpoint) {
        try {
          await apiRequest(confirmationEndpoint, {
            method: "POST",
            token: session?.token,
            body: { signature },
          });
        } catch {
          toast.info("Transaction sent", {
            description: "Acai is waiting for finalized network confirmation.",
          });
        }
      }
      toast.success("Transaction submitted", {
        description: "Waiting for network confirmation.",
      });
      dialog.current?.close();
      onSuccess?.(signature);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Transaction failed");
    }
  };

  return (
    <>
      <button
        className={styles.button}
        type="button"
        disabled={disabled}
        onClick={() => void review()}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className={modalStyles.dialog}
        onClose={() => {
          setInstructions(undefined);
          setSimulationOk(false);
          setConfirmationEndpoint(undefined);
          setError(undefined);
        }}
      >
        <div className={modalStyles.header}>
          <div>
            <span>Transaction review</span>
            <h2>{title}</h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <div className={modalStyles.body}>
          <div className={modalStyles.notice}>
            <ShieldCheck size={19} />
            <p>
              Review the details before approving this transaction in your
              wallet.
            </p>
          </div>
          <dl>
            {details.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <div>
              <dt>Network</dt>
              <dd>Solana Devnet</dd>
            </div>
            <div>
              <dt>Wallet</dt>
              <dd>{session?.wallet ? shortAddress(session.wallet) : "—"}</dd>
            </div>
          </dl>
          {error && (
            <p className={modalStyles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <div className={modalStyles.footer}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            type="button"
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          <button
            className={styles.button}
            type="button"
            disabled={!simulationOk || isSending}
            onClick={() => void confirm()}
          >
            {isSimulating ? (
              <>
                <LoaderCircle size={16} className={modalStyles.spin} />
                Preparing…
              </>
            ) : isSending ? (
              <>
                <LoaderCircle size={16} className={modalStyles.spin} /> Sending…
              </>
            ) : (
              <>
                Approve in wallet <ExternalLink size={15} />
              </>
            )}
          </button>
        </div>
      </dialog>
    </>
  );
}
