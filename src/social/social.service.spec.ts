import { NotFoundException } from '@nestjs/common';
import { SocialService } from './social.service';
import { PrismaService } from '../prisma/prisma.service';
import { DustService } from '../dust/dust.service';
import { TrustService } from '../trust/trust.service';
import { NotificationService } from '../notifications/notification.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ReactionAction } from './dto/react-post.dto';
import { PinataService } from '../ipfs/pinata.service';

describe('SocialService', () => {
  const prisma = {
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    postReaction: {
      create: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    postBoost: {
      create: jest.fn(),
    },
    follow: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaService;
  const dust = {
    rewardUser: jest.fn(),
    spendDust: jest.fn(),
  } as unknown as DustService;
  const trust = { recordEvent: jest.fn() } as unknown as TrustService;
  const notifications = { notify: jest.fn() } as unknown as NotificationService;
  const blockchain = {
    burnDustBoost: jest.fn(),
    mintPost: jest.fn(),
    rewardSocial: jest.fn(),
  } as unknown as BlockchainService;
  const pinata = {
    uploadFile: jest.fn(),
    uploadJson: jest.fn(),
  } as unknown as PinataService;

  let service: SocialService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SocialService(prisma, dust, trust, notifications, blockchain, pinata);
  });

  describe('listPosts', () => {
    it('returns posts with counts, viewer reaction, and follow state', async () => {
      const createdAt = new Date();
      (prisma.post.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'post-1',
          authorId: 'author',
          text: 'gm',
          ipfsCid: null,
          createdAt,
          media: [],
          author: { id: 'author', username: 'alex', avatar: null, tier: 'Dust', jobTitle: 'UI' },
        },
      ]);
      (prisma.postReaction.groupBy as jest.Mock).mockResolvedValue([
        { postId: 'post-1', type: 'LIKE', _count: { _all: 3 } },
        { postId: 'post-1', type: 'COMMENT', _count: { _all: 2 } },
      ]);
      (prisma.postReaction.findMany as jest.Mock).mockResolvedValueOnce([
        { postId: 'post-1', type: 'LIKE' },
      ]);
      (prisma.postReaction.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'c-1',
          commentText: 'nice',
          createdAt,
          user: { id: 'commenter', username: 'bob', avatar: null, tier: 'Spark' },
        },
      ]);
      (prisma.follow.findMany as jest.Mock).mockResolvedValue([{ followingId: 'author' }]);

      const result = await service.listPosts('viewer', { limit: 1 } as any);

      expect(prisma.post.findMany).toHaveBeenCalled();
      expect(result.data[0].reactionCounts).toEqual({ like: 3, comment: 2, repost: 0 });
      expect(result.data[0].viewerReaction).toBe('LIKE');
      expect(result.data[0].author.isFollowedByViewer).toBe(true);
      expect(result.data[0].commentPreview).toHaveLength(1);
    });
  });

  describe('getPostDetail', () => {
    it('returns single post with comments and counts', async () => {
      const createdAt = new Date();
      (prisma.post.findUnique as jest.Mock).mockResolvedValue({
        id: 'post-1',
        authorId: 'author',
        text: 'hello',
        ipfsCid: null,
        createdAt,
        media: [],
        author: { id: 'author', username: 'alex', avatar: null, tier: 'Dust', jobTitle: 'UX' },
      });
      (prisma.postReaction.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'comment-1',
          commentText: 'nice',
          createdAt,
          user: { id: 'commenter', username: 'bob', avatar: null, tier: 'Spark' },
        },
      ]);
      (prisma.postReaction.groupBy as jest.Mock).mockResolvedValue([
        { postId: 'post-1', type: 'LIKE', _count: { _all: 1 } },
        { postId: 'post-1', type: 'COMMENT', _count: { _all: 1 } },
      ]);
      (prisma.postReaction.findFirst as jest.Mock).mockResolvedValue({ type: 'LIKE' });
      (prisma.follow.findFirst as jest.Mock).mockResolvedValue({ id: 'follow' });

      const detail = await service.getPostDetail('viewer', 'post-1', { commentsLimit: 5 } as any);

      expect(prisma.post.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'post-1' } }),
      );
      expect(detail.reactionCounts).toEqual({ like: 1, comment: 1, repost: 0 });
      expect(detail.viewerReaction).toBe('LIKE');
      expect(detail.comments).toHaveLength(1);
      expect(detail.author.isFollowedByViewer).toBe(true);
    });
  });

  describe('createPost', () => {
    it('uploads binary assets, pins metadata, mints, and notifies', async () => {
      const dto = { text: 'gm', mediaUrls: ['https://img'] };
      (prisma.post.create as jest.Mock).mockResolvedValue({ id: 'post-1' });
      (blockchain.mintPost as jest.Mock).mockResolvedValue('0xtx');
      (pinata.uploadFile as jest.Mock).mockResolvedValue({ cid: 'cid1', uri: 'ipfs://cid1' });
      (pinata.uploadJson as jest.Mock).mockResolvedValue({ cid: 'meta', uri: 'ipfs://meta' });

      const files = {
        images: [{ buffer: Buffer.from('img'), originalname: 'img.png', mimetype: 'image/png' } as any],
        attachments: undefined,
      };

      const post = await service.createPost('user-1', dto as any, files);

      expect(pinata.uploadFile).toHaveBeenCalled();
      expect(pinata.uploadJson).toHaveBeenCalled();
      expect(prisma.post.create).toHaveBeenCalledWith({
        data: {
          authorId: 'user-1',
          text: 'gm',
          ipfsCid: 'ipfs://meta',
          media: { create: [{ url: 'https://img' }, { url: 'ipfs://cid1' }] },
        },
        include: { media: true },
      });
      expect(blockchain.mintPost).toHaveBeenCalledWith('ipfs://meta');
      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { onchainMintTx: '0xtx' },
      });
      expect(dust.rewardUser).toHaveBeenCalledWith('user-1', 3, 'post_created');
      expect(trust.recordEvent).toHaveBeenCalledWith('user-1', 'post_created', 3);
      expect(notifications.notify).toHaveBeenCalledWith('user-1', 'Post published. +3 DUST');
      expect(post).toEqual({ id: 'post-1' });
    });
  });

  describe('reactToPost', () => {
    it('throws when post missing', async () => {
      (prisma.post.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.reactToPost('user', 'post', { type: ReactionAction.LIKE }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates reaction, rewards on like/comment/repost, notifies author', async () => {
      (prisma.post.findUnique as jest.Mock).mockResolvedValue({ id: 'post', authorId: 'author' });
      (prisma.postReaction.create as jest.Mock).mockResolvedValue({ id: 'reaction' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ walletAddress: '0xreactor' });

      const result = await service.reactToPost('user', 'post', {
        type: ReactionAction.COMMENT,
        commentText: 'nice',
      });

      expect(prisma.postReaction.create).toHaveBeenCalledWith({
        data: { postId: 'post', userId: 'user', type: ReactionAction.COMMENT, commentText: 'nice' },
      });
      expect(dust.rewardUser).toHaveBeenCalledWith('user', 3, 'post_comment');
      expect(trust.recordEvent).toHaveBeenCalledWith('user', 'post_comment', 3);
      expect(blockchain.rewardSocial).toHaveBeenCalledWith('0xreactor', ReactionAction.COMMENT);
      expect(notifications.notify).toHaveBeenCalledWith('author', 'New interaction on your post');
      expect(result).toEqual({ id: 'reaction' });
    });
  });

  describe('boostPost', () => {
    it('throws when post missing', async () => {
      (prisma.post.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(
        service.boostPost('user', 'post', { amount: 10 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when booster missing', async () => {
      (prisma.post.findUnique as jest.Mock).mockResolvedValue({ id: 'post', authorId: 'author' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.boostPost('user', 'post', { amount: 5 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('spends dust, creates boost, burns on chain, notifies author', async () => {
      (prisma.post.findUnique as jest.Mock).mockResolvedValue({ id: 'post', authorId: 'author' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user',
        walletAddress: '0xabc',
      });
      (prisma.postBoost.create as jest.Mock).mockResolvedValue({ id: 'boost', sequence: 12 });

      const boost = await service.boostPost('user', 'post', { amount: 25, note: 'promo' });

      expect(dust.spendDust).toHaveBeenCalledWith('user', 25, 'post_boost');
      expect(prisma.postBoost.create).toHaveBeenCalledWith({
        data: {
          postId: 'post',
          userId: 'user',
          dustSpent: 25,
          note: 'promo',
        },
      });
      expect(blockchain.burnDustBoost).toHaveBeenCalledWith('0xabc', 25, 12);
      expect(notifications.notify).toHaveBeenCalledWith('author', 'Your post received a boost');
      expect(boost).toEqual({ id: 'boost', sequence: 12 });
    });
  });
});
