# TrustyDust Backend Progress Log

## 1. Initial NestJS Scaffold & Core Modules
- Menyiapkan proyek NestJS dasar + global validation pipe & health check endpoint.
- Membuat Prisma service/module, Users/Auth/Dust/Trust/Tier/Social/Jobs/Zk awal dengan controller + service sesuai flow reputasi, posting, dan kerjaan.
- Menambahkan sistem guard (Privy + JWT), decorator `@CurrentUser`, serta ABIs + layanan blockchain viem.

## 2. Domain Features & Persistence
- Melengkapi Prisma schema (`User`, sosial, trust, token balance, jobs, escrow, notification, ZkProof, dsb.) dan membuat seed script contoh posting + job.
- Implementasi modul Dust (reward + spend), Social (post/react/boost), Jobs (create/apply/submit/confirm), Escrow (lock/release/refund), Tier/SBT/Notification.
- Menyiapkan `.env.example`, README detail, dan script Prisma (generate, migrate, seed).

## 3. Testing Coverage
- Menulis unit test untuk semua service utama: Auth, Users, Dust, Social, Trust, Tier, Jobs, Zk, Escrow, Blockchain, Notification (service & gateway), SBT, AppService.
- Menambah Jest setup & mocks sehingga seluruh suite (`npm run test -- --runInBand`) lulus.

## 4. Swagger & Developer DX
- Menambahkan dokumentasi Swagger (`/docs`) lengkap dengan decorator DTO & controller guards.
- Mengupdate README dengan daftar endpoint, flow DUST/Trust, serta instruksi migrasi/usage.

## 5. ZK Proof Backend Generator
- Membuat struktur `circuits/trust_score` dengan `main.nr`, `Nargo.toml`, `Prover/Verifier.toml`, serta panduan compile.
- Implementasi `ZkCompiler`, `ZkProver`, utilitas ACIR, tipe witness/proof, dan update `ZkService` & controller (`/zk/prove`, `/zk/verify`).
- Integrasi Noir WASM + Barretenberg dengan type safety (type roots tambahan) serta contoh script `npm run test:zk`.
- Menyediakan contoh kontrak `contracts/TrustVerification.sol` (kompatibel Foundry) & menyesuaikan ABI + layanan blockchain untuk `verifyProof(bytes,bytes32[])`.
- Dokumentasi Noir best practices + workflow di README.

## 6. CI Readiness
- Menambahkan Jest setup global untuk mock Noir/Barretenberg agar unit test tetap ringan.
- Menjamin seluruh test suite tetap hijau setelah penambahan ZK stack.

## 7. Integration Tests
- Menambahkan e2e test `test/auth.e2e-spec.ts` untuk memverifikasi flow `/auth/login` lengkap dengan mock Privy guard.
- Menambahkan e2e `test/users.e2e-spec.ts` untuk `/users/me` (GET/PATCH) dengan JWT dan Prisma cleanup otomatis.
- Menyusul `test/social.e2e-spec.ts` yang memverifikasi `/social/posts` dengan mock Dust/Trust/Notification/Blockchain agar reward & notifikasi tetap terpantau tanpa akses eksternal.
- Memperluas `test/social.e2e-spec.ts` agar mencakup `/social/posts/:id/react` dan `/social/posts/:id/boost` dengan assert ke mock reward/burn.
- Menambahkan `test/trust.e2e-spec.ts` untuk endpoint `/trust/score` sehingga pengambilan skor reputasi teruji ujung ke ujung.
- Menambahkan `test/jobs.e2e-spec.ts` untuk flow `/jobs/create` dengan mock ZK/DUST/Escrow/Notification sehingga pembuatan job + locking escrow ikut tervalidasi.
- Memperluas `test/jobs.e2e-spec.ts` untuk mencakup `/jobs/:id/apply` (worker application) dengan seeding poster/worker + JWT.
- Menambahkan `test/tier.e2e-spec.ts` demi memastikan `/tier/me` menampilkan tier + history dari Prisma.
- Menambahkan `test/zk.e2e-spec.ts` untuk memeriksa `/zk/prove` dan `/zk/verify` dengan mock prover & blockchain.
- Menambahkan `test/notifications.e2e-spec.ts` untuk menguji `GET /notifications` dengan seeding notifikasi dan JWT.
- Memperluas `test/jobs.e2e-spec.ts` agar mencakup `/jobs/:id/apply`, `/jobs/application/:id/submit`, dan `/jobs/application/:id/confirm` (termasuk assert escrow release mock).
- Siap melanjutkan modul-modul lain menggunakan pola testing serupa.

## 8. Frontend Integration Guide
- Menyusun `prompt/guide.md` berbahasa Indonesia lalu menerjemahkan ke Inggris agar tim FE global bisa mengikuti alur auth/social/trust/jobs/ZK/notification beserta payload dan tips testing.

