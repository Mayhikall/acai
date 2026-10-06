# Acai — Product Requirements Document (v4)

Revisi dari v3. Arah produk tidak berubah; v4 menutup inkonsistensi dan celah yang ditemukan saat review v3.

| # | Perubahan | Section |
| --- | --- | --- |
| 1 | **Rotasi oracle**: report final/replay dibandingkan hanya dengan report dari oracle saat ini, sehingga final dari key lama dapat diganti oracle baru (sebelumnya terkunci oleh `FinalAlreadyReceived`) | 7.4, 7.7, 10.7 |
| 2 | **claim-request** tidak lagi ditolak karena "tidak ada views baru" (bertentangan dengan Claim 4 di skenario angka); ditolak hanya bila tidak ada sisa klaim | 11.2 |
| 3 | Aturan `active_count` untuk jalur appeal dirumuskan eksplisit (reject awal, appeal, reject final) | 10.2 |
| 4 | `close_report`/`close_submission`/`close_stats` boleh setelah settlement berakhir, tidak bergantung pada creator memanggil `refund()` | 9.1, 10.2, 10.8 |
| 5 | Sanity check: cold start tanpa riwayat, profil threshold demo (agar lonjakan views demo tidak tertahan), perilaku saat baseline/claim-request `held` | 7.4, 11.2, 14 |
| 6 | Jendela toleransi final dicantumkan di Terms (sebelumnya hanya disebut "dicantumkan") | 3 |
| 7 | Urutan demo diperbaiki: verifikasi → register → baseline → accept | 14 |
| 8 | Oracle Worker tidak mengirim report untuk REJECTED tanpa appeal setelah `appeal_window`; `report_seq` dinaikkan program | 7.3, 7.6 |
| 9 | Aturan accept/reject saat appeal dirumuskan eksplisit | 10.2 |
| 10 | Rencana testing diperluas untuk perubahan di atas | 17 |

---

## 1. Overview

Acai adalah platform clipping campaign berbasis Solana yang menghubungkan creator dengan clipper.

Creator menyediakan campaign dan dana reward. Clipper membuat dan mempublikasikan clip dari konten creator. Clipper dibayar berdasarkan jumlah views yang diverifikasi.

Pembayaran memakai aUSDC, mock SPL token di Solana Devnet.

## 2. Core Flow

### Creator

```
Create Campaign
      ↓
Upload Campaign Terms
      ↓
Review Campaign (hash terms dihitung ulang di client)
      ↓
Initialize + Fund (satu transaksi)
      ↓
Campaign ACTIVE
```

Creator menentukan:

- source video;
- campaign brief;
- required mention;
- CPM;
- maximum payout per video;
- budget;
- start time dan end time;
- payment token;
- parameter waktu (Section 4.1);
- syarat channel clipper (opsional): `min_subscribers` dan `min_channel_age_days` (Section 5).

Setelah campaign aktif, terms tidak dapat diubah. Creator dapat melakukan top-up selama campaign ACTIVE.

### Clipper

Tidak ada proses Join/Register Campaign.

```
Browse Campaign
      ↓
Read Campaign Terms
      ↓
Connect YouTube
      ↓
Create & Publish Clip
      ↓
Select Own YouTube Video
      ↓
Submit Video  (UI: views dihitung sejak submit, tetapi hanya dibayar jika ACCEPTED)
      ↓
Objective Verification
      ↓
Creator Review
```

Satu clipper dapat mengirim beberapa video ke campaign (batas di Section 10.2). Views dihitung sejak video disubmit (Section 7.5), tetapi pembayaran baru bisa diklaim setelah submission ACCEPTED.

## 3. Campaign Terms & Storage

Campaign Terms disimpan sebagai dokumen di Supabase Storage (bucket private).

```
Supabase Storage
└── campaign-terms/
    └── {campaign_id}/
        └── terms.pdf
```

Database menyimpan `campaign_id`, `terms_file_path`, `terms_hash`. File tidak disimpan on-chain. Backend memberi signed URL (masa berlaku singkat) kepada user yang berhak.

Hash dokumen dicatat pada Campaign PDA:

```
Campaign Terms → SHA-256 → terms_hash → Solana Campaign PDA
```

Tujuannya memastikan dokumen tidak berubah tanpa terdeteksi. Frontend menghitung ulang hash dari file sebelum creator menandatangani transaksi, sehingga creator tidak perlu mempercayai hash dari backend.

**Persetujuan terms oleh clipper.** Karena tidak ada Join, persetujuan direkam saat submit: `register_submission()` menyimpan `terms_hash` yang berlaku saat itu. Karena terms tidak berubah setelah ACTIVE, nilainya selalu sama dengan hash campaign; field ini berfungsi sebagai catatan persetujuan dan persiapan untuk versi terms di masa depan.

Terms wajib mencantumkan:

- views dihitung sejak submission didaftarkan, tetapi hanya dibayar jika submission berstatus ACCEPTED (Section 7.5, 8.4);
- views setelah `end_time` tidak dibayar, **kecuali views yang tercatat dalam jendela toleransi final** (`end_time ± final_snapshot_tolerance`, Section 7.6), yang dapat ikut terbayar;
- syarat channel clipper (`min_subscribers`, `min_channel_age_days`) bila ada;
- aturan video yang dihapus/di-private-kan (Section 9.2);
- views yang diperbaiki YouTube (turun) tidak mengurangi reward yang sudah dibayar (Section 7.4);
- syarat mention hanya diverifikasi saat submit (Section 9.2);
- views yang dilaporkan dapat ditahan untuk peninjauan manual bila terdeteksi anomali (Section 7.4).

## 4. Roles

### Creator

- membuat campaign dan upload terms;
- menentukan CPM dan budget, melakukan funding dan top-up;
- menerima/menolak submission (penolakan wajib disertai alasan);
- melakukan refund setelah settlement period selesai (dana selalu kembali ke wallet creator; tujuan tidak dapat diubah).

### Clipper

- menghubungkan YouTube, membuat clip, submit video;
- mengajukan appeal;
- menerima pembayaran berdasarkan views.

Satu wallet dapat berperan sebagai Creator maupun Clipper, tetapi tidak dapat submit ke campaign miliknya sendiri.

### Oracle Service

Service backend yang mengambil data YouTube dan mengirim laporan views ke program Solana. Oracle ditentukan oleh `config.oracle` pada Config PDA (Section 10.7). Oracle tidak menentukan apakah clip diterima atau ditolak.

### Admin (Config)

Wewenang admin hanya mengganti oracle dan memindahkan peran admin. Admin **tidak punya akses ke vault atau dana apa pun**. Di produksi, admin sebaiknya multisig (misalnya Squads).

## 4.1 Parameter Campaign (Configurable)

Semua parameter disimpan saat `initialize_campaign()`, bukan konstanta, sehingga flow review, appeal, dan settlement dapat didemokan di devnet dalam hitungan menit.

| Parameter | Default produksi | Default demo (devnet) |
| --- | --- | --- |
| `review_period` (batas review awal) | 3 hari | 3 menit |
| `appeal_window` (batas appeal sejak rejection) | 2 hari | 2 menit |
| `appeal_timeout` (batas creator merespons appeal) | 3 hari | 3 menit |
| `settlement_period` (claim setelah end\_time) | 7 hari | 3 menit |
| `max_report_age` (umur maksimum report saat claim) | 24 jam | 10 menit |
| `final_snapshot_tolerance` (jendela ± terhadap end\_time) | 1 jam | 1 menit |
| `clock_skew_tolerance` (selisih jam oracle vs on-chain yang ditoleransi) | 30 detik | 10 detik |
| `max_videos_per_clipper` (submission aktif) | 5 | 5 |

Batas total submission per clipper (termasuk yang ditolak) = 2 × `max_videos_per_clipper` (Section 10.2).

