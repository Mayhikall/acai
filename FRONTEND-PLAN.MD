# Acai Frontend Plan

Status: implementation blueprint  
Target: Next.js App Router frontend, Acai API, dan Acai Vault Program di Solana Devnet  
Updated: 13 October 2026

## 1. Tujuan dokumen

Dokumen ini menjadi rencana utama untuk mengubah frontend demo Acai menjadi aplikasi MVP yang terhubung ke backend dan smart contract.

Rencana ini mencakup:

- landing page dan jalur masuk produk;
- koneksi wallet dan autentikasi berbasis signature;
- pemisahan pengalaman Creator dan Clipper;
- routing, menu, halaman, dan redirect;
- kontrak data frontend dengan backend;
- pemetaan action UI ke instruction smart contract;
- transaction review, simulation, signing, confirmation, dan indexer state;
- responsive design, accessibility, testing, dan tahapan delivery.

Dokumen ini tidak mengubah prinsip produk di `PRD.MD` dan tidak memperkenalkan role akun yang eksklusif.

## 2. Sumber kebenaran

Urutan sumber kebenaran yang digunakan frontend:

1. Smart contract dan finalized Solana state untuk kepemilikan dana, campaign, submission, report, claim, dan status on-chain.
2. `PRD.MD` untuk aturan bisnis dan expected user journey.
3. Backend API dan PostgreSQL sebagai cache/index dari finalized event serta penyimpan data off-chain.
4. `deployments/devnet.json` untuk deployment Devnet yang aktif.
5. `app/DESIGN.md` untuk bahasa visual.
6. `ARCHITECTURE DIAGRAM ACAI.pdf` untuk actor dan sequence flow.

Jika database belum menerima finalized event, frontend menampilkan status sinkronisasi dan tidak menganggap transaksi gagal.

## 3. Keputusan produk utama

### 3.1 Wallet adalah identity

Satu wallet adalah satu identitas pembayaran dan autentikasi. Wallet tidak diberi satu role permanen.

### 3.2 Creator dan Clipper adalah contextual roles

Satu wallet dapat:

- menjadi Creator pada campaign yang dibuatnya;
- menjadi Clipper pada campaign milik wallet lain;
- menggunakan kedua area produk dengan wallet yang sama;
- tidak dapat submit ke campaign miliknya sendiri.

Backend dan program menentukan permission melalui ownership, bukan melalui `users.role`:

```text
campaign.creator_wallet == authenticated_wallet
submission.clipper_wallet == authenticated_wallet
campaign.creator_wallet != submission.clipper_wallet
```

Di UI, istilah yang digunakan:

- `Clipper` untuk area mencari campaign, submission, appeal, dan claim;
- `Creator` untuk area membuat dan mengelola campaign;
- copy tambahan `Manage campaigns` dapat dipakai untuk memperjelas arti Creator.

### 3.3 Satu connect page

Creator dan Clipper tidak memiliki connect page terpisah. `/connect` hanya menangani:

1. wallet discovery;
2. connect wallet;
3. nonce request;
4. sign-in message;
5. session verification.

Pilihan area kerja dilakukan setelah autentikasi atau melalui workspace switcher.

### 3.4 URL adalah navigation state

Dashboard demo saat ini menggunakan satu komponen dengan state `screen`. Implementasi production harus menggunakan route nyata agar:

- refresh mempertahankan halaman;
- browser Back/Forward bekerja;
- link dapat dibagikan;
- setiap halaman memiliki loading, error, dan metadata sendiri;
- bundle dan data request dapat dipisahkan.

## 4. Information architecture

Public campaign discovery is intentionally deferred from the public surface. Campaigns are discovered inside the authenticated Clipper workspace.

```text
Public
├── /
├── /campaigns
├── /campaigns/[campaignId]
├── /connect
├── /privacy
└── /terms

Authenticated product
└── /dashboard
    ├── /clipper
    │   ├── /campaigns
    │   │   └── /[campaignId]
    │   ├── /submissions
    │   │   └── /[submissionId]
    │   └── /earnings
    ├── /creator
    │   ├── /campaigns
    │   │   ├── /new
    │   │   └── /[campaignId]
    │   │       └── /submissions
    │   └── /reviews
    │       └── /[submissionId]
    ├── /notifications
    └── /settings
        ├── /wallet
        ├── /youtube
        └── /devnet
```

Gunakan route statis `creator` dan `clipper`, bukan `/dashboard/[role]` atau query `?role=`. Route statis memberi type safety, menu, layout, dan authorization boundary yang lebih jelas.

## 5. Route specification

### 5.1 Public routes

