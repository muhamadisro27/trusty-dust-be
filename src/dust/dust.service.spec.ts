import { BadRequestException } from '@nestjs/common';
import { DustService } from './dust.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DustService', () => {
  const prisma = {
    token: {
      upsert: jest.fn(),
    },
    userTokenBalance: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: DustService;

  const mockBalance = {
    id: 'balance-1',
    balance: 10,
    dailyEarned: 5,
    dailyEarnedCheckpoint: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.token.upsert as jest.Mock).mockResolvedValue({ id: 'token-1' });
    (prisma.userTokenBalance.upsert as jest.Mock).mockResolvedValue(mockBalance);
    service = new DustService(prisma);
  });

  describe('rewardUser', () => {
    it('caps rewards when exceeding daily limit', async () => {
      const updateReturn = { id: 'balance-1', balance: 12 };
      (prisma.userTokenBalance.update as jest.Mock).mockResolvedValue(updateReturn);

      const result = await service.rewardUser('user', 100, 'testing');

      expect(result).toEqual({ credited: 45, balance: 12 });
      expect(prisma.userTokenBalance.update).toHaveBeenCalled();
    });

    it('skips update when cap reached', async () => {
      const balance = {
        ...mockBalance,
        dailyEarned: 50,
        dailyEarnedCheckpoint: new Date(),
      };
      (prisma.userTokenBalance.upsert as jest.Mock).mockResolvedValue(balance);

      const result = await service.rewardUser('user', 5, 'testing');

      expect(result).toEqual({ credited: 0, balance: 10 });
      expect(prisma.userTokenBalance.update).not.toHaveBeenCalled();
    });
  });

  describe('spendDust', () => {
    it('throws when insufficient balance', async () => {
      await expect(service.spendDust('user', 50, 'spend')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('debits balance when sufficient', async () => {
      (prisma.userTokenBalance.update as jest.Mock).mockResolvedValue({ balance: 4 });
      const result = await service.spendDust('user', 6, 'memo');
      expect(prisma.userTokenBalance.update).toHaveBeenCalledWith({
        where: { id: 'balance-1' },
        data: { balance: 4, lastReason: 'memo' },
      });
      expect(result).toEqual({ balance: 4 });
    });
  });

  it('getBalance returns ensureUserBalance result', async () => {
    const balance = await service.getBalance('user');
    expect(balance).toBe(10);
  });

  it('getMultiplier returns 1', async () => {
    expect(await service.getMultiplier('user')).toBe(1);
  });
});
