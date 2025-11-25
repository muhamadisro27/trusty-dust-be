import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrivyUserPayload } from './interfaces/privy-user.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';

jest.mock('axios');

describe('AuthService', () => {
  const mockJwtService = { signAsync: jest.fn() } as unknown as JwtService;
  const mockConfigService = { get: jest.fn() } as unknown as ConfigService;
  const mockUsersService = {
    upsertFromPrivy: jest.fn(),
    findById: jest.fn(),
  } as unknown as UsersService;

  const mockAxiosPost = jest.fn();
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue({ post: mockAxiosPost } as any);
    service = new AuthService(mockJwtService, mockConfigService, mockUsersService);
  });

  describe('verifyPrivyToken', () => {
    it('throws when PRIVY_SECRET_KEY missing', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'PRIVY_SECRET_KEY') {
          return undefined;
        }
        return 'jwt-secret';
      });

      await expect(service.verifyPrivyToken('privy-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mockAxiosPost).not.toHaveBeenCalled();
    });

    it('returns payload when Privy verification succeeds', async () => {
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'PRIVY_SECRET_KEY') {
          return 'privy-secret';
        }
        return 'jwt-secret';
      });
      mockAxiosPost.mockResolvedValue({
        data: {
          user: {
            id: 'privy-user',
            wallet: { address: '0xPrivy' },
            email: 'test@example.com',
          },
          verified_at: '2024-01-01T00:00:00.000Z',
        },
      });

      const payload = await service.verifyPrivyToken('token');

      expect(payload).toEqual({
        userId: 'privy-user',
        walletAddress: '0xPrivy',
        email: 'test@example.com',
        verifiedAt: '2024-01-01T00:00:00.000Z',
      });
      expect(mockAxiosPost).toHaveBeenCalledWith(
        '/verify',
        { token: 'token' },
        { headers: { Authorization: 'Bearer privy-secret' } },
      );
    });

    it('throws when payload missing wallet', async () => {
      (mockConfigService.get as jest.Mock).mockReturnValue('privy-secret');
      mockAxiosPost.mockResolvedValue({ data: { user: { id: 'user-without-wallet' } } });

      await expect(service.verifyPrivyToken('token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('issueBackendToken', () => {
    it('creates/updates user and signs JWT', async () => {
      const privyPayload: PrivyUserPayload = { userId: 'privy', walletAddress: '0xabc' };
      const user = { id: 'user-1', walletAddress: '0xabc' };
      (mockUsersService.upsertFromPrivy as jest.Mock).mockResolvedValue(user);
      (mockJwtService.signAsync as jest.Mock).mockResolvedValue('jwt-token');
      (mockConfigService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'PRIVY_SECRET_KEY') {
          return 'privy-secret';
        }
        if (key === 'JWT_SECRET') {
          return 'jwt-secret';
        }
        return undefined;
      });

      const result = await service.issueBackendToken(privyPayload);

      expect(mockUsersService.upsertFromPrivy).toHaveBeenCalledWith(privyPayload);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        { userId: 'user-1', walletAddress: '0xabc' },
        { secret: 'jwt-secret', expiresIn: '7d' },
      );
      expect(result).toEqual({ accessToken: 'jwt-token', user });
    });
  });

  describe('loginWithPrivyToken', () => {
    it('chains verify and issue token', async () => {
      const privyPayload: PrivyUserPayload = { userId: 'privy', walletAddress: '0x123' };
      const spyVerify = jest
        .spyOn(service, 'verifyPrivyToken')
        .mockResolvedValue(privyPayload);
      const issueResult = { accessToken: 'token', user: { id: '1' } };
      const spyIssue = jest.spyOn(service, 'issueBackendToken').mockResolvedValue(issueResult);

      const result = await service.loginWithPrivyToken('token');

      expect(spyVerify).toHaveBeenCalledWith('token');
      expect(spyIssue).toHaveBeenCalledWith(privyPayload);
      expect(result).toEqual(issueResult);
    });
  });

  describe('validateUser', () => {
    it('delegates to UsersService.findById', async () => {
      const payload: JwtPayload = { userId: 'user-1', walletAddress: '0xabc' };
      (mockUsersService.findById as jest.Mock).mockResolvedValue({ id: 'user-1' });

      const result = await service.validateUser(payload);

      expect(mockUsersService.findById).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ id: 'user-1' });
    });
  });
});