**Validasi saat `initialize_campaign()`** (error `InvalidParams`):

- `cpm > 0`, `max_payout_per_video > 0`, `budget > 0`;
- `now < end_time` dan `start_time < end_time`;
- semua durasi > 0;
- `settlement_period > 2 × final_snapshot_tolerance`;
- `0 < clock_skew_tolerance < final_snapshot_tolerance`.

## 5. Submission Verification

Saat clipper submit video, backend melakukan objective verification:

- video berasal dari YouTube channel yang terhubung ke wallet clipper;
- video bersifat public;
- `publishedAt` berada dalam `[start_time, now]` dan `<= end_time`;
- required creator mention tersedia;
- video ID belum pernah digunakan pada campaign tersebut;
- channel memenuhi `min_subscribers` dan `min_channel_age_days` jika dikonfigurasi (lapis anti-bot murah).

Selain itu:

- submit ditolak jika wallet clipper sama dengan creator campaign;
- satu YouTube channel hanya dapat terikat ke satu wallet (unique constraint di database);
- batas jumlah video per clipper berlaku (Section 10.2).

MVP dapat membatasi daftar video berdasarkan durasi `<= 180 detik`, tetapi durasi bukan bukti bahwa video adalah YouTube Shorts. Dokumen ini memakai istilah "video pendek" untuk batasan durasi dan "Shorts" hanya bila benar-benar diverifikasi.

Setelah verifikasi berhasil, backend mengembalikan data transaksi dan clipper menandatangani `register_submission()`.

## 6. Creator Review

Setelah `register_submission()`, submission berstatus `PENDING_REVIEW` dengan `review_deadline = submitted_at + review_period`. Oracle Worker segera mengirim baseline (Section 7.5), tanpa menunggu review.

### Review awal

```
PENDING_REVIEW
      │
      ├── Creator accept (sebelum review_deadline)  →  ACCEPTED  →  dapat claim
      │
      ├── Creator reject + reason_hash (sebelum review_deadline)  →  REJECTED  →  Appeal
      │
      └── Creator tidak merespons sampai review_deadline
              ↓
          finalize_timeout()  →  ACCEPTED (otomatis)
```

### Appeal

```
REJECTED (rejected_at)
   ↓
Appeal (dalam appeal_window sejak rejected_at, maksimal 1 kali)
   ↓
Final Decision oleh Creator
   │
   ├── Creator accept  →  ACCEPTED
   ├── Creator reject  →  REJECTED_FINAL
   └── Tidak merespons sampai appeal_timeout
           ↓
       finalize_timeout()  →  ACCEPTED (otomatis)
```

`finalize_timeout()` dapat dipanggil siapa saja. Review berlaku untuk submission, bukan setiap claim.

**Alasan penolakan.** `reject_submission()` menerima `reason_hash` (SHA-256 teks alasan). Teks alasan disimpan di `review_actions` (off-chain) dan ditampilkan ke clipper. Ini memberi jejak audit atas penolakan tanpa alasan.

**Notifikasi.** Karena auto-accept berarti creator yang lalai menanggung akibatnya, sistem mengirim notifikasi in-app dan email (bila diisi) untuk: submission baru, pengingat mendekati `review_deadline` (misalnya 24 jam dan 1 jam sebelumnya; skala proporsional pada parameter demo), hasil review, appeal masuk, dan hasil appeal. Notifikasi tidak memengaruhi aturan on-chain.

**Trade-off yang disadari:** final decision appeal dibuat oleh Creator yang sama dengan reviewer awal, sehingga appeal efektif terutama lewat `finalize_timeout()`. Mekanisme dispute independen ada di luar scope MVP.

## 7. YouTube & Oracle

### 7.1 Data yang diambil backend

```
videoId, channelId, title, description, publishedAt,
duration, availability, viewCount, fetchTime
```

Polling memakai `videos.list` dengan batch hingga 50 video ID per request (1 unit kuota) untuk menghemat kuota harian YouTube Data API (default 10.000 unit). Frekuensi polling dinaikkan mendekati `end_time`.

### 7.2 Alur data

```
YouTube API
     ↓
YouTube Service  (adapter: real / mock, dipilih lewat config)
     ↓
View Sync Worker (polling berkala)
     ↓
PostgreSQL view_snapshots
     ↓
Sanity Check (Section 7.4)
     ↓
Oracle Worker
     ↓
submit_oracle_report()  →  OracleReport PDA
     ↓
claim() membaca OracleReport PDA
```

Data polling tidak dikirim ke blockchain setiap kali. Oracle Worker mengirim report hanya saat: baseline, permintaan claim (Section 11.2), satu report non-final terakhir sebelum `end_time`, dan final snapshot.

### 7.3 Mekanisme oracle

Oracle yang terdaftar di Config PDA (`config.oracle`) mengirim report ke `OracleReport` PDA lewat `submit_oracle_report()`. Clipper kemudian memanggil `claim()`, dan program membaca report yang tersimpan. Tidak ada verifikasi ed25519 lewat instruction sysvar pada MVP.

`OracleReport` (satu PDA per submission, seed `["report", submission]`) hanya menyimpan report terbaru; histori lengkap ada di database dan event on-chain.

```
submission, view_count, fetched_at, report_seq, is_final, reporter
```

`report_seq` dinaikkan oleh program (`previous + 1`), bukan diisi oracle, dan tetap berlanjut setelah rotasi oracle. `reporter` adalah key oracle yang mengirim report. Biaya transaksi dan rent `OracleReport` ditanggung oracle; akun ditutup lewat `close_report()` setelah settlement berakhir (Section 10.8). Biaya ini dipantau sebagai metrik operasional.

### 7.4 Validasi `submit_oracle_report()`

**Report pembanding** = report yang tersimpan di `OracleReport` PDA, **hanya jika `reporter == config.oracle` saat ini**. Bila reporter-nya key lama (setelah rotasi) atau belum ada report, dianggap tidak ada report pembanding.

Program menolak report jika:

1. signer bukan `config.oracle` (`NotOracle`);
2. status submission `REJECTED_FINAL` (`InvalidStatus`). Status lain boleh menerima report agar baseline, report non-final, dan report final tetap ada saat review atau appeal selesai terlambat. Klaim tetap hanya untuk ACCEPTED;
3. `fetched_at > now + clock_skew_tolerance` (`ReportFromFuture`);
4. `fetched_at <= fetched_at` report pembanding (`ReportReplay`);
5. `view_count <` report pembanding (`ViewsDecreased`);
6. `fetched_at < submitted_at - clock_skew_tolerance` (`ReportBeforeSubmission`; agar baseline tidak memakai data sebelum video didaftarkan);
7. report non-final dengan `fetched_at > end_time` (`ReportAfterEnd`). **Pengecualian: baseline** (report pertama submission, saat `baseline_views` masih kosong) boleh memiliki `fetched_at` sampai `now`, selama `now <= end_time + final_snapshot_tolerance`, karena baseline tidak menghasilkan payout dan hanya menurunkan eligible views;
8. report final di luar jendela `[end_time - tolerance, end_time + tolerance]`, atau dikirim saat `now <= end_time`, atau setelah `end_time + settlement_period` (`FinalOutsideWindow`, `SettlementOver`);
9. report pembanding sudah berstatus final (`FinalAlreadyReceived`). Karena report pembanding hanya dari oracle saat ini, oracle baru dapat mengirim ulang final setelah rotasi;
10. report final dikirim sebelum baseline ada (`FinalBeforeBaseline`).

Report pertama yang diterima untuk sebuah submission (saat `baseline_views` kosong) otomatis menjadi baseline (Section 7.5).

**Kebijakan views turun.** `viewCount` YouTube kadang turun karena penghapusan views spam. Oracle Worker tidak pernah melaporkan angka lebih kecil dari report terakhirnya: `reported = max(fetched_view_count, last_reported_view_count)`. Dengan begitu aturan 5 tidak membuat oracle tersangkut, dan reward yang sudah dibayar tidak ditarik kembali.

