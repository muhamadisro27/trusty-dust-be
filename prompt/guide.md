# TrustyDust Backend Integration Guide
This document explains how the frontend (FE) should call the backend, the execution order, payloads, and local testing tips. Replace `https://api.trustydust.example` with the relevant environment base URL.

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
1. **Create** – `POST /jobs/create` with title/description/minTrustScore/reward. Poster must have ZK proof (validated server-side) and pays 50 DUST; Escrow lock executed on success.
2. **Apply** – `POST /jobs/:id/apply` with optional `zkProofId`. Worker pays 20 DUST and must meet min trust score.
3. **Submit** – `POST /jobs/application/:id/submit` with `{ "workSubmissionText": "..." }` to mark work submitted.
4. **Confirm** – `POST /jobs/application/:id/confirm` with `{ "txHash": "0x..." }`. Poster confirms, backend releases escrow, rewards worker (`TrustEvent job_completed`).

## 7. Notifications
- `GET /notifications`: Poll for private notifications.
- Websocket: connect via Socket.io to `ws://host:PORT` with query `userId=<id>` to join personal room. Events emitted:
  - `notification` – user-specific payload
  - `notification:public` – aggregate feed

## 8. Local Testing Tips
- Run `npm run prisma:migrate` and `npm run prisma:seed` before testing FE locally.
- Use `npm run test:zk` after compiling the Noir circuit (via `nargo check` & `nargo compile`) to confirm prover artifacts exist.
- Seed DUST balances via `prisma/seed.ts` when you need accounts with tokens.

## 9. Error Handling
- Protected endpoints return `401` if JWT is missing/invalid.
- Validation errors return `400` with details thanks to global `ValidationPipe`.
- Resource issues (missing job, insufficient proofs, etc.) produce `404` or `400` with descriptive message.

## 10. Environment Variables
Ensure `.env` contains:
- `DATABASE_URL` (Neon PostgreSQL connection string)
- `JWT_SECRET`, `PRIVY_SECRET_KEY`
- `RPC_URL` + contract addresses (`TRUST_VERIFICATION_ADDRESS`, `ESCROW_FACTORY_ADDRESS`, `DUST_TOKEN_ADDRESS`, `SBT_CONTRACT_ADDRESS`) and `ESCROW_SIGNER_KEY`

Refer to this guide whenever implementing or debugging FE integration. Update the document alongside any API changes.
