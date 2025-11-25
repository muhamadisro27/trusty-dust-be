# TrustyDust Backend Integration Guide
This document explains how the frontend (FE) should call the backend, the execution order, payloads, and local testing tips. All endpoints are served under the prefix `/api/v1`, e.g. `https://api.trustydust.example/api/v1/auth/login`.

## 1. Authentication: Privy → Backend JWT
1. FE logs in with Privy SDK and receives a Privy JWT (`privy_jwt`).
2. FE calls `POST /auth/login` with header `Authorization: Bearer <privy_jwt>` (body optional):
   ```bash
   curl -X POST https://api.trustydust.example/auth/login \
     -H "Authorization: Bearer PRIVY_JWT"
   ```
3. Backend verifies the token against Privy, creates/loads the user, and responds with:
   ```json
   {
     "accessToken": "<backend_jwt>",
     "user": { /* profile */ }
   }
   ```
4. FE stores `accessToken` and uses it for all subsequent endpoints as `Authorization: Bearer <backend_jwt>`.

## 2. User Profile Endpoints
- `GET /users/me`: Fetch logged-in user profile.
- `PATCH /users/me`: Update profile with `{ "username": "new", "avatar": "https://..." }`.

## 3. Social Feed & Interactions
1. **Create Post** – `POST /social/posts` with `{ "text": "Hello...", "mediaUrls": ["https://..."] }`. Backend rewards DUST and sends a notification.
2. **React** – `POST /social/posts/:id/react` with `{ "type": "LIKE" }` (or COMMENT/REPOST). Optional `commentText` for comments. Backend logs TrustEvent + rewards.
3. **Boost** – `POST /social/posts/:id/boost` with `{ "amount": 5, "note": "optional" }`. Backend spends DUST, calls `burnDustBoost`, notifies author.

## 4. Trust & Tier
- `GET /trust/score`: Returns numeric trust score.
- `GET /tier/me`: Returns tier (`Dust/Spark/Flare/Nova`) plus history.
- Trust updates happen automatically after interactions; FE simply re-fetches these endpoints when needed.

## 5. ZK Proving & Verification
1. **Generate Proof** – `POST /zk/prove` with `{ "userId": "<user_id>", "minScore": 500 }`. Backend uses Noir circuit to build a witness and stores proof in Prisma:
   ```json
   { "proof": "0x...", "publicInputs": ["1"] }
   ```
2. **Verify** – `POST /zk/verify` with `{ "proof": "0x...", "publicInputs": ["1"] }`. Backend calls the on-chain `TrustVerification.sol` contract via viem and returns `{ "valid": true }`.

## 6. Jobs Workflow
1. **Create** – `POST /jobs/create` now expects enriched company/job metadata:
   ```json
   {
     "title": "Design TrustyDust badge",
     "description": "Need tier art",
     "companyName": "TrustyDust Labs",
     "companyLogo": "https://cdn/logo.png",
     "location": "Remote",
     "jobType": "Contract",
     "requirements": ["3+ years UI", "Understands staking"],
     "minTrustScore": 300,
     "reward": 250,
     "salaryMin": 120,
     "salaryMax": 200,
     "closeAt": "2030-01-01T00:00:00.000Z",
     "zkProofId": "optional"
   }
   ```
   Poster must have ZK proof (validated server-side) and pays 50 DUST; Escrow lock executed on success. Backend will reject if `salaryMin > salaryMax`. Requirements array is optional—empty or blank values are stripped automatically.
2. **Apply** – `POST /jobs/:id/apply` with optional `zkProofId`. Worker pays 20 DUST and must meet min trust score.
3. **Submit** – `POST /jobs/application/:id/submit` with `{ "workSubmissionText": "..." }` to mark work submitted.
4. **Confirm** – `POST /jobs/application/:id/confirm` with `{ "txHash": "0x..." }`. Poster confirms, backend releases escrow, rewards worker (`TrustEvent job_completed`).

## 7. Notifications
- `GET /notifications`: Poll for private notifications.
- Websocket: connect via Socket.io to `ws://host:PORT` with query `userId=<id>` to join personal room. Events emitted:
  - `notification` – user-specific payload
  - `notification:public` – aggregate feed

## 8. Chat + Supabase Realtime
The chat module relies on Neon for storage and Supabase Realtime for fan-out updates.

### 8.1 REST endpoints
- `GET /chat/conversations` – list conversations where the user is a participant (includes last message snapshot).
- `POST /chat/conversations` – body `{ "title": "optional", "participantIds": ["<userId>", ...] }`. Backend automatically adds the creator so FE only passes peers.
- `GET /chat/conversations/:conversationId/messages?limit=50` – returns ordered messages with sender metadata. Call this whenever FE opens a DM to hydrate the UI.
- `POST /chat/messages` – body `{ "conversationId": "cuid", "content": "gm", "attachments": ["https://..."], "metadata": { "jobId": "..."} }`.

### 8.2 Supabase Realtime subscription
1. FE authenticates to Supabase using the **anon/public key** (env `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Server-side backend uses service role; FE **must not** use it.
2. After fetching `conversations`, FE subscribes to each channel using deterministic naming:
   ```ts
   const channel = supabase
     .channel(`chat:${conversationId}`, { config: { broadcast: { self: false } } })
     .on('broadcast', { event: 'message.new' }, (payload) => {
       const message = payload.payload.message;
       // optimistic insert into FE store
     })
     .on('broadcast', { event: 'conversation.created' }, (payload) => {
       // refresh conversation list if current user is involved
     })
     .subscribe();
   ```
3. When FE sends a message (via `/chat/messages`), backend writes to Prisma, then broadcasts `message.new` so every subscriber (including sender) receives it in near real time.
4. If FE disconnects, it should re-fetch `/chat/conversations/:id/messages` before resubscribing to avoid missing events. Use the `limit` query to paginate older messages (up to 200 per call).

### 8.3 Typing indicators / read receipts
Not implemented yet. FE can still reflect read state using `ChatParticipant.lastSeenAt` (available in the conversation list) by comparing timestamps with `ChatMessage.createdAt`.

## 9. Local Testing Tips
- Run `npm run prisma:migrate` and `npm run prisma:seed` before testing FE locally.
- Use `npm run test:zk` after compiling the Noir circuit (via `nargo check` & `nargo compile`) to confirm prover artifacts exist.
- Seed DUST balances via `prisma/seed.ts` when you need accounts with tokens.

## 10. Error Handling
- Protected endpoints return `401` if JWT is missing/invalid.
- Validation errors return `400` with details thanks to global `ValidationPipe`.
- Resource issues (missing job, insufficient proofs, etc.) produce `404` or `400` with descriptive message.

## 11. Environment Variables
Ensure `.env` contains:
- `DATABASE_URL` (Neon PostgreSQL connection string)
- `JWT_SECRET`, `PRIVY_SECRET_KEY`
- `RPC_URL` + contract addresses (`TRUST_VERIFICATION_ADDRESS`, `ESCROW_FACTORY_ADDRESS`, `DUST_TOKEN_ADDRESS`, `SBT_CONTRACT_ADDRESS`) and `ESCROW_SIGNER_KEY`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (backend). FE must configure its own anon keys for subscriptions.

Refer to this guide whenever implementing or debugging FE integration. Update the document alongside any API changes.
