import { Injectable, Logger } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(private readonly blockchain: BlockchainService, private readonly prisma: PrismaService) {}

  async lock(jobId: string, chainRef: number, posterWallet: string, workerWallet: string, amount: number) {
    this.logger.log(`Locking escrow for job ${jobId} chainRef ${chainRef}`);
    const txHash = await this.blockchain.lockEscrow(chainRef, posterWallet, workerWallet, BigInt(amount));
    return this.prisma.jobEscrow.upsert({
      where: { jobId },
      update: { lockTxHash: txHash, amount },
      create: { jobId, lockTxHash: txHash, amount },
    });
  }

  async release(jobId: string, chainRef: number) {
    this.logger.log(`Releasing escrow for job ${jobId}`);
    const txHash = await this.blockchain.releaseEscrow(chainRef);
    return this.prisma.jobEscrow.update({ where: { jobId }, data: { releaseTxHash: txHash } });
  }

  async refund(jobId: string, chainRef: number) {
    this.logger.warn(`Refunding escrow for job ${jobId}`);
    const txHash = await this.blockchain.refundEscrow(chainRef);
    return this.prisma.jobEscrow.update({ where: { jobId }, data: { refundTxHash: txHash } });
  }
}