**Sanity check lonjakan views (Oracle Worker, off-chain).** Karena report bersifat monotonik, angka salah akan permanen. Sebelum mengirim, Oracle Worker memeriksa pertumbuhan terhadap report terakhir:

- pertumbuhan per jam melebihi batas absolut (`ANOMALY_MAX_GROWTH_PER_HOUR`, configurable), atau
- laju melebihi `ANOMALY_MULTIPLIER` × median laju 24 jam terakhir submission tersebut. **Cold start:** bila submission belum punya riwayat cukup (mis. < 6 titik data), hanya batas absolut yang berlaku.

Report yang anomali ditandai `held` di `oracle_reports`, tidak dikirim on-chain, dan memicu alert. Operator memutuskan lewat `POST /internal/oracle/holds/:id/release` atau `/discard`. Selama held, claim memakai report terkonfirmasi terakhir. Jika yang tertahan adalah **baseline**, submission belum bisa claim (`BaselineMissing`) sampai operator memutuskan; alert baseline 5 menit tetap berlaku. Peninjauan harus selesai sebelum jendela final tertutup; bila terlewat, fallback Section 7.6 berlaku (konservatif).

**Profil demo.** Threshold sanity check berasal dari config per environment. Profil demo memakai batas tinggi (atau menonaktifkan check) agar lonjakan views mock (mis. +10.000 dalam beberapa menit pada skenario Section 14) tidak tertahan; profil produksi memakai batas ketat.

**Clock skew.** Oracle Worker menetapkan `fetched_at = min(server_time, chain_time_terakhir_diketahui)` dan menyinkronkan jam server (NTP). Program menoleransi selisih `clock_skew_tolerance` pada aturan 3 dan 6.

### 7.5 Baseline views

- Submission PDA menyimpan `baseline_views: Option<u64>`.
- Setelah `register_submission()` terkonfirmasi (status `PENDING_REVIEW`), Oracle Worker segera mengirim report pertama. Report pertama menjadi baseline dan tidak menghasilkan payout.
- `eligibleViews = max(0, latest_view_count - baseline_views)`.
- `claim()` ditolak (`BaselineMissing`) jika baseline belum ada.
- Karena baseline dikirim saat PENDING\_REVIEW, views sejak submit ikut dihitung. Creator tidak mendapat keuntungan dari menunda review.
- Pembayaran tetap hanya untuk submission ACCEPTED. Submission REJECTED\_FINAL tidak dibayar.
- Submission yang ACCEPTED setelah `end_time` tetap memiliki eligible views (baseline dan report non-final/final sudah dikirim saat review), selama `claim()` terjadi sebelum `end_time + settlement_period`.
- Monitoring: alert jika baseline belum terkirim 5 menit (produksi) setelah `register_submission()`.

Views antara `submitted_at` dan report baseline tidak dihitung; selisihnya kecil karena baseline dikirim segera.

### 7.6 Cutoff di `end_time` (final snapshot + fallback)

Views setelah `end_time` pada dasarnya tidak menghasilkan reward, sementara claim tetap bisa dilakukan selama settlement. Karena report final boleh memiliki `fetched_at` sampai `end_time + tolerance`, views dalam jendela toleransi tersebut dapat ikut terbayar; ini perilaku yang disengaja dan dicantumkan di terms (Section 3).

- Setelah `end_time`, Oracle Worker mengirim report `is_final = true`. Program menerimanya hanya jika `fetched_at` dalam `[end_time - tolerance, end_time + tolerance]`.
- Sebelum `end_time`, Oracle Worker mengirim juga satu report non-final terakhir sedekat mungkin dengan `end_time` (polling dipercepat).
- Oracle Worker mengirim report final untuk semua submission yang belum REJECTED\_FINAL, termasuk yang masih PENDING\_REVIEW atau dalam appeal. **Pengecualian:** submission REJECTED yang tidak di-appeal dan `appeal_window`-nya sudah lewat dilewati (tidak dapat menjadi ACCEPTED).
- Setelah report final dari oracle saat ini diterima, tidak ada report baru untuk submission tersebut.

Aturan `claim()` saat `now > end_time` (report yang dipakai harus berasal dari oracle saat ini, Section 7.7):

| Kondisi | Hasil |
| --- | --- |
| Report final ada | dipakai |
| Belum ada final, `now <= end_time + tolerance` | ditolak `FinalReportPending` (menunggu oracle) |
| Belum ada final, `now > end_time + tolerance` | fallback: dipakai report non-final terakhir (selalu `fetched_at <= end_time`, tanpa syarat `max_report_age`) |

Fallback mencegah claim terkunci permanen jika oracle gagal pada jendela final. Dampaknya konservatif: views antara report terakhir dan `end_time` tidak dibayar.

### 7.7 Validasi saat `claim()`

- `report.reporter == config.oracle` saat ini (jika tidak: `InvalidReporter`). Report dari key lama tidak bisa dipakai claim setelah rotasi.
- Sebelum atau saat `end_time`: report terbaru harus memenuhi `now - fetched_at <= max_report_age` (jika tidak: `ReportTooOld`).
- Setelah `end_time`: aturan tabel Section 7.6.

**Pemulihan setelah rotasi.** Bila report tersimpan berasal dari key lama, oracle baru mengirim ulang report. Setelah `end_time + tolerance`, oracle baru tidak dapat mengambil angka segar; ia mengirim ulang dari `view_snapshots` di database (aturan 7 dan 8 tetap berlaku: non-final dengan `fetched_at <= end_time`, atau final dengan `fetched_at` dalam jendela). Snapshot yang diduga tercemar diaudit lebih dulu (Section 16).

## 8. Payment

### 8.1 Satuan

- aUSDC memiliki 6 desimal; semua nilai on-chain dalam base unit (`u64`). 1 aUSDC = 1.000.000 base unit.
- `cpm` adalah base unit aUSDC per 1000 views.
- Perhitungan memakai `u128` dan checked math, lalu dikonversi ke `u64`.

### 8.2 Formula

```
eligibleViews = max(0, reportedViews - baselineViews)

entitlement   = min( floor(eligibleViews × cpm / 1000), maxPayoutPerVideo )

claimable     = max(0, entitlement - totalActuallyPaid)

remainingPool = saldo token vault saat ini

payout        = min(claimable, remainingPool)
```

`totalActuallyPaid` disimpan di Submission PDA. `remainingPool` selalu dibaca dari saldo vault (bukan counter terpisah) sehingga tidak bisa tidak sinkron. Jika `payout = 0`: `claimable = 0` → error `NothingToClaim`; `remainingPool = 0` → error `PoolEmpty`. Transaksi gagal tanpa perubahan state.

### 8.3 Partial payout

```
Entitlement       = 200 aUSDC
Already Paid      = 100 aUSDC
Remaining Pool    =  50 aUSDC

Claimable         = 100 aUSDC
Actual Payout     =  50 aUSDC
Remaining Claim   =  50 aUSDC
```

Sisa klaim tetap dapat diambil pada claim berikutnya (misalnya setelah top-up), **walaupun tidak ada views baru**.

### 8.4 Keputusan desain MVP

- **First-come-first-served:** jika pool terbatas, clipper yang claim lebih dulu dibayar lebih dulu. Pro-rata tidak dibuat pada MVP.
- **Views dihitung sejak submit.** Views antara submit dan ACCEPTED ikut dihitung (baseline saat PENDING\_REVIEW), tetapi hanya dibayar bila submission ACCEPTED. Ini menghapus insentif creator menunda review.
- **Mitigasi view botting MVP:** `maxPayoutPerVideo`, batas video per clipper, syarat channel (`min_subscribers`, `min_channel_age_days`), dan sanity check lonjakan di Oracle Worker. Farm wallet dalam jumlah besar belum ditangani (Section 18).

