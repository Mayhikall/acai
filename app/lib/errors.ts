import {
  isSolanaError,
  SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM,
} from "@solana/kit";
import { getVaultErrorMessage, type VaultError } from "../generated/vault";

const friendlyVaultErrors: Record<number, string> = {
  6000: "Only the campaign creator can perform this action.",
  6001: "Only the submission owner can perform this action.",
  6002: "The configured oracle must sign this report.",
  6003: "Only the current admin can perform this action.",
  6004: "The program upgrade authority must initialize the config.",
  6005: "The protocol configuration is already initialized.",
  6006: "One or more transaction parameters are invalid.",
  6007: "The selected payment token is invalid.",
  6008: "This campaign has not been funded.",
  6009: "This campaign is not active.",
  6010: "This campaign is already closed.",
  6011: "This action is outside the campaign time window.",
  6012: "A creator cannot submit to their own campaign.",
  6013: "The active video limit has been reached.",
  6014: "The total submission limit has been reached.",
  6015: "The submission is not in the required state.",
  6016: "The review deadline has passed.",
  6017: "The review deadline has not been reached.",
  6018: "The appeal window has closed.",
  6019: "This submission has already been appealed.",
  6020: "The initial view baseline is not ready yet.",
  6021: "This oracle report is not newer than the previous report.",
  6022: "The reported view count cannot decrease.",
  6023: "The oracle report timestamp is too far in the future.",
  6024: "The oracle report predates the submission.",
  6025: "A non-final report cannot be recorded after campaign end.",
  6026: "The final report is outside the allowed snapshot window.",
  6027: "A final report has already been recorded.",
  6028: "A baseline is required before the final report.",
  6029: "The report was signed by an old oracle; refresh it first.",
  6030: "The view report is stale; request a fresh report.",
  6031: "The final view report is still pending.",
  6032: "The settlement period has ended.",
  6033: "The settlement period has not ended.",
  6034: "There is no remaining reward to claim.",
  6035: "The campaign reward pool is empty.",
  6036: "The calculation exceeded the supported numeric range.",
};

export function parseTransactionError(err: unknown): string {
  // Wallet rejection (comes from wallet-standard, not a SolanaError)
  if (err instanceof Error && err.message.includes("User rejected")) {
    return "Transaction was rejected by the wallet.";
  }

  // Anchor custom program errors — use the Codama-generated error messages
  if (
    isSolanaError(err, SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM) &&
    typeof err.context?.code === "number"
  ) {
    const friendly = friendlyVaultErrors[err.context.code];
    if (friendly) return friendly;
    try {
      const msg = getVaultErrorMessage(err.context.code as VaultError);
      if (msg) return msg;
    } catch {
      // not a recognized program error
    }
  }

  // For all other errors, kit's SolanaError already has readable messages.
  // Walk the cause chain to find the deepest message.
  const message = getDeepestMessage(err);
  return message.length > 200 ? `${message.slice(0, 200)}...` : message;
}

function getDeepestMessage(err: unknown): string {
  let deepest = err instanceof Error ? err.message : String(err);
  let current: unknown = err;

  while (current instanceof Error && current.cause) {
    current = current.cause;
    if (current instanceof Error) {
      deepest = current.message;
    }
  }

  return deepest;
}