| Route      | Tujuan                                 | Data                          | CTA utama                         |
| ---------- | -------------------------------------- | ----------------------------- | --------------------------------- |
| `/`        | Menjelaskan value proposition dua sisi | Konten statis                 | Find campaigns, launch a campaign |
| `/connect` | Connect wallet dan SIWS-style auth     | `/auth/nonce`, `/auth/verify` | Connect, sign in                  |
| `/privacy` | YouTube data usage, retention, revoke  | Konten legal                  | Manage YouTube access             |
| `/terms`   | Platform terms                         | Konten legal                  | Back to Acai                      |

Campaign discovery berada di workspace Clipper dan membutuhkan wallet session. Detail campaign yang memuat brief dan terms juga berada di route dashboard agar akses dan eligibility dapat divalidasi oleh backend.

### 5.2 Dashboard resolver

`/dashboard` tidak merender dashboard generik. Route ini melakukan resolver:

```text
wallet disconnected
→ /connect?next=/dashboard

wallet connected, no backend session
→ /connect?next=/dashboard&step=sign-in

authenticated, last workspace exists
→ /dashboard/{lastWorkspace}

authenticated, no preference
→ tampilkan activity chooser ringan
```

Preferensi `lastWorkspace` bukan permission. Untuk MVP dapat disimpan di local storage; jika kemudian perlu lintas perangkat, tambahkan user preferences di backend.

### 5.3 Clipper routes

| Route                                           | Isi utama                                                        | Action                          |
| ----------------------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| `/dashboard/clipper`                            | Ringkasan submission, deadline, claimable reward, YouTube status | Explore, connect YouTube, claim |
| `/dashboard/clipper/campaigns`                  | Campaign FUNDED yang aktif, filter dan search                    | Open campaign                   |
| `/dashboard/clipper/campaigns/[campaignId]`     | Brief, terms hash/PDF, CPM, cap, waktu, eligibility              | Select owned video, submit      |
| `/dashboard/clipper/submissions`                | Semua submission wallet                                          | Filter status, open detail      |
| `/dashboard/clipper/submissions/[submissionId]` | Timeline review, rejection reason, appeal window, views, claim   | Appeal, finalize timeout, claim |
| `/dashboard/clipper/earnings`                   | Total indexed payout dan history                                 | Open claim detail, explorer     |

### 5.4 Creator routes

| Route                                                   | Isi utama                                          | Action                         |
| ------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| `/dashboard/creator`                                    | Active campaigns, budget, review queue, deadline   | Create campaign, review        |
| `/dashboard/creator/campaigns`                          | Campaign milik wallet                              | Filter status, open campaign   |
| `/dashboard/creator/campaigns/new`                      | Multi-step campaign form                           | Create and fund                |
| `/dashboard/creator/campaigns/[campaignId]`             | Budget, vault, timeline, terms, submission summary | Top up, refund                 |
| `/dashboard/creator/campaigns/[campaignId]/submissions` | Submission campaign                                | Accept, reject, final decision |
| `/dashboard/creator/reviews/[submissionId]`             | Video metadata, brief compliance, reason/appeal    | Accept or reject               |

### 5.5 Shared routes

| Route                         | Isi utama                                                  |
| ----------------------------- | ---------------------------------------------------------- |
| `/dashboard/notifications`    | Notification feed lintas Creator/Clipper                   |
| `/dashboard/settings/wallet`  | Address, cluster, SOL/aUSDC balances, disconnect, explorer |
| `/dashboard/settings/youtube` | Channel status, reconnect, revoke, privacy link            |
| `/dashboard/settings/devnet`  | Faucet aUSDC, network notice, program/mint address         |

The faucet is a signed-in Devnet utility, not a public landing-page CTA. Users reach it from Wallet settings after connecting a wallet; the backend enforces Devnet-only access and the per-wallet cooldown.

Notification harus membawa `workspace` dan target route agar klik notifikasi membuka konteks yang tepat.

## 6. Navigation dan menu

### 6.1 Shared app shell

Desktop shell:

- Acai wordmark;
- workspace switcher;
- role-specific navigation;
- unread notification indicator;
- wallet/account control;
- Devnet badge;
- responsive content area.

Mobile shell:

- compact header;
- native modal/drawer menu;
- workspace switcher tetap terlihat;
- primary action tetap mudah dicapai;
- tidak memakai horizontal sidebar yang dipaksa masuk layar kecil.

### 6.2 Clipper menu

```text
Clipper
├── Overview
├── Open the Clipper workspace
├── My submissions
├── Earnings & claims
└── YouTube channel

Shared
├── Notifications
└── Settings
```

Primary CTA: `Open Acai` and choose the workspace after wallet sign-in.

### 6.3 Creator menu

```text
Creator · Manage campaigns
├── Overview
├── My campaigns
├── Review queue
└── Campaign funds

Shared
├── Notifications
└── Settings
```

Primary CTA: `Create campaign`.

`Campaign funds` dapat menjadi filtered view dari My Campaigns pada MVP, bukan route baru, agar navigasi tidak terlalu lebar.