## 9. Campaign Lifecycle

Status yang disimpan on-chain: `PENDING_FUNDING`, `FUNDED`, `CLOSED`. Status `SETTLEMENT` diturunkan dari waktu on-chain, bukan disimpan.

```
PENDING_FUNDING → FUNDED(ACTIVE) → SETTLEMENT → CLOSED
```

| Kondisi | Status efektif |
| --- | --- |
| setelah `initialize_campaign()`, belum `fund_campaign()` | PENDING\_FUNDING |
| funded dan `now <= end_time` | ACTIVE |
| funded dan `end_time < now <= end_time + settlement_period` | SETTLEMENT |
| `refund()` sudah dipanggil | CLOSED |

Frontend menggabungkan `initialize_campaign()` dan `fund_campaign()` dalam satu transaksi sehingga PENDING\_FUNDING hampir tidak terlihat. Jika terpisah dan creator tidak pernah mendanai, tidak ada dana yang berisiko; creator dapat memanggil `close_unfunded()` untuk menutup akun dan mengambil kembali rent.

### 9.1 Aturan

**PENDING\_FUNDING**

- Hanya `fund_campaign()` (harus transfer tepat `budget`, dan `now < end_time`) atau `close_unfunded()` yang diperbolehkan.

**ACTIVE**

- Submission baru diperbolehkan hanya saat `start_time <= now <= end_time`; top-up dan claim diperbolehkan.
- Terms dan `end_time` tidak dapat diubah.
- Campaign tidak otomatis berakhir ketika pool kosong; payout menjadi partial.

**SETTLEMENT**

- Submission baru dan top-up ditutup.
- Views setelah `end_time` tidak menghasilkan reward (kecuali dalam jendela toleransi final, Section 7.6).
- Claim tetap diperbolehkan sesuai Section 7.6.
- Review, appeal, dan `finalize_timeout()` tetap berjalan; submission yang selesai review setelah `end_time` tetap dapat claim bila masih dalam settlement.
- `refund()` belum boleh dipanggil.

**Setelah `end_time + settlement_period`**

- Claim berakhir otomatis; `refund()` boleh dipanggil, hanya oleh Creator. Batas keduanya konsisten: claim memakai `<=`, refund memakai `>` (wajib ada test case di batas tepat).
- Pembersihan akun (`close_report()`, `close_submission()`, `close_stats()`) juga boleh mulai saat `now > end_time + settlement_period`, **tanpa menunggu creator memanggil `refund()`**, sehingga rent clipper dan oracle tidak terkunci bila creator tidak aktif.

**CLOSED**

- `refund()` memindahkan seluruh sisa pool ke wallet creator, menutup vault, dan menandai CLOSED. Tidak ada claim atau refund lagi. Campaign PDA tetap ada (tidak ditutup) agar seed-nya tidak dapat diinisialisasi ulang.

### 9.2 Batasan MVP (known limitation)

- Submission yang masih `PENDING_REVIEW` atau dalam appeal saat settlement berakhir dapat selesai setelahnya; tidak ada payout untuknya.
- Jika creator tidak pernah memanggil `refund()`, dana sisa tetap di vault; belum ada pihak lain yang dapat menutup campaign.
- Video yang dihapus/di-private-kan setelah ACCEPTED tidak ditangani khusus; oracle melaporkan views terakhir yang tersedia.
- Syarat mention hanya diverifikasi saat submit; deskripsi video dapat diedit setelahnya tanpa terdeteksi. Pengecekan ulang berkala menjadi pengembangan berikutnya.
- Oracle tunggal adalah single point of failure; mitigasinya hanya monitoring, retry, rotasi lewat Config PDA, dan fallback final (Section 7.6).
- Baseline yang tidak terkirim sampai `end_time + final_snapshot_tolerance` membuat submission itu tidak bisa claim (`BaselineMissing`). Mitigasi: alert 5 menit dan retry.
- Baseline yang dipalsukan key oracle yang bocor tetap tersimpan di Submission PDA setelah rotasi; diperlukan audit manual (Section 16).

## 10. Smart Contract

Program Solana memakai Rust + Anchor. Satu binary dipakai di semua environment (tidak ada cargo feature per environment untuk oracle).

### 10.1 Instruction

```
initialize_config()   update_oracle()   propose_admin()   accept_admin()

initialize_campaign()   fund_campaign()   top_up()   close_unfunded()

register_submission()   accept_submission()   reject_submission()
appeal_submission()     finalize_timeout()

submit_oracle_report()

claim()   refund()

close_report()   close_submission()   close_stats()
```

### 10.2 Detail instruction

**`initialize_config(admin, oracle)`** Hanya dapat dipanggil sekali, dan hanya oleh **upgrade authority** program (diperiksa lewat akun ProgramData). Mencegah pihak lain meng-init Config lebih dulu (front-running). Error: `ConfigAlreadyInitialized`, `NotUpgradeAuthority`.

**`update_oracle(new_oracle)`** Hanya `admin`. Emit `OracleUpdated(old, new)`.

**`propose_admin(new_admin)` / `accept_admin()`** Transfer admin dua langkah. `propose_admin` oleh admin saat ini menyimpan `pending_admin`; `accept_admin` hanya oleh `pending_admin`. Emit `AdminTransferred`.

**`initialize_campaign()`** Menyimpan `terms_hash`, `cpm`, `max_payout_per_video`, `budget`, `start_time`, `end_time`, `mint`, dan semua parameter Section 4.1 (dengan validasi `InvalidParams`). Status awal PENDING\_FUNDING. `campaign_id` bertipe `u64` (Section 10.3). Dibuat bersama `fund_campaign()` dalam satu transaksi oleh frontend.

**`fund_campaign()`** Hanya Creator, hanya saat PENDING\_FUNDING dan `now < end_time`. Membuat vault (rent dibayar creator), transfer tepat `budget` aUSDC dari token account creator ke vault, lalu status menjadi FUNDED.

**`top_up()`** Hanya Creator, hanya saat ACTIVE (`now <= end_time`). Menambah saldo vault dan `total_funded`.

**`close_unfunded()`** Hanya Creator, hanya saat PENDING\_FUNDING. Menutup akun campaign dan mengembalikan rent.

**`register_submission()`**

- Dipanggil clipper. Submission PDA dengan seed `["submission", campaign, video_id]`; `video_id` adalah string YouTube 11 byte (divalidasi panjang dan karakter), sehingga video yang sama tidak dapat didaftarkan dua kali.
- Syarat: campaign FUNDED, `start_time <= now <= end_time`, wallet clipper bukan creator, `ClipperStats.active_count < max_videos_per_clipper`, dan `ClipperStats.total_submitted < 2 × max_videos_per_clipper`.
- Menyimpan `terms_hash`, `submitted_at`, `review_deadline = submitted_at + review_period`. Menaikkan `active_count` dan `total_submitted`.
- Status awal: PENDING\_REVIEW.
- `ClipperStats` dibuat dengan `init_if_needed` (seed tetap, dibayar clipper); field diperiksa eksplisit agar tidak dapat di-reset.

**Kuota video.**

- `active_count` menghitung submission yang tidak sedang REJECTED atau REJECTED\_FINAL. Perubahannya:
  - `register_submission()`: +1;
  - reject awal (PENDING\_REVIEW → REJECTED): −1, slot dibebaskan agar creator tidak bisa "membakar" kuota clipper;
  - `appeal_submission()`: +1, gagal dengan `QuotaExceeded` bila kuota aktif sudah penuh (clipper kehilangan kesempatan appeal bila jendela habis; dicatat sebagai batasan);
  - reject final saat appeal (REJECTED → REJECTED\_FINAL): −1, karena appeal sebelumnya sudah +1;
  - accept, `finalize_timeout()`: tidak mengubah `active_count`.
