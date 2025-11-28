import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma, ReactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto } from './dto/create-post.dto';
import { DustService } from '../dust/dust.service';
import { TrustService } from '../trust/trust.service';
import { NotificationService } from '../notifications/notification.service';
import { BoostPostDto } from './dto/boost-post.dto';
import { ReactPostDto, ReactionAction } from './dto/react-post.dto';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ListPostsQueryDto } from './dto/list-posts-query.dto';
import { PostDetailQueryDto } from './dto/post-detail-query.dto';
import { PinataService, PinataUploadResult } from '../ipfs/pinata.service';
import type { Express } from 'express';

const DUST_REWARD_BY_ACTION: Record<ReactionAction, number> = {
  [ReactionAction.LIKE]: 1,
  [ReactionAction.COMMENT]: 3,
  [ReactionAction.REPOST]: 1,
};

type ReactionCounts = {
  like: number;
  comment: number;
  repost: number;
};

const AUTHOR_SELECT = {
  id: true,
  username: true,
  avatar: true,
  tier: true,
  jobTitle: true,
} satisfies Prisma.UserSelect;

type FeedPost = Prisma.PostGetPayload<{
  include: {
    media: true;
    author: { select: typeof AUTHOR_SELECT };
  };
}>;

type ReactionGroup = {
  postId: string;
  type: ReactionType;
  _count: { _all: number };
};