### 6.4 Workspace switcher

```text
Clipper
Find campaigns, submit clips, claim rewards

Creator
Create campaigns, fund rewards, review clips
```

Aturan:

- tidak disebut account type;
- tidak mengubah permission;
- menyimpan pilihan terakhir;
- menampilkan toast singkat setelah berpindah;
- jika user membuka resource miliknya dari Clipper mode, tawarkan `Open in Creator`;
- Creator tetap dilarang submit ke campaign sendiri oleh frontend, backend, dan program.

## 7. Landing page plan

Landing saat ini kuat secara visual, tetapi copy `Brand`, `Creator`, dan planner lokal perlu diselaraskan dengan produk nyata.

### 7.1 Header

Menu yang disarankan:

```text
How it works
For Clippers
For Creators
FAQ
```

Actions:

- primary: `Open Acai` → `/connect` atau `/dashboard` jika authenticated.

### 7.2 Hero

Hero harus menjelaskan kedua sisi tanpa meminta role selection permanen.

Direction copy:

```text
Turn great content into rewarded clips.

Find campaigns and earn from verified views—or launch a campaign
and reward the clips that perform.
```

CTA:

- `Find campaigns`;
- `Launch a campaign`.

Kedua CTA menggunakan wallet/session yang sama. Jika belum login, kirim `next` yang sesuai ke `/connect`.

### 7.3 Sections

Urutan yang disarankan:

1. Hero dua sisi.
2. How Acai works: fund → clip → review → verified views → claim.
3. For Clippers.
4. For Creators.
5. Example campaign preview (static or authenticated workspace entry point).
6. Reward calculator yang jelas berlabel estimate.
7. Solana Devnet/aUSDC explanation.
8. FAQ termasuk wallet, YouTube data, review, appeal, dan payout.
9. Closing CTA ke `/connect`.

### 7.4 Perubahan terhadap landing demo sekarang

- Ganti `Brand` menjadi `Creator` atau `Campaign Creator` agar konsisten dengan PRD.
- Hapus kesan bahwa user membuat downloadable local plan sebagai action utama.
- Planner boleh tetap menjadi educational demo, tetapi bukan pengganti create campaign flow.
- Hubungkan campaign cards ke workspace Clipper setelah backend data aktif.
- Jangan menampilkan invented customer logos, testimonials, payout, atau volume.
- Jelaskan bahwa aUSDC adalah mock token Devnet dan bukan USDC nyata.
- Tambahkan Privacy link sebelum YouTube OAuth digunakan.

## 8. Connect dan authentication flow

### 8.1 Connect page states

```text
discovering-wallets
wallet-not-found
wallet-available
connecting-wallet
wallet-connected
requesting-nonce
awaiting-signature
verifying-signature
authenticated
error
```

### 8.2 Required flow

```text
Connect Wallet
→ POST /auth/nonce { wallet }
→ wallet signs exact UTF-8 message
→ POST /auth/verify { wallet, message, signature }
→ store session token
→ GET /auth/me
→ validate returned wallet equals connected account
→ redirect to sanitized `next` or last workspace
```

### 8.3 Session rules

- Backend Bearer token disimpan in-memory dan boleh dipulihkan dari `sessionStorage` untuk MVP.
- Jangan simpan token di `localStorage`.
- Jangka panjang, pertimbangkan BFF/HttpOnly secure cookie.
- Account change atau disconnect menghapus session frontend.
- Wallet yang berbeda dari JWT subject memaksa sign-in ulang.
- Session 401 mencoba satu kali clear-and-redirect, bukan infinite retry.
- `next` hanya menerima internal relative path untuk mencegah open redirect.

### 8.4 Wallet capability gap

Wallet layer saat ini hanya mengekspos connect, disconnect, sign transaction, dan sign-and-send. Backend auth membutuhkan detached message signature.

P0 frontend:

- tambahkan Wallet Standard `solana:signMessage` ke connector dan `WalletSession`;
- tampilkan error jika wallet tidak mendukung message signing;
- jangan meminta seed phrase atau private key;
- jangan menganggap wallet connection sebagai backend authentication.

## 9. Data architecture

### 9.1 State separation

Pisahkan tiga jenis state:

```text
Wallet state
├── discovered wallets
├── connected account
├── signer capabilities
└── cluster

Session state
├── JWT/session
├── authenticated wallet
├── expiry
└── auth status

Server state
├── campaigns
├── submissions
├── claims
├── notifications
└── YouTube channel/videos
```

Gunakan SWR yang sudah tersedia untuk server state. Jangan menyalin seluruh response API ke global React context.

### 9.2 Proposed frontend modules