- `total_submitted` tidak pernah turun dan menghitung semua submission termasuk yang ditolak. Batas keras 2 × `max_videos_per_clipper` (error `TotalQuotaExceeded`) mencegah siklus submit–reject tanpa akhir yang membebani creator dan oracle.

**`accept_submission()` / `reject_submission()`**

- Hanya Creator. Diizinkan pada dua keadaan saja:
  1. status PENDING\_REVIEW dan `now <= review_deadline`;
  2. status REJECTED dengan `appealed_at` terisi (menunggu keputusan appeal) dan `now <= appealed_at + appeal_timeout`.
- Selain itu: `InvalidStatus` atau `ReviewDeadlinePassed`.
- Accept mengisi `accepted_at = now`. Reject pada keadaan 1 mengisi `rejected_at = now` dan `reason_hash`; reject pada keadaan 2 mengubah status menjadi REJECTED\_FINAL.

**`appeal_submission()`**

- Hanya Clipper, hanya saat REJECTED, `now <= rejected_at + appeal_window`, dan belum pernah appeal.
- Menyimpan `appealed_at`. Creator lalu accept atau reject (final) sebelum `appeal_timeout`.

**`finalize_timeout()`** Dapat dipanggil siapa saja. Submission menjadi ACCEPTED (`accepted_at = now`) jika:

1. status PENDING\_REVIEW dan `now > review_deadline`; atau
2. status REJECTED dengan appeal dan `now > appealed_at + appeal_timeout`.

**`submit_oracle_report()`** Lihat Section 7.3 sampai 7.6. Menerima akun Config (read-only).

**`claim()`**

- Hanya clipper pemilik submission.
- Syarat: submission ACCEPTED, baseline ada, `now <= end_time + settlement_period`, report valid (Section 7.7). Menerima akun Config (read-only).
- Menghitung payout (Section 8), transfer dari vault ke token account clipper, memperbarui `total_paid`, emit event.

**`refund()`**

- Hanya Creator. Syarat: `now > end_time + settlement_period`, campaign belum CLOSED.
- Memindahkan seluruh saldo vault ke token account creator, menutup vault (rent kembali ke creator), dan menandai CLOSED.

**`close_report()` / `close_submission()` / `close_stats()`**

- Syarat: `now > end_time + settlement_period` (claim sudah berakhir; tidak perlu menunggu `refund()`). Register ulang video yang sama tidak mungkin karena `now > end_time`.
- `close_report()` oleh oracle saat ini atau reporter tercatat (rent kembali ke reporter); `close_submission()` dan `close_stats()` oleh clipper pemilik (rent kembali ke clipper).

### 10.3 Akun on-chain

| Akun | Seed | Field utama |
| --- | --- | --- |
| Config | `["config"]` | `admin`, `pending_admin: Option<Pubkey>`, `oracle`, `bump` |
| Campaign | `["campaign", creator, campaign_id_le_bytes]` | `campaign_id: u64`, `creator`, `mint`, `vault`, `terms_hash`, `cpm`, `max_payout_per_video`, `budget`, `total_funded`, `total_paid`, `start_time`, `end_time`, semua parameter waktu (termasuk `clock_skew_tolerance`), `status` (PendingFunding/Funded/Closed), `bump` |
| Vault (token account) | `["vault", campaign]` | authority = Campaign PDA |
| Submission | `["submission", campaign, video_id]` | `campaign`, `clipper`, `video_id`, `terms_hash`, `status`, `submitted_at`, `review_deadline`, `rejected_at`, `reason_hash`, `appealed_at`, `accepted_at`, `baseline_views: Option<u64>`, `total_paid`, `bump` |
| OracleReport | `["report", submission]` | `submission`, `view_count`, `fetched_at`, `report_seq`, `is_final`, `reporter` |
| ClipperStats | `["stats", campaign, clipper]` | `active_count`, `total_submitted` |

Status submission: `PendingReview`, `Rejected`, `Accepted`, `RejectedFinal`.

**`campaign_id`** bertipe `u64`, dibuat backend dari sequence database dan sama dengan `campaigns.id` (bigint). Dipakai sebagai seed PDA (little-endian 8 byte) dan path terms.

### 10.4 Kode error program

| Error | Arti / pesan UI |
| --- | --- |
| `NotCreator`, `NotClipper`, `NotOracle`, `NotAdmin`, `NotUpgradeAuthority` | Signer tidak berhak |
| `ConfigAlreadyInitialized` | Config sudah diinisialisasi |
| `InvalidParams` | Parameter campaign tidak valid |
| `InvalidMint` | Token bukan aUSDC campaign |
| `CampaignNotFunded`, `CampaignNotActive`, `CampaignClosed` | Status campaign tidak sesuai |
| `OutsideCampaignPeriod` | Di luar start\_time..end\_time |
| `SelfSubmission` | Creator tidak boleh submit ke campaign sendiri |
| `QuotaExceeded` | Batas video aktif per clipper tercapai |
| `TotalQuotaExceeded` | Batas total submission per clipper tercapai |
| `InvalidStatus` | Status submission tidak sesuai |
| `ReviewDeadlinePassed`, `ReviewDeadlineNotReached` | Batas review |
| `AppealWindowClosed`, `AlreadyAppealed` | Aturan appeal |
| `BaselineMissing` | Baseline views belum ada |
| `ReportReplay`, `ViewsDecreased`, `ReportFromFuture`, `ReportBeforeSubmission`, `ReportAfterEnd` | Report oracle tidak valid |
| `FinalOutsideWindow`, `FinalAlreadyReceived`, `FinalBeforeBaseline` | Aturan report final |
| `InvalidReporter` | Report berasal dari oracle lama; minta report baru |
| `ReportTooOld` | Report kedaluwarsa; minta report baru |
| `FinalReportPending` | Menunggu report final dari oracle |
| `SettlementOver`, `SettlementNotOver` | Batas settlement |
| `NothingToClaim`, `PoolEmpty` | Tidak ada yang dapat diklaim / pool kosong |
| `MathOverflow` | Overflow pada checked math |

Frontend memetakan setiap kode ke pesan yang dapat dipahami user.

### 10.5 Event on-chain

Setiap instruction yang mengubah state meng-emit event agar backend dapat menyinkronkan database:

```
OracleUpdated(old, new), AdminTransferred
CampaignInitialized, CampaignFunded, CampaignToppedUp, CampaignClosed
SubmissionRegistered, SubmissionAccepted, SubmissionRejected,
SubmissionAppealed, SubmissionFinalized
OracleReportSubmitted (termasuk is_final, reporter)
Claimed (amount, remaining_claim), Refunded (amount)
```

### 10.6 Yang ditangani on-chain

- konfigurasi oracle dan admin;
- campaign state, terms hash, pool, CPM, maximum payout, start/end time;
- submission identity dan review state;
- oracle authorization dan anti-replay;
- payout dan refund.

### 10.7 Oracle authorization & trust assumption

Public key oracle disimpan di **Config PDA**, bukan di-hardcode. Semua environment memakai binary yang sama; oracle diatur lewat `initialize_config()` pada skrip deploy masing-masing environment. `submit_oracle_report()` dan `claim()` menerima akun Config dan memvalidasi terhadap `config.oracle`.

**Rotasi key.** Admin memanggil `update_oracle()`. Report yang `reporter`-nya bukan oracle saat ini tidak valid saat `claim()` (`InvalidReporter`), sehingga report dari key yang bocor tidak bisa dipakai claim. Aturan anti-replay, "views tidak boleh turun", dan "final sudah diterima" (aturan 4, 5, 9 Section 7.4) hanya membandingkan dengan report yang `reporter`-nya sama dengan oracle saat ini; ini memungkinkan oracle baru mengoreksi angka dan mengganti report final yang dipalsukan key lama. Prosedur pemulihan ada di Section 7.7.

