import fs from "node:fs";
import * as anchor from "@coral-xyz/anchor";
import BN from "bn.js";
import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";

const RPC = "https://api.devnet.solana.com";
const PROGRAM = new PublicKey("5qjmvHtiiMPS4U9HsodyUhMw297WsRmSpqeesEZgcupy");
const MINT = new PublicKey("67tawTkJ6Ft2k7SJER8KuP1aQBbgdZMrFyJfUJT7tzZU");
const creator = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("/home/mayhikal/phantom-solana.json", "utf8"))));
const oracle = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync("/home/mayhikal/.config/solana/acai-oracle-keypair.json", "utf8"))));
const clipperPath = "/tmp/acai-devnet-smoke-clipper.json";
const clipper = fs.existsSync(clipperPath)
  ? Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(clipperPath, "utf8"))))
  : Keypair.generate();
if (!fs.existsSync(clipperPath)) {
  fs.writeFileSync(clipperPath, JSON.stringify([...clipper.secretKey]), { mode: 0o600 });
}
const connection = new Connection(RPC, "confirmed");
const idl = JSON.parse(fs.readFileSync(new URL("../anchor/target/idl/vault.json", import.meta.url), "utf8"));
const wallet = new anchor.Wallet(creator);
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
const program = new anchor.Program(idl, provider);
const bn = (n) => new BN(String(n));
const seed64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const pda = (...seeds) => PublicKey.findProgramAddressSync(seeds, PROGRAM)[0];
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => Math.floor(Date.now() / 1000);
const campaignId = BigInt(Date.now());
const termsHash = Buffer.alloc(32, 7);
const videoId = "SmokeDev001";
const campaign = pda(Buffer.from("campaign"), creator.publicKey.toBuffer(), seed64(campaignId));
const vault = pda(Buffer.from("vault"), campaign.toBuffer());
const config = pda(Buffer.from("config"));
const submission = pda(Buffer.from("submission"), campaign.toBuffer(), Buffer.from(videoId));
const stats = pda(Buffer.from("stats"), campaign.toBuffer(), clipper.publicKey.toBuffer());
const report = pda(Buffer.from("report"), submission.toBuffer());
const creatorAta = getAssociatedTokenAddressSync(MINT, creator.publicKey);
const clipperAta = getAssociatedTokenAddressSync(MINT, clipper.publicKey);
const start = now() - 5;
const end = now() + 45;
const settlement = 16;

async function run(label, builder, signers = []) {
  const ready = signers.length ? builder.signers(signers) : builder;
  if (!signers.length) {
    const sim = await ready.simulate();
    if (sim.raw?.some((line) => line.includes("failed"))) throw new Error(label + " simulation failed");
  }
  const signature = await ready.rpc({ commitment: "confirmed" });
  console.log(`✓ ${label}: ${signature}`);
  return signature;
}

console.log({ cluster: "devnet", program: PROGRAM.toBase58(), creator: creator.publicKey.toBase58(), oracle: oracle.publicKey.toBase58(), clipper: clipper.publicKey.toBase58(), mint: MINT.toBase58(), budgetBaseUnits: 1_000_000, campaign: campaign.toBase58() });
const fundClipper = await sendAndConfirmTransaction(
  connection,
  new Transaction().add(SystemProgram.transfer({ fromPubkey: creator.publicKey, toPubkey: clipper.publicKey, lamports: 10_000_000 })),
  [creator],
  { commitment: "confirmed" }
);
console.log(`✓ fund temporary clipper: `);
await createAssociatedTokenAccountIdempotent(connection, creator, MINT, clipper.publicKey, { commitment: "confirmed" });

await run("initialize campaign", program.methods.initializeCampaign({ campaignId: bn(campaignId), termsHash: [...termsHash], cpm: bn(1_000_000), maxPayoutPerVideo: bn(1_000_000), budget: bn(1_000_000), startTime: bn(start), endTime: bn(end), reviewPeriod: bn(30), appealWindow: bn(5), appealTimeout: bn(5), settlementPeriod: bn(settlement), maxReportAge: bn(60), finalSnapshotTolerance: bn(5), clockSkewTolerance: bn(1), maxVideosPerClipper: 1 }).accountsStrict({ campaign, mint: MINT, creator: creator.publicKey, systemProgram: SystemProgram.programId }));
await run("fund campaign", program.methods.fundCampaign().accountsStrict({ campaign, vault, creatorTokenAccount: creatorAta, mint: MINT, creator: creator.publicKey, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId, rent: anchor.web3.SYSVAR_RENT_PUBKEY }));
await run("register submission", program.methods.registerSubmission(videoId, [...termsHash]).accountsStrict({ campaign, submission, stats, clipper: clipper.publicKey, systemProgram: SystemProgram.programId }), [clipper]);
await run("accept submission", program.methods.acceptSubmission().accountsStrict({ campaign, submission, stats, creator: creator.publicKey }));
const oracleProgram = new anchor.Program(idl, new anchor.AnchorProvider(connection, new anchor.Wallet(oracle), provider.opts));
await run("oracle baseline", oracleProgram.methods.submitOracleReport(bn(100), bn(now()), false).accountsStrict({ config, campaign, submission, report, oracle: oracle.publicKey, systemProgram: SystemProgram.programId }));
await pause(1200);
await run("oracle increment", oracleProgram.methods.submitOracleReport(bn(101), bn(now()), false).accountsStrict({ config, campaign, submission, report, oracle: oracle.publicKey, systemProgram: SystemProgram.programId }));
await run("claim", program.methods.claim().accountsStrict({ config, campaign, vault, submission, report, clipperTokenAccount: clipperAta, mint: MINT, clipper: clipper.publicKey, tokenProgram: TOKEN_PROGRAM_ID }), [clipper]);
const settlementEnd = end + settlement;
for (;;) {
  const slot = await connection.getSlot("confirmed");
  const chainTime = await connection.getBlockTime(slot);
  if (chainTime != null && chainTime > settlementEnd) break;
  console.log("Waiting for on-chain settlement clock...");
  await pause(3000);
}
await run("refund", program.methods.refund().accountsStrict({ campaign, vault, creatorTokenAccount: creatorAta, mint: MINT, creator: creator.publicKey, tokenProgram: TOKEN_PROGRAM_ID }));
await run("close submission first", program.methods.closeSubmission().accountsStrict({ campaign, submission, clipper: clipper.publicKey }), [clipper]);
await run("close report after submission", oracleProgram.methods.closeReport().accountsStrict({ campaign, report, config, recipient: oracle.publicKey, signer: oracle.publicKey }));
await run("close stats", program.methods.closeStats().accountsStrict({ campaign, stats, clipper: clipper.publicKey }), [clipper]);
const clipperBalance = await connection.getBalance(clipper.publicKey, "confirmed");
if (clipperBalance > 5000) {
  const sweep = await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({ fromPubkey: clipper.publicKey, toPubkey: creator.publicKey, lamports: clipperBalance - 5000 })), [clipper], { commitment: "confirmed" });
  console.log(`✓ return temporary SOL: `);
}
fs.unlinkSync(clipperPath);
console.log("DEVNET SMOKE PASSED", { campaign: campaign.toBase58(), clipper: clipper.publicKey.toBase58() });
