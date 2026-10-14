import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Acai",
  description: "How Acai handles wallet and YouTube data.",
};

export default function Page() {
  return (
    <main style={{ maxWidth: 760, margin: "80px auto", padding: 24 }}>
      <p>Acai</p>
      <h1>Privacy policy</h1>
      <p>
        Acai uses your wallet address as your account identity. If you connect
        YouTube, we request read-only access to verify channel ownership, list
        videos you own, and read public view counts for eligible submissions.
      </p>
      <p>
        YouTube OAuth tokens are encrypted by our backend and can be revoked at
        any time from your dashboard settings. We do not ask for, store, or have
        access to your wallet private key or recovery phrase.
      </p>
      <p>
        Acai is currently a Solana Devnet product. Do not use the app as a
        substitute for financial, legal, or security advice.
      </p>
      <Link href="/">Back to Acai</Link>
    </main>
  );
}
