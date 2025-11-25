# Changelog

## [Unreleased]

### Added
- Supabase-powered chat module (REST + Realtime) with new `ChatConversation`, `ChatParticipant`, and `ChatMessage` tables. Added `/api/v1/chat/**` endpoints, Supabase client integration, and documentation for FE subscriptions.
- Job creation payload now includes company details (logo/name/location), job type, requirements array, salary range, and closing date. Schema, DTO, services, and guides updated accordingly.

### Fixed
- Swagger assets served via CDN so `/docs` works when deployed to Vercel/serverless.

### Testing
- New unit tests for chat service plus e2e coverage (`test/chat.e2e-spec.ts`).
- Jobs service unit tests updated to cover salary validation and new metadata fields (`src/jobs/jobs.service.spec.ts`).
