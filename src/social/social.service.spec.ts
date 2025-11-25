import { NotFoundException } from '@nestjs/common';
import { SocialService } from './social.service';
import { PrismaService } from '../prisma/prisma.service';
import { DustService } from '../dust/dust.service';
import { TrustService } from '../trust/trust.service';
import { NotificationService } from '../notifications/notification.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ReactionAction } from './dto/react-post.dto';

describe('SocialService', () => {
  const prisma = {
    post: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    postReaction: {
      create: jest.fn(),
    },
    postBoost: {
      create: jest.fn(),
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
  const blockchain = { burnDustBoost: jest.fn() } as unknown as BlockchainService;

  let service: SocialService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SocialService(prisma, dust, trust, notifications, blockchain);
  });

  describe('createPost', () => {
    it('creates post and triggers reward/notifications', async () => {
      const dto = { text: 'gm', mediaUrls: ['https://img'] };
      (prisma.post.create as jest.Mock).mockResolvedValue({ id: 'post-1' });

      const post = await service.createPost('user-1', dto as any);

      expect(prisma.post.create).toHaveBeenCalledWith({
        data: {
          authorId: 'user-1',
          text: 'gm',
          ipfsCid: undefined,
          media: { create: [{ url: 'https://img' }] },
        },
        include: { media: true },
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

      const result = await service.reactToPost('user', 'post', {
        type: ReactionAction.COMMENT,
        commentText: 'nice',
      });

      expect(prisma.postReaction.create).toHaveBeenCalledWith({
        data: { postId: 'post', userId: 'user', type: ReactionAction.COMMENT, commentText: 'nice' },
      });
      expect(dust.rewardUser).toHaveBeenCalledWith('user', 3, 'post_comment');
      expect(trust.recordEvent).toHaveBeenCalledWith('user', 'post_comment', 3);
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
      expect(blockchain.burnDustBoost).toHaveBeenCalledWith('0xabc', BigInt(25), 12);
      expect(notifications.notify).toHaveBeenCalledWith('author', 'Your post received a boost');
      expect(boost).toEqual({ id: 'boost', sequence: 12 });
    });
  });
});
