import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class SbtService {
  private readonly logger = new Logger(SbtService.name);

  constructor(private readonly prisma: PrismaService, private readonly blockchain: BlockchainService) {}

  async ensureSbt(userId: string, tier: string, walletAddress: string) {
    let sbt = await this.prisma.sbtToken.findUnique({ where: { userId } });
    if (!sbt) {
      const tokenId = Math.floor(Date.now() / 1000);
      const txHash = await this.blockchain.updateSbtMetadata(tokenId, tier, 'mint', walletAddress);
      sbt = await this.prisma.sbtToken.create({ data: { userId, tokenId, tier, lastTxHash: txHash } });
      this.logger.log(`Minted SBT token ${tokenId} for user ${userId}`);
      return sbt;
    }

    const txHash = await this.blockchain.updateSbtMetadata(sbt.tokenId, tier, 'update');
    this.logger.log(`Updated SBT token ${sbt.tokenId} for user ${userId} to tier ${tier}`);
    return this.prisma.sbtToken.update({ where: { id: sbt.id }, data: { tier, lastTxHash: txHash } });
  }
}
