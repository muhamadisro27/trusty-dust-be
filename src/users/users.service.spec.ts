import { NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { PrivyUserPayload } from '../auth/interfaces/privy-user.interface';

describe('UsersService', () => {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(prisma);
  });

  it('findById delegates to prisma', () => {
    service.findById('user-1');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('findByWallet forces lowercase', () => {
    service.findByWallet('0xABC');
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { walletAddress: '0xabc' },
    });
  });

  describe('upsertFromPrivy', () => {
    it('creates user when email provided', async () => {
      const payload: PrivyUserPayload = {
        userId: 'privy',
        walletAddress: '0xAAA',
        email: 'alice@example.com',
      };
      (prisma.user.upsert as jest.Mock).mockResolvedValue({ id: '1' });

      const user = await service.upsertFromPrivy(payload);

      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { walletAddress: '0xaaa' },
        create: {
          walletAddress: '0xaaa',
          username: 'alice@example.com',
          trustScore: 0,
          tier: 'Dust',
        },
        update: { username: 'alice@example.com' },
      });
      expect(user).toEqual({ id: '1' });
    });

    it('skips update username when email missing', async () => {
      const payload: PrivyUserPayload = {
        userId: 'privy',
        walletAddress: '0xBBB',
      };
      await service.upsertFromPrivy(payload);
      expect(prisma.user.upsert).toHaveBeenCalledWith({
        where: { walletAddress: '0xbbb' },
        create: {
          walletAddress: '0xbbb',
          username: payload.walletAddress.slice(0, 6),
          trustScore: 0,
          tier: 'Dust',
        },
        update: {},
      });
    });
  });

  it('updateProfile writes username & avatar', async () => {
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: '1', username: 'new' });
    const dto = { username: 'new', avatar: 'https://avatar' };
    const result = await service.updateProfile('user-1', dto);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { username: 'new', avatar: 'https://avatar' },
    });
    expect(result).toEqual({ id: '1', username: 'new' });
  });

  describe('ensureExists', () => {
    it('returns user when found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });
      const user = await service.ensureExists('user-1');
      expect(user).toEqual({ id: 'user-1' });
    });

    it('throws NotFound when missing', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.ensureExists('missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
