import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DustService } from '../dust/dust.service';
import { TierService } from '../tier/tier.service';

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly dustService: DustService,
    private readonly tierService: TierService,
  ) {}

  async getScore(userId: string) {
    this.logger.debug(`Fetching trust score for ${userId}`);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user?.trustScore ?? 0;
  }

  async recordEvent(userId: string, source: string, delta: number) {
    await this.prisma.trustEvent.create({
      data: {
        userId,
        source,
        delta,
      },
    });
    this.logger.log(`Recorded trust event ${source} (${delta}) for user ${userId}`);
    return this.recalculateScore(userId);
  }

  async recalculateScore(userId: string) {
    const aggregate = await this.prisma.trustEvent.aggregate({
      where: { userId },
      _sum: { delta: true },
    });
    const baseScore = Math.max(0, aggregate._sum.delta ?? 0);
    const multiplier = await this.dustService.getMultiplier(userId);
    const totalScore = Math.min(1000, Math.round(baseScore * multiplier));

    await this.prisma.user.update({ where: { id: userId }, data: { trustScore: totalScore } });
    await this.prisma.trustSnapshot.create({ data: { userId, score: totalScore } });
    await this.tierService.handleScoreChange(userId, totalScore);
    this.logger.log(`New trust score for ${userId}: ${totalScore}`);

    return totalScore;
  }
}