```text
app/
├── (marketing)/
├── connect/
├── campaigns/
└── dashboard/
    ├── layout.tsx
    ├── clipper/
    ├── creator/
    ├── notifications/
    └── settings/

app/components/
├── app-shell/
├── auth/
├── campaigns/
├── submissions/
├── transactions/
└── feedback/

app/lib/
├── api/
│   ├── client.ts
│   ├── auth.ts
│   ├── campaigns.ts
│   ├── submissions.ts
│   ├── claims.ts
│   ├── notifications.ts
│   └── youtube.ts
├── auth/
├── wallet/
├── transactions/
├── domain/
└── formatting/
```

Server Components digunakan untuk public/static shell jika bermanfaat. Wallet hooks, session actions, transaction actions, dan browser storage tetap di leaf Client Components.

### 9.3 Numeric and time handling

- Campaign ID, token amount, CPM, views, dan payout dari API diperlakukan sebagai decimal string/`bigint`.
- Jangan mengubah base units menjadi JavaScript `number` sebelum formatting.
- aUSDC memiliki 6 decimals.
- Waktu campaign dari API menggunakan Unix seconds; ubah secara eksplisit di boundary.
- Countdown memakai server/chain time awareness dan selalu menampilkan absolute deadline sebagai fallback.

## 10. Backend API mapping

### 10.1 Endpoint yang sudah tersedia

| Frontend capability           | Endpoint                              |
| ----------------------------- | ------------------------------------- |
| Request sign-in message       | `POST /auth/nonce`                    |
| Verify wallet signature       | `POST /auth/verify`                   |
| Current session               | `GET /auth/me`                        |
| Logout                        | `POST /auth/logout`                   |
| Clipper campaign list         | `GET /campaigns?status=FUNDED`        |
| Clipper campaign detail       | `GET /campaigns/:id`                  |
| Authenticated terms URL       | `GET /campaigns/:id/terms`            |
| Create + fund intent          | `POST /campaigns`                     |
| Refund intent                 | `POST /campaigns/:id/refund-intent`   |
| Connect YouTube               | `GET /youtube/connect`                |
| YouTube channel status        | `GET /youtube/channel`                |
| Owned YouTube videos          | `GET /youtube/videos`                 |
| Revoke YouTube                | `DELETE /youtube/channel`             |
| Register submission intent    | `POST /campaigns/:id/submissions`     |
| Creator campaign submissions  | `GET /campaigns/:id/submissions`      |
| Related submission detail     | `GET /submissions/:id`                |
| Reject/appeal reason metadata | `POST /submissions/:id/review-note`   |
| Accept intent                 | `POST /submissions/:id/accept-intent` |
| Reject intent                 | `POST /submissions/:id/reject-intent` |
| Start claim orchestration     | `POST /submissions/:id/claim-request` |
| Poll claim request            | `GET /claim-requests/:id`             |
| Claim history per submission  | `GET /submissions/:id/claims`         |
| Notifications                 | `GET /me/notifications`               |
| Mark notification read        | `POST /me/notifications/:id/read`     |
| Devnet aUSDC faucet           | `POST /faucet`                        |

Frontend tidak boleh memanggil `/internal/*` atau membawa `x-internal-secret`.

### 10.2 Backend support dan deferred gaps

P0 query endpoints berikut sudah diimplementasikan:

| Proposed endpoint                             | Alasan                                                 |
| --------------------------------------------- | ------------------------------------------------------ |
| `GET /me/summary?workspace={clipper,creator}` | Overview metrics tanpa N+1 request                     |
| `GET /me/campaigns`                           | Creator campaign list berdasarkan authenticated wallet |
| `GET /me/submissions`                         | Clipper submission list lintas campaign                |
| `GET /me/claims`                              | Earnings history lintas submission                     |

Transaction intents berikut sudah diimplementasikan untuk P0, sedangkan cleanup tetap deferred:

| Proposed endpoint                               | Smart contract instruction | Priority            |
| ----------------------------------------------- | -------------------------- | ------------------- |
| `POST /campaigns/:id/top-up-intent`             | `top_up`                   | P0                  |
| `POST /submissions/:id/appeal-intent`           | `appeal_submission`        | P0                  |
| `POST /submissions/:id/finalize-timeout-intent` | `finalize_timeout`         | P0                  |
| `POST /campaigns/:id/close-unfunded-intent`     | `close_unfunded`           | P1                  |
| `POST /submissions/:id/close-intent`            | `close_submission`         | P2/advanced cleanup |
| `POST /campaigns/:id/stats/close-intent`        | `close_stats`              | P2/advanced cleanup |

`close_report` adalah oracle operation dan tidak muncul pada user frontend.

### 10.3 API contract improvements

