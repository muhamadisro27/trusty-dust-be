# Changelog

## [Unreleased]

### Added
- Supabase-powered chat module (REST + Realtime) with new `ChatConversation`, `ChatParticipant`, and `ChatMessage` tables. Added `/api/v1/chat/**` endpoints, Supabase client integration, and documentation for FE subscriptions.
- Job creation payload now includes company details (logo/name/location), job type, requirements array, salary range, and closing date. Schema, DTO, services, and guides updated accordingly.
- Wallet reputation analyzer stack: `OnchainCollectorService`, `AiScoringService`, and `WalletReputationModule` with REST endpoints to analyze + fetch wallet scores. Added Prisma `WalletReputation` model and example e2e test.
- Rolled back the `@/` path alias to avoid runtime issues; scripts, Jest configs, and imports now use standard relative paths again.
- Added rate limiting via `@nestjs/throttler` for `/auth/login` (5 req/min), social interactions (20–60 req/min tiers), wallet reputation analysis (10 req/5 min), and `/zk/generate` (5 req/min) to prevent abuse.
- Hybrid AI scoring (heuristics + Gemini overlay), refreshed wallet reputation responses (reasoning + zkProofId), new `/zk/generate` endpoint, and Noir circuit moved to `circuits/wallet_score` with updated proving service.

### Fixed
- Swagger assets served via CDN so `/docs` works when deployed to Vercel/serverless.

### Testing
- New unit tests for chat service plus e2e coverage (`test/chat.e2e-spec.ts`).
- Jobs service unit tests updated to cover salary validation and new metadata fields (`src/jobs/jobs.service.spec.ts`).
