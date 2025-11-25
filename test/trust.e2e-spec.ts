import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

describe('TrustModule (e2e)', () => {
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
      prisma.trustEvent.deleteMany(),
      prisma.user.deleteMany(),
    ]);
  });

  const createUserAndToken = async () => {
    const user = await prisma.user.create({
      data: {
        walletAddress: '0xtrust0000000000000000000000000000000001',
        username: 'trusty',
        tier: 'Dust',
        trustScore: 432,
      },
    });
    const token = await jwtService.signAsync({ userId: user.id, walletAddress: user.walletAddress });
    return { user, token };
  };

  it('GET /trust/score returns numeric trust score', async () => {
    const { token, user } = await createUserAndToken();

    const response = await request(app.getHttpServer())
      .get('/api/v1/trust/score')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toBe(user.trustScore);
  });
});