- Tambahkan pagination/cursor pada campaigns, submissions, claims, dan notifications.
- Tambahkan filter yang typed: `status`, `creator`, `clipper`, `activeAt`, `limit`, `cursor`.
- Semua response amount dan ID besar tetap decimal strings.
- Kembalikan `serverTime` pada summary/detail untuk countdown yang stabil.
- Kembalikan lifecycle-derived fields seperti `canSubmit`, `canAppeal`, `canFinalize`, `canClaim`, `canRefund`, beserta reason; backend tetap memvalidasi ulang action.
- Update `server/docs/BACKEND.md`: source code sekarang sudah memiliki accept, reject, dan refund intent.

## 11. Smart contract mapping

### 11.1 Campaign actions

| UI action        | Instruction                             | Signer  | Preconditions                               |
| ---------------- | --------------------------------------- | ------- | ------------------------------------------- |
| Create and fund  | `initialize_campaign` + `fund_campaign` | Creator | Valid params, Devnet aUSDC, end time future |
| Top up           | `top_up`                                | Creator | FUNDED, before/equal end time, amount > 0   |
| Close unfunded   | `close_unfunded`                        | Creator | PENDING_FUNDING                             |
| Refund and close | `refund`                                | Creator | After end + settlement period               |

Create and fund tetap satu transaction intent agar initialize tidak tertinggal tanpa funding pada happy path.

### 11.2 Submission actions

| UI action               | Instruction           | Signer         | Preconditions                                                |
| ----------------------- | --------------------- | -------------- | ------------------------------------------------------------ |
| Submit video            | `register_submission` | Clipper        | FUNDED, campaign window, not owner, quota available          |
| Accept                  | `accept_submission`   | Creator        | Pending review before deadline, atau appealed before timeout |
| Reject                  | `reject_submission`   | Creator        | Same review windows; reason hash required                    |
| Appeal                  | `appeal_submission`   | Clipper        | REJECTED, once, before appeal deadline, quota available      |
| Finalize expired review | `finalize_timeout`    | Permissionless | Review/appeal response deadline passed                       |

Walaupun `finalize_timeout` permissionless, UI hanya menawarkannya pada pihak terkait untuk menghindari kebingungan.

### 11.3 Oracle and claim actions

| UI/backend action | Instruction            | Signer                  |
| ----------------- | ---------------------- | ----------------------- |
| Submit report     | `submit_oracle_report` | Oracle worker only      |
| Claim reward      | `claim`                | Clipper                 |
| Close report      | `close_report`         | Reporter/current oracle |
| Close submission  | `close_submission`     | Clipper                 |
| Close stats       | `close_stats`          | Clipper                 |

Claim UI tidak langsung membangun claim dari data lama. Selalu mulai dari backend claim orchestration agar report fresh/final tersedia.

## 12. Domain state presentation

### 12.1 Campaign state

On-chain stored state:

```text
PENDING_FUNDING → FUNDED → CLOSED
```

Frontend juga menurunkan phase dari waktu:

```text
Upcoming
Active
Settlement
Closed
```

Jangan menyimpan derived phase sebagai sumber kebenaran baru.

### 12.2 Submission state

```text
PENDING_REVIEW
├── ACCEPTED
├── REJECTED
│   ├── no appeal → expires as rejected path
│   └── appealed
│       ├── ACCEPTED
│       ├── REJECTED_FINAL
│       └── timeout → ACCEPTED
└── timeout → ACCEPTED
```

UI perlu membedakan:

- rejected dan masih dapat appeal;
- rejected tetapi appeal window lewat;
- rejected dan sedang appeal;
- rejected final;
- accepted tetapi baseline belum siap;
- accepted dan claim available;
- report held/stale/final pending;
- settlement ended.

### 12.3 Transaction/indexer state

Pisahkan status berikut:

```text
Preparing
Simulating
Awaiting wallet approval
Sending
Processed
Confirmed
Finalized
Waiting for Acai sync
Complete
Failed
```

`Finalized` tetapi API belum berubah bukan transaction failure. Tampilkan `Waiting for Acai sync` lalu refetch dengan bounded retry.

## 13. Standard transaction UX

Semua user-owned transaction memakai satu reusable flow:

```text
API returns transaction intent
→ validate intent locally
→ build instructions using generated Codama client
→ show transaction review
→ simulate
→ show simulation result
→ explicit user confirmation
→ wallet signature
→ send
→ track confirmation
→ wait for finalized indexer
→ refetch affected resources
```

Transaction review minimal menampilkan:

- action name;
- current wallet/fee payer;
- cluster;
- program ID;
- campaign atau submission;
- aUSDC amount dan recipient/destination role;
- ATA/rent creation jika ada;
- estimated network fee;
- expected state transition;
- warning bahwa wallet confirmation berikutnya akan muncul.

### 13.1 Intent validation

Backend intent diperlakukan sebagai untrusted input. Sebelum dibangun atau ditandatangani:

