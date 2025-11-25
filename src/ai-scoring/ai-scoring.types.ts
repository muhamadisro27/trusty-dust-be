import { WalletOnchainProfile } from '../onchain-collector/onchain-collector.types';

export type ReputationTier = 'Dust' | 'Spark' | 'Flare' | 'Nova';

export interface WalletScoreBreakdown {
  score: number;
  tier: ReputationTier;
  riskScore: number;
  txnScore: number;
  tokenScore: number;
  nftScore: number;
  defiScore: number;
  contractScore: number;
  reasoning?: string;
}

export interface WalletScoringEngine {
  scoreWallet(profile: WalletOnchainProfile): Promise<WalletScoreBreakdown>;
}
