import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('TierModule (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.$transaction([
      prisma.tierHistory.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  it('GET /tier/me returns tier & history array', async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xtier00001',
        username: 'tier-user',
        tier: 'Spark',
        trustScore: 500,
        tierHistory: {
          create: [{ tier: 'Spark', score: 450 }],
        },
      },
    });
    const token = await jwtService.signAsync({ userId: user.id, walletAddress: user.walletAddress });

    const response = await request(app.getHttpServer())
      .get('/api/v1/tier/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.tier).toBe('Spark');
    expect(response.body.history).toHaveLength(1);
  });
});
