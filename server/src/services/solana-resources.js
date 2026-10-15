import {
  estimateResourceLimitsFactory,
  pipe,
  setTransactionMessageComputeUnitLimit,
  setTransactionMessageLoadedAccountsDataSizeLimit,
} from "@solana/kit";

const MAX_COMPUTE_UNITS = 1_400_000;
const MAX_LOADED_ACCOUNTS_BYTES = 64 * 1024 * 1024;

export async function estimateAndApplyResourceLimits({ rpc, message }) {
  const estimate = await estimateResourceLimitsFactory({ rpc })(message, {
    commitment: "confirmed",
  });
  const computeUnitLimit = Math.min(
    MAX_COMPUTE_UNITS,
    Math.ceil(estimate.computeUnitLimit * 1.1) + 1_000
  );
  const loadedAccountsDataSizeLimit =
    message.version === 1
      ? Math.min(
          MAX_LOADED_ACCOUNTS_BYTES,
          estimate.loadedAccountsDataSizeLimit + 64 * 1024
        )
      : null;
  const configuredMessage = pipe(
    message,
    (value) => setTransactionMessageComputeUnitLimit(computeUnitLimit, value),
    (value) =>
      message.version === 1
        ? setTransactionMessageLoadedAccountsDataSizeLimit(
            loadedAccountsDataSizeLimit,
            value
          )
        : value
  );
  return {
    message: configuredMessage,
    computeUnitLimit,
    loadedAccountsDataSizeLimit,
  };
}