**Trust assumption.** Oracle dipercaya melaporkan views dengan benar. Kerusakan akibat oracle yang salah atau bocor dibatasi oleh `maxPayoutPerVideo` dan budget. Admin di produksi sebaiknya multisig.

**Pemisahan key.** Oracle key, admin, upgrade authority, dan mint authority faucet adalah key berbeda. Oracle key hanya ada di Oracle Worker (idealnya KMS/secret manager), tidak di server API. Faucet berjalan dengan key sendiri.

### 10.8 Praktik implementasi

- Checked math untuk semua operasi `u64`/`u128`.
- Validasi mint dan token account (harus aUSDC campaign; owner token account harus sesuai pihak yang berhak).
- Vault dimiliki PDA (authority = Campaign PDA), bukan wallet creator.
- **Token account dan rent:**
  - ATA clipper dibuat lewat instruksi create-ATA idempotent di transaksi yang sama dengan `claim()`, dibayar clipper.
  - ATA creator dibuat dengan cara yang sama pada `refund()` (dan `fund_campaign()` bila perlu), dibayar creator.
  - Vault dibuat saat `fund_campaign()` (rent dibayar creator) dan ditutup saat `refund()`.
  - Submission dan `ClipperStats` dibayar clipper; `OracleReport` dibayar oracle.
  - Campaign PDA tidak ditutup setelah CLOSED untuk mencegah inisialisasi ulang dengan seed yang sama.
  - `OracleReport`, Submission, dan `ClipperStats` ditutup lewat `close_report()`, `close_submission()`, `close_stats()` setelah `end_time + settlement_period`.
- Anchor `init_if_needed` hanya dipakai untuk `ClipperStats` (seed tetap, field diperiksa).

### 10.9 Faucet aUSDC (demo)

- Mint authority aUSDC dipegang keypair khusus faucet (devnet saja), terpisah dari oracle key.
- `POST /faucet` mint jumlah tetap (misalnya 1000 aUSDC) ke wallet terautentikasi, rate limit sekali per 24 jam per wallet.

## 11. Backend

Stack:

```
Node.js, Express.js, JavaScript, Knex.js, PostgreSQL,
Supabase Storage, YouTube API, Next.js (frontend)
```

Backend menangani wallet authentication, session/JWT, YouTube OAuth dan channel binding, video listing, objective verification, metadata review/appeal, view snapshots, sanity check, oracle worker, penyimpanan terms, indexer event, notifikasi, dan faucet.

Transaksi milik user (init/fund, submit, review, appeal, claim, refund) ditandatangani wallet user dari frontend; backend hanya menyiapkan data. Hanya `submit_oracle_report()` ditandatangani oleh oracle key. Admin Config (`update_oracle`, dst.) ditandatangani wallet admin di luar backend (skrip atau multisig).

### 11.1 Daftar API

| Area | Endpoint |
| --- | --- |
| Auth | `POST /auth/nonce`, `POST /auth/verify`, `POST /auth/logout` |
| YouTube | `GET /youtube/connect`, `GET /youtube/callback`, `GET /youtube/videos`, `DELETE /youtube/channel` |
| Campaign | `POST /campaigns` (metadata + upload terms, mengembalikan `terms_hash`), `GET /campaigns`, `GET /campaigns/:id`, `GET /campaigns/:id/terms` (signed URL) |
| Submission | `POST /campaigns/:id/submissions` (verifikasi, mengembalikan data transaksi), `GET /campaigns/:id/submissions`, `GET /submissions/:id` |
| Review | `POST /submissions/:id/review-note` (alasan reject / catatan appeal, disimpan off-chain) |
| Claim | `POST /submissions/:id/claim-request`, `GET /claim-requests/:id`, `GET /submissions/:id/claims` |
| Notifikasi | `GET /me/notifications`, `POST /me/notifications/:id/read`, `PUT /me/email` |
| Faucet | `POST /faucet` |
| Internal (demo/ops) | `POST /internal/oracle/run` (trigger manual oracle worker), `POST /internal/oracle/holds/:id/release`, `POST /internal/oracle/holds/:id/discard` (semua dilindungi secret) |

### 11.2 Orkestrasi claim (dua langkah)

Claim membutuhkan report yang masih segar, sedangkan report dikirim oracle. Karena itu UX claim dikelola backend:

```
Clipper klik Claim
      ↓
POST /claim-request  → oracle worker snapshot + submit_oracle_report()
      ↓
Backend menunggu konfirmasi report, lalu status = READY
      ↓
Frontend meminta clipper menandatangani claim()
      ↓
Jika claim() gagal ReportTooOld atau InvalidReporter → ulangi dari awal (otomatis satu kali)
```

Jika report terbaru masih dalam `max_report_age` dan dikirim oleh oracle saat ini, langkah oracle dilewati. Setelah `end_time`, request claim hanya menunggu report final (atau fallback pada Section 7.6). Jika snapshot untuk claim tertahan oleh sanity check (`held`), request ditandai FAILED dengan `error_code = REPORT_HELD`; bila report terkonfirmasi terakhir masih dalam `max_report_age`, UI tetap menawarkan claim dengan report tersebut.

**Perlindungan penyalahgunaan** (karena fee dan rent ditanggung oracle):

- hanya satu request berstatus PENDING/READY per submission (partial unique index);
- cooldown antar request per submission (default produksi 60 detik, demo 15 detik; configurable);
- rate limit per wallet dan per IP pada endpoint claim-request;
- request ditolak bila submission belum ACCEPTED atau **tidak ada sisa klaim**, yaitu `min(floor((last_reported - baseline) × cpm / 1000), maxPayoutPerVideo) - total_paid <= 0` berdasarkan report terkonfirmasi terakhir. Sisa klaim dari partial payout (Section 8.3) tetap boleh diklaim tanpa views baru;
- request yang gagal ditandai FAILED dengan `error_code` dan dapat dicoba ulang setelah cooldown.

### 11.3 Sinkronisasi on-chain ↔ database

On-chain adalah sumber kebenaran; database adalah cache. Indexer membaca event program lewat webhook (atau polling `getSignaturesForAddress` dengan cursor tersimpan) dan menulis ke database secara idempoten dengan kunci `tx_signature + event_index`. Saat indexer tertinggal, UI menampilkan status "pending".

## 12. Database

PostgreSQL menyimpan data off-chain. Semua kolom status/on-chain adalah cache dari event (Section 11.3).

