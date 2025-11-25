import { Injectable, Logger } from '@nestjs/common';
import { WalletOnchainProfile } from '../onchain-collector/onchain-collector.types';
import { ReputationTier, WalletScoreBreakdown } from './ai-scoring.types';

/**
 * AI/ML placeholder – we currently rely on deterministic heuristics so the FE can be built.
 * TODO: replace heuristics with an LLM/ML scoring pipeline once available.
 */
@Injectable()
export class AiScoringService {
  private readonly logger = new Logger(AiScoringService.name);

  scoreWallet(profile: WalletOnchainProfile): WalletScoreBreakdown {
    this.logger.log(`Scoring wallet ${profile.address} on chain ${profile.chainId}`);
    const txnScore = this.computeTxnScore(profile.txCount);
    const tokenScore = this.computeTokenScore(profile.tokenHoldingsScoreInput ?? 0);
    const nftScore = this.computeNftScore(profile.nftCount ?? 0, profile.blueChipNftCount ?? 0);
    const defiScore = this.computeDefiScore(
      profile.dexInteractionCount ?? 0,
      profile.lendingProtocolsCount ?? 0,
    );
    const contractScore = this.computeContractScore(profile.uniqueContractCount ?? 0);
    const riskScore = this.computeRiskScore(
      profile.flaggedInteractionsCount ?? 0,
      profile.suspiciousTokensCount ?? 0,
    );

    const aggregateWeighted =
      txnScore * 0.25 +
      tokenScore * 0.2 +
      nftScore * 0.15 +
      defiScore * 0.2 +
      contractScore * 0.2;
    const score = Math.max(0, Math.min(1000, Math.round((aggregateWeighted / 100) * 1000)));
    const tier = this.mapTier(score);

    return {
      score,
      tier,
      riskScore,
      txnScore,
      tokenScore,
      nftScore,
      defiScore,
      contractScore,
    };
  }

  private computeTxnScore(txCount: number) {
    if (txCount <= 0) return 0;
    const logScore = Math.log10(txCount + 1) * 25;
    return Math.min(100, Math.round(logScore));
  }

  private computeTokenScore(tokenHoldingsScoreInput: number) {
    return Math.min(100, Math.round(tokenHoldingsScoreInput));
  }

  private computeNftScore(nftCount: number, blueChipNftCount: number) {
    const base = nftCount * 3;
    const bonus = blueChipNftCount * 10;
    return Math.min(100, Math.round(base + bonus));
  }

  private computeDefiScore(dexInteractions: number, lendingProtocolsCount: number) {
    return Math.min(100, Math.round(dexInteractions * 0.8 + lendingProtocolsCount * 5));
  }

  private computeContractScore(uniqueContractCount: number) {
    return Math.min(100, Math.round(uniqueContractCount * 0.8));
  }

  private computeRiskScore(flagged: number, suspicious: number) {
    const raw = flagged * 10 + suspicious * 8;
    return Math.min(100, Math.round(raw));
  }

  private mapTier(score: number): ReputationTier {
    if (score >= 800) return 'Nova';
    if (score >= 600) return 'Flare';
    if (score >= 300) return 'Spark';
    return 'Dust';
  }
}
