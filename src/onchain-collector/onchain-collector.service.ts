import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { WalletOnchainProfile } from './onchain-collector.types';

/**
 * OnchainCollectorService would normally call RPC/indexer APIs (e.g., Covalent, Alchemy, custom subgraphs).
 * For now we generate deterministic pseudo metrics derived from the wallet address so tests remain stable.
 */
@Injectable()
export class OnchainCollectorService {
  private readonly logger = new Logger(OnchainCollectorService.name);

  async analyzeWallet(address: string, chainId: number): Promise<WalletOnchainProfile> {
    const normalizedAddress = address.toLowerCase();
    this.logger.log(`Collecting pseudo on-chain metrics for ${normalizedAddress} on chain ${chainId}`);

    const seed = this.hashToNumber(normalizedAddress, chainId, 'base');
    const txCount = (seed % 5000) + 10;
    const profile: WalletOnchainProfile = {
      address: normalizedAddress,
      chainId,
      firstSeenBlock: 1 + (seed % 10_000),
      lastTxTimestamp: new Date(Date.now() - (seed % 10) * 86_400_000),
      txCount,
      nativeBalanceUsd: this.hashToNumber(normalizedAddress, chainId, 'native') % 2500,
      stableBalanceUsd: this.hashToNumber(normalizedAddress, chainId, 'stable') % 5000,
      tokenHoldingsScoreInput: this.hashToNumber(normalizedAddress, chainId, 'token') % 150,
      nftCount: this.hashToNumber(normalizedAddress, chainId, 'nft') % 50,
      blueChipNftCount: this.hashToNumber(normalizedAddress, chainId, 'bluechip') % 5,
      dexInteractionCount: this.hashToNumber(normalizedAddress, chainId, 'dex') % 100,
      lendingProtocolsCount: this.hashToNumber(normalizedAddress, chainId, 'lending') % 25,
      contractInteractionCount: this.hashToNumber(normalizedAddress, chainId, 'contract') % 200,
      uniqueContractCount: this.hashToNumber(normalizedAddress, chainId, 'unique') % 120,
      flaggedInteractionsCount: this.hashToNumber(normalizedAddress, chainId, 'flagged') % 10,
      suspiciousTokensCount: this.hashToNumber(normalizedAddress, chainId, 'suspicious') % 6,
    };

    // TODO: Replace pseudo metrics with real on-chain data via indexer/RPC integrations.
    return profile;
  }

  private hashToNumber(address: string, chainId: number, salt: string): number {
    const hash = createHash('sha256').update(`${address}:${chainId}:${salt}`).digest('hex').slice(0, 12);
    return parseInt(hash, 16);
  }
}