## 9. API Prefix Update
- Menetapkan global prefix `/api/v1` di `main.ts` dan memperbarui seluruh e2e test, README, serta guide agar FE menggunakan path baru tersebut.

## 10. Swagger Deployment Fix
- Mengubah konfigurasi Swagger di `src/main.ts` agar memuat aset CSS/JS dan favicon dari CDN `swagger-ui-dist`, memastikan halaman `/docs` tidak lagi 404 ketika dideploy di Vercel / lingkungan serverless.

## 11. Realtime Chat (Supabase)
- Menambahkan module Chat (controller/service + DTO) dengan endpoint `/api/v1/chat/**` untuk list/create percakapan serta kirim pesan, semuanya terlindungi `JwtAuthGuard`.
- Memperluas Prisma schema (`ChatConversation`, `ChatParticipant`, `ChatMessage` + relasi di `User`) dan menyediakan e2e + unit test agar flow CRUD chat tervalidasi.
- Mengintegrasikan Supabase Realtime menggunakan `@supabase/supabase-js` (service role key). Setiap pesan/percakapan baru otomatis broadcast ke channel `chat:<conversationId>`; ketika env kosong, service aman fallback tanpa realtime.
- Update README + `.env.example` agar FE tahu env baru, endpoint baru, serta best practice penggunaan Supabase sebagai layer realtime di atas Neon/Postgres.

## 12. Guide Update (Chat Integration)
- Menambahkan section khusus pada `prompt/guide.md` yang menjelaskan alur REST chat, cara subscribe Supabase Realtime (channel naming, payload `message.new`/`conversation.created`), dan strategi reconnect FE sebelum resync pesan.
- Menyorot env yang dibutuhkan (service role untuk backend, anon key untuk FE) serta batasan saat ini (belum ada typing indicator/read receipt) agar tim FE siap mengimplementasikan UI chat.

## 13. Jobs Payload Refresh
- Menyesuaikan Prisma schema & DTO agar job memiliki metadata lengkap (companyName/logo, location, jobType, requirements array, salaryMin/max, closeAt).
- Memperbarui `JobsService` (validasi salary range + normalisasi requirement), unit test (`jobs.service.spec.ts`), dan e2e sample payload supaya sesuai UI baru.
- Mengupdate seed data, README, dan integration guide dengan contoh payload lengkap sehingga FE tahu field apa yang wajib/opsional.

## 14. Changelog Initiation
- Membuat `CHANGELOG.md` di root sebagai ringkasan perubahan penting (chat realtime, job metadata, perbaikan Swagger, dan cakupan testing baru).

## 15. Wallet Reputation Analyzer
- Menambah model Prisma `WalletReputation` + relasi user, serta module baru: `OnchainCollector` (pseudo on-chain metrics), `AiScoring` (heuristic scoring), dan `WalletReputation` (controller/service + DTO).
- Endpoint `/api/v1/wallet-reputation/analyze` + `/api/v1/wallet-reputation/:address?chainId=` didefinisikan dengan `JwtAuthGuard`, menyimpan breakdown skor, memanggil stub ZK proof saat skor >= 300.
- Menambahkan e2e test `test/wallet-reputation.e2e-spec.ts`, update README + guide untuk menjelaskan flow baru, dan memperluas `CHANGELOG` agar dokumentasi up-to-date.

## 16. Path Alias Cleanup
- Menghapus alias `@/` dan mengembalikan seluruh import ke jalur relatif standar untuk menghindari masalah runtime (Vercel lambda tidak lagi membutuhkan `tsconfig-paths`). Script npm, konfigurasi Jest, dan dokumentasi disesuaikan kembali.

## 17. Rate Limiter
- Mengaktifkan `@nestjs/throttler` secara global melalui `ThrottlerModule` + `APP_GUARD` sehingga setiap endpoint dibatasi 100 request/menit per IP. README diperbarui agar tim tahu adanya guard ini.

## 17. Hybrid Wallet Reputation + ZK Revamp
- Mengupgrade `AiScoringService` menjadi pipeline hybrid: heuristik deterministik + overlay Gemini (via `GeminiClientService` dan util normalizer). Env `GEMINI_API_KEY` ditambahkan untuk mengaktifkan overlay.
- Menyusun ulang `ZkService`/controller agar menyediakan endpoint `/zk/generate` dengan input `{ score, minScore, userId? }`, memanfaatkan circuit baru `circuits/wallet_score` dan menyimpan hasil ke Prisma `ZkProof` (userId opsional).
- Wallet Reputation kini mengembalikan `zkProofId`, reasoning, dan otomatis memanggil `generateScoreProof` saat skor >= 300. E2E/unit test diperbarui.
- Dokumentasi (README + guide) diperbarui untuk menjelaskan alur hybrid AI, env baru, path circuit baru, serta endpoint `/zk/generate`.
