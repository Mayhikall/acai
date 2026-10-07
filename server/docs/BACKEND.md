# Acai backend API

Base URL lokal: `http://localhost:4000`  
Format request/response: JSON, kecuali pembuatan campaign yang memakai `multipart/form-data` karena mengunggah PDF.

## Konvensi penting

- Endpoint berlabel **Auth** membutuhkan `Authorization: Bearer <JWT>`.
- Endpoint `/internal/*` membutuhkan `x-internal-secret: <INTERNAL_API_SECRET>` dan tidak boleh dipanggil browser/frontend.
- ID campaign, jumlah token base unit, CPM, view count besar, dan payout dapat dikembalikan sebagai string decimal. Frontend gunakan `bigint`/decimal string, bukan JavaScript `number`.
- Waktu parameter campaign adalah Unix seconds.
- aUSDC devnet memiliki 6 decimal. Contoh `10 USDC = "10000000"` base units.
- CPM disimpan sebagai base units per 1.000 views. `10 USDC / 10.000 views` setara `1 USDC / 1.000 views`, sehingga `cpmBaseUnits="1000000"`.

Response error konsisten:

```json
{
  "error": {
    "code": "CAMPAIGN_NOT_FOUND",
    "message": "Campaign not found",
    "details": null
  }
}
```

## Authentication

Login memakai challenge wallet (SIWS-style), bukan password.

### `POST /auth/nonce`

Body:

```json
{ "wallet": "<Solana public key>" }
```

Response berisi `message` yang harus ditandatangani wallet sebagai UTF-8 bytes.

### `POST /auth/verify`

```json
{
  "wallet": "<Solana public key>",
  "message": "<exact message dari nonce>",
  "signature": "<base58 detached signature>"
}
```

Response: `{ token, wallet, expiresAt }`. Simpan token di memory/secure session storage dan kirim sebagai Bearer token.

### `GET /auth/me` — Auth

Mengembalikan user aktif.

### `POST /auth/logout` — Auth

Mencabut session, response `204`.

## YouTube

### `GET /youtube/connect` — Auth

- Adapter API: response `{ url }`; arahkan browser ke URL Google.
- Adapter mock: langsung menghubungkan fixture dan mengembalikan channel.

Google mengembalikan browser ke `GET /youtube/callback`, lalu backend redirect ke:

```text
{APP_ORIGIN}/dashboard?youtube=connected
```

### `GET /youtube/videos` — Auth

Mengambil maksimum 50 upload milik channel yang terhubung, termasuk ID, title, waktu publikasi, durasi, dan view count.

### `DELETE /youtube/channel` — Auth

Mencabut OAuth Google sebisa mungkin dan selalu menghapus akses token lokal. Response `204`.

## Campaign

### `GET /campaigns`

Public. Query opsional: `status`, `limit` (maksimum 100).

### `GET /campaigns/:id`

Public. Mengambil detail campaign.

### `GET /campaigns/:id/terms` — Auth

Menghasilkan URL PDF terms sementara beserta SHA-256 `termsHash`.

### `POST /campaigns` — Auth

`multipart/form-data`, field file `terms` harus PDF maksimum 10 MiB.

Field form:

| Field | Format |
|---|---|
| `title` | 1–160 karakter |
| `brief` | 1–10.000 karakter |
| `sourceVideo` | URL video sumber |
| `requiredMention` | Teks/mention yang wajib muncul |
| `paymentMint` | Harus sama dengan `AUSDC_MINT_ADDRESS` |
| `cpmBaseUnits` | Positive decimal string, pembayaran per 1.000 views |
| `maxPayoutPerVideo` | Positive decimal string |
| `budget` | Positive decimal string |
| `startTime`, `endTime` | Unix seconds |
| `reviewPeriod`, `appealWindow`, `appealTimeout` | Detik, positive integer |
| `settlementPeriod`, `maxReportAge` | Detik, positive integer |
| `finalSnapshotTolerance`, `clockSkewTolerance` | Detik; clock skew harus lebih kecil |
| `maxVideosPerClipper` | 1–100, default 5 |
| `minSubscribers`, `minChannelAgeDays` | Optional nonnegative integer |
| `terms` | PDF |

Response `201`:

```json
{
  "campaign": { "id": "...", "onchain_campaign": "..." },
  "transaction": { "format": "acai-transaction-intent-v1", "instructions": [] }
}
```

Backend tidak memegang wallet creator dan tidak menandatangani transaksi. Frontend harus membangun transaction dari intent, menampilkan ringkasan, meminta signature wallet, mengirim ke devnet, lalu menunggu confirmation. Finalized indexer akan memperbarui status PostgreSQL.

## Submission dan claim

