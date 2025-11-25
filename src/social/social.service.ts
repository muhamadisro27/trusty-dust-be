import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { DustService } from '../dust/dust.service';
import { TrustService } from '../trust/trust.service';
import { NotificationService } from '../notifications/notification.service';
import { BoostPostDto } from './dto/boost-post.dto';
import { ReactPostDto, ReactionAction } from './dto/react-post.dto';
import { BlockchainService } from '../blockchain/blockchain.service';

const DUST_REWARD_BY_ACTION: Record<ReactionAction, number> = {
  [ReactionAction.LIKE]: 1,
  [ReactionAction.COMMENT]: 3,
  [ReactionAction.REPOST]: 1,
};

@Injectable()
export class SocialService {
  private readonly logger = new Logger(SocialService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dustService: DustService,
    private readonly trustService: TrustService,
    private readonly notifications: NotificationService,
    private readonly blockchain: BlockchainService,
  ) {}

  async createPost(userId: string, dto: CreatePostDto) {
    this.logger.log(`User ${userId} creating post`);
    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        text: dto.text,
        ipfsCid: dto.ipfsCid,
        media: {
          create: dto.mediaUrls?.map((url) => ({ url })) ?? [],
        },
      },
      include: { media: true },
    });

    await this.dustService.rewardUser(userId, 3, 'post_created');
    await this.trustService.recordEvent(userId, 'post_created', 3);
    await this.notifications.notify(userId, 'Post published. +3 DUST');
    this.logger.log(`Post ${post.id} created by user ${userId}`);

    return post;
  }

  async reactToPost(userId: string, postId: string, dto: ReactPostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const reaction = await this.prisma.postReaction.create({
      data: {
        postId,
        userId,
        type: dto.type,
        commentText: dto.commentText,
      },
    });

    const reward = DUST_REWARD_BY_ACTION[dto.type] ?? 0;
    if (reward > 0) {
      this.logger.log(`Reward ${reward} DUST for user ${userId} reaction ${dto.type}`);
      await this.dustService.rewardUser(userId, reward, `post_${dto.type.toLowerCase()}`);
      await this.trustService.recordEvent(userId, `post_${dto.type.toLowerCase()}`, reward);
    }

    await this.notifications.notify(post.authorId, 'New interaction on your post');
    this.logger.debug(`User ${userId} reacted to post ${postId}`);
    return reaction;
  }

  async boostPost(userId: string, postId: string, dto: BoostPostDto) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.dustService.spendDust(userId, dto.amount, 'post_boost');
    const booster = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!booster) {
      throw new NotFoundException('User not found');
    }
    const boost = await this.prisma.postBoost.create({
      data: {
        postId,
        userId,
        dustSpent: dto.amount,
        note: dto.note,
      },
    });

    await this.blockchain.burnDustBoost(booster.walletAddress, BigInt(dto.amount), boost.sequence);
    await this.notifications.notify(post.authorId, 'Your post received a boost');
    this.logger.log(`User ${userId} boosted post ${postId} with ${dto.amount} DUST`);
    return boost;
  }
}
