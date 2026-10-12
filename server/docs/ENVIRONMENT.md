# Backend environment variables

Dokumen ini adalah sumber utama konfigurasi `server/.env`. Salin `.env.example`, lalu isi hanya kelompok fitur yang dipakai.

```bash
cd server
cp .env.example .env
```

Jangan commit `.env`, keypair JSON, refresh token, API key, client secret, atau service-role key. Alamat wallet/program/mint adalah data publik dan aman ditaruh di `.env.example`.

## Profil yang harus dipilih

### 1. Lokal paling sederhana: mock YouTube, tanpa transaksi oracle

Cocok untuk mengembangkan halaman dan REST API tanpa Google OAuth serta tanpa membayar fee oracle.

```dotenv
YOUTUBE_ADAPTER=mock
CHAIN_INDEXER_ENABLED=false
ORACLE_SUBMIT_ENABLED=false
ORACLE_WORKER_ENABLED=false
WORKERS_ENABLED=false
```

Tetap isi konfigurasi Core API, PostgreSQL, `VAULT_PROGRAM_ID`, dan `AUSDC_MINT_ADDRESS`. Fixture mock dibaca dari `YOUTUBE_MOCK_FIXTURE`.

### 2. YouTube nyata + frontend lokal

```dotenv
YOUTUBE_ADAPTER=api
YOUTUBE_API_KEY=<Google API key>
GOOGLE_CLIENT_ID=<OAuth Web client ID>
GOOGLE_CLIENT_SECRET=<OAuth client secret>
GOOGLE_REDIRECT_URI=http://localhost:4000/youtube/callback
CHAIN_INDEXER_ENABLED=true
```

Di Google Cloud, redirect URI harus sama persis. Tambahkan akun Google sebagai test user selama OAuth consent screen masih berstatus Testing.

### 3. Full devnet (Lokal)

Gunakan profil 2, kemudian isi keypair oracle dan aktifkan worker:

```dotenv
ORACLE_KEYPAIR_PATH=/home/asus/.config/solana/acai-oracle-keypair.json
ORACLE_SUBMIT_ENABLED=true
ORACLE_WORKER_ENABLED=true
WORKERS_ENABLED=true
CHAIN_INDEXER_ENABLED=true
```

`ORACLE_KEYPAIR_PATH` harus cocok dengan `ORACLE_REPORTER`, memiliki SOL devnet untuk fee, dan permission file harus `chmod 600`. Jangan memakai admin/deployer sebagai oracle untuk production.

### 4. Deploy ke Cloud (Railway, Render, Fly.io, dll.)

Backend Acai berjalan 100% menggunakan native Node.js & JavaScript Solana SDK (`@solana/web3.js` dan `@solana/spl-token`). **Tidak perlu menginstall binary Solana CLI atau `spl-token` di server cloud.**

Untuk keypair signer di cloud, cukup paste string JSON array langsung ke environment variable:

```dotenv
ORACLE_KEYPAIR_SECRET=[12,34,56,...]
FAUCET_KEYPAIR_SECRET=[98,76,54,...]
```

Sistem otomatis mem-parsing string JSON array ini langsung ke memory tanpa memerlukan file fisik di disk `/tmp`.

## Generate tiga secret aplikasi

Jalankan masing-masing sekali dari terminal. Jangan mengirim hasilnya ke chat atau memasukkannya ke Git.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Gunakan dua hasil berbeda untuk `JWT_SECRET` dan `INTERNAL_API_SECRET`.

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Gunakan hasil base64 untuk `TOKEN_ENCRYPTION_KEY`. Mengubah key ini setelah token YouTube tersimpan membuat refresh token lama tidak bisa didekripsi sehingga channel harus dihubungkan ulang.

## Referensi lengkap

