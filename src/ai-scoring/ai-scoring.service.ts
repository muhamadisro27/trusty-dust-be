import { Injectable, Logger } from '@nestjs/common';
import { WalletOnchainProfile } from '../onchain-collector/onchain-collector.types';
import { GeminiClientService } from './gemini-client.service';
import { WalletScoreBreakdown, ReputationTier } from './ai-scoring.types';
import { clamp100, clamp1000, weight } from './ai-normalizer.util';

interface HeuristicScores extends WalletScoreBreakdown {}

interface AiOverlayResponse {
  txnScore?: number;
  tokenScore?: number;
  nftScore?: number;
  defiScore?: number;
  contractScore?: number;
  riskScore?: number;
  finalScore?: number;
  reasoning?: string;
}

@Injectable()
export class AiScoringService {
  private readonly logger = new Logger(AiScoringService.name);

  constructor(private readonly geminiClient: GeminiClientService) {}

  async scoreWallet(profile: WalletOnchainProfile): Promise<WalletScoreBreakdown> {
    const heuristics = this.buildHeuristicScores(profile);
    const aiOverlay = await this.tryAiOverlay(profile, heuristics);
    const merged = this.mergeScores(heuristics, aiOverlay);
    return { ...merged, tier: this.mapTier(merged.score) };
  }

  private buildHeuristicScores(profile: WalletOnchainProfile): HeuristicScores {
    const txnScore = clamp100(Math.log10((profile.txCount ?? 0) + 1) * 25);
    const tokenScore = clamp100(profile.tokenHoldingsScoreInput ?? 0);
    const nftScore = clamp100(
      (profile.nftCount ?? 0) * 3 + (profile.blueChipNftCount ?? 0) * 10,
    );
    const defiScore = clamp100(
      (profile.dexInteractionCount ?? 0) * 0.8 + (profile.lendingProtocolsCount ?? 0) * 5,
    );
    const contractScore = clamp100(
      (profile.uniqueContractCount ?? 0) * 0.75 + (profile.contractInteractionCount ?? 0) * 0.1,
    );
    const riskScore = clamp100(
      (profile.flaggedInteractionsCount ?? 0) * 10 + (profile.suspiciousTokensCount ?? 0) * 8,
    );
    const aggregate =
      txnScore * 0.25 +
      tokenScore * 0.2 +
      nftScore * 0.15 +
      defiScore * 0.2 +
      contractScore * 0.2;
    const score = clamp1000(Math.round(aggregate * 10));

    return {
      score,
      tier: this.mapTier(score),
      riskScore,
      txnScore,
      tokenScore,
      nftScore,
      defiScore,
      contractScore,
      reasoning: undefined,
    };
  }

  private async tryAiOverlay(profile: WalletOnchainProfile, heuristics: HeuristicScores) {
    const prompt = this.buildPrompt(profile, heuristics);
    const result = await this.geminiClient.analyze(prompt);
    return result ?? null;
  }

  private buildPrompt(profile: WalletOnchainProfile, heuristics: HeuristicScores) {
    const payload = {
      profile: {
        address: profile.address,
        chainId: profile.chainId,
        txCount: profile.txCount,
        nativeBalanceUsd: profile.nativeBalanceUsd,
        stableBalanceUsd: profile.stableBalanceUsd,
        tokenHoldingsScoreInput: profile.tokenHoldingsScoreInput,
        nftCount: profile.nftCount,
        blueChipNftCount: profile.blueChipNftCount,
        dexInteractionCount: profile.dexInteractionCount,
        lendingProtocolsCount: profile.lendingProtocolsCount,
        contractInteractionCount: profile.contractInteractionCount,
        uniqueContractCount: profile.uniqueContractCount,
        flaggedInteractionsCount: profile.flaggedInteractionsCount,
        suspiciousTokensCount: profile.suspiciousTokensCount,
      },
      heuristics,
    };

    return `
You are an AI that scores blockchain wallets for trustworthiness.
Consider the telemetry and heuristic baseline below. Return STRICT JSON with this shape:
{
  "txnScore": number,
  "tokenScore": number,
  "nftScore": number,
  "defiScore": number,
  "contractScore": number,
  "riskScore": number,
  "finalScore": number,
  "reasoning": string
}

Input:
${JSON.stringify(payload)}
`;
  }

  private mergeScores(
    heuristics: HeuristicScores,
    aiOverlay: AiOverlayResponse | null,
  ): WalletScoreBreakdown {
    if (!aiOverlay) {
      return heuristics;
    }

    const aiTxn = clamp100(aiOverlay.txnScore);
    const aiToken = clamp100(aiOverlay.tokenScore);
    const aiNft = clamp100(aiOverlay.nftScore);
    const aiDefi = clamp100(aiOverlay.defiScore);
    const aiContract = clamp100(aiOverlay.contractScore);
    const aiRisk = clamp100(aiOverlay.riskScore);
    const aiFinal = clamp1000(aiOverlay.finalScore);

    const mergedRisk = Math.round((heuristics.riskScore + aiRisk) / 2);
    const finalScore = weight(heuristics.score, aiFinal, 0.3);

    return {
      score: finalScore,
      tier: heuristics.tier,
      txnScore: weight(heuristics.txnScore, aiTxn, 0.3),
      tokenScore: weight(heuristics.tokenScore, aiToken, 0.3),
      nftScore: weight(heuristics.nftScore, aiNft, 0.3),
      defiScore: weight(heuristics.defiScore, aiDefi, 0.3),
      contractScore: weight(heuristics.contractScore, aiContract, 0.3),
      riskScore: mergedRisk,
      reasoning: aiOverlay.reasoning ?? heuristics.reasoning,
    };
  }

  private mapTier(score: number): ReputationTier {
    if (score >= 800) return 'Nova';
    if (score >= 600) return 'Flare';
    if (score >= 300) return 'Spark';
    return 'Dust';
  }
}
