import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrivyUserPayload } from '../auth/interfaces/privy-user.interface';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    this.logger.debug(`Fetching user by id ${id}`);
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByWallet(walletAddress: string) {
    this.logger.debug(`Fetching user by wallet ${walletAddress}`);
    return this.prisma.user.findUnique({ where: { walletAddress: walletAddress.toLowerCase() } });
  }

  async upsertFromPrivy(privy: PrivyUserPayload) {
    return this.prisma.user.upsert({
      where: { walletAddress: privy.walletAddress.toLowerCase() },
      create: {
        walletAddress: privy.walletAddress.toLowerCase(),
        username: privy.email ?? privy.walletAddress.slice(0, 6),
        trustScore: 0,
        tier: 'Dust',
      },
      update: privy.email
        ? {
            username: privy.email,
          }
        : {},
    });
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    this.logger.log(`Updating profile for user ${userId}`);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        username: dto.username,
        avatar: dto.avatar,
      },
    });
    return updated;
  }

  async ensureExists(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      this.logger.warn(`User ${userId} not found`);
      throw new NotFoundException('User not found');
    }
    return user;
  }
}
