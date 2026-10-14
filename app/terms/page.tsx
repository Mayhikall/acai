import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Acai",
  description: "Terms for using the Acai Devnet product.",
};

export default function Page() {
  return (
    <main style={{ maxWidth: 760, margin: "80px auto", padding: 24 }}>
      <p>Acai</p>
      <h1>Terms of service</h1>
      <p>
        Acai is currently a Solana Devnet product. Any aUSDC shown in the app is
        a test token with no real-world monetary value and should not be treated
        as an investment or promise of payment.
      </p>
      <p>
        Campaign creators define their own briefs, review rules, deadlines, and
        reward terms. Read those terms before submitting a clip. On-chain
        actions are confirmed by your wallet and may not be reversible.
      </p>
      <p>
        Use Acai lawfully and only connect accounts and channels you control. We
        may pause or remove access when necessary to protect the service or its
        users.
      </p>
      <Link href="/">Back to Acai</Link>
    </main>
  );
}