| Tabel | Kolom |
| --- | --- |
| `users` | `wallet` (PK), `email` (nullable), `nonce`, `nonce_expires_at`, `created_at` |
| `youtube_channels` | `id`, `wallet` (FK), `channel_id` (UNIQUE), `title`, `subscriber_count`, `channel_created_at`, `refresh_token_encrypted`, `revoked_at`, `created_at` |
| `campaigns` | `id` (bigint = `campaign_id` on-chain), `creator_wallet`, `title`, `brief`, `source_video`, `required_mention`, `payment_mint`, `terms_file_path`, `terms_hash`, `cpm`, `max_payout_per_video`, `budget`, `total_funded`, `total_paid`, `start_time`, `end_time`, `review_period`, `appeal_window`, `appeal_timeout`, `settlement_period`, `max_report_age`, `final_snapshot_tolerance`, `clock_skew_tolerance`, `max_videos_per_clipper`, `min_subscribers`, `min_channel_age_days`, `status` (PENDING\_FUNDING/FUNDED/CLOSED), `onchain_campaign`, `created_at` |
| `submissions` | `id`, `campaign_id`, `clipper_wallet`, `youtube_video_id`, `channel_id`, `title`, `published_at`, `status` (PENDING\_REVIEW/REJECTED/ACCEPTED/REJECTED\_FINAL), `onchain_submission`, `submitted_at`, `review_deadline`, `rejected_at`, `appealed_at`, `accepted_at`, `reason_hash`, `baseline_views`, `total_paid`, `terms_hash`, `register_tx`, `created_at`; UNIQUE (`campaign_id`, `youtube_video_id`) |
| `clipper_stats` | `campaign_id`, `clipper_wallet`, `active_count`, `total_submitted`; PK (`campaign_id`, `clipper_wallet`) |
| `review_actions` | `id`, `submission_id`, `actor_wallet`, `action` (ACCEPT/REJECT/APPEAL/AUTO\_ACCEPT), `reason`, `reason_hash`, `tx_signature`, `created_at` |
| `view_snapshots` | `id`, `submission_id`, `view_count`, `availability`, `fetched_at`, `flagged` (bool) |
| `oracle_reports` | `id`, `submission_id`, `report_seq`, `view_count`, `fetched_at`, `is_final`, `is_baseline`, `reporter`, `tx_signature`, `status` (pending/confirmed/failed/held/discarded), `hold_reason`, `attempts`, `created_at` |
| `claim_requests` | `id`, `submission_id`, `clipper_wallet`, `status` (PENDING/READY/FAILED/EXPIRED/DONE), `error_code`, `attempts`, `created_at`, `updated_at`; partial UNIQUE (`submission_id`) WHERE status IN (PENDING, READY) |
| `claims` | `id`, `submission_id`, `amount`, `remaining_claim`, `tx_signature`, `created_at` |
| `notifications` | `id`, `wallet`, `type`, `payload`, `read_at`, `emailed_at`, `created_at` |
| `indexer_cursor` | `id`, `last_signature`, `updated_at` |

**Retensi data YouTube.** Data yang diambil dari YouTube API (`view_snapshots`, metadata video) hanya disimpan sebatas keperluan verifikasi dan payout. Data lama dihapus atau diringkas setelah campaign CLOSED ditambah masa tenggang, dan data API yang disimpan di-refresh atau dihapus dalam batas waktu yang disyaratkan kebijakan YouTube API Services (periksa persyaratan terbaru sebelum produksi). Snapshot yang masih dibutuhkan untuk pemulihan rotasi oracle (Section 7.7) dipertahankan sampai `end_time + settlement_period`.

## 13. Authentication & Privasi

Wallet adalah payment identity.

```
Connect Wallet → Request Nonce → Sign Message → Backend Verify → Create Session
```

Nonce sekali pakai dengan masa berlaku singkat (disimpan di `users`). Pesan yang ditandatangani memuat: **domain**, **URI**, **nonce**, **issued\_at**, **expiration\_time**, dan nama jaringan/chain, sehingga tidak dapat di-replay di situs lain atau di luar masa berlaku. Backend memvalidasi semua field tersebut.

YouTube OAuth dipakai terpisah untuk mengikat wallet ke channel. Gunakan scope read-only (`youtube.readonly`).

- Refresh token disimpan terenkripsi; `DELETE /youtube/channel` mencabut akses dan menghapus token.
- Data YouTube yang disimpan terbatas pada data pada Section 7.1 dan statistik channel untuk verifikasi.
- Sediakan privacy policy yang menjelaskan data YouTube yang dipakai, tujuan, retensi, dan cara mencabut akses.
- Mode testing Google OAuth cukup untuk demo, tetapi refresh token kedaluwarsa setiap 7 hari: lakukan connect ulang channel demo sehari sebelum demo.

**Pemisahan key dan secret:**

| Key | Dipegang oleh | Catatan |
| --- | --- | --- |
| Oracle key | Oracle Worker | KMS/secret manager di produksi; bukan di server API |
| Admin Config | Wallet admin / multisig | Hanya ganti oracle dan admin; tanpa akses dana |
| Upgrade authority | Deployer / multisig | Hanya untuk upgrade program dan `initialize_config` |
| Faucet mint authority | Service faucet (devnet) | Tidak dipakai di mainnet |

## 14. Demo Scope

Demo utama:

1. Creator membuat campaign dan upload Terms.
2. Creator mendapat aUSDC dari faucet, lalu initialize + fund campaign.
3. Clipper melihat campaign, connect YouTube, membuat dan publish clip.
4. Backend melakukan objective verification; clipper menandatangani `register_submission()`; Oracle mengirim baseline segera; creator menerima submission.
5. Oracle mengirim views; clipper claim.
6. Views bertambah (mock YouTube API atau trigger manual oracle worker); clipper claim tambahan.
7. Demo partial payout saat pool tidak cukup.
8. Creator top-up; clipper mengambil sisa klaim (tanpa views baru).
9. Campaign berakhir; oracle mengirim final snapshot; clipper claim dengan angka final.
10. Setelah settlement selesai, creator melakukan refund sisa pool.
11. (Opsional) Rotasi oracle lewat `update_oracle()` tanpa redeploy.

Semua durasi memakai kolom "Default demo" (Section 4.1). Total jendela review, final, dan settlement sekitar 10–12 menit, memberi ruang di bawah target 20 menit. `YouTubeService` memiliki adapter mock yang dipilih lewat config; siapkan juga rekaman cadangan. **Oracle Worker memakai profil threshold sanity check demo (Section 7.4)** agar lonjakan views mock tidak tertahan. Testing otomatis memakai clock warp (solana-bankrun).

### Skenario angka (dapat direproduksi)

Parameter: `cpm = 2 aUSDC per 1000 views`, `max_payout_per_video = 50 aUSDC`, `budget = 60 aUSDC`.

| Langkah | Aktor | Views dilaporkan (baseline) | Entitlement | Dibayar | Pool setelahnya |
| --- | --- | --- | --- | --- | --- |
| Fund | Creator | — | — | — | 60 |
| Claim 1 | Clipper A | 11.000 (1.000) | 20 | 20 | 40 |
| Claim 2 | Clipper A | 31.000 (1.000) | 60 → cap 50 | 30 | 10 |
| Claim 3 | Clipper B | 20.500 (500) | 40 | 10 (partial), sisa klaim 30 | 0 |
| Top-up | Creator | — | — | — | 50 |
| Claim 4 | Clipper B | tanpa views baru | 40 | 30 | 20 |
| Final | Clipper B | 25.500 (500), `is_final` | 50 (cap) | 10 | 10 |
| Refund | Creator | — | — | — | 10 → wallet creator |

**Invarian yang harus selalu benar:** total dibayar + saldo vault = total didanai (60 + 50 = 110 = 100 dibayar + 10 refund).

## 15. Architecture

```
                    ┌─────────────────┐
                    │    Next.js      │
                    │    Frontend     │──── wallet signs user txs ───┐
                    └────────┬────────┘                              │
                             ↓                                       │
                    ┌─────────────────┐                              │
                    │ Express Backend │                              │
                    └───────┬─────────┘                              │
              ┌─────────────┼─────────────┐                          │
              ↓             ↓             ↓                          │
        PostgreSQL    Supabase Storage  YouTube API                  │
              │                           │                          │
              │ ←── Indexer (events)   Oracle Worker                 │
              │          ↑             (oracle key, sanity check)    │
              └──────────┘───────────────────┘                       │
                            ↓                                        │
                    ┌─────────────────┐                              │
                    │ Solana / Anchor │ ←────────────────────────────┘
                    │  Config PDA     │
                    │  Campaign PDA   │
                    └────────┬────────┘
                             ↓
                         aUSDC Vault
```

**Off-chain:** documents, OAuth, YouTube data, verification, snapshots, sanity check, review notes, notifications.

**On-chain:** config (oracle, admin), campaign state, escrow, payment rules, terms hash, oracle authorization, claims, payout, refund.

## 16. Error & Failure Handling

