import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAILY_REWARD_CAP = 50;

@Injectable()
export class DustService {
  private readonly dustSymbol = 'DUST';
  private readonly logger = new Logger(DustService.name);

  constructor(private readonly prisma: PrismaService) {}

  async rewardUser(userId: string, amount: number, reason: string) {
    const balance = await this.ensureUserBalance(userId);
    this.logger.log(`Rewarding user ${userId} with ${amount} DUST for ${reason}`);
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
    const balance = await this.ensureUserBalance(userId);
    if (balance.balance < amount) {
      this.logger.warn(`User ${userId} insufficient DUST for ${memo}`);
      throw new BadRequestException('Insufficient DUST');
    }
    this.logger.log(`Spending ${amount} DUST from user ${userId} for ${memo}`);
    return this.prisma.userTokenBalance.update({
      where: { id: balance.id },
      data: {
        balance: balance.balance - amount,
        lastReason: memo,
      },
    });
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
      create: { symbol: this.dustSymbol, description: 'Off-chain reputation points' },
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
}
