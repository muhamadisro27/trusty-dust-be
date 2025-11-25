import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrivyUserPayload } from '../auth/interfaces/privy-user.interface';
import { SearchPeopleQueryDto } from './dto/search-people.dto';

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
    const payload: Record<string, unknown> = {};
    if (dto.username !== undefined) payload.username = dto.username;
    if (dto.avatar !== undefined) payload.avatar = dto.avatar;
    if (dto.jobTitle !== undefined) payload.jobTitle = dto.jobTitle;
    if (dto.jobType !== undefined) payload.jobType = dto.jobType;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: payload,
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

  async searchPeople(requesterId: string, query: SearchPeopleQueryDto) {
    const take = Math.min(parseInt(query.limit ?? '20', 10) || 20, 50);
    const cursorOptions = query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : undefined;

    const where: Prisma.UserWhereInput = {
      id: { not: requesterId },
    };

    const keywordFilters: Prisma.UserWhereInput[] = [];
    if (query.keyword) {
      keywordFilters.push(
        { username: { contains: query.keyword, mode: Prisma.QueryMode.insensitive } },
        { jobTitle: { contains: query.keyword, mode: Prisma.QueryMode.insensitive } },
      );
    }
    if (keywordFilters.length) {
      where.OR = keywordFilters;
    }
    if (query.jobTitle) {
      where.jobTitle = { contains: query.jobTitle, mode: Prisma.QueryMode.insensitive };
    }
    if (query.jobType) {
      where.jobType = { equals: query.jobType, mode: Prisma.QueryMode.insensitive };
    }

    const results = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursorOptions ?? {}),
      select: {
        id: true,
        username: true,
        avatar: true,
        tier: true,
        jobTitle: true,
        jobType: true,
        trustScore: true,
        followers: {
          where: { followerId: requesterId },
          select: { id: true },
        },
      },
    });

    const hasNext = results.length > take;
    const data = results.slice(0, take).map((user) => ({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      tier: user.tier,
      jobTitle: user.jobTitle,
      jobType: user.jobType,
      trustScore: user.trustScore,
      isFollowing: user.followers.length > 0,
    }));

    return {
      data,
      nextCursor: hasNext ? data[data.length - 1]?.id ?? null : null,
    };
  }

  async followUser(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    const target = await this.findById(followingId);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId,
          followingId,
        },
      },
      create: {
        followerId,
        followingId,
      },
      update: {},
    });
    return { success: true };
  }

  async unfollowUser(followerId: string, followingId: string) {
    await this.prisma.follow.deleteMany({
      where: { followerId, followingId },
    });
    return { success: true };
  }

  async suggestedPeople(userId: string) {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true, jobType: true },
    });
    if (!requester) {
      throw new NotFoundException('User not found');
    }

    const baseSuggestions = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        followers: { none: { followerId: userId } },
        OR: [
          { tier: requester.tier },
          ...(requester.jobType
            ? [{ jobType: { equals: requester.jobType, mode: Prisma.QueryMode.insensitive } }]
            : []),
        ],
      },
      orderBy: { trustScore: 'desc' },
      take: 3,
      select: {
        id: true,
        username: true,
        avatar: true,
        jobTitle: true,
        jobType: true,
        tier: true,
        trustScore: true,
      },
    });

    if (baseSuggestions.length >= 3) {
      return baseSuggestions;
    }

    const fallback = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        followers: { none: { followerId: userId } },
      },
      orderBy: { trustScore: 'desc' },
      take: 3,
      select: {
        id: true,
        username: true,
        avatar: true,
        jobTitle: true,
        jobType: true,
        tier: true,
        trustScore: true,
      },
    });

    return fallback;
  }
}
