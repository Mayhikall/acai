export function createSignInMessage({
  domain,
  uri,
  wallet,
  nonce,
  issuedAt,
  expirationTime,
  chain,
}) {
  return [
    `${domain} wants you to sign in with your Solana account:`,
    wallet,
    "",
    "Sign in to Acai",
    "",
    `URI: ${uri}`,
    "Version: 1",
    `Chain ID: solana:${chain}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ].join("\n");
}
