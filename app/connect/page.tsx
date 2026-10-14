import type { Metadata } from "next";
import { ConnectWallet } from "./connect-wallet";

export const metadata: Metadata = {
  title: "Connect wallet | Acai",
  description: "Connect a Solana wallet to enter the Acai dashboard demo.",
};

function safeNextPath(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : "/dashboard";
}

export default async function ConnectPage({
  searchParams,
}: PageProps<"/connect">) {
  const query = await searchParams;
  return <ConnectWallet nextPath={safeNextPath(query.next)} />;
}