- `format` harus `acai-transaction-intent-v1`;
- `feePayer` harus sama dengan connected wallet;
- `transactionVersion` harus supported wallet;
- `programId` harus sama dengan configured deployment;
- instruction name harus allowlisted untuk action tersebut;
- account addresses dan PDA harus dihitung ulang dan dibandingkan;
- mint harus configured aUSDC mint;
- token program harus SPL Token yang diharapkan;
- amount harus cocok dengan review summary;
- response schema divalidasi di API boundary.

### 13.2 Transaction version

Implementasi saat ini menggunakan transaction version `0` karena planner `@solana/kit` yang terpasang mengompilasi message v0. Frontend wajib memeriksa dukungan wallet untuk v0 sebelum meminta signature. Migrasi ke Kit 8 dan transaction v1 dilakukan sebagai upgrade terpisah agar compiler, planner, dan wallet capability berubah secara atomik. Jika wallet belum mendukung versi aktif:

- disable action;
- tampilkan upgrade-wallet message; atau
- gunakan v0 fallback hanya jika secara eksplisit disediakan dan transaksi muat.

### 13.3 Implemented transaction controller

`TransactionAction` sekarang mengambil intent hanya setelah user memilih action, memvalidasi program/cluster/mint/fee payer/signer/account allowlist/version, mengompilasi instruction, menjalankan planner simulation, lalu meminta klik konfirmasi kedua sebelum wallet dibuka. Claim yang masih menunggu oracle menampilkan status retry tanpa mencoba menandatangani intent kosong.

## 14. Critical configuration checks

### 14.1 Program ID mismatch

Deployment aktif:

```text
CceJJ1LXS13HDMJRVdhw8GEw42r3roULbX5kCABG6K8E
```

`deployments/devnet.json`, `anchor/Anchor.toml`, frontend validator, `server/.env.example`, dan fallback intent sekarang memakai address yang sama. Backend melakukan fail-fast saat konfigurasi Devnet berbeda, dan `env:check` memvalidasi program, mint, serta transaction version sebelum runtime.

### 14.2 Devnet runtime config

Configured values saat dokumen dibuat:

```text
Cluster: devnet
Program: CceJJ1LXS13HDMJRVdhw8GEw42r3roULbX5kCABG6K8E
Config PDA: CmvvwsZvwwbc2RXtafeDhBYoZNBsiyN2YdSBn3J8x7Lf
aUSDC mint: 67tawTkJ6Ft2k7SJER8KuP1aQBbgdZMrFyJfUJT7tzZU
Token decimals: 6
```

Jangan menyebarkan constant ini ke banyak komponen.

## 15. Page-level behavior

### 15.1 Campaign discovery

- Public browsing tidak membutuhkan wallet.
- Default hanya campaign FUNDED yang masih relevan.
- Filter: active/upcoming, category jika metadata tersedia, CPM, eligibility.
- Card menampilkan CPM, max payout, remaining pool, end time, dan creator label.
- Campaign milik connected wallet diberi label `Your campaign` dan CTA `Manage as Creator`, bukan Submit.

### 15.2 Campaign detail for Clipper

Urutan informasi:

1. title, creator, active state;
2. brief dan source video;
3. CPM, max payout, remaining pool;
4. submission requirements;
5. campaign dates dan review/appeal expectations;
6. terms PDF dan verified hash;
7. eligibility/YouTube status;
8. select owned video;
9. transaction review.

Submission harus meminta explicit terms acknowledgement sebelum backend intent dibuat.

### 15.3 Create campaign

Gunakan multi-step form dengan draft lokal non-sensitive:

1. Basics: title, brief, source video, required mention.
2. Rewards: CPM, max payout, total budget.
3. Schedule: start/end and review windows.
4. Eligibility: video quota, subscriber/channel age minimum.
5. Terms: upload PDF and explain immutable hash.
6. Review: human units + exact base units.
7. Transaction: simulation and signature.

Form harus memvalidasi constraint program sebelum request API, tetapi backend/program tetap memvalidasi ulang.

Persistence flow:

```text
POST /campaigns
→ reserve campaign ID/PDA
→ store campaign_intent (AWAITING_SIGNATURE, expires in 30 minutes)
→ return unsigned initialize + fund transaction
→ wallet sends transaction
→ POST /campaigns/intents/:id/submitted with signature
→ finalized indexer verifies CampaignInitialized + CampaignFunded
→ materialize campaigns row as FUNDED
```

`campaign_intents` tidak pernah muncul di Clipper campaign discovery. Creator dapat melihat intent sebagai “Waiting for network confirmation”, tetapi hanya row `campaigns` hasil event finalized yang dianggap campaign aktif. Intent tanpa signature menjadi `EXPIRED`; transaksi gagal tidak membuat row campaign.

### 15.4 Review submission

Creator melihat:

- video link dan verified metadata;
- campaign requirement snapshot;
- submitted time dan countdown;
- current submission state;
- rejection/appeal history;
- accept dan reject actions.

