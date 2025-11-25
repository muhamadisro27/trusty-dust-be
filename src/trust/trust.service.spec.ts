import { TrustService } from './trust.service';
import { PrismaService } from '../prisma/prisma.service';
import { DustService } from '../dust/dust.service';
import { TierService } from '../tier/tier.service';

describe('TrustService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    trustEvent: {
      create: jest.fn(),
      aggregate: jest.fn(),
    },
    trustSnapshot: {
      create: jest.fn(),
    },
  } as unknown as PrismaService;
  const dust = { getMultiplier: jest.fn() } as unknown as DustService;
  const tier = { handleScoreChange: jest.fn() } as unknown as TierService;

  let service: TrustService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TrustService(prisma, dust, tier);
  });

  it('getScore returns stored trustScore or zero', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce({ trustScore: 123 });
    expect(await service.getScore('user')).toBe(123);
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
    expect(await service.getScore('user')).toBe(0);
  });

  describe('recordEvent', () => {
    it('creates event then recalculates score', async () => {
      const spy = jest.spyOn(service, 'recalculateScore').mockResolvedValue(42);
      (prisma.trustEvent.create as jest.Mock).mockResolvedValue({});
      const result = await service.recordEvent('user', 'source', 3);
      expect(prisma.trustEvent.create).toHaveBeenCalledWith({
        data: { userId: 'user', source: 'source', delta: 3 },
      });
      expect(spy).toHaveBeenCalledWith('user');
      expect(result).toBe(42);
    });
  });

  describe('recalculateScore', () => {
    it('aggregates trust events, applies multiplier, stores snapshot and informs tier service', async () => {
      (prisma.trustEvent.aggregate as jest.Mock).mockResolvedValue({ _sum: { delta: 350 } });
      (dust.getMultiplier as jest.Mock).mockResolvedValue(1.2);
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.trustSnapshot.create as jest.Mock).mockResolvedValue({});

      const result = await service.recalculateScore('user');

      expect(result).toBe(420);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user' },
        data: { trustScore: 420 },
      });
      expect(prisma.trustSnapshot.create).toHaveBeenCalledWith({ data: { userId: 'user', score: 420 } });
      expect(tier.handleScoreChange).toHaveBeenCalledWith('user', 420);
    });

    it('caps total score at 1000 and floor at 0', async () => {
      (prisma.trustEvent.aggregate as jest.Mock).mockResolvedValue({ _sum: { delta: -5 } });
      (dust.getMultiplier as jest.Mock).mockResolvedValue(10);

      await service.recalculateScore('user');
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user' }, data: { trustScore: 0 } });

      (prisma.trustEvent.aggregate as jest.Mock).mockResolvedValue({ _sum: { delta: 2000 } });
      await service.recalculateScore('user');
      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'user' }, data: { trustScore: 1000 } });
    });
  });
});
