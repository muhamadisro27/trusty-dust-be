import { TierService } from './tier.service';
import { PrismaService } from '../prisma/prisma.service';
import { SbtService } from '../sbt/sbt.service';
import { NotificationService } from '../notifications/notification.service';
import { ZkService } from '../zk/zk.service';

describe('TierService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    tierHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  } as unknown as PrismaService;
  const sbt = { ensureSbt: jest.fn() } as unknown as SbtService;
  const notification = { notify: jest.fn() } as unknown as NotificationService;
  const zk = { queueProofRequest: jest.fn() } as unknown as ZkService;

  let service: TierService;

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.$transaction as jest.Mock).mockImplementation((actions) => Promise.resolve(actions));
    service = new TierService(prisma, sbt, notification, zk);
  });

  it('resolveTier maps score to threshold', () => {
    expect(service.resolveTier(0)).toBe('Dust');
    expect(service.resolveTier(350)).toBe('Spark');
    expect(service.resolveTier(750)).toBe('Flare');
    expect(service.resolveTier(900)).toBe('Nova');
  });

  describe('handleScoreChange', () => {
    it('returns when user missing', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await service.handleScoreChange('user', 400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns when tier unchanged', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user', tier: 'Spark' });
      await service.handleScoreChange('user', 350);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates user tier, creates history, triggers sbt/zk/notification', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user',
        tier: 'Dust',
        walletAddress: '0xabc',
      });

      await service.handleScoreChange('user', 360);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(sbt.ensureSbt).toHaveBeenCalledWith('user', 'Spark', '0xabc');
      expect(zk.queueProofRequest).toHaveBeenCalledWith('user', 360);
      expect(notification.notify).toHaveBeenCalledWith('user', 'Tier upgraded to Spark');
    });
  });

  describe('getMyTier', () => {
    it('returns tier and history from prisma', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ tier: 'Spark' });
      (prisma.tierHistory.findMany as jest.Mock).mockResolvedValue([{ tier: 'Spark' }]);

      const result = await service.getMyTier('user');

      expect(prisma.tierHistory.findMany).toHaveBeenCalledWith({
        where: { userId: 'user' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual({ tier: 'Spark', history: [{ tier: 'Spark' }] });
    });
  });
});