| Skenario | Handling |
| --- | --- |
| YouTube API down saat verification | Return error ke clipper; submission tidak dibuat |
| Oracle gagal submit report | Retry exponential backoff; claim ditunda, tidak gagal permanen; alert jika melewati SLA |
| Report kedaluwarsa saat claim | `ReportTooOld`; backend meminta report baru otomatis satu kali (Section 11.2) |
| Final snapshot belum tersedia setelah end\_time | `FinalReportPending` sampai `end_time + tolerance`; setelahnya fallback ke report non-final terakhir (Section 7.6) |
| Views YouTube turun | Oracle melaporkan `max(terbaru, terakhir)`; tidak ada pengurangan reward |
| Lonjakan views anomali | Report ditandai `held`, alert, tinjau manual sebelum dikirim atau dibuang (Section 7.4) |
| Clock skew oracle vs on-chain | Margin `clock_skew_tolerance`; `fetched_at = min(server, chain)`; NTP |
| RPC Solana gagal | Retry dengan backoff; UI menampilkan status pending |
| Claim dipanggil dua kali | Claim kedua gagal `NothingToClaim`; tidak ada pembayaran ganda |
| Spam claim-request | Unique PENDING per submission, cooldown, rate limit; status FAILED |
| Pool habis saat ACTIVE | Campaign tetap ACTIVE; payout partial atau `PoolEmpty`; tidak auto-close |
| Channel dicabut aksesnya | Submission baru diblokir; claim existing tidak terpengaruh |
| Video dihapus/private setelah ACCEPTED | Known limitation; oracle melaporkan views terakhir |
| Video duplikat | Ditolak saat verification dan on-chain (seed PDA) |
| Clipper submit–reject berulang | Dibatasi `total_submitted` (2 × batas aktif) |
| Creator tidak respons review/appeal | `finalize_timeout()` oleh siapa saja; submission diterima otomatis; creator diberi notifikasi sebelumnya |
| Creator tidak memanggil `refund()` | Claim tetap berakhir otomatis; dana sisa tetap di vault (known limitation); pembersihan akun clipper/oracle tidak terhalang (Section 9.1) |
| Campaign tidak pernah didanai | Tidak ada dana berisiko; `close_unfunded()` mengambil kembali rent |
| Oracle tidak mengirim baseline | Alert 5 menit; claim ditolak `BaselineMissing` sampai baseline terkirim |
| Oracle key bocor | Admin segera `update_oracle()`; report lama otomatis tidak valid untuk claim (`InvalidReporter`); oracle baru mengirim ulang report termasuk final (Section 7.4 aturan 9, Section 7.7); audit semua baseline dan claim sejak waktu kebocoran |
| Admin key salah dikirim | Transfer dua langkah (`propose_admin` lalu `accept_admin`) |
| Supabase Storage down | Upload/akses terms gagal; campaign tidak dibuat sampai terms tersimpan |

## 17. Rencana Testing & Kriteria Sukses

### Skenario testing wajib (program, solana-bankrun)

**Pembayaran**

- Formula payout: floor, cap `maxPayoutPerVideo`, overflow `u128`, CPM kecil.
- Partial payout, top-up, lalu sisa klaim; invarian dana (total dibayar + vault = total didanai).
- Claim ganda tanpa views baru dan tanpa sisa klaim → `NothingToClaim`.
- Property/fuzz test untuk invarian dana dan formula (urutan claim, top-up, dan views acak).

**Oracle dan report**

- Anti-replay: `fetched_at` sama/lebih lama, `view_count` turun, signer bukan oracle.
- Baseline saat PENDING\_REVIEW; report sebelum `submitted_at` ditolak; baseline setelah `end_time` dalam batas toleransi; claim ditolak sebelum ACCEPTED.
- **Clock skew:** `fetched_at` tepat pada `now + skew` diterima, `+1` detik ditolak; `fetched_at` tepat pada `submitted_at - skew` diterima, `-1` ditolak.
- Final snapshot: di dalam jendela, di luar jendela, ganda (oleh oracle yang sama), sebelum baseline; fallback saat final tidak datang.
- Submission ACCEPTED setelah `end_time` tetap bisa claim dengan report final.
- **Config dan rotasi:** `initialize_config` dua kali ditolak dan hanya upgrade authority yang bisa memanggilnya; `update_oracle` oleh non-admin ditolak; oracle lama ditolak setelah rotasi; report oracle lama tidak bisa dipakai `claim()`; oracle baru dapat mengirim angka lebih rendah; **oracle baru dapat mengganti report final milik key lama, lalu final kedua dari oracle baru ditolak `FinalAlreadyReceived`**; `report_seq` berlanjut setelah rotasi; transfer admin dua langkah (accept oleh pihak lain ditolak).

**Waktu dan review**

- Batas waktu tepat (`==`) untuk: `review_deadline`, `appeal_window`, `appeal_timeout`, claim vs refund pada `end_time + settlement_period`.
- Review: accept, reject, appeal, reject final, `finalize_timeout()` pada kedua jalur; accept/reject pada status REJECTED tanpa appeal ditolak `InvalidStatus`.
- Kuota video: reject membebaskan slot, appeal saat kuota penuh, **reject final setelah appeal menurunkan `active_count` tepat 1 kali (tidak underflow)**, batas `total_submitted` (siklus submit–reject berhenti di 2×).
- Self-submission, video duplikat, submit sebelum `start_time` / setelah `end_time`.
- Refund sebelum waktunya, refund ganda, top-up saat SETTLEMENT.
- `close_report`/`close_submission`/`close_stats`: ditolak saat `now <= end_time + settlement_period`; berhasil sesudahnya **tanpa `refund()`**; rent kembali ke pihak yang benar.

**Keamanan akun**

- Mint salah, token account bukan milik pihak yang berhak, substitusi PDA, re-inisialisasi Campaign/ClipperStats.

### Skenario testing backend

- Objective verification (semua cabang Section 5), unique channel↔wallet.
- Orkestrasi claim termasuk retry `ReportTooOld`/`InvalidReporter`, cooldown, unique PENDING, status FAILED, **claim-request diterima untuk sisa klaim tanpa views baru dan ditolak bila sisa klaim = 0**, `REPORT_HELD`.
- Sanity check: lonjakan ditahan (`held`), release dan discard; **cold start hanya memakai batas absolut; profil demo tidak menahan lonjakan skenario angka; baseline `held` memblokir claim sampai diputuskan**.
- Oracle Worker tidak mengirim report untuk REJECTED tanpa appeal setelah `appeal_window`.
- Indexer idempoten saat event diproses dua kali.
- Pesan auth: domain/nonce/expiry salah ditolak.
- Notifikasi terkirim pada submission baru dan mendekati `review_deadline`.

### Kriteria sukses MVP

- Seluruh demo Section 14 berjalan end-to-end dalam kurang dari 20 menit memakai parameter demo.
- Skenario angka Section 14 menghasilkan nilai tepat seperti tabel (termasuk Claim 4 tanpa views baru).
- Tidak ada pembayaran ganda dan invarian dana terjaga pada seluruh test (termasuk fuzz).
- Rotasi oracle dapat didemokan di devnet tanpa redeploy.
- Seluruh error program termapping ke pesan UI.

## 18. Di Luar Scope MVP

- State machine campaign lengkap (DRAFT, SCHEDULED, CANCELLED).
- Pro-rata payout.
- Multi-oracle dan verifikasi ed25519 per report.
- Penanganan formal video yang dihapus atau diubah setelah ACCEPTED, termasuk pengecekan ulang required mention.
- Mekanisme dispute independen (selain Creator) untuk appeal.
- Deteksi fraud/view botting lanjutan dan proteksi sybil (farm wallet).
- Penutupan campaign oleh pihak selain creator bila `refund()` tidak dipanggil.
- Koreksi baseline oleh oracle baru setelah rotasi (saat ini hanya audit manual).
- Tabel appeals dan auth\_nonces terpisah, Sign-In With Solana penuh.
- Verifikasi aplikasi Google OAuth untuk produksi.
