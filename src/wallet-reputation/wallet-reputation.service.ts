import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OnchainCollectorService } from '../onchain-collector/onchain-collector.service';
import { AiScoringService } from '../ai-scoring/ai-scoring.service';
import { AnalyzeWalletDto } from './dto/analyze-wallet.dto';
import { WalletOnchainProfile } from '../onchain-collector/onchain-collector.types';
import { WalletScoreBreakdown } from '../ai-scoring/ai-scoring.types';

export interface WalletScoreProofGateway {
  generateProofForWalletScore(args: {
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
    const address = dto.address.toLowerCase();
    const chainId = dto.chainId;

    const profile = await this.collector.analyzeWallet(address, chainId);
    const breakdown = this.scoring.scoreWallet(profile);

    let record = await this.upsertReputation(dto.userId, profile, breakdown);

    if (breakdown.score >= this.proofThreshold) {
      // TODO: integrate real wallet-score ZK proving when available.
      const zkResult = await this.zkService.generateProofForWalletScore({
        userId: dto.userId,
        score: breakdown.score,
        minScore: this.proofThreshold,
      });
      if (zkResult?.proofId) {
        record = await this.prisma.walletReputation.update({
          where: { id: record.id },
          data: { zkProofId: zkResult.proofId },
        });
      }
    }

    return this.mapResponse(record);
  }

  async getLatest(address: string, chainId: number) {
    const normalized = address.toLowerCase();
    const record = await this.prisma.walletReputation.findFirst({
      where: { address: normalized, chainId },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) {
      throw new NotFoundException('Wallet reputation not found');
    }
    return this.mapResponse(record);
  }

  private async upsertReputation(
    userId: string | undefined,
    profile: WalletOnchainProfile,
    breakdown: WalletScoreBreakdown,
  ) {
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
      rawData: this.serializeProfile(profile),
    };

    const existing = await this.prisma.walletReputation.findFirst({
      where: { address: profile.address, chainId: profile.chainId },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      this.logger.log(`Updating wallet reputation ${existing.id}`);
      return this.prisma.walletReputation.update({ where: { id: existing.id }, data });
    }

    this.logger.log(`Creating wallet reputation entry for ${profile.address}`);
    return this.prisma.walletReputation.create({ data });
  }

  private mapResponse(record: {
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
  }) {
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
    };
  }

  private serializeProfile(profile: WalletOnchainProfile): Prisma.InputJsonValue {
    return {
      ...profile,
      lastTxTimestamp: profile.lastTxTimestamp?.toISOString() ?? null,
    };
  }
}
