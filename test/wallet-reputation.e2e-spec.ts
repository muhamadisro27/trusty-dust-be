import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ZkService } from '../src/zk/zk.service';

describe('WalletReputationModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const zkMock = {
    generateProofForWalletScore: jest.fn().mockResolvedValue({ proofId: null }),
  } as Partial<ZkService>;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ZkService)
      .useValue({
        ...zkMock,
        generateProof: jest.fn(),
        verifyProof: jest.fn(),
        assertProof: jest.fn(),
        queueProofRequest: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await prisma.walletReputation.deleteMany();
    await prisma.user.deleteMany();
  });

  it('analyzes and retrieves wallet reputation', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xwallet000000000000000000000000000000001',
        username: 'analyst',
        tier: 'Dust',
        trustScore: 250,
      },
    });
    const token = await jwtService.signAsync({ userId: user.id, walletAddress: user.walletAddress });

    const analyzeResponse = await request(app.getHttpServer())
      .post('/api/v1/wallet-reputation/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ address: '0xDEADBEEF00000000000000000000000000000000', chainId: 1, userId: user.id })
      .expect(201);

    expect(analyzeResponse.body.address).toBe('0xdeadbeef00000000000000000000000000000000');
    expect(analyzeResponse.body.breakdown).toHaveProperty('txnScore');

    const latest = await request(app.getHttpServer())
      .get(`/api/v1/wallet-reputation/${user.walletAddress}`)
      .query({ chainId: 1 })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(latest.body.score).toBeDefined();
    expect(latest.body.breakdown).toHaveProperty('defiScore');
  });
});