Reject selalu membutuhkan reason. Reason disimpan off-chain dan hash yang sama dikirim dalam instruction.

### 15.5 Claim

```text
Request claim
→ 200 READY: review claim transaction
→ 202 PENDING: show oracle progress and poll
→ FAILED REPORT_HELD: explain review hold
→ READY: simulate, approve, sign, send
→ wait for indexer
→ update earnings/history
```

Polling menggunakan bounded interval, berhenti saat route unmount, session berubah, atau terminal state tercapai.

## 16. Error and empty states

Setiap page harus memiliki:

- skeleton/loading;
- empty state dengan next action;
- retryable network error;
- 401 session expired;
- 403 ownership mismatch;
- 404 resource missing;
- backend validation error;
- wallet rejection;
- simulation failure;
- confirmation timeout;
- finalized but indexer pending.

Program errors dari `app/lib/errors.ts` digunakan sebagai dasar, tetapi copy harus disesuaikan dengan konteks action.

Contoh empty states:

| Area                | Empty copy                                     | CTA                       |
| ------------------- | ---------------------------------------------- | ------------------------- |
| Clipper submissions | No submissions yet                             | Open campaign workspace   |
| Creator campaigns   | No campaigns yet                               | Create campaign           |
| Review queue        | You are all caught up                          | View campaigns            |
| Earnings            | No rewards claimed yet                         | View accepted submissions |
| YouTube             | Connect a channel when you are ready to submit | Connect YouTube           |

## 17. Visual and interaction direction

Pertahankan design language di `app/DESIGN.md`:

- canvas `#101012`;
- sidebar `#171719`;
- panels `#18181B`;
- border `#2D2D32`;
- primary text `#F5F4F7`;
- lavender `#B49AFF` untuk selected state dan primary action;
- green untuk confirmed/accepted;
- amber untuk pending/review;
- red hanya untuk destructive/error.

Guidelines:

- satu primary action per surface;
- jangan memakai glow/glass berlebihan;
- data table boleh horizontal scroll di container sendiri;
- dialog transaksi memakai native focus semantics;
- keyboard focus selalu terlihat;
- reduced motion mematikan non-essential transition;
- status tidak dibedakan dengan warna saja;
- semua icon action memiliki visible label atau accessible name.

## 18. Security requirements

- Tidak pernah meminta, membaca, atau menyimpan seed phrase/private key.
- Semua signature terjadi di wallet.
- Message auth harus exact message dari backend; tampilkan tujuan sign-in dan tegaskan tidak ada transaksi.
- Transaction tidak dikirim tanpa explicit review dan approval.
- Simulate sebelum signature/send.
- Devnet menjadi default; mainnet tidak muncul sebagai accidental toggle.
- Validate all API responses dan transaction intents.
- Validate on-chain account owner, discriminator, dan expected PDA sebelum menampilkan data sebagai trusted.
- Terms URL dianggap temporary URL dan tidak disimpan permanen.
- YouTube OAuth hanya `youtube.readonly` dan settings menyediakan revoke.
- `/internal/*`, oracle key, admin key, faucet key, dan secrets tidak pernah masuk frontend bundle.

## 19. Testing strategy

### 19.1 Unit tests

- route resolver;
- wallet/session mismatch;
- amount/base-unit formatting;
- campaign derived phase;
- submission action eligibility;
- intent schema and PDA validation;
- error-code mapping;
- open-redirect prevention.

### 19.2 Component tests

- wallet discovery/connect/sign-in states;
- workspace switcher;
- campaign form constraints;
- transaction review and rejected signature;
- claim polling terminal states;
- notification deep links;
- mobile navigation and dialog focus.

### 19.3 Integration tests

- Connect → nonce → sign → verify → dashboard.
- Creator create/fund → finalized → indexer sync.
- Clipper YouTube connect → submit → indexed pending review.
- Creator accept/reject.
- Clipper appeal and timeout finalization.
- Oracle claim orchestration → claim → history.
- Settlement → refund.

Use mock wallet/provider for UI tests dan Surfpool/LiteSVM-backed scenarios untuk transaction integration bila infrastructure ditambahkan.

### 19.4 Required edge cases

- user rejects sign-in signature;
- wallet changes during authenticated session;
- wallet does not support transaction version yang aktif;
- insufficient SOL/aUSDC;
- creator opens own campaign in Clipper mode;
- YouTube channel belongs to another wallet;
- duplicate video;
- quota reached;
- review/appeal deadline crosses while dialog open;
- stale or held oracle report;
- partial payout because pool is insufficient;
- backend cache lags after finalized transaction;
- session expires while claim is PENDING.

## 20. Delivery phases

### Phase 0 — Contract and configuration hardening

