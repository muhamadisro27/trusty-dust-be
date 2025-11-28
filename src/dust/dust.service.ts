import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockchainService } from '../blockchain/blockchain.service';

const DAILY_REWARD_CAP = 50;
const DUST_UNIT = 10n ** 18n;

@Injectable()
export class DustService {
  private readonly dustSymbol = 'DUST';
  private readonly logger = new Logger(DustService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly blockchain: BlockchainService,
  ) {}

  async rewardUser(userId: string, amount: number, reason: string) {
    const balance = await this.ensureUserBalance(userId);
    this.logger.log(
      `Rewarding user ${userId} with ${amount} DUST for ${reason}`,
    );
    const now = new Date();
    let dailyEarned = balance.dailyEarned;
    let checkpoint = balance.dailyEarnedCheckpoint;

    if (!checkpoint || checkpoint.toDateString() !== now.toDateString()) {
      dailyEarned = 0;
      checkpoint = now;
    }

    const allowed = Math.max(0, DAILY_REWARD_CAP - dailyEarned);
    const credit = Math.min(allowed, amount);
    if (credit <= 0) {
      return { credited: 0, balance: balance.balance };
    }

    const updated = await this.prisma.userTokenBalance.update({
      where: { id: balance.id },
      data: {
        balance: balance.balance + credit,
        dailyEarned: dailyEarned + credit,
        dailyEarnedCheckpoint: checkpoint,
        lastReason: reason,
      },
    });

    return { credited: credit, balance: updated.balance };
  }

  async spendDust(userId: string, amount: number, memo: string) {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });
    if (!user?.walletAddress) {
      throw new BadRequestException('User wallet not connected');
    }

    const amountWei = this.toDustWei(amount);

    try {
      const balanceWei = await this.blockchain.getDustBalance(
        user.walletAddress,
      );
      if (balanceWei < amountWei) {
        this.logger.warn(
          `User ${userId} insufficient on-chain DUST for ${memo}`,
        );
        throw new BadRequestException('Insufficient on-chain DUST');
      }

      // const burnTx = await this.blockchain.burnDust(user.walletAddress, amount);
      // this.logger.log(
      //   `Burned ${amount} DUST from user ${userId} for ${memo} (tx=${burnTx ?? 'n/a'})`,
      // );
      // return { burned: amount, txHash: burnTx };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Failed to burn DUST for ${userId}: ${error}`);
      throw new BadRequestException('Failed to burn DUST on-chain');
    }
  }

  async getBalance(userId: string) {
    const balance = await this.ensureUserBalance(userId);
    return balance.balance;
  }

  async getMultiplier(_userId: string) {
    return 1;
  }

  private async ensureUserBalance(userId: string) {
    const token = await this.prisma.token.upsert({
      where: { symbol: this.dustSymbol },
      update: {},
      create: {
        symbol: this.dustSymbol,
        description: 'Off-chain reputation points',
      },
    });

    return this.prisma.userTokenBalance.upsert({
      where: { userId_tokenId: { userId, tokenId: token.id } },
      create: {
        userId,
        tokenId: token.id,
        balance: 0,
        dailyEarned: 0,
        dailyEarnedCheckpoint: new Date(),
      },
      update: {},
    });
  }

  private toDustWei(amount: number | bigint) {
    const normalized =
      typeof amount === 'number' ? BigInt(Math.trunc(amount)) : amount;
    return normalized * DUST_UNIT;
  }
}