| Variable | Kapan diperlukan | Fungsi |
|---|---|---|
| `NODE_ENV` | Selalu | `development`, `test`, atau `production`. Production menonaktifkan static local terms dan demo seed. |
| `PORT` | Selalu | Port HTTP backend; default kode 4000. |
| `APP_ORIGIN` | Selalu | Origin frontend untuk CORS, SIWS message, dan redirect OAuth. Tanpa trailing slash. |
| `API_ORIGIN` | Selalu | URL publik backend; dipakai log, smoke test, dan URL file lokal. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Selalu | Koneksi PostgreSQL. Knex tidak membuat database; database harus ada dahulu. |
| `JWT_SECRET` | Selalu | Menandatangani session JWT. Gunakan random 32 byte atau lebih. |
| `INTERNAL_API_SECRET` | Selalu | Melindungi seluruh `/internal/*` melalui header `x-internal-secret`. |
| `TOKEN_ENCRYPTION_KEY` | YouTube API | AES key 32 byte base64 untuk refresh token Google. Jika kosong, kode fallback ke hash JWT; fallback hanya untuk compatibility dan tidak disarankan. |
| `YOUTUBE_ADAPTER` | Selalu | `api` untuk Google nyata, `mock` untuk fixture lokal. |
| `YOUTUBE_API_KEY` | Adapter `api` | API key YouTube Data API v3 untuk request data publik/video. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Adapter `api` | OAuth 2.0 Web Application credentials. |
| `GOOGLE_REDIRECT_URI` | Adapter `api` | Callback OAuth; harus sama persis dengan Google Console. |
| `YOUTUBE_MOCK_FIXTURE` | Adapter `mock` | Path fixture video; tidak dipakai adapter API. |
| `SOLANA_CLUSTER` | Flow Solana | Saat ini `devnet`; juga diikat ke pesan login. |
| `SOLANA_RPC_URL` | Indexer/oracle/init | HTTP RPC endpoint cluster yang sama dengan program. Gunakan RPC devnet yang stabil (seperti Helius). |
| `SOLANA_TRANSACTION_VERSION` | Flow Solana | Versi transaction intent; project memakai 1. Frontend harus memeriksa dukungan wallet. |
| `VAULT_PROGRAM_ID` | Flow Solana | Program Acai devnet yang sudah dideploy (`CceJJ1LXS13HDMJRVdhw8GEw42r3roULbX5kCABG6K8E`). |
| `AUSDC_MINT_ADDRESS` | Campaign/faucet | Mint pembayaran yang diizinkan backend (`67tawTkJ6Ft2k7SJER8KuP1aQBbgdZMrFyJfUJT7tzZU`). |
| `CHAIN_INDEXER_ENABLED` | Sinkronisasi otomatis | `true` menjalankan polling finalized transaction/log saat API hidup. |
| `CHAIN_INDEXER_INTERVAL_SECONDS` | Indexer aktif | Jeda polling; default 5 detik. |
| `CHAIN_INDEXER_MAX_PAGES` | Indexer aktif | Batas backlog per cycle, 1 halaman = maksimum 1.000 signature. |
| `CHAIN_INDEXER_BACKFILL_ON_START` | Indexer pertama kali | Biarkan `false`; `true` hanya jika seluruh intent/data historis tersedia. |
| `VAULT_IDL_PATH` | Opsional | Override IDL. Kosong memakai `src/idl/vault.json`. |
| `ORACLE_REPORTER` | Oracle/claim | Public key oracle yang terdaftar di config on-chain (`9DjxaFgSexfb2J4Rz6xvdc5iAr8LqapfyeDJprpvZFqB`). |
| `ORACLE_KEYPAIR_PATH` | Submit oracle lokal | Absolute path keypair oracle. Wajib `chmod 600`. |
| `ORACLE_KEYPAIR_SECRET` | Submit oracle cloud | String JSON array byte keypair (contoh: `[12,34,...]`). Dipakai di Railway/Render tanpa file disk. |
| `ORACLE_SUBMIT_ENABLED` | Opsional | Jika `true`, report disimulasikan lalu dikirim on-chain. |
| `ORACLE_WORKER_ENABLED` | Opsional | Mengizinkan maintenance cycle mengumpulkan snapshot/report. Efektif bersama `WORKERS_ENABLED=true`. |
| `WORKERS_ENABLED` | Opsional | Menjalankan maintenance scheduler dalam process API. |
| `WORKER_INTERVAL_SECONDS` | Worker aktif | Interval maintenance cycle. |
| `CLAIM_REQUEST_COOLDOWN_SECONDS` | Claim | Cooldown per submission sebelum request claim berikutnya. |
| `NOTIFICATION_REMINDER_SECONDS` | Worker aktif | Lead time reminder in-app. Tidak ada email. |
| `BASELINE_ALERT_SECONDS` | Worker aktif | Batas waktu sebelum baseline terlambat dianggap perlu peringatan. |
| `YOUTUBE_DATA_RETENTION_DAYS` | Worker aktif | Retensi snapshot YouTube lama. |
| `ANOMALY_CHECK_ENABLED` | Oracle | Mengaktifkan hold untuk kenaikan view mencurigakan. |
| `ANOMALY_MAX_GROWTH_PER_HOUR` | Anomaly aktif | Ambang pertumbuhan absolut per jam. |
| `ANOMALY_MULTIPLIER` | Anomaly aktif | Pengali terhadap laju historis. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Production terms | Private terms storage. Keduanya harus diisi bersamaan. |
| `SUPABASE_TERMS_BUCKET` | Supabase aktif | Nama private bucket; default `campaign-terms`. |
| `FAUCET_KEYPAIR_PATH` | Faucet lokal | Absolute path file keypair faucet/mint authority. |
| `FAUCET_KEYPAIR_SECRET` | Faucet cloud | String JSON array byte keypair faucet (contoh: `[98,76,...]`). Dipakai di Railway/Render tanpa file disk. |
| `FAUCET_COOLDOWN_HOURS` | Faucet dipakai | Cooldown mint per wallet (default 24 jam). Faucet hanya berjalan di devnet. |
| `PROGRAM_DATA_ADDRESS` | Script init saja | ProgramData upgradeable loader (`9KvwHbfctqoYBSoD83DLEviVU5CMTm68R3U3BMQsDSF2`). Tidak dibaca runtime API. |
| `ADMIN_WALLET` | Script init saja | Admin config on-chain (`6epHJMDaqdoYVwJFU8VfVXFxzrjccESwJcM9FtS7E4Vp`). Tidak dibaca runtime API. |
| `ADMIN_KEYPAIR_PATH` | Script init saja | Signer `npm run init:config`; TIDAK dibutuhkan lagi setelah config initialized. |
| `E2E_PORT` | Test saja | Port isolated untuk `npm run test:e2e`. |

## Yang boleh dihapus dari `.env` bila tidak dipakai

- Mock dimatikan: `YOUTUBE_MOCK_FIXTURE`.
- Supabase belum dipakai di development: seluruh `SUPABASE_*` boleh kosong/hapus.
- Faucet tidak dipakai: seluruh `FAUCET_*` boleh kosong/hapus.
- Config devnet sudah initialized: `PROGRAM_DATA_ADDRESS`, `ADMIN_WALLET`, dan `ADMIN_KEYPAIR_PATH` boleh dihapus dari runtime `.env`.
- Tidak menjalankan e2e: `E2E_PORT` boleh dihapus.
- Memakai IDL default: `VAULT_IDL_PATH` boleh kosong/hapus.

Jangan menghapus `ORACLE_REPORTER` jika claim nyata akan digunakan, karena backend memvalidasi report terakhir terhadap reporter aktif.

## Startup checklist

```bash
createdb -h localhost -U postgres acai  # cukup sekali; alternatif: CREATE DATABASE acai
cd server
npm ci
npm run migrate
npm run dev
```

Pemeriksaan dasar:

```bash
curl http://localhost:4000/health
npm test
npm run env:check
```

`npm run seed` hanya untuk demo development dan tidak dijalankan di production.