- Resolve program ID mismatch.
- Add runtime config validation.
- Add response schemas and intent validator.
- Add wallet `signMessage` support.
- Decide current Kit stack stabilization versus isolated upgrade; do not mix two wallet stacks mid-feature.

### Phase 1 — App foundation

- API client and session provider.
- `/connect` full nonce/sign/verify flow.
- Protected dashboard layout.
- URL-based routing.
- Shared app shell and workspace switcher.
- Replace current dashboard `screen` state navigation.

### Phase 2 — Read-only real data

- Authenticated campaign discovery and detail in the Clipper workspace.
- Clipper/Creator overview endpoints.
- My campaigns, submissions, claims, notifications.
- YouTube channel status.
- Loading, error, empty, and pending-indexer states.

### Phase 3 — Clipper happy path

- YouTube OAuth.
- Owned video selection.
- Terms acknowledgement.
- Register submission transaction.
- Submission detail/timeline.
- Claim orchestration and earnings.

### Phase 4 — Creator happy path

- Create campaign form and PDF upload.
- Create/fund transaction.
- Campaign management.
- Review queue.
- Accept/reject flows.
- Top-up and refund.

### Phase 5 — Appeals and lifecycle completion

- Appeal intent.
- Final review decision.
- Permissionless finalize timeout.
- Settlement state.
- Optional account cleanup flows.

### Phase 6 — Landing conversion

- Align role terminology.
- Replace local-only planner as primary action.
- Connect CTA to real public/product routes.
- Add campaign preview and privacy/legal routes.
- Preserve current Acai branding and design language.

### Phase 7 — Hardening

- Accessibility audit.
- Responsive audit.
- Error mapping audit.
- Full devnet E2E.
- Performance, cache, and retry tuning.
- Analytics events without sensitive wallet/YouTube data leakage.

## 21. Migration from the current frontend

Current implementation can be reused selectively:

- keep Acai logo component and local Barlow fonts;
- keep dashboard palette and responsive design direction;
- keep campaign cards, chart, filters, and modal patterns after decoupling from demo data;
- keep Wallet Standard discovery while adding sign-message capability, or migrate it as a separate scoped task;
- replace `dashboard/data.ts` sample data with typed API hooks;
- split `dashboard/dashboard.tsx` into routes and domain components;
- replace locally persisted draft submission with backend-verified submission intent;
- replace local demo reset/settings with session, wallet, YouTube, and Devnet settings;
- update help copy that currently says wallet/backend/payment are not connected.

Do not attempt to connect the current monolithic dashboard to every endpoint in place. Route and data boundaries should be created first.

## 22. Definition of done for frontend MVP

Frontend MVP dianggap selesai ketika:

- wallet dapat connect, sign auth message, dan membuat backend session;
- user dapat berpindah antara Clipper dan Creator tanpa akun kedua;
- self-submission diblokir dan dijelaskan;
- campaign browsing and detail are protected by a wallet session;
- Creator dapat create/fund, review, top up, dan refund;
- Clipper dapat connect YouTube, submit, appeal, finalize timeout, dan claim;
- setiap transaction memiliki review, simulation, approval, confirmation, dan indexer-sync feedback;
- seluruh amount menggunakan bigint/decimal-safe formatting;
- notification deep links membuka workspace yang benar;
- session/wallet mismatch aman;
- Devnet, program, mint, dan transaction version tervalidasi;
- desktop, tablet, dan mobile usable dengan keyboard dan screen reader;
- frontend tidak mengakses internal endpoints atau secrets;
- critical flows lulus integration test di Devnet/test environment.

## 23. Deferred decisions

Tidak diperlukan untuk MVP, tetapi struktur tidak boleh menghalangi:

- organization/team accounts untuk Creator;
- Creator member roles seperti owner, reviewer, dan finance;
- mainnet deployment;
- multi-token campaigns;
- full Sign-In With Solana standardization;
- independent dispute moderator;
- advanced fraud review UI;
- admin/oracle operations console terpisah dari user frontend.

Jika organization ditambahkan, campaign dimiliki organization dan wallet memperoleh membership role. Ini berbeda dari contextual Creator/Clipper workspace yang dibahas dalam dokumen ini.

## 24. Immediate next actions

Foundation, route-based dashboard, connect/auth, P0 query/intent endpoints, real-data screens, transaction review, appeal flow, dan landing integration sudah diimplementasikan. Hardening berikutnya:

1. Jalankan browser E2E dari native Linux/WSL Node; production build native Linux sudah lulus.
2. Jalankan happy-path Devnet dengan wallet test untuk memverifikasi finalization dan lag indexer nyata.
3. Tambahkan component/integration tests untuk connect, workspace switcher, creator review, appeal, dan claim pending-oracle.
4. Tambahkan pagination/cursor dan lifecycle-derived action flags dari backend.
5. Implementasikan cleanup intents P1/P2 hanya jika dibutuhkan operasional.