### `POST /campaigns/:id/submissions` — Auth clipper

```json
{ "videoId": "EzoqkJ3blhw" }
```

Backend memastikan video dimiliki channel wallet tersebut dan memenuhi campaign, membuat intent 30 menit, lalu mengembalikan `verifiedVideo` dan transaction intent `register_submission`.

### `GET /campaigns/:id/submissions` — Auth creator

Daftar seluruh submission campaign; hanya creator campaign.

### `GET /submissions/:id` — Auth creator/clipper

Detail submission untuk pihak yang terkait.

### `POST /submissions/:id/review-note` — Auth

Metadata alasan off-chain untuk action on-chain reject/appeal:

```json
{
  "action": "REJECT",
  "reason": "Alasan yang ditampilkan",
  "txSignature": "optional on-chain signature"
}
```

`REJECT` hanya creator; `APPEAL` hanya clipper. Hash alasan disimpan untuk dicocokkan dengan transaksi on-chain.

### `POST /submissions/:id/claim-request` — Auth clipper

Body kosong. Response:

- `200`: report siap dan `transaction` claim tersedia.
- `202`: oracle snapshot/report masih diproses; poll endpoint berikut.

### `GET /claim-requests/:id` — Auth clipper

Poll sampai `claimRequest.status` menjadi `READY`, lalu response menyertakan transaction intent claim.

### `GET /submissions/:id/claims` — Auth clipper

Riwayat payout yang sudah diindeks dari chain.

## Notifications

Notifikasi hanya in-app; email sudah tidak digunakan.

- `GET /me/notifications` — Auth, maksimum 100 terbaru.
- `POST /me/notifications/:id/read` — Auth, response `204`.

## Faucet devnet

### `POST /faucet` — Auth

Mint tetap `1.000 aUSDC` ke wallet login, hanya devnet dan mengikuti cooldown. Endpoint ini menjalankan CLI `spl-token` di server; nonaktifkan di production/mainnet.

## Health

### `GET /health`

Public. Response `{ status: "ok", timestamp }`. Ini hanya membuktikan process HTTP hidup, bukan health PostgreSQL/RPC/Google.

## Internal operations — bukan untuk frontend

Semua endpoint berikut memakai `x-internal-secret`:

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/internal/oracle/run` | Jalankan oracle untuk semua/`submissionId`. |
| POST | `/internal/oracle/holds/:id/release` | Lepaskan report anomaly untuk dikirim. |
| POST | `/internal/oracle/holds/:id/discard` | Buang report yang ditahan. |
| POST | `/internal/indexer/events` | Webhook event Anchor manual; normalnya finalized indexer otomatis yang dipakai. |
| GET | `/internal/indexer/dead-letters` | Lihat event domain-error yang dikarantina. Query `includeResolved`, `limit`. |
| POST | `/internal/indexer/dead-letters/:signature/:eventIndex/retry` | Retry setelah dependency/data diperbaiki. |
| POST | `/internal/maintenance/run` | Jalankan satu maintenance cycle. |
| POST | `/internal/mock/videos/:id/views` | Ubah views fixture saat adapter mock. |

Error domain 4xx dari event otomatis masuk dead-letter agar checkpoint lanjut. Error RPC/database/decoder menghentikan cycle dan dicoba ulang tanpa melewati transaksi tersebut.

## Flow frontend yang direkomendasikan

1. Connect wallet → `/auth/nonce` → sign message → `/auth/verify`.
2. Hubungkan YouTube → `/youtube/connect` → OAuth → `/youtube/videos`.
3. Creator membuat campaign → sign/send instruction create+fund → tunggu finalized/indexer.
4. Clipper memilih video → buat submission intent → sign/send register.
5. Creator melakukan instruction accept/reject on-chain; jika reject, simpan review note.
6. Setelah baseline confirmed, clipper request claim → jika `PENDING`, poll → sign/send claim ketika `READY`.
7. Refetch resource setelah confirmation dan tampilkan notifications/claim history.

Instruction seperti accept, reject, appeal, refund, close, dan admin tetap merupakan operasi program Anchor. Backend saat ini tidak menyediakan transaction-intent endpoint khusus untuk semuanya; frontend dapat membangunnya dari IDL `server/src/idl/vault.json`, atau endpoint intent tambahan dapat dibuat sebelum UI action tersebut diaktifkan.

## Menjalankan dan menguji

```bash
cd server
npm ci
npm run migrate
npm test
npm run dev
```

Smoke test yang tersedia:

```bash
npm run test:youtube
npm run test:e2e
```

Lihat [ENVIRONMENT.md](./ENVIRONMENT.md) untuk konfigurasi setiap mode.
