import { Inject, Injectable, Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OnchainCollectorService } from '../onchain-collector/onchain-collector.service';
import { AiScoringService } from '../ai-scoring/ai-scoring.service';
import { AnalyzeWalletDto } from './dto/analyze-wallet.dto';
import { WalletOnchainProfile } from '../onchain-collector/onchain-collector.types';
import { WalletScoreBreakdown } from '../ai-scoring/ai-scoring.types';

export interface WalletScoreProofGateway {
  generateScoreProof(args: {
    userId?: string;
    score: number;
    minScore: number;
  }): Promise<{ proofId: string | null }>;
}

@Injectable()
export class WalletReputationService {
  private readonly logger = new Logger(WalletReputationService.name);
  private readonly proofThreshold = 300;

  constructor(
    private readonly prisma: PrismaService,
    private readonly collector: OnchainCollectorService,
    private readonly scoring: AiScoringService,
    @Inject('WalletScoreProofGateway') private readonly zkService: WalletScoreProofGateway,
  ) {}

  async analyzeWallet(dto: AnalyzeWalletDto) {
    const startTime = Date.now();
    const address = dto.address?.toLowerCase();
    const chainId = dto.chainId;
    const userId = dto.userId;

    this.logger.log(
      `[ANALYZE_START] Starting wallet analysis - address: ${address}, chainId: ${chainId}, userId: ${userId || 'null'}`,
    );

    try {
      // Step 1: Validate input
      if (!address || !chainId) {
        this.logger.error(`[ANALYZE_ERROR] Invalid input - address: ${address}, chainId: ${chainId}`);
        throw new InternalServerErrorException('Invalid wallet address or chain ID');
      }

      // Step 2: Collect on-chain profile
      let profile: WalletOnchainProfile;
      try {
        this.logger.log(`[ANALYZE_STEP] Step 1/4: Collecting on-chain profile for ${address} on chain ${chainId}`);
        const profileStartTime = Date.now();
        profile = await this.collector.analyzeWallet(address, chainId);
        const profileDuration = Date.now() - profileStartTime;
        this.logger.log(
          `[ANALYZE_STEP] Step 1/4: Profile collected successfully in ${profileDuration}ms - txCount: ${profile.txCount}, nftCount: ${profile.nftCount ?? 0}, dexInteractions: ${profile.dexInteractionCount ?? 0}`,
        );
      } catch (error) {
        this.logger.error(
          `[ANALYZE_ERROR] Failed to collect on-chain profile - address: ${address}, chainId: ${chainId}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new InternalServerErrorException(
          `Failed to collect on-chain data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Step 3: Score wallet using AI
      let breakdown: WalletScoreBreakdown;
      try {
        this.logger.log(`[ANALYZE_STEP] Step 2/4: Scoring wallet using AI service`);
        const scoringStartTime = Date.now();
        breakdown = await this.scoring.scoreWallet(profile);
        const scoringDuration = Date.now() - scoringStartTime;
        this.logger.log(
          `[ANALYZE_STEP] Step 2/4: Scoring completed in ${scoringDuration}ms - score: ${breakdown.score}, tier: ${breakdown.tier}, riskScore: ${breakdown.riskScore}`,
        );
      } catch (error) {
        this.logger.error(
          `[ANALYZE_ERROR] Failed to score wallet - address: ${address}, chainId: ${chainId}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new InternalServerErrorException(
          `Failed to score wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Step 4: Upsert reputation record
      let record;
      try {
        this.logger.log(`[ANALYZE_STEP] Step 3/4: Upserting reputation record to database`);
        const upsertStartTime = Date.now();
        record = await this.upsertReputation(userId, profile, breakdown);
        const upsertDuration = Date.now() - upsertStartTime;
        this.logger.log(
          `[ANALYZE_STEP] Step 3/4: Reputation record upserted in ${upsertDuration}ms - recordId: ${record.id}`,
        );
      } catch (error) {
        this.logger.error(
          `[ANALYZE_ERROR] Failed to upsert reputation - address: ${address}, chainId: ${chainId}, score: ${breakdown?.score}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new InternalServerErrorException(
          `Failed to save reputation record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }

      // Step 5: Generate ZK proof if score meets threshold
      if (breakdown.score >= this.proofThreshold) {
        try {
          this.logger.log(
            `[ANALYZE_STEP] Step 4/4: Score ${breakdown.score} meets threshold ${this.proofThreshold}, generating ZK proof`,
          );
          const zkStartTime = Date.now();
          const zkResult = await this.zkService.generateScoreProof({
            userId,
            score: breakdown.score,
            minScore: this.proofThreshold,
          });
          const zkDuration = Date.now() - zkStartTime;

          if (zkResult?.proofId) {
            this.logger.log(
              `[ANALYZE_STEP] Step 4/4: ZK proof generated in ${zkDuration}ms - proofId: ${zkResult.proofId}`,
            );
            try {
              record = await this.prisma.walletReputation.update({
                where: { id: record.id },
                data: { zkProofId: zkResult.proofId },
              });
              this.logger.log(`[ANALYZE_STEP] Step 4/4: ZK proof ID saved to record ${record.id}`);
            } catch (updateError) {
              this.logger.warn(
                `[ANALYZE_WARNING] Failed to update record with ZK proof ID - recordId: ${record.id}, proofId: ${zkResult.proofId}`,
                updateError instanceof Error ? updateError.stack : String(updateError),
              );
              // Don't throw - we can continue without updating the proof ID
            }
          } else {
            this.logger.warn(
              `[ANALYZE_WARNING] ZK proof generation returned no proofId - score: ${breakdown.score}`,
            );
          }
        } catch (zkError) {
          this.logger.error(
            `[ANALYZE_ERROR] Failed to generate ZK proof - address: ${address}, score: ${breakdown.score}`,
            zkError instanceof Error ? zkError.stack : String(zkError),
          );
          // Don't throw - we can continue without ZK proof
          this.logger.warn(
            `[ANALYZE_WARNING] Continuing without ZK proof - address: ${address}, score: ${breakdown.score}`,
          );
        }
      } else {
        this.logger.log(
          `[ANALYZE_STEP] Step 4/4: Skipping ZK proof - score ${breakdown.score} below threshold ${this.proofThreshold}`,
        );
      }

      // Step 6: Map and return response
      try {
        const response = this.mapResponse(record, breakdown.reasoning);
        const totalDuration = Date.now() - startTime;
        this.logger.log(
          `[ANALYZE_SUCCESS] Wallet analysis completed in ${totalDuration}ms - address: ${address}, chainId: ${chainId}, finalScore: ${response.score}`,
        );
        return response;
      } catch (mapError) {
        this.logger.error(
          `[ANALYZE_ERROR] Failed to map response - address: ${address}, recordId: ${record?.id}`,
          mapError instanceof Error ? mapError.stack : String(mapError),
        );
        throw new InternalServerErrorException(
          `Failed to format response: ${mapError instanceof Error ? mapError.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      if (error instanceof InternalServerErrorException) {
        this.logger.error(
          `[ANALYZE_FAILED] Internal error after ${totalDuration}ms - address: ${address}, chainId: ${chainId}`,
          error.stack,
        );
        throw error;
      }

      // Catch any unexpected errors
      this.logger.error(
        `[ANALYZE_FAILED] Unexpected error after ${totalDuration}ms - address: ${address}, chainId: ${chainId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Wallet analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async getLatest(address: string, chainId: number) {
    const normalized = address?.toLowerCase();
    this.logger.log(`[GET_LATEST] Fetching latest reputation - address: ${normalized}, chainId: ${chainId}`);

    if (!normalized || !chainId) {
      this.logger.error(`[GET_LATEST_ERROR] Invalid input - address: ${normalized}, chainId: ${chainId}`);
      throw new InternalServerErrorException('Invalid wallet address or chain ID');
    }

    try {
      const record = await this.prisma.walletReputation.findFirst({
        where: { address: normalized, chainId },
        orderBy: { createdAt: 'desc' },
      });

      if (!record) {
        this.logger.warn(`[GET_LATEST] No reputation found - address: ${normalized}, chainId: ${chainId}`);
        throw new NotFoundException('Wallet reputation not found');
      }

      this.logger.log(
        `[GET_LATEST_SUCCESS] Reputation found - address: ${normalized}, chainId: ${chainId}, recordId: ${record.id}, score: ${record.score}`,
      );
      return this.mapResponse(record);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `[GET_LATEST_ERROR] Database error - address: ${normalized}, chainId: ${chainId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Failed to fetch reputation: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async upsertReputation(
    userId: string | undefined,
    profile: WalletOnchainProfile,
    breakdown: WalletScoreBreakdown,
  ) {
    try {
      this.logger.log(
        `[UPSERT] Preparing reputation data - address: ${profile.address}, chainId: ${profile.chainId}, score: ${breakdown.score}`,
      );

      // Serialize profile first to catch any serialization errors early
      let serializedProfile: Prisma.InputJsonValue;
      try {
        serializedProfile = this.serializeProfile(profile);
        this.logger.debug(`[UPSERT] Profile serialized successfully - address: ${profile.address}`);
      } catch (serializeError) {
        this.logger.error(
          `[UPSERT_ERROR] Failed to serialize profile - address: ${profile.address}`,
          serializeError instanceof Error ? serializeError.stack : String(serializeError),
        );
        throw new InternalServerErrorException(
          `Failed to serialize profile data: ${serializeError instanceof Error ? serializeError.message : 'Unknown error'}`,
        );
      }

      const data = {
        userId,
        address: profile.address,
        chainId: profile.chainId,
        score: breakdown.score,
        tier: breakdown.tier,
        riskScore: breakdown.riskScore,
        txnScore: breakdown.txnScore,
        tokenScore: breakdown.tokenScore,
        nftScore: breakdown.nftScore,
        defiScore: breakdown.defiScore,
        contractScore: breakdown.contractScore,
        rawData: serializedProfile,
      };

      this.logger.log(`[UPSERT] Checking for existing reputation record - address: ${profile.address}, chainId: ${profile.chainId}`);
      const existing = await this.prisma.walletReputation.findFirst({
        where: { address: profile.address, chainId: profile.chainId },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        this.logger.log(
          `[UPSERT] Updating existing reputation - recordId: ${existing.id}, oldScore: ${existing.score}, newScore: ${breakdown.score}`,
        );
        try {
          const updated = await this.prisma.walletReputation.update({ where: { id: existing.id }, data });
          this.logger.log(`[UPSERT_SUCCESS] Reputation updated - recordId: ${updated.id}`);
          return updated;
        } catch (updateError) {
          this.logger.error(
            `[UPSERT_ERROR] Failed to update reputation - recordId: ${existing.id}`,
            updateError instanceof Error ? updateError.stack : String(updateError),
          );
          throw new InternalServerErrorException(
            `Failed to update reputation record: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
          );
        }
      }

      this.logger.log(`[UPSERT] Creating new reputation entry - address: ${profile.address}, chainId: ${profile.chainId}`);
      try {
        const created = await this.prisma.walletReputation.create({ data });
        this.logger.log(`[UPSERT_SUCCESS] Reputation created - recordId: ${created.id}`);
        return created;
      } catch (createError) {
        this.logger.error(
          `[UPSERT_ERROR] Failed to create reputation - address: ${profile.address}, chainId: ${profile.chainId}`,
          createError instanceof Error ? createError.stack : String(createError),
        );
        throw new InternalServerErrorException(
          `Failed to create reputation record: ${createError instanceof Error ? createError.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      this.logger.error(
        `[UPSERT_ERROR] Unexpected error in upsert - address: ${profile?.address}, chainId: ${profile?.chainId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Unexpected error during reputation upsert: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private mapResponse(
    record: {
      address: string;
      chainId: number;
      score: number;
      tier: string;
      riskScore: number;
      txnScore: number;
      tokenScore: number;
      nftScore: number;
      defiScore: number;
      contractScore: number;
      zkProofId?: string | null;
    },
    reasoning?: string,
  ) {
    return {
      address: record.address,
      chainId: record.chainId,
      score: record.score,
      tier: record.tier,
      riskScore: record.riskScore,
      breakdown: {
        txnScore: record.txnScore,
        tokenScore: record.tokenScore,
        nftScore: record.nftScore,
        defiScore: record.defiScore,
        contractScore: record.contractScore,
      },
      zkProofId: record.zkProofId ?? null,
      reasoning,
    };
  }

  private serializeProfile(profile: WalletOnchainProfile): Prisma.InputJsonValue {
    try {
      // Safely serialize the profile, handling dates and potential circular references
      const serialized = {
        ...profile,
        lastTxTimestamp: profile.lastTxTimestamp
          ? profile.lastTxTimestamp instanceof Date
            ? profile.lastTxTimestamp.toISOString()
            : typeof profile.lastTxTimestamp === 'string'
              ? profile.lastTxTimestamp
              : null
          : null,
      };

      // Remove any undefined values that might cause issues with Prisma JSON
      Object.keys(serialized).forEach((key) => {
        if (serialized[key as keyof typeof serialized] === undefined) {
          delete serialized[key as keyof typeof serialized];
        }
      });

      return serialized as Prisma.InputJsonValue;
    } catch (error) {
      this.logger.error(
        `[SERIALIZE_ERROR] Failed to serialize profile - address: ${profile?.address}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        `Failed to serialize profile: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
