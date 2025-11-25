import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SbtService } from '../sbt/sbt.service';
import { NotificationService } from '../notifications/notification.service';
import { ZkService } from '../zk/zk.service';

const TIERS = [
  { name: 'Dust', min: 0 },
  { name: 'Spark', min: 300 },
  { name: 'Flare', min: 600 },
  { name: 'Nova', min: 800 },
];

@Injectable()
export class TierService {
  private readonly logger = new Logger(TierService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly sbtService: SbtService,
    private readonly notificationService: NotificationService,
    private readonly zkService: ZkService,
  ) {}

  resolveTier(score: number) {
    let tier = TIERS[0].name;
    for (const entry of TIERS) {
      if (score >= entry.min) {
        tier = entry.name;
      }
    }
    return tier;
  }

  async handleScoreChange(userId: string, score: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      this.logger.warn(`Cannot adjust tier, user ${userId} missing`);
      return;
    }
    const nextTier = this.resolveTier(score);
    if (nextTier === user.tier) {
      this.logger.debug(`Tier unchanged for ${userId}`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { tier: nextTier } }),
      this.prisma.tierHistory.create({ data: { userId, tier: nextTier, score } }),
    ]);

    await this.sbtService.ensureSbt(userId, nextTier, user.walletAddress);
    await this.zkService.queueProofRequest(userId, score);
    await this.notificationService.notify(userId, `Tier upgraded to ${nextTier}`);
    this.logger.log(`User ${userId} upgraded to ${nextTier}`);
  }

  async getMyTier(userId: string) {
    const [user, history] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.tierHistory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);
    return { tier: user?.tier ?? 'Dust', history };
  }
}
