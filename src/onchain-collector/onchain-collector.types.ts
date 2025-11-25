export interface WalletOnchainProfile {
  address: string;
  chainId: number;
  firstSeenBlock?: number;
  lastTxTimestamp?: Date | null;
  txCount: number;
  nativeBalanceUsd?: number;
  stableBalanceUsd?: number;
  tokenHoldingsScoreInput?: number;
  nftCount?: number;
  blueChipNftCount?: number;
  dexInteractionCount?: number;
  lendingProtocolsCount?: number;
  contractInteractionCount?: number;
  uniqueContractCount?: number;
  flaggedInteractionsCount?: number;
  suspiciousTokensCount?: number;
}
