import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/auth/auth.service';

describe('AuthModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
    process.env.PRIVY_SECRET_KEY = process.env.PRIVY_SECRET_KEY ?? 'privy-test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.zkProof.deleteMany(),
      prisma.jobApplication.deleteMany(),
      prisma.job.deleteMany(),
      prisma.post.deleteMany(),
      prisma.userTokenBalance.deleteMany(),
      prisma.token.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  it('POST /auth/login issues backend JWT when Privy guard succeeds', async () => {
    const spy = jest
      .spyOn(authService, 'verifyPrivyToken')
      .mockResolvedValue({ userId: 'privy-user', walletAddress: '0x1234abcd' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Authorization', 'Bearer privy-jwt')
      .send({})
      .expect(201);

    expect(response.body).toHaveProperty('accessToken');
    expect(response.body.user.walletAddress).toBe('0x1234abcd');

    spy.mockRestore();
  });
});