type UploadBundle = {
  images?: Express.Multer.File[];
  attachments?: Express.Multer.File[];
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
    private readonly pinata: PinataService,
  ) {}

  private clamp(value: number | undefined, min: number, max: number, fallback: number) {
    if (value === undefined || Number.isNaN(value)) {
      return fallback;
    }
    return Math.min(Math.max(value, min), max);
  }

  async listPosts(userId: string, query: ListPostsQueryDto) {
    const limit = this.clamp(query.limit, 1, 20, 10);
    const previewLimit = this.clamp(query.commentPreviewLimit, 0, 5, 2);
    const cursorOptions = query.cursor
      ? {
          cursor: { id: query.cursor },
          skip: 1,
        }
      : undefined;

    const posts = (await this.prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursorOptions ?? {}),
      include: {
        media: true,
        author: { select: AUTHOR_SELECT },
      },
    })) as FeedPost[];

    const page = posts.slice(0, limit);
    const postIds = page.map((post) => post.id);
    const authorIds = page.map((post) => post.authorId);

    const reactionGroupPromise = postIds.length
      ? this.prisma.postReaction.groupBy({
          by: ['postId', 'type'],
          where: { postId: { in: postIds } },
          _count: { _all: true },
        })
      : Promise.resolve([]);
    const viewerReactionsPromise = postIds.length
      ? this.prisma.postReaction.findMany({
          where: { postId: { in: postIds }, userId },
          select: { postId: true, type: true },
        })
      : Promise.resolve([]);
    const followStatesPromise = authorIds.length
      ? this.prisma.follow.findMany({
          where: { followerId: userId, followingId: { in: authorIds } },
          select: { followingId: true },
        })
      : Promise.resolve([]);

    const [reactionGroupRaw, viewerReactionsRaw, followStates] = await Promise.all([
      reactionGroupPromise,
      viewerReactionsPromise,
      followStatesPromise,
    ]);

    const reactionGroup = reactionGroupRaw as ReactionGroup[];
    const viewerReactions = viewerReactionsRaw as Array<{ postId: string; type: ReactionType }>;

    const counts = new Map<string, ReactionCounts>();
    postIds.forEach((id) =>
      counts.set(id, { like: 0, comment: 0, repost: 0 }),
    );
    reactionGroup.forEach((group) => {
      const bucket = counts.get(group.postId);
      if (!bucket) {
        return;
      }
      if (group.type === ReactionType.LIKE) bucket.like = group._count._all;
      if (group.type === ReactionType.COMMENT) bucket.comment = group._count._all;
      if (group.type === ReactionType.REPOST) bucket.repost = group._count._all;
    });

    const viewerReactionMap = new Map<string, ReactionType>(
      viewerReactions.map(
        (reaction) => [reaction.postId, reaction.type] as [string, ReactionType],
      ),
    );
    const followSet = new Set(followStates.map((state) => state.followingId));

    const commentPreviews = new Map<
      string,
      Array<{
        id: string;
        text: string | null;
        createdAt: Date;
        author: { id: string; username: string | null; avatar: string | null; tier: string };
      }>
    >();
    if (previewLimit > 0) {
      await Promise.all(
        postIds.map(async (postId) => {
          const comments = await this.prisma.postReaction.findMany({
            where: { postId, type: ReactionType.COMMENT },
            orderBy: { createdAt: 'desc' },
            take: previewLimit,
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  avatar: true,
                  tier: true,
                },
              },
            },
          });
          commentPreviews.set(
            postId,
            comments.map((comment) => ({
              id: comment.id,
              text: comment.commentText,
              createdAt: comment.createdAt,
              author: comment.user,
            })),
          );
        }),
      );
    }

    const hasNext = posts.length > limit;
    const nextCursor = hasNext ? page.at(-1)?.id ?? null : null;

    return {
      data: page.map((post) => ({
        id: post.id,
        text: post.text,
        ipfsCid: post.ipfsCid,
        createdAt: post.createdAt,
        media: post.media,
        author: {
          ...post.author,
          isFollowedByViewer: followSet.has(post.authorId),
        },
        reactionCounts: counts.get(post.id) ?? { like: 0, comment: 0, repost: 0 },
        viewerReaction: viewerReactionMap.get(post.id) ?? null,
        commentPreview: commentPreviews.get(post.id) ?? [],
      })),
      nextCursor,
    };
  }

  async getPostDetail(userId: string, postId: string, query: PostDetailQueryDto) {
    const post = (await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        media: true,
        author: { select: AUTHOR_SELECT },
      },
    })) as FeedPost | null;
    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const commentsLimit = this.clamp(query.commentsLimit, 1, 50, 20);

    const commentsPromise = this.prisma.postReaction.findMany({
      where: { postId, type: ReactionType.COMMENT },
      orderBy: { createdAt: 'desc' },
      take: commentsLimit,
      include: {
        user: { select: { id: true, username: true, avatar: true, tier: true } },
      },
    });
    const reactionGroupPromise = this.prisma.postReaction.groupBy({
      by: ['postId', 'type'],
      where: { postId },
      _count: { _all: true },
    });
    const viewerReactionPromise = this.prisma.postReaction.findFirst({
      where: { postId, userId },
      select: { type: true },
    });
    const followStatePromise = this.prisma.follow.findFirst({
      where: { followerId: userId, followingId: post.authorId },
      select: { id: true },
    });

    const [comments, reactionGroupRaw, viewerReactionRaw, followState] = await Promise.all([
      commentsPromise,
      reactionGroupPromise,
      viewerReactionPromise,
      followStatePromise,
    ]);

    const reactionGroup = reactionGroupRaw as ReactionGroup[];
    const viewerReaction = (viewerReactionRaw as { type: ReactionType } | null) ?? null;

    const counts: ReactionCounts = { like: 0, comment: 0, repost: 0 };
    reactionGroup.forEach((group) => {
      if (group.type === ReactionType.LIKE) counts.like = group._count._all;
      if (group.type === ReactionType.COMMENT) counts.comment = group._count._all;
      if (group.type === ReactionType.REPOST) counts.repost = group._count._all;
    });

    return {
      id: post.id,
      text: post.text,
      ipfsCid: post.ipfsCid,
      createdAt: post.createdAt,
      media: post.media,
      author: {
        ...post.author,
        isFollowedByViewer: Boolean(followState),
      },
      reactionCounts: counts,
      viewerReaction: viewerReaction?.type ?? null,
      comments: comments.map((comment) => ({
        id: comment.id,
        text: comment.commentText,
        createdAt: comment.createdAt,
        author: comment.user,
      })),
    };
  }

  async createPost(userId: string, dto: CreatePostDto, uploads?: UploadBundle) {
    this.logger.log(`User ${userId} creating post`);
    const [imageUploads, attachmentUploads] = await Promise.all([
      this.uploadFiles(uploads?.images, userId, 'post_image'),
      this.uploadFiles(uploads?.attachments, userId, 'post_attachment'),
    ]);
    const uploadedMediaUris = [...imageUploads, ...attachmentUploads].map((asset) => asset.uri);

    let metadataUri = dto.ipfsCid;
    if (!metadataUri) {
      const metadataPayload = {
        text: dto.text,
        images: imageUploads.map((asset) => asset.uri),
        attachments: attachmentUploads.map((asset) => asset.uri),
        mediaUrls: dto.mediaUrls ?? [],
        createdAt: new Date().toISOString(),
      };
      const metadataUpload = await this.pinata.uploadJson(metadataPayload, {
        creatorId: userId,
        type: 'post_metadata',
      });
      metadataUri = metadataUpload.uri;
    }

    const mergedMediaUrls = [
      ...(dto.mediaUrls ?? []),
      ...uploadedMediaUris,
    ];

    const post = await this.prisma.post.create({
      data: {
        authorId: userId,
        text: dto.text,
        ipfsCid: metadataUri,
        media: {
          create: mergedMediaUrls.map((url) => ({ url })),
        },
      },
      include: { media: true },
    });

    const mintTx = await this.blockchain.mintPost(metadataUri ?? '');
    if (mintTx) {
      await this.prisma.post.update({
        where: { id: post.id },
        data: { onchainMintTx: mintTx },
      });
      (post as typeof post & { onchainMintTx?: string | null }).onchainMintTx = mintTx;
    }

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
    const reactor = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true },
    });
    if (!reactor?.walletAddress) {
      throw new NotFoundException('User wallet missing');
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
    await this.blockchain.rewardSocial(reactor.walletAddress, dto.type);

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

    await this.blockchain.burnDustBoost(booster.walletAddress, dto.amount, boost.sequence);
    await this.notifications.notify(post.authorId, 'Your post received a boost');
    this.logger.log(`User ${userId} boosted post ${postId} with ${dto.amount} DUST`);
    return boost;
  }

  private async uploadFiles(
    files: Express.Multer.File[] | undefined,
    userId: string,
    type: string,
  ): Promise<PinataUploadResult[]> {
    if (!files?.length) {
      return [];
    }
    return Promise.all(
      files.map((file, index) =>
        this.pinata.uploadFile({
          file,
          metadata: {
            creatorId: userId,
            slot: String(index),
            type,
          },
        }),
      ),
    );
  }
}
